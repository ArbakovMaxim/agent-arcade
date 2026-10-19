// Библиотека в окне браузера: вкладки приставок, карточки игр со статистикой и «Мои игры» — свои файлы,
// которые хранятся только в этом браузере (mine.js). Карточка ведёт в игру (?game=… или #mine=…).
// Каталог приходит с сервера (boot.js).
;(function () {
  'use strict'

  const NOTES = {
    nes: T('Свой файл .nes откроется только на этом устройстве и не отправится на сервер.'),
    sega: T('Свой файл .md или .bin откроется только на этом устройстве и не отправится на сервер.'),
    sms: T('Свой файл .sms откроется только на этом устройстве и не отправится на сервер.'),
    doom: T('Свой файл .wad — например, купленный doom.wad — откроется только на этом устройстве и не отправится на сервер.'),
    psx: T('Свой диск .chd, .pbp, .iso или .zip с .cue и .bin откроется только на этом устройстве. BIOS Sony не нужен.'),
  }

  function start(catalog, startTab) {
  const consoles = catalog.consoles || []
  const games = catalog.games || {}
  const root = document.getElementById('library')
  const romInput = document.getElementById('local-rom')
  document.body.classList.add('library-mode')
  document.title = 'Arcade'

  let tab = startTab || localStorage.getItem('arcade:tab')
  if (!consoles.some((c) => c.id === tab)) tab = consoles[0] ? consoles[0].id : null
  let index = 0 // какая карточка выбрана
  let localError = ''
  let mineList = [] // свои игры текущей вкладки

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

  async function refreshMine() {
    mineList = window.ArcadeMine ? await window.ArcadeMine.list(tab) : []
    render()
  }

  function switchTab(id) {
    tab = id
    localStorage.setItem('arcade:tab', tab)
    // У каждой вкладки свой адрес: его можно скопировать, сохранить в закладки, «Назад» возвращает на прошлую
    history.pushState(null, '', `?tab=${encodeURIComponent(tab)}`)
    index = 0
    localError = ''
    mineList = []
    render()
    select(0)
    refreshMine().then(() => select(0))
  }

  function render() {
    root.replaceChildren()

    const head = el('div', 'head')
    head.append(el('h1', '', 'Arcade'))
    const total = ArcadeStats.totalSeconds()
    const actions = el('div', 'head-actions')
    actions.append(el('div', 'total', total ? T(`Всего сыграно: ${ArcadeStats.duration(total)}`) : T('Пока агент работает — сыграй')))
    // Язык окна: RU или EN — выбор запоминается
    const langButton = el('button', 'open-rom lang', window.ArcadeI18n && window.ArcadeI18n.lang === 'en' ? 'RU' : 'EN')
    langButton.type = 'button'
    langButton.title = 'Русский / English'
    langButton.addEventListener('click', () => window.ArcadeI18n.set(window.ArcadeI18n.lang === 'en' ? 'ru' : 'en'))
    const open = el('button', 'open-rom', T('Открыть свой файл'))
    open.type = 'button'
    open.addEventListener('click', () => {
      romInput.accept = (window.ArcadeMine && window.ArcadeMine.ACCEPT[tab]) || ''
      romInput.click()
    })
    // Свои файлы бывают не у всех вкладок: у настольных игр их нет
    if (window.ArcadeMine && window.ArcadeMine.ACCEPT[tab]) actions.append(open)
    actions.append(langButton)
    head.append(actions)
    root.append(head)

    root.append(el('div', localError ? 'local-error' : 'local-note', localError || NOTES[tab] || ''))

    const tabs = el('div', 'tabs')
    for (const c of consoles) {
      const button = el('button', c.id === tab ? 'tab active' : 'tab', T(c.title))
      button.tabIndex = -1
      if (c.soon) button.append(el('span', 'soon', T('скоро')))
      button.addEventListener('click', () => switchTab(c.id))
      tabs.append(button)
    }
    root.append(tabs)

    const current = consoles.find((c) => c.id === tab)
    const list = el('div', 'games')
    const ids = Object.keys(games).filter((id) => games[id].console === tab)
    if (!ids.length) list.append(el('div', 'empty', T((current && (current.empty || current.soon)) || 'Здесь пока нет игр.')))
    for (const id of ids) {
      const game = games[id]
      const card = el('a', 'card')
      card.href = `?game=${encodeURIComponent(id)}`
      card.dataset.game = id
      const top = el('div', 'card-top')
      top.append(el('span', 'title', game.title), el('span', 'genre', T(game.genre)))
      card.append(top, el('div', 'about', window.ArcadeI18n && window.ArcadeI18n.lang === 'en' && game.about_en ? game.about_en : game.about), el('div', 'stats', ArcadeStats.summary(id, game.score)))
      list.append(card)
    }
    if (mineList.length) list.append(el('div', 'mine-head', T('Мои игры — только в этом браузере')))
    for (const m of mineList) {
      const card = el('a', 'card mine')
      card.href = `#mine=${encodeURIComponent(m.id)}`
      card.dataset.mine = m.id
      const top = el('div', 'card-top')
      top.append(el('span', 'title', m.title), el('span', 'genre', T('свой файл')))
      const remove = el('button', 'remove', '✕')
      remove.type = 'button'
      remove.title = T('Удалить из этого браузера')
      remove.addEventListener('click', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        await window.ArcadeMine.remove(m.id)
        await refreshMine()
      })
      top.append(remove)
      card.append(top, el('div', 'about', T(`${(m.size / 1024 / 1024).toFixed(1)} МБ`)))
      list.append(card)
    }
    root.append(list)
    root.append(el('div', 'hint', T('↑ ↓ — выбрать игру · ← → — приставка · Enter — играть')))
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
      if (card && card.dataset.mine) location.hash = `mine=${encodeURIComponent(card.dataset.mine)}`
      else if (card) location.search = `?game=${encodeURIComponent(card.dataset.game)}`
    } else return
    e.preventDefault()
  })

  romInput.addEventListener('change', async () => {
    const file = romInput.files && romInput.files[0]
    romInput.value = ''
    if (!file) return
    try {
      const entry = await window.ArcadeMine.add(file, tab)
      history.replaceState(null, '', `#mine=${encodeURIComponent(entry.id)}`)
      root.replaceChildren()
      await window.ArcadePlayMine(entry)
    } catch (err) {
      localError = err && err.message ? err.message : T('Не удалось открыть файл.')
      render()
    }
  })

  render()
  select(0)
  refreshMine().then(() => select(0))
  // «Назад» в браузере — на прошлую вкладку: адрес уже сменился, открываем страницу заново
  window.addEventListener('popstate', () => location.reload())
  }

  window.ArcadeLibrary = { start }
})()
