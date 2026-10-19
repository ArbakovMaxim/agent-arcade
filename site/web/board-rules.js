// Правила настольных игр Arcade: реверси и русские шашки. Шахматы — библиотека chess.js (BSD-2-Clause).
// Позиция — { board: 8×8, turn: 0 | 1 }; ход — значение, которое можно переслать по сети как есть.
// Сторона 0 ходит первой: в шашках это белые, в реверси — чёрные, как принято.
;(function () {
  'use strict'

  const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8
  const copy = (board) => board.map((row) => row.map((x) => (x && typeof x === 'object' ? { ...x } : x)))
  const DIRS8 = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]
  const DIAG = [[-1, -1], [-1, 1], [1, -1], [1, 1]]

  // --- Реверси: клетка — null, 0 (чёрная фишка) или 1 (белая); ход — [ряд, столбец] или 'pass' ----------------
  const reversi = {
    start() {
      const board = Array.from({ length: 8 }, () => Array(8).fill(null))
      board[3][3] = board[4][4] = 1
      board[3][4] = board[4][3] = 0
      return { board, turn: 0 }
    },
    flips(board, side, r, c) {
      if (board[r][c] !== null) return []
      const out = []
      for (const [dr, dc] of DIRS8) {
        const line = []
        let y = r + dr
        let x = c + dc
        while (inside(y, x) && board[y][x] === 1 - side) {
          line.push([y, x])
          y += dr
          x += dc
        }
        if (line.length && inside(y, x) && board[y][x] === side) out.push(...line)
      }
      return out
    },
    placements(state, side = state.turn) {
      const out = []
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (reversi.flips(state.board, side, r, c).length) out.push([r, c])
      return out
    },
    moves(state) {
      if (reversi.result(state)) return []
      const own = reversi.placements(state)
      return own.length ? own : ['pass']
    },
    apply(state, move) {
      const board = copy(state.board)
      if (move !== 'pass') {
        const [r, c] = move
        const flips = reversi.flips(board, state.turn, r, c)
        if (!flips.length) throw new Error('недопустимый ход')
        board[r][c] = state.turn
        for (const [y, x] of flips) board[y][x] = state.turn
      } else if (reversi.placements(state).length) throw new Error('пропускать нельзя: есть ход')
      return { board, turn: 1 - state.turn }
    },
    score(state) {
      const s = [0, 0]
      for (const row of state.board) for (const x of row) if (x !== null) s[x]++
      return s
    },
    // Конец — когда ходить не может никто; победитель — у кого больше фишек (-1 — ничья)
    result(state) {
      if (reversi.placements(state, 0).length || reversi.placements(state, 1).length) return null
      const [a, b] = reversi.score(state)
      return { winner: a === b ? -1 : a > b ? 0 : 1, score: [a, b] }
    },
  }

  // --- Русские шашки: клетка — null или { side, king }; белые (0) внизу, ходят первыми -----------------------
  // Ход — путь [[ряд, столбец], …]: откуда и куда, для боя — все поля остановки по очереди.
  const checkers = {
    start() {
      const board = Array.from({ length: 8 }, () => Array(8).fill(null))
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          if ((r + c) % 2 === 0) continue
          if (r < 3) board[r][c] = { side: 1, king: false }
          else if (r > 4) board[r][c] = { side: 0, king: false }
        }
      }
      return { board, turn: 0 }
    },
    lastRow: (side) => (side === 0 ? 0 : 7),

    // Все серии взятий шашкой с поля (r, c). taken — уже побитые в этой серии (снимаются после хода)
    captures(board, side, r, c, king, from, taken) {
      const out = []
      const empty = (y, x) => inside(y, x) && (board[y][x] === null || (y === from[0] && x === from[1]))
      const enemy = (y, x) => inside(y, x) && board[y][x] && board[y][x].side !== side && !taken.some(([ty, tx]) => ty === y && tx === x)
      for (const [dr, dc] of DIAG) {
        let y = r + dr
        let x = c + dc
        if (king) while (empty(y, x)) ((y += dr), (x += dc))
        if (!enemy(y, x)) continue
        const victim = [y, x]
        const landings = []
        let ly = y + dr
        let lx = x + dc
        while (empty(ly, lx)) {
          landings.push([ly, lx])
          if (!king) break
          ly += dr
          lx += dc
        }
        if (!landings.length) continue
        // Дамка обязана встать туда, откуда бой продолжается, если такое поле есть
        const next = landings.map(([ny, nx]) => {
          const crowned = king || ny === checkers.lastRow(side)
          return { at: [ny, nx], more: checkers.captures(board, side, ny, nx, crowned, from, [...taken, victim]) }
        })
        const continuing = next.filter((n) => n.more.length)
        for (const n of continuing.length ? continuing : next) {
          if (n.more.length) for (const tail of n.more) out.push([n.at, ...tail])
          else out.push([n.at])
        }
      }
      return out
    },

    moves(state) {
      const { board, turn } = state
      const jumps = []
      const steps = []
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const p = board[r][c]
          if (!p || p.side !== turn) continue
          for (const path of checkers.captures(board, turn, r, c, p.king, [r, c], [])) jumps.push([[r, c], ...path])
          const forward = turn === 0 ? -1 : 1
          for (const [dr, dc] of DIAG) {
            if (!p.king && dr !== forward) continue
            let y = r + dr
            let x = c + dc
            while (inside(y, x) && board[y][x] === null) {
              steps.push([[r, c], [y, x]])
              if (!p.king) break
              y += dr
              x += dc
            }
          }
        }
      }
      return jumps.length ? jumps : steps // бить обязательно
    },

    apply(state, path, trusted = false) {
      // trusted — ход взят из moves() (перебор бота): проверять второй раз незачем
      const legal = trusted || checkers.moves(state).some((m) => JSON.stringify(m) === JSON.stringify(path))
      if (!legal) throw new Error('недопустимый ход')
      const board = copy(state.board)
      let [r, c] = path[0]
      const piece = board[r][c]
      board[r][c] = null
      for (let i = 1; i < path.length; i++) {
        const [y, x] = path[i]
        const dr = Math.sign(y - r)
        const dc = Math.sign(x - c)
        for (let yy = r + dr, xx = c + dc; yy !== y; yy += dr, xx += dc) board[yy][xx] = null // побитая — снимается
        if (y === checkers.lastRow(piece.side)) piece.king = true
        r = y
        c = x
      }
      board[r][c] = piece
      return { board, turn: 1 - state.turn }
    },

    // Кому нечем ходить — тот проиграл
    result(state) {
      return checkers.moves(state).length ? null : { winner: 1 - state.turn }
    },
  }

  // --- Боты: перебор с альфа-бета отсечением; оценка — со стороны того, кто ходит ---------------------------------
  // Реверси: углы ценнее всего, клетки рядом с углом опасны, плюс подвижность
  const WEIGHTS = [
    [100, -20, 10, 5, 5, 10, -20, 100],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [10, -2, 1, 1, 1, 1, -2, 10],
    [5, -2, 1, 0, 0, 1, -2, 5],
    [5, -2, 1, 0, 0, 1, -2, 5],
    [10, -2, 1, 1, 1, 1, -2, 10],
    [-20, -50, -2, -2, -2, -2, -50, -20],
    [100, -20, 10, 5, 5, 10, -20, 100],
  ]
  const evaluate = {
    reversi(state) {
      let score = 0
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const x = state.board[r][c]
        if (x !== null) score += x === state.turn ? WEIGHTS[r][c] : -WEIGHTS[r][c]
      }
      return score + 2 * (reversi.placements(state, state.turn).length - reversi.placements(state, 1 - state.turn).length)
    },
    // Шашки: дамка втрое дороже шашки, шашке — за продвижение к дамочному ряду
    checkers(state) {
      let score = 0
      for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) {
        const p = state.board[r][c]
        if (!p) continue
        const value = p.king ? 30 : 10 + (p.side === 0 ? 7 - r : r) * 0.5
        score += p.side === state.turn ? value : -value
      }
      return score
    },
  }
  const step = { reversi: (s, m) => reversi.apply(s, m), checkers: (s, m) => checkers.apply(s, m, true) }

  function search(kind, rules, state, depth, alpha, beta) {
    const done = rules.result(state)
    if (done) return done.winner === -1 ? 0 : done.winner === state.turn ? 1e6 + depth : -1e6 - depth
    if (depth === 0) return evaluate[kind](state)
    let best = -Infinity
    for (const m of rules.moves(state)) {
      const v = -search(kind, rules, step[kind](state, m), depth - 1, -beta, -alpha)
      if (v > best) best = v
      if (best > alpha) alpha = best
      if (alpha >= beta) break
    }
    return best
  }

  // Лучший ход для того, кто ходит; при равенстве — случайный, чтобы партии не повторялись
  function bestMove(kind, state, depth = kind === 'checkers' ? 4 : 3, random = Math.random) {
    const rules = kind === 'reversi' ? reversi : checkers
    const moves = rules.moves(state)
    let best = -Infinity
    let choices = []
    for (const m of moves) {
      const v = -search(kind, rules, step[kind](state, m), depth - 1, -Infinity, Infinity)
      if (v > best) {
        best = v
        choices = [m]
      } else if (v === best) choices.push(m)
    }
    return choices[Math.floor(random() * choices.length)] ?? null
  }

  window.ArcadeBoardRules = { reversi, checkers, bestMove, evaluate }
})()
