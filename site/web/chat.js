// Чаты Arcade: chat?lang=…#k=<код ссылки>&c=<чат>. Код ссылки выдаёт мод (POST /api/me/chats/ticket { link: true }):
// он живёт десять минут и годится один раз — страница сразу меняет его на билет чата. С билетом страница читает и пишет
// в чаты человека и видит его друзей, а ключ сессии мода браузеру не нужен. Билет живёт только в этой вкладке
// (sessionStorage) и в адрес не попадает — ссылку на страницу можно переслать, не отдав переписку. #t=<билет> тоже
// принимается и сразу уходит из адреса.
// Новые сообщения приходят по живому соединению /net/chat; пока его нет — страница спрашивает сама раз в 10 секунд.
// Сообщения хранятся на сайте Arcade как есть, без шифрования.
;(function () {
  'use strict'

  const TICKET = /^(\d{1,20})\.(\d{10})\.([0-9a-f]{12})\.([A-Za-z0-9_-]{22})$/
  const CHAT = /^(?:d\d{1,20}-\d{1,20}|g[A-Za-z0-9_-]{16})$/
  const MAX_TEXT = 2000
  const POLL_MS = 10_000
  const LIST_MS = 2 * 60_000
  const PING_MS = 30_000
  const KEY = 'arcade:chat'
  const lang = window.ArcadeI18n ? window.ArcadeI18n.lang : 'ru'
  // 24 аватарки мода (avatars.js); не загрузились — кружков нет, остальное работает
  const Avatars = window.ArcadeAvatars || null
  const root = document.getElementById('chat')

  let ticket = null
  let me = null // { id, handle?, pic? }
  let chats = [] // список из /api/me/chats, новые сверху
  let unread = 0
  const names = new Map() // номер → @ник без @
  const pics = new Map() // номер → номер аватарки 0–23, кто её выбрал
  let online = new Set() // друзья в сети — приходят со списком чатов
  let current = null // { id, chat, messages, first, gone }
  let panel = null // 'new' | 'members' — лист поверх переписки
  let friends = null // [{ id, handle }] — для нового чата и группы
  let parts = null
  let socket = null
  let live = false
  let retry = 0
  let sending = false
  let leaving = false // «Выйти из группы» нажато один раз
  let listTimer = null

  function el(tag, props, children) {
    const node = Object.assign(document.createElement(tag), props || {})
    for (const child of children || []) if (child) node.append(child)
    return node
  }
  const button = (text, onClick, className) => {
    const b = el('button', { type: 'button', className: className ? `btn ${className}` : 'btn', textContent: text })
    b.addEventListener('click', onClick)
    return b
  }

  // --- Аватарки ------------------------------------------------------------------------------------------------
  const validPic = (n) => Boolean(Avatars) && Avatars.validPic(n)
  // Кружок: size — '' (список), 'small' или 'tiny'; on — зелёная точка «в сети»
  function ava(svg, size, on) {
    const span = el('span', { className: ['ava', size, on && 'on'].filter(Boolean).join(' ') })
    paint(span, svg)
    return span
  }
  function paint(span, svg) {
    span.textContent = ''
    if (svg) span.append(el('img', { src: `data:image/svg+xml,${encodeURIComponent(svg)}`, alt: '' }))
  }
  // Человек — его аватарка, иначе первая буква ника на круге цвета от ника
  function personSvg(id) {
    if (!Avatars) return ''
    const self = Boolean(me && id === me.id)
    const handle = names.get(id) || (self && me.handle) || ''
    const pic = pics.has(id) ? pics.get(id) : self ? me.pic : undefined
    return Avatars.picSvg(pic, handle || '?', handle || id)
  }
  // Группа — картинка, которую выбрал хозяин, иначе первая буква названия на круге цвета от номера чата
  const groupSvg = (c) => (Avatars ? Avatars.picSvg(c.pic, c.name || T('Группа'), c.id) : '')
  const chatSvg = (c) => (c.kind === 'group' ? groupSvg(c) : personSvg(c.with))

  // --- Билет ---------------------------------------------------------------------------------------------------
  function hashParams() {
    const params = new URLSearchParams(location.hash.slice(1))
    const t = params.get('t') || ''
    const k = params.get('k') || ''
    const c = params.get('c') || ''
    return { t: TICKET.test(t) ? t : null, k: TICKET.test(k) ? k : null, c: CHAT.test(c) ? c : null }
  }
  // Код ссылки — один раз на билет. Не вышло (истёк, уже использован, сайт не ответил) — null
  async function trade(k) {
    try {
      const response = await fetch('/api/me/chats/ticket', { method: 'POST', headers: { Authorization: `Link ${k}` } })
      const data = await response.json().catch(() => ({}))
      return response.ok && typeof data.ticket === 'string' && TICKET.test(data.ticket) ? data.ticket : null
    } catch {
      return null
    }
  }
  function remember(value) {
    try {
      if (value) sessionStorage.setItem(KEY, value)
      else sessionStorage.removeItem(KEY)
    } catch {
      // без хранилища — билет только до перезагрузки
    }
  }
  function remembered() {
    try {
      const value = sessionStorage.getItem(KEY)
      return value && TICKET.test(value) ? value : null
    } catch {
      return null
    }
  }
  const expired = (t) => Number(TICKET.exec(t)[2]) * 1000 <= Date.now()
  // В адресе — только открытый чат: билет из него убирается
  function address() {
    history.replaceState(null, '', `${location.pathname}${location.search}${current ? `#c=${current.id}` : ''}`)
  }

  // --- Сайт ----------------------------------------------------------------------------------------------------
  async function api(method, path, body) {
    const headers = { Authorization: `Chat ${ticket}` }
    if (body) headers['Content-Type'] = 'application/json'
    const response = await fetch(`/api/me/${path}`, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) })
    const data = await response.json().catch(() => ({}))
    if (response.status === 401) {
      lost()
      throw Object.assign(new Error('auth'), { code: 'auth' })
    }
    if (!response.ok) throw Object.assign(new Error(data.error || String(response.status)), { code: data.error || 'http' })
    return data
  }
  // Имена приходят вместе с аватарками: у кого в ответе имя без аватарки — её убрали
  function absorb(data) {
    if (data.me && typeof data.me.id === 'string') me = data.me
    const given = data.pics && typeof data.pics === 'object' ? data.pics : {}
    for (const [id, handle] of Object.entries(data.names || {})) {
      if (typeof handle !== 'string') continue
      names.set(id, handle)
      if (validPic(given[id])) pics.set(id, given[id])
      else pics.delete(id)
    }
    if (Number.isSafeInteger(data.unread)) unread = data.unread
  }
  function problem(error) {
    const code = error && error.code
    if (code === 'often') return T('Слишком часто — подожди минуту.')
    if (code === 'friend') return T('Писать можно только друзьям.')
    if (code === 'gone') return T('Этого чата больше нет.')
    if (code === 'long') return T('Сообщение длиннее 2000 знаков.')
    if (code === 'name') return T('Назови группу.')
    if (code === 'nohandle') return T('Сначала возьми свой @ник в Arcade: /arcade → Друзья.')
    if (code === 'full') return T('В группе может быть не больше 50 человек.')
    if (code === 'owner') return T('Это может только тот, кто управляет группой.')
    if (code === 'off') return T('Чаты на сайте сейчас выключены.')
    return T('Сайт Arcade не ответил — попробуй ещё раз.')
  }
  function say(text) {
    if (parts) parts.notice.textContent = text || ''
  }

  // --- Имена и время -------------------------------------------------------------------------------------------
  const nameOf = (id) => (names.has(id) ? `@${names.get(id)}` : me && id === me.id && me.handle ? `@${me.handle}` : T('удалённый аккаунт'))
  function titleOf(c) {
    if (!c) return ''
    return c.kind === 'group' ? c.name || T('Группа') : nameOf(c.with)
  }
  const fill = (form, values) => form.replace(/\{(\d)\}/g, (_, k) => values[k] ?? '')
  // Служебное сообщение группы: кто создал, добавил, убрал, вышел, переименовал, сменил картинку
  function describe(m) {
    if (m.k === 'create') return fill(T('{0} создал(а) группу «{1}»'), [nameOf(m.f), m.n || ''])
    if (m.k === 'add') return fill(T('{0} добавил(а) {1}'), [nameOf(m.f), nameOf(m.o)])
    if (m.k === 'remove') return fill(T('{0} убрал(а) {1}'), [nameOf(m.f), nameOf(m.o)])
    if (m.k === 'leave') return fill(T('{0} вышел(а) из группы'), [nameOf(m.f)])
    if (m.k === 'name') return fill(T('{0} назвал(а) группу «{1}»'), [nameOf(m.f), m.n || ''])
    if (m.k === 'pic') return fill(m.n !== undefined ? T('{0} сменил(а) картинку группы') : T('{0} убрал(а) картинку группы'), [nameOf(m.f)])
    return ''
  }
  function format(at, options) {
    try {
      return new Intl.DateTimeFormat(lang, options).format(new Date(at))
    } catch {
      return ''
    }
  }
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString()
  const clock = (at) => format(at, { hour: '2-digit', minute: '2-digit' })
  function day(at) {
    const now = Date.now()
    if (sameDay(at, now)) return T('Сегодня')
    if (sameDay(at, now - 86_400_000)) return T('Вчера')
    return format(at, { day: 'numeric', month: 'long', ...(new Date(at).getFullYear() !== new Date(now).getFullYear() ? { year: 'numeric' } : {}) })
  }
  const when = (at) => (!at ? '' : sameDay(at, Date.now()) ? clock(at) : format(at, { day: 'numeric', month: 'short' }))
  // Ссылки http(s) в тексте — ссылками, остальное — как есть
  function rich(text) {
    const out = []
    let last = 0
    for (const m of text.matchAll(/https?:\/\/[^\s<>"']+/g)) {
      const url = m[0].replace(/[.,;:!?)\]]+$/, '')
      if (m.index > last) out.push(text.slice(last, m.index))
      out.push(el('a', { href: url, target: '_blank', rel: 'noopener noreferrer', textContent: url }))
      last = m.index + url.length
    }
    if (last < text.length) out.push(text.slice(last))
    return out
  }

  // --- Отрисовка -----------------------------------------------------------------------------------------------
  function gate(text) {
    parts = null
    root.textContent = ''
    root.append(el('div', { className: 'empty', textContent: text }))
    document.title = `${T('Чаты')} · Arcade`
  }

  function build() {
    root.textContent = ''
    const meName = el('span', { className: 'me' })
    const meAva = ava('', 'small')
    const dot = el('span', { className: 'dot' })
    const list = el('div', { className: 'list' })
    const side = el('aside', { className: 'side' }, [el('div', { className: 'top' }, [meAva, meName, dot, button(T('Новый чат'), () => showNew(), 'main')]), list])
    const talk = el('section', { className: 'talk' })
    const notice = el('div', { className: 'notice' })
    notice.setAttribute('role', 'status')
    const app = el('div', { className: 'app' }, [side, talk])
    root.append(app)
    parts = { app, meName, meAva, dot, list, talk, notice, feed: null, input: null, send: null, left: null }
    renderAll()
  }

  function renderAll() {
    if (!parts) return
    renderSide()
    renderTalk()
  }

  function renderSide() {
    parts.meName.textContent = me && me.handle ? `@${me.handle}` : ''
    paint(parts.meAva, me ? personSvg(me.id) : '')
    parts.dot.classList.toggle('on', live)
    parts.dot.title = live ? T('Новые сообщения приходят сразу') : T('Новые сообщения — раз в 10 секунд')
    parts.list.textContent = ''
    if (!chats.length) parts.list.append(el('div', { className: 'hint', textContent: T('Чатов пока нет. Нажми «Новый чат» и выбери друга.') }))
    for (const c of chats) {
      const last = c.last ? (c.last.k ? describe(c.last) : `${me && c.last.f === me.id ? `${T('Ты')}: ` : c.kind === 'group' ? `${nameOf(c.last.f)}: ` : ''}${c.last.t}`) : ''
      const item = el('button', { type: 'button', className: 'item' }, [
        ava(chatSvg(c), '', c.kind === 'dm' && online.has(c.with)),
        el('span', { className: 'name', textContent: titleOf(c) }),
        el('span', { className: 'when', textContent: when(c.at) }),
        el('span', { className: 'last', textContent: last }),
        el('span', { className: 'badge', textContent: c.unread ? String(c.unread) : '' }),
      ])
      item.classList.toggle('active', Boolean(current && current.id === c.id))
      item.addEventListener('click', () => open(c.id))
      parts.list.append(item)
    }
    document.title = `${unread ? `(${unread}) ` : ''}${T('Чаты')} · Arcade`
  }

  function renderTalk() {
    const talk = parts.talk
    talk.textContent = ''
    parts.feed = parts.input = parts.send = parts.left = parts.head = null
    parts.app.classList.toggle('open', Boolean(current || panel))
    if (panel === 'new') return talk.append(el('div', { className: 'head' }, [back()]), parts.notice, sheetNew())
    if (panel === 'members' && current && current.chat) return talk.append(el('div', { className: 'head' }, [back()]), parts.notice, sheetMembers())
    if (!current) return talk.append(parts.notice, el('div', { className: 'hint', textContent: T('Выбери чат слева или начни новый.') }))
    parts.head = el('div', { className: 'head' })
    talk.append(parts.head, parts.notice)
    renderHead()
    const feed = el('div', { className: 'feed' })
    parts.feed = feed
    talk.append(feed)
    renderFeed(true)
    if (current.gone) return
    const input = el('textarea', { rows: 1, maxLength: MAX_TEXT, placeholder: T('Сообщение'), value: current.draft || '' })
    input.setAttribute('aria-label', T('Сообщение'))
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
        event.preventDefault()
        send()
      }
    })
    input.addEventListener('input', () => {
      current.draft = input.value
      counter()
    })
    const left = el('span', { className: 'left' })
    const sendButton = button(T('Отправить'), () => send(), 'main')
    Object.assign(parts, { input, send: sendButton, left })
    talk.append(el('div', { className: 'compose' }, [input, left, sendButton]), el('div', { className: 'plain', textContent: T('Переписка не шифруется — не пиши сюда пароли и ключи.') }))
    counter()
  }

  const back = () =>
    button(T('← Чаты'), () => {
      current = null
      panel = null
      address()
      renderAll()
    }, 'back')

  // Заголовок переписки: аватарка, имя, под ним — друг в сети; у группы — сколько участников и сколько из них в сети.
  // Перерисовывается отдельно от поля ввода, чтобы «в сети» не сбивал набор
  function renderHead() {
    const head = parts && parts.head
    if (!head) return
    const c = current.chat
    const group = current.id.startsWith('g')
    const around = group && c ? c.members.filter((id) => online.has(id)).length : 0
    const here = Boolean(c && !group && online.has(c.with))
    const sub = group && c ? (around ? fill(T('участники: {0}, в сети: {1}'), [c.members.length, around]) : fill(T('участники: {0}'), [c.members.length])) : here ? T('в сети') : ''
    head.textContent = ''
    head.append(
      ...[
        back(),
        c && ava(chatSvg(c), 'small'),
        el('div', { className: 'title' }, [el('span', { className: 'name', textContent: c ? titleOf(c) : '' }), sub && el('span', { className: here ? 'sub on' : 'sub', textContent: sub })]),
        group && c && button(T('Участники'), () => showMembers()),
      ].filter(Boolean),
    )
  }

  function counter() {
    if (!parts || !parts.input) return
    const rest = MAX_TEXT - parts.input.value.length
    parts.left.textContent = rest <= 200 ? String(rest) : ''
  }

  // Переписка целиком. Внизу и были — остаёмся внизу; подгрузили раньше — место чтения не прыгает
  function renderFeed(bottom) {
    const feed = parts && parts.feed
    if (!feed) return
    const stick = bottom || feed.scrollHeight - feed.scrollTop - feed.clientHeight < 40
    const before = feed.scrollHeight - feed.scrollTop
    feed.textContent = ''
    const list = current.messages
    if (current.gone) feed.append(el('div', { className: 'note', textContent: T('Этого чата больше нет.') }))
    if (list.length && list[0].s > current.first) feed.append(button(T('Раньше'), () => older(), 'more'))
    if (current.chat && !list.length && !current.gone) feed.append(el('div', { className: 'hint', textContent: T('Здесь пока пусто — напиши первым.') }))
    const group = current.id.startsWith('g')
    // Подряд от одного человека в один день: в группе имя — у первого сообщения, аватарка — у последнего
    const run = (a, b) => Boolean(a && b && !a.k && !b.k && a.f === b.f && sameDay(a.at, b.at))
    list.forEach((m, i) => {
      const prev = list[i - 1]
      if (!prev || !sameDay(prev.at, m.at)) feed.append(el('div', { className: 'day', textContent: day(m.at) }))
      if (m.k) return feed.append(el('div', { className: 'note', textContent: describe(m) }))
      const mine = Boolean(me && m.f === me.id)
      // Одна галочка — сообщение на сайте; прочитано ли — сайт не знает
      const tick = mine && el('span', { className: 'tick', textContent: '✓', title: T('Доставлено') })
      const bubble = el('div', { className: mine ? 'msg mine' : 'msg' }, [
        group && !mine && !run(prev, m) && el('div', { className: 'who', textContent: nameOf(m.f) }),
        el('div', { className: 'text' }, rich(m.t)),
        el('span', { className: 'at', textContent: clock(m.at) }, [tick]),
      ])
      if (!group || mine) return feed.append(bubble)
      const face = run(m, list[i + 1]) ? el('span', { className: 'gap' }) : ava(personSvg(m.f), 'small')
      feed.append(el('div', { className: 'line' }, [face, bubble]))
    })
    feed.scrollTop = stick ? feed.scrollHeight : feed.scrollHeight - before
  }

  // Лист «Новый чат»: написать другу, группа из отмеченных друзей или со всеми сразу
  function sheetNew() {
    const sheet = el('div', { className: 'sheet' }, [el('h2', { textContent: T('Новый чат') })])
    if (!friends) {
      sheet.append(el('p', { textContent: T('Загружаю друзей…') }))
      return sheet
    }
    if (!friends.length) {
      sheet.append(el('p', { textContent: T('Друзей пока нет — добавь их в Arcade: /arcade → Друзья.') }), el('div', { className: 'actions' }, [button(T('Закрыть'), close)]))
      return sheet
    }
    const picked = new Set()
    for (const f of friends) {
      const box = el('input', { type: 'checkbox' })
      box.setAttribute('aria-label', fill(T('Позвать в группу: {0}'), [`@${f.handle}`]))
      box.addEventListener('change', () => (box.checked ? picked.add(f.id) : picked.delete(f.id)))
      sheet.append(
        el('div', { className: 'row' }, [box, ava(personSvg(f.id), 'tiny', online.has(f.id)), el('span', { className: 'person', textContent: `@${f.handle}` }), button(T('Написать'), () => startDm(f.id))]),
      )
    }
    const name = el('input', { type: 'text', maxLength: 40, placeholder: T('Название группы') })
    name.setAttribute('aria-label', T('Название группы'))
    sheet.append(
      el('p', { textContent: T('Группа: отметь друзей, назови её и нажми «Создать группу».') }),
      name,
      el('div', { className: 'actions' }, [
        button(T('Создать группу'), () => makeGroup({ name: name.value, members: [...picked] }), 'main'),
        button(T('Группа со всеми друзьями'), () => makeGroup({ name: name.value.trim() || T('Все друзья'), all: true })),
        button(T('Закрыть'), close),
      ]),
    )
    return sheet
  }

  // Лист «Участники»: кто в группе; кто ей управляет — переименовывает, ставит картинку, добавляет и убирает; выйти
  // может любой
  function sheetMembers() {
    const c = current.chat
    const owner = Boolean(me && c.owner === me.id)
    const sheet = el('div', { className: 'sheet' }, [el('h2', { textContent: titleOf(c) })])
    if (owner) {
      const name = el('input', { type: 'text', maxLength: 40, value: c.name || '' })
      name.setAttribute('aria-label', T('Название группы'))
      sheet.append(el('div', { className: 'row' }, [name, button(T('Переименовать'), () => change({ name: name.value }))]))
    }
    if (owner && Avatars) {
      const grid = el('div', { className: 'pics' })
      for (let n = 0; n < Avatars.AVATAR_COUNT; n++) {
        const label = Avatars.avatarName(n, lang)
        const pick = el('button', { type: 'button', className: c.pic === n ? 'pick active' : 'pick', title: label }, [ava(Avatars.avatarSvg(n))])
        pick.setAttribute('aria-label', label)
        pick.setAttribute('aria-pressed', String(c.pic === n))
        pick.addEventListener('click', () => change({ pic: n }))
        grid.append(pick)
      }
      sheet.append(el('h2', { textContent: T('Картинка группы') }), grid)
      if (validPic(c.pic)) sheet.append(el('div', { className: 'actions' }, [button(T('Без картинки'), () => change({ pic: null }))]))
    }
    for (const id of c.members) {
      sheet.append(
        el('div', { className: 'row' }, [
          ava(personSvg(id), 'tiny', online.has(id)),
          el('span', { className: 'person', textContent: nameOf(id) }),
          id === c.owner && el('span', { className: 'mark', textContent: T('управляет группой') }),
          owner && id !== me.id && button(T('Убрать'), () => change({ remove: [id] }), 'warn'),
        ]),
      )
    }
    if (owner) {
      const others = (friends || []).filter((f) => !c.members.includes(f.id))
      if (!friends) sheet.append(el('p', { textContent: T('Загружаю друзей…') }))
      else if (others.length) sheet.append(el('h2', { textContent: T('Добавить друзей') }))
      for (const f of others) {
        sheet.append(
          el('div', { className: 'row' }, [ava(personSvg(f.id), 'tiny', online.has(f.id)), el('span', { className: 'person', textContent: `@${f.handle}` }), button(T('Добавить'), () => change({ add: [f.id] }))]),
        )
      }
    }
    sheet.append(
      el('div', { className: 'actions' }, [
        button(leaving ? T('Точно выйти? Нажми ещё раз') : T('Выйти из группы'), () => leave(), 'warn'),
        button(T('Закрыть'), close),
      ]),
    )
    return sheet
  }

  function close() {
    panel = null
    leaving = false
    say('')
    renderAll()
  }

  // --- Действия ------------------------------------------------------------------------------------------------
  async function refreshList() {
    try {
      const data = await api('GET', 'chats')
      absorb(data)
      chats = Array.isArray(data.chats) ? data.chats.filter((c) => c && CHAT.test(c.id)) : []
      online = new Set(Array.isArray(data.online) ? data.online.filter((id) => typeof id === 'string') : [])
      if (parts) renderSide()
      // «в сети» в заголовке открытого чата
      if (parts && current) renderHead()
    } catch (error) {
      if (error.code !== 'auth') say(problem(error))
    }
  }
  // Список — не чаще раза в полсекунды: сообщения в группах приходят пачками
  function soonList() {
    if (listTimer) return
    listTimer = setTimeout(() => {
      listTimer = null
      refreshList()
    }, 500)
  }

  async function open(id) {
    if (!CHAT.test(id) || !ticket) return
    current = { id, chat: null, messages: [], first: 1, gone: false, draft: '' }
    panel = null
    leaving = false
    address()
    say('')
    renderAll()
    try {
      const data = await api('GET', `chats/messages?chat=${id}`)
      if (!current || current.id !== id) return
      absorb(data)
      Object.assign(current, { chat: data.chat, messages: data.messages || [], first: data.first || 1 })
      const entry = chats.find((c) => c.id === id)
      if (entry) entry.unread = 0
      else soonList()
      renderAll()
      // На телефоне фокус открыл бы клавиатуру поверх переписки
      const narrow = typeof matchMedia === 'function' && matchMedia('(max-width: 720px)').matches
      if (parts.input && typeof parts.input.focus === 'function' && !narrow) parts.input.focus()
    } catch (error) {
      if (!current || current.id !== id || error.code === 'auth') return
      if (error.code === 'gone') return gone(id)
      say(problem(error))
    }
  }

  // Новое в открытом чате — после последнего показанного; чат становится прочитанным
  async function newer() {
    if (!current || !current.chat || current.gone) return
    const id = current.id
    const last = current.messages.length ? current.messages[current.messages.length - 1].s : current.chat.last
    try {
      const data = await api('GET', `chats/messages?chat=${id}&after=${last}`)
      if (!current || current.id !== id) return
      absorb(data)
      current.chat = data.chat
      merge(data.messages || [])
      const entry = chats.find((c) => c.id === id)
      if (entry) entry.unread = 0
      if (panel) renderTalk()
      else renderFeed(false)
      renderSide()
    } catch (error) {
      if (current && current.id === id && error.code === 'gone') gone(id)
    }
  }

  async function older() {
    if (!current || !current.messages.length) return
    const id = current.id
    try {
      const data = await api('GET', `chats/messages?chat=${id}&before=${current.messages[0].s}`)
      if (!current || current.id !== id) return
      absorb(data)
      current.first = data.first || current.first
      merge(data.messages || [])
      renderFeed(false)
    } catch (error) {
      if (error.code !== 'auth') say(problem(error))
    }
  }

  function merge(list) {
    const known = new Set(current.messages.map((m) => m.s))
    current.messages = [...current.messages, ...list.filter((m) => m && Number.isSafeInteger(m.s) && !known.has(m.s))].sort((a, b) => a.s - b.s)
  }

  function gone(id) {
    chats = chats.filter((c) => c.id !== id)
    if (current && current.id === id) {
      current.gone = true
      panel = null
    }
    renderAll()
  }

  async function send() {
    if (!current || !parts.input || sending) return
    const text = parts.input.value.trim()
    if (!text) return
    if (text.length > MAX_TEXT) return say(problem({ code: 'long' }))
    const id = current.id
    sending = true
    parts.send.disabled = true
    try {
      const { msg } = await api('POST', 'chats/send', { chat: id, text })
      if (current && current.id === id) {
        current.draft = ''
        if (parts.input) parts.input.value = ''
        if (msg) merge([msg])
        say('')
        renderFeed(true)
        counter()
      }
      soonList()
    } catch (error) {
      if (error.code === 'gone') gone(id)
      else if (error.code !== 'auth') say(problem(error))
    } finally {
      sending = false
      if (parts && parts.send) parts.send.disabled = false
      if (parts && parts.input && typeof parts.input.focus === 'function') parts.input.focus()
    }
  }

  async function loadFriends() {
    try {
      const data = await api('GET', 'friends')
      friends = (Array.isArray(data.friends) ? data.friends : []).filter((f) => f && typeof f.id === 'string' && typeof f.handle === 'string')
      for (const f of friends) {
        names.set(f.id, f.handle)
        if (validPic(f.pic)) pics.set(f.id, f.pic)
        else pics.delete(f.id)
      }
    } catch (error) {
      if (error.code !== 'auth') say(problem(error))
    }
    if (parts) renderTalk()
  }

  function showNew() {
    panel = 'new'
    leaving = false
    say('')
    renderAll()
    loadFriends()
  }

  function showMembers() {
    panel = 'members'
    leaving = false
    say('')
    renderTalk()
    if (me && current.chat.owner === me.id) loadFriends()
  }

  async function startDm(friend) {
    try {
      const { chat } = await api('POST', 'chats/open', { with: friend })
      if (chat && CHAT.test(chat.id)) {
        soonList()
        await open(chat.id)
      }
    } catch (error) {
      if (error.code !== 'auth') say(problem(error))
    }
  }

  async function makeGroup(body) {
    if (!body.all && !body.members.length) return say(T('Отметь хотя бы одного друга.'))
    if (!String(body.name || '').trim()) return say(problem({ code: 'name' }))
    try {
      const { chat } = await api('POST', 'chats/group', body)
      if (chat && CHAT.test(chat.id)) {
        soonList()
        await open(chat.id)
      }
    } catch (error) {
      if (error.code === 'empty') say(T('Отметь хотя бы одного друга.'))
      else if (error.code !== 'auth') say(problem(error))
    }
  }

  async function change(body) {
    if (!current) return
    const id = current.id
    try {
      const data = await api('POST', 'chats/members', { chat: id, ...body })
      if (!current || current.id !== id) return
      if (data.chat) {
        current.chat = { ...current.chat, ...data.chat }
        // Картинку убрали — в ответе её просто нет
        if (!validPic(data.chat.pic)) delete current.chat.pic
      }
      say('')
      await newer()
      renderTalk()
      soonList()
    } catch (error) {
      if (error.code === 'gone') gone(id)
      else if (error.code !== 'auth') say(problem(error))
    }
  }

  async function leave() {
    if (!current) return
    if (!leaving) {
      leaving = true
      return renderTalk()
    }
    const id = current.id
    try {
      await api('POST', 'chats/members', { chat: id, leave: true })
      chats = chats.filter((c) => c.id !== id)
      current = null
      panel = null
      leaving = false
      address()
      renderAll()
    } catch (error) {
      if (error.code === 'gone') gone(id)
      else if (error.code !== 'auth') say(problem(error))
    }
  }

  function reset() {
    if (socket) {
      const ws = socket
      socket = null
      try {
        ws.close()
      } catch {
        // уже закрыт
      }
    }
    live = false
    me = null
    chats = []
    unread = 0
    names.clear()
    pics.clear()
    online = new Set()
    current = null
    panel = null
    friends = null
  }

  // Билет больше не годен: истёк или на том компьютере вышли из Arcade
  function lost() {
    ticket = null
    remember(null)
    reset()
    gate(T('Вход на этой странице устарел. Открой чаты снова из Arcade: /arcade → Чаты.'))
  }

  // --- Живое соединение ----------------------------------------------------------------------------------------
  function connect() {
    if (socket || !ticket || typeof WebSocket !== 'function') return
    let ws
    try {
      ws = new WebSocket(`${location.protocol === 'http:' ? 'ws' : 'wss'}://${location.host}/net/chat`, ['arcade-chat', ticket])
    } catch {
      return
    }
    socket = ws
    ws.addEventListener('open', () => {
      if (socket !== ws) return
      live = true
      retry = 0
      if (parts) renderSide()
      // Пока соединения не было, могли прийти сообщения
      refreshList()
      if (!document.hidden) newer()
    })
    ws.addEventListener('message', (event) => frame(event.data))
    ws.addEventListener('close', (event) => {
      if (socket !== ws) return
      socket = null
      live = false
      if (parts) renderSide()
      // 4001 — билет не годен; 4000 — открыли ещё одну страницу чата, и эта уступила ей соединение: спрашивает сама
      if (event.code === 4001) return lost()
      if (event.code === 4000) return
      setTimeout(connect, Math.min(30_000, 1000 * 2 ** retry++))
    })
  }

  function frame(data) {
    if (data === 'pong' || typeof data !== 'string') return
    let f
    try {
      f = JSON.parse(data)
    } catch {
      return
    }
    if (!f || !CHAT.test(f.chat)) return
    if (f.type === 'gone') return gone(f.chat)
    if (f.type !== 'note') return
    if (current && current.id === f.chat && !document.hidden) newer()
    soonList()
  }

  // --- Начало --------------------------------------------------------------------------------------------------
  async function load() {
    let { t, k, c } = hashParams()
    if (k) {
      // Код из адреса убираем сразу: второй раз он всё равно не годен
      history.replaceState(null, '', `${location.pathname}${location.search}${c ? `#c=${c}` : ''}`)
      t = expired(k) ? null : await trade(k)
      if (!t && !ticket && !remembered()) return gate(T('Вход на этой странице устарел. Открой чаты снова из Arcade: /arcade → Чаты.'))
    }
    const fresh = t && !expired(t) && t !== ticket
    if (fresh) {
      // Билет другого человека (на том же компьютере вошли под другим аккаунтом) — чужое со страницы убираем
      if (ticket && TICKET.exec(ticket)[1] !== TICKET.exec(t)[1]) reset()
      ticket = t
      remember(t)
    }
    if (!ticket) {
      const saved = remembered()
      if (saved && !expired(saved)) ticket = saved
    }
    if (!ticket) {
      history.replaceState(null, '', `${location.pathname}${location.search}`)
      return gate(T('Чаты открываются из Arcade: /arcade → Чаты — мод откроет эту страницу уже со входом.'))
    }
    if (!parts || fresh) {
      build()
      refreshList()
      connect()
    }
    if (c && (!current || current.id !== c)) open(c)
    else address()
  }

  window.addEventListener('hashchange', () => load())
  if (typeof document.addEventListener === 'function') {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && ticket) newer()
    })
  }
  if (typeof setInterval === 'function') {
    // Без живого соединения — спрашиваем сами; с ним — изредка сверяем список
    let ticks = 0
    setInterval(() => {
      if (!ticket) return
      ticks += 1
      if (!live) {
        refreshList()
        if (!document.hidden) newer()
      } else if ((ticks * POLL_MS) % LIST_MS === 0) refreshList()
      else if (socket && ticks % (PING_MS / POLL_MS) === 0) {
        try {
          socket.send('ping')
        } catch {
          // соединение закрывается — переподключимся
        }
      }
    }, POLL_MS)
  }
  document.documentElement.lang = lang
  load()
})()
