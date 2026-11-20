// Flappy Arcade — своя игра для панели мода и окна Arcade. Ведёт себя как эмулятор Денди: кадр 256×240 в формате
// 0xBBGGRR (как у JSNES), frame() — шаг на 1/60 секунды, buttonDown/buttonUp — кнопки. Поэтому панель рисует её тем же
// путём, что и Денди: картинкой в Desktop и VS Code, пикселями или полублоками в терминале.
// Любая кнопка — взмах. Трубы на день одинаковые у всех: случайные числа идут от даты (seed), рекорд дня честный.
// Файл общий: сборка сайта кладёт его в окно Arcade как есть (без export), поэтому здесь нет импортов.

const W = 256
const H = 240
const GROUND = 216 // где начинается земля
const BIRD_X = 64
const BIRD_W = 14
const BIRD_H = 10
// Физика мягче, чем в 0.12–0.55.1 (0.3 / −4.6 / 6.5): птица меньше прыгает от кадра к кадру. Высота взмаха та же —
// FLAP² / (2·GRAVITY) ≈ 35 точек, трубы, щель и трасса дня не менялись
const GRAVITY = 0.24
const FLAP = -4.1
const MAX_FALL = 5.2
const SPEED = 1.5
const CATCH_UP = 6 // advance: больше шагов за раз не догоняем — после паузы игра не проматывается вперёд
const PIPE_W = 24
const GAP = 64
const SPACING = 104 // расстояние между трубами
const RESTART_AFTER = 30 // кадров после удара, прежде чем кнопка начнёт новую попытку

const rgb = (r, g, b) => (b << 16) | (g << 8) | r
const SKY = rgb(112, 192, 238)
const SKY_LOW = rgb(150, 210, 240)
const CLOUD = rgb(236, 246, 252)
const GRASS = rgb(102, 190, 76)
const DIRT = rgb(214, 184, 120)
const DIRT_DARK = rgb(186, 152, 92)
const PIPE = rgb(88, 170, 64)
const PIPE_LIGHT = rgb(146, 214, 98)
const PIPE_DARK = rgb(50, 110, 40)
const BIRD = rgb(250, 204, 40)
const BIRD_DARK = rgb(214, 140, 20)
const WHITE = rgb(255, 255, 255)
const BLACK = rgb(24, 24, 28)
const BEAK = rgb(240, 110, 40)

// Птица 14×10: . — прозрачно, y — жёлтый, d — тёмно-жёлтый, w — белый, k — глаз, o — клюв
const BIRD_ART = [
  '....yyyyyy....',
  '..yyyyyyyywww.',
  '.yyyyyyyywwkw.',
  'yyyyyyyyywwkw.',
  'ddddyyyyyywww.',
  'yddddyyyyyoooo',
  'yyyyyyyyyooo..',
  '.yyyyyyyyyoo..',
  '..yyyyyyyy....',
  '....yyyyy.....',
]
const ART_COLOR = { y: BIRD, d: BIRD_DARK, w: WHITE, k: BLACK, o: BEAK }

// Наклон птицы — целым рисунком: четыре готовые птицы (вверх, ровно, вниз, пике) с углом, при котором каждая
// рисуется (радианы, плюс — клювом вниз). Раньше каждый столбец сдвигался отдельно, и птица ломалась и дрожала.
const BIRD_UP = [
  '....yyyyywww...',
  '...yyyyyywwkw..',
  '.yyyyyyyywwkw..',
  '.yyyyyyyywwww..',
  'yyyyyyyyyyoooo.',
  'ddddyyyyyyoo...',
  'yddddyyyyyoo...',
  'yyyyyyyyyyy....',
  '.yyyyyyyyy.....',
  '...yyyyyyy.....',
]
const BIRD_DOWN = [
  '...yyyyyy......',
  '.yyyyyyyyyy....',
  'ddyyyyyyyyyw...',
  'ydddyyyyyywwkw.',
  'yydddyyyywwwkw.',
  '.yyyyyyyyywww..',
  '.yyyyyyyyyoow..',
  '..yyyyyyyooooo.',
  '...yyyyyyoo....',
  '.....yyy.......',
]
const BIRD_DIVE = [
  '..yyyyyyy......',
  '.yddyyyyyyy....',
  'yydddyyyyyyy...',
  '.yyddyyyyyyy...',
  '.yyyyyyyyywww..',
  '.yyyyyyyyywwkw.',
  '..yyyyyyyywwkw.',
  '..yyyyyyoooww..',
  '...yyyyyoooo...',
  '.....yyyoo.....',
]
const TILTS = [-0.22, 0, 0.3, 0.6]
// Точки каждой птицы подряд: x, y, цвет. Наклонённые сдвинуты так, чтобы их середина совпала с серединой ровной —
// при смене рисунка птица поворачивается на месте, а не прыгает на точку в сторону
const artPixels = (art) => {
  const pixels = []
  art.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) if (ART_COLOR[row[x]] !== undefined) pixels.push(x, y, ART_COLOR[row[x]])
  })
  return pixels
}
const middle = (pixels) => {
  let x = 0
  let y = 0
  for (let i = 0; i < pixels.length; i += 3) {
    x += pixels[i]
    y += pixels[i + 1]
  }
  return [(x * 3) / pixels.length, (y * 3) / pixels.length]
}
const LEVEL_MIDDLE = middle(artPixels(BIRD_ART))
const BIRD_SPRITES = [BIRD_UP, BIRD_ART, BIRD_DOWN, BIRD_DIVE].map((art) => {
  const pixels = artPixels(art)
  const [mx, my] = middle(pixels)
  const dx = Math.round(LEVEL_MIDDLE[0] - mx)
  const dy = Math.round(LEVEL_MIDDLE[1] - my)
  for (let i = 0; i < pixels.length; i += 3) {
    pixels[i] += dx
    pixels[i + 1] += dy
  }
  return pixels
})
const tiltIndex = (angle) => {
  let best = 0
  for (let i = 1; i < TILTS.length; i++) if (Math.abs(TILTS[i] - angle) < Math.abs(TILTS[best] - angle)) best = i
  return best
}

