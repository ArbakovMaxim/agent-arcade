// Arcade: рисунок питомца. Каждый вид — набор простых фигур на поле 64×64 (эллипсы, прямоугольники, многоугольники),
// из них — SVG с анимацией внутри (дыхание, моргание, ходьба, хвост и крылья — SMIL, без таймеров мода) и пиксели
// для терминала. Внешность своя: ни на каких известных персонажей не похожа

// Фигура: ['e', cx, cy, rx, ry, цвет] — эллипс; ['r', x, y, w, h, скругление, цвет]; ['p', [x1, y1, x2, y2, ...], цвет]
// Части вида: back — позади тела (хвост, крылья), body — тело с головой, front — поверх (лапки, животик), eyes —
// центры глаз и их размер, mouth — где рот, cheeks — румянец; adult — что добавляется взрослому
const INK = '#3a2e2a'
const BLUSH = '#ff8fa3'

export const SPECIES = ['robot', 'drop', 'owl', 'fox', 'dragon']

export const LOOKS = {
  // Робот: тело-бочонок, голова-экран, антенна с огоньком
  robot: {
    egg: ['#c9d6e3', '#7c93ad'],
    back: [],
    body: [
      ['r', 18, 34, 28, 22, 8, '#9fb4c9'],
      ['r', 14, 12, 36, 26, 10, '#b8cadb'],
      ['r', 18, 16, 28, 18, 7, '#2c3e50'],
    ],
    front: [
      ['r', 22, 55, 8, 5, 2, '#7c93ad'],
      ['r', 34, 55, 8, 5, 2, '#7c93ad'],
      ['e', 32, 45, 5, 4, '#ffd166'],
    ],
    eyes: { l: [26, 25], r: [38, 25], size: 3.2, color: '#7ee8fa', shape: 'r' },
    mouth: [32, 30],
    cheeks: false,
    adult: {
      back: [['r', 30.5, 4, 3, 9, 1.5, '#7c93ad']],
      top: [['e', 32, 4, 3.2, 3.2, '#ff6b6b']],
      front: [['r', 10, 37, 8, 4, 2, '#7c93ad'], ['r', 46, 37, 8, 4, 2, '#7c93ad']],
    },
    tail: null,
  },
  // Капля: мягкая капля-желе с бликом
  drop: {
    egg: ['#c8f7e1', '#4fd1a5'],
    back: [],
    body: [
      ['p', [32, 6, 44, 24, 50, 38, 48, 50, 40, 57, 24, 57, 16, 50, 14, 38, 20, 24], '#4fd1a5'],
      ['e', 32, 44, 18, 13, '#4fd1a5'],
      ['e', 24, 24, 3, 6, '#c8f7e1'],
    ],
    front: [['e', 32, 50, 10, 4, '#3cb88f']],
    eyes: { l: [26, 38], r: [38, 38], size: 3.4, color: INK, shape: 'e' },
    mouth: [32, 45],
    cheeks: true,
    adult: { back: [], top: [['e', 32, 7, 2.5, 2.5, '#c8f7e1']], front: [] },
    tail: null,
  },
  // Совёнок: круглый, большие глаза в светлых кругах, клювик, крылышки
  owl: {
    egg: ['#f3e3cf', '#a47551'],
    back: [],
    body: [
      ['e', 32, 36, 20, 21, '#a47551'],
      ['e', 32, 41, 13, 14, '#f3e3cf'],
      ['e', 25, 28, 7.5, 7.5, '#fff7ec'],
      ['e', 39, 28, 7.5, 7.5, '#fff7ec'],
    ],
    front: [
      ['p', [30, 33, 34, 33, 32, 37], '#f4a259'],
      ['e', 26, 56, 4, 2.5, '#f4a259'],
      ['e', 38, 56, 4, 2.5, '#f4a259'],
    ],
    eyes: { l: [25, 28], r: [39, 28], size: 3.6, color: INK, shape: 'e' },
    mouth: null,
    cheeks: false,
    adult: {
      back: [['p', [14, 12, 20, 20, 24, 16], '#8a5f3f'], ['p', [50, 12, 44, 20, 40, 16], '#8a5f3f']],
      top: [],
      front: [],
    },
    wings: [['e', 13, 40, 5, 10, '#8a5f3f'], ['e', 51, 40, 5, 10, '#8a5f3f']],
    tail: null,
  },
  // Лисёнок: рыжий, белая мордочка, ушки-треугольники, пушистый хвост
  fox: {
    egg: ['#ffe0c2', '#f28c38'],
    back: [],
    body: [
      ['p', [15, 22, 18, 6, 28, 16], '#f28c38'],
      ['p', [49, 22, 46, 6, 36, 16], '#f28c38'],
      ['p', [18, 18, 19, 10, 25, 16], '#4a2f27'],
      ['p', [46, 18, 45, 10, 39, 16], '#4a2f27'],
      ['e', 32, 46, 13, 11, '#f28c38'],
      ['e', 32, 48, 7, 8, '#fff3e6'],
      ['e', 32, 26, 17, 13, '#f28c38'],
      ['p', [18, 30, 32, 40, 46, 30, 40, 26, 24, 26], '#fff3e6'],
    ],
    front: [
      ['e', 32, 34, 2.4, 1.8, INK],
      ['e', 26, 57, 4, 2.5, '#4a2f27'],
      ['e', 38, 57, 4, 2.5, '#4a2f27'],
    ],
    eyes: { l: [25, 26], r: [39, 26], size: 2.8, color: INK, shape: 'e' },
    mouth: [32, 37],
    cheeks: true,
    adult: { back: [], top: [], front: [] },
    tail: { at: [44, 50], shapes: [['e', 52, 44, 7, 11, '#f28c38'], ['e', 54, 36, 4, 5, '#fff3e6']] },
  },
  // Дракончик: зелёный, жёлтое брюшко, рожки, крылышки, хвост со стрелкой
  dragon: {
    egg: ['#e3f5c7', '#6cbf4a'],
    back: [],
    body: [
      ['e', 32, 44, 14, 13, '#6cbf4a'],
      ['e', 32, 47, 8, 9, '#ffe08a'],
      ['e', 32, 24, 16, 13, '#6cbf4a'],
      ['e', 32, 30, 9, 5, '#8fd46c'],
    ],
    front: [
      ['e', 29, 30, 1, 1, '#3f7f2c'],
      ['e', 35, 30, 1, 1, '#3f7f2c'],
      ['e', 25, 57, 4.5, 2.5, '#4f9a35'],
      ['e', 39, 57, 4.5, 2.5, '#4f9a35'],
    ],
    eyes: { l: [26, 22], r: [38, 22], size: 3, color: INK, shape: 'e' },
    mouth: [32, 34],
    cheeks: true,
    adult: {
      back: [],
      top: [['p', [22, 14, 20, 4, 27, 12], '#ffe08a'], ['p', [42, 14, 44, 4, 37, 12], '#ffe08a']],
      front: [],
    },
    wings: [['p', [20, 40, 6, 30, 10, 46], '#4f9a35'], ['p', [44, 40, 58, 30, 54, 46], '#4f9a35']],
    tail: { at: [44, 52], shapes: [['p', [42, 52, 54, 50, 58, 42, 50, 56], '#6cbf4a'], ['p', [56, 40, 61, 42, 57, 46], '#ffe08a']] },
  },
}

// Одежда: слой поверх. slot — head, neck, face; shapes — на поле 64×64, сдвиг под вид — в FIT
export const WEAR = {
  cap: { slot: 'head', label: 'Кепка', shapes: [['e', 32, 13, 12, 6, '#e63946'], ['r', 20, 13, 24, 3, 1.5, '#e63946'], ['r', 36, 14, 14, 3, 1.5, '#b82d38']] },
  beanie: { slot: 'head', label: 'Шапка', shapes: [['e', 32, 13, 13, 8, '#457b9d'], ['r', 19, 13, 26, 4, 2, '#a8dadc'], ['e', 32, 4, 3, 3, '#f1faee']] },
  crown: { slot: 'head', label: 'Корона', shapes: [['p', [22, 15, 22, 6, 27, 11, 32, 4, 37, 11, 42, 6, 42, 15], '#ffd166'], ['e', 32, 10, 1.6, 1.6, '#e63946']] },
  scarf: { slot: 'neck', label: 'Шарф', shapes: [['r', 18, 35, 28, 5, 2.5, '#e76f51'], ['r', 36, 37, 6, 11, 2, '#e76f51'], ['r', 36, 44, 6, 2, 0, '#f4a261']] },
  bow: { slot: 'neck', label: 'Бабочка', shapes: [['p', [26, 33, 32, 36, 26, 39], '#9b5de5'], ['p', [38, 33, 32, 36, 38, 39], '#9b5de5'], ['e', 32, 36, 1.8, 1.8, '#7b3fc4']] },
  glasses: { slot: 'face', label: 'Очки', shapes: [['e', 25, 25, 5, 4.5, 'none'], ['e', 39, 25, 5, 4.5, 'none'], ['r', 29.5, 24, 5, 1.2, 0, INK]], ring: true },
  // Из лавки за монетки (0.61, SHOP в pet.js)
  tophat: { slot: 'head', label: 'Цилиндр', shapes: [['r', 23, 0, 18, 14, 1.5, '#2b2d42'], ['r', 18, 12, 28, 3.5, 1.5, '#2b2d42'], ['r', 23, 9, 18, 3, 0, '#e63946']] },
  party: { slot: 'head', label: 'Колпак', shapes: [['p', [23, 15, 32, -3, 41, 15], '#f15bb5'], ['e', 32, -3, 2.6, 2.6, '#ffd166'], ['r', 28, 7, 2, 2, 0, '#ffd166'], ['r', 34, 10, 2, 2, 0, '#ffd166']] },
  shades: { slot: 'face', label: 'Тёмные очки', shapes: [['e', 25, 25, 5.5, 4, '#1d1d1f'], ['e', 39, 25, 5.5, 4, '#1d1d1f'], ['r', 29.5, 24, 5, 1.2, 0, INK], ['r', 22, 23, 2.5, 1, 0, '#ffffff'], ['r', 36, 23, 2.5, 1, 0, '#ffffff']] },
  cape: { slot: 'neck', label: 'Плащ', shapes: [['p', [19, 35, 11, 54, 21, 51], '#c1121f'], ['p', [45, 35, 53, 54, 43, 51], '#c1121f'], ['r', 19, 33, 26, 4, 2, '#c1121f'], ['e', 32, 35.5, 2.2, 2.2, '#ffd166']] },
  bandana: { slot: 'neck', label: 'Бандана', shapes: [['p', [20, 34, 44, 34, 32, 45], '#3a86ff'], ['r', 27, 36, 1.6, 1.6, 0, '#ffffff'], ['r', 35.5, 36, 1.6, 1.6, 0, '#ffffff'], ['r', 31.2, 40, 1.6, 1.6, 0, '#ffffff']] },
}

// Куда сдвинуть одежду на каждом виде: [dx, dy] для головы, шеи и лица
const FIT = {
  robot: { head: [0, -2], neck: [0, 1], face: [0, 0] },
  drop: { head: [0, -2], neck: [0, 9], face: [0, 13] },
  owl: { head: [0, 4], neck: [0, 3], face: [0, 3] },
  fox: { head: [0, -2], neck: [0, 3], face: [0, 1] },
  dragon: { head: [0, -2], neck: [0, 3], face: [0, -3] },
}

// ━━━━━━━━━━ SVG ━━━━━━━━━━

