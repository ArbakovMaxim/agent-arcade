// Загрузчик окна Arcade: берёт каталог с сервера и открывает библиотеку, игру (?game=…), свою игру (#mine=…),
// книгу (?book=gutenberg:… или wikisource:…) или аудиокнигу (?audio=librivox:…) из открытых библиотек.
// Своя игра — в части адреса после #: браузер не отправляет её на сервер, поэтому хеш и название файла
// не попадают в запросы и логи.
// Денди идёт в JSNES (game.js), Sega и PlayStation — в EmulatorJS (ejs.js, подгружается, только когда нужен).
;(async function () {
  'use strict'
  // Статичные надписи страницы — на языке окна
  for (const id of ['to-library', 'license', 'source', 'restart', 'net']) {
    const node = document.getElementById(id)
    if (node) node.textContent = T(node.textContent)
  }
  const params = new URLSearchParams(location.search)
  const id = params.get('game')
  const bookRef = params.get('book')
  const audioRef = params.get('audio') || (id && /^my-audio-[a-z0-9]{4,24}$/.test(id) ? id : null)
  const local = new URLSearchParams(location.hash.slice(1))
  const mineId = local.get('mine')
  // Переход на другую свою игру меняет только часть после # — страницу надо открыть заново
  window.addEventListener('hashchange', () => location.reload())

  const overlay = (title, hint) => {
    document.getElementById('overlay-title').textContent = title
    document.getElementById('overlay-hint').textContent = hint
    document.getElementById('overlay').classList.add('shown')
  }

  // Встроенный браузер Claude не даёт игре захватить мышь (pointer lock): шутер просит её по клику и остаётся без
  // мыши. Один раз подсказываем, как играть, — заметкой сверху: игра идёт дальше, клик по заметке её убирает
  const mouseNote = document.getElementById('mouse-note')
  let mouseNoted = false
  document.addEventListener('pointerlockerror', () => {
    if (!mouseNote || mouseNoted) return
    mouseNoted = true
    mouseNote.textContent = T('Этот браузер не даёт игре захватить мышь — поворачивай стрелками. С мышью игра идёт в обычном окне браузера.')
    mouseNote.classList.add('shown')
    mouseNote.addEventListener('click', () => mouseNote.classList.remove('shown'))
    setTimeout(() => mouseNote.classList.remove('shown'), 15000)
  })
  const loadEJS = () =>
    new Promise((resolve) => {
      if (window.ArcadeEJS) return resolve()
      const script = document.createElement('script')
      script.src = 'ejs.js'
      script.onload = resolve
      document.body.appendChild(script)
    })

  // Читалка книг и разбор EPUB, FB2, TXT
  const loadReader = async () => {
    for (const src of ['book-format.js', 'reader.js']) {
      await new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = src
        script.onload = resolve
        document.body.appendChild(script)
      })
    }
  }

  // Браузерная игра в рамке — на паузе, пока окно не в фокусе, как Денди: иначе она идёт в фоне со звуком (во
  // встроенном браузере Claude «крестик» только прячет панель, и страница теряет фокус). Своей паузы у этих игр нет,
  // поэтому останавливаем их изнутри рамки — страница наша, адрес тот же: у HexGL цикл кадров и таймер гонки, у сборок
  // Emscripten (OpenTTD) главный цикл; звук — их AudioContext. Возвращает «продолжить» или null, если нечего останавливать
  function freeze(w) {
    // Страница игры сама умеет останавливаться (Warzone 2100 — content/games/warzone2100/arcade-pause.js)
    if (typeof w.arcadePause === 'function') return w.arcadePause()
    const hex = w.hexGL
    if (hex && hex.gameplay) {
      const audio = w.bkcore && w.bkcore.Audio._ctx
      const running = hex.active // после финиша цикл уже стоит, на экране счёт — там только звук
      const since = Date.now()
      hex.active = false // цикл кадров HexGL сам не просит следующий кадр, когда игра неактивна
      if (audio) audio.suspend()
      return () => {
        if (audio) audio.resume()
        if (!running) return
        // Пауза не попадает во время круга, а первый кадр после неё — без скачка
        const gap = Date.now() - since
        const time = hex.gameplay.timer.time
        time.start += gap
        time.previous += gap
        hex.manager.time = w.perfNow()
        hex.active = true
        const raf = () => {
          if (hex.active) w.requestAnimationFrame(raf)
          hex.update()
        }
        raf()
      }
    }
    const m = w.Module
    if (!m || !m.calledRun) return null
    const audio = m.SDL2 && m.SDL2.audioContext
    if (m.pauseMainLoop && w.Browser && w.Browser.mainLoop.func) {
      m.pauseMainLoop()
      if (audio) audio.suspend()
      return () => {
        if (audio) audio.resume()
        m.resumeMainLoop()
      }
    }
    // У ScummVM главного цикла Emscripten нет (Asyncify), и resumeMainLoop падает — останавливаем только звук
    if (audio) {
      audio.suspend()
      return () => audio.resume()
    }
    return null
  }
  function pauseFrameWhenAway(frame) {
    let thaw = null
    let check = 0
    // Фокус ушёл внутрь рамки — это игра, а не уход из окна: проверяем, когда он уже перешёл. Останавливать пока
    // нечего (OpenTTD ещё грузит данные, HexGL в меню) — проверяем снова, пока окно не в фокусе
    const away = (ms = 0) => {
      clearTimeout(check)
      check = setTimeout(() => {
        if (thaw || document.hasFocus()) return
        try {
          thaw = freeze(frame.contentWindow)
        } catch {
          thaw = null // чужой адрес — не трогаем
        }
        if (thaw) overlay(T('Пауза'), T('Кликни или нажми любую клавишу, чтобы продолжить'))
        else away(1000)
      }, ms)
    }
    const back = (e) => {
      if (!thaw || (e && (e.ctrlKey || e.metaKey || e.altKey))) return
      // Клавиша только продолжает игру и в неё не попадает: Esc в HexGL начал бы гонку заново
      if (e) {
        e.preventDefault()
        e.stopPropagation()
      }
      document.getElementById('overlay').classList.remove('shown')
      const go = thaw
      thaw = null
      go()
      frame.focus()
    }
    window.addEventListener('blur', () => away())
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) away()
    })
    document.getElementById('overlay').addEventListener('click', () => back())
    window.addEventListener('keydown', back, true)
    frame.addEventListener('load', () => {
      try {
        frame.contentWindow.addEventListener('blur', () => away())
        frame.contentWindow.addEventListener('keydown', back, true)
        // SDL отменяет mousedown на холсте, и клик не переводит фокус в рамку: клавиши (F5 в ScummVM) уходили мимо игры
        frame.contentWindow.addEventListener('mousedown', () => frame.focus(), true)
      } catch {
        // чужой адрес — не трогаем
      }
      // Игру открыли, когда окно уже не в фокусе (в фоне, пока работал Claude)
      away()
    })
  }

  // Своя игра: Денди — в JSNES, книга — в читалку, остальное — в EmulatorJS
  async function play(entry) {
    if (entry.console === 'nes') return window.ArcadeGame.startLocal(new Uint8Array(await entry.file.arrayBuffer()), entry.title)
    if (entry.console === 'books') {
      await loadReader()
      // Скачанная книга из открытой библиотеки уже разобрана; свой файл — разбираем
      return entry.book ? window.ArcadeReader.startRef(entry.id) : window.ArcadeReader.startMine(entry)
    }
    await loadEJS()
    window.ArcadeEJS.startLocal(entry)
  }
  window.ArcadePlayMine = play

  // Мод просит свою игру, которой в этом браузере ещё нет: человек один раз выбирает файл, хеш сверяется
  function askForFile(consoleId, sha, title) {
    const input = document.getElementById('local-rom')
    input.accept = window.ArcadeMine.ACCEPT[consoleId] || ''
    overlay(T(`Выбери файл «${title}»`), T('Кликни сюда или нажми любую клавишу. Это нужно один раз: браузер запомнит файл у себя, на сервер он не уходит.'))
    const pick = () => input.click()
    document.getElementById('overlay').addEventListener('click', pick)
    window.addEventListener('keydown', pick, { once: true })
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0]
      input.value = ''
      if (!file) return
      try {
        const entry = await window.ArcadeMine.add(file, consoleId, sha)
        history.replaceState(null, '', `#mine=${encodeURIComponent(entry.id)}`)
        document.getElementById('overlay').classList.remove('shown')
        await play(entry)
      } catch (err) {
        overlay(T('Не получилось'), T(`${err.message} Кликни, чтобы выбрать другой файл.`))
      }
    })
  }

  let catalog
  try {
    const response = await fetch('catalog.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(T(`сервер ответил ${response.status}`))
    catalog = await response.json()
    if (window.ArcadeI18n && catalog && catalog.games) for (const game of Object.values(catalog.games)) game.title = window.ArcadeI18n.title(game)
  } catch (err) {
    overlay(T('Нет связи с Arcade'), T(`Не удалось получить список игр: ${err.message}`))
    return
  }

  if (mineId) {
    const entry = await window.ArcadeMine.get(mineId)
    if (entry) await play(entry)
    else if (local.get('console') && local.get('sha')) askForFile(local.get('console'), local.get('sha'), local.get('title') || T('свою игру'))
    else overlay(T('Игра не найдена'), T('В этом браузере её нет. Вернись в библиотеку и открой файл заново.'))
  } else if (bookRef) {
    // Книга открытой библиотеки: скачанная — из браузера, новая — скачать, собрать и положить в «Мои книги»
    await loadReader()
    window.ArcadeReader.startRef(bookRef)
  } else if (audioRef) {
    // Аудиокниги: LibriVox с archive.org и свои файлы (хранятся только в браузере)
    await new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'audio.js'
      script.onload = resolve
      document.body.appendChild(script)
    })
    window.ArcadeAudio.startRef(audioRef)
  } else if (id && catalog.games && catalog.games[id] && catalog.games[id].kind === 'web') {
    // Браузерная игра — своя страница в рамке под полосой окна
    const game = catalog.games[id]
    document.body.classList.remove('library-mode')
    document.title = `${game.title} · Arcade`
    document.getElementById('keys').textContent = T(game.keys)
    document.getElementById('credit').textContent = T(game.credit)
    const licenseFile = (game.license.files || []).find((f) => /^license/i.test(f.name))
    document.getElementById('license').href = licenseFile ? licenseFile.url : game.license.source
    document.getElementById('source').href = game.license.source
    for (const el of ['sound', 'restart', 'best', 'net']) {
      const node = document.getElementById(el)
      if (node) node.style.display = 'none'
    }
    const screen = document.getElementById('screen')
    if (screen) screen.style.display = 'none'
    document.getElementById('overlay').classList.remove('shown')
    const frame = document.createElement('iframe')
    frame.id = 'web-game'
    frame.src = game.page
    frame.title = game.title
    frame.allow = 'fullscreen; gamepad; autoplay'
    frame.style.cssText = 'width:100%;height:100%;border:0;display:block;background:#000'
    // Холст игры может не перестроиться при смене размера окна — фон под ним тёмный, а не белый
    frame.addEventListener('load', () => {
      try {
        frame.contentDocument.documentElement.style.background = '#000'
      } catch {
        // чужой адрес — не трогаем
      }
    })
    pauseFrameWhenAway(frame)
    ;(document.getElementById('stage') || document.body).appendChild(frame)
    frame.focus()
  } else if (id && catalog.games && catalog.games[id] && catalog.games[id].kind === 'pane') {
    // Своя игра (Flappy Arcade): тот же движок, что в панели мода, — на холсте окна, кадр 256×240 как у Денди
    const game = catalog.games[id]
    document.body.classList.remove('library-mode')
    document.title = `${game.title} · Arcade`
    document.getElementById('keys').textContent = T(game.keys)
    document.getElementById('credit').textContent = T('Flappy Arcade — своя игра Arcade')
    document.getElementById('license').href = 'https://github.com/ArbakovMaxim/agent-arcade/blob/main/LICENSE'
    document.getElementById('source').href = 'https://github.com/ArbakovMaxim/agent-arcade'
    for (const el of ['sound', 'restart', 'net']) {
      const node = document.getElementById(el)
      if (node) node.style.display = 'none'
    }
    document.getElementById('overlay').classList.remove('shown')
    await new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'flappy.js'
      script.onload = resolve
      document.body.appendChild(script)
    })
    const canvas = document.getElementById('screen')
    const context = canvas.getContext && canvas.getContext('2d')
    if (!context) return
    const image = context.createImageData(256, 240)
    const pixels = new Uint32Array(image.data.buffer)
    const status = document.getElementById('best')
    let best = 0
    try {
      best = Number(localStorage.getItem('arcade:flappy:best')) || 0
    } catch {
      // без хранилища — рекорд только до закрытия окна
    }
    const engine = window.ArcadeFlappy.createFlappy(
      (frame) => {
        for (let i = 0; i < frame.length; i++) pixels[i] = 0xff000000 | frame[i]
      },
      {
        best,
        onGameOver: (score, record) => {
          try {
            localStorage.setItem('arcade:flappy:best', String(record))
          } catch {
            // без хранилища
          }
        },
      },
    )
    const line = () =>
      engine.state === 'ready' ? T('Нажми пробел, ↑ или кликни — взлететь') : engine.state === 'over' ? T(`Удар! Счёт: ${engine.score} · рекорд: ${engine.best} — ещё раз: пробел`) : T(`Счёт: ${engine.score} · рекорд: ${engine.best}`)
    // Экран — в целое число раз, чтобы пиксели были одинаковыми
    const fit = () => {
      const stage = document.getElementById('stage') || document.body
      const scale = Math.max(1, Math.floor(Math.min(stage.clientWidth / 256, (stage.clientHeight - 40) / 240)))
      canvas.style.width = `${256 * scale}px`
      canvas.style.height = `${240 * scale}px`
    }
    fit()
    window.addEventListener('resize', fit)
    const FLAP_KEYS = new Set(['Space', 'ArrowUp', 'KeyW', 'Enter'])
    window.addEventListener('keydown', (e) => {
      if (!FLAP_KEYS.has(e.code)) return
      e.preventDefault()
      engine.buttonDown(1, e.code)
    })
    window.addEventListener('keyup', (e) => {
      if (FLAP_KEYS.has(e.code)) engine.buttonUp(1, e.code)
    })
    canvas.addEventListener('pointerdown', () => {
      engine.buttonDown(1, 'pointer')
      engine.buttonUp(1, 'pointer')
    })
    // 60 шагов в секунду; окно не в фокусе — пауза, как у Денди
    let last = performance.now()
    let behind = 0
    const tick = (now) => {
      if (document.hasFocus()) {
        behind = Math.min(behind + now - last, 200)
        while (behind >= 1000 / 60) {
          engine.frame()
          behind -= 1000 / 60
        }
        context.putImageData(image, 0, 0)
        if (status) status.textContent = line()
      }
      last = now
      requestAnimationFrame(tick)
    }
    engine.frame()
    context.putImageData(image, 0, 0)
    if (status) status.textContent = line()
    requestAnimationFrame(tick)
  } else if (id && catalog.games && catalog.games[id] && catalog.games[id].kind === 'board') {
    // Настольные игры по сети — правила и страница партии
    for (const src of ['board-rules.js', 'board.js', 'chess.js', 'go.js']) {
      await new Promise((resolve) => {
        const script = document.createElement('script')
        script.src = src
        script.onload = resolve
        document.body.appendChild(script)
      })
    }
    window.ArcadeBoard.start(catalog, id)
  } else if (id && catalog.games && catalog.games[id] && (catalog.games[id].net || (catalog.games[id].console === 'doom' && params.get('net') === 'coop'))) {
    // Сетевой Doom — своя страница с лобби (netdoom.js) и движок doom-wasm
    await new Promise((resolve) => {
      const script = document.createElement('script')
      script.src = 'netdoom.js'
      script.onload = resolve
      document.body.appendChild(script)
    })
    // Режим: FreeDM и BlasphDM — deathmatch; Blasphemer — одному, с ?net=coop — кооператив; Freedoom с ?net=coop — кооператив
    const g = catalog.games[id]
    const mode = g.net === 'doom' || g.net === 'heretic-dm' ? 'dm' : params.get('net') === 'coop' ? 'coop' : g.net === 'heretic' ? 'solo' : 'coop'
    window.ArcadeNetDoom.start(catalog, id, mode)
  } else if (id && catalog.games && catalog.games[id] && (['sega', 'sms', 'psx', 'doom'].includes(catalog.games[id].console) || (catalog.games[id].console === 'nes' && params.get('net') === '1'))) {
    // Денди с ?net=1 — сетевая игра на EmulatorJS (FCEUmm); без него — обычный JSNES
    await loadEJS()
    window.ArcadeEJS.start(catalog, id)
  } else if (id && id !== 'my-audio') window.ArcadeGame.start(catalog, id)
  else {
    // Старая карточка «Мои аудиокниги» — теперь раздел вкладки аудиокниг
    if (id === 'my-audio') history.replaceState(null, '', '?tab=audiobooks&section=mine')
    const tab = id === 'my-audio' ? 'audiobooks' : params.get('tab')
    window.ArcadeLibrary.start(catalog, tab, params.get('shelf'))
  }
})()
