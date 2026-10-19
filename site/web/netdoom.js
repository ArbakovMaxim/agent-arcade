// Сетевой Doom в окне: deathmatch на картах FreeDM для тех, кто ждёт своего агента.
// Лобби — общая комната /net/room/doom-lobby: все видят, сколько людей ждёт. Ведущий лобби — игрок с наименьшим
// номером: когда собралось двое и больше, он объявляет раунд — комнату Doom, хозяина и игроков (до четырёх).
// Хозяин запускает doom-wasm с -server, остальные — с -connect 1 чуть позже; через 10 секунд страница хозяина
// «жмёт пробел», и матч начинается. Раунд — 5 минут (-timer 5), потом все возвращаются в лобби.
// Chocolate Doom не пускает в идущий матч, поэтому опоздавшие ждут конца раунда.
;(function () {
  'use strict'

  const LOBBY = 'doom-lobby'
  const MAX_PLAYERS = 4
  const COUNTDOWN_MS = 15_000 // отсчёт перед раундом
  const CLIENT_DELAY_MS = 2_000 // игроки подключаются чуть позже хозяина — его сервер уже ждёт
  const HOST_START_MS = 10_000 // хозяин начинает матч, когда все уже подключились
  const ROUND_MS = 5 * 60_000 // -timer 5
  const BACK_TO_LOBBY_MS = ROUND_MS + 40_000 // раунд, табло и запас — потом снова лобби

  // Ведущий лобби — наименьший номер: у всех он один и тот же, сервер для этого не нужен
  const leaderOf = (ids) => [...ids].sort()[0]

  // Параметры doom-wasm: хозяин — сервер игры, остальные подключаются к нему (номер 1)
  function doomArgs(wad, url, isHost) {
    const common = ['-iwad', wad, '-window', '-nogui', '-nomusic', '-servername', 'arcade', '-nodes', String(MAX_PLAYERS)]
    return isHost
      ? [...common, '-server', '-privateserver', '-deathmatch', '-timer', '5', '-dup', '1', '-wss', url]
      : [...common, '-connect', '1', '-dup', '1', '-wss', url]
  }

  const wsUrl = (path) => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${path}`

  function overlay(title, hint) {
    document.getElementById('overlay-title').textContent = title
    document.getElementById('overlay-hint').textContent = hint
    document.getElementById('overlay').classList.add('shown')
  }

  function start(catalog, id) {
    const game = catalog.games[id]
    document.body.classList.remove('library-mode')
    document.title = `${game.title} · Arcade`
    document.getElementById('keys').textContent = T(game.keys)
    document.getElementById('credit').textContent = T(game.credit)
    const files = (game.license && game.license.files) || []
    const licenseFile = files.find((f) => /license/i.test(f.name))
    document.getElementById('license').href = licenseFile ? licenseFile.url : game.license.source
    document.getElementById('source').href = 'licenses/doom-wasm/BUILD.txt'
    for (const el of ['sound', 'restart', 'best']) {
      const node = document.getElementById(el)
      if (node) node.style.display = 'none'
    }
    const screen = document.getElementById('screen')
    if (screen) screen.style.display = 'none'

    overlay(T('Сетевой deathmatch'), T('Подключаюсь к лобби…'))
    const ws = new WebSocket(wsUrl(`/net/room/${LOBBY}`))
    let me = null
    const peers = new Set()
    let round = null

    const everyone = () => (me ? [me, ...peers] : [...peers])

    function lobbyText() {
      const count = everyone().length
      if (round) return
      if (count < 2) overlay(T('Ждём второго игрока'), T('Как только кто-то зайдёт, начнётся раунд. А пока можно сыграть в Freedoom одному — кнопка «Библиотека».'))
      else overlay(T('Сетевой deathmatch'), T(`В лобби ${count} — раунд вот-вот начнётся`))
    }

    // Ведущий объявляет раунд всем в лобби
    function maybeAnnounce() {
      const all = everyone()
      if (round || !me || all.length < 2 || leaderOf(all) !== me) return
      const players = [...all].sort().slice(0, MAX_PLAYERS)
      const msg = { type: 'round', room: `dm-${me}-${Date.now().toString(36)}`, host: me, players }
      ws.send(JSON.stringify(msg))
      begin(msg)
    }

    function begin(msg) {
      round = msg
      if (!msg.players.includes(me)) {
        overlay(T('Идёт раунд'), T('В нём уже четыре игрока. Подожди здесь — следующий начнётся через несколько минут.'))
        setTimeout(() => location.reload(), BACK_TO_LOBBY_MS)
        return
      }
      const isHost = msg.host === me
      let left = Math.round(COUNTDOWN_MS / 1000)
      overlay(T('Раунд начинается'), T(`Игроков: ${msg.players.length}. Старт через ${left} с`))
      const tick = setInterval(() => {
        left -= 1
        if (left > 0) overlay(T('Раунд начинается'), T(`Игроков: ${msg.players.length}. Старт через ${left} с`))
      }, 1000)
      setTimeout(() => {
        clearInterval(tick)
        launch(game, msg.room, isHost)
      }, COUNTDOWN_MS + (isHost ? 0 : CLIENT_DELAY_MS))
    }

    ws.addEventListener('message', (e) => {
      if (typeof e.data !== 'string') return
      let msg
      try {
        msg = JSON.parse(e.data)
      } catch {
        return
      }
      if (msg.type === 'welcome') {
        me = msg.id
        for (const p of msg.peers || []) peers.add(p)
      } else if (msg.type === 'join') peers.add(msg.id)
      else if (msg.type === 'leave') peers.delete(msg.id)
      else if (msg.type === 'round' && !round && Array.isArray(msg.players)) begin(msg)
      lobbyText()
      maybeAnnounce()
    })
    ws.addEventListener('close', () => {
      if (!round) overlay(T('Нет связи с лобби'), T('Открой окно ещё раз через минуту.'))
    })
    window.ArcadeNetDoom.lobby = { get me() { return me }, get round() { return round }, ws }
  }

  // Запуск doom-wasm: WAD грузится в его файловую систему, дальше — main с параметрами сети
  function launch(game, room, isHost) {
    overlay(T(isHost ? 'Ты хозяин раунда' : 'Подключаюсь к раунду'), T('Загружаю движок и карты…'))
    const stage = document.getElementById('stage') || document.body
    const canvas = document.createElement('canvas')
    canvas.id = 'canvas'
    canvas.tabIndex = -1
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    stage.appendChild(canvas)
    const url = wsUrl(`/net/doom/${room}`)
    window.Module = {
      noInitialRun: true,
      canvas,
      locateFile: (file) => `doom-wasm/${file}`,
      preRun: [() => window.Module.FS.createPreloadedFile('', 'freedm.wad', game.rom.url, true, false)],
      onRuntimeInitialized: () => {
        document.getElementById('overlay').classList.remove('shown')
        const main = window.Module.callMain || window.callMain // в сборках Emscripten бывает и так, и так
        main(doomArgs('freedm.wad', url, isHost))
        canvas.focus()
        // Хозяин начинает матч, когда все уже подключились: пробел на экране ожидания Chocolate Doom
        if (isHost) setTimeout(() => pressSpace(canvas), HOST_START_MS)
        setTimeout(() => location.reload(), BACK_TO_LOBBY_MS)
      },
      print: (text) => console.log(text),
      printErr: (text) => console.error(text),
    }
    const script = document.createElement('script')
    script.src = 'doom-wasm/websockets-doom.js'
    document.body.appendChild(script)
  }

  // Как в странице Cloudflare: обычное событие с keyCode — у KeyboardEvent это поле только для чтения, и SDL получил бы 0
  function pressSpace(canvas) {
    for (const type of ['keydown', 'keyup']) {
      const e = new Event(type, { bubbles: true })
      Object.assign(e, { key: ' ', code: 'Space', keyCode: 32, which: 32 })
      canvas.dispatchEvent(e)
    }
  }

  window.ArcadeNetDoom = { start, leaderOf, doomArgs }
})()