const num = (n) => String(Math.round(n * 100) / 100)
function shapeSvg(s, extra = '') {
  if (s[0] === 'e') return `<ellipse cx="${num(s[1])}" cy="${num(s[2])}" rx="${num(s[3])}" ry="${num(s[4])}" fill="${s[5]}"${extra}/>`
  if (s[0] === 'r') return `<rect x="${num(s[1])}" y="${num(s[2])}" width="${num(s[3])}" height="${num(s[4])}" rx="${num(s[5])}" fill="${s[6]}"${extra}/>`
  const pts = []
  for (let i = 0; i < s[1].length; i += 2) pts.push(`${num(s[1][i])},${num(s[1][i + 1])}`)
  return `<polygon points="${pts.join(' ')}" fill="${s[2]}" stroke-linejoin="round"${extra}/>`
}
const outline = (list) => list.map((s) => shapeSvg(s, ` stroke="${INK}" stroke-width="1.4"`)).join('')
const plain = (list) => list.map((s) => shapeSvg(s)).join('')
// Повтор вокруг точки: SMIL крутит и масштабирует от (0, 0), поэтому — сдвиг туда и обратно
const around = (x, y, anim, inner) => `<g transform="translate(${x} ${y})"><g>${anim}<g transform="translate(${-x} ${-y})">${inner}</g></g></g>`
const loop = (type, values, dur, extra = '') => `<animateTransform attributeName="transform" type="${type}" values="${values}" dur="${dur}s" repeatCount="indefinite"${extra}/>`

// ━━━━━━━━━━ кадры вместо плавности (п. 48) ━━━━━━━━━━
// Бесконечную SMIL-петлю с конечной длительностью Chromium пересчитывает и перерисовывает каждый кадр экрана, 60 раз
// в секунду: гуляющий питомец стоил в Desktop ~85 % одного ядра. Здесь каждая такая петля становится цепочкой
// неподвижных кадров на общей сетке STEP секунд. У кадра dur="indefinite" — значение во времени не меняется, и Chromium
// просыпается только на границах кадров, не чаще 1 / STEP раз в секунду. Круг повторяет якорь <set> (begin="…;id.end"),
// кадры отсчитываются от его начала. Длина круга и начало округляются до сетки, чтобы все петли будили картинку
// в одни и те же моменты. Разовые анимации (вход, прыжки, сердечки) остаются плавными: они идут секунду-две и затихают.
// 0,2 с — 5 кадров в секунду: в стенде Chromium полоса стоила 52 % ядра, с кадрами по 0,125 с — 9,5 %, по 0,2 с — 4,5 %
const STEP = 0.2
const ANIM = /<(animateTransform|animate)\b([^>]*?)\/>/g
const SMIL_ATTR = /([a-zA-Z]+)="([^"]*)"/g
const sec = (t) => String(Math.round(t * 1000) / 1000)
export function stepFrames(svg, step = STEP) {
  const anchors = new Map()
  const out = svg.replace(ANIM, (whole, tag, body) => {
    const a = {}
    for (const [, k, v] of body.matchAll(SMIL_ATTR)) a[k] = v
    if (a.repeatCount !== 'indefinite' || !a.values || !/^\d+(\.\d+)?s$/.test(a.dur ?? '') || !/^(\d+(\.\d+)?s)?$/.test(a.begin ?? '')) return whole
    const discrete = a.calcMode === 'discrete'
    const vals = a.values.split(';').map((s) => s.trim().split(/[\s,]+/).map(Number))
    const n = vals.length
    const keys = a.keyTimes ? a.keyTimes.split(';').map(Number) : vals.map((_, i) => (discrete ? i / n : n > 1 ? i / (n - 1) : 0))
    if (keys.length !== n || [...keys, ...vals.flat()].some((v) => !Number.isFinite(v))) return whole
    // Значение в доле круга p: как у SMIL — ступенькой при discrete, иначе по прямой между соседними ключами
    const at = (p) => {
      let i = 0
      while (i + 1 < n && keys[i + 1] <= p) i++
      if (discrete || i + 1 >= n) return vals[i]
      const f = (p - keys[i]) / (keys[i + 1] - keys[i] || 1)
      return vals[i].map((v, j) => v + ((vals[i + 1][j] ?? v) - v) * f)
    }
    const steps = Math.max(2, Math.round(parseFloat(a.dur) / step))
    const begin = Math.round((parseFloat(a.begin ?? '0') || 0) / step) * step
    const key = `${sec(begin)}|${steps}`
    if (!anchors.has(key)) anchors.set(key, { id: `k${anchors.size}`, begin, period: steps * step })
    const { id } = anchors.get(key)
    const frames = []
    for (let s = 0; s < steps; s++) {
      const v = at(s / steps).map(num).join(' ')
      if (!frames.length || frames.at(-1).v !== v) frames.push({ t: s * step, v })
    }
    const head = `<${tag} attributeName="${a.attributeName}"${a.type ? ` type="${a.type}"` : ''}${a.additive ? ` additive="${a.additive}"` : ''} dur="indefinite"`
    if (frames.length === 1) return `${head} values="${frames[0].v}" begin="${id}.begin"/>`
    const from = (t) => (t ? `${id}.begin+${sec(t)}s` : `${id}.begin`)
    return frames.map((f, i) => `${head} values="${f.v}" begin="${from(f.t)}" end="${i + 1 < frames.length ? from(frames[i + 1].t) : `${id}.end`}"/>`).join('')
  })
  if (!anchors.size) return out
  const sets = [...anchors.values()].map(({ id, begin, period }) => `<set id="${id}" attributeName="visibility" to="visible" begin="${sec(begin)}s;${id}.end" dur="${sec(period)}s"/>`).join('')
  // Якоря — в пустой группе: <set> меняет только её
  return out.replace(/^(<svg\b[^>]*>)/, `$1<g>${sets}</g>`)
}

// Глаза по настроению: open — открыты и моргают, shut — сон (дуги), sad — полуприкрыты, happy — дуги-улыбки, look — вверх
function eyesSvg(look, mood, baby) {
  const e = look.eyes
  const size = e.size * (baby ? 1.2 : 1)
  const one = ([x, y]) => {
    if (mood === 'sleep') return `<path d="M${num(x - size)} ${num(y)} q${num(size)} ${num(size * 0.9)} ${num(size * 2)} 0" fill="none" stroke="${INK}" stroke-width="1.4" stroke-linecap="round"/>`
    if (mood === 'happy') return `<path d="M${num(x - size)} ${num(y + 1)} q${num(size)} ${num(-size * 1.4)} ${num(size * 2)} 0" fill="none" stroke="${e.color === INK ? INK : e.color}" stroke-width="1.6" stroke-linecap="round"/>`
    const eye = e.shape === 'r' ? ['r', x - size * 0.8, y - size, size * 1.6, size * 2, 1, e.color] : ['e', x, y, size * 0.85, size, e.color]
    const shine = e.color === INK ? `<ellipse cx="${num(x + size * 0.3)}" cy="${num(y - size * 0.4)}" rx="${num(size * 0.3)}" ry="${num(size * 0.3)}" fill="#fff"/>` : ''
    const lid = mood === 'sad' ? `<rect x="${num(x - size * 1.1)}" y="${num(y - size * 1.2)}" width="${num(size * 2.2)}" height="${num(size * 0.9)}" fill="${lidColor(look)}"/>` : ''
    return shapeSvg(eye) + shine + lid
  }
  const blink = mood === 'sleep' || mood === 'happy' ? '' : loop('scale', '1 1;1 1;1 0.1;1 1', 4.2, ' keyTimes="0;0.9;0.95;1"')
  const both = one(e.l) + one(e.r)
  return blink ? around((e.l[0] + e.r[0]) / 2, e.l[1], blink, both) : both
}
const lidColor = (look) => (look === LOOKS.robot ? '#2c3e50' : look === LOOKS.owl ? '#fff7ec' : look.body[look === LOOKS.drop ? 0 : look.body.length - 2]?.at(-1) ?? '#888')

function mouthSvg(look, mood) {
  if (!look.mouth) return ''
  const [x, y] = look.mouth
  if (mood === 'eat') return `<ellipse cx="${x}" cy="${y + 1}" rx="2.6" ry="2.2" fill="${INK}">${'<animate attributeName="ry" values="2.2;0.6;2.2" dur="0.5s" repeatCount="indefinite"/>'}</ellipse>`
  if (mood === 'sad') return `<path d="M${x - 3} ${y + 2} q3 -3 6 0" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`
  if (mood === 'sleep') return `<ellipse cx="${x}" cy="${y + 1}" rx="1.2" ry="1" fill="${INK}"/>`
  return `<path d="M${x - 3} ${y} q3 3 6 0" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`
}

// Сердечки после «погладить»: всплывают и тают один раз (begin — сразу при показе картинки)
const HEART = 'M0 2 C0 -1 4 -1 4 2 C4 -1 8 -1 8 2 C8 5 4 7 4 9 C4 7 0 5 0 2 Z'
const hearts = () =>
  [
    [10, 22, 0],
    [46, 18, 0.25],
    [28, 10, 0.5],
  ]
    .map(
      ([x, y, d]) =>
        `<g opacity="0"><path d="${HEART}" fill="#ff5d8f" transform="translate(${x} ${y})"/><animate attributeName="opacity" values="0;1;1;0" keyTimes="0;0.15;0.7;1" begin="${d}s" dur="1.8s" repeatCount="2"/><animateTransform attributeName="transform" type="translate" values="0 6;0 -6" begin="${d}s" dur="1.8s" repeatCount="2"/></g>`,
    )
    .join('')
// Сон: «z» всплывают; still — дрёма (п. 49): две «z» стоят лесенкой, без движения
const zzz = (still = false) =>
  still
    ? [[47, 20, 8], [54, 12, 10]].map(([x, y, s]) => `<text x="${x}" y="${y}" font-family="sans-serif" font-size="${s}" font-weight="700" fill="#8aa1c1">z</text>`).join('')
    : [0, 1.2].map((d) => `<text x="48" y="18" font-family="sans-serif" font-size="9" font-weight="700" fill="#8aa1c1" opacity="0">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${d}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;5 -6" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></text>`).join('')
// Еда: печенька у рта, тает
const cookie = (look) => {
  const [x, y] = look.mouth ?? [32, 34]
  return `<g><circle cx="${x + 9}" cy="${y + 2}" r="4" fill="#d9a066" stroke="${INK}" stroke-width="1"/><circle cx="${x + 8}" cy="${y + 1}" r="0.8" fill="#6b3e26"/><circle cx="${x + 10.5}" cy="${y + 3}" r="0.8" fill="#6b3e26"/><animateTransform attributeName="transform" type="scale" values="1;0.2" dur="2.5s" fill="freeze" additive="sum"/><animate attributeName="opacity" values="1;0" dur="2.5s" fill="freeze"/></g>`
}
// Грусть: капелька
const tear = (look) => `<ellipse cx="${look.eyes.l[0] - 1}" cy="${look.eyes.l[1] + 5}" rx="1.3" ry="2" fill="#7ec8f7"><animate attributeName="cy" values="${look.eyes.l[1] + 4};${look.eyes.l[1] + 12}" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="2.2s" repeatCount="indefinite"/></ellipse>`

// Яйцо вида: скорлупа в пятнышках, покачивается
function eggShell(look, mood) {
  const [light, dark] = look.egg
  const shell = `<ellipse cx="32" cy="38" rx="16" ry="20" fill="${light}" stroke="${INK}" stroke-width="1.4"/><ellipse cx="25" cy="32" rx="3.5" ry="2.5" fill="${dark}"/><ellipse cx="38" cy="42" rx="4" ry="3" fill="${dark}"/><ellipse cx="30" cy="50" rx="2.5" ry="2" fill="${dark}"/><ellipse cx="38" cy="26" rx="2" ry="1.6" fill="${dark}"/>`
  const rock = mood === 'sleep' ? loop('rotate', '0;2;0;-2;0', 6) : loop('rotate', '0;0;-7;6;-4;0;0', 2.6, ' keyTimes="0;0.5;0.62;0.74;0.86;0.95;1"')
  return around(32, 58, rock, shell)
}
function eggSvg(look, mood, still = false) {
  return `<ellipse cx="32" cy="59" rx="13" ry="2.5" fill="#00000022"/>${eggShell(look, mood)}${mood === 'sleep' ? zzz(still) : ''}`
}

