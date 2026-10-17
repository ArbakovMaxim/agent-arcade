// Проверка страницы игры (web/) без браузера: поддельный DOM в Node. Запуск из папки мода: node tests/web-page.mjs
// Библиотека с вкладками и статистикой; игра: клавиши, пауза при потере фокуса, сохранение, звук, геймпад, рекорды.
import fs from 'node:fs'
import vm from 'node:vm'
import assert from 'node:assert/strict'

const WEB = new URL('../web/', import.meta.url)

function makePage(storage, { search = '?game=thwaite', pads = [], extraGames = null } = {}) {
  let now = 0
  const raf = []
  const audioNodes = []
  const handlers = {}
  const page = { draws: 0, handlers, raf, audioNodes, focused: null, navigated: null }

  function element(tag) {
    const node = {
      tagName: tag, className: '', textContent: '', href: '', tabIndex: 0, style: {}, dataset: {}, children: [],
      clientWidth: 900, clientHeight: 800, listeners: {},
      classList: { set: new Set(), add(c) { this.set.add(c) }, remove(c) { this.set.delete(c) }, contains(c) { return this.set.has(c) } },
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f) },
      blur() {},
      focus() { page.focused = node },
      append(...kids) { for (const k of kids) node.children.push(typeof k === 'string' ? { textContent: k, children: [] } : k) },
      replaceChildren() { node.children = [] },
      querySelectorAll(selector) {
        const cls = selector.replace(/^\./, '')
        const found = []
        const walk = (n) => { for (const c of n.children) { if ((c.className || '').split(' ').includes(cls)) found.push(c); walk(c) } }
        walk(node)
        return found
      },
      getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() { page.draws++ } }),
    }
    return node
  }
  const byId = {}
  const getElementById = (id) => (byId[id] ??= element('div'))
  const body = element('body')

  const win = {
    addEventListener: (t, f) => (handlers[t] ??= []).push(f),
    AudioContext: class {
      constructor() { this.sampleRate = 48000; this.destination = {} }
      createScriptProcessor() { const n = { connect() {} }; audioNodes.push(n); return n }
      suspend() { page.audioState = 'suspended' }
      resume() { page.audioState = 'running' }
    },
  }
  const location = { get search() { return search }, set search(value) { page.navigated = value } }
  const ctx = {
    window: win, location, URLSearchParams, atob, console,
    performance: { now: () => now },
    requestAnimationFrame: (cb) => raf.push(cb),
    navigator: { getGamepads: () => pads },
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
    document: { title: '', hidden: false, body, getElementById, createElement: element, addEventListener: (t, f) => (handlers['doc:' + t] ??= []).push(f) },
  }
  Object.assign(ctx, win)
  ctx.window = ctx // в браузере window и глобальный объект — одно и то же
  vm.createContext(ctx)
  const run = (file) => vm.runInContext(fs.readFileSync(new URL(file, WEB), 'utf8'), ctx, { filename: file })
  run('jsnes.js')
  run('games.js')
  if (extraGames) Object.assign(ctx.ARCADE_GAMES, extraGames(ctx.ARCADE_GAMES))
  for (const file of ['stats.js', 'library.js', 'game.js']) run(file)

  page.ctx = ctx
  page.byId = byId
  page.fire = (t, e = {}) => { for (const f of handlers[t] ?? []) f({ preventDefault() {}, repeat: false, ...e }) }
  page.heard = 0
  page.tick = (ms) => {
    now += ms
    const cb = raf.shift()
    if (cb) cb(now)
    const out = [new Float32Array(1024), new Float32Array(1024)]
    for (const n of audioNodes) n.onaudioprocess?.({ outputBuffer: { getChannelData: (c) => out[c] } })
    page.heard += out[0].filter((v) => v !== 0).length
  }
  return page
}

const textOf = (node) => (node.textContent || '') + (node.children || []).map(textOf).join('')
const stats = (storage) => JSON.parse(storage.get('arcade:stats') ?? '{}')
const probeGame = (games) => ({ probe: { ...games.thwaite, title: 'Проба', score: { label: 'кадров', parts: [[0x30, 1]] } } })

