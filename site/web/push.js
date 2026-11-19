// Уведомления Arcade на телефоне: /push. Код из Arcade в Claude Code (настройки Arcade → Уведомления на телефон)
// связывает браузер телефона с аккаунтом: страница подписывает браузер на Web Push и отдаёт подписку сайту вместе с
// кодом. Входить в GitHub на телефоне не нужно. Сайт присылает только «сессия такая-то ждёт тебя» — без текста вопроса
// и кода; ответить с телефона нельзя. Ключ телефона хранится в localStorage этого браузера: с ним можно только узнать,
// подключён ли телефон, и выключить его — читать или писать что-то в аккаунте он не даёт.
// iPhone и iPad: уведомления сайтов — только у веб-приложения на экране «Домой» (iOS 16.4 и новее), поэтому страницу
// сначала добавляют на экран «Домой» и вводят код уже там. Разрешение на уведомления спрашиваем по нажатию кнопки.
;(function () {
  'use strict'

  const t = window.ArcadeI18n ? window.ArcadeI18n.t : (s) => s
  const KEY = 'arcade:phone'
  const PHONE_KEY = /^\d{1,20}\.[A-Za-z0-9_-]{43}$/
  const CODE = /^[A-HJ-NP-Z2-9]{8}$/
  const SCOPE = '/push'
  const TEST = 'Телефон подключён — уведомления Arcade будут приходить сюда.'
  const root = document.getElementById('push')
  const nav = window.navigator || {}

  let phoneKey = load()
  let busy = false
  let draft = ''
  let note = null // { text, bad } — строка под кнопкой: что случилось

  function el(tag, props, children) {
    const node = Object.assign(document.createElement(tag), props || {})
    for (const child of children || []) if (child) node.append(child)
    return node
  }
  const button = (text, onClick, className) => {
    const b = el('button', { type: 'button', className: className ? `btn ${className}` : 'btn', textContent: text, disabled: busy })
    b.addEventListener('click', onClick)
    return b
  }

  // --- Ключ телефона ---------------------------------------------------------------------------------------------
  function load() {
    try {
      const key = localStorage.getItem(KEY)
      return PHONE_KEY.test(key || '') ? key : null
    } catch {
      return null
    }
  }
  function save(key) {
    phoneKey = key
    try {
      if (key) localStorage.setItem(KEY, key)
      else localStorage.removeItem(KEY)
    } catch {
      // без хранилища ключ живёт до закрытия страницы
    }
  }

  // --- Что умеет браузер -----------------------------------------------------------------------------------------
  const supported = () => Boolean(nav.serviceWorker) && typeof window.PushManager === 'function' && typeof window.Notification === 'function'
  // iPadOS называет себя Mac — выдают его касания
  const apple = () => /iPhone|iPad|iPod/.test(nav.userAgent || '') || (nav.platform === 'MacIntel' && nav.maxTouchPoints > 1)
  const standalone = () => nav.standalone === true || (typeof window.matchMedia === 'function' && window.matchMedia('(display-mode: standalone)').matches)
  const denied = () => typeof window.Notification === 'function' && window.Notification.permission === 'denied'

  function bytes(text) {
    const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4))
    return Uint8Array.from(raw, (c) => c.charCodeAt(0))
  }
  function sameKey(buffer, want) {
    if (!buffer) return false
    const have = new Uint8Array(buffer)
    return have.length === want.length && have.every((b, i) => b === want[i])
  }

  // Подписка этого браузера, если есть
  async function current() {
    const reg = await nav.serviceWorker.getRegistration(SCOPE)
    return reg ? reg.pushManager.getSubscription() : null
  }
  async function forgetSubscription() {
    try {
      const sub = await current()
      if (sub) await sub.unsubscribe()
    } catch {
      // подписки нет — и не надо
    }
  }

  async function ask(path, init) {
    const answer = await fetch(path, { method: 'POST', ...init, headers: { 'Content-Type': 'application/json', ...((init && init.headers) || {}) } })
    let body = {}
    try {
      body = await answer.json()
    } catch {
      // не JSON — только код ответа
    }
    return { status: answer.status, body }
  }
  const phoneHeaders = () => ({ Authorization: `Phone ${phoneKey}` })

  // --- Подключить и выключить ------------------------------------------------------------------------------------
  async function connect() {
    if (busy) return
    const code = draft.toUpperCase().replace(/[\s-]/g, '')
    if (!CODE.test(code)) return show({ text: t('Код — 8 знаков, например K7QM-2XPA.'), bad: true })
    busy = true
    note = { text: t('Подключаем…') }
    render()
    try {
      // Разрешение — первым делом, пока нажатие ещё свежее: Safari спрашивает только в ответ на нажатие
      const allowed = await window.Notification.requestPermission()
      // Запретили — форма сама скажет, что уведомления запрещены; просто закрыли вопрос — своя строка
      if (allowed !== 'granted') return show(denied() ? null : { text: t('Без разрешения на уведомления подключить телефон нельзя.'), bad: true })
      await nav.serviceWorker.register('/sw.js', { scope: SCOPE })
      const reg = await nav.serviceWorker.ready
      const keyAnswer = await fetch('/api/push/key')
      const appKey = keyAnswer.ok ? bytes(String((await keyAnswer.json()).key || '')) : null
      if (!appKey || appKey.length !== 65) return show({ text: t('Сайт Arcade не ответил — попробуй ещё раз.'), bad: true })
      // Подписка с прежним ключом сайта не годится — сайт не сможет ей писать
      let sub = await reg.pushManager.getSubscription()
      if (sub && !sameKey(sub.options && sub.options.applicationServerKey, appKey)) {
        await sub.unsubscribe()
        sub = null
      }
      sub = sub || (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: appKey }))
      const { status, body } = await ask('/api/push/pair', { body: JSON.stringify({ code, subscription: sub.toJSON(), test: t(TEST) }) })
      if (status === 200 && PHONE_KEY.test(body.key || '')) {
        save(body.key)
        draft = ''
        return show(body.sent ? { text: t(TEST) } : { text: t('Телефон подключён, но пробное уведомление не дошло. Проверь, что уведомления для этого сайта разрешены.'), bad: true })
      }
      if (status === 404) return show({ text: t('Код не подошёл или истёк — возьми новый в Arcade.'), bad: true })
      // Код проверили до отправки — значит, сайт не принял подписку: служба доставки не из известных
      if (status === 400) return show({ text: t('Этот браузер шлёт уведомления через службу, которую Arcade не знает. Открой страницу в Chrome, Safari, Firefox или Edge.'), bad: true })
      if (status === 429) return show({ text: t('Слишком много попыток — попробуй завтра.'), bad: true })
      return show({ text: t('Сайт Arcade не ответил — попробуй ещё раз.'), bad: true })
    } catch {
      return show({ text: t('Сайт Arcade не ответил — попробуй ещё раз.'), bad: true })
    } finally {
      busy = false
      render()
    }
  }

  async function turnOff() {
    if (busy || !phoneKey) return
    busy = true
    render()
    try {
      const { status } = await ask('/api/push/off', { headers: phoneHeaders() })
      // 401 — сайт этот телефон уже не знает: выключен и так
      if (status !== 200 && status !== 401) return show({ text: t('Сайт Arcade не ответил — попробуй ещё раз.'), bad: true })
      save(null)
      await forgetSubscription()
      return show({ text: t('Уведомления на этом телефоне выключены.') })
    } catch {
      return show({ text: t('Сайт Arcade не ответил — попробуй ещё раз.'), bad: true })
    } finally {
      busy = false
      render()
    }
  }

  // При открытии: знает ли сайт этот телефон и жива ли подписка браузера
  async function check() {
    if (!phoneKey || !supported()) return
    try {
      const sub = await current()
      if (!sub) {
        // Браузер подписку потерял (почистили данные сайта) — сайту она тоже ни к чему
        await ask('/api/push/off', { headers: phoneHeaders() }).catch(() => null)
        save(null)
        return show({ text: t('Этот телефон отключён — подключи его заново по новому коду.'), bad: true })
      }
      const { status } = await ask('/api/push/status', { headers: phoneHeaders() })
      if (status === 401) {
        save(null)
        await forgetSubscription()
        return show({ text: t('Этот телефон отключён — подключи его заново по новому коду.'), bad: true })
      }
    } catch {
      // сайт не ответил — показываем, что знаем
    }
  }

  function show(next) {
    note = next
    render()
  }

  // --- Страница ------------------------------------------------------------------------------------------------
  function render() {
    document.title = `${t('Уведомления на телефон')} · Arcade`
    root.textContent = ''
    const parts = [
      el('div', { className: 'brand' }, [el('img', { src: 'arcade-logo.svg', alt: '', width: 40, height: 40 }), el('h1', { textContent: t('Уведомления на телефон') })]),
      el('p', { textContent: t('Когда сессия Claude Code ждёт твоего ответа больше 2 минут, Arcade пришлёт сюда уведомление.') }),
    ]
    if (!supported()) parts.push(...unsupported())
    else if (phoneKey) parts.push(...paired())
    else parts.push(...form())
    if (note) parts.push(el('p', { className: note.bad ? 'note bad' : 'note', textContent: note.text }))
    parts.push(
      el('p', { className: 'small', textContent: t('В уведомлении только имя сессии — без текста вопроса и кода. Не чаще раза в 5 минут. Ответить с телефона нельзя.') }),
      el('p', { className: 'small' }, [el('a', { href: 'privacy', textContent: t('Конфиденциальность') })]),
    )
    root.append(el('main', { className: 'card' }, parts))
  }

  function unsupported() {
    if (apple() && !standalone()) {
      return [
        el('p', { textContent: t('На iPhone и iPad уведомления приходят только приложению с экрана «Домой»:') }),
        el('ol', {}, [
          el('li', { textContent: t('Нажми «Поделиться» в Safari.') }),
          el('li', { textContent: t('Выбери «На экран „Домой“».') }),
          el('li', { textContent: t('Открой Arcade с экрана «Домой» и введи код там.') }),
        ]),
        el('p', { className: 'small', textContent: t('Нужен iOS 16.4 или новее.') }),
      ]
    }
    if (apple()) return [el('p', { className: 'note bad', textContent: t('Уведомления сайтов на iPhone и iPad — с iOS 16.4. Обнови систему и снова открой Arcade с экрана «Домой».') })]
    return [el('p', { className: 'note bad', textContent: t('Этот браузер не показывает уведомления сайтов. На Android открой страницу в Chrome.') })]
  }

  function form() {
    const input = el('input', {
      type: 'text',
      id: 'code',
      value: draft,
      placeholder: 'XXXX-XXXX',
      maxLength: 12,
      autocomplete: 'one-time-code',
      autocapitalize: 'characters',
      spellcheck: false,
      disabled: busy,
    })
    input.addEventListener('input', (event) => {
      draft = String(event.target.value || '')
    })
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') connect()
    })
    return [
      ...(denied() ? [el('p', { className: 'note bad', textContent: t('Уведомления для этого сайта запрещены в настройках браузера — разреши их, иначе ничего не придёт.') })] : []),
      el('label', { htmlFor: 'code', textContent: t('Код подключения') }),
      el('div', { className: 'row' }, [input, button(t('Подключить'), connect, 'main')]),
      el('p', { className: 'small', textContent: t('Код выдаёт Arcade в Claude Code: настройки Arcade → Уведомления на телефон. Код живёт 10 минут.') }),
    ]
  }

  function paired() {
    return [
      el('p', { className: 'on', textContent: t('Уведомления приходят на этот телефон.') }),
      ...(denied() ? [el('p', { className: 'note bad', textContent: t('Уведомления для этого сайта запрещены в настройках браузера — разреши их, иначе ничего не придёт.') })] : []),
      el('div', { className: 'row' }, [button(t('Выключить на этом телефоне'), turnOff, 'warn')]),
    ]
  }

  render()
  check()
})()