// Неподвижная картинка (п. 49, дрёма): все движения убраны, каждая часть стоит в своём первом кадре — Chromium
// рисует её один раз и больше не будит
export const stillSvg = (svg) => svg.replace(/<(animateTransform|animate|set)\b[^>]*\/>/g, '')

// Слой одежды на виде
function wearSvg(species, ids) {
  let out = ''
  for (const id of ids) {
    const w = WEAR[id]
    if (!w) continue
    const [dx, dy] = FIT[species]?.[w.slot] ?? [0, 0]
    const inner = w.ring ? w.shapes.map((s) => (s[0] === 'e' ? shapeSvg(s, ` stroke="${INK}" stroke-width="1.4" fill-opacity="0"`).replace('fill="none"', 'fill="#ffffff"') : shapeSvg(s))).join('') : outline(w.shapes.filter((s) => s[0] !== 'r' || s[5] > 0)) + plain(w.shapes.filter((s) => s[0] === 'r' && s[5] === 0))
    out += `<g transform="translate(${dx} ${dy})">${inner}</g>`
  }
  return out
}

// Облик взрослого (0.59): значок на груди по стилю работы — мастер карточек (зелёный, галочка), ревьюер (синий, лупа),
// бегун очередей (оранжевый, молния). FORM_AT — где грудь у каждого вида
export const FORM_COLOR = { maker: '#30a46c', reviewer: '#3e8ed0', runner: '#f08c00' }
const FORM_AT = { robot: [32, 45], drop: [32, 52], owl: [32, 47], fox: [32, 49], dragon: [32, 48] }
const FORM_MARK = {
  maker: '<path d="M-2.1 0.1 L-0.6 1.7 L2.2 -1.5" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>',
  reviewer: '<circle cx="-0.6" cy="-0.6" r="1.6" fill="none" stroke="#fff" stroke-width="1"/><path d="M0.6 0.6 L2.1 2.1" stroke="#fff" stroke-width="1.2" stroke-linecap="round"/>',
  runner: '<path d="M0.7 -2.7 L-1.9 0.5 H0 L-0.7 2.7 L1.9 -0.5 H0 Z" fill="#fff"/>',
}
function formSvg(species, form) {
  if (!FORM_COLOR[form]) return ''
  const [x, y] = FORM_AT[species] ?? [32, 46]
  return `<g transform="translate(${x} ${y})"><circle r="4" fill="${FORM_COLOR[form]}" stroke="${INK}" stroke-width="1"/>${FORM_MARK[form]}</g>`
}

// Питомец целиком: species — вид, stage — egg / baby / adult, mood — idle / happy / eat / sleep / sad, wear — надетое,
// pat — показать сердечки. walk — ходить по полю (на большом экране); на маленькой картинке стоит на месте и дышит.
// form — облик взрослого (formOf в pet.js)
// grab — отзываться на мышь (п. 49): только для картинки с isInteractive
export function petSvg({ species, stage = 'baby', mood = 'idle', wear = [], pat = false, walk = true, size = 128, form = '', grab = false }) {
  const look = LOOKS[species] ?? LOOKS.robot
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">`
  const g = grab ? grabbable : (x) => x
  if (stage === 'egg') return stepFrames(`${head}${g(eggSvg(look, mood))}${pat ? hearts() : ''}</svg>`)
  const baby = stage === 'baby'
  let body = petFigure({ species, stage, mood, wear, form })
  if (mood === 'happy') body = `<g>${loop('translate', '0 0;0 -9;0 0;0 0', 0.7, ' keyTimes="0;0.35;0.7;1"')}${body}</g>`
  // Ходьба: туда-сюда по полю, разворот на краях, лёгкое покачивание шага
  else if (walk && mood === 'idle')
    body = `<g>${loop('translate', '0 0;-12 0;-12 0;12 0;12 0;0 0', 14, ' keyTimes="0;0.2;0.3;0.7;0.8;1"')}<g>${loop('translate', '0 0;0 -1.5;0 0', 0.45)}${around(32, 0, '<animateTransform attributeName="transform" type="scale" values="1 1;-1 1;1 1" keyTimes="0;0.3;0.8" dur="14s" calcMode="discrete" repeatCount="indefinite"/>', body)}</g></g>`
  const shadow = `<ellipse cx="32" cy="59" rx="${baby ? 11 : 14}" ry="2.5" fill="#00000022"/>`
  return stepFrames(`${head}${shadow}${g(body)}${pat ? hearts() : ''}${mood === 'sleep' ? zzz() : ''}</svg>`)
}

// Фигура вида без рамки svg — на поле 64×64, ноги на y = 58: тело с дыханием, малыш меньше. extra — что нарисовать
// поверх в тех же координатах (качается и растёт вместе с телом); tailAnim — своё движение хвоста вместо обычного;
// rush — сколько секунд с начала крылья машут часто (полёт на входе), потом — как обычно
const RUSH_BEAT = 0.2
function petFigure({ species, stage = 'baby', mood = 'idle', wear = [], extra = '', tailAnim = null, rush = 0, form = '' }) {
  const look = LOOKS[species] ?? LOOKS.robot
  const baby = stage === 'baby'
  const adult = baby ? { back: [], top: [], front: [] } : look.adult
  const flap = mood === 'happy' ? 0.35 : mood === 'sad' || mood === 'sleep' ? 0 : 1.6
  // Частые взмахи — на входе, обычные начинаются, когда частые кончились
  const beats = Math.max(1, Math.round(rush / RUSH_BEAT))
  const wings = look.wings
    ? look.wings
        .map((w, i) => {
          const [x, y] = w[0] === 'e' ? [w[1], w[2] - w[4] * 0.6] : [w[1][0], w[1][1]]
          const fast = rush ? `<animateTransform attributeName="transform" type="rotate" values="${i ? '0;-26;0' : '0;26;0'}" dur="${RUSH_BEAT}s" repeatCount="${beats}"/>` : ''
          // Обычные взмахи начинаются после частых: кадры петли (stepFrames) начинаются позже и иначе перебили бы их
          const after = rush ? ` begin="${sec(beats * RUSH_BEAT)}s"` : ''
          return flap || rush ? around(x, y, (flap ? loop('rotate', i ? '0;-14;0' : '0;14;0', flap, after) : '') + fast, outline([w])) : outline([w])
        })
        .join('')
    : ''
  const tail = look.tail ? around(look.tail.at[0], look.tail.at[1], tailAnim ?? (mood === 'sleep' ? '' : loop('rotate', '0;12;0;-6;0', mood === 'happy' ? 0.5 : mood === 'sad' ? 3.5 : 1.4)), outline(look.tail.shapes)) : ''
  const cheeks = look.cheeks && mood !== 'sad' ? `<ellipse cx="${look.eyes.l[0] - 4}" cy="${look.eyes.l[1] + 5}" rx="3" ry="1.8" fill="${BLUSH}" opacity="0.6"/><ellipse cx="${look.eyes.r[0] + 4}" cy="${look.eyes.r[1] + 5}" rx="3" ry="1.8" fill="${BLUSH}" opacity="0.6"/>` : ''
  const light = look === LOOKS.robot && !baby ? `<ellipse cx="32" cy="4" rx="3.2" ry="3.2" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;0.8;0" dur="1.6s" repeatCount="indefinite"/></ellipse>` : ''
  const figure =
    outline(adult.back) +
    tail +
    wings +
    outline(look.body.slice(0, 1)) +
    plain(look.body.slice(1)) +
    outline(adult.top) +
    light +
    plain(look.front) +
    outline(adult.front) +
    cheeks +
    eyesSvg(look, mood, baby) +
    mouthSvg(look, mood) +
    (baby ? '' : formSvg(species, form)) +
    wearSvg(species, wear) +
    (mood === 'eat' ? cookie(look) : '') +
    (mood === 'sad' ? tear(look) : '') +
    extra
  // Дыхание — от ног; малыш меньше; грусть — ниже и медленнее
  const breath = mood === 'sleep' ? loop('scale', '1 1;1.04 0.95;1 1', 3.6) : mood === 'sad' ? loop('scale', '1 0.97;1.01 0.95;1 0.97', 3) : loop('scale', '1 1;1.025 0.97;1 1', 2.2)
  const body = around(32, 58, breath, figure)
  return baby ? `<g transform="translate(32 58) scale(0.82) translate(-32 -58)">${body}</g>` : body
}

// ━━━━━━━━━━ маленький питомец на других экранах ━━━━━━━━━━
// П. 45: сидит справа в шапке Arcade и спускается к краю окна, когда пролистали вниз. Входит своей анимацией один раз
// (enter): дракон слетает, сова пикирует, лиса спрыгивает, капля стекает, робот спускается на тросе, яйцо падает и
// качается; потом сидит и дышит. Вход — SMIL без повторов (fill="freeze"), таймеров нет. Одинаковые входные данные —
// одинаковая картинка
const ENTER_S = 1.6 // секунд на вход
const BADGE_MOOD = { treat: 'eat', happy: 'happy', done: 'happy', wait: 'sad', hungry: 'sad', sad: 'sad', sleep: 'sleep', idle: 'idle' }
// Разовое движение входа: values и keyTimes — через «;», в конце — на месте
const once = (type, values, keyTimes, extra = '') => `<animateTransform attributeName="transform" type="${type}" values="${values}" keyTimes="${keyTimes}" dur="${ENTER_S}s" fill="freeze"${extra}/>`
// Сжать или вытянуть от ног (32, 58)
const fromFeet = (anim, inner) => `<g transform="translate(32 58)"><g>${anim}<g transform="translate(-32 -58)">${inner}</g></g></g>`
const ENTERS = {
  // Слетает сверху слева, покачиваясь, с наклоном вперёд; у земли — лёгкий отскок
  dragon: (fig) =>
    `<g>${once('translate', '-44 -54;-30 -36;-20 -32;-8 -12;0 0;0 -3;0 0', '0;0.25;0.4;0.62;0.8;0.9;1')}<g>${once('rotate', '-18 32 40;-8 32 40;6 32 40;0 32 40', '0;0.4;0.75;1')}${fig}</g></g>`,
  // Пикирует по дуге сверху справа: клювом вниз, у земли выравнивается
  owl: (fig) => `<g>${once('translate', '44 -56;26 -18;8 3;0 0;0 -2;0 0', '0;0.35;0.62;0.78;0.9;1')}<g>${once('rotate', '30 32 40;22 32 40;-8 32 40;0 32 40', '0;0.35;0.7;1')}${fig}</g></g>`,
  // Спрыгивает сверху слева дугой и приседает при приземлении
  fox: (fig) => `<g>${once('translate', '-40 -40;-30 -54;-18 -50;-7 -26;0 0;0 0', '0;0.14;0.3;0.48;0.62;1')}${fromFeet(once('scale', '1 1;1 1;1.18 0.8;0.94 1.08;1 1', '0;0.62;0.7;0.82;1'), fig)}</g>`,
  // Капля вытягивается у верхнего края, срывается, плюхается и выпрямляется; ниточка сверху тает
  drop: (fig) =>
    `<line x1="32" y1="0" x2="32" y2="9" stroke="#7ec8f7" stroke-width="1.4" stroke-linecap="round" opacity="0"><animate attributeName="opacity" values="0.9;0.9;0" keyTimes="0;0.3;0.5" dur="${ENTER_S}s" fill="freeze"/></line>` +
    `<g>${once('translate', '0 -52;0 -46;0 0;0 0', '0;0.3;0.58;1', ' calcMode="spline" keySplines="0 0 1 1;0.5 0 1 1;0 0 1 1"')}${fromFeet(once('scale', '0.5 1.5;0.6 1.4;0.75 1.3;1.35 0.65;0.92 1.1;1 1', '0;0.3;0.56;0.66;0.82;1'), fig)}</g>`,
  // Спускается на тросе и чуть пружинит; потом трос уезжает вверх
  robot: (fig, top) =>
    `<g>${once('translate', '0 -70;0 -6;0 0;0 -3;0 0;0 0', '0;0.45;0.6;0.72;0.84;1')}<g><animateTransform attributeName="transform" type="translate" values="0 0;0 -80" begin="${ENTER_S * 0.75}s" dur="0.5s" fill="freeze"/><line x1="32" y1="-80" x2="32" y2="${top}" stroke="#5b6b7a" stroke-width="1.2"/><circle cx="32" cy="${top}" r="1.6" fill="#5b6b7a"/></g>${fig}</g>`,
  // Яйцо падает сверху и качается
  egg: (fig) => `<g>${once('translate', '0 -60;0 0;0 -6;0 0;0 0', '0;0.45;0.6;0.75;1')}<g>${once('rotate', '0 32 58;0 32 58;-10 32 58;8 32 58;-4 32 58;0 32 58', '0;0.45;0.6;0.75;0.88;1')}${fig}</g></g>`,
}

