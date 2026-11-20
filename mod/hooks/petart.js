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
// Сон: «z» всплывают
const zzz = () =>
  [0, 1.2].map((d) => `<text x="48" y="18" font-family="sans-serif" font-size="9" font-weight="700" fill="#8aa1c1" opacity="0">z<animate attributeName="opacity" values="0;1;0" dur="2.4s" begin="${d}s" repeatCount="indefinite"/><animateTransform attributeName="transform" type="translate" values="0 6;5 -6" dur="2.4s" begin="${d}s" repeatCount="indefinite"/></text>`).join('')
// Еда: печенька у рта, тает
const cookie = (look) => {
  const [x, y] = look.mouth ?? [32, 34]
  return `<g><circle cx="${x + 9}" cy="${y + 2}" r="4" fill="#d9a066" stroke="${INK}" stroke-width="1"/><circle cx="${x + 8}" cy="${y + 1}" r="0.8" fill="#6b3e26"/><circle cx="${x + 10.5}" cy="${y + 3}" r="0.8" fill="#6b3e26"/><animateTransform attributeName="transform" type="scale" values="1;0.2" dur="2.5s" fill="freeze" additive="sum"/><animate attributeName="opacity" values="1;0" dur="2.5s" fill="freeze"/></g>`
}
// Грусть: капелька
const tear = (look) => `<ellipse cx="${look.eyes.l[0] - 1}" cy="${look.eyes.l[1] + 5}" rx="1.3" ry="2" fill="#7ec8f7"><animate attributeName="cy" values="${look.eyes.l[1] + 4};${look.eyes.l[1] + 12}" dur="2.2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0" dur="2.2s" repeatCount="indefinite"/></ellipse>`

// Яйцо вида: скорлупа в пятнышках, покачивается
function eggSvg(look, mood) {
  const [light, dark] = look.egg
  const shell = `<ellipse cx="32" cy="38" rx="16" ry="20" fill="${light}" stroke="${INK}" stroke-width="1.4"/><ellipse cx="25" cy="32" rx="3.5" ry="2.5" fill="${dark}"/><ellipse cx="38" cy="42" rx="4" ry="3" fill="${dark}"/><ellipse cx="30" cy="50" rx="2.5" ry="2" fill="${dark}"/><ellipse cx="38" cy="26" rx="2" ry="1.6" fill="${dark}"/>`
  const rock = mood === 'sleep' ? loop('rotate', '0;2;0;-2;0', 6) : loop('rotate', '0;0;-7;6;-4;0;0', 2.6, ' keyTimes="0;0.5;0.62;0.74;0.86;0.95;1"')
  return `<ellipse cx="32" cy="59" rx="13" ry="2.5" fill="#00000022"/>${around(32, 58, rock, shell)}${mood === 'sleep' ? zzz() : ''}`
}

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

// Питомец целиком: species — вид, stage — egg / baby / adult, mood — idle / happy / eat / sleep / sad, wear — надетое,
// pat — показать сердечки. walk — ходить по полю (на большом экране); на маленькой картинке стоит на месте и дышит
export function petSvg({ species, stage = 'baby', mood = 'idle', wear = [], pat = false, walk = true, size = 128 }) {
  const look = LOOKS[species] ?? LOOKS.robot
  const head = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">`
  if (stage === 'egg') return `${head}${eggSvg(look, mood)}${pat ? hearts() : ''}</svg>`
  const baby = stage === 'baby'
  const adult = baby ? { back: [], top: [], front: [] } : look.adult
  const flap = mood === 'happy' ? 0.35 : mood === 'sad' || mood === 'sleep' ? 0 : 1.6
  const wings = look.wings
    ? look.wings
        .map((w, i) => {
          const [x, y] = w[0] === 'e' ? [w[1], w[2] - w[4] * 0.6] : [w[1][0], w[1][1]]
          return flap ? around(x, y, loop('rotate', i ? '0;-14;0' : '0;14;0', flap), outline([w])) : outline([w])
        })
        .join('')
    : ''
  const tail = look.tail ? around(look.tail.at[0], look.tail.at[1], mood === 'sleep' ? '' : loop('rotate', '0;12;0;-6;0', mood === 'happy' ? 0.5 : mood === 'sad' ? 3.5 : 1.4), outline(look.tail.shapes)) : ''
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
    wearSvg(species, wear) +
    (mood === 'eat' ? cookie(look) : '') +
    (mood === 'sad' ? tear(look) : '')
  // Дыхание — от ног; малыш меньше; радость — прыжки; грусть — ниже и медленнее
  const breath = mood === 'sleep' ? loop('scale', '1 1;1.04 0.95;1 1', 3.6) : mood === 'sad' ? loop('scale', '1 0.97;1.01 0.95;1 0.97', 3) : loop('scale', '1 1;1.025 0.97;1 1', 2.2)
  let body = around(32, 58, breath, figure)
  if (baby) body = `<g transform="translate(32 58) scale(0.82) translate(-32 -58)">${body}</g>`
  if (mood === 'happy') body = `<g>${loop('translate', '0 0;0 -9;0 0;0 0', 0.7, ' keyTimes="0;0.35;0.7;1"')}${body}</g>`
  // Ходьба: туда-сюда по полю, разворот на краях, лёгкое покачивание шага
  else if (walk && mood === 'idle')
    body = `<g>${loop('translate', '0 0;-12 0;-12 0;12 0;12 0;0 0', 14, ' keyTimes="0;0.2;0.3;0.7;0.8;1"')}<g>${loop('translate', '0 0;0 -1.5;0 0', 0.45)}${around(32, 0, '<animateTransform attributeName="transform" type="scale" values="1 1;-1 1;1 1" keyTimes="0;0.3;0.8" dur="14s" calcMode="discrete" repeatCount="indefinite"/>', body)}</g></g>`
  const shadow = `<ellipse cx="32" cy="59" rx="${baby ? 11 : 14}" ry="2.5" fill="#00000022"/>`
  return `${head}${shadow}${body}${pat ? hearts() : ''}${mood === 'sleep' ? zzz() : ''}</svg>`
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
export function petShapes({ species, stage = 'baby', mood = 'idle', wear = [], frame = 0 }) {
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