// --- Библиотека ---------------------------------------------------------------------------------
{
  const storage = new Map()
  const lib = makePage(storage, { search: '' })
  assert.equal(lib.ctx.document.title, 'Arcade')
  assert.ok(lib.ctx.document.body.classList.contains('library-mode'))
  const library = lib.byId.library
  let cards = library.querySelectorAll('.card')
  assert.deepEqual(cards.map((c) => c.dataset.game), ['thwaite', 'croom', 'rfk'])
  assert.match(textOf(cards[0]), /Thwaite.*аркада.*ещё не играли/)
  assert.equal(lib.focused, cards[0])
  assert.match(textOf(library), /Пока агент работает — сыграй/)

  lib.fire('keydown', { code: 'ArrowDown' })
  assert.equal(lib.focused, cards[1])
  lib.fire('keydown', { code: 'ArrowUp' })
  lib.fire('keydown', { code: 'ArrowUp' }) // по кругу — на последнюю
  assert.equal(lib.focused, cards[2])

  lib.fire('keydown', { code: 'ArrowRight' }) // вкладка Sega
  assert.equal(storage.get('arcade:tab'), 'sega')
  assert.equal(library.querySelectorAll('.card').length, 0)
  assert.match(textOf(library), /Готовим эмулятор Mega Drive/)
  assert.match(textOf(library.querySelectorAll('.tab')[1]), /Sega.*скоро/)

  lib.fire('keydown', { code: 'ArrowLeft' }) // обратно на Денди, выбрана первая
  cards = library.querySelectorAll('.card')
  assert.equal(lib.focused, cards[0])
  lib.fire('keydown', { code: 'Enter' })
  assert.equal(lib.navigated, '?game=thwaite')
}

// --- Игра: старт, кадры, звук, пауза, сохранение, статистика -------------------------------------
const storage = new Map()
const page = makePage(storage)
assert.equal(page.ctx.document.title, 'Thwaite · Arcade')
assert.ok(page.byId.overlay.classList.contains('shown'), 'стартовая заставка')
assert.match(page.byId['overlay-hint'].textContent, /начать/)
assert.equal(page.byId.screen.style.width, `${256 * 3}px`, 'целый масштаб: 900×772 → ×3')
assert.equal(page.byId.sound.textContent, 'Звук: вкл')

page.tick(100)
page.tick(100)
const before = page.draws
assert.equal(stats(storage).thwaite, undefined, 'до старта партия не засчитана')
page.fire('keydown', { code: 'Enter' })
assert.ok(!page.byId.overlay.classList.contains('shown'))
assert.equal(page.audioState, 'running')
assert.equal(stats(storage).thwaite.plays, 1)
for (let i = 0; i < 120; i++) page.tick(16.7)
assert.ok(page.draws - before >= 100, 'кадры рисуются: ' + (page.draws - before))

page.fire('keydown', { code: 'Enter' })
page.tick(16.7)
page.fire('keyup', { code: 'Enter' })
for (let i = 0; i < 520; i++) page.tick(16.7) // всего больше 600 кадров — статистика сохраняется сама
page.fire('keydown', { code: 'KeyW' })
for (let i = 0; i < 10; i++) page.tick(16.7)
page.fire('keyup', { code: 'KeyW' })
assert.ok(page.heard > 100, 'звук слышен: ' + page.heard)
assert.ok(stats(storage).thwaite.seconds >= 9.9, 'время сохраняется на ходу: ' + stats(storage).thwaite.seconds)

page.fire('blur')
assert.equal(page.byId['overlay-title'].textContent, 'Пауза')
assert.equal(page.audioState, 'suspended')
assert.ok(storage.has('arcade:thwaite:save'), 'прогресс сохранён')
const played = stats(storage).thwaite
assert.ok(played.seconds > 10.5 && played.seconds < 12, 'всё время игры: ' + played.seconds)
const drawsPaused = page.draws
for (let i = 0; i < 30; i++) page.tick(16.7)
assert.equal(page.draws, drawsPaused, 'на паузе кадры не рисуются')
page.fire('keydown', { code: 'KeyW' }) // снова в игру — та же партия, не новая
assert.equal(stats(storage).thwaite.plays, 1)

