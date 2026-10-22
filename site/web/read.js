// Статья из подборки мода: read#u=<адрес статьи>&s=<подпись>. Встроенный браузер Desktop мод открывает только на
// страницах сайта Arcade, поэтому сюда, а отсюда — на саму статью. Переход — на сайты из лент Arcade (feeds.json) или
// по ссылке из поиска по своей теме: её подпись проверяет сайт (/api/verify). Чужую ссылку страница не откроет.
;(function () {
  'use strict'

  const lang = window.ArcadeI18n ? window.ArcadeI18n.lang : 'ru'
  const root = document.getElementById('read')

  function el(tag, props, children) {
    const node = Object.assign(document.createElement(tag), props || {})
    for (const child of children || []) node.append(child)
    return node
  }
  const say = (text, link) => {
    root.textContent = ''
    root.append(el('div', { className: 'empty' }, link ? [text, ' ', link] : [text]))
  }

  // Только https и без логина в адресе
  function target(params) {
    try {
      const url = new URL(params.get('u') || '')
      return url.protocol === 'https:' && !url.username && !url.password ? url : null
    } catch {
      return null
    }
  }

  // Сайт из лент Arcade: true, false или null, если сайт Arcade не ответил
  async function fromFeeds(url) {
    try {
      const response = await fetch('feeds.json')
      if (response.ok) return (await response.json()).articles.some((f) => f.hosts.includes(url.hostname))
    } catch {
      // ответ — null
    }
    return null
  }
  // Ссылка из поиска по своей теме: подпись сверяет сайт Arcade. true, false или null, если он не ответил
  async function fromSearch(url, sig) {
    try {
      const response = await fetch(`api/verify?kind=read&u=${encodeURIComponent(url.href)}&s=${encodeURIComponent(sig)}`)
      if (response.ok) return (await response.json()).ok === true
    } catch {
      // ответ — null
    }
    return null
  }

  async function load() {
    const params = new URLSearchParams(location.hash.slice(1))
    const url = target(params)
    if (!url) return say(T('В адресе нет статьи. Подборку делает мод Arcade: /arcade → Статьи.'))
    const sig = params.get('s')
    let ok = await fromFeeds(url)
    if (!ok && sig) ok = await fromSearch(url, sig)
    if (ok === null) return say(T('Не получилось проверить ссылку — сайт Arcade не ответил. Попробуй ещё раз.'))
    if (!ok) return say(T('Эта ссылка не из лент Arcade — не открываю её.'))
    say(T('Открываю статью…'), el('a', { href: url.href, textContent: url.hostname }))
    location.replace(url.href)
  }

  window.addEventListener('hashchange', load)
  document.documentElement.lang = lang
  document.title = `Arcade · ${T('Статьи')}`
  load()
})()