// Цифры 3×5 для счёта в кадре (рисуются крупно, по 4 пикселя на точку)
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111']

// Генератор случайных чисел от числа (mulberry32): одинаковый seed — одинаковые трубы
function random(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// День как число: 20261021 — трасса дня
function daySeed(date = new Date()) {
  return date.getUTCFullYear() * 10000 + (date.getUTCMonth() + 1) * 100 + date.getUTCDate()
}

function createFlappy(onFrame, options = {}) {
  const seed = options.seed ?? daySeed()
  const frame = new Array(W * H).fill(SKY)
  const held = new Set()
  const game = {
    state: 'ready', // ready — ждёт первой кнопки, play — летит, over — удар
    score: 0,
    best: Number(options.best) || 0,
    seed,
    birdY: 100,
    speed: 0,
    angle: 0, // наклон птицы, плавно догоняет скорость
    pipes: [],
    ticks: 0,
    overAt: 0,
    scroll: 0,
  }
  let rand = random(seed)
  // Что было до последнего шага: кадр между двумя шагами (advance) рисует птицу, трубы и землю между ними
  const before = { birdY: 100, pipes: false, scroll: false }
  let carry = 0 // доля шага, которую часы уже прошли, а игра ещё нет

  const reset = () => {
    rand = random(seed) // каждая попытка — та же трасса дня
    game.state = 'ready'
    game.score = 0
    game.birdY = 100
    game.speed = 0
    game.angle = 0
    game.pipes = []
    game.ticks = 0
    before.birdY = 100
    before.pipes = false
  }
  const spawn = (x) => {
    const top = 24 + Math.floor(rand() * (GROUND - GAP - 48))
    game.pipes.push({ x, top, passed: false })
  }
  const flap = () => {
    if (game.state === 'over') {
      if (game.ticks - game.overAt < RESTART_AFTER) return
      reset()
    }
    if (game.state === 'ready') {
      game.state = 'play'
      spawn(W + 40)
    }
    game.speed = FLAP
  }
  const crash = () => {
    game.state = 'over'
    game.overAt = game.ticks
    if (game.score > game.best) game.best = game.score
    options.onGameOver?.(game.score, game.best)
  }

  const step = () => {
    game.ticks++
    before.birdY = game.birdY
    before.pipes = false
    before.scroll = game.state !== 'over'
    if (game.state !== 'over') game.scroll = (game.scroll + SPEED) % 16
    if (game.state === 'ready') {
      game.birdY = 100 + Math.sin(game.ticks / 10) * 4 // покачивается, пока ждёт
      game.angle = 0
      return
    }
    if (game.state === 'over' && game.birdY >= GROUND - BIRD_H) return
    game.speed = Math.min(MAX_FALL, game.speed + GRAVITY)
    game.birdY += game.speed
    // Вверх — чуть задрана, вниз — клювом вниз тем сильнее, чем быстрее падает; без рывков
    game.angle += (Math.max(TILTS[0], Math.min(TILTS[TILTS.length - 1], game.speed * 0.14)) - game.angle) * 0.25
    if (game.birdY < 0) {
      game.birdY = 0
      game.speed = 0
    }
    if (game.birdY >= GROUND - BIRD_H) {
      game.birdY = GROUND - BIRD_H
      if (game.state === 'play') crash()
      return
    }
    if (game.state !== 'play') return
    for (const p of game.pipes) p.x -= SPEED
    before.pipes = true
    if (game.pipes.length && game.pipes[0].x < -PIPE_W) game.pipes.shift()
    const last = game.pipes[game.pipes.length - 1]
    if (!last || last.x < W - SPACING) spawn((last ? last.x : W) + SPACING)
    for (const p of game.pipes) {
      if (!p.passed && p.x + PIPE_W < BIRD_X) {
        p.passed = true
        game.score++
      }
      const inX = BIRD_X + BIRD_W - 2 > p.x && BIRD_X + 2 < p.x + PIPE_W
      const inGap = game.birdY + 2 > p.top && game.birdY + BIRD_H - 2 < p.top + GAP
      if (inX && !inGap) return crash()
    }
  }

  const fill = (x0, y0, w, h, color) => {
    const x1 = Math.max(0, Math.floor(x0))
    const x2 = Math.min(W, Math.floor(x0 + w))
    const y1 = Math.max(0, Math.floor(y0))
    const y2 = Math.min(H, Math.floor(y0 + h))
    for (let y = y1; y < y2; y++) for (let x = x1; x < x2; x++) frame[y * W + x] = color
  }
  const number = (n, cx, y) => {
    const text = String(n)
    const size = 4
    const width = text.length * (3 * size + size) - size
    let x = Math.round(cx - width / 2)
    for (const ch of text) {
      const d = DIGITS[ch.charCodeAt(0) - 48]
      for (let i = 0; i < 15; i++) {
        if (d[i] !== '1') continue
        const px = x + (i % 3) * size
        const py = y + Math.floor(i / 3) * size
        fill(px - 1, py - 1, size + 2, size + 2, BLACK) // обводка
      }
      for (let i = 0; i < 15; i++) if (d[i] === '1') fill(x + (i % 3) * size, y + Math.floor(i / 3) * size, size, size, WHITE)
      x += 4 * size
    }
  }
  // at — где кадр между прошлым и последним шагом: 1 — сам последний шаг (frame), 0.5 — посередине (advance)
  const draw = (at = 1) => {
    const lag = 1 - at
    const pipeShift = before.pipes ? SPEED * lag : 0
    for (let y = 0; y < GROUND; y++) {
      const color = y > GROUND - 60 ? SKY_LOW : SKY
      frame.fill(color, y * W, y * W + W)
    }
    // облака — медленнее труб
    const cloudShift = ((game.ticks - lag) * 0.3) % (W + 60)
    for (const [cx, cy] of [[40, 40], [150, 70], [230, 30]]) {
      const x = ((cx - cloudShift + W + 60) % (W + 60)) - 30
      fill(x, cy, 30, 8, CLOUD)
      fill(x + 6, cy - 5, 18, 6, CLOUD)
    }
    for (const pipe of game.pipes) {
      const p = { x: pipe.x + pipeShift, top: pipe.top }
      fill(p.x, 0, PIPE_W, p.top, PIPE)
      fill(p.x, p.top + GAP, PIPE_W, GROUND - p.top - GAP, PIPE)
      fill(p.x + 3, 0, 4, p.top, PIPE_LIGHT)
      fill(p.x + 3, p.top + GAP, 4, GROUND - p.top - GAP, PIPE_LIGHT)
      fill(p.x + PIPE_W - 4, 0, 4, p.top, PIPE_DARK)
      fill(p.x + PIPE_W - 4, p.top + GAP, 4, GROUND - p.top - GAP, PIPE_DARK)
      fill(p.x - 2, p.top - 8, PIPE_W + 4, 8, PIPE_DARK) // края труб
      fill(p.x - 1, p.top - 7, PIPE_W + 2, 6, PIPE)
      fill(p.x - 2, p.top + GAP, PIPE_W + 4, 8, PIPE_DARK)
      fill(p.x - 1, p.top + GAP + 1, PIPE_W + 2, 6, PIPE)
    }
    fill(0, GROUND, W, 6, GRASS)
    fill(0, GROUND + 6, W, H - GROUND - 6, DIRT)
    const scroll = game.scroll - (before.scroll ? SPEED * lag : 0)
    for (let x = -16; x < W + 16; x += 16) fill(x - scroll, GROUND + 10, 8, 3, DIRT_DARK)
    const sprite = BIRD_SPRITES[tiltIndex(game.angle)]
    const birdY = Math.round(before.birdY + (game.birdY - before.birdY) * at)
    for (let i = 0; i < sprite.length; i += 3) {
      const x = BIRD_X + sprite[i]
      const y = birdY + sprite[i + 1]
      if (x >= 0 && x < W && y >= 0 && y < H) frame[y * W + x] = sprite[i + 2]
    }
    if (game.state !== 'ready') number(game.score, W / 2, 14)
    onFrame?.(frame)
  }

  draw()
  // Наружу — сам объект игры: state, score, best, birdY и seed читаются обычными свойствами, без геттеров
  return Object.assign(game, {
    // Шаг на 1/60 секунды и кадр — как nes.frame()
    frame() {
      carry = 0
      step()
      draw()
    },
    // Столько шагов по 1/60 секунды, сколько прошло по часам, с долями: целые шаги — игра, остаток — где между двумя
    // шагами нарисовать кадр. Так птица летит ровно, даже когда кадры приходят неровно или не по 60 в секунду
    advance(steps) {
      carry = Math.min(carry + Math.max(0, steps), CATCH_UP)
      while (carry >= 1) {
        step()
        carry -= 1
      }
      draw(carry)
    },
    // Любая кнопка — взмах, по нажатию, а не по удержанию
    buttonDown(player, button) {
      if (held.has(button)) return
      held.add(button)
      flap()
    },
    buttonUp(player, button) {
      held.delete(button)
    },
  })
}

export { createFlappy, daySeed }
