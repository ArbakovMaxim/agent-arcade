// Сетевой Doom в окне: deathmatch на картах FreeDM и кооператив Freedoom для тех, кто ждёт своего агента.
// Режимы: dm — FreeDM, раунды по 5 минут, до четырёх; coop — Freedoom Phase 1 или 2 вместе, без таймера.
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

  const NET_KEYS = 'движение — стрелки · огонь — Ctrl · открыть — пробел · бег — Shift · шаг вбок — Alt и стрелки · оружие — 1–7'
  // Движок: doom-wasm для Doom, heretic-wasm для Blasphemer. Heretic ищет файл игры под именем heretic.wad
  const ENGINES = {
    doom: { dir: 'doom-wasm', script: 'websockets-doom.js' },
    heretic: { dir: 'heretic-wasm', script: 'websockets-heretic.js' },
  }

  // Ведущий лобби — наименьший номер: у всех он один и тот же, сервер для этого не нужен
  const leaderOf = (ids) => [...ids].sort()[0]

  // Параметры doom-wasm: хозяин — сервер игры, остальные подключаются к нему (номер 1)
  function doomArgs(wad, url, isHost, mode = 'dm') {
    const common = ['-iwad', wad, '-window', '-nogui', '-nomusic', '-servername', 'arcade', '-nodes', String(MAX_PLAYERS)]
    if (mode === 'solo') return common.slice(0, -2) // одному: без сервера и без -nodes
    const rules = mode === 'coop' ? ['-skill', '3'] : ['-deathmatch', '-timer', '5']
    return isHost
      ? [...common, '-server', '-privateserver', ...rules, '-dup', '1', '-wss', url]
      : [...common, '-connect', '1', '-dup', '1', '-wss', url]
  }

  // WAD из .zip (Freedoom весит почти 29 МБ — больше лимита Cloudflare на файл): разбираем архив сами,
  // распаковка — встроенный в браузер DecompressionStream
  async function wadFrom(url) {
    const bytes = new Uint8Array(await (await fetch(url)).arrayBuffer())
    if (String.fromCharCode(...bytes.subarray(0, 4)) !== 'PK\x03\x04') return bytes
    const view = new DataView(bytes.buffer)
    const method = view.getUint16(8, true)
    const size = view.getUint32(18, true)
    const nameLength = view.getUint16(26, true)
    const extraLength = view.getUint16(28, true)
    const start = 30 + nameLength + extraLength
    const data = bytes.subarray(start, start + size)
    if (method === 0) return data
    const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
    return new Uint8Array(await new Response(stream).arrayBuffer())
  }

  const wsUrl = (path) => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${path}`

  function overlay(title, hint) {
    document.getElementById('overlay-title').textContent = title
    document.getElementById('overlay-hint').textContent = hint
    document.getElementById('overlay').classList.add('shown')
  }

  function start(catalog, id, mode = 'dm') {
    const game = catalog.games[id]
    const coop = mode === 'coop'
    document.body.classList.remove('library-mode')
    document.title = `${game.title} · Arcade`
    // Сетевой движок — классический Doom: у кооператива свои клавиши, не PrBoom из одиночной игры
    document.getElementById('keys').textContent = T(coop && !game.engine ? NET_KEYS : game.keys)
    // Экран Денди в области игры не нужен: рядом с холстом движка он сдвигал бы его вбок
    const screen = document.getElementById('screen')
    if (screen) screen.style.display = 'none'
    // Одному (Blasphemer): без лобби — сразу игра; «По сети» — кооператив
    if (mode === 'solo') {
      const netLink = document.getElementById('net')
      if (netLink) {
        netLink.href = `?game=${encodeURIComponent(id)}&net=coop`
        netLink.hidden = false
        netLink.style.display = ''
      }
      launch(game, null, false, 'solo', id)
      return
    }
    document.getElementById('credit').textContent = T(game.credit)
    const files = (game.license && game.license.files) || []
    const licenseFile = files.find((f) => /license/i.test(f.name))
    document.getElementById('license').href = licenseFile ? licenseFile.url : game.license.source
    document.getElementById('source').href = 'licenses/doom-wasm/BUILD.txt'
    for (const el of ['sound', 'restart', 'best']) {
      const node = document.getElementById(el)
      if (node) node.style.display = 'none'
    }

    overlay(T(coop ? 'Кооператив' : 'Сетевой deathmatch'), T('Подключаюсь к лобби…'))
    // Лобби: у FreeDM общее, у кооператива — своё для каждой игры
    const ws = new WebSocket(wsUrl(`/net/room/${coop ? `coop-${id}` : game.engine ? `dm-${id}` : LOBBY}`))
    let me = null
    const peers = new Set()
    let round = null

    const everyone = () => (me ? [me, ...peers] : [...peers])

    function lobbyText() {
      const count = everyone().length
      if (round) return
      if (count < 2 && coop) overlay(T('Ждём напарника'), T('Как только кто-то зайдёт, начнёте вместе. Позови друга — пусть откроет эту же игру и нажмёт «По сети».'))
      else if (count < 2) overlay(T('Ждём второго игрока'), T('Как только кто-то зайдёт, начнётся раунд. А пока можно сыграть в Freedoom одному — кнопка «Библиотека».'))
      else overlay(T(coop ? 'Кооператив' : 'Сетевой deathmatch'), T(`В лобби ${count} — раунд вот-вот начнётся`))
    }

    // Ведущий объявляет раунд всем в лобби
    function maybeAnnounce() {
      const all = everyone()
      if (round || !me || all.length < 2 || leaderOf(all) !== me) return
      const players = [...all].sort().slice(0, MAX_PLAYERS)
      const msg = { type: 'round', room: `${coop ? 'coop' : 'dm'}-${me}-${Date.now().toString(36)}`, host: me, players }
      ws.send(JSON.stringify(msg))
      begin(msg)
    }

    function begin(msg) {
      round = msg
      if (!msg.players.includes(me)) {
        overlay(T('Идёт раунд'), T('В нём уже четыре игрока. Подожди здесь — следующий начнётся через несколько минут.'))
        if (!coop) setTimeout(() => location.reload(), BACK_TO_LOBBY_MS)
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
        launch(game, msg.room, isHost, mode, id)
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
  // Chocolate Doom узнаёт игру по имени файла: freedoom1.wad — первая часть, freedoom2.wad — Doom II, freedm.wad — FreeDM
  const WADS = { 'freedoom-1': 'freedoom1.wad', 'freedoom-2': 'freedoom2.wad' }

  function launch(game, room, isHost, mode = 'dm', id = '') {
    const engine = ENGINES[game.engine || 'doom']
    const wad = game.engine === 'heretic' ? 'heretic.wad' : WADS[id] || 'freedm.wad'
    overlay(mode === 'solo' ? game.title : T(isHost ? 'Ты хозяин раунда' : 'Подключаюсь к раунду'), T('Загружаю движок и карты…'))
    const stage = document.getElementById('stage') || document.body
    const canvas = document.createElement('canvas')
    canvas.id = 'canvas'
    canvas.tabIndex = -1
    canvas.style.width = '100%'
    canvas.style.height = '100%'
    canvas.style.objectFit = 'contain' // картинка 4:3 — целиком и без растяжения, по бокам или сверху и снизу чёрные поля
    canvas.style.background = '#000'
    stage.appendChild(canvas)
    const url = room ? wsUrl(`/net/doom/${room}`) : null
    window.Module = {
      noInitialRun: true,
      canvas,
      locateFile: (file) => `${engine.dir}/${file}`,
      preRun: [
        () => {
          // WAD — в файловую систему движка; из .zip — после распаковки
          window.Module.addRunDependency('wad')
          wadFrom(game.rom.url).then((bytes) => {
            window.Module.FS.writeFile(wad, bytes)
            window.Module.removeRunDependency('wad')
          })
        },
      ],
      onRuntimeInitialized: () => {
        document.getElementById('overlay').classList.remove('shown')
        const main = window.Module.callMain || window.callMain // в сборках Emscripten бывает и так, и так
        main(doomArgs(wad, url, isHost, mode))
        canvas.focus()
        quietWhenAway(canvas, mode === 'solo')
        // Движок ставит вкладке своё название («Websockets Doom») — возвращаем наше
        // Движок ставит своё название не сразу, а при загрузке уровня — возвращаем наше первую минуту
        const ours = `${game.title} · Arcade`
        const keep = setInterval(() => {
          if (document.title !== ours) document.title = ours
        }, 1000)
        setTimeout(() => clearInterval(keep), 60_000)
        // Хозяин начинает матч, когда все уже подключились: пробел на экране ожидания Chocolate Doom
        if (isHost && mode !== 'solo') setTimeout(() => pressSpace(canvas), HOST_START_MS)
        // Deathmatch идёт раундами — после раунда снова лобби; кооператив — сколько захотите
        if (mode === 'dm') setTimeout(() => location.reload(), BACK_TO_LOBBY_MS)
      },
      print: (text) => console.log(text),
      printErr: (text) => console.error(text),
    }
    const script = document.createElement('script')
    script.src = `${engine.dir}/${engine.script}`
    document.body.appendChild(script)
  }

  // Окно не в фокусе — во встроенном браузере Claude «крестик» только прячет панель, и страница теряет фокус.
  // Одному (Blasphemer) — пауза, как у Денди: клавиша Pause самого движка и приостановленный AudioContext. Главный цикл
  // Emscripten не трогаем: движок ждёт через Asyncify и сам останавливает и запускает этот цикл — чужая пауза его вешает.
  // Сетевую игру не останавливаем — пауза у одного остановила бы матч у всех: она идёт дальше без звука,
  // звук возвращается вместе с фокусом
  function quietWhenAway(canvas, solo) {
    let thaw = null // чем вернуть игру, когда человек вернулся
    function away() {
      if (thaw) return
      if (solo) {
        press(canvas, 'Pause', 'Pause', 19)
        overlay(T('Пауза'), T('Кликни или нажми любую клавишу, чтобы продолжить'))
      }
      let audio = null
      thaw = () => {
        if (audio) audio.resume()
        if (solo) press(canvas, 'Pause', 'Pause', 19) // та же клавиша снимает паузу
      }
      // Звук движок открывает не сразу: игру открыли в фоне — глушим его, как только появится
      const hush = () => {
        if (!thaw) return
        const sdl = window.Module.SDL2
        audio = sdl && sdl.audioContext
        if (audio) audio.suspend()
        else setTimeout(hush, 500)
      }
      hush()
    }
    function back() {
      if (!thaw) return
      document.getElementById('overlay').classList.remove('shown')
      const go = thaw
      thaw = null
      go()
      canvas.focus()
    }
    window.addEventListener('blur', away)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) away()
    })
    if (solo) {
      document.getElementById('overlay').addEventListener('click', back)
      // Клавиша только продолжает игру и в движок не попадает: Esc открыл бы меню
      window.addEventListener(
        'keydown',
        (e) => {
          if (!thaw || e.ctrlKey || e.metaKey || e.altKey) return
          e.preventDefault()
          e.stopPropagation()
          if (!e.repeat) back()
        },
        true
      )
    } else window.addEventListener('focus', back)
    // Игра запустилась, а окно уже не в фокусе (открыли в фоне, пока работал Claude)
    if (!document.hasFocus()) away()
  }

  // Как в странице Cloudflare: обычное событие с keyCode — у KeyboardEvent это поле только для чтения, и SDL получил бы 0
  function press(canvas, key, code, keyCode) {
    for (const type of ['keydown', 'keyup']) {
      const e = new Event(type, { bubbles: true })
      Object.assign(e, { key, code, keyCode, which: keyCode })
      canvas.dispatchEvent(e)
    }
  }
  const pressSpace = (canvas) => press(canvas, ' ', 'Space', 32)

  window.ArcadeNetDoom = { start, leaderOf, doomArgs, wadFrom, quietWhenAway }
})()