// Библиотека видит статистику
const libAfter = makePage(storage, { search: '' })
assert.match(textOf(libAfter.byId.library.querySelectorAll('.card')[0]), /сыграно меньше минуты · 1 раз/)

// Новое окно продолжает с места остановки; «Сначала» стирает сохранение
const again = makePage(storage)
assert.match(again.byId['overlay-hint'].textContent, /Продолжаем с места остановки/)
again.byId.restart.listeners.click[0]()
assert.ok(!storage.has('arcade:thwaite:save'))
assert.equal(stats(storage).thwaite.plays, 2, '«Сначала» начинает новую партию')

// Звук выключается и это запоминается
again.byId.sound.listeners.click[0]()
assert.equal(storage.get('arcade:sound'), 'off')
assert.equal(makePage(storage).byId.sound.textContent, 'Звук: выкл')

// --- Рекорд из памяти приставки: игра со «счётом» — счётчиком кадров Thwaite ($30) -------------------
const recordStorage = new Map()
const probe = makePage(recordStorage, { search: '?game=probe', extraGames: probeGame })
probe.fire('keydown', { code: 'Enter' })
for (let i = 0; i < 200; i++) probe.tick(16.7)
assert.match(probe.byId.best.textContent, /^кадров: \d+/)
probe.fire('blur')
assert.ok(stats(recordStorage).probe.best > 0, 'рекорд сохранён: ' + stats(recordStorage).probe.best)
const recordShown = makePage(recordStorage, { search: '?game=probe', extraGames: probeGame })
assert.match(recordShown.byId.best.textContent, /^кадров: \d+/, 'рекорд виден с самого начала')
assert.equal(makePage(new Map(), { search: '?game=croom' }).byId.best.textContent, '', 'у игры без счёта рекорда нет')

// --- Формулы статистики ---------------------------------------------------------------------------
const S = page.ctx.window.ArcadeStats
const memory = new Array(0x10000).fill(0)
memory[0x3d9] = 1
memory[0x3da] = 23
assert.equal(S.readScore(page.ctx.ARCADE_GAMES.thwaite.score, memory), 12300, 'счёт Thwaite: 1 сотня и 23 → 12 300 на экране')
assert.equal(S.readScore(undefined, memory), null)
assert.deepEqual([1, 3, 5, 11, 21, 22, 112].map(S.times), ['1 раз', '3 раза', '5 раз', '11 раз', '21 раз', '22 раза', '112 раз'])
assert.deepEqual([30, 754, 3900].map(S.duration), ['меньше минуты', '12 мин', '1 ч 05 мин'])

// --- Геймпад и неизвестная игра ---------------------------------------------------------------------
const pad = { buttons: Array.from({ length: 16 }, () => ({ pressed: false })), axes: [0, 0] }
const withPad = makePage(new Map(), { pads: [pad] })
withPad.tick(16.7)
pad.buttons[9].pressed = true
withPad.tick(16.7)
assert.ok(!withPad.byId.overlay.classList.contains('shown'), 'Start на геймпаде снимает паузу')

const missing = makePage(new Map(), { search: '?game=nope' })
assert.match(missing.byId['overlay-title'].textContent, /не найдена/)

// --- Две другие игры Денди запускаются -------------------------------------------------------------
for (const id of ['croom', 'rfk']) {
  const other = makePage(new Map(), { search: `?game=${id}` })
  other.fire('keydown', { code: 'Enter' })
  const drawn = other.draws
  for (let i = 0; i < 60; i++) other.tick(16.7)
  assert.ok(other.draws - drawn >= 55, `${id} идёт`)
}
console.log('страница игры: все проверки прошли')
