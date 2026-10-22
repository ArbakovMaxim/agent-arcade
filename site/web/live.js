// Каналы Twitch из мода: live#c=<логин>,<логин>…&i=<номер>. Плеер — с player.twitch.tv: Twitch пускает его только
// на сайт, названный в parent, — это адрес самой страницы. Рядом — все каналы: кто в эфире, что идёт, сколько
// зрителей. Эфиры — с нашего /api/twitch, раз в две минуты; сайт не ответил — список без них, плеер всё равно играет.
;(function () {
  'use strict'

  const LOGIN = /^[a-z0-9][a-z0-9_]{1,24}$/
  const MAX = 20
  const EVERY_MS = 2 * 60_000
  const lang = window.ArcadeI18n ? window.ArcadeI18n.lang : 'ru'
  const root = document.getElementById('live')
  const info = new Map() // логин → { name, avatar, live } или { none: true } из /api/twitch
  let logins = []
  let current = 0
  let parts = null

  // Каналы из адреса: только настоящие логины Twitch, без повторов
  function parse() {
    const params = new URLSearchParams(location.hash.slice(1))
    const list = (params.get('c') || '').toLowerCase().split(',').filter((l, k, all) => LOGIN.test(l) && all.indexOf(l) === k).slice(0, MAX)
    const i = Number.parseInt(params.get('i') || '0', 10)
    return { list, index: i >= 0 && i < list.length ? i : 0 }
  }

  function el(tag, props, children) {
    const node = Object.assign(document.createElement(tag), props || {})
    for (const child of children || []) node.append(child)
    return node
  }

  const channel = (login) => `https://www.twitch.tv/${login}`
  function embed(login) {
    const params = new URLSearchParams({ channel: login, parent: location.hostname, autoplay: 'true' })
    return `https://player.twitch.tv/?${params}`
  }
  function count(n) {
    try {
      return new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(n)
    } catch {
      return String(n)
    }
  }

  function render() {
    root.textContent = ''
    parts = null
    if (!logins.length) {
      root.append(el('div', { className: 'empty', textContent: T('В адресе нет каналов. Каналы выбирает мод Arcade: /arcade → Twitch.') }))
      return
    }
    const frame = el('iframe', { title: 'Twitch', allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen', allowFullscreen: true })
    const title = el('span', { className: 'title' })
    const link = el('a', { target: '_blank', rel: 'noopener', textContent: T('Открыть на Twitch') })
    const items = logins.map((login, k) => {
      const item = el('button', { type: 'button', className: 'item' }, [
        el('span', { className: 'avatar', textContent: login[0] }),
        el('span', { className: 'text' }, [el('span', { className: 'name', textContent: login }), el('span', { className: 'status' })]),
      ])
      item.addEventListener('click', () => select(k))
      return item
    })
    root.append(el('div', {}, [el('div', { className: 'player' }, [frame]), el('div', { className: 'under' }, [title, link])]), el('div', { className: 'list' }, items))
    parts = { frame, title, link, items }
    select(current)
    refresh()
  }

  function select(k) {
    if (!parts || k < 0 || k >= logins.length) return
    current = k
    const login = logins[k]
    parts.frame.src = embed(login)
    parts.link.href = channel(login)
    parts.items.forEach((item, n) => {
      item.classList.toggle('active', n === k)
      if (n === k) item.setAttribute('aria-current', 'true')
      else item.removeAttribute('aria-current')
    })
    history.replaceState(null, '', `${location.pathname}${location.search}#c=${logins.join(',')}&i=${k}`)
    caption()
  }

  // Строка под именем канала: в эфире ли, что идёт, сколько зрителей
  function status(known) {
    if (!known) return ''
    if (known.none) return T('Такого канала нет на Twitch')
    if (!known.live) return T('Не в эфире')
    return [T('В эфире'), known.live.game, T(`зрители: ${count(known.live.viewers)}`)].filter(Boolean).join(' · ')
  }

  function caption() {
    if (!parts) return
    logins.forEach((login, n) => {
      const known = info.get(login)
      const item = parts.items[n]
      const avatar = item.querySelector('.avatar')
      if (known && known.avatar && (!avatar.children[0] || avatar.children[0].src !== known.avatar)) {
        avatar.textContent = ''
        avatar.append(el('img', { src: known.avatar, alt: '', loading: 'lazy' }))
      }
      item.querySelector('.name').textContent = (known && known.name) || login
      item.querySelector('.status').textContent = status(known)
      item.classList.toggle('on', Boolean(known && known.live))
      item.title = known && known.live && known.live.title ? known.live.title : ''
    })
    const known = info.get(logins[current])
    const name = (known && known.name) || logins[current]
    parts.title.textContent = known && known.live && known.live.title ? known.live.title : name
    document.title = `${name} · Arcade`
  }

  // Кто в эфире — у нашего сайта; он сам спрашивает Twitch и держит ответы в кеше
  async function refresh() {
    if (!logins.length) return
    const asked = logins.join(',')
    try {
      const response = await fetch(`/api/twitch?logins=${asked}`)
      if (!response.ok) return
      const data = await response.json()
      if (asked !== logins.join(',')) return
      for (const c of Array.isArray(data.channels) ? data.channels : []) {
        if (!c || !LOGIN.test(c.login)) continue
        info.set(c.login, { name: typeof c.name === 'string' ? c.name.slice(0, 40) : c.login, avatar: typeof c.avatar === 'string' && /^https:\/\/static-cdn\.jtvnw\.net\//.test(c.avatar) ? c.avatar : '', live: c.live && typeof c.live === 'object' ? c.live : null })
      }
      for (const login of Array.isArray(data.missing) ? data.missing : []) if (LOGIN.test(login)) info.set(login, { none: true })
      caption()
    } catch {
      // без эфиров — плеер и список всё равно работают
    }
  }

  // Мод открывает другие каналы в той же вкладке — меняется только часть адреса после #
  function load() {
    const { list, index } = parse()
    if (list.join(',') === logins.join(',') && parts) {
      if (index !== current) select(index)
      return
    }
    logins = list
    current = index
    render()
  }
  window.addEventListener('hashchange', load)
  if (typeof setInterval === 'function') setInterval(() => document.hidden || refresh(), EVERY_MS)
  document.documentElement.lang = lang
  load()
})()
