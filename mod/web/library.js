// Библиотека в окне браузера: вкладки приставок и карточки игр со статистикой.
// Показывается, когда в адресе нет ?game=…; карточка ведёт в игру, игра — обратно сюда.
;(function () {
  'use strict'
  if (new URLSearchParams(location.search).get('game')) return

  const consoles = window.ARCADE_CONSOLES || []
  const games = window.ARCADE_GAMES || {}
  const root = document.getElementById('library')
  document.body.classList.add('library-mode')
  document.title = 'Arcade'

  let tab = localStorage.getItem('arcade:tab')
  if (!consoles.some((c) => c.id === tab)) tab = consoles[0] ? consoles[0].id : null
  let index = 0 // какая карточка выбрана

  function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  function cards() {
    return Array.from(root.querySelectorAll('.card'))
  }

  function select(i) {
    const all = cards()
    if (!all.length) return
    index = (i + all.length) % all.length
    all[index].focus()
  }

  function switchTab(id) {
    tab = id
    localStorage.setItem('arcade:tab', tab)
    index = 0
    render()
    select(0)
  }

  function render() {
    root.replaceChildren()

    const head = el('div', 'head')
    head.append(el('h1', '', 'Arcade'))
    const total = ArcadeStats.totalSeconds()
    head.append(el('div', 'total', total ? `Всего сыграно: ${ArcadeStats.duration(total)}` : 'Пока агент работает — сыграй'))
    root.append(head)

    const tabs = el('div', 'tabs')
    for (const c of consoles) {
      const button = el('button', c.id === tab ? 'tab active' : 'tab', c.title)
      button.tabIndex = -1
      if (c.soon) button.append(el('span', 'soon', 'скоро'))
      button.addEventListener('click', () => switchTab(c.id))
      tabs.append(button)
    }
    root.append(tabs)

    const current = consoles.find((c) => c.id === tab)
    const list = el('div', 'games')
    const ids = Object.keys(games).filter((id) => games[id].console === tab)
    if (!ids.length) list.append(el('div', 'empty', (current && current.soon) || 'Здесь пока нет игр.'))
    for (const id of ids) {
      const game = games[id]
      const card = el('a', 'card')
      card.href = `?game=${encodeURIComponent(id)}`
      card.dataset.game = id
      const top = el('div', 'card-top')
      top.append(el('span', 'title', game.title), el('span', 'genre', game.genre))
      card.append(top, el('div', 'about', game.about), el('div', 'stats', ArcadeStats.summary(id, game.score)))
      list.append(card)
    }
    root.append(list)
    root.append(el('div', 'hint', '↑ ↓ — выбрать игру · ← → — приставка · Enter — играть'))
  }

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const at = consoles.findIndex((c) => c.id === tab)
    if (e.code === 'ArrowDown' || e.code === 'KeyS') select(index + 1)
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') select(index - 1)
    else if (e.code === 'ArrowRight' || e.code === 'KeyD') switchTab(consoles[(at + 1) % consoles.length].id)
    else if (e.code === 'ArrowLeft' || e.code === 'KeyA') switchTab(consoles[(at - 1 + consoles.length) % consoles.length].id)
    else if (e.code === 'Enter') {
      const card = cards()[index]
      if (card) location.search = `?game=${encodeURIComponent(card.dataset.game)}`
    } else return
    e.preventDefault()
  })

  render()
  select(0)
})()