// reaction — как у полосы (walkReaction); enter — проиграть вход; size — сторона картинки в пикселях
// play — живая картинка (0.65): выше на столько пикселей, отклик на мышь внутри (playable)
export function petBadgeSvg({ species, stage = 'baby', wear = [], reaction = 'idle', enter = true, size = 48, form = '', still = false, play = 0 }) {
  const mood = BADGE_MOOD[reaction] ?? 'idle'
  const egg = stage === 'egg' || !LOOKS[species]
  const kind = egg ? 'egg' : species
  const flies = kind === 'dragon' || kind === 'owl'
  const fig = egg
    ? eggShell(LOOKS[species] ?? { egg: ['#f1e4d3', '#c9a77c'] }, mood === 'sleep' ? 'sleep' : 'idle')
    : petFigure({ species, stage, mood, wear, form, rush: enter && flies ? ENTER_S : 0 })
  // Трос робота — до макушки: у взрослого антенна выше, малыш меньше
  const top = stage === 'adult' ? 3 : 20
  const rx = egg ? 13 : stage === 'baby' ? 11 : 14
  const shadow = `<ellipse cx="32" cy="59" rx="${rx}" ry="2.5" fill="#00000022">${enter ? `<animate attributeName="rx" values="2;${rx}" dur="${ENTER_S}s" fill="freeze"/>` : ''}</ellipse>`
  const body = (enter ? ENTERS[kind](fig, top) : fig) + (mood === 'sleep' ? zzz(still) : '')
  const svg = `${frame(0, size, play)}${shadow}${play ? playable(body) : body}</svg>`
  return still ? stillSvg(svg) : stepFrames(svg)
}

// ━━━━━━━━━━ питомец под мышкой (п. 49, часть 3) ━━━━━━━━━━
// Плагину мышь не видна, скриптов в картинке нет: отклик на мышь — только CSS внутри картинки с isInteractive.
// Навёл — подпрыгивает два раза и затихает; нажал — тянется вверх, будто его оттянули; отпустил — пружинит обратно.
// Обёртка .grab без своего transform: SMIL движет то, что внутри, CSS — саму обёртку, они не спорят
const GRAB_CSS =
  '<style>.grab{cursor:grab;transform-box:fill-box;transform-origin:50% 100%;transition:transform .35s cubic-bezier(.3,1.8,.5,1)}.grab:hover{animation:hop .45s ease-out 2}.grab:active{animation:none;cursor:grabbing;transform:scale(.8,1.3);transition-duration:.12s}@keyframes hop{50%{transform:translateY(-5px)}}</style>'
export const grabbable = (inner) => `${GRAB_CSS}<g class="grab">${inner}</g>`

// Маленький питомец живой картинкой (0.65): то же, что grabbable, и ещё — навёл, над головой всплывает сердечко;
// держишь дольше PLAY_TUG_S — вырывается, покачиваясь. Сердечко — после .grab: ловит наведение только сам питомец
const PLAY_TUG_S = 0.7
const PLAY_CSS =
  '<style>.grab{cursor:grab;transform-box:fill-box;transform-origin:50% 100%;transition:transform .35s cubic-bezier(.3,1.8,.5,1)}.grab:hover{animation:hop .45s ease-out 2}' +
  `.grab:active{cursor:grabbing;transform:scale(.8,1.3);transition-duration:.12s;animation:tug .24s ${PLAY_TUG_S}s infinite}` +
  '.love{opacity:0;pointer-events:none;transform-box:fill-box;transform-origin:50% 100%}.grab:hover~.love{animation:love 1.2s ease-out}' +
  '@keyframes hop{50%{transform:translateY(-5px)}}@keyframes tug{0%,100%{transform:scale(.8,1.3) rotate(-7deg)}50%{transform:scale(.8,1.3) rotate(7deg)}}' +
  '@keyframes love{0%{opacity:0;transform:translateY(4px) scale(.5)}25%{opacity:1}100%{opacity:0;transform:translateY(-16px) scale(1.1)}}</style>'
const LOVE = '<g class="love"><path d="M46 4.6c-1.6-2.6-5.2-1.4-4.6 1.3.4 1.9 2.8 3.2 4.6 4.7 1.8-1.5 4.2-2.8 4.6-4.7.6-2.7-3-3.9-4.6-1.3z" fill="#ff6b8b"/></g>'
export const playable = (inner) => `${PLAY_CSS}<g class="grab">${inner}</g>${LOVE}`

// Окно маленького питомца: 64 × 64 единицы от y. play — живая картинка выше на столько пикселей: есть куда
// подпрыгнуть, вытянуться и пустить сердечко; питомец в ней стоит у нижнего края, как без запаса
function frame(y, size, play) {
  if (!play) return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${y} 64 64" width="${size}" height="${size}">`
  const k = 64 / size
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${num(y - play * k)} 64 ${num(64 + play * k)}" width="${size}" height="${size + play}">`
}

// Маленький питомец, неподвижный и довольный: на плитке, куда он прыгнул сам (0.65). Без входа и без петель —
// между прыжками картинка ничего не стоит
function petPose({ species, stage, wear, form }) {
  const egg = stage === 'egg' || !LOOKS[species]
  const fig = egg ? eggShell(LOOKS[species] ?? { egg: ['#f1e4d3', '#c9a77c'] }, 'idle') : petFigure({ species, stage, mood: 'happy', wear, form })
  const rx = egg ? 13 : stage === 'baby' ? 11 : 14
  return { shadow: `<ellipse cx="32" cy="59" rx="${rx}" ry="2.5" fill="#00000022"/>`, fig: stillSvg(fig) }
}

// На плитке (п. 49, 0.65): прыгнул сам — стоит на её верхнем крае. Рамка на 2 единицы выше
// поля: ноги — у нижнего края картинки, на рамке плитки. Один короткий прыжок-приземление, без повторов.
// hop — с какой высоты он приземляется, в единицах картинки (0.65: прыжки по плиткам — выше); 0 — просто стоит.
// play — живая картинка, как у petBadgeSvg
export function petPerchSvg({ species, stage = 'baby', wear = [], form = '', size = 48, hop = 10, play = 0 }) {
  const { shadow, fig } = petPose({ species, stage, wear, form })
  const land = hop ? `<animateTransform attributeName="transform" type="translate" values="0 -${hop};0 0;0 -${Math.round(hop * 0.3)};0 0" keyTimes="0;0.5;0.75;1" dur="0.4s" fill="freeze"/>` : ''
  const body = `<g>${land}${fig}</g>`
  return `${frame(-2, size, play)}${shadow}${play ? playable(body) : body}</svg>`
}

// ━━━━━━━━━━ полоса на главном экране ━━━━━━━━━━
// Питомец гуляет по полосе во всю ширину под шапкой Arcade. Всё движение — SMIL внутри картинки одним кругом в LOOP
// секунд: дошёл до места, пошалил, огляделся, присел и зевнул, вернулся. Какую шалость показать — решает Arcade
// при перерисовке (pickScene), таймеров нет. Шалости только рисуются: ничего не нажимают и не закрывают

export const PET_SCENES = ['peek', 'star', 'ball', 'butterfly', 'hat', 'hops', 'gesture']
// Трюки за серии (0.59): показываются среди шалостей, когда открыты (tricksOf в pet.js)
export const TRICK_SCENES = ['twirl', 'leap', 'dance', 'confetti', 'rainbow']
// Игрушки и трюки из лавки (0.61): воздушный змей, мыльные пузыри, прыжки мячиком, салют
export const SHOP_SCENES = ['kite', 'bubbles', 'bounce', 'fireworks']

// Какую шалость показать: r — случайное число 0..1, prev — прошлая (подряд не повторяется), hat — есть ли что-то
// на голове (иначе ронять нечего), tricks — открытые трюки и купленные игрушки (добавляются к шалостям)
export function pickScene(r, prev = '', { hat = true, tricks = [] } = {}) {
  const list = [...PET_SCENES, ...[...TRICK_SCENES, ...SHOP_SCENES].filter((s) => tricks.includes(s))].filter((s) => s !== prev && (hat || s !== 'hat'))
  return list[Math.min(list.length - 1, Math.max(0, Math.floor(r * list.length)))]
}

const LOOP = 24 // секунд в круге полосы
const K = 0.9 // размер питомца на полосе относительно поля 64×64
const r1 = (n) => String(Math.round(n * 10) / 10)
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))
const paint = (s) => (s[0] === 'e' ? s[5] : s[0] === 'r' ? s[6] : s[2])

// Дорожка анимации по кадрам [секунда, значение] на круге LOOP. begin — после вступления (радость, угощение),
// discrete — без плавности (разворот), additive — поверх другой анимации того же элемента
function track(type, frames, { begin = 0, discrete = false, additive = false } = {}) {
  const keys = []
  const vals = []
  for (const [t, v] of frames) {
    let k = Math.round((clamp(t, 0, LOOP) / LOOP) * 10000)
    if (keys.length && k <= keys.at(-1)) k = keys.at(-1) + 1
    if (k > 10000) break
    keys.push(k)
    vals.push(v)
  }
  if (keys[0] !== 0) {
    keys.unshift(0)
    vals.unshift(vals[0])
  }
  if (!discrete && keys.at(-1) !== 10000) {
    keys.push(10000)
    vals.push(vals.at(-1))
  }
  const rest = `values="${vals.join(';')}" keyTimes="${keys.map((k) => k / 10000).join(';')}" dur="${LOOP}s"${begin ? ` begin="${begin}s"` : ''}${discrete ? ' calcMode="discrete"' : ''}${additive ? ' additive="sum"' : ''} repeatCount="indefinite"`
  return type === 'opacity' ? `<animate attributeName="opacity" ${rest}/>` : `<animateTransform attributeName="transform" type="${type}" ${rest}/>`
}
// Группа с дорожкой; до начала дорожки стоит в первом кадре. Если кадры одинаковые — просто неподвижна
function T(type, frames, inner, o = {}) {
  const first = frames[0][1]
  if (frames.every((f) => f[1] === first)) return (type === 'scale' && first === '1 1') || (type === 'rotate' && first === '0') ? inner : `<g transform="${type}(${first})">${inner}</g>`
  return `<g transform="${type}(${first})">${track(type, frames, o)}${inner}</g>`
}
const O = (frames, inner, o = {}) => `<g opacity="${frames[0][1]}">${track('opacity', frames, o)}${inner}</g>`

