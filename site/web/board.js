// Настольные игры по сети: шахматы (chess.js, BSD-2-Clause), русские шашки и реверси (board-rules.js).
// Без ?room — меню: «С компьютером», «Найти соперника» (лобби, ведущий сводит двоих), «Пригласить друга», «Мои партии».
// С ?room=<код> — партия по сети: ходы хранятся на сервере (/net/board/<код>), можно закрыть окно и вернуться по ссылке.
// С ?vs=bot — партия с ботом прямо в браузере; ходы запоминаются в localStorage, к партии можно вернуться.
;(function () {
  'use strict'

  const wsUrl = (path) => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${path}`
  const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('')
  const leaderOf = (ids) => [...ids].sort()[0]

  // @ник в сетевых партиях: мод передаёт подпись ника после # (#me=…) — страница хранит её в браузере и убирает из
  // адреса, пустая подпись — забыть прежнюю. Подпись идёт в hello, комната проверяет её и показывает ник соперникам
  const ME_KEY = 'arcade:me'
  {
    const local = new URLSearchParams(location.hash.slice(1))
    if (local.has('me')) {
      const ticket = local.get('me')
      try {
        if (ticket) localStorage.setItem(ME_KEY, ticket)
        else localStorage.removeItem(ME_KEY)
      } catch {}
      local.delete('me')
      const rest = local.toString()
      // replaceState не вызывает hashchange — страница не перезагрузится
      history.replaceState(history.state, '', `${location.search}${rest ? `#${rest}` : ''}`)
    }
  }
  // Подпись ника для hello: { me } или ничего
  function named() {
    let me = null
    try {
      me = localStorage.getItem(ME_KEY)
    } catch {}
    return me ? { me } : {}
  }
  // Ники игроков от комнаты: «белые — @fefa · чёрные — @octo»; ников нет — ''
  function players(sides, names) {
    return sides.map((side, i) => (names?.[i] ? `${side} — @${names[i]}` : '')).filter(Boolean).join(' · ')
  }

  // Мои партии — в этом браузере: код, игра, когда открывали
  function myGames() {
    try {
      return JSON.parse(localStorage.getItem('arcade:board:games') || '[]')
    } catch {
      return []
    }
  }
  function remember(code, game) {
    const list = myGames().filter((g) => g.code !== code)
    list.unshift({ code, game, at: Date.now() })
    try {
      localStorage.setItem('arcade:board:games', JSON.stringify(list.slice(0, 20)))
    } catch {
      // браузер не даёт хранить — партия всё равно на сервере, по ссылке
    }
  }
  function tokenFor(code) {
    const key = `arcade:board:${code}`
    let token = null
    try {
      token = localStorage.getItem(key)
    } catch {}
    if (!token) {
      token = randomCode() + randomCode()
      try {
        localStorage.setItem(key, token)
      } catch {}
    }
    return token
  }

  // --- Правила за общим интерфейсом: позиция, ходы для клика, отрисовка клетки, итог ----------------------------
  // Круг шашки или фишки: светлый или тёмный, с обводкой; дамка — с короной
  const disc = (light, crown = false) => ({ light, crown })
  function reversiAdapter(R) {
    return {
      sides: [T('чёрные'), T('белые')],
      start: () => R.start(),
      apply: (s, m) => R.apply(s, m),
      turn: (s) => s.turn,
      cell: (s, r, c) => (s.board[r][c] === null ? '' : disc(s.board[r][c] === 1)),
      mine: () => false,
      targets: (s) => R.placements(s).map(([r, c]) => [r, c]),
      moveTo: (s, from, [r, c]) => [r, c],
      mustPass: (s) => !R.result(s) && R.moves(s)[0] === 'pass',
      result: (s) => R.result(s),
      extra: (s) => `${T('счёт')} ${R.score(s).join(' : ')}`,
    }
  }
  function checkersAdapter(R) {
    return {
      sides: [T('белые'), T('чёрные')],
      start: () => R.start(),
      apply: (s, m) => R.apply(s, m),
      turn: (s) => s.turn,
      cell: (s, r, c) => {
        const p = s.board[r][c]
        return p ? disc(p.side === 0, p.king) : ''
      },
      mine: (s, r, c, seat) => Boolean(s.board[r][c] && s.board[r][c].side === seat),
      targets: (s, from) => R.moves(s).filter((m) => m[0][0] === from[0] && m[0][1] === from[1]).map((m) => m[m.length - 1]),
      moveTo: (s, from, to) => R.moves(s).find((m) => m[0][0] === from[0] && m[0][1] === from[1] && m.at(-1)[0] === to[0] && m.at(-1)[1] === to[1]),
      mustPass: () => false,
      result: (s) => R.result(s),
      extra: () => '',
    }
  }
  const PIECES = { w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' }, b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' } }
  const square = (r, c) => `${'abcdefgh'[c]}${8 - r}`
  function chessAdapter(Chess) {
    return {
      sides: [T('белые'), T('чёрные')],
      start: () => new Chess(),
      apply: (g, san) => {
        const next = new Chess(g.fen())
        next.move(san)
        return next
      },
      turn: (g) => (g.turn() === 'w' ? 0 : 1),
      cell: (g, r, c) => {
        const p = g.board()[r][c]
        return p ? { glyph: PIECES.b[p.type], light: p.color === 'w' } : ''
      },
      mine: (g, r, c, seat) => {
        const p = g.board()[r][c]
        return Boolean(p && (p.color === 'w' ? 0 : 1) === seat)
      },
      targets: (g, from) =>
        g.moves({ square: square(...from), verbose: true }).map((m) => [8 - Number(m.to[1]), 'abcdefgh'.indexOf(m.to[0])]),
      moveTo: (g, from, to) => {
        const m = g.moves({ square: square(...from), verbose: true }).find((x) => x.to === square(...to))
        return m && (m.promotion ? g.moves({ square: square(...from), verbose: true }).find((x) => x.to === m.to && x.promotion === 'q').san : m.san)
      },
      mustPass: () => false,
      result: (g) => (g.isGameOver() ? { winner: g.isCheckmate() ? (g.turn() === 'w' ? 1 : 0) : -1 } : null),
      extra: (g) => (g.inCheck() && !g.isGameOver() ? T('шах') : ''),
    }
  }
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 }
  const CENTER = [0, 1, 2, 3, 3, 2, 1, 0]
  function chessScore(g) {
    let score = 0
    const board = g.board()
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (!p) continue
      const v = VALUE[p.type] + (p.type === 'k' ? 0 : (CENTER[r] + CENTER[c]) * (p.type === 'p' ? 2 : 4))
      score += p.color === g.turn() ? v : -v
    }
    return score
  }
  function chessSearch(g, depth, alpha, beta) {
    if (g.isCheckmate()) return -1e6 - depth
    if (g.isDraw() || g.isStalemate()) return 0
    if (depth === 0) return chessScore(g)
    let best = -Infinity
    const moves = g.moves({ verbose: true }).sort((a, b) => (b.captured ? VALUE[b.captured] : 0) - (a.captured ? VALUE[a.captured] : 0))
    for (const m of moves) {
      g.move(m)
      const v = -chessSearch(g, depth - 1, -beta, -alpha)
      g.undo()
      if (v > best) best = v
      if (best > alpha) alpha = best
      if (alpha >= beta) break
    }
    return best
  }
  function chessBest(Chess, g) {
    const work = new Chess(g.fen())
    let best = -Infinity
    let choices = []
    for (const m of work.moves({ verbose: true })) {
      work.move(m)
      const v = -chessSearch(work, 1, -Infinity, Infinity)
      work.undo()
      if (v > best) {
        best = v
        choices = [m.san]
      } else if (v === best) choices.push(m.san)
    }
    return choices[Math.floor(Math.random() * choices.length)] ?? null
  }

  async function adapter(kind) {
    if (kind === 'chess') {
      const { Chess } = await import('./vendor/chess/chess.js')
      return { ...chessAdapter(Chess), bot: (g) => chessBest(Chess, g) }
    }
    const all = window.ArcadeBoardRules
    const R = all[kind]
    return { ...(kind === 'reversi' ? reversiAdapter(R) : checkersAdapter(R)), bot: (s) => all.bestMove(kind, s) }
  }

  // --- Страница ----------------------------------------------------------------------------------------------------
  function el(tag, style, text) {
    const node = document.createElement(tag)
    if (style) node.style.cssText = style
    if (text !== undefined) node.textContent = text
    return node
  }
  // Фигура на клетке: круг (шашка, фишка) или знак (шахматы), светлые и тёмные с обводкой
  function piece(content) {
    if (!content) return el('span', '')
    if (content.glyph) {
      const color = content.light ? '#f4f1ea' : '#15151a'
      const edge = content.light ? '#15151a' : '#f4f1ea'
      return el('span', `font-size:min(6.5vw,6vh,40px);line-height:1;color:${color};text-shadow:0 0 1px ${edge},0 0 1px ${edge},0 0 2px ${edge}`, content.glyph)
    }
    const dot = el('span', `width:72%;height:72%;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:min(4vw,3.6vh,24px);background:${content.light ? '#f4f1ea' : '#1c1c22'};border:2px solid ${content.light ? '#8a8578' : '#9a9aa3'};color:${content.light ? '#7a5b16' : '#e0c070'}`, content.crown ? '♛' : '')
    return dot
  }

  function button(text, onClick, cls) {
    const b = el('button', 'margin:6px;padding:8px 14px;border-radius:8px;border:1px solid #3a3a44;background:#22222a;color:#eee;font:inherit;cursor:pointer', text)
    b.type = 'button'
    if (cls) b.className = cls
    b.addEventListener('click', onClick)
    return b
  }

  // Итог партии, где кто-то сдался: сервер присылает result { loser: место сдавшегося, reason: 'resign' }
  function resignText(result, seat) {
    return result.loser === seat ? T('Ты сдался — поражение') : seat >= 0 ? T('Соперник сдался — победа!') : T('Партия окончена: сдались')
  }

  function prepare(game) {
    document.body.classList.remove('library-mode')
    document.title = `${game.title} · Arcade`
    document.getElementById('keys').textContent = T('клик по своей фигуре, потом по клетке')
    document.getElementById('credit').textContent = T(game.credit)
    for (const id of ['sound', 'restart', 'best', 'net', 'license', 'source']) {
      const node = document.getElementById(id)
      if (node) node.style.display = 'none'
    }
    const screen = document.getElementById('screen')
    if (screen) screen.style.display = 'none'
    document.getElementById('overlay').classList.remove('shown')
    const root = el('div', 'max-width:560px;margin:0 auto;padding:12px;text-align:center')
    root.id = 'board-root'
    ;(document.getElementById('stage') || document.body).appendChild(root)
    return root
  }

  function start(catalog, id) {
    const game = catalog.games[id]
    const root = prepare(game)
    const params = new URLSearchParams(location.search)
    const code = params.get('room')
    // Го и шахматы — свои модули со всеми режимами: с компьютером, по сети с часами, с другом
    if (game.board === 'go' && window.ArcadeGo) return window.ArcadeGo.start(game, id, root)
    if (game.board === 'chess' && window.ArcadeChess) return window.ArcadeChess.start(game, id, root)
    if (code && /^[a-z0-9]{6,16}$/.test(code)) play(game, id, code, root)
    else if (params.get('vs') === 'bot') playBot(game, id, root)
    else menu(game, id, root)
  }

  // Меню: найти соперника, пригласить друга, мои партии
  function menu(game, id, root) {
    root.append(el('h2', 'margin:8px 0', game.title), el('p', 'color:#9a9aa3', window.ArcadeI18n ? window.ArcadeI18n.about(game) : game.about))
    const status = el('p', 'min-height:1.4em;color:#e0c070', '')
    const go = (c) => {
      location.search = `?game=${encodeURIComponent(id)}&room=${c}`
    }
    root.append(
      button(T('С компьютером'), () => {
        location.search = `?game=${encodeURIComponent(id)}&vs=bot`
      }),
      button(T('Найти соперника'), () => seek(id, status, go)),
      button(T('Пригласить друга'), () => go(randomCode())),
      status,
    )
    const mine = myGames().filter((g) => g.game === id)
    if (mine.length) {
      root.append(el('h3', 'margin:18px 0 6px;color:#9a9aa3;font-size:14px', T('Мои партии')))
      for (const g of mine.slice(0, 8)) {
        const a = el('a', 'display:block;color:#7fb2ff;margin:4px', `${T('партия')} ${g.code.slice(0, 6)} · ${new Date(g.at).toLocaleString()}`)
        a.href = `?game=${encodeURIComponent(id)}&room=${g.code}`
        root.append(a)
      }
    }
  }

  // Поиск соперника — лобби board-<игра>: ведущий (наименьший номер) сводит двоих в новую партию
  function seek(id, status, go) {
    status.textContent = T('Ищу соперника…')
    const ws = new WebSocket(wsUrl(`/net/room/board-${id}`))
    let me = null
    const peers = new Set()
    let matched = false
    ws.addEventListener('message', (e) => {
      let m
      try {
        m = JSON.parse(e.data)
      } catch {
        return
      }
      if (m.type === 'welcome') {
        me = m.id
        for (const p of m.peers || []) peers.add(p)
      } else if (m.type === 'join') peers.add(m.id)
      else if (m.type === 'leave') peers.delete(m.id)
      else if (m.type === 'match' && Array.isArray(m.players) && m.players.includes(me) && !matched) {
        matched = true
        go(m.code)
        return
      }
      const all = me ? [me, ...peers] : [...peers]
      status.textContent = all.length < 2 ? T('Ждём соперника — как только кто-то зайдёт, начнёте') : T('Соперник нашёлся!')
      if (!matched && me && all.length >= 2 && leaderOf(all) === me) {
        matched = true
        const pair = [...all].sort().slice(0, 2)
        const c = randomCode()
        ws.send(JSON.stringify({ type: 'match', code: c, players: pair }))
        go(c)
      }
    })
    window.ArcadeBoard.lobby = { ws, get me() { return me } }
  }

  // Игра с ботом: «локальный сервер» с тем же разговором, что у комнаты партии; ходы — в localStorage
  function botSocket(rules, id) {
    const key = `arcade:board:bot:${id}`
    let saved = { seat: 0, moves: [] }
    try {
      saved = JSON.parse(localStorage.getItem(key)) || saved
    } catch {}
    const listeners = {}
    const emit = (frame) => setTimeout(() => (listeners.message || []).forEach((fn) => fn({ data: JSON.stringify(frame) })), 0)
    const store = () => {
      try {
        localStorage.setItem(key, JSON.stringify(saved))
      } catch {}
    }
    const position = () => saved.moves.reduce((p, m) => rules.apply(p, m), rules.start())
    function botTurn() {
      const p = position()
      if (saved.result || rules.result(p) || rules.turn(p) === saved.seat) return
      setTimeout(() => {
        if (saved.result) return // пока бот думал, игрок сдался
        const move = rules.bot(position())
        if (move === null || move === undefined) return
        saved.moves.push(move)
        store()
        emit({ type: 'move', ply: saved.moves.length - 1, move })
        botTurn()
      }, 500)
    }
    function handle(m) {
      if (m.type === 'hello') {
        emit({ type: 'state', seat: saved.seat, seats: 2, moves: saved.moves, ...(saved.result ? { result: saved.result } : {}) })
        botTurn()
      } else if (m.type === 'move') {
        const p = position()
        if (saved.result || m.ply !== saved.moves.length || rules.turn(p) !== saved.seat) return
        try {
          rules.apply(p, m.move)
        } catch {
          return
        }
        saved.moves.push(m.move)
        store()
        emit({ type: 'move', ply: m.ply, move: m.move })
        botTurn()
      } else if (m.type === 'resign') {
        if (saved.result) return
        saved.result = { loser: saved.seat, reason: 'resign' }
        store()
        emit({ type: 'state', seat: saved.seat, seats: 2, moves: saved.moves, result: saved.result })
      } else if (m.type === 'reset') {
        // Новая партия — стороны меняются: теперь бот ходит первым
        saved = { seat: 1 - saved.seat, moves: [] }
        store()
        emit({ type: 'state', seat: saved.seat, seats: 2, moves: [] })
        botTurn()
      }
    }
    setTimeout(() => (listeners.open || []).forEach((fn) => fn({})), 0)
    return {
      addEventListener(type, fn) {
        ;(listeners[type] ||= []).push(fn)
      },
      send(text) {
        handle(JSON.parse(text))
      },
    }
  }

  function playBot(game, id, root) {
    return play(game, id, null, root, { bot: true })
  }

  // Партия: по сети (code) или с ботом (options.bot)
  async function play(game, id, code, root, options = {}) {
    if (code) remember(code, id)
    const rules = await adapter(game.board)
    const title = el('h2', 'margin:8px 0', game.title)
    const status = el('p', 'min-height:1.4em;color:#e0c070', T('Подключаюсь к партии…'))
    const grid = el('div', 'display:grid;grid-template-columns:repeat(8,1fr);width:min(92vw,62vh,480px);margin:0 auto;border:2px solid #3a3a44')
    const who = el('p', 'margin:8px 0 0;color:#9a9aa3', '')
    const tools = el('div', 'margin-top:10px')
    root.append(title, status, grid, who, tools)
    const link = code ? `${location.origin}${location.pathname}?game=${encodeURIComponent(id)}&room=${code}` : null

    let position = rules.start()
    let moves = []
    let seat = -1
    let seats = 0
    let names = []
    let selected = null
    let resigned = null // кто-то сдался: { loser, reason: 'resign' } от сервера
    const ws = options.bot ? botSocket(rules, id) : new WebSocket(wsUrl(`/net/board/${code}`))
    ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'hello', token: tokenFor(code), game: id, ...(code ? named() : {}) })))
    ws.addEventListener('close', () => {
      status.textContent = T('Связь с партией прервалась — открой ссылку ещё раз, ходы сохранены')
    })
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
        resigned = m.result || null
        moves = []
        position = rules.start()
        for (const mv of m.moves || []) {
          try {
            position = rules.apply(position, mv)
            moves.push(mv)
          } catch {
            break // неверный ход в истории — дальше не идём
          }
        }
      } else if (m.type === 'move' && m.ply === moves.length) {
        try {
          position = rules.apply(position, m.move)
          moves.push(m.move)
        } catch {
          return
        }
      } else if (m.type === 'seats') {
        seats = m.seats
        names = m.names || []
      }
      selected = null
      render()
    })

    const send = (move) => ws.send(JSON.stringify({ type: 'move', ply: moves.length, move }))

    function render() {
      grid.replaceChildren()
      const flip = seat === 1
      const result = rules.result(position)
      const over = Boolean(resigned || result)
      const targets = over ? [] : selected ? rules.targets(position, selected) : seat === rules.turn(position) && game.board === 'reversi' ? rules.targets(position) : []
      for (let i = 0; i < 64; i++) {
        const r = flip ? 7 - Math.floor(i / 8) : Math.floor(i / 8)
        const c = flip ? 7 - (i % 8) : i % 8
        const dark = (r + c) % 2 === 1
        const isTarget = targets.some(([y, x]) => y === r && x === c)
        const isSel = selected && selected[0] === r && selected[1] === c
        const bg = isSel ? '#6d6a2c' : isTarget ? '#2f6d3b' : game.board === 'reversi' ? '#1f5b34' : dark ? '#6b4f36' : '#d8c3a0'
        const cell = el('button', `aspect-ratio:1;border:0;margin:0;padding:0;display:flex;align-items:center;justify-content:center;cursor:pointer;background:${bg}`)
        cell.append(piece(rules.cell(position, r, c)))
        cell.type = 'button'
        cell.dataset.r = r
        cell.dataset.c = c
        cell.addEventListener('click', () => click(r, c))
        grid.append(cell)
      }
      who.textContent = players(rules.sides, names)
      tools.replaceChildren()
      const mySide = seat >= 0 ? rules.sides[seat] : null
      const extra = rules.extra(position)
      if (over) {
        if (resigned) status.textContent = resignText(resigned, seat)
        else status.textContent = result.winner === -1 ? T('Ничья') : result.winner === seat ? T('Победа!') : seat >= 0 ? T('Поражение') : T(`Победили ${rules.sides[result.winner]}`)
        if (seat >= 0) tools.append(button(T('Новая партия'), () => ws.send(JSON.stringify({ type: 'reset' }))))
      } else if (seats < 2) status.textContent = T('Ждём соперника — отправь ему ссылку на эту партию')
      else if (seat < 0) status.textContent = T('Ты смотришь партию: в ней уже двое')
      else if (seat === rules.turn(position)) status.textContent = `${T('Твой ход')} (${mySide})${extra ? ` · ${extra}` : ''}`
      else if (options.bot) status.textContent = `${T('Компьютер думает…')}${extra ? ` · ${extra}` : ''}`
      else status.textContent = `${T('Ход соперника — можно вернуться к агенту, партия сохранится')}${extra ? ` · ${extra}` : ''}`
      if (!over && seat >= 0 && seat === rules.turn(position) && rules.mustPass(position)) tools.append(button(T('Пропустить ход'), () => send('pass')))
      if (!over && seat >= 0 && seats >= 2) tools.append(button(T('Сдаться'), () => ws.send(JSON.stringify({ type: 'resign' })), 'board-resign'))
      if (options.bot && !over) tools.append(button(T('Начать заново'), () => ws.send(JSON.stringify({ type: 'reset' }))))
      if (link) {
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
    }

    function click(r, c) {
      if (seat < 0 || seats < 2 || resigned || rules.result(position) || seat !== rules.turn(position)) return
      if (game.board === 'reversi') {
        if (rules.targets(position).some(([y, x]) => y === r && x === c)) send([r, c])
        return
      }
      if (rules.mine(position, r, c, seat)) {
        selected = [r, c]
        return render()
      }
      if (selected) {
        const move = rules.moveTo(position, selected, [r, c])
        if (move) send(move)
        selected = null
        render()
      }
    }

    window.ArcadeBoard.game = { get position() { return position }, get moves() { return moves }, get seat() { return seat }, get resigned() { return resigned }, click, rules, reset: () => ws.send(JSON.stringify({ type: 'reset' })) }
  }

  // Помощники — модулям шахмат (chess.js) и го (go.js): поиск соперника, жетон места, «Мои партии», адрес сокета,
  // подпись ника, ники игроков и итог сдачи
  window.ArcadeBoard = { start, adapter, seek, randomCode, tokenFor, remember, myGames, wsUrl, named, players, resignText }
})()
