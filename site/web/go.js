// Го: правила (взятие, запрет самоубийства, ко, пас, подсчёт по территории с коми), компьютер (Монте-Карло, сила 1–5),
// партия с компьютером, по сети («Найти игрока» среди тех, кто выбрал ту же доску) и с другом по ссылке. Сетевая партия
// идёт через ту же комнату, что шахматы: ход — строка «x,y» или «pass», сервер следит за очерёдностью.
;(() => {
  const T = (s) => (typeof window.T === 'function' ? window.T(s) : s)
  const SIZES = [9, 13, 19]
  const KOMI = { 9: 7, 13: 7, 19: 7.5 }
  const LEVEL_MS = [120, 350, 800, 1400, 2200] // сила 1–5: сколько компьютер думает над ходом
  const BLACK = 1
  const WHITE = 2
  const SETUP_KEY = 'arcade:go:setup'

  // --- Правила ---------------------------------------------------------------------------------------------------
  function neighborsOf(n) {
    const list = []
    for (let i = 0; i < n * n; i++) {
      const x = i % n
      const y = Math.floor(i / n)
      const near = []
      if (x > 0) near.push(i - 1)
      if (x < n - 1) near.push(i + 1)
      if (y > 0) near.push(i - n)
      if (y < n - 1) near.push(i + n)
      list.push(near)
    }
    return list
  }

  // Группа камня и её дыхания
  function groupAt(board, near, start) {
    const color = board[start]
    const stones = [start]
    const seen = new Set(stones)
    let liberties = 0
    const libs = new Set()
    for (let k = 0; k < stones.length; k++) {
      for (const j of near[stones[k]]) {
        if (board[j] === 0) {
          if (!libs.has(j)) {
            libs.add(j)
            liberties++
          }
        } else if (board[j] === color && !seen.has(j)) {
          seen.add(j)
          stones.push(j)
        }
      }
    }
    return { stones, liberties }
  }

  function createGo(size, komi = KOMI[size] ?? 7) {
    const n = size
    const near = neighborsOf(n)
    let board = new Int8Array(n * n)
    let turn = BLACK
    let passes = 0
    let previous = '' // позиция до последнего хода — для ко
    const captured = { [BLACK]: 0, [WHITE]: 0 }
    const history = [] // для «Вернуть ход»
    let lastMove = null
    let over = false

    const key = (b) => b.join('')
    const snapshot = () => ({ board: board.slice(), turn, passes, previous, captured: { ...captured }, lastMove, over })
    const restore = (s) => {
      board = s.board
      turn = s.turn
      passes = s.passes
      previous = s.previous
      captured[BLACK] = s.captured[BLACK]
      captured[WHITE] = s.captured[WHITE]
      lastMove = s.lastMove
      over = s.over
    }

    // Ход в пункт i: false, если нельзя (занято, самоубийство, ко)
    function play(i) {
      if (over || board[i] !== 0) return false
      const before = snapshot()
      const color = turn
      const enemy = 3 - color
      const next = board.slice()
      next[i] = color
      let took = 0
      for (const j of near[i]) {
        if (next[j] === enemy) {
          const g = groupAt(next, near, j)
          if (g.liberties === 0) {
            for (const s of g.stones) next[s] = 0
            took += g.stones.length
          }
        }
      }
      if (groupAt(next, near, i).liberties === 0) return false // самоубийство
      if (key(next) === previous) return false // ко: нельзя сразу вернуть позицию
      history.push(before)
      previous = key(board)
      board = next
      captured[color] += took
      turn = enemy
      passes = 0
      lastMove = i
      return true
    }

    function pass() {
      if (over) return false
      history.push(snapshot())
      previous = key(board)
      passes++
      turn = 3 - turn
      lastMove = 'pass'
      if (passes >= 2) over = true
      return true
    }

    // Подсчёт по территории: камни + пустые пункты, окружённые только своими; у белых коми
    function score() {
      let black = 0
      let white = komi
      const seen = new Uint8Array(n * n)
      for (let i = 0; i < n * n; i++) {
        if (board[i] === BLACK) black++
        else if (board[i] === WHITE) white++
        else if (!seen[i]) {
          const region = [i]
          seen[i] = 1
          let touches = 0
          for (let k = 0; k < region.length; k++) {
            for (const j of near[region[k]]) {
              if (board[j] === 0 && !seen[j]) {
                seen[j] = 1
                region.push(j)
              } else if (board[j] !== 0) touches |= board[j]
            }
          }
          if (touches === BLACK) black += region.length
          else if (touches === WHITE) white += region.length
        }
      }
      return { black, white, winner: black > white ? BLACK : WHITE }
    }

    // Ход строкой (для сети): «x,y» или «pass»
    function apply(move) {
      if (move === 'pass') return pass()
      const m = /^(\d{1,2}),(\d{1,2})$/.exec(String(move))
      if (!m) return false
      const x = Number(m[1])
      const y = Number(m[2])
      if (x >= n || y >= n) return false
      return play(y * n + x)
    }

    return {
      size: n,
      komi,
      near,
      play,
      pass,
      apply,
      score,
      undo() {
        if (!history.length) return false
        restore(history.pop())
        return true
      },
      get board() {
        return board
      },
      get turn() {
        return turn
      },
      get over() {
        return over
      },
      get captured() {
        return captured
      },
      get lastMove() {
        return lastMove
      },
      get moves() {
        return history.length
      },
      resign() {
        over = true
      },
    }
  }

  // --- Компьютер: Монте-Карло ------------------------------------------------------------------------------------
  // Свой глаз: все соседи — свои камни. Туда в доигрываниях не ходим — иначе группы сами себя убивают
  function ownEye(board, near, i, color) {
    return near[i].every((j) => board[j] === color)
  }

  // Быстрое случайное доигрывание до конца; ко не проверяем — приближение
  function playout(go, startBoard, startTurn) {
    const n = go.size
    const near = go.near
    const board = startBoard.slice()
    let turn = startTurn
    let passes = 0
    const empties = []
    for (let i = 0; i < n * n; i++) if (board[i] === 0) empties.push(i)
    for (let moves = 0; passes < 2 && moves < n * n * 3; moves++) {
      let played = false
      for (let tries = 0; tries < empties.length; tries++) {
        const k = Math.floor(Math.random() * empties.length)
        const i = empties[k]
        if (board[i] !== 0) {
          empties[k] = empties[empties.length - 1]
          empties.pop()
          tries--
          continue
        }
        if (ownEye(board, near, i, turn)) continue
        board[i] = turn
        const enemy = 3 - turn
        let took = false
        for (const j of near[i]) {
          if (board[j] === enemy) {
            const g = groupAt(board, near, j)
            if (g.liberties === 0) {
              for (const s of g.stones) {
                board[s] = 0
                empties.push(s)
              }
              took = true
            }
          }
        }
        if (!took && groupAt(board, near, i).liberties === 0) {
          board[i] = 0 // самоубийство — не ход
          continue
        }
        played = true
        break
      }
      passes = played ? 0 : passes + 1
      turn = 3 - turn
    }
    // Подсчёт: камни + пункты, окружённые только одним цветом
    let black = 0
    let white = go.komi
    for (let i = 0; i < n * n; i++) {
      if (board[i] === BLACK) black++
      else if (board[i] === WHITE) white++
      else {
        let touches = 0
        for (const j of near[i]) touches |= board[j]
        if (touches === BLACK) black++
        else if (touches === WHITE) white++
      }
    }
    return black > white ? BLACK : WHITE
  }

  // Лучший ход за отведённое время; думает кусками по 25 мс, чтобы страница не замирала
  async function bestMove(go, level) {
    const color = go.turn
    const n = go.size
    const candidates = []
    for (let i = 0; i < n * n; i++) {
      if (go.board[i] !== 0 || ownEye(go.board, go.near, i, color)) continue
      const trial = go.board.slice()
      trial[i] = color
      // ход должен быть законным: не самоубийство (взятия проверит play)
      let took = false
      for (const j of go.near[i]) if (trial[j] === 3 - color && groupAt(trial, go.near, j).liberties === 0) took = true
      if (!took && groupAt(trial, go.near, i).liberties === 0) continue
      candidates.push(i)
    }
    if (!candidates.length) return 'pass'
    // на больших досках — не больше 90 кандидатов: рядом с камнями и немного случайных
    let pool = candidates
    if (pool.length > 90) {
      const nearStones = pool.filter((i) => go.near[i].some((j) => go.board[j] !== 0))
      pool = [...nearStones.sort(() => Math.random() - 0.5).slice(0, 70), ...pool.sort(() => Math.random() - 0.5).slice(0, 20)]
    }
    const wins = new Float64Array(pool.length)
    const runs = new Float64Array(pool.length)
    const budget = LEVEL_MS[Math.max(0, Math.min(4, level - 1))]
    const started = Date.now()
    let k = 0
    while (Date.now() - started < budget) {
      const chunk = Date.now()
      while (Date.now() - chunk < 25 && Date.now() - started < budget) {
        const idx = k++ % pool.length
        const i = pool[idx]
        const board = go.board.slice()
        board[i] = color
        for (const j of go.near[i]) if (board[j] === 3 - color) {
          const g = groupAt(board, go.near, j)
          if (g.liberties === 0) for (const s of g.stones) board[s] = 0
        }
        runs[idx]++
        if (playout(go, board, 3 - color) === color) wins[idx]++
      }
      await new Promise((r) => setTimeout(r, 0))
    }
    let best = -1
    let bestRate = -1
    for (let idx = 0; idx < pool.length; idx++) {
      const rate = runs[idx] ? wins[idx] / runs[idx] : 0
      if (rate > bestRate) {
        bestRate = rate
        best = idx
      }
    }
    if (bestRate < 0.08 && go.moves > n * 2) return 'pass' // всё проиграно или делить нечего — пас
    const i = pool[best]
    return `${i % n},${Math.floor(i / n)}`
  }

  // --- Страница --------------------------------------------------------------------------------------------------
  function el(tag, style, text) {
    const node = document.createElement(tag)
    if (style) node.style.cssText = style
    if (text !== undefined) node.textContent = text
    return node
  }
  function button(label, onClick, active, cls) {
    const b = el('button', `margin:4px;padding:8px 14px;border-radius:8px;border:1px solid ${active ? '#7fb2ff' : '#3a3a44'};background:${active ? '#24324a' : '#1c1c22'};color:#e6e6ea;cursor:pointer;font:inherit`, label)
    b.type = 'button'
    if (cls) b.className = cls
    b.addEventListener('click', onClick)
    return b
  }
  const loadSetup = () => {
    try {
      const s = JSON.parse(localStorage.getItem(SETUP_KEY))
      if (s && SIZES.includes(s.size)) return { size: s.size, level: s.level >= 1 && s.level <= 5 ? s.level : 2, color: [BLACK, WHITE, 0].includes(s.color) ? s.color : BLACK, mode: ['bot', 'net', 'friend'].includes(s.mode) ? s.mode : 'bot' }
    } catch {
      // без хранилища
    }
    return { size: 9, level: 2, color: BLACK, mode: 'bot' }
  }
  const saveSetup = (s) => {
    try {
      localStorage.setItem(SETUP_KEY, JSON.stringify(s))
    } catch {
      // без хранилища
    }
  }

  function start(game, id, root) {
    const params = new URLSearchParams(location.search)
    const code = params.get('room')
    const size = SIZES.includes(Number(params.get('size'))) ? Number(params.get('size')) : null
    if (code && /^[a-z0-9]{6,16}$/.test(code)) return playNet(game, id, root, code, size)
    setupScreen(game, id, root)
  }

  // Экран выбора: режим, доска, сила и цвет (с компьютером); «Найти игрока» — среди выбравших ту же доску
  function setupScreen(game, id, root) {
    const setup = loadSetup()
    let waiting = {}
    const draw = () => {
      root.replaceChildren()
      root.append(el('h2', 'margin:8px 0', game.title), el('p', 'color:#9a9aa3;max-width:640px', window.ArcadeI18n ? window.ArcadeI18n.about(game) : game.about))
      const row = (label, children) => {
        const r = el('div', 'margin:10px 0')
        r.append(el('div', 'color:#9a9aa3;margin-bottom:4px', label), ...children)
        return r
      }
      const modes = [['bot', T('С компьютером')], ['net', T('По сети')], ['friend', T('С другом')]].map(([m, label]) => button(label, () => {
        setup.mode = m
        draw()
      }, setup.mode === m, 'go-mode'))
      const sizes = SIZES.map((s) => {
        const count = waiting[`go-${s}`] || 0
        const b = button(`${s}×${s}${setup.mode === 'net' && count ? ` · ${T(`ждут: ${count}`)}` : ''}`, () => {
          setup.size = s
          draw()
        }, setup.size === s, 'go-size')
        b.dataset.size = s
        return b
      })
      root.append(row(T('Партия'), modes), row(T('Доска'), sizes))
      if (setup.mode === 'bot') {
        const levels = [1, 2, 3, 4, 5].map((l) => {
          const b = button(String(l), () => {
            setup.level = l
            draw()
          }, setup.level === l, 'go-level')
          b.dataset.level = l
          return b
        })
        const colors = [[BLACK, T('чёрные (ходят первыми)')], [WHITE, T('белые')], [0, T('случайно')]].map(([c, label]) => button(label, () => {
          setup.color = c
          draw()
        }, setup.color === c, 'go-color'))
        root.append(row(T('Сила компьютера'), levels), row(T('Цвет'), colors))
      }
      const go = button(setup.mode === 'bot' ? T('Начать партию') : setup.mode === 'net' ? T('Найти игрока') : T('Пригласить друга'), () => {
        saveSetup(setup)
        if (setup.mode === 'bot') return playBot(game, id, root, setup)
        if (setup.mode === 'friend') return (location.search = `?game=${encodeURIComponent(id)}&room=${window.ArcadeBoard.randomCode()}&size=${setup.size}`)
        status.textContent = T('Ищу соперника…')
        window.ArcadeBoard.seek(`${id}-${setup.size}`, status, (c) => (location.search = `?game=${encodeURIComponent(id)}&room=${c}&size=${setup.size}`))
      }, true, 'go-start')
      const status = el('p', 'min-height:1.4em;color:#e0c070', '')
      root.append(go, status)
    }
    draw()
    // Кто какую доску ждёт — раз в 15 секунд
    const poll = async () => {
      try {
        const r = await fetch('/api/lobbies')
        const data = await r.json()
        waiting = (data && data.board) || {}
        if (setup.mode === 'net') draw()
      } catch {
        // без сети — без счётчиков
      }
    }
    poll()
    setInterval(poll, 15000)
  }

  // Доска: пересечения линий, камни, последний ход, звёздные пункты
  function drawBoard(grid, go, onClick, hintTerritory) {
    const n = go.size
    grid.replaceChildren()
    grid.style.cssText = `display:grid;grid-template-columns:repeat(${n},1fr);width:min(92vw,66vh,560px);aspect-ratio:1;background:#d9b26a;border:2px solid #8a6a32;border-radius:4px;padding:2px`
    const stars = n === 9 ? [20, 24, 40, 56, 60] : n === 13 ? [42, 48, 84, 120, 126] : [60, 66, 72, 174, 180, 186, 288, 294, 300]
    for (let i = 0; i < n * n; i++) {
      const x = i % n
      const y = Math.floor(i / n)
      const cell = el('button', 'position:relative;border:0;margin:0;padding:0;background:transparent;cursor:pointer')
      cell.type = 'button'
      cell.className = 'go-point'
      cell.dataset.point = `${x},${y}`
      const lineH = `linear-gradient(#5a4320,#5a4320) ${x === 0 ? '50%' : '0'} 50% / ${x === 0 || x === n - 1 ? '50%' : '100%'} 1px no-repeat`
      const lineV = `linear-gradient(#5a4320,#5a4320) 50% ${y === 0 ? '50%' : '0'} / 1px ${y === 0 || y === n - 1 ? '50%' : '100%'} no-repeat`
      cell.style.background = `${lineH},${lineV}`
      if (stars.includes(i) && go.board[i] === 0) cell.append(el('span', 'position:absolute;left:50%;top:50%;width:18%;height:18%;transform:translate(-50%,-50%);border-radius:50%;background:#5a4320'))
      if (go.board[i]) {
        const black = go.board[i] === BLACK
        const stone = el('span', `position:absolute;left:6%;top:6%;width:88%;height:88%;border-radius:50%;background:${black ? 'radial-gradient(circle at 35% 35%,#555,#111)' : 'radial-gradient(circle at 35% 35%,#fff,#cfcfcf)'};box-shadow:0 1px 2px #0006`)
        if (go.lastMove === i) stone.append(el('span', `position:absolute;left:50%;top:50%;width:30%;height:30%;transform:translate(-50%,-50%);border-radius:50%;border:2px solid ${black ? '#fff' : '#111'}`))
        cell.append(stone)
      } else if (hintTerritory) {
        // в конце партии — чья территория
        let touches = 0
        for (const j of go.near[i]) touches |= go.board[j]
        if (touches === BLACK || touches === WHITE) cell.append(el('span', `position:absolute;left:38%;top:38%;width:24%;height:24%;background:${touches === BLACK ? '#111' : '#fff'};opacity:.6`))
      }
      cell.addEventListener('click', () => onClick(i))
      grid.append(cell)
    }
  }

  const sideName = (c) => (c === BLACK ? T('чёрные') : T('белые'))
  function resultText(go, me) {
    const s = go.score()
    const line = `${T('Чёрные')} ${s.black} · ${T('белые')} ${s.white} (${T('с коми')} ${go.komi})`
    return `${s.winner === me ? T('Победа!') : me ? T('Поражение') : T(`Победили ${sideName(s.winner)}`)} · ${line}`
  }

  // Партия с компьютером
  function playBot(game, id, root, setup) {
    const go = createGo(setup.size)
    const me = setup.color || (Math.random() < 0.5 ? BLACK : WHITE)
    let thinking = false
    let over = null
    root.replaceChildren()
    const title = el('h2', 'margin:8px 0', `${game.title} · ${setup.size}×${setup.size} · ${T(`сила ${setup.level}`)}`)
    const status = el('p', 'min-height:1.4em;color:#e0c070', '')
    const grid = el('div')
    const info = el('p', 'color:#9a9aa3', '')
    const tools = el('div', 'margin-top:10px')
    root.append(title, status, grid, info, tools)
    const render = () => {
      drawBoard(grid, go, click, Boolean(over))
      status.textContent = over ? over : thinking ? T('Компьютер думает…') : go.turn === me ? `${T('Твой ход')} (${sideName(me)})` : ''
      info.textContent = `${T('Взято камней')}: ${T('чёрные')} ${go.captured[BLACK]} · ${T('белые')} ${go.captured[WHITE]}${go.lastMove === 'pass' ? ` · ${T('последний ход — пас')}` : ''}`
      tools.replaceChildren()
      if (!over) {
        tools.append(
          button(T('Пас'), () => {
            if (thinking || go.turn !== me) return
            go.pass()
            after()
          }),
          button(T('Вернуть ход'), () => {
            if (thinking) return
            go.undo()
            if (go.turn !== me) go.undo()
            render()
          }),
          button(T('Сдаться'), () => {
            go.resign()
            over = T('Ты сдался — поражение')
            render()
          }),
        )
      } else tools.append(button(T('Новая партия'), () => setupScreen(game, id, root), true))
    }
    const after = () => {
      if (go.over && !over) over = resultText(go, me)
      render()
      if (!over && go.turn !== me) reply()
    }
    const click = (i) => {
      if (over || thinking || go.turn !== me) return
      if (go.play(i)) after()
    }
    const reply = async () => {
      thinking = true
      render()
      const move = await bestMove(go, setup.level)
      thinking = false
      if (!go.apply(move)) go.pass()
      after()
    }
    render()
    if (me !== BLACK) reply()
    window.ArcadeGo.game = { go, click, get over() { return over }, get thinking() { return thinking }, me }
  }

  // Партия по сети и с другом: та же комната, что у шахмат; сторона 0 — чёрные
  function playNet(game, id, root, code, size) {
    const B = window.ArcadeBoard
    B.remember(code, id)
    let go = createGo(size || 9)
    let seat = -1
    let seats = 0
    let names = []
    let moves = []
    let result = null // кто-то сдался: { loser, reason: 'resign' } от сервера
    let variant = size ? String(size) : ''
    root.replaceChildren()
    const title = el('h2', 'margin:8px 0', game.title)
    const status = el('p', 'min-height:1.4em;color:#e0c070', T('Подключаюсь к партии…'))
    const grid = el('div')
    const who = el('p', 'margin:8px 0 0;color:#9a9aa3', '')
    const info = el('p', 'color:#9a9aa3', '')
    const tools = el('div', 'margin-top:10px')
    root.append(title, status, grid, who, info, tools)
    const link = `${location.origin}${location.pathname}?game=${encodeURIComponent(id)}&room=${code}${size ? `&size=${size}` : ''}`
    const ws = new WebSocket(B.wsUrl(`/net/board/${code}`))
    ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'hello', token: B.tokenFor(code), game: id, variant, ...B.named() })))
    ws.addEventListener('close', () => {
      status.textContent = T('Связь с партией прервалась — открой ссылку ещё раз, ходы сохранены')
    })
    const replay = () => {
      const s = Number(variant)
      go = createGo(SIZES.includes(s) ? s : 9)
      for (const m of moves) if (!go.apply(m)) break
    }
    ws.addEventListener('message', (e) => {
      let m
      try {
        m = JSON.parse(e.data)
      } catch {
        return
      }
      if (m.type === 'state') {
        seat = m.seat
        seats = m.seats
        names = m.names || []
        if (m.variant) variant = String(m.variant)
        result = m.result || null
        moves = Array.isArray(m.moves) ? m.moves : []
        replay()
      } else if (m.type === 'move' && m.ply === moves.length) {
        moves.push(m.move)
        go.apply(m.move)
      } else if (m.type === 'seats') {
        seats = m.seats
        names = m.names || []
      }
      render()
    })
    const mine = () => (seat === 0 ? BLACK : seat === 1 ? WHITE : 0)
    const send = (move) => ws.send(JSON.stringify({ type: 'move', ply: moves.length, move }))
    const click = (i) => {
      if (seats < 2 || seat < 0 || go.over || result || go.turn !== mine()) return
      // проверяем ход у себя: законный — отправляем
      const probe = createGo(go.size)
      for (const mv of moves) probe.apply(mv)
      if (probe.play(i)) send(`${i % go.size},${Math.floor(i / go.size)}`)
    }
    function render() {
      title.textContent = `${game.title} · ${go.size}×${go.size}`
      drawBoard(grid, go, click, go.over)
      const me = mine()
      if (result) status.textContent = B.resignText(result, seat)
      else if (go.over) status.textContent = resultText(go, me)
      else if (seats < 2) status.textContent = T('Ждём соперника — отправь ему ссылку на эту партию')
      else if (seat < 0) status.textContent = T('Ты смотришь партию: в ней уже двое')
      else if (go.turn === me) status.textContent = `${T('Твой ход')} (${sideName(me)})`
      else status.textContent = T('Ход соперника — можно вернуться к агенту, партия сохранится')
      who.textContent = B.players([T('чёрные'), T('белые')], names)
      info.textContent = `${T('Взято камней')}: ${T('чёрные')} ${go.captured[BLACK]} · ${T('белые')} ${go.captured[WHITE]}${go.lastMove === 'pass' ? ` · ${T('последний ход — пас')}` : ''}`
      tools.replaceChildren()
      const over = go.over || Boolean(result)
      if (!over && seat >= 0 && seats >= 2 && go.turn === me) tools.append(button(T('Пас'), () => send('pass')))
      if (!over && seat >= 0 && seats >= 2) tools.append(button(T('Сдаться'), () => ws.send(JSON.stringify({ type: 'resign' })), false, 'go-resign'))
      if (over && seat >= 0) tools.append(button(T('Новая партия'), () => ws.send(JSON.stringify({ type: 'reset' }))))
      tools.append(
        button(T('Скопировать ссылку на партию'), async () => {
          try {
            await navigator.clipboard.writeText(link)
          } catch {
            prompt(T('Ссылка на партию'), link)
          }
        }),
      )
    }
    render()
    window.ArcadeGo.game = { get go() { return go }, click, get seat() { return seat }, ws }
  }

  window.ArcadeGo = { start, createGo, bestMove, BLACK, WHITE }
})()