// Путь по полосе: moves — [секунда, x, y] (y — над землёй, вверх меньше нуля), faces — [секунда, 1 — смотрит влево,
// −1 — вправо], poses — [секунда, 'sx sy'] сжатие от ног
const path = (x) => ({ t: 0, x, y: 0, face: 1, pose: '1 1', moves: [[0, x, 0]], faces: [[0, 1]], poses: [[0, '1 1']] })
function stay(p, d) {
  p.t += d
  p.moves.push([p.t, p.x, p.y])
}
function turn(p, face) {
  if (face === p.face) return
  p.face = face
  p.faces.push([p.t, face])
}
// Шагом до x за d секунд, с покачиванием шага
function walk(p, to, d) {
  if (Math.abs(to - p.x) < 1) return stay(p, d)
  turn(p, to > p.x ? -1 : 1)
  const [x0, t0, n] = [p.x, p.t, Math.max(2, Math.round(d / 0.25))]
  for (let i = 1; i <= n; i++) p.moves.push([t0 + (d * i) / n, x0 + ((to - x0) * i) / n, p.y + (i < n && i % 2 ? -1.5 : 0)])
  Object.assign(p, { t: t0 + d, x: to })
}
// Прыжок дугой высотой h в (to, y)
function hop(p, to, y = 0, h = 12, d = 0.5) {
  if (Math.abs(to - p.x) >= 1) turn(p, to > p.x ? -1 : 1)
  const [x0, y0, t0] = [p.x, p.y, p.t]
  for (let i = 1; i <= 6; i++) {
    const k = i / 6
    p.moves.push([t0 + d * k, x0 + (to - x0) * k, y0 + (y - y0) * k - 4 * h * k * (1 - k)])
  }
  Object.assign(p, { t: t0 + d, x: to, y })
}
// Плавно по высоте (нырнуть за карточку, вынырнуть) и мгновенно в другое место, пока не видно
function sink(p, y, d) {
  p.moves.push([p.t + d, p.x, y])
  Object.assign(p, { t: p.t + d, y })
}
function jumpTo(p, x, y) {
  p.moves.push([p.t + 0.01, x, y])
  Object.assign(p, { t: p.t + 0.01, x, y })
}
// Поза за d секунд; время пути не двигает — после неё нужен stay
function poseTo(p, v, d = 0.3) {
  p.poses.push([p.t, p.pose], [p.t + d, v])
  p.pose = v
}
const walkTime = (a, b) => clamp(Math.abs(b - a) / 55, 1.8, 5.5)

// Дуги отскоков предмета от x0 до x1 на высоте y
function bounces(frames, t0, x0, x1, y, heights, d) {
  heights.forEach((h, j) => {
    for (let i = 1; i <= 5; i++) {
      const k = i / 5
      const f = (j + k) / heights.length
      frames.push([t0 + d * f, `${r1(x0 + (x1 - x0) * f)} ${r1(y - 4 * h * k * (1 - k))}`])
    }
  })
}

// Предметы шалостей
const STAR = (() => {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const r = i % 2 ? 4 : 9
    pts.push(`${r1(Math.cos(a) * r)},${r1(Math.sin(a) * r)}`)
  }
  return `<polygon points="${pts.join(' ')}" fill="#ffd166" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`
})()
const BALL = `<circle r="7" fill="#ff6b6b" stroke="${INK}" stroke-width="1.2"/><path d="M-6.5 0 H6.5" stroke="#fff" stroke-width="1.8"/>`
const BUTTERFLY = `<g>${loop('scale', '1 1;0.25 1;1 1', 0.3)}<ellipse cx="-4" cy="-3" rx="4" ry="4.5" fill="#c77dff" stroke="${INK}" stroke-width="0.8"/><ellipse cx="4" cy="-3" rx="4" ry="4.5" fill="#c77dff" stroke="${INK}" stroke-width="0.8"/><ellipse cx="-3" cy="3" rx="2.6" ry="3" fill="#f15bb5"/><ellipse cx="3" cy="3" rx="2.6" ry="3" fill="#f15bb5"/></g><ellipse rx="1" ry="4.5" fill="${INK}"/>`
const ANTENNA = `<rect x="30.5" y="4" width="3" height="9" rx="1.5" fill="#7c93ad" stroke="${INK}" stroke-width="1.4"/><ellipse cx="32" cy="4" rx="3.2" ry="3.2" fill="#ff6b6b" stroke="${INK}" stroke-width="1.4"/><ellipse cx="32" cy="4" rx="3.2" ry="3.2" fill="#fff" opacity="0"><animate attributeName="opacity" values="0;1;0" dur="0.35s" repeatCount="indefinite"/></ellipse>`
const FLAME = `<ellipse cx="17" cy="34" rx="8" ry="4" fill="#ff9f1c"/><ellipse cx="15" cy="34" rx="4.5" ry="2.2" fill="#ffe08a"/><circle cx="7" cy="31" r="2" fill="#ffbf69"/>`
const card = (x, top, g) =>
  `<rect x="${r1(x - 44)}" y="${top}" width="88" height="${g - top + 16}" rx="6" fill="#f6f1e7" stroke="${INK}" stroke-width="1.4"/><rect x="${r1(x - 34)}" y="${top + 7}" width="44" height="4" rx="2" fill="#d9cfbf"/><rect x="${r1(x - 34)}" y="${top + 15}" width="62" height="4" rx="2" fill="#e6ddd0"/>`
const bowl = (x, g) => `<path d="M${r1(x - 13)} ${g - 8} a13 8 0 0 0 26 0 z" fill="#9aa5b1" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/><ellipse cx="${r1(x)}" cy="${g - 8}" rx="13" ry="2.6" fill="#5f6b78" stroke="${INK}" stroke-width="1.2"/>`
// Пузырь со стрелкой вверх — туда, где в шапке «Ждёт тебя»
const bubble = (x) =>
  `<g transform="translate(${r1(x)} 14)"><g>${loop('translate', '0 0;0 -3;0 0', 1.2)}<circle r="9" fill="#fff" stroke="${INK}" stroke-width="1.2"/><path d="M0 5 V-4 M-3.5 -0.5 L0 -4 L3.5 -0.5" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></g></g>`

// Искорка и нота для трюков
const SPARK = '<path d="M0 -5 L1.2 -1.2 L5 0 L1.2 1.2 L0 5 L-1.2 1.2 L-5 0 L-1.2 -1.2 Z" fill="#ffd166" stroke="#f08c00" stroke-width="0.6" stroke-linejoin="round"/>'
const NOTE = `<ellipse cx="0" cy="4" rx="2.8" ry="2" fill="${INK}" transform="rotate(-20 0 4)"/><path d="M2.4 3.4 V-6 L6.5 -4" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`

