// Arcade в окне браузера: Денди на эмуляторе JSNES.
// Клавиши берутся по физическому положению (event.code), поэтому раскладка не важна. Есть геймпад и звук.
// Игра стоит на паузе, пока окно не в фокусе, и сохраняет прогресс в браузере.
;(function () {
  'use strict'

  // Скачивает файл игры и сверяет SHA-256 с каталогом: битый или подменённый файл не запустится
  async function loadFile(file) {
    const response = await fetch(file.url)
    if (!response.ok) throw new Error(T(`сервер ответил ${response.status}`))
    const bytes = new Uint8Array(await response.arrayBuffer())
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    const hex = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
    if (hex !== file.sha256) throw new Error(T('файл повреждён: хеш не совпал'))
    return bytes
  }

  async function start(catalog, id, localRom) {

  const WIDTH = 256
  const HEIGHT = 240
  const FRAME_MS = 1000 / 60
  const MAX_FRAMES_PER_DRAW = 4 // после подвисания не догоняем дольше, чем на четыре кадра
  const RING = 8192 // сэмплов звука в запасе

  // Клавиатура по физическим клавишам: и W, и стрелка — вверх, в любой раскладке
  const KEYS = {
    ArrowUp: 'UP',
    KeyW: 'UP',
    ArrowDown: 'DOWN',
    KeyS: 'DOWN',
    ArrowLeft: 'LEFT',
    KeyA: 'LEFT',
    ArrowRight: 'RIGHT',
    KeyD: 'RIGHT',
    KeyX: 'A',
    KeyK: 'A',
    KeyZ: 'B',
    KeyJ: 'B',
    Enter: 'START',
    ShiftLeft: 'SELECT',
    ShiftRight: 'SELECT',
  }
  // Геймпад со стандартной раскладкой: нижняя и левая кнопки — B Денди, правая и верхняя — A
  const PAD = { 0: 'B', 1: 'A', 2: 'B', 3: 'A', 8: 'SELECT', 9: 'START', 12: 'UP', 13: 'DOWN', 14: 'LEFT', 15: 'RIGHT' }
  const BUTTON = {}
  for (const name of ['A', 'B', 'SELECT', 'START', 'UP', 'DOWN', 'LEFT', 'RIGHT']) BUTTON[name] = jsnes.Controller['BUTTON_' + name]

  const game = (catalog.games || {})[id]
  const canvas = document.getElementById('screen')
  const overlay = document.getElementById('overlay')
  const overlayTitle = document.getElementById('overlay-title')
  const overlayHint = document.getElementById('overlay-hint')
  const soundButton = document.getElementById('sound')
  const bestLabel = document.getElementById('best')
  // «По сети» — та же игра на EmulatorJS с его сетевой игрой: создать комнату или войти в чужую
  const netLink = document.getElementById('net')
  if (netLink && game && game.rom && game.rom.sha256) {
    netLink.href = `?game=${encodeURIComponent(id)}&net=1`
    netLink.hidden = false
  }
  const restartButton = document.getElementById('restart')

  function showOverlay(title, hint) {
    overlayTitle.textContent = title
    overlayHint.textContent = hint
    overlay.classList.add('shown')
  }

  if (!game) {
    showOverlay(T('Игра не найдена'), T(`В этой сборке нет игры «${id}».`))
    return
  }
  document.body.classList.remove('library-mode')
  document.title = `${game.title} · Arcade`
  document.getElementById('keys').textContent = T(game.keys)
  document.getElementById('credit').textContent = T(game.credit)
  const licenseFiles = (game.license && game.license.files) || []
  const licenseFile = licenseFiles.find((f) => /license/i.test(f.name))
  const sourceFile = licenseFiles.find((f) => /\.tar\.gz$|\.zip$/i.test(f.name))
  const licenseLink = document.getElementById('license')
  const sourceLink = document.getElementById('source')
  if (localRom) {
    licenseLink.style.display = 'none'
    sourceLink.style.display = 'none'
  } else {
    licenseLink.style.display = ''
    sourceLink.style.display = ''
    licenseLink.href = licenseFile ? licenseFile.url : game.license.source
    sourceLink.href = sourceFile ? sourceFile.url : game.license.source
  }

  showOverlay(game.title, T('Загружаю игру…'))
  let romBytes
  try {
    romBytes = localRom ? localRom.bytes : await loadFile(game.rom)
  } catch (err) {
    showOverlay(T('Не удалось загрузить игру'), T(`${err.message}. Проверь интернет и открой окно ещё раз.`))
    return
  }

  // Экран: кадр 256×240, увеличенный в целое число раз, чтобы все пиксели были одинаковыми
  const context = canvas.getContext('2d')
  const image = context.createImageData(WIDTH, HEIGHT)
  const pixels = new Uint32Array(image.data.buffer)
  function fit() {
    const stage = document.getElementById('stage')
    const fits = Math.min(stage.clientWidth / WIDTH, stage.clientHeight / HEIGHT)
    const scale = fits >= 1 ? Math.floor(fits) : fits
    canvas.style.width = `${WIDTH * scale}px`
    canvas.style.height = `${HEIGHT * scale}px`
  }
  window.addEventListener('resize', fit)
  fit()

  // Звук: эмулятор кладёт сэмплы в кольцевой буфер, Web Audio их забирает
  const AudioContextClass = window.AudioContext || window.webkitAudioContext
  const audio = AudioContextClass ? new AudioContextClass() : null
  const left = new Float32Array(RING)
  const right = new Float32Array(RING)
  let writeAt = 0
  let readAt = 0
  let soundOn = localStorage.getItem('arcade:sound') !== 'off'

  const nes = new jsnes.NES({
    onFrame(frame) {
      for (let i = 0; i < frame.length; i++) pixels[i] = 0xff000000 | frame[i]
    },
    onAudioSample(l, r) {
      left[writeAt] = l
      right[writeAt] = r
      writeAt = (writeAt + 1) % RING
      if (writeAt === readAt) readAt = (readAt + 1) % RING // буфер полон — теряем самый старый сэмпл
    },
    sampleRate: audio ? audio.sampleRate : 44100,
  })
  try {
    nes.loadROM(romBytes)
  } catch (err) {
    showOverlay(T('Не удалось открыть ROM'), T(`${err.message || 'эмулятор не распознал файл'}.`))
    return
  }

  if (audio) {
    const node = audio.createScriptProcessor(1024, 1, 2)
    node.onaudioprocess = (e) => {
      const outLeft = e.outputBuffer.getChannelData(0)
      const outRight = e.outputBuffer.getChannelData(1)
      for (let i = 0; i < outLeft.length; i++) {
        if (readAt === writeAt) {
          outLeft[i] = 0
          outRight[i] = 0
          continue
        }
        outLeft[i] = soundOn ? left[readAt] : 0
        outRight[i] = soundOn ? right[readAt] : 0
        readAt = (readAt + 1) % RING
      }
    }
    node.connect(audio.destination)
  }

  function showSound() {
    soundButton.textContent = soundOn ? T('Звук: вкл') : T('Звук: выкл')
  }
  showSound()
  soundButton.addEventListener('click', () => {
    soundOn = !soundOn
    localStorage.setItem('arcade:sound', soundOn ? 'on' : 'off')
    showSound()
    soundButton.blur()
  })

  // Сохранение: всё состояние эмулятора, при каждой паузе и при закрытии окна
  const saveKey = `arcade:${id}:save`
  function save() {
    try {
      localStorage.setItem(saveKey, JSON.stringify(nes.toJSON()))
    } catch {
      // Хранилище браузера переполнено или отключено — играем без сохранения
    }
  }
  function restore() {
    try {
      const saved = localStorage.getItem(saveKey)
      if (!saved) return false
      nes.fromJSON(JSON.parse(saved))
      return true
    } catch {
      localStorage.removeItem(saveKey)
      return false
    }
  }

  // Статистика: партия засчитывается, когда игра впервые пошла; время копится, только пока игра не на паузе;
  // рекорд раз в секунду читается из памяти приставки, если игра знает, где у неё счёт.
  let counted = false
  let unsavedFrames = 0
  let framesSinceScore = 0
  let best = ArcadeStats.get(id).best
  let bestUnsaved = false
  function showBest() {
    bestLabel.textContent = game.score && best ? `${game.score.label}: ${ArcadeStats.number(best)}` : ''
  }
  showBest()
  function countPlay() {
    if (counted) return
    counted = true
    ArcadeStats.update(id, (s) => {
      s.plays += 1
      s.last = Date.now()
    })
  }
  function trackFrames(frames) {
    unsavedFrames += frames
    framesSinceScore += frames
    if (game.score && framesSinceScore >= 60) {
      framesSinceScore = 0
      const score = ArcadeStats.readScore(game.score, nes.cpu.mem)
      if (score !== null && (best === null || score > best)) {
        best = score
        bestUnsaved = true
        showBest()
      }
    }
    if (unsavedFrames >= 600) flushStats() // раз в десять секунд игры
  }
  function flushStats() {
    if (!unsavedFrames && !bestUnsaved) return
    const seconds = unsavedFrames / 60
    unsavedFrames = 0
    bestUnsaved = false
    ArcadeStats.update(id, (s) => {
      s.seconds += seconds
      if (best !== null && (s.best === null || best > s.best)) s.best = best
    })
  }

  // Ввод: что зажато на клавиатуре и геймпаде. Короткое нажатие держится хотя бы один кадр, чтобы игра его увидела.
  const keysDown = new Set()
  const tapped = new Set()
  let padButtons = new Set()
  const active = new Set()
  function apply() {
    const wanted = new Set(tapped)
    for (const code of keysDown) wanted.add(KEYS[code])
    for (const button of padButtons) wanted.add(button)
    for (const button of wanted) {
      if (!active.has(button)) {
        nes.buttonDown(1, BUTTON[button])
        active.add(button)
      }
    }
    for (const button of [...active]) {
      if (!wanted.has(button)) {
        nes.buttonUp(1, BUTTON[button])
        active.delete(button)
      }
    }
  }
  function releaseAll() {
    keysDown.clear()
    tapped.clear()
    padButtons = new Set()
    apply()
  }
  function readPad() {
    const now = new Set()
    for (const pad of navigator.getGamepads ? navigator.getGamepads() : []) {
      if (!pad) continue
      pad.buttons.forEach((b, i) => {
        if (b.pressed && PAD[i]) now.add(PAD[i])
      })
      const x = pad.axes[0] || 0
      const y = pad.axes[1] || 0
      if (x < -0.5) now.add('LEFT')
      if (x > 0.5) now.add('RIGHT')
      if (y < -0.5) now.add('UP')
      if (y > 0.5) now.add('DOWN')
    }
    return now
  }

  // Пауза: в начале (браузеру нужен клик или клавиша, чтобы включить звук) и когда окно теряет фокус
  let paused = true
  let lastTime = performance.now() // часы главного цикла
  let behind = 0 // сколько миллисекунд эмулятор отстаёт от реального времени
  function pause() {
    if (paused) return
    paused = true
    releaseAll()
    save()
    flushStats()
    if (audio) audio.suspend()
    showOverlay(T('Пауза'), T('Кликни или нажми любую клавишу, чтобы продолжить'))
  }
  function resume() {
    if (!paused) return
    paused = false
    countPlay()
    overlay.classList.remove('shown')
    if (audio) audio.resume()
    lastTime = performance.now()
    behind = 0
  }
  window.addEventListener('blur', pause)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause()
  })
  window.addEventListener('pagehide', () => {
    save()
    flushStats()
  })
  overlay.addEventListener('click', resume)

  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey || e.altKey) return
    const button = KEYS[e.code]
    if (paused) {
      e.preventDefault()
      if (!e.repeat) resume()
      return
    }
    if (!button) return
    e.preventDefault()
    keysDown.add(e.code)
    if (!e.repeat) tapped.add(button)
  })
  window.addEventListener('keyup', (e) => {
    if (!KEYS[e.code]) return
    e.preventDefault()
    keysDown.delete(e.code)
  })

  restartButton.addEventListener('click', () => {
    localStorage.removeItem(saveKey)
    nes.reloadROM()
    restartButton.blur()
    resume()
  })

  // Главный цикл: эмулятор идёт ровно 60 кадров в секунду при любой частоте экрана
  let padWasPressed = false
  function loop(now) {
    requestAnimationFrame(loop)
    const pad = readPad()
    if (paused) {
      // Кнопка геймпада тоже снимает паузу
      if (pad.size && !padWasPressed) resume()
      padWasPressed = pad.size > 0
      return
    }
    padWasPressed = pad.size > 0
    padButtons = pad
    behind += Math.min(now - lastTime, 250)
    lastTime = now
    let frames = 0
    while (behind >= FRAME_MS && frames < MAX_FRAMES_PER_DRAW) {
      apply()
      nes.frame()
      tapped.clear()
      behind -= FRAME_MS
      frames++
    }
    if (frames) {
      context.putImageData(image, 0, 0)
      trackFrames(frames)
    }
  }

  const restored = restore()
  nes.frame()
  context.putImageData(image, 0, 0)
  showOverlay(game.title, restored ? T('Продолжаем с места остановки — кликни или нажми любую клавишу') : T('Кликни или нажми любую клавишу, чтобы начать'))
  requestAnimationFrame(loop)
  }

  async function startLocal(bytes, fileName) {
    if (!(bytes instanceof Uint8Array)) throw new Error(T('Не удалось прочитать файл.'))
    if (bytes.length < 16 || bytes[0] !== 0x4e || bytes[1] !== 0x45 || bytes[2] !== 0x53 || bytes[3] !== 0x1a) {
      throw new Error(T('Это не ROM для NES: в файле нет заголовка iNES.'))
    }
    if (bytes.length > 16 * 1024 * 1024) throw new Error(T('ROM больше 16 МБ — такой файл не поддерживается.'))
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    const hash = Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
    const cleanName = String(fileName || T('Свой ROM')).replace(/\.nes$/i, '').trim() || T('Свой ROM')
    const id = `local-${hash.slice(0, 16)}`
    const catalog = {
      games: {
        [id]: {
          title: cleanName,
          keys: T('Стрелки/WASD · A: X/K · B: Z/J · Start: Enter · Select: Shift'),
          credit: T('локальный ROM'),
          license: { files: [], source: '#' },
        },
      },
    }
    await start(catalog, id, { bytes })
  }

  window.ArcadeGame = { start, startLocal }
})()
