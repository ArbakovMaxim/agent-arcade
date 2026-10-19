// Настольные игры по сети: шахматы (chess.js, BSD-2-Clause), русские шашки и реверси (board-rules.js).
// Без ?room — меню: «Найти соперника» (лобби, ведущий сводит двоих), «Пригласить друга» (ссылка), «Мои партии».
// С ?room=<код> — партия: ходы хранятся на сервере (/net/board/<код>), можно закрыть окно и вернуться по ссылке.
;(function () {
  'use strict'

  const wsUrl = (path) => `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}${path}`
  const randomCode = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => (b % 36).toString(36)).join('')
  const leaderOf = (ids) => [...ids].sort()[0]

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
  const DISC = ['●', '○']
  function reversiAdapter(R) {
    return {
      sides: [T('чёрные'), T('белые')],
      start: () => R.start(),
      apply: (s, m) => R.apply(s, m),
      turn: (s) => s.turn,
      cell: (s, r, c) => (s.board[r][c] === null ? '' : DISC[s.board[r][c]]),
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
        return p ? (p.side === 0 ? (p.king ? '♕' : '⛀') : p.king ? '♛' : '⛂') : ''
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
        return p ? PIECES[p.color][p.type] : ''
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
  async function adapter(kind) {
    if (kind === 'chess') {
      const { Chess } = await import('./vendor/chess/chess.js')
      return chessAdapter(Chess)
    }
    const R = window.ArcadeBoardRules[kind]
    return kind === 'reversi' ? reversiAdapter(R) : checkersAdapter(R)
  }

  // --- Страница ----------------------------------------------------------------------------------------------------
  function el(tag, style, text) {
    const node = document.createElement(tag)
    if (style) node.style.cssText = style
    if (text !== undefined) node.textContent = text
    return node
  }
  function button(text, onClick) {
    const b = el('button', 'margin:6px;padding:8px 14px;border-radius:8px;border:1px solid #3a3a44;background:#22222a;color:#eee;font:inherit;cursor:pointer', text)
    b.type = 'button'
    b.addEventListener('click', onClick)
    return b
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
    const code = new URLSearchParams(location.search).get('room')
    if (code && /^[a-z0-9]{6,16}$/.test(code)) play(game, id, code, root)
    else menu(game, id, root)
  }

  // Меню: найти соперника, пригласить друга, мои партии
  function menu(game, id, root) {
    root.append(el('h2', 'margin:8px 0', game.title), el('p', 'color:#9a9aa3', T(game.about_en && window.ArcadeI18n && window.ArcadeI18n.lang === 'en' ? game.about_en : game.about)))
    const status = el('p', 'min-height:1.4em;color:#e0c070', '')
    const go = (c) => {
      location.search = `?game=${encodeURIComponent(id)}&room=${c}`
    }
    root.append(
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

  // Партия
  async function play(game, id, code, root) {
    remember(code, id)
    const rules = await adapter(game.board)
    const title = el('h2', 'margin:8px 0', game.title)
    const status = el('p', 'min-height:1.4em;color:#e0c070', T('Подключаюсь к партии…'))
    const grid = el('div', 'display:grid;grid-template-columns:repeat(8,1fr);width:min(92vw,480px);margin:0 auto;border:2px solid #3a3a44')
    const tools = el('div', 'margin-top:10px')
    root.append(title, status, grid, tools)
    const link = `${location.origin}${location.pathname}?game=${encodeURIComponent(id)}&room=${code}`

    let position = rules.start()
    let moves = []
    let seat = -1
    let seats = 0
    let selected = null
    const ws = new WebSocket(wsUrl(`/net/board/${code}`))
    ws.addEventListener('open', () => ws.send(JSON.stringify({ type: 'hello', token: tokenFor(code), game: id })))
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
      } else if (m.type === 'seats') seats = m.seats
      selected = null
      render()
    })

    const send = (move) => ws.send(JSON.stringify({ type: 'move', ply: moves.length, move }))

    function render() {
      grid.replaceChildren()
      const flip = seat === 1
      const targets = selected ? rules.targets(position, selected) : seat === rules.turn(position) && game.board === 'reversi' ? rules.targets(position) : []
      const result = rules.result(position)
      for (let i = 0; i < 64; i++) {
        const r = flip ? 7 - Math.floor(i / 8) : Math.floor(i / 8)
        const c = flip ? 7 - (i % 8) : i % 8
        const dark = (r + c) % 2 === 1
        const isTarget = targets.some(([y, x]) => y === r && x === c)
        const isSel = selected && selected[0] === r && selected[1] === c
        const bg = isSel ? '#6d6a2c' : isTarget ? '#2f6d3b' : game.board === 'reversi' ? '#1f5b34' : dark ? '#6b4f36' : '#d8c3a0'
        const cell = el('button', `aspect-ratio:1;border:0;margin:0;padding:0;font-size:min(7vw,40px);line-height:1;cursor:pointer;background:${bg};color:${game.board === 'checkers' ? '#111' : '#111'}`, rules.cell(position, r, c))
        cell.type = 'button'
        cell.dataset.r = r
        cell.dataset.c = c
        cell.addEventListener('click', () => click(r, c))
        grid.append(cell)
      }
      tools.replaceChildren()
      const mySide = seat >= 0 ? rules.sides[seat] : null
      const extra = rules.extra(position)
      if (result) {
        status.textContent = result.winner === -1 ? T('Ничья') : result.winner === seat ? T('Победа!') : seat >= 0 ? T('Поражение') : T(`Победили ${rules.sides[result.winner]}`)
        if (seat >= 0) tools.append(button(T('Новая партия'), () => ws.send(JSON.stringify({ type: 'reset' }))))
      } else if (seats < 2) status.textContent = T('Ждём соперника — отправь ему ссылку на эту партию')
      else if (seat < 0) status.textContent = T('Ты смотришь партию: в ней уже двое')
      else if (seat === rules.turn(position)) status.textContent = `${T('Твой ход')} (${mySide})${extra ? ` · ${extra}` : ''}`
      else status.textContent = `${T('Ход соперника — можно вернуться к агенту, партия сохранится')}${extra ? ` · ${extra}` : ''}`
      if (!result && seat >= 0 && seat === rules.turn(position) && rules.mustPass(position)) tools.append(button(T('Пропустить ход'), () => send('pass')))
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

    function click(r, c) {
      if (seat < 0 || seats < 2 || rules.result(position) || seat !== rules.turn(position)) return
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

    window.ArcadeBoard.game = { get position() { return position }, get moves() { return moves }, get seat() { return seat }, click, rules }
  }

  window.ArcadeBoard = { start, adapter }
})()
