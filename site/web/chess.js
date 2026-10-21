// Шахматы с компьютером: экран выбора (сила 1–10, цвет, таймер), партия с часами, запись ходов, PGN, «Вернуть ход»,
// «Подсказка», «Перевернуть доску». Компьютер — Stockfish 19 lite (GPL-3.0) в фоновом потоке браузера; если он не
// загрузился (старый браузер, нет WebAssembly), ходит прежний простой компьютер доски — партия не ломается.
;(() => {
  const T = (s) => (typeof window.T === 'function' ? window.T(s) : s) // перевод окна (i18n.js)
  // Сила 1–10 → уровень мастерства Stockfish (0–20), глубина и время на ход
  const LEVELS = [
    { skill: 0, depth: 1, ms: 80 },
    { skill: 2, depth: 2, ms: 120 },
    { skill: 4, depth: 3, ms: 160 },
    { skill: 6, depth: 4, ms: 220 },
    { skill: 8, depth: 6, ms: 300 },
    { skill: 10, depth: 8, ms: 400 },
    { skill: 13, depth: 10, ms: 600 },
    { skill: 16, depth: 12, ms: 800 },
    { skill: 19, depth: 16, ms: 1100 },
    { skill: 20, depth: 22, ms: 1500 },
  ]
  const TIMERS = [0, 3, 5, 10] // минуты; 0 — без таймера; плюс «свой»
  const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }
  const SETUP_KEY = 'arcade:chess:setup'

  function el(tag, style, text) {
    const node = document.createElement(tag)
    if (style) node.style.cssText = style
    if (text !== undefined) node.textContent = text
    return node
  }
  function button(label, onClick, active) {
    const b = el('button', `margin:4px;padding:8px 14px;border-radius:8px;border:1px solid ${active ? '#7fb2ff' : '#3a3a44'};background:${active ? '#24324a' : '#1c1c22'};color:#e6e6ea;cursor:pointer;font:inherit`, label)
    b.type = 'button'
    b.addEventListener('click', onClick)
    return b
  }
  const loadSetup = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SETUP_KEY))
      if (s && s.level >= 1 && s.level <= 10) return { level: s.level, color: ['w', 'b', 'random'].includes(s.color) ? s.color : 'w', minutes: Math.max(0, Math.min(180, Number(s.minutes) || 0)) }
    } catch {
      // без хранилища
    }
    return { level: 3, color: 'w', minutes: 0 }
  }
  const saveSetup = (s) => {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(s))
    } catch {
      // без хранилища
    }
  }
  const clock = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000))
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
  }

  // Stockfish в Worker по протоколу UCI: best(fen, level) → ход вида e2e4 или null
  function stockfish() {
    if (typeof Worker === 'undefined' || typeof WebAssembly === 'undefined') return null
    let worker
    try {
      worker = new Worker('vendor/stockfish/stockfish-19-lite-single.js')
    } catch {
      return null
    }
    let waiting = null
    let broken = false
    const finish = (move) => {
      const done = waiting
      waiting = null
      if (done) done(move)
    }
    worker.onmessage = (e) => {
      const line = String(e.data || '')
      if (line.startsWith('bestmove')) finish(line.split(' ')[1] || null)
    }
    worker.onerror = () => {
      broken = true
      finish(null)
    }
    worker.postMessage('uci')
    worker.postMessage('isready')
    return {
      get broken() {
        return broken
      },
      best(fen, level) {
        if (broken) return Promise.resolve(null)
        const L = LEVELS[level - 1]
        return new Promise((resolve) => {
          waiting = resolve
          worker.postMessage('stop')
          worker.postMessage(`setoption name Skill Level value ${L.skill}`)
          worker.postMessage(`position fen ${fen}`)
          worker.postMessage(`go depth ${L.depth} movetime ${L.ms}`)
          setTimeout(() => {
            if (waiting === resolve) finish(null)
          }, L.ms + 5000)
        })
      },
      stop() {
        worker.terminate()
      },
    }
  }

  async function start(game, id, root) {
    const Chess = (window.ArcadeChessLib && window.ArcadeChessLib.Chess) || (await import('./vendor/chess/chess.js')).Chess
    setupScreen(game, id, root, Chess, { bot: fallbackMove })
  }

  // Запасной компьютер (если Stockfish не загрузился): перебор на два хода по материалу, равные — случайно
  const VALUE = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 }
  function material(chess) {
    let sum = 0
    for (const row of chess.board()) for (const p of row) if (p) sum += (p.color === chess.turn() ? 1 : -1) * VALUE[p.type]
    return sum
  }
  function fallbackMove(chess) {
    let best = -Infinity
    let choices = []
    for (const m of chess.moves({ verbose: true })) {
      chess.move(m)
      let reply = chess.isCheckmate() ? -1000 : chess.isDraw() ? 0 : Infinity
      if (reply === Infinity) {
        reply = -Infinity
        for (const r of chess.moves({ verbose: true })) {
          chess.move(r)
          const v = chess.isCheckmate() ? 1000 : material(chess) * -1
          chess.undo()
          if (v > reply) reply = v
        }
      }
      chess.undo()
      const score = -reply
      if (score > best) {
        best = score
        choices = [m.san]
      } else if (score === best) choices.push(m.san)
    }
    return choices[Math.floor(Math.random() * choices.length)] ?? null
  }

  // Экран выбора: сила 1–10, цвет, таймер
  function setupScreen(game, id, root, Chess, rules) {
    root.replaceChildren()
    const setup = loadSetup()
    const draw = () => {
      root.replaceChildren()
      root.append(el('h2', 'margin:8px 0', `${game.title} · ${T('с компьютером')}`))
      const row = (label, children) => {
        const r = el('div', 'margin:10px 0')
        r.append(el('div', 'color:#9a9aa3;margin-bottom:4px', label), ...children)
        return r
      }
      const levels = []
      for (let l = 1; l <= 10; l++) {
        const b = button(String(l), () => {
          setup.level = l
          draw()
        }, setup.level === l)
        b.dataset.level = l
        b.className = 'chess-level'
        levels.push(b)
      }
      const levelHint = el('div', 'color:#9a9aa3;font-size:13px;margin-top:4px', T(setup.level <= 3 ? 'ошибается, как новичок' : setup.level <= 6 ? 'играет как любитель' : setup.level <= 8 ? 'сильный соперник' : 'играет сильнее почти любого человека'))
      const colors = [['w', T('белые')], ['b', T('чёрные')], ['random', T('случайно')]].map(([c, label]) => {
        const b = button(label, () => {
          setup.color = c
          draw()
        }, setup.color === c)
        b.dataset.color = c
        b.className = 'chess-color'
        return b
      })
      const timers = TIMERS.map((m) => {
        const b = button(m ? T(`${m} мин`) : T('без таймера'), () => {
          setup.minutes = m
          draw()
        }, setup.minutes === m)
        b.dataset.minutes = m
        b.className = 'chess-minutes'
        return b
      })
      const custom = el('input', 'width:64px;margin:4px;padding:7px;border-radius:8px;border:1px solid #3a3a44;background:#1c1c22;color:#e6e6ea')
      custom.type = 'number'
      custom.min = '1'
      custom.max = '180'
      custom.placeholder = T('свой')
      if (setup.minutes && !TIMERS.includes(setup.minutes)) custom.value = String(setup.minutes)
      custom.addEventListener('change', () => {
        const v = Math.round(Number(custom.value))
        if (v >= 1 && v <= 180) {
          setup.minutes = v
          draw()
        }
      })
      const startButton = button(T('Начать партию'), () => {
        saveSetup(setup)
        const color = setup.color === 'random' ? (Math.random() < 0.5 ? 'w' : 'b') : setup.color
        playGame(game, id, root, Chess, rules, { level: setup.level, color, minutes: setup.minutes })
      }, true)
      startButton.dataset.start = '1'
      startButton.className = 'chess-start'
      const back = el('a', 'display:inline-block;margin-top:14px;color:#7fb2ff', T('← Шахматы по сети и с другом'))
      back.href = `?game=${encodeURIComponent(id)}`
      root.append(
        row(T('Сила компьютера'), [...levels, levelHint]),
        row(T('Цвет'), colors),
        row(T('Таймер на партию'), [...timers, custom, el('span', 'color:#9a9aa3', T('мин'))]),
        startButton,
        el('br'),
        back,
      )
    }
    draw()
  }

  // Партия с компьютером
  function playGame(game, id, root, Chess, rules, options) {
    root.replaceChildren()
    const chess = new Chess()
    const me = options.color
    const engine = stockfish()
    let flipped = me === 'b'
    let selected = null
    let hint = null
    let thinking = false
    let over = null // { text } — партия закончилась
    const timed = options.minutes > 0
    const left = { w: options.minutes * 60000, b: options.minutes * 60000 }
    let turnStarted = Date.now()

    const title = el('h2', 'margin:8px 0', `${game.title} · ${T('с компьютером')} · ${T(`сила ${options.level}`)}`)
    const status = el('p', 'min-height:1.4em;color:#e0c070', '')
    const top = el('div', 'font:600 18px ui-monospace,monospace;margin:6px 0;color:#c9c9cf', '')
    const bottom = el('div', 'font:600 18px ui-monospace,monospace;margin:6px 0;color:#c9c9cf', '')
    const grid = el('div', 'display:grid;grid-template-columns:repeat(8,1fr);width:min(92vw,62vh,480px);border:2px solid #3a3a44')
    const moves = el('div', 'min-width:180px;max-width:260px;max-height:62vh;overflow:auto;font:14px ui-monospace,monospace;line-height:1.6;color:#c9c9cf;padding:6px 10px;border:1px solid #3a3a44;border-radius:8px')
    moves.className = 'chess-moves'
    const tools = el('div', 'margin-top:10px')
    const boardBox = el('div')
    boardBox.append(top, grid, bottom)
    const layout = el('div', 'display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap')
    layout.append(boardBox, moves)
    root.append(title, status, layout, tools)

    const now = () => Date.now()
    const spend = () => {
      if (!timed || over) return
      const t = now()
      left[chess.turn()] -= t - turnStarted
      turnStarted = t
      if (left[chess.turn()] <= 0) {
        left[chess.turn()] = 0
        over = { text: chess.turn() === me ? T('Время вышло — поражение') : T('У компьютера вышло время — победа!') }
      }
    }
    const finishIfOver = () => {
      if (over || !chess.isGameOver()) return
      if (chess.isCheckmate()) over = { text: chess.turn() === me ? T('Мат — поражение') : T('Мат — победа!') }
      else over = { text: T('Ничья') }
    }
    const toSquare = (r, c) => 'abcdefgh'[c] + (8 - r)

    function render() {
      grid.replaceChildren()
      const board = chess.board()
      const targets = selected ? chess.moves({ square: selected, verbose: true }).map((m) => m.to) : []
      const last = chess.history({ verbose: true }).slice(-1)[0]
      for (let i = 0; i < 64; i++) {
        const r = flipped ? 7 - Math.floor(i / 8) : Math.floor(i / 8)
        const c = flipped ? 7 - (i % 8) : i % 8
        const sq = toSquare(r, c)
        const dark = (r + c) % 2 === 1
        const lastMove = last && (last.from === sq || last.to === sq)
        const hinted = hint && (hint.from === sq || hint.to === sq)
        const bg = selected === sq ? '#6d6a2c' : targets.includes(sq) ? '#2f6d3b' : hinted ? '#2c5b8a' : lastMove ? (dark ? '#8a7a3a' : '#cdbf6e') : dark ? '#6b4f36' : '#d8c3a0'
        const cell = el('button', `aspect-ratio:1;border:0;margin:0;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${bg};font-size:min(8vw,5.4vh,46px);line-height:1`)
        cell.type = 'button'
        cell.dataset.square = sq
        const p = board[r][c]
        if (p) {
          const s = el('span', `color:${p.color === 'w' ? '#fafafa' : '#141414'};text-shadow:${p.color === 'w' ? '0 0 2px #000,0 0 1px #000' : '0 0 2px #fff6'}`, GLYPH[p.type])
          cell.append(s)
        }
        cell.addEventListener('click', () => click(sq))
        grid.append(cell)
      }
      // Запись ходов: «1. e4 e5 2. Nf3 …»
      const history = chess.history()
      moves.replaceChildren()
      for (let i = 0; i < history.length; i += 2) {
        const line = el('div', '', `${i / 2 + 1}. ${history[i]}${history[i + 1] ? ` ${history[i + 1]}` : ''}`)
        moves.append(line)
      }
      if (!history.length) moves.append(el('div', 'color:#6f6f78', T('ходов пока нет')))
      moves.scrollTop = moves.scrollHeight
      // Часы: сверху — соперник, снизу — тот, чья сторона внизу доски
      const downSide = flipped ? 'b' : 'w'
      const upSide = downSide === 'w' ? 'b' : 'w'
      const name = (side) => (side === me ? T('Ты') : T(`Компьютер · сила ${options.level}`))
      top.textContent = `${name(upSide)}${timed ? ` · ${clock(left[upSide])}` : ''}`
      bottom.textContent = `${name(downSide)}${timed ? ` · ${clock(left[downSide])}` : ''}`
      // Состояние и кнопки
      if (over) status.textContent = over.text
      else if (thinking) status.textContent = T('Компьютер думает…')
      else status.textContent = `${T('Твой ход')}${chess.inCheck() ? ` · ${T('шах')}` : ''}`
      tools.replaceChildren()
      if (!over) {
        tools.append(
          button(T('Вернуть ход'), undo),
          button(T('Подсказка'), giveHint),
          button(T('Сдаться'), () => {
            over = { text: T('Ты сдался — поражение') }
            render()
          }),
        )
      } else tools.append(button(T('Новая партия'), () => setupScreen(game, id, root, Chess, rules), true))
      tools.append(
        button(T('Перевернуть доску'), () => {
          flipped = !flipped
          render()
        }),
        button(T('Скопировать партию (PGN)'), copyPgn),
      )
    }

    function click(sq) {
      if (over || thinking || chess.turn() !== me) return
      const piece = chess.get(sq)
      if (piece && piece.color === me) {
        selected = sq
        return render()
      }
      if (!selected) return
      const move = chess.moves({ square: selected, verbose: true }).find((m) => m.to === sq && (!m.promotion || m.promotion === 'q'))
      selected = null
      if (!move) return render()
      spend()
      if (over) return render()
      chess.move(move)
      hint = null
      finishIfOver()
      render()
      if (!over) reply()
    }

    async function reply() {
      thinking = true
      render()
      const fen = chess.fen()
      let uci = engine ? await engine.best(fen, options.level) : null
      if (chess.fen() !== fen || over) return // пока думал — вернули ход или партия кончилась
      let made = null
      if (uci) {
        try {
          made = chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] || 'q' })
        } catch {
          made = null
        }
      }
      if (!made) {
        // запасной: прежний простой компьютер доски
        const san = rules.bot(chess)
        if (san) chess.move(san)
      }
      thinking = false
      spend()
      finishIfOver()
      render()
    }

    function undo() {
      if (thinking || over) return
      const history = chess.history()
      if (!history.length) return
      chess.undo() // ход компьютера
      if (chess.turn() !== me && chess.history().length) chess.undo() // и свой
      else if (chess.turn() !== me) {
        render()
        return reply() // компьютер ходил первым — пусть сходит снова
      }
      hint = null
      selected = null
      turnStarted = now()
      render()
    }

    async function giveHint() {
      if (thinking || over || chess.turn() !== me) return
      const uci = engine ? await engine.best(chess.fen(), 10) : null
      if (uci) hint = { from: uci.slice(0, 2), to: uci.slice(2, 4) }
      else {
        const san = rules.bot(chess)
        const m = san && chess.moves({ verbose: true }).find((x) => x.san === san)
        hint = m ? { from: m.from, to: m.to } : null
      }
      render()
    }

    async function copyPgn() {
      const headers = { Event: 'Arcade', Site: location.origin, Date: new Date().toISOString().slice(0, 10).replace(/-/g, '.'), White: me === 'w' ? 'Player' : `Stockfish level ${options.level}`, Black: me === 'b' ? 'Player' : `Stockfish level ${options.level}`, TimeControl: timed ? String(options.minutes * 60) : '-' }
      for (const [k, v] of Object.entries(headers)) if (chess.setHeader) chess.setHeader(k, v)
      const pgn = chess.pgn()
      try {
        await navigator.clipboard.writeText(pgn)
        status.textContent = T('Партия скопирована в PGN')
      } catch {
        prompt('PGN', pgn)
      }
    }

    // Часы идут по-настоящему: раз в 200 мс
    if (timed) {
      setInterval(() => {
        if (over) return
        spend()
        render()
      }, 200)
    }
    render()
    if (me === 'b') reply() // компьютер играет белыми — его ход первый
    window.ArcadeChess.game = { chess, click, undo, giveHint, copyPgn, get over() { return over }, get thinking() { return thinking }, options }
  }

  window.ArcadeChess = { start, LEVELS }
})()