// Шалости. Каждая: from — куда дойти, play(p) — что делает питомец (до ~7 с), under / over — предметы под и над
// питомцем, extra — что дорисовать на самом питомце, tail — своё движение хвоста, noHead — снять головной убор с фигуры,
// spin — кадры поворота всей фигуры (сальто)
const SCENES = {
  // Выглядывает из-за края карточки: прячется, выныривает слева и справа, выпрыгивает
  peek(c) {
    const x = c.xs
    const top = c.ground - (c.stage === 'baby' ? 18 : 24)
    return {
      from: x,
      play(p) {
        stay(p, 0.5)
        sink(p, 36, 0.35)
        stay(p, 0.5)
        jumpTo(p, x - 24, 36)
        sink(p, 3, 0.35)
        turn(p, 1)
        stay(p, 0.6)
        turn(p, -1)
        stay(p, 0.5)
        sink(p, 36, 0.3)
        stay(p, 0.4)
        jumpTo(p, x + 24, 36)
        sink(p, 3, 0.35)
        stay(p, 0.6)
        hop(p, Math.min(c.W - 30, x + 66), 0, 26, 0.7)
      },
      over: () => card(x, top, c.ground),
    }
  },
  // Толкает звёздочку «Избранного»: та катится вперёд
  star(c) {
    const s0 = c.xs + 26
    const push = clamp(c.W - 44 - s0, 20, 90)
    let t1 = 0
    let t2 = 0
    return {
      from: c.xs,
      play(p) {
        turn(p, -1)
        stay(p, 0.4)
        t1 = p.t
        walk(p, c.xs + push, push / 32)
        t2 = p.t
        stay(p, 0.4)
        hop(p, p.x, 0, 10, 0.45)
        stay(p, 0.3)
      },
      under() {
        const at = (x) => `${r1(x)} ${c.ground - 9}`
        const pos = [[0, at(s0)], [t1, at(s0)], [t2, at(s0 + push)]]
        const spin = [[0, '0'], [t1, '0'], [t2, r1((push / 9) * 57.3)]]
        return O([[0, '0'], [0.6, '1'], [LOOP - 0.8, '1'], [LOOP, '0']], T('translate', pos, T('rotate', spin, STAR, c.o), c.o), c.o)
      },
    }
  },
  // Мячик: толкнул — укатился, догнал, поймал — отскочил назад
  ball(c) {
    const b0 = c.xs + 32
    const far = Math.max(b0 + 30, Math.min(b0 + 110, c.W - 24))
    const back = Math.max(c.xh + 50, far - 100)
    let t1 = 0
    let t2 = 0
    return {
      from: c.xs,
      play(p) {
        turn(p, -1)
        stay(p, 0.3)
        t1 = p.t
        stay(p, 0.6)
        walk(p, far - 34, Math.max(0.6, (far - 34 - p.x) / 70))
        t2 = p.t
        hop(p, far - 30, 0, 8, 0.35)
        turn(p, 1)
        stay(p, 1.4)
        hop(p, p.x, 0, 12, 0.5)
      },
      under() {
        const g = c.ground - 7
        const pos = [[0, `${b0} ${g}`], [t1, `${b0} ${g}`]]
        bounces(pos, t1, b0, far, g, [16, 7], 1)
        pos.push([t2 + 0.2, `${far} ${g}`])
        bounces(pos, t2 + 0.2, far, back, g, [20, 9, 4], 1.4)
        const turnBy = (d) => r1((d / 7) * 57.3)
        const spin = [[0, '0'], [t1, '0'], [t1 + 1, turnBy(far - b0)], [t2 + 0.2, turnBy(far - b0)], [t2 + 1.6, turnBy(far - b0 - (far - back))]]
        return O([[0, '0'], [0.6, '1'], [LOOP - 0.8, '1'], [LOOP, '0']], T('translate', pos, T('rotate', spin, BALL, c.o), c.o), c.o)
      },
    }
  },
  // Бабочка: прилетает, кружит над головой, питомец подпрыгивает за ней, она улетает
  butterfly(c) {
    let t0 = 0
    return {
      from: c.xs,
      play(p) {
        t0 = p.t
        turn(p, -1)
        stay(p, 0.8)
        hop(p, p.x, 0, 14, 0.5)
        stay(p, 0.4)
        hop(p, p.x + 8, 0, 18, 0.55)
        stay(p, 0.3)
        turn(p, 1)
        hop(p, p.x - 10, 0, 16, 0.5)
        stay(p, 1.6)
      },
      over() {
        const x = c.xs
        const pts = [
          [t0 - 2.4, c.W + 12, 10],
          [t0 - 1.6, x + 90, 24],
          [t0 - 0.8, x + 50, 12],
          [t0, x + 20, 22],
          [t0 + 0.8, x, 12],
          [t0 + 1.4, x + 14, 20],
          [t0 + 2, x - 6, 10],
          [t0 + 2.6, x + 10, 18],
          [t0 + 3.2, x - 12, 14],
          [t0 + 4, x - 40, 4],
          [t0 + 5, x - 120, -14],
        ]
        const pos = [[0, `${c.W + 12} 10`], ...pts.map(([t, px, py]) => [t, `${r1(px)} ${r1(py)}`])]
        return O([[0, '0'], [t0 - 2.5, '0'], [t0 - 2.3, '1'], [t0 + 4.9, '1'], [t0 + 5.1, '0']], T('translate', pos, BUTTERFLY, c.o), c.o)
      },
    }
  },
  // Чихнул — шапка слетела на землю, посмотрел на неё, подпрыгнул и поймал
  hat(c) {
    const id = c.wear.find((w) => WEAR[w]?.slot === 'head')
    let t0 = 0
    return {
      from: c.xs,
      noHead: true,
      play(p) {
        stay(p, 0.4)
        t0 = p.t
        hop(p, p.x, 0, 6, 0.3)
        stay(p, 1.2)
        poseTo(p, '1.04 0.92')
        stay(p, 1.2)
        poseTo(p, '1 1')
        stay(p, 0.3)
        hop(p, p.x, 0, 14, 0.5)
        stay(p, 0.5)
      },
      extra() {
        const [dx, dy] = FIT[c.species]?.head ?? [0, 0]
        const down = `20 ${44 - dy}`
        const pos = [[0, '0 0'], [t0, '0 0'], [t0 + 0.5, '6 -22'], [t0 + 1.2, '18 6'], [t0 + 1.5, down], [t0 + 2.9, down], [t0 + 3.2, '8 -14'], [t0 + 3.5, '0 0']]
        const spin = [[0, '0'], [t0, '0'], [t0 + 0.5, '200'], [t0 + 1.5, '340'], [t0 + 2.9, '340'], [t0 + 3.5, '360']]
        return T('translate', pos, around(32 + dx, 10 + dy, track('rotate', spin, c.o), wearSvg(c.species, [id])), c.o)
      },
    }
  },
  // Прыгает по плиткам
  hops(c) {
    const sp = clamp((c.W - 60 - c.xs) / 2.6, 24, 40)
    const xs = [-1.5, -0.5, 0.5, 1.5].map((k) => c.xs + k * sp)
    return {
      from: xs[0] - 30,
      play(p) {
        turn(p, -1)
        stay(p, 0.3)
        for (const x of xs) {
          hop(p, x, -8, 12, 0.5)
          stay(p, 0.2)
        }
        hop(p, Math.min(c.W - 30, xs[3] + 30), 0, 12, 0.5)
        stay(p, 0.3)
      },
      under: () => xs.map((x) => `<rect x="${r1(x - 13)}" y="${c.ground - 8}" width="26" height="8" rx="3" fill="#8a9bb855" stroke="#8a9bb8" stroke-width="1.2"/>`).join(''),
    }
  },
  // Жест вида: дракон чихает огоньком, сова поворачивает голову, у робота мигает антенна, капля растекается лужицей,
  // лиса виляет хвостом
  gesture(c) {
    const s = c.species
    let t0 = 0
    const moves = {
      dragon(p) {
        for (let i = 0; i < 2; i++) {
          poseTo(p, '1.06 0.92', 0.25)
          stay(p, 0.35)
          poseTo(p, '0.97 1.05', 0.1)
          stay(p, 0.9)
          poseTo(p, '1 1', 0.2)
          stay(p, 0.5)
        }
      },
      owl(p) {
        poseTo(p, '0.1 1')
        stay(p, 0.3)
        poseTo(p, '-1 1')
        stay(p, 1.6)
        poseTo(p, '0.1 1')
        stay(p, 0.3)
        poseTo(p, '1 1')
        stay(p, 0.6)
      },
      robot(p) {
        poseTo(p, '0.96 1.06', 0.2)
        stay(p, 3)
        poseTo(p, '1 1', 0.2)
        stay(p, 0.3)
      },
      drop(p) {
        poseTo(p, '1.6 0.35', 0.4)
        stay(p, 2)
        poseTo(p, '0.9 1.15', 0.25)
        stay(p, 0.25)
        poseTo(p, '1 1', 0.2)
        stay(p, 0.3)
      },
      fox(p) {
        stay(p, 3.2)
      },
    }
    return {
      from: c.xs,
      play(p) {
        stay(p, 0.3)
        t0 = p.t
        ;(moves[s] ?? moves.fox)(p)
        hop(p, p.x, 0, 10, 0.45)
        stay(p, 0.3)
      },
      extra() {
        if (s === 'robot') return O([[0, '0'], [t0, '0'], [t0 + 0.2, '1'], [t0 + 3.2, '1'], [t0 + 3.4, '0']], ANTENNA, c.o)
        if (s !== 'dragon') return ''
        const op = [[0, '0']]
        const grow = [[0, '0.3 0.3']]
        for (const k of [0, 1.75]) {
          const a = t0 + k + 0.42
          op.push([a, '0'], [a + 0.08, '1'], [a + 0.7, '1'], [a + 0.9, '0'])
          grow.push([a, '0.3 0.3'], [a + 0.25, '1 1'], [a + 0.9, '1.25 1.1'])
        }
        return O(op, `<g transform="translate(26 34)">${T('scale', grow, `<g transform="translate(-26 -34)">${FLAME}</g>`, c.o)}</g>`, c.o)
      },
      tail() {
        if (s !== 'fox') return null
        const wag = [[0, '0'], [t0, '0']]
        for (let i = 1; i <= 24; i++) wag.push([t0 + i * 0.125, i % 2 ? '20' : '-14'])
        wag.push([t0 + 3.2, '0'])
        return loop('rotate', '0;12;0;-6;0', c.mood === 'happy' ? 0.5 : 1.4) + track('rotate', wag, { ...c.o, additive: true })
      },
    }
  },

  // ━━ трюки за серии (0.59) ━━
  // Пируэт: два оборота на месте, вокруг искорки
  twirl(c) {
    let t0 = 0
    return {
      from: c.xs,
      play(p) {
        turn(p, -1)
        stay(p, 0.3)
        t0 = p.t
        for (let i = 0; i < 2; i++)
          for (const v of ['0.1 1', '-1 1', '0.1 1', '1 1']) {
            poseTo(p, v, 0.15)
            stay(p, 0.15)
          }
        hop(p, p.x, 0, 10, 0.45)
        stay(p, 0.4)
      },
      over: () => sparks(c, c.xs, t0, 1.6),
    }
  },
  // Сальто: присел, высокий прыжок с оборотом, приземлился и присел
  leap(c) {
    let t0 = 0
    let t1 = 0
    return {
      from: c.xs,
      play(p) {
        turn(p, -1)
        stay(p, 0.3)
        poseTo(p, '1.1 0.86', 0.2)
        stay(p, 0.3)
        poseTo(p, '1 1', 0.1)
        t0 = p.t
        hop(p, p.x, 0, 22, 0.9)
        t1 = p.t
        poseTo(p, '1.1 0.86', 0.12)
        stay(p, 0.25)
        poseTo(p, '1 1', 0.2)
        stay(p, 0.5)
      },
      spin: () => [[0, '0'], [t0, '0'], [t1, '-360']],
      over: () => sparks(c, c.xs, t1, 1),
    }
  },
  // Танец: шаги в стороны с разворотами и покачиванием, над головой — ноты
  dance(c) {
    let t0 = 0
    return {
      from: c.xs,
      play(p) {
        stay(p, 0.3)
        t0 = p.t
        const x = p.x
        for (let i = 0; i < 6; i++) {
          hop(p, x + (i % 2 ? -10 : 10), 0, 5, 0.32)
          poseTo(p, i % 2 ? '1.05 0.94' : '0.95 1.05', 0.12)
          stay(p, 0.18)
        }
        hop(p, x, 0, 8, 0.35)
        poseTo(p, '1 1', 0.1)
        stay(p, 0.4)
      },
      over() {
        return [0, 0.9, 1.8, 2.7]
          .map((d, i) => {
            const x = c.xs + (i % 2 ? 16 : -14)
            const top = c.ground - 50
            const pos = [[0, `${r1(x)} ${top}`], [t0 + d, `${r1(x)} ${top}`], [t0 + d + 1.4, `${r1(x + (i % 2 ? 6 : -6))} ${top - 14}`]]
            return O([[0, '0'], [t0 + d, '0'], [t0 + d + 0.15, '1'], [t0 + d + 1.1, '1'], [t0 + d + 1.4, '0']], T('translate', pos, NOTE, c.o), c.o)
          })
          .join('')
      },
    }
  },
  // Конфетти: подпрыгнул — сверху сыплются цветные бумажки
  confetti(c) {
    let t0 = 0
    return {
      from: c.xs,
      play(p) {
        turn(p, -1)
        stay(p, 0.3)
        poseTo(p, '1.08 0.88', 0.2)
        stay(p, 0.25)
        poseTo(p, '1 1', 0.1)
        t0 = p.t
        hop(p, p.x, 0, 16, 0.6)
        stay(p, 0.6)
        hop(p, p.x, 0, 8, 0.4)
        stay(p, 1.6)
      },
      over() {
        const colors = ['#ff6b6b', '#ffd166', '#30a46c', '#3e8ed0', '#c77dff', '#f08c00']
        let out = ''
        for (let i = 0; i < 14; i++) {
          const x = c.xs - 52 + ((i * 37) % 104)
          const d = t0 + 0.2 + ((i * 7) % 5) * 0.12
          const fall = 2 + ((i * 3) % 4) * 0.25
          const drift = ((i * 13) % 9) - 4
          const pos = [[0, `${x} -6`], [d, `${x} -6`], [d + fall, `${r1(x + drift)} ${c.ground - 2}`]]
          const spin = [[0, '0'], [d, '0'], [d + fall, String(i % 2 ? 540 : -540)]]
          const bit = `<rect x="-2.5" y="-1.2" width="5" height="2.4" rx="0.6" fill="${colors[i % colors.length]}"/>`
          out += O([[0, '0'], [d, '0'], [d + 0.05, '1'], [d + fall, '1'], [d + fall + 0.4, '0']], T('translate', pos, T('rotate', spin, bit, c.o), c.o), c.o)
        }
        return out
      },
    }
  },
  // Радуга: за питомцем появляется радуга, он перепрыгивает её туда и обратно
  rainbow(c) {
    const R = 30
    let t0 = 0
    let t1 = 0
    return {
      from: c.xs - R - 8,
      play(p) {
        turn(p, -1)
        stay(p, 0.4)
        t0 = p.t
        stay(p, 0.6)
        hop(p, c.xs + R + 8, 0, 26, 1.1)
        stay(p, 0.5)
        hop(p, c.xs - R - 8, 0, 26, 1.1)
        t1 = p.t
        stay(p, 0.6)
      },
      under() {
        const bands = ['#ff6b6b', '#f08c00', '#ffd166', '#30a46c', '#3e8ed0', '#9b5de5']
          .map((col, i) => {
            const r = R - i * 3
            return `<path d="M${r1(c.xs - r)} ${c.ground} A${r} ${r} 0 0 1 ${r1(c.xs + r)} ${c.ground}" fill="none" stroke="${col}" stroke-width="3"/>`
          })
          .join('')
        return O([[0, '0'], [t0, '0'], [t0 + 0.5, '1'], [t1, '1'], [t1 + 0.6, '0']], bands, c.o)
      },
    }
  },

  // ━━ игрушки и трюки из лавки (0.61) ━━
  // Воздушный змей: бежит по полосе туда и обратно, змей на нитке летит позади и покачивается
  kite(c) {
    const [x0, x1] = [c.xs - 50, c.xs + 50]
    let t0 = 0
    let t1 = 0
    return {
      from: x0,
      play(p) {
        turn(p, -1)
        stay(p, 0.4)
        t0 = p.t
        walk(p, x1, 2.2)
        stay(p, 0.3)
        walk(p, x0, 2.2)
        t1 = p.t
        turn(p, -1)
        stay(p, 0.6)
      },
      over() {
        const y = c.ground - 18
        const kite =
          `<path d="M0 0 Q-12 -8 -22 -24" fill="none" stroke="${INK}" stroke-width="0.8"/>` +
          `<g transform="translate(-22 -32)">${loop('rotate', '-10;10;-10', 1.6)}<path d="M0 -9 L7 0 L0 11 L-7 0 Z" fill="#3e8ed0" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><path d="M0 -9 V11 M-7 0 H7" stroke="#fff" stroke-width="0.8"/><path d="M0 11 q-3 4 0 7 q3 4 0 7" fill="none" stroke="${INK}" stroke-width="0.8"/><path d="M-2.5 16 L2.5 19 M2.5 16 L-2.5 19" stroke="#ff6b6b" stroke-width="1.6" stroke-linecap="round"/></g>`
        const pos = [[0, `${x0} ${y}`], [t0, `${x0} ${y}`], [t0 + 2.2, `${x1} ${y}`], [t0 + 2.5, `${x1} ${y}`], [t1, `${x0} ${y}`]]
        const flip = [[0, '1 1'], [t0 + 2.5, '-1 1'], [t1, '1 1']]
        return O([[0, '0'], [t0, '0'], [t0 + 0.3, '1'], [t1 + 0.3, '1'], [t1 + 0.7, '0']], T('translate', pos, T('scale', flip, kite, { ...c.o, discrete: true }), c.o), c.o)
      },
    }
  },
  // Мыльные пузыри: дует — пузыри улетают вверх и лопаются, за последним подпрыгивает
  bubbles(c) {
    let t0 = 0
    return {
      from: c.xs - 20,
      play(p) {
        turn(p, -1)
        stay(p, 0.3)
        t0 = p.t
        for (let i = 0; i < 3; i++) {
          poseTo(p, '1.05 0.95', 0.2)
          stay(p, 0.5)
          poseTo(p, '1 1', 0.2)
          stay(p, 0.4)
        }
        hop(p, c.xs + 6, 0, 14, 0.55)
        stay(p, 0.6)
      },
      over() {
        let out = ''
        for (let i = 0; i < 7; i++) {
          const r = 3 + (i % 3) * 1.5
          const d = t0 + 0.15 + i * 0.4
          const rise = 1.6 + (i % 3) * 0.3
          const [x, y] = [c.xs - 8, c.ground - 30]
          const pos = [[0, `${x} ${y}`], [d, `${x} ${y}`], [d + rise, `${r1(x + 14 + ((i * 11) % 26))} ${r1(c.ground - 52 - ((i * 7) % 12))}`]]
          const bub = `<circle r="${r}" fill="#bde0fe66" stroke="#5fa8d3" stroke-width="0.9"/><circle cx="${r1(-r / 3)}" cy="${r1(-r / 3)}" r="${r1(r / 4)}" fill="#fff"/>`
          out += O([[0, '0'], [d, '0'], [d + 0.1, '1'], [d + rise, '1'], [d + rise + 0.12, '0']], T('translate', pos, bub, c.o), c.o)
        }
        return out
      },
    }
  },
  // Батут: прыгает всё выше, приседая на сетке, и соскакивает
  bounce(c) {
    let ta = 0
    let t1 = 0
    return {
      from: c.xs,
      play(p) {
        ta = p.t
        turn(p, -1)
        stay(p, 0.5)
        hop(p, p.x, -4, 8, 0.4)
        for (const h of [12, 18, 22, 14]) {
          poseTo(p, '1.12 0.84', 0.1)
          stay(p, 0.12)
          poseTo(p, '1 1', 0.08)
          hop(p, p.x, -4, h, 0.3 + h / 50)
        }
        t1 = p.t
        hop(p, p.x + 30, 0, 12, 0.5)
        stay(p, 0.5)
      },
      under() {
        const [x, g] = [c.xs, c.ground]
        const tramp = `<path d="M${x - 18} ${g} L${x - 14} ${g - 4} M${x + 18} ${g} L${x + 14} ${g - 4}" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/><ellipse cx="${x}" cy="${g - 4}" rx="18" ry="2.6" fill="#3e8ed0" stroke="${INK}" stroke-width="1.2"/>`
        return O([[0, '0'], [ta, '0'], [ta + 0.3, '1'], [t1 + 0.6, '1'], [t1 + 1, '0']], tramp, c.o)
      },
    }
  },
  // Салют: присел и смотрит, как в небе раскрываются огни, потом подпрыгивает от радости
  fireworks(c) {
    let t0 = 0
    return {
      from: c.xs - 30,
      play(p) {
        turn(p, -1)
        stay(p, 0.3)
        poseTo(p, '1.05 0.92', 0.2)
        t0 = p.t
        stay(p, 3.4)
        poseTo(p, '1 1', 0.2)
        hop(p, p.x, 0, 12, 0.5)
        stay(p, 0.5)
      },
      over() {
        return [
          [c.xs + 6, 20, 0, '#ff6b6b'],
          [c.xs + 46, 14, 0.9, '#ffd166'],
          [c.xs + 24, 10, 1.8, '#c77dff'],
        ]
          .map(([x, y, w, col]) => {
            const d = t0 + w
            const rocket = O([[0, '0'], [d, '0'], [d + 0.05, '1'], [d + 0.6, '1'], [d + 0.65, '0']], T('translate', [[0, `${x} ${c.ground - 4}`], [d, `${x} ${c.ground - 4}`], [d + 0.6, `${x} ${y}`]], `<circle r="1.6" fill="${col}"/>`, c.o), c.o)
            let rays = ''
            for (let i = 0; i < 8; i++) {
              const a = (i * Math.PI) / 4
              const [cx, cy] = [Math.cos(a), Math.sin(a)]
              rays += `<path d="M${r1(cx * 3)} ${r1(cy * 3)} L${r1(cx * 10)} ${r1(cy * 10)}" stroke="${col}" stroke-width="1.6" stroke-linecap="round"/><circle cx="${r1(cx * 12)}" cy="${r1(cy * 12)}" r="1.1" fill="${col}"/>`
            }
            const burst = O([[0, '0'], [d + 0.6, '0'], [d + 0.65, '1'], [d + 1.3, '1'], [d + 1.7, '0']], T('scale', [[0, '0.1 0.1'], [d + 0.6, '0.1 0.1'], [d + 1.1, '1 1']], rays, c.o), c.o)
            return `${rocket}<g transform="translate(${x} ${y})">${burst}</g>`
          })
          .join('')
      },
    }
  },
}

