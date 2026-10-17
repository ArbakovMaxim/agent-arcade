// Игры Sega Mega Drive в окне: эмулятор EmulatorJS (GPL-3.0) с ядром Genesis Plus GX (некоммерческая лицензия).
// Файл игры сначала скачивается и сверяется с хешем каталога, потом эмулятор берёт его уже из кеша браузера.
// Эмулятор лежит на нашем сайте (emulatorjs/) и не обращается к чужим серверам.
;(function () {
  'use strict'

  async function sha256(bytes) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
  }

  function overlay(title, hint) {
    document.getElementById('overlay-title').textContent = title
    document.getElementById('overlay-hint').textContent = hint
    document.getElementById('overlay').classList.add('shown')
  }

  async function start(catalog, id) {
    const game = (catalog.games || {})[id]
    if (!game) {
      overlay('Игра не найдена', 'Вернись в библиотеку и выбери игру.')
      return
    }
    document.title = `${game.title} · Arcade`
    document.getElementById('keys').textContent = game.keys
    document.getElementById('credit').textContent = game.credit
    const files = (game.license && game.license.files) || []
    const licenseFile = files.find((f) => /license/i.test(f.name))
    const sourceFile = files.find((f) => /\.tar\.gz$|\.zip$/i.test(f.name))
    document.getElementById('license').href = licenseFile ? licenseFile.url : game.license.source
    document.getElementById('source').href = sourceFile ? sourceFile.url : game.license.source

    // Вместо экрана Денди — место для эмулятора Sega
    const screen = document.getElementById('screen')
    if (screen) screen.style.display = 'none'
    const player = document.createElement('div')
    player.id = 'sega-player'
    player.style.width = 'min(100vw, calc((100vh - 40px) * 4 / 3))'
    player.style.height = 'calc(100vh - 40px)'
    player.style.margin = '0 auto'
    document.body.appendChild(player)

    overlay(game.title, 'Загружаю игру…')
    try {
      const response = await fetch(game.rom.url)
      if (!response.ok) throw new Error(`сервер ответил ${response.status}`)
      const bytes = new Uint8Array(await response.arrayBuffer())
      if ((await sha256(bytes)) !== game.rom.sha256) throw new Error('файл повреждён: хеш не совпал')
    } catch (err) {
      overlay('Не удалось загрузить игру', `${err.message}. Проверь интернет и открой окно ещё раз.`)
      return
    }
    document.getElementById('overlay').classList.remove('shown')

    window.EJS_player = '#sega-player'
    window.EJS_core = 'segaMD'
    window.EJS_gameUrl = game.rom.url
    window.EJS_gameName = game.title
    window.EJS_pathtodata = 'emulatorjs/'
    window.EJS_language = 'ru-RU'
    window.EJS_startOnLoaded = true
    window.EJS_backgroundColor = '#0b0b0e'
    window.EJS_DEBUG_XX = true // собранного emulator.min.js у нас нет — загрузчик берёт исходные файлы из src/
    const loader = document.createElement('script')
    loader.src = 'emulatorjs/loader.js'
    document.body.appendChild(loader)
  }

  window.ArcadeSega = { start }
})()
