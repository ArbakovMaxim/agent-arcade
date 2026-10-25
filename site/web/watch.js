// Просмотр подборки YouTube из мода: watch#v=<id>,<id>…&i=<номер>. Плеер — с youtube-nocookie.com, рядом — вся
// подборка. Названия — из oEmbed YouTube; не ответил — в списке только миниатюры. Не каждое видео разрешено смотреть
// на других сайтах: тогда подсказка, а ссылка «Открыть на YouTube» есть всегда.
;(function () {
  'use strict'

  const ID = /^[\w-]{11}$/
  const MAX = 12
  const PLAYER = 'https://www.youtube-nocookie.com'
  const lang = window.ArcadeI18n ? window.ArcadeI18n.lang : 'ru'
  const root = document.getElementById('watch')
  const info = new Map() // id → { title, channel } из oEmbed
  let ids = []
  let current = 0
  let parts = null

  // Подборка из адреса: только настоящие id видео, без повторов
  function parse() {
    const params = new URLSearchParams(location.hash.slice(1))
    const list = (params.get('v') || '').split(',').filter((id, k, all) => ID.test(id) && all.indexOf(id) === k).slice(0, MAX)
    const i = Number.parseInt(params.get('i') || '0', 10)
    return { list, index: i >= 0 && i < list.length ? i : 0 }
  }

  function el(tag, props, children) {
    const node = Object.assign(document.createElement(tag), props || {})
    for (const child of children || []) node.append(child)
    return node
  }

  const youtube = (id) => `https://www.youtube.com/watch?v=${id}`
  const thumb = (id) => `https://i.ytimg.com/vi/${id}/mqdefault.jpg`
  function embed(id) {
    const params = new URLSearchParams({ autoplay: '1', rel: '0', enablejsapi: '1', hl: lang, origin: location.origin })
    return `${PLAYER}/embed/${id}?${params}`
  }

  function render() {
    root.textContent = ''
    parts = null
    if (!ids.length) {
      root.append(el('div', { className: 'empty', textContent: T('В адресе нет видео. Подборку делает мод Arcade: /arcade → YouTube.') }))
      return
    }
    const frame = el('iframe', {
      title: 'YouTube',
      allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
      allowFullscreen: true,
      referrerPolicy: 'strict-origin-when-cross-origin',
    })
    // Подписка на события плеера — тот же обмен сообщениями, что у IFrame API YouTube, без его скрипта
    frame.addEventListener('load', () => {
      const send = (message) => frame.contentWindow && frame.contentWindow.postMessage(JSON.stringify({ ...message, id: 1, channel: 'widget' }), PLAYER)
      send({ event: 'listening' })
      for (const name of ['onError', 'onStateChange']) send({ event: 'command', func: 'addEventListener', args: [name] })
    })
    const title = el('span', { className: 'title' })
    const link = el('a', { target: '_blank', rel: 'noopener', textContent: T('Открыть на YouTube') })
    const note = el('div', { id: 'note', hidden: true })
    note.setAttribute('role', 'status')
    const items = ids.map((id, k) => {
      const item = el('button', { type: 'button', className: 'item' }, [
        el('img', { src: thumb(id), alt: '', loading: 'lazy' }),
        el('span', { className: 'text' }, [el('span', { className: 'name' }), el('span', { className: 'channel' })]),
      ])
      item.addEventListener('click', () => select(k))
      return item
    })
    root.append(
      el('div', {}, [el('div', { className: 'player' }, [frame]), el('div', { className: 'under' }, [title, link]), note]),
      el('div', { className: 'list' }, items),
    )
    parts = { frame, title, link, note, items }
    select(current)
    for (const id of ids) describe(id)
  }

  function select(k) {
    if (!parts || k < 0 || k >= ids.length) return
    current = k
    const id = ids[k]
    parts.frame.src = embed(id)
    parts.link.href = youtube(id)
    parts.note.hidden = true
    parts.items.forEach((item, n) => {
      item.classList.toggle('active', n === k)
      if (n === k) item.setAttribute('aria-current', 'true')
      else item.removeAttribute('aria-current')
    })
    history.replaceState(null, '', `${location.pathname}${location.search}#v=${ids.join(',')}&i=${k}`)
    caption()
  }

  // Названия и каналы в списке и под плеером
  function caption() {
    if (!parts) return
    ids.forEach((id, n) => {
      const known = info.get(id)
      const text = parts.items[n].querySelector('.text')
      text.children[0].textContent = known ? known.title : ''
      text.children[1].textContent = known ? known.channel : ''
      parts.items[n].title = known ? known.title : ''
    })
    const known = info.get(ids[current])
    parts.title.textContent = known ? known.title : ''
    document.title = known ? `${known.title} · Arcade` : 'Arcade · YouTube'
  }

  async function describe(id) {
    if (info.has(id)) return
    try {
      const response = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(youtube(id))}`)
      if (!response.ok) return
      const data = await response.json()
      if (typeof data.title !== 'string') return
      info.set(id, { title: data.title.slice(0, 200), channel: typeof data.author_name === 'string' ? data.author_name.slice(0, 80) : '' })
      caption()
    } catch {
      // без названий — миниатюры всё равно видны
    }
  }

  // Ошибки плеера: 100 — видео нет, 101 и 150 — автор запретил встраивание, 153 — плеер не получил адрес страницы
  function failed(code) {
    if (!parts) return
    parts.note.textContent =
      code === 100
        ? T('Видео удалено или скрыто.')
        : code === 101 || code === 150
          ? T('Автор не разрешил смотреть это видео на других сайтах — открой его на YouTube.')
          : T('Видео здесь не играет — открой его на YouTube.')
    parts.note.hidden = false
  }

  window.addEventListener('message', (event) => {
    if (event.origin !== PLAYER || !parts || event.source !== parts.frame.contentWindow) return
    let data = event.data
    try {
      if (typeof data === 'string') data = JSON.parse(data)
    } catch {
      return
    }
    if (!data || typeof data !== 'object') return
    if (data.event === 'onError') failed(Number(data.info))
    // Видео кончилось — следующее из подборки
    if (data.event === 'onStateChange' && data.info === 0 && current + 1 < ids.length) select(current + 1)
  })

  // Мод открывает новую подборку в той же вкладке — меняется только часть адреса после #
  function load() {
    const { list, index } = parse()
    if (list.join(',') === ids.join(',') && parts) {
      if (index !== current) select(index)
      return
    }
    ids = list
    current = index
    render()
  }
  window.addEventListener('hashchange', load)
  document.documentElement.lang = lang
  // Под подборкой — условия Arcade, политика конфиденциальности и условия YouTube: ссылок на них требуют правила
  // YouTube API Services. Открываются в новой вкладке, чтобы не сбить видео
  const legal = (href, text) => el('a', { href, target: '_blank', rel: 'noopener', textContent: text })
  root.after(
    el('footer', { className: 'legal' }, [
      legal('terms', T('Условия использования')), ' · ', legal('privacy', T('Конфиденциальность')), ' · ',
      legal('https://www.youtube.com/t/terms', 'YouTube Terms of Service'),
    ]),
  )
  load()
})()