// Домик и садик из лавки (0.61): стоят на полосе за питомцем. Домик — у места, где он живёт (xh), садик — у правого края
function decorSvg(decor, W, g, xh) {
  let out = ''
  if (decor.includes('garden')) {
    const grass = `<path d="M${W - 52} ${g + 1} q3 -7 6 0 q3 -8 6 0 q3 -6 6 0 q3 -8 6 0 q3 -7 6 0 q3 -8 6 0 q3 -6 6 0 q3 -7 6 0" fill="#6cbf4a" stroke="${INK}" stroke-width="0.8" stroke-linejoin="round"/>`
    const flowers = [['#ff6b6b', 0], ['#ffd166', 1], ['#c77dff', 2]]
      .map(([col, i]) => {
        const x = W - 44 + i * 15
        const top = g - 16 - (i % 2) * 5
        const petals = [[-3, 0], [3, 0], [0, -3], [0, 3]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${top + dy}" r="2.6" fill="${col}"/>`).join('')
        return `<rect x="${x - 0.6}" y="${top}" width="1.2" height="${g - top}" fill="#4f9a35"/>${petals}<circle cx="${x}" cy="${top}" r="1.8" fill="#fff3b0"/>`
      })
      .join('')
    out += flowers + grass
  }
  if (decor.includes('house')) {
    const x = xh
    out +=
      `<path d="M${x - 18} ${g} V${g - 20} L${x} ${g - 33} L${x + 18} ${g - 20} V${g} Z" fill="#e9c46a" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>` +
      `<path d="M${x - 22} ${g - 17} L${x} ${g - 36} L${x + 22} ${g - 17}" fill="none" stroke="#c1121f" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M${x - 7} ${g} V${g - 10} a7 7 0 0 1 14 0 V${g} Z" fill="#5a3e2b"/>`
  }
  return out
}

// Искорки вокруг питомца на d секунд с t0
function sparks(c, x, t0, d) {
  return [
    [-20, 40, 0],
    [20, 46, 0.2],
    [-8, 56, 0.4],
    [14, 30, 0.6],
  ]
    .map(([dx, up, w]) => `<g transform="translate(${r1(x + dx)} ${c.ground - up})">${O([[0, '0'], [t0 + w, '0'], [t0 + w + 0.15, '1'], [t0 + w + d, '1'], [t0 + w + d + 0.3, '0']], SPARK, c.o)}</g>`)
    .join('')
}

// Обычный круг: постоял, дошёл до места шалости, пошалил, огляделся, присел и зевнул, вернулся домой.
// Возвращает, когда зевок — чтобы открыть рот
function dayLoop(p, c, scene) {
  stay(p, 0.8)
  walk(p, scene.from, walkTime(p.x, scene.from))
  scene.play(p)
  turn(p, 1)
  stay(p, 0.6)
  turn(p, -1)
  stay(p, 0.6)
  turn(p, 1)
  stay(p, 0.4)
  poseTo(p, '1.06 0.88')
  const yawn = p.t + 0.4
  stay(p, 2.2)
  poseTo(p, '1 1')
  stay(p, 0.4)
  walk(p, c.xh, Math.max(0.5, Math.min(walkTime(p.x, c.xh), LOOP - p.t - 0.4)))
  if (p.t < LOOP) stay(p, LOOP - p.t)
  return yawn
}

// Полоса целиком. reaction — что сейчас с питомцем: idle — гуляет и шалит; done — агент закончил (прыгает); treat —
// пришло угощение (ест, сердечки); happy — погладили; wait — сессия ждёт (грустит и машет в сторону «Ждёт тебя»);
// sleep — ночь; hungry — сидит у пустой миски; sad — медленно бродит. Без питомца или яйцом — качается яйцо.
// Одинаковые входные данные — одинаковая картинка: панель не перезагружает её без нужды
// show — во сколько раз картинка на экране меньше поля (маленький питомец, п. 45): поле то же, рисунок меньше
// decor — купленные домик и садик (0.61), рисуются под всем остальным
// still — дрёма (п. 49): та же картинка без движения
export function petWalkSvg({ species, stage = 'baby', wear = [], scene = 'peek', reaction = 'idle', width = 480, height = 72, show = 1, form = '', decor = [], still = false }) {
  const done = still ? stillSvg : stepFrames
  const W = Math.round(clamp(width, 160, 2000))
  const H = height
  const ground = H - 6
  const xh = Math.round(clamp(W * 0.16, 40, 200))
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${Math.round(W * show)}" height="${Math.round(H * show)}">${decor.length ? decorSvg(decor, W, ground, xh) : ''}`
  const placed = (x, inner) => `<g transform="translate(${r1(x - 32 * K)} ${r1(ground - 58 * K)}) scale(${K})">${inner}</g>`
  const look = LOOKS[species]
  if (!look || stage === 'egg') return done(`${head}${placed(xh, grabbable(eggSvg(look ?? { egg: ['#f1e4d3', '#c9a77c'] }, reaction === 'sleep' ? 'sleep' : 'idle', still)))}</svg>`)

  const mood = { idle: 'idle', wait: 'sad', sleep: 'sleep', hungry: 'sad', sad: 'sad' }[reaction] ?? 'happy'
  const intro = { done: 2.1, treat: 3, happy: 2.1 }[reaction] ?? 0
  const c = { W, H, ground, xh, xs: Math.round(W * 0.55), look, species, stage, wear, mood, o: { begin: intro } }
  let p = path(xh)
  let sc = {}
  let extra = ''
  if (reaction === 'wait') {
    // Стоит под шапкой, машет лапкой, над ним стрелка вверх
    const x = Math.round(clamp(W * 0.3, 70, 280))
    p = path(x)
    stay(p, LOOP)
    sc = { over: () => bubble(x - 36) }
    extra = around(18, 44, loop('rotate', '0;-35;0;-35;0', 1.6), `<ellipse cx="12" cy="34" rx="3.5" ry="5" fill="${paint(look.body[0])}" stroke="${INK}" stroke-width="1.2"/>`)
  } else if (reaction === 'sleep') {
    stay(p, LOOP)
    extra = zzz(still)
  } else if (reaction === 'hungry') {
    // Сидит у пустой миски и поглядывает на неё
    Object.assign(p, { face: -1, pose: '1.05 0.9', faces: [[0, -1], [6, 1], [7.5, -1], [15, 1], [16.2, -1]], poses: [[0, '1.05 0.9']] })
    stay(p, LOOP)
    sc = { under: () => bowl(xh + 44, ground) }
  } else if (reaction === 'sad') {
    stay(p, 1)
    walk(p, xh + 80, 7)
    stay(p, 2)
    turn(p, 1)
    stay(p, 1)
    walk(p, xh, 7)
    stay(p, LOOP - p.t)
  } else {
    const hasHat = wear.some((w) => WEAR[w]?.slot === 'head')
    sc = SCENES[scene === 'hat' && !hasHat ? 'peek' : SCENES[scene] ? scene : 'peek'](c)
    const yawn = dayLoop(p, c, sc)
    const [mx, my] = look.mouth ?? [32, 36]
    extra = O([[0, '0'], [yawn, '0'], [yawn + 0.3, '1'], [yawn + 1.4, '1'], [yawn + 1.7, '0']], `<ellipse cx="${mx}" cy="${my + 1}" rx="2.6" ry="3.2" fill="${INK}"/>`, c.o)
  }
  if (reaction === 'treat') extra += cookie(look)
  if (reaction === 'treat' || reaction === 'happy') extra += hearts()

  const drawn = petFigure({ species, stage, mood, form, wear: sc.noHead ? wear.filter((w) => WEAR[w]?.slot !== 'head') : wear, extra: extra + (sc.extra?.() ?? ''), tailAnim: sc.tail?.() ?? null })
  const fig = sc.spin ? around(32, 34, track('rotate', sc.spin(), c.o), drawn) : drawn
  const posed = `<g transform="translate(32 58)">${T('scale', p.poses, `<g transform="translate(-32 -58)">${fig}</g>`, c.o)}</g>`
  const jumps = reaction === 'done' || reaction === 'happy' ? '<animateTransform attributeName="transform" type="translate" values="0 0;0 -11;0 0;0 -11;0 0;0 -11;0 0" dur="2.1s"/>' : ''
  // Навёл мышь — подпрыгивает, нажал — тянется (п. 49): полоса — картинка с isInteractive
  const sized = `<g transform="translate(${r1(-32 * K)} ${r1(-58 * K)}) scale(${K})">${grabbable(posed)}</g>`
  const faced = T('scale', p.faces.map(([t, f]) => [t, `${f} 1`]), jumps ? `<g>${jumps}${sized}</g>` : sized, { ...c.o, discrete: true })
  const pet = T('translate', p.moves.map(([t, x, y]) => [t, `${r1(x)} ${r1(ground + y)}`]), faced, c.o)
  const shadow = T('translate', p.moves.map(([t, x]) => [t, `${r1(x)} ${ground + 1}`]), `<ellipse rx="${r1((stage === 'baby' ? 11 : 14) * K)}" ry="2.2" fill="#00000022"/>`, c.o)
  return done(`${head}${sc.under?.() ?? ''}${shadow}${pet}${sc.over?.() ?? ''}</svg>`)
}

// ━━━━━━━━━━ уголок с вещами (0.59) ━━━━━━━━━━
// Комната питомца на экране «Питомец»: стена, пол и открытые вещи (CORNER в pet.js). Питомец сидит посередине и дышит.
// Без анимации, кроме дыхания, моргания и огонька лампы; одинаковые входные данные — одинаковая картинка
export const CORNER_ITEMS = ['bed', 'ball', 'plant', 'rug', 'lamp', 'picture']
const CW = 320
const CH = 120
const FLOOR = 84
const CORNER_ART = {
  picture: () =>
    `<rect x="196" y="16" width="48" height="34" rx="2" fill="#fffaf0" stroke="#8a5f3f" stroke-width="3"/><circle cx="232" cy="25" r="4" fill="#ffd166"/><path d="M199 47 L213 31 L222 40 L229 33 L241 47 Z" fill="#6cbf4a"/>`,
  lamp: () =>
    `<ellipse cx="30" cy="22" rx="26" ry="20" fill="#ffd16633"><animate attributeName="opacity" values="0.7;1;0.7" dur="4s" repeatCount="indefinite"/></ellipse><rect x="28.5" y="24" width="3" height="${FLOOR + 14 - 24}" fill="#5b6b7a"/><ellipse cx="30" cy="${FLOOR + 14}" rx="10" ry="3" fill="#5b6b7a"/><path d="M18 26 L22 10 H38 L42 26 Z" fill="#ffe08a" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/>`,
  plant: () =>
    `<ellipse cx="292" cy="60" rx="6" ry="14" fill="#4f9a35" stroke="${INK}" stroke-width="1" transform="rotate(-25 292 74)"/><ellipse cx="292" cy="58" rx="6" ry="16" fill="#6cbf4a" stroke="${INK}" stroke-width="1"/><ellipse cx="292" cy="60" rx="6" ry="14" fill="#8fd46c" stroke="${INK}" stroke-width="1" transform="rotate(25 292 74)"/><path d="M280 74 H304 L300 96 H284 Z" fill="#e07a5f" stroke="${INK}" stroke-width="1.2" stroke-linejoin="round"/><rect x="278" y="72" width="28" height="5" rx="2" fill="#c8624a" stroke="${INK}" stroke-width="1.2"/>`,
  rug: () => `<ellipse cx="160" cy="104" rx="66" ry="11" fill="#9b5de5" opacity="0.55"/><ellipse cx="160" cy="104" rx="52" ry="8" fill="none" stroke="#f1faee" stroke-width="2" stroke-dasharray="6 4"/>`,
  bed: () => `<ellipse cx="78" cy="102" rx="36" ry="10" fill="#c25b56" stroke="${INK}" stroke-width="1.2"/><ellipse cx="78" cy="99" rx="26" ry="5.5" fill="#e8908a"/>`,
  ball: () => `<g transform="translate(252 100)">${BALL}</g>`,
}
export function petCornerSvg({ items = [], species, stage = 'baby', wear = [], form = '', mood = 'idle', width = CW }) {
  const has = (id) => items.includes(id)
  const look = LOOKS[species]
  const room = `<rect width="${CW}" height="${FLOOR}" fill="#f3ead8"/><rect y="${FLOOR}" width="${CW}" height="${CH - FLOOR}" fill="#d9b98c"/><rect y="${FLOOR - 1}" width="${CW}" height="3" fill="#b8956a"/>`
  const back = ['picture', 'lamp', 'plant'].filter(has).map((id) => CORNER_ART[id]()).join('')
  const floor = ['rug', 'bed'].filter(has).map((id) => CORNER_ART[id]()).join('')
  const fig = !look || stage === 'egg' ? eggShell(look ?? { egg: ['#f1e4d3', '#c9a77c'] }, mood === 'sleep' ? 'sleep' : 'idle') : petFigure({ species, stage, mood, wear, form })
  const pet = `<ellipse cx="160" cy="105" rx="${stage === 'baby' ? 11 : 14}" ry="2.5" fill="#00000022"/><g transform="translate(128 47)">${fig}</g>${mood === 'sleep' ? `<g transform="translate(128 47)">${zzz()}</g>` : ''}`
  const front = has('ball') ? CORNER_ART.ball() : ''
  const w = Math.round(clamp(width, 160, 640))
  return stepFrames(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${w}" height="${Math.round((w * CH) / CW)}">${room}${back}${floor}${pet}${front}</svg>`)
}

// ━━━━━━━━━━ пиксели для терминала ━━━━━━━━━━

const hex = (c) => (c === 'none' ? -1 : parseInt(c.slice(1, 7), 16))
function inside(s, x, y) {
  if (s[0] === 'e') return ((x - s[1]) / s[3]) ** 2 + ((y - s[2]) / s[4]) ** 2 <= 1
  if (s[0] === 'r') return x >= s[1] && x <= s[1] + s[3] && y >= s[2] && y <= s[2] + s[4]
  const p = s[1]
  let hit = false
  for (let i = 0, j = p.length - 2; i < p.length; j = i, i += 2) {
    const [xi, yi, xj, yj] = [p[i], p[i + 1], p[j], p[j + 1]]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit
  }
  return hit
}
const colorOf = (s) => hex(s[0] === 'e' ? s[5] : s[0] === 'r' ? s[6] : s[2])
const moved = (list, dx, dy, k = 1, cx = 32, cy = 58) =>
  list.map((s) => {
    const X = (x) => cx + (x - cx) * k + dx
    const Y = (y) => cy + (y - cy) * k + dy
    if (s[0] === 'e') return ['e', X(s[1]), Y(s[2]), s[3] * k, s[4] * k, s[5]]
    if (s[0] === 'r') return ['r', X(s[1]), Y(s[2]), s[3] * k, s[4] * k, s[5], s[6]]
    return ['p', s[1].map((v, i) => (i % 2 ? Y(v) : X(v))), s[2]]
  })

// Фигуры кадра для пикселей: те же части, что в SVG, без обводки; frame — 0, 1, 2: дыхание, моргание, шаг
export function petShapes({ species, stage = 'baby', mood = 'idle', wear = [], frame = 0, form = '' }) {
  const look = LOOKS[species] ?? LOOKS.robot
  const bob = mood === 'happy' ? [0, -6, 0][frame % 3] : mood === 'sleep' ? 0 : [0, -1, 0][frame % 3]
  if (stage === 'egg') {
    const [light, dark] = look.egg
    const tilt = mood === 'sleep' ? 0 : [0, -2, 2][frame % 3]
    return moved([['e', 32, 38, 16, 20, light], ['e', 25, 32, 3.5, 2.5, dark], ['e', 38, 42, 4, 3, dark], ['e', 30, 50, 2.5, 2, dark]], tilt, 0)
  }
  const baby = stage === 'baby'
  const adult = baby ? { back: [], top: [], front: [] } : look.adult
  const list = [...adult.back, ...(look.tail?.shapes ?? []), ...(look.wings ?? []), ...look.body, ...adult.top, ...look.front, ...adult.front]
  const e = look.eyes
  const size = e.size * (baby ? 1.2 : 1)
  const shut = mood === 'sleep' || mood === 'happy' || (mood === 'idle' && frame % 3 === 2)
  for (const [x, y] of [e.l, e.r]) list.push(shut ? ['r', x - size, y - 0.5, size * 2, 1.2, 0, INK] : ['e', x, y, size * 0.85, size, e.color === INK ? INK : e.color])
  // Облик взрослого — цветное пятнышко на груди
  if (!baby && FORM_COLOR[form]) list.push(['e', ...(FORM_AT[species] ?? [32, 46]), 3.5, 3.5, FORM_COLOR[form]])
  for (const id of wear) {
    const w = WEAR[id]
    if (!w) continue
    const [dx, dy] = FIT[species]?.[w.slot] ?? [0, 0]
    list.push(...moved(w.shapes.filter((s) => colorOf(s) >= 0), dx, dy, 1, 0, 0))
  }
  return moved(list, 0, bob, baby ? 0.82 : 1)
}

// Пиксели w×h из фигур: 0x00RRGGBB или -1 — пусто
export function rasterize(shapes, w, h) {
  const px = new Int32Array(w * h).fill(-1)
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const x = ((i + 0.5) * 64) / w
      const y = ((j + 0.5) * 64) / h
      for (const s of shapes) if (inside(s, x, y)) px[j * w + i] = colorOf(s)
    }
  return px
}
