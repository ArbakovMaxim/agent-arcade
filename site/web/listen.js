// Выпуск подкаста из подборки мода: listen#f=<подкаст>&u=<звук>&t=<название>&l=<страница выпуска>&d=<секунды>.
// Подкаст должен быть в лентах Arcade (feeds.json): имя шоу — оттуда, страница выпуска — только с его сайтов. Подкаст
// из поиска по своей теме — f=it<номер в Apple Podcasts>&n=<название>&s=<подпись>: подпись проверяет сайт
// (/api/verify), ссылка — на страницу подкаста в Apple Podcasts. Звук идёт прямо с сервера подкаста; место
// прослушивания запоминает проигрыватель аудиокниг.
;(function () {
  'use strict'

  const lang = window.ArcadeI18n ? window.ArcadeI18n.lang : 'ru'
  const root = document.getElementById('listen')

  function el(tag, props, children) {
    const node = Object.assign(document.createElement(tag), props || {})
    for (const child of children || []) node.append(child)
    return node
  }
  const say = (text) => {
    root.textContent = ''
    root.append(el('div', { className: 'empty', textContent: text }))
  }
  // Только https и без логина в адресе
  function https(text) {
    try {
      const url = new URL(text || '')
      return url.protocol === 'https:' && !url.username && !url.password ? url : null
    } catch {
      return null
    }
  }
  // Короткий ключ выпуска для места прослушивания
  const hash = (text) => {
    let h = 0x811c9dc5
    for (let k = 0; k < text.length; k++) h = Math.imul(h ^ text.charCodeAt(k), 0x01000193) >>> 0
    return h.toString(36)
  }

  // Подкаст: { name, hosts } из лент или { name, page } из поиска; false — не из Arcade. Сайт Arcade не ответил — ошибка
  async function findShow(params) {
    const id = params.get('f')
    const sig = params.get('s')
    if (/^it\d{1,12}$/.test(id) && sig) {
      const name = (params.get('n') || '').trim()
      const response = await fetch(`api/verify?kind=listen&f=${id}&n=${encodeURIComponent(name)}&s=${encodeURIComponent(sig)}`)
      if (!response.ok) throw new Error(String(response.status))
      return (await response.json()).ok === true && Boolean(name) && { name, page: `https://podcasts.apple.com/podcast/id${id.slice(2)}` }
    }
    const response = await fetch('feeds.json')
    if (!response.ok) throw new Error(String(response.status))
    return (await response.json()).podcasts.find((p) => p.id === id) || false
  }

  async function load() {
    const params = new URLSearchParams(location.hash.slice(1))
    const audio = https(params.get('u'))
    if (!audio || !params.get('f')) return say(T('В адресе нет выпуска. Подборку делает мод Arcade: /arcade → Подкасты.'))
    let show = null
    try {
      show = await findShow(params)
    } catch {
      // ниже — понятная подсказка
    }
    if (show === null) return say(T('Не получилось проверить подкаст — сайт Arcade не ответил. Попробуй ещё раз.'))
    if (!show) return say(T('Этого подкаста нет в лентах Arcade — не включаю выпуск.'))
    const title = (params.get('t') || '').trim().slice(0, 200) || show.name
    const seconds = Number.parseInt(params.get('d') || '', 10)
    document.title = `${title} · Arcade`
    root.textContent = ''
    window.ArcadeAudio.open(root, {
      id: `podcast-${hash(audio.href)}`,
      title,
      author: show.name,
      reader: '',
      chapters: [{ title, src: audio.href, seconds: seconds > 0 ? seconds : 0 }],
      episode: true,
    })
    const link = (href, text) => root.append(el('a', { className: 'page', href, target: '_blank', rel: 'noopener', textContent: text }))
    const page = https(params.get('l'))
    if (show.page) link(show.page, T('Страница подкаста'))
    else if (page && show.hosts.includes(page.hostname)) link(page.href, T('Страница выпуска'))
  }

  // Мод включает другой выпуск в той же вкладке — меняется часть адреса после #: страница начинает заново, старый
  // выпуск успевает запомнить место
  window.addEventListener('hashchange', () => location.reload())
  document.documentElement.lang = lang
  document.title = `Arcade · ${T('Подкасты')}`
  load()
})()
