// Статья из подборки мода: read#u=<адрес статьи>. Встроенный браузер Desktop мод открывает только на страницах
// сайта Arcade, поэтому сюда, а отсюда — на саму статью. Переход только на сайты из лент Arcade (feeds.json): чужую
// ссылку в адресе страница не откроет.
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
  function target() {
    try {
      const url = new URL(new URLSearchParams(location.hash.slice(1)).get('u') || '')
      return url.protocol === 'https:' && !url.username && !url.password ? url : null
    } catch {
      return null
    }
  }

  async function load() {
    const url = target()
    if (!url) return say(T('В адресе нет статьи. Подборку делает мод Arcade: /arcade → Статьи.'))
    let hosts = null
    try {
      const response = await fetch('feeds.json')
      if (response.ok) hosts = new Set((await response.json()).articles.flatMap((f) => f.hosts))
    } catch {
      // ниже — понятная подсказка
    }
    if (!hosts) return say(T('Не получилось проверить ссылку — сайт Arcade не ответил. Попробуй ещё раз.'))
    if (!hosts.has(url.hostname)) return say(T('Эта ссылка не из лент Arcade — не открываю её.'))
    say(T('Открываю статью…'), el('a', { href: url.href, textContent: url.hostname }))
    location.replace(url.href)
  }

  window.addEventListener('hashchange', load)
  document.documentElement.lang = lang
  document.title = `Arcade · ${T('Статьи')}`
  load()
})()
