// Игры Sega Mega Drive и PlayStation в окне: эмулятор EmulatorJS (GPL-3.0).
// Sega — ядро Genesis Plus GX (некоммерческая лицензия), PlayStation — PCSX ReARMed (GPL-2.0) со своей
// заменой BIOS: BIOS Sony не нужен. Игры каталога сверяются с хешем; свои файлы — из «Моих игр» этого браузера.
// Эмулятор лежит на нашем сайте (emulatorjs/) и не обращается к чужим серверам.
;(function () {
  'use strict'

  const SYSTEMS = {
    sega: { core: 'segaMD', keys: T('движение — стрелки · A — S · B — X · C — Z · Start — Enter') },
    // Master System — явно Genesis Plus GX: иначе EmulatorJS взял бы ядро SMS Plus, которого у нас нет
    sms: { core: 'genesis_plus_gx', keys: T('движение — стрелки · 1 (и Start) — X · 2 — Z · пауза — Enter') },
    psx: { core: 'psx', keys: T('движение — стрелки · ✕ — X · ○ — Z · □ — S · △ — A · L1/R1 — Q/E · Start — Enter · Select — V') },
  }

  async function sha256(bytes) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
  }

  function overlay(title, hint) {
    document.getElementById('overlay-title').textContent = title
    document.getElementById('overlay-hint').textContent = hint
    document.getElementById('overlay').classList.add('shown')
  }

  // Страница под эмулятор: заголовок, подсказка по клавишам, место в области игры вместо экрана Денди
  function prepare(title, keys, credit) {
    document.body.classList.remove('library-mode')
    document.title = `${title} · Arcade`
    document.getElementById('keys').textContent = T(keys)
    document.getElementById('credit').textContent = T(credit)
    // EmulatorJS растягивает контейнер на всего родителя — поэтому он внутри области игры, а не поверх полосы
    const screen = document.getElementById('screen')
    if (screen) screen.style.display = 'none'
    const player = document.createElement('div')
    player.id = 'sega-player'
    player.style.width = '100%'
    player.style.height = '100%'
    const stage = document.getElementById('stage')
    ;(stage || document.body).appendChild(player)
    // Звук, «Сначала» и рекорд в полосе — для Денди; у EmulatorJS свои кнопки на его панели
    for (const id of ['sound', 'restart', 'best']) {
      const el = document.getElementById(id)
      if (el) el.style.display = 'none'
    }
  }

  function launch(core, url, name) {
    window.EJS_player = '#sega-player'
    window.EJS_core = core
    window.EJS_gameUrl = url
    window.EJS_gameName = name
    window.EJS_pathtodata = 'emulatorjs/'
    window.EJS_language = 'ru-RU'
    window.EJS_startOnLoaded = true
    window.EJS_backgroundColor = '#0b0b0e'
    window.EJS_DEBUG_XX = true // собранного emulator.min.js у нас нет — загрузчик берёт исходные файлы из src/
    const loader = document.createElement('script')
    loader.src = 'emulatorjs/loader.js'
    document.body.appendChild(loader)
  }

  // Игра из каталога сайта
  async function start(catalog, id) {
    const game = (catalog.games || {})[id]
    const system = game && SYSTEMS[game.console]
    if (!system) {
      overlay(T('Игра не найдена'), T('Вернись в библиотеку и выбери игру.'))
      return
    }
    prepare(game.title, game.keys || system.keys, game.credit)
    const files = (game.license && game.license.files) || []
    const licenseFile = files.find((f) => /license/i.test(f.name))
    const sourceFile = files.find((f) => /\.tar\.gz$|\.zip$/i.test(f.name))
    document.getElementById('license').href = licenseFile ? licenseFile.url : game.license.source
    document.getElementById('source').href = sourceFile ? sourceFile.url : game.license.source
    overlay(game.title, T('Загружаю игру…'))
    try {
      const response = await fetch(game.rom.url)
      if (!response.ok) throw new Error(T(`сервер ответил ${response.status}`))
      const bytes = new Uint8Array(await response.arrayBuffer())
      if ((await sha256(bytes)) !== game.rom.sha256) throw new Error(T('файл повреждён: хеш не совпал'))
    } catch (err) {
      overlay(T('Не удалось загрузить игру'), T(`${err.message}. Проверь интернет и открой окно ещё раз.`))
      return
    }
    document.getElementById('overlay').classList.remove('shown')
    launch(system.core, game.rom.url, game.title)
  }

  // Свой файл из «Моих игр»: в эмулятор он идёт прямо из браузера, на сервер ничего не уходит
  function startLocal(entry) {
    const system = SYSTEMS[entry.console]
    if (!system) {
      overlay(T('Не получилось'), T('Эта приставка пока не поддерживает свои файлы.'))
      return
    }
    prepare(entry.title, system.keys, T('свой файл — хранится только в этом браузере'))
    for (const id of ['license', 'source']) document.getElementById(id).style.display = 'none'
    // Ядро узнаёт Master System по расширению, а у файла из браузера имени нет — даём его сами
    const ext = (String(entry.file && entry.file.name).match(/\.([a-z0-9]+)$/i) || [])[1]
    launch(system.core, URL.createObjectURL(entry.file), ext ? `${entry.title}.${ext.toLowerCase()}` : entry.title)
  }

  window.ArcadeEJS = { start, startLocal }
})()
