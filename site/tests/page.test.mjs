// Проверка окна Arcade без браузера: поддельный DOM и поддельная сеть, которая отдаёт файлы собранного сайта.
// Запуск: node tests/page.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { build, download } from '../build.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
// Рядом с кешем скачанных игр (site/.cache): на том же диске их большие файлы встают ссылками, без копий
fs.mkdirSync(path.join(ROOT, '.cache', 'tmp'), { recursive: true })
const DIST = fs.mkdtempSync(path.join(ROOT, '.cache', 'tmp', 'arcade-site-'))
process.on('exit', () => fs.rmSync(DIST, { recursive: true, force: true })) // собранный сайт — только на время теста
await download({ root: ROOT }) // игры из каталога, которые сборка скачивает: Warzone 2100
build({ root: ROOT, out: DIST })

// Сеть: файлы из собранного сайта; можно подменить ответ или «уронить» адрес
function network({ override = {}, down = false } = {}) {
  return async (url) => {
    if (down) throw new Error('Failed to fetch')
    const name = String(url).replace(/^\.?\//, '')
    let bytes = name in override ? override[name] : fs.existsSync(path.join(DIST, name)) ? fs.readFileSync(path.join(DIST, name)) : null
    if (typeof bytes === 'function') bytes = bytes(fs.readFileSync(path.join(DIST, name)))
    if (bytes === null) return { ok: false, status: 404, json: async () => ({}), arrayBuffer: async () => new ArrayBuffer(0) }
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes)
    return {
      ok: true,
      status: 200,
      json: async () => JSON.parse(buf.toString('utf8')),
      arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length),
    }
  }
}

async function makePage(storage, { search = '?game=thwaite', hash = '', pads = [], net = {}, language = 'ru-RU', globals = {} } = {}) {
  let now = 0
  const raf = []
  const audioNodes = []
  const handlers = {}
  const page = { draws: 0, focused: null, navigated: null, appended: [], onScript: null, sockets: [] }
  function element(tag) {
    const node = {
      tagName: tag, className: '', textContent: '', href: '', tabIndex: 0, style: {}, dataset: {}, children: [], files: [], value: '',
      clientWidth: 900, clientHeight: 800, listeners: {},
      classList: { set: new Set(), add(c) { this.set.add(c) }, remove(c) { this.set.delete(c) }, contains(c) { return this.set.has(c) } },
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f) },
      blur() {},
      click() { for (const f of this.listeners.click ?? []) f({}) },
      focus() { page.focused = node },
      append(...kids) { for (const k of kids) node.children.push(typeof k === 'string' ? { textContent: k, children: [] } : k) },
      appendChild(kid) { node.children.push(kid); page.appended.push(kid); if (kid.tagName === 'script' && page.onScript) page.onScript(kid); return kid },
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
  const ctx = {
    location: { get search() { return search }, set search(v) { page.navigated = v }, get hash() { return hash }, set hash(v) { page.navigated = `#${v}` }, reload() { page.reloaded = true } },
    URLSearchParams, console, crypto: webcrypto, URL, Blob, File, TextEncoder, TextDecoder, btoa, atob, DecompressionStream, Response, Event,
    // Таймеры страницы не держат тест: отсчёт раунда и возврат в лобби — минуты
    setTimeout: (fn, ms) => { const h = setTimeout(fn, ms); h.unref?.(); return h },
    setInterval: (fn, ms) => { const h = setInterval(fn, ms); h.unref?.(); return h },
    clearTimeout, clearInterval,
    // WebSocket для сетевой игры: тест сам подыгрывает за сервер через page.sockets
    WebSocket: class {
      constructor(url) { this.url = url; this.sent = []; this.listeners = {}; this.readyState = 1; page.sockets.push(this) }
      addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn) }
      send(data) { this.sent.push(data) }
      close() { this.closed = true }
      emit(type, data) { for (const fn of this.listeners[type] || []) fn({ data }) }
    },
    history: { replaceState: (s, title, url) => { page.replaced = url }, pushState: (s, title, url) => { page.pushed = url } },
    fetch: network(net),
    performance: { now: () => now },
    requestAnimationFrame: (cb) => raf.push(cb),
    navigator: { getGamepads: () => pads, language }, // браузер по-русски; другой язык — параметр language
    localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)), removeItem: (k) => storage.delete(k) },
    document: {
      title: '', hidden: false, body: element('body'), createElement: element,
      getElementById: (id) => (byId[id] ??= element('div')),
      addEventListener: (t, f) => (handlers['doc:' + t] ??= []).push(f),
    },
    addEventListener: (t, f) => (handlers[t] ??= []).push(f),
    AudioContext: class {
      constructor() { this.sampleRate = 48000; this.destination = {} }
      createScriptProcessor() { const n = { connect() {} }; audioNodes.push(n); return n }
      suspend() { page.audioState = 'suspended' }
      resume() { page.audioState = 'running' }
    },
  }
  Object.assign(ctx, globals) // то, что окно в браузере подгрузило бы само (например, chess.js)
  ctx.window = ctx
  vm.createContext(ctx)
  // Скрипт, который страница подгружает сама: sega.js — выполнить, как браузер; loader.js эмулятора — только запомнить
  page.onScript = (script) => {
    if (['ejs.js', 'netdoom.js', 'board-rules.js', 'board.js', 'chess.js', 'go.js', 'book-format.js', 'reader.js', 'flappy.js', 'audio.js'].includes(script.src)) {
      vm.runInContext(fs.readFileSync(path.join(DIST, script.src), 'utf8'), ctx, { filename: script.src })
      setTimeout(() => script.onload && script.onload(), 0)
    }
  }
  for (const file of ['i18n.js', 'jsnes.js', 'mapper28.js', 'stats.js', 'mine.js', 'library.js', 'game.js', 'boot.js']) {
    vm.runInContext(fs.readFileSync(path.join(DIST, file), 'utf8'), ctx, { filename: file })
  }
  // Ждём, пока каталог и игра скачаются и проверятся: проверка хеша в Node идёт в другом потоке
  const settled = () => {
    const hint = byId['overlay-hint']?.textContent ?? ''
    const library = byId.library?.children?.length ?? 0
    const overlayShown = byId.overlay?.classList.contains('shown')
    const segaStarted = page.appended.some((s) => s.src === 'emulatorjs/loader.js')
    const flappy = page.appended.some((s) => s.src === 'flappy.js') // своя игра: движок подключён
    const board = (byId.stage?.children ?? []).some((n) => (n.id === 'board-root' && n.children?.length) || n.id === 'web-game' || n.id === 'reader-root' || (n.id === 'audio-root' && n.children?.length)) // настольные, браузерные, книги, аудиокниги
    return library > 0 || segaStarted || board || flappy || (overlayShown && hint !== '' && hint !== 'Загружаю игру…')
  }
  for (let i = 0; i < 500 && !settled(); i++) await new Promise((r) => setTimeout(r, 2))
  assert.ok(settled(), 'окно так и не загрузилось')
  Object.assign(page, { ctx, byId })
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
const catalog = JSON.parse(fs.readFileSync(path.join(DIST, 'catalog.json'), 'utf8'))
assert.ok(Object.keys(catalog.games).length >= 12)

// --- Библиотека из каталога с сервера ---------------------------------------------------------------
{
  const storage = new Map()
  const lib = await makePage(storage, { search: '' })
  assert.equal(lib.ctx.document.title, 'Arcade')
  assert.match(textOf(lib.byId.library), /Открыть свой файл.*не отправится на сервер/)
  const library = lib.byId.library
  let cards = library.querySelectorAll('.card')
  const nesIds = Object.keys(catalog.games).filter((id) => catalog.games[id].console === 'nes')
  assert.deepEqual(cards.map((c) => c.dataset.game), nesIds)
  assert.match(textOf(cards[0]), /Thwaite.*аркада.*ещё не играли/)
  assert.equal(lib.focused, cards[0])
  lib.fire('keydown', { code: 'ArrowRight' })
  assert.equal(lib.pushed, '?tab=sega', 'у вкладки свой адрес')
  assert.deepEqual(library.querySelectorAll('.card').map((c) => c.dataset.game), ['miniplanets', 'dragons-castle', 'kleleatoms', 'lunch-break', '5stars', 'tank-battle', 'battle-4tris', 'pong', 'snake-arena', 'space-shooter', 'breakout'])
  lib.fire('keydown', { code: 'ArrowLeft' })
  lib.fire('keydown', { code: 'ArrowDown' })
  lib.fire('keydown', { code: 'Enter' })
  assert.equal(lib.navigated, '?game=croom')
}

// --- Нет сети: понятное сообщение -----------------------------------------------------------------------
{
  const offline = await makePage(new Map(), { search: '', net: { down: true } })
  assert.equal(offline.byId['overlay-title'].textContent, 'Нет связи с Arcade')
  assert.match(offline.byId['overlay-hint'].textContent, /Failed to fetch/)
}

// --- Подменённый файл игры не запускается ------------------------------------------------------------------
{
  const rom = catalog.games.thwaite.rom.url
  const tampered = await makePage(new Map(), { net: { override: { [rom]: (b) => Buffer.concat([b.subarray(0, 100), Buffer.from([0x42]), b.subarray(101)]) } } })
  assert.equal(tampered.byId['overlay-title'].textContent, 'Не удалось загрузить игру')
  assert.match(tampered.byId['overlay-hint'].textContent, /хеш не совпал/)
  const missing = await makePage(new Map(), { net: { override: { [rom]: null } } })
  assert.match(missing.byId['overlay-hint'].textContent, /сервер ответил 404/)
}

// --- Игра: загрузка, кадры, звук, пауза, сохранение, статистика ----------------------------------------------
const storage = new Map()
const page = await makePage(storage)
assert.equal(page.ctx.document.title, 'Thwaite · Arcade')
assert.match(page.byId['overlay-hint'].textContent, /Кликни или нажми любую клавишу, чтобы начать/)
assert.equal(page.byId.screen.style.width, `${256 * 3}px`)
assert.equal(page.byId.license.href, 'licenses/thwaite/LICENSE.txt')
assert.equal(page.byId.source.href, 'licenses/thwaite/thwaite-nes-00e3674-src.tar.gz')
page.fire('keydown', { code: 'Enter' })
assert.equal(stats(storage).thwaite.plays, 1)
const before = page.draws
for (let i = 0; i < 700; i++) page.tick(16.7)
assert.ok(page.draws - before >= 600, 'кадры рисуются')
assert.ok(page.heard > 100, 'звук слышен')
page.fire('blur')
assert.equal(page.byId['overlay-title'].textContent, 'Пауза')
assert.ok(storage.has('arcade:thwaite:save'))
assert.ok(stats(storage).thwaite.seconds > 11, 'время сохранено')

const libAfter = await makePage(storage, { search: '' })
assert.match(textOf(libAfter.byId.library.querySelectorAll('.card')[0]), /сыграно меньше минуты · 1 раз/)
const again = await makePage(storage)
assert.match(again.byId['overlay-hint'].textContent, /Продолжаем с места остановки/)

// --- Рекорд из памяти приставки: rfk хранит котят по адресу $DE -------------------------------------------------
{
  const recordStorage = new Map()
  const probe = await makePage(recordStorage, {
    search: '?game=thwaite',
    net: { override: { 'catalog.json': (b) => { const c = JSON.parse(b); c.games.thwaite.score = { label: 'кадров', parts: [[0x30, 1]] }; return Buffer.from(JSON.stringify(c)) } } },
  })
  probe.fire('keydown', { code: 'Enter' })
  for (let i = 0; i < 200; i++) probe.tick(16.7)
  assert.match(probe.byId.best.textContent, /^кадров: \d+/)
  probe.fire('blur')
  assert.ok(stats(recordStorage).thwaite.best > 0)
}

// --- Все игры каталога запускаются в окне ---------------------------------------------------------------------------
for (const id of Object.keys(catalog.games).filter((g) => g !== 'thwaite' && catalog.games[g].console === 'nes')) {
  const other = await makePage(new Map(), { search: `?game=${id}` })
  other.fire('keydown', { code: 'Enter' })
  const drawn = other.draws
  for (let i = 0; i < 60; i++) other.tick(16.7)
  assert.ok(other.draws - drawn >= 55, `${id} идёт`)
}
const unknown = await makePage(new Map(), { search: '?game=nope' })
assert.match(unknown.byId['overlay-title'].textContent, /не найдена/)
// --- Sega: страница скачивает игру, сверяет хеш и запускает EmulatorJS с нашего сайта ----------------------------
{
  const sega = await makePage(new Map(), { search: '?game=miniplanets' })
  assert.equal(sega.ctx.document.title, 'Miniplanets · Arcade')
  assert.ok(sega.appended.some((s) => s.src === 'ejs.js'), 'обвязка EmulatorJS подгружена')
  assert.ok(sega.appended.some((s) => s.src === 'emulatorjs/loader.js'), 'загрузчик эмулятора подключён')
  assert.equal(sega.ctx.EJS_core, 'segaMD')
  assert.equal(sega.ctx.EJS_gameUrl, catalog.games.miniplanets.rom.url)
  assert.equal(sega.ctx.EJS_pathtodata, 'emulatorjs/')
  assert.equal(sega.ctx.EJS_language, 'ru-RU')
  assert.equal(sega.ctx.EJS_player, '#sega-player')
  assert.equal(sega.byId.keys.textContent, 'движение — стрелки · A — S · B — X · C — Z · Start — Enter')
  assert.equal(sega.byId.license.href, 'licenses/miniplanets/LICENSE.txt')
  assert.equal(sega.byId.screen.style.display, 'none', 'экран Денди спрятан')
  assert.ok(sega.byId.stage.children.some((c) => c.id === 'sega-player'), 'эмулятор — внутри области игры, а не поверх полосы')
  for (const id of ['sound', 'restart', 'best']) assert.equal(sega.byId[id].style.display, 'none', `${id}: кнопка Денди спрятана`)
  // Окно потеряло фокус (так прячется встроенный браузер Claude) — эмулятор на паузе, его звук приостановлен
  const calls = []
  const audioCtx = { suspend() { calls.push('suspend') }, resume() { calls.push('resume') } }
  sega.ctx.EJS_emulator = {
    started: true, paused: false, Module: { AL: { currentCtx: { audioCtx } } },
    pause() { this.paused = true; calls.push('pause') },
    play() { this.paused = false; calls.push('play') },
  }
  sega.fire('blur')
  sega.fire('blur')
  assert.deepEqual(calls, ['pause', 'suspend'])
  assert.equal(sega.byId['overlay-title'].textContent, 'Пауза')
  assert.ok(sega.byId.overlay.classList.contains('shown'))
  sega.fire('keydown', { code: 'KeyX' })
  assert.deepEqual(calls, ['pause', 'suspend', 'resume', 'play'])
  assert.ok(!sega.byId.overlay.classList.contains('shown'))
  sega.fire('keydown', { code: 'KeyX' }) // игра идёт — клавиши её
  // Пауза с панели эмулятора — не наша: потеря фокуса её не трогает
  sega.ctx.EJS_emulator.paused = true
  sega.fire('blur')
  assert.equal(calls.length, 4)
  sega.ctx.EJS_emulator.paused = false
  // Игра запустилась, когда окно уже не в фокусе, — сразу на паузу; клик по заставке продолжает
  sega.ctx.document.hasFocus = () => false
  sega.ctx.EJS_onGameStart()
  assert.equal(calls.at(-1), 'suspend')
  sega.byId.overlay.click()
  assert.equal(calls.at(-1), 'play')
  // Сетевую игру не останавливаем: пауза у одного остановила бы партию у всех
  sega.ctx.EJS_emulator.isNetplay = true
  sega.fire('blur')
  assert.equal(calls.at(-1), 'play')
  // Подменённый файл Sega до эмулятора не доходит
  const rom = catalog.games.miniplanets.rom.url
  const bad = await makePage(new Map(), { search: '?game=miniplanets', net: { override: { [rom]: (b) => Buffer.concat([b.subarray(0, 300), Buffer.from([1]), b.subarray(301)]) } } })
  assert.match(bad.byId['overlay-hint'].textContent, /хеш не совпал/)
  assert.ok(!bad.appended.some((s) => s.src === 'emulatorjs/loader.js'))
}

// --- Пользовательский ROM: читается локально, получает отдельное сохранение и не требует лицензии на странице ---
{
  const local = await makePage(new Map(), { search: '' })
  const romUrl = JSON.stringify(catalog.games.thwaite.rom.url)
  await vm.runInContext(`(async () => {
    const response = await fetch(${romUrl})
    await ArcadeGame.startLocal(new Uint8Array(await response.arrayBuffer()), 'Моя игра.nes')
  })()`, local.ctx)
  assert.equal(local.ctx.document.title, 'Моя игра · Arcade')
  assert.equal(local.byId.credit.textContent, 'локальный ROM')
  assert.equal(local.byId.license.style.display, 'none')
  assert.equal(local.byId.source.style.display, 'none')
  await assert.rejects(
    vm.runInContext(`ArcadeGame.startLocal(new Uint8Array([1, 2, 3]), 'не-rom.bin')`, local.ctx),
    /нет заголовка iNES/,
  )
}
// --- Свои игры для всех приставок: файл остаётся в браузере, Sega и PlayStation идут в EmulatorJS ----------------
const until = async (check) => { for (let i = 0; i < 500 && !check(); i++) await new Promise((r) => setTimeout(r, 2)) }
const segaBytes = new Uint8Array(fs.readFileSync(path.join(ROOT, 'content', 'games', 'miniplanets', 'miniplanets.bin')))
{
  // Вкладка PlayStation из адреса: Hello Pong из каталога и кнопка своего файла с форматами дисков
  const psx = await makePage(new Map(), { search: '?tab=psx' })
  const text = textOf(psx.byId.library)
  assert.deepEqual(psx.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['hello-pong'])
  assert.match(text, /BIOS Sony не нужен/)
  const open = psx.byId.library.querySelectorAll('.open-rom')[0]
  assert.equal(open.textContent, 'Открыть свой файл')
  open.click()
  assert.equal(psx.byId['local-rom'].accept, '.chd,.pbp,.iso,.cue,.bin,.img,.zip,.7z,.m3u')

  // Свой диск PlayStation: выбор файла во вкладке → «Мои игры» → EmulatorJS с ядром psx из blob: этого браузера
  const input = psx.byId['local-rom']
  input.files = [new File([new Uint8Array(4096)], 'Моя_игра.chd', { lastModified: 1 })]
  await input.listeners.change[0]()
  await until(() => psx.ctx.EJS_core)
  assert.equal(psx.ctx.EJS_core, 'psx')
  assert.match(psx.ctx.EJS_gameUrl, /^blob:/)
  assert.equal(psx.ctx.document.title, 'Моя игра · Arcade')
  assert.equal(psx.byId.credit.textContent, 'свой файл — хранится только в этом браузере')
  assert.equal(psx.byId.license.style.display, 'none')
  assert.match(psx.replaced, /^#mine=psx-[0-9a-f]{12}$/)
  // Не образ диска — понятная ошибка
  await assert.rejects(vm.runInContext(`ArcadeMine.add(new File([new Uint8Array(8)], 'notes.txt'), 'psx')`, psx.ctx), /нужен образ диска/)
}
{
  // Свой файл Sega: проверка заголовка, id по хешу — как в моде, игра идёт в EmulatorJS; в библиотеке — «Мои игры»
  const lib = await makePage(new Map(), { search: '' })
  lib.ctx.__bytes = segaBytes
  const id = await vm.runInContext(`(async () => (await ArcadeMine.add(new File([__bytes], 'My_Sega_Game.md'), 'sega')).id)()`, lib.ctx)
  assert.match(id, /^mine-[0-9a-f]{12}$/)
  await assert.rejects(vm.runInContext(`ArcadeMine.add(new File([new Uint8Array(1024)], 'x.md'), 'sega')`, lib.ctx), /нет метки SEGA/)
  await assert.rejects(vm.runInContext(`ArcadeMine.add(new File([__bytes], 'x.nes'), 'nes')`, lib.ctx), /нет заголовка iNES/)
  // Архив вместо игры — прямой ответ: распакуй и выбери сам файл
  await assert.rejects(vm.runInContext(`ArcadeMine.add(new File([new Uint8Array([0x50, 0x4b, 3, 4, 20, 0, 0, 0])], 'game.zip'), 'sega')`, lib.ctx), /Это архив\. Распакуй его/)
  lib.fire('keydown', { code: 'ArrowRight' }) // на вкладку Sega — там «Мои игры»
  await until(() => lib.byId.library.querySelectorAll('.mine').length > 0)
  const mine = lib.byId.library.querySelectorAll('.mine')
  assert.equal(mine.length, 1)
  assert.equal(mine[0].dataset.mine, id)
  assert.match(textOf(lib.byId.library), /Мои игры — только в этом браузере/)
  await vm.runInContext(`(async () => ArcadePlayMine(await ArcadeMine.get(${JSON.stringify(id)})))()`, lib.ctx)
  await until(() => lib.ctx.EJS_core)
  assert.equal(lib.ctx.EJS_core, 'segaMD')
  assert.match(lib.ctx.EJS_gameUrl, /^blob:/)
  assert.equal(lib.ctx.document.title, 'My Sega Game · Arcade')
}
{
  // Мод просит свою игру Sega, которой в браузере ещё нет: выбрать файл один раз, хеш сверяется
  const sha = Array.from(new Uint8Array(await webcrypto.subtle.digest('SHA-256', segaBytes)), (b) => b.toString(16).padStart(2, '0')).join('')
  // Всё про свою игру — после #: на сервер не уходит
  const ask = await makePage(new Map(), { search: '', hash: `#mine=mine-${sha.slice(0, 12)}&console=sega&sha=${sha}&title=${encodeURIComponent('Моя Sega')}` })
  assert.equal(ask.byId['overlay-title'].textContent, 'Выбери файл «Моя Sega»')
  assert.equal(ask.byId['local-rom'].accept, '.md,.bin,.gen,.smd')
  // Чужой файл — отказ
  const input = ask.byId['local-rom']
  input.files = [new File([new Uint8Array(1024)], 'другой.md')]
  await input.listeners.change[0]()
  assert.match(ask.byId['overlay-hint'].textContent, /нет метки SEGA/)
  // Тот самый файл — игра запускается
  input.files = [new File([segaBytes], 'Моя Sega.md')]
  await input.listeners.change[0]()
  await until(() => ask.ctx.EJS_core)
  assert.equal(ask.ctx.EJS_core, 'segaMD')
  assert.equal(ask.replaced, `#mine=mine-${sha.slice(0, 12)}`)
  // Без подсказки от мода и без файла в браузере — понятное сообщение
  const lost = await makePage(new Map(), { search: '', hash: '#mine=mine-000000000000' })
  assert.equal(lost.byId['overlay-title'].textContent, 'Игра не найдена')
}

// --- Язык окна: lang=en от мода — английский интерфейс; список из 13 языков; по умолчанию — язык браузера ----------
{
  const en = await makePage(new Map(), { search: '?tab=nes&lang=en' })
  const lib = en.byId.library
  const button = (cls) => lib.querySelectorAll(cls)
  assert.equal(button('.open-rom')[0].textContent, 'Open your own file')
  const picker = button('.lang')[0]
  assert.equal(picker.value, 'en')
  assert.equal(picker.children.length, 13, '13 языков')
  assert.deepEqual(picker.children.slice(0, 3).map((o) => o.textContent), ['🌐 English', '🌐 Русский', '🌐 Українська'])
  assert.match(textOf(lib), /Your \.nes file opens only on this device/)
  assert.deepEqual(lib.querySelectorAll('.tab').map((b) => b.textContent), ['NES', 'Sega', 'Master System', 'PlayStation', 'Games', 'Books', 'Audiobooks'])
  assert.match(textOf(lib), /↑ ↓ — pick a game · ← → — console · Enter — play/)
  assert.ok(!/[А-Яа-яЁё]/.test(lib.querySelectorAll('.genre').map((g) => g.textContent).join(' ')), 'жанры переведены')
  assert.ok(!/[А-Яа-яЁё]/.test(lib.querySelectorAll('.about').map((a) => a.textContent).join(' ')), 'описания игр по-английски')
  assert.match(textOf(lib), /Missiles are falling on the town/)
  const game = await makePage(new Map(), { search: '?game=skyhaul&lang=en' })
  assert.equal(game.byId.keys.textContent, 'move — arrows · 1 (and Start) — X · 2 — Z · pause — Enter')
  const ru = await makePage(new Map(), { search: '?tab=nes' })
  assert.equal(ru.byId.library.querySelectorAll('.lang')[0].value, 'ru', 'браузер по-русски — русский')
  // Браузер на языке, которого у нас нет, — английский; испанский браузер — испанский (перевод — из locales/es.json)
  const other = await makePage(new Map(), { search: '?tab=nes', language: 'sw-KE' })
  assert.equal(other.byId.library.querySelectorAll('.lang')[0].value, 'en')
  const es = await makePage(new Map(), { search: '?tab=nes', language: 'es-ES' })
  assert.equal(es.byId.library.querySelectorAll('.lang')[0].value, 'es')
}

// --- Doom: ядро PrBoom, Freedoom из каталога, свой WAD — с расширением в имени ------------------------------------
{
  const doom = await makePage(new Map(), { search: '?game=freedoom-1' })
  assert.equal(doom.ctx.EJS_core, 'prboom')
  assert.equal(doom.ctx.EJS_gameUrl, catalog.games['freedoom-1'].rom.url)
  assert.match(doom.byId.keys.textContent, /огонь — A/)
  const lib = await makePage(new Map(), { search: '?tab=doom' })
  assert.deepEqual(lib.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['freedm', 'freedoom-1', 'freedoom-2', 'blasphemer', 'blasphdm', 'openarena'])
  lib.byId.library.querySelectorAll('.open-rom')[0].click()
  assert.equal(lib.byId['local-rom'].accept, '.wad,.zip')
  lib.ctx.__wad = new TextEncoder().encode('IWAD' + '\0'.repeat(64))
  await vm.runInContext(`(async () => ArcadePlayMine(await ArcadeMine.add(new File([__wad], 'My_Doom.wad'), 'doom')))()`, lib.ctx)
  await until(() => lib.ctx.EJS_core)
  assert.equal(lib.ctx.EJS_core, 'prboom')
  assert.equal(lib.ctx.EJS_gameName, 'My Doom.wad')
  await assert.rejects(vm.runInContext(`ArcadeMine.add(new File([new Uint8Array(64)], 'x.wad'), 'doom')`, lib.ctx), /нет метки IWAD или PWAD/)
  await assert.rejects(vm.runInContext(`ArcadeMine.add(new File([new Uint8Array(64)], 'x.txt'), 'doom')`, lib.ctx), /нужен файл \.wad/)
}

// --- Сетевой Doom: лобби, ведущий объявляет раунд, параметры doom-wasm ----------------------------------------------
{
  const solo = await makePage(new Map(), { search: '?game=freedm' })
  await until(() => solo.sockets.length > 0)
  const ws = solo.sockets[0]
  assert.match(ws.url, /\/net\/room\/doom-lobby$/)
  const net = solo.ctx.ArcadeNetDoom
  assert.equal(vm.runInContext("ArcadeNetDoom.leaderOf(['c9', 'a1', 'b5'])", solo.ctx), 'a1')
  // Массивы из страницы — в обычные: у них другая среда JavaScript
  const host = Array.from(net.doomArgs('freedm.wad', 'wss://x/net/doom/r', true))
  const guest = Array.from(net.doomArgs('freedm.wad', 'wss://x/net/doom/r', false))
  for (const a of ['-server', '-privateserver', '-deathmatch']) assert.ok(host.includes(a), a)
  assert.deepEqual(host.slice(host.indexOf('-timer'), host.indexOf('-timer') + 2), ['-timer', '5'])
  assert.deepEqual(guest.slice(guest.indexOf('-connect'), guest.indexOf('-connect') + 2), ['-connect', '1'])
  assert.equal(host.at(-1), 'wss://x/net/doom/r')
  // Один в лобби — ждём второго
  ws.emit('message', JSON.stringify({ type: 'welcome', id: 'a1', peers: [] }))
  assert.equal(solo.byId['overlay-title'].textContent, 'Ждём второго игрока')
  assert.equal(ws.sent.length, 0)
  // Пришёл второй — ведущий (наименьший номер) объявляет раунд и начинает отсчёт
  ws.emit('message', JSON.stringify({ type: 'join', id: 'b2' }))
  const round = JSON.parse(ws.sent[0])
  assert.equal(round.type, 'round')
  assert.equal(round.host, 'a1')
  assert.deepEqual(round.players, ['a1', 'b2'])
  assert.match(round.room, /^dm-a1-/)
  assert.equal(solo.byId['overlay-title'].textContent, 'Раунд начинается')
  // Не ведущий раунд не объявляет, но подхватывает чужое объявление
  const other = await makePage(new Map(), { search: '?game=freedm' })
  await until(() => other.sockets.length > 0)
  const ws2 = other.sockets[0]
  ws2.emit('message', JSON.stringify({ type: 'welcome', id: 'b2', peers: ['a1'] }))
  assert.equal(ws2.sent.length, 0)
  ws2.emit('message', JSON.stringify(round))
  assert.equal(other.byId['overlay-title'].textContent, 'Раунд начинается')
  // Лишний — ждёт следующего раунда
  const late = await makePage(new Map(), { search: '?game=freedm' })
  await until(() => late.sockets.length > 0)
  late.sockets[0].emit('message', JSON.stringify({ type: 'welcome', id: 'z9', peers: ['a1', 'b2'] }))
  late.sockets[0].emit('message', JSON.stringify({ type: 'round', room: 'dm-x', host: 'a1', players: ['a1', 'b2', 'c3', 'd4'] }))
  assert.equal(late.byId['overlay-title'].textContent, 'Идёт раунд')
  // Окно потеряло фокус посреди матча — игра идёт дальше (пауза остановила бы её у всех), но без звука до возвращения
  const calls = []
  other.ctx.Module = {
    SDL2: { audioContext: { suspend() { calls.push('suspend') }, resume() { calls.push('resume') } } },
    pauseMainLoop: () => calls.push('pause'),
  }
  other.ctx.document.hasFocus = () => true
  other.ctx.ArcadeNetDoom.quietWhenAway(other.ctx.document.createElement('canvas'), false)
  other.fire('blur')
  other.fire('blur')
  assert.deepEqual(calls, ['suspend'])
  assert.equal(other.byId['overlay-title'].textContent, 'Раунд начинается', 'без заставки «Пауза»')
  other.fire('focus')
  assert.deepEqual(calls, ['suspend', 'resume'])
}

// --- Браузер не дал захватить мышь (встроенный браузер Claude): один раз — заметка, как играть -----------------------
{
  const page = await makePage(new Map(), { search: '?game=blasphemer' })
  const note = page.byId['mouse-note']
  assert.ok(!note.classList.contains('shown'))
  page.fire('doc:pointerlockerror')
  assert.ok(note.classList.contains('shown'))
  assert.match(note.textContent, /не даёт игре захватить мышь — поворачивай стрелками/)
  note.click()
  assert.ok(!note.classList.contains('shown'), 'клик убирает заметку')
  page.fire('doc:pointerlockerror') // движок просит мышь на каждый клик — заметка не возвращается
  assert.ok(!note.classList.contains('shown'))
  const en = await makePage(new Map(), { search: '?game=blasphemer', language: 'en-US' })
  en.fire('doc:pointerlockerror')
  assert.match(en.byId['mouse-note'].textContent, /^This browser doesn't let the game capture the mouse/)
}

// --- Сетевая игра EmulatorJS: наш сервер вместо netplay.emulatorjs.org, прослойка вместо socket.io ------------------
{
  const sega = await makePage(new Map(), { search: '?game=tank-battle' })
  assert.equal(sega.ctx.EJS_gameID, parseInt(catalog.games['tank-battle'].rom.sha256.slice(0, 7), 16))
  assert.match(sega.ctx.EJS_netplayServer, /\/net\/ejs$/)
  assert.equal(sega.ctx.EJS_EXPERIMENTAL_NETPLAY, true, 'без этого флага EmulatorJS 4.2.3 прячет сетевую игру')
  assert.equal(sega.ctx.EJS_Buttons.netplay, true, 'кнопка сети на панели эмулятора по умолчанию скрыта')
  // «По сети» в полосе — явный выбор: сразу меню сетевой игры эмулятора
  assert.equal(sega.byId.net.hidden, false)
  let opened = false
  sega.ctx.EJS_emulator = { openNetplayMenu: () => { opened = true } }
  sega.byId.net.listeners.click[0]({ preventDefault() {} })
  assert.ok(opened, 'меню сетевой игры открылось')
  const doom = await makePage(new Map(), { search: '?game=freedoom-1' })
  assert.equal(doom.ctx.EJS_netplayServer, undefined, 'у одиночного Doom сети EmulatorJS нет')
  // Денди: обычно — JSNES с кнопкой «По сети»; с ?net=1 — EmulatorJS (FCEUmm) с сетевой игрой
  const nes = await makePage(new Map(), { search: '?game=thwaite' })
  assert.equal(nes.byId.net.href, '?game=thwaite&net=1')
  assert.equal(nes.byId.net.hidden, false)
  assert.equal(nes.ctx.EJS_core, undefined, 'обычная Денди — на JSNES')
  const nesNet = await makePage(new Map(), { search: '?game=thwaite&net=1' })
  assert.equal(nesNet.ctx.EJS_core, 'nes')
  assert.equal(nesNet.ctx.EJS_gameID, parseInt(catalog.games.thwaite.rom.sha256.slice(0, 7), 16))
  assert.match(nesNet.ctx.EJS_netplayServer, /\/net\/ejs$/)
  assert.match(nesNet.byId.keys.textContent, /A — Z · B — X/)
  // Прослойка — та, что сборка кладёт вместо socket.io
  const page = await makePage(new Map(), { search: '' })
  vm.runInContext(fs.readFileSync(path.join(DIST, 'emulatorjs', 'src', 'socket.io.min.js'), 'utf8'), page.ctx)
  page.ctx.EJS_gameID = 123
  const sock = vm.runInContext("io('https://arcade.test/net/ejs')", page.ctx)
  const ws = page.sockets.at(-1)
  assert.equal(ws.url, 'wss://arcade.test/net/ejs/123')
  let connected = false
  sock.on('connect', () => { connected = true })
  ws.emit('open')
  assert.ok(connected)
  let acked = 'нет'
  sock.emit('open-room', { extra: { sessionid: 's1' }, maxPlayers: 2 }, (error) => { acked = error })
  const first = JSON.parse(ws.sent[0])
  assert.equal(first.t, 'emit')
  assert.equal(first.event, 'open-room')
  ws.emit('message', JSON.stringify({ t: 'ack', id: first.id, args: [null] }))
  assert.equal(acked, null)
  // Большое сохранение — кусками; собранное обратно — снова двоичные данные
  vm.runInContext("__state = new Uint8Array(700000).map((_, i) => i % 251); __sock = io('https://arcade.test/net/ejs')", page.ctx)
  const ws2 = page.sockets.at(-1)
  vm.runInContext("__sock.emit('data-message', { state: __state })", page.ctx)
  const chunks = ws2.sent.map((m) => JSON.parse(m))
  assert.ok(chunks.length >= 2 && chunks.every((c) => c.t === 'chunk'), 'кусками')
  let got = null
  vm.runInContext("__sock.on('data-message', (d) => { __got = d })", page.ctx)
  for (const c of chunks) ws2.emit('message', JSON.stringify(c))
  got = page.ctx.__got
  assert.equal(got.state.length, 700000)
  assert.equal(got.state[500], 500 % 251)
}

// --- Кооператив Freedoom: «По сети» у одиночной игры, своё лобби, хозяин без deathmatch, WAD из .zip --------------
{
  const solo = await makePage(new Map(), { search: '?game=freedoom-1' })
  assert.equal(solo.byId.net.href, '?game=freedoom-1&net=coop')
  assert.equal(solo.byId.net.hidden, false)
  const coop = await makePage(new Map(), { search: '?game=freedoom-1&net=coop' })
  await until(() => coop.sockets.length > 0)
  assert.match(coop.sockets[0].url, /\/net\/room\/coop-freedoom-1$/)
  coop.sockets[0].emit('message', JSON.stringify({ type: 'welcome', id: 'a1', peers: [] }))
  assert.equal(coop.byId['overlay-title'].textContent, 'Ждём напарника')
  assert.match(coop.byId.keys.textContent, /огонь — Ctrl/, 'клавиши сетевого движка, а не PrBoom')
  const host = Array.from(vm.runInContext("ArcadeNetDoom.doomArgs('freedoom1.wad', 'wss://x/net/doom/r', true, 'coop')", coop.ctx))
  assert.ok(!host.includes('-deathmatch') && !host.includes('-timer'), 'кооператив — без deathmatch и таймера')
  assert.deepEqual(host.slice(host.indexOf('-skill'), host.indexOf('-skill') + 2), ['-skill', '3'])
  // WAD из настоящего .zip Freedoom — распакован целиком
  const zip = fs.readFileSync(path.join(ROOT, 'content', 'games', 'freedoom-1', 'freedoom1.zip'))
  coop.ctx.fetch = async () => ({ arrayBuffer: async () => zip.buffer.slice(zip.byteOffset, zip.byteOffset + zip.byteLength) })
  const wad = await vm.runInContext("ArcadeNetDoom.wadFrom('files/x.zip')", coop.ctx)
  assert.equal(wad.length, 28795076)
  assert.equal(String.fromCharCode(...wad.subarray(0, 4)), 'IWAD')
}

// --- Настольные игры: правила, вкладка, меню, партия реверси -------------------------------------------------------
{
  const page = await makePage(new Map(), { search: '' })
  vm.runInContext(fs.readFileSync(path.join(DIST, 'board-rules.js'), 'utf8'), page.ctx)
  const check = (code) => vm.runInContext(code, page.ctx)
  // Реверси: в начале 4 хода, пропускать нельзя, переворот
  assert.equal(check('ArcadeBoardRules.reversi.moves(ArcadeBoardRules.reversi.start()).length'), 4)
  assert.throws(() => check("ArcadeBoardRules.reversi.apply(ArcadeBoardRules.reversi.start(), 'pass')"), /пропускать нельзя/)
  assert.equal(check('ArcadeBoardRules.reversi.score(ArcadeBoardRules.reversi.apply(ArcadeBoardRules.reversi.start(), [2, 3])).join(":")'), '4:1')
  // Шашки: в начале 7 ходов; бить обязательно; дамка «летает»; шашка, ставшая дамкой посреди взятия, бьёт дальше как дамка
  assert.equal(check('ArcadeBoardRules.checkers.moves(ArcadeBoardRules.checkers.start()).length'), 7)
  const pos = (pieces) => `({ turn: 0, board: (() => { const b = Array.from({ length: 8 }, () => Array(8).fill(null)); for (const [r, c, side, king] of ${JSON.stringify(pieces)}) b[r][c] = { side, king }; return b })() })`
  assert.equal(check(`JSON.stringify(ArcadeBoardRules.checkers.moves(${pos([[5, 2, 0, false], [4, 3, 1, false], [6, 7, 0, false]])}))`), '[[[5,2],[3,4]]]', 'есть бой — только бой')
  const flying = JSON.parse(check(`JSON.stringify(ArcadeBoardRules.checkers.moves(${pos([[7, 0, 0, true], [3, 4, 1, false]])}))`))
  assert.deepEqual(flying, [[[7, 0], [2, 5]], [[7, 0], [1, 6]], [[7, 0], [0, 7]]], 'дамка бьёт издалека и встаёт на любое поле за шашкой')
  const crowned = JSON.parse(check(`JSON.stringify(ArcadeBoardRules.checkers.moves(${pos([[2, 1, 0, false], [1, 2, 1, false], [2, 5, 1, false]])}))`))
  assert.deepEqual(crowned, [[[2, 1], [0, 3], [3, 6]], [[2, 1], [0, 3], [4, 7]]], 'стала дамкой на 8-м ряду и бьёт дальше как дамка')
  // Боты: ход по правилам, бот шашек бьёт, бот реверси берёт угол
  assert.equal(check('JSON.stringify(ArcadeBoardRules.bestMove("checkers", ' + pos([[5, 2, 0, false], [4, 3, 1, false], [7, 6, 0, false], [0, 1, 1, false]]) + '))'), '[[5,2],[3,4]]')
  const corner = check(`(() => { const s = { turn: 0, board: Array.from({ length: 8 }, () => Array(8).fill(null)) }; s.board[0][1] = 1; s.board[0][2] = 0; s.board[3][3] = 1; s.board[3][2] = 0; return JSON.stringify(ArcadeBoardRules.bestMove('reversi', s, 1)) })()`)
  assert.equal(corner, '[0,0]', 'по оценке позиции угол — лучший ход (на глубине 3 бот здесь находит победу за два хода)')
  for (const kind of ['reversi', 'checkers']) {
    const legal = check(`(() => { const R = ArcadeBoardRules.${kind}; const s = R.start(); const m = ArcadeBoardRules.bestMove('${kind}', s); return R.moves(s).some((x) => JSON.stringify(x) === JSON.stringify(m)) })()`)
    assert.equal(legal, true, `${kind}: ход бота по правилам`)
  }
  // Вкладка «Настольные» — без кнопки своих файлов
  const lib = await makePage(new Map(), { search: '?tab=board' })
  assert.deepEqual(lib.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['chess', 'checkers', 'reversi', 'go'])
  assert.equal(lib.byId.library.querySelectorAll('.open-rom').length, 1, 'только кнопка языка')
  // Меню игры
  const menu = await makePage(new Map(), { search: '?game=reversi' })
  await until(() => menu.ctx.ArcadeBoard)
  assert.match(textOf(menu.byId.stage), /Найти соперника/)
  assert.match(textOf(menu.byId.stage), /С компьютером/)
  // Игра с ботом: ход игрока — ответ компьютера, партия запоминается, «Начать заново» — стороны меняются
  const botStore = new Map()
  const bot = await makePage(botStore, { search: '?game=reversi&vs=bot' })
  await until(() => /Твой ход/.test(textOf(bot.byId.stage)))
  assert.match(textOf(bot.byId.stage), /Твой ход \(чёрные\)/)
  vm.runInContext('ArcadeBoard.game.click(2, 3)', bot.ctx)
  await until(() => vm.runInContext('ArcadeBoard.game.moves.length', bot.ctx) === 2)
  assert.equal(vm.runInContext('ArcadeBoard.game.moves.length', bot.ctx), 2, 'компьютер ответил')
  assert.match(textOf(bot.byId.stage), /Твой ход/)
  assert.equal(JSON.parse(botStore.get('arcade:board:bot:reversi')).moves.length, 2, 'партия запомнилась')
  vm.runInContext('ArcadeBoard.game.reset()', bot.ctx)
  await until(() => vm.runInContext('ArcadeBoard.game.seat === 1 && ArcadeBoard.game.moves.length === 1', bot.ctx))
  assert.equal(vm.runInContext('ArcadeBoard.game.moves.length', bot.ctx), 1, 'после «Начать заново» бот ходит первым')
  // «Сдаться» с компьютером: поражение, кнопки больше нет, итог запомнился; «Новая партия» — заново, без итога
  const buttonOf = (node, re) => (node.children || []).reduce((hit, c) => hit || (c.tagName === 'button' && re.test(c.textContent) ? c : buttonOf(c, re)), null)
  bot.byId.stage.querySelectorAll('.board-resign')[0].click()
  await until(() => /Ты сдался — поражение/.test(textOf(bot.byId.stage)))
  assert.match(textOf(bot.byId.stage), /Ты сдался — поражение/)
  assert.equal(bot.byId.stage.querySelectorAll('.board-resign').length, 0, 'после сдачи кнопки нет')
  assert.deepEqual(JSON.parse(botStore.get('arcade:board:bot:reversi')).result, { loser: 1, reason: 'resign' })
  const reopened = await makePage(botStore, { search: '?game=reversi&vs=bot' })
  await until(() => /Ты сдался — поражение/.test(textOf(reopened.byId.stage)))
  assert.match(textOf(reopened.byId.stage), /Ты сдался — поражение/, 'итог на месте и после перезагрузки')
  buttonOf(reopened.byId.stage, /Новая партия/).click()
  await until(() => /Твой ход \(чёрные\)/.test(textOf(reopened.byId.stage)))
  assert.equal(JSON.parse(botStore.get('arcade:board:bot:reversi')).result, undefined, 'новая партия — без итога')
  assert.equal(reopened.byId.stage.querySelectorAll('.board-resign').length, 1)
  // Шашки — та же кнопка
  const draughts = await makePage(new Map(), { search: '?game=checkers&vs=bot' })
  await until(() => /Твой ход/.test(textOf(draughts.byId.stage)))
  assert.equal(draughts.byId.stage.querySelectorAll('.board-resign').length, 1, 'в шашках можно сдаться')
  // Партия реверси: подключение, «Твой ход», клик — ход на сервер, ответ — «Ход соперника»
  const game = await makePage(new Map(), { search: '?game=reversi&room=abcdef1234' })
  await until(() => game.sockets.length > 0)
  const ws = game.sockets[0]
  assert.match(ws.url, /\/net\/board\/abcdef1234$/)
  ws.emit('open')
  assert.equal(JSON.parse(ws.sent[0]).type, 'hello')
  ws.emit('message', JSON.stringify({ type: 'state', game: 'reversi', seat: 0, seats: 2, moves: [] }))
  assert.match(textOf(game.byId.stage), /Твой ход \(чёрные\)/)
  vm.runInContext('ArcadeBoard.game.click(2, 3)', game.ctx)
  assert.deepEqual(JSON.parse(ws.sent.at(-1)), { type: 'move', ply: 0, move: [2, 3] })
  ws.emit('message', JSON.stringify({ type: 'move', ply: 0, move: [2, 3] }))
  assert.match(textOf(game.byId.stage), /Ход соперника — можно вернуться к агенту/)
  assert.equal(vm.runInContext('ArcadeBoard.game.moves.length', game.ctx), 1)
  assert.doesNotMatch(textOf(game.byId.stage), /@/, 'без ников — без имён')
  // «Сдаться» по сети: просьба серверу; итог присылает сервер — поражение, ходить нельзя, «Новая партия»
  game.byId.stage.querySelectorAll('.board-resign')[0].click()
  assert.deepEqual(JSON.parse(ws.sent.at(-1)), { type: 'resign' })
  ws.emit('message', JSON.stringify({ type: 'state', game: 'reversi', seat: 0, seats: 2, moves: [[2, 3]], result: { loser: 0, reason: 'resign' } }))
  assert.match(textOf(game.byId.stage), /Ты сдался — поражение/)
  assert.equal(game.byId.stage.querySelectorAll('.board-resign').length, 0, 'после сдачи кнопки нет')
  assert.ok(buttonOf(game.byId.stage, /Новая партия/))
  ws.emit('message', JSON.stringify({ type: 'state', game: 'reversi', seat: 1, seats: 2, moves: [[2, 3]], result: { loser: 0, reason: 'resign' } }))
  assert.match(textOf(game.byId.stage), /Соперник сдался — победа!/)
  const sent = ws.sent.length
  vm.runInContext('(() => { const g = ArcadeBoard.game; const [r, c] = g.rules.targets(g.position)[0]; g.click(r, c) })()', game.ctx)
  assert.equal(ws.sent.length, sent, 'после сдачи ходов нет')
  ws.emit('message', JSON.stringify({ type: 'state', game: 'reversi', seat: -1, seats: 2, moves: [[2, 3]], result: { loser: 0, reason: 'resign' } }))
  assert.match(textOf(game.byId.stage), /Партия окончена: сдались/)
  assert.equal(buttonOf(game.byId.stage, /Новая партия/), null, 'зрителю новую партию не начать')
  // @ник: мод кладёт подпись после # — страница прячет её в браузер, убирает из адреса и шлёт в hello
  const TICKET = `fefa.1790000000.${'A'.repeat(22)}`
  const namedStore = new Map()
  const named = await makePage(namedStore, { search: '?game=reversi&room=abcdef1234', hash: `#me=${TICKET}` })
  await until(() => named.sockets.length > 0)
  assert.equal(namedStore.get('arcade:me'), TICKET)
  assert.equal(named.replaced, '?game=reversi&room=abcdef1234', 'подпись убрана из адреса')
  const nws = named.sockets[0]
  nws.emit('open')
  assert.deepEqual(JSON.parse(nws.sent[0]), { type: 'hello', token: JSON.parse(nws.sent[0]).token, game: 'reversi', me: TICKET })
  nws.emit('message', JSON.stringify({ type: 'state', game: 'reversi', seat: 0, seats: 1, moves: [], names: ['fefa'] }))
  assert.match(textOf(named.byId.stage), /чёрные — @fefa/)
  assert.doesNotMatch(textOf(named.byId.stage), /белые — @/)
  nws.emit('message', JSON.stringify({ type: 'seats', seats: 2, names: ['fefa', 'octo_cat'] }))
  assert.match(textOf(named.byId.stage), /чёрные — @fefa · белые — @octo_cat/)
  // Подпись живёт в браузере: следующая партия без # тоже с ником; пустая #me= — забыть (вышел из аккаунта)
  const later = await makePage(namedStore, { search: '?game=reversi&room=abcdef9999' })
  await until(() => later.sockets.length > 0)
  later.sockets[0].emit('open')
  assert.equal(JSON.parse(later.sockets[0].sent[0]).me, TICKET)
  assert.equal(later.replaced, undefined, 'адрес без подписи не трогаем')
  const out = await makePage(namedStore, { search: '?game=reversi&room=abcdef9999', hash: '#me=' })
  await until(() => out.sockets.length > 0)
  assert.equal(namedStore.has('arcade:me'), false, 'пустая подпись — забыть прежнюю')
  out.sockets[0].emit('open')
  assert.equal('me' in JSON.parse(out.sockets[0].sent[0]), false)
  // С компьютером — без подписи: соперник не человек
  const botNamed = await makePage(new Map([['arcade:me', TICKET]]), { search: '?game=reversi&vs=bot' })
  await until(() => /Твой ход/.test(textOf(botNamed.byId.stage)))
  assert.doesNotMatch(textOf(botNamed.byId.stage), /@fefa/)
}

// --- Браузерные игры: HexGL в рамке под полосой окна ----------------------------------------------------------------
{
  const page = await makePage(new Map(), { search: '?game=hexgl' })
  await until(() => page.byId.stage.children.some((n) => n.id === 'web-game'))
  const frame = page.byId.stage.children.find((n) => n.id === 'web-game')
  assert.equal(frame.src, 'web-games/hexgl/')
  assert.match(page.byId.keys.textContent, /воздушные тормоза — A и D/)
  assert.match(page.byId.license.href, /licenses\/hexgl\/LICENSE$/)
  // Окно потеряло фокус (так прячется встроенный браузер Claude) — гонка в рамке на паузе, её звук приостановлен
  const pause = () => new Promise((r) => setTimeout(r, 20)) // проверка фокуса — после того, как он перешёл
  const hexCalls = []
  const frames = []
  const time = { start: 1000, previous: 5000 }
  const hex = { active: true, gameplay: { timer: { time } }, manager: { time: 0 }, update() { hexCalls.push('update') } }
  frame.contentWindow = {
    hexGL: hex, bkcore: { Audio: { _ctx: { suspend() { hexCalls.push('suspend') }, resume() { hexCalls.push('resume') } } } },
    perfNow: () => 42, requestAnimationFrame: (f) => frames.push(f), listeners: {},
    addEventListener(t, f) { (this.listeners[t] ??= []).push(f) },
  }
  page.ctx.document.hasFocus = () => true // фокус ушёл внутрь рамки — это игра, не пауза
  for (const f of frame.listeners.load) f()
  frame.contentWindow.listeners.blur[0]()
  await pause()
  assert.equal(hex.active, true)
  page.ctx.document.hasFocus = () => false
  page.fire('blur')
  await pause()
  assert.equal(hex.active, false)
  assert.deepEqual(hexCalls, ['suspend'])
  assert.equal(page.byId['overlay-title'].textContent, 'Пауза')
  assert.ok(page.byId.overlay.classList.contains('shown'))
  // Клавиша в рамке продолжает гонку и в игру не попадает (Esc начал бы её заново); пауза не попадает во время круга
  let stopped = false
  frame.contentWindow.listeners.keydown[0]({ preventDefault() {}, stopPropagation() { stopped = true } })
  assert.ok(stopped)
  assert.equal(hex.active, true)
  assert.deepEqual(hexCalls, ['suspend', 'resume', 'update'])
  assert.equal(frames.length, 1, 'цикл кадров снова идёт')
  assert.ok(time.start > 1000 && time.start - 1000 === time.previous - 5000)
  assert.equal(hex.manager.time, 42)
  assert.ok(!page.byId.overlay.classList.contains('shown'))
  // Вкладка «Игры»: полки; старый адрес ?tab=web открывает полку первой его игры — гонки
  const lib = await makePage(new Map(), { search: '?tab=web' })
  assert.deepEqual(lib.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['hexgl'])
  assert.deepEqual(lib.byId.library.querySelectorAll('.shelf').map((b) => b.textContent), ['Аркады', 'Шутеры', 'Гонки', 'Стратегии', 'Квесты', 'Настольные'])
  assert.equal(lib.byId.library.querySelectorAll('.shelf').find((b) => /\bactive\b/.test(b.className)).textContent, 'Гонки')
  // «☕ Поддержать» в шапке — новой вкладкой, без лишних прав для открытой страницы
  const support = lib.byId.library.querySelectorAll('.support')[0]
  assert.equal(support.href, catalog.support.url)
  assert.equal(support.target, '_blank')
  assert.equal(support.rel, 'noopener')
  const strategy = await makePage(new Map(), { search: '?tab=games&shelf=strategy' })
  assert.deepEqual(strategy.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['openttd', 'micropolis', 'warzone2100'])
  const quests = await makePage(new Map(), { search: '?tab=games&shelf=quests' })
  assert.deepEqual(quests.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['scummvm'], 'полка квестов — ScummVM')
  // по умолчанию — первая полка, аркады: Flappy Arcade
  const arcade = await makePage(new Map(), { search: '?tab=games' })
  assert.deepEqual(arcade.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['flappy'], 'по умолчанию — первая полка, аркады')
  const shooters = await makePage(new Map(), { search: '?tab=games&shelf=shooters' })
  assert.deepEqual(shooters.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['freedm', 'freedoom-1', 'freedoom-2', 'blasphemer', 'blasphdm', 'openarena'], 'полка шутеров')
  assert.equal(shooters.byId.library.querySelectorAll('.open-rom').length, 2, 'у шутеров — «Открыть свой файл» (WAD) и язык')
  // Переключение полки — свой адрес
  strategy.byId.library.querySelectorAll('.shelf').find((b) => b.dataset.shelf === 'board').click()
  assert.deepEqual(strategy.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['chess', 'checkers', 'reversi', 'go'])
  const ttd = await makePage(new Map(), { search: '?game=openttd' })
  await until(() => ttd.byId.stage.children.some((n) => n.id === 'web-game'))
  const ttdFrame = ttd.byId.stage.children.find((n) => n.id === 'web-game')
  assert.equal(ttdFrame.src, 'web-games/openttd/openttd', 'без .html — сразу конечный адрес')
  // OpenTTD (Emscripten) открыли в фоне: пока он грузит данные, останавливать нечего; запустился — на паузе главный
  // цикл и звук SDL; клик по заставке — продолжить
  const ttdCalls = []
  const ttdModule = {
    calledRun: false, SDL2: { audioContext: { suspend() { ttdCalls.push('suspend') }, resume() { ttdCalls.push('resume') } } },
    pauseMainLoop: () => ttdCalls.push('pause'), resumeMainLoop: () => ttdCalls.push('play'),
  }
  ttdFrame.contentWindow = { Module: ttdModule, Browser: { mainLoop: { func: () => {} } }, addEventListener() {} }
  ttd.ctx.document.hasFocus = () => false
  for (const f of ttdFrame.listeners.load) f()
  await pause()
  assert.deepEqual(ttdCalls, [])
  ttdModule.calledRun = true
  for (let i = 0; i < 100 && !ttdCalls.length; i++) await pause() // следующая проверка — через секунду
  assert.deepEqual(ttdCalls, ['pause', 'suspend'])
  assert.equal(ttd.byId['overlay-title'].textContent, 'Пауза')
  ttd.byId.overlay.click()
  assert.deepEqual(ttdCalls, ['pause', 'suspend', 'resume', 'play'])
  assert.ok(!ttd.byId.overlay.classList.contains('shown'))
  // У ScummVM (Asyncify) главного цикла Emscripten нет — resumeMainLoop упал бы; на паузе только звук
  const vmCalls = []
  ttdFrame.contentWindow = {
    Module: {
      calledRun: true, SDL2: { audioContext: { suspend() { vmCalls.push('suspend') }, resume() { vmCalls.push('resume') } } },
      pauseMainLoop: () => vmCalls.push('pause'), resumeMainLoop: () => vmCalls.push('play'),
    },
    Browser: { mainLoop: { func: null } }, addEventListener() {},
  }
  ttd.fire('blur')
  for (let i = 0; i < 10 && !vmCalls.length; i++) await pause()
  assert.deepEqual(vmCalls, ['suspend'])
  assert.equal(ttd.byId['overlay-title'].textContent, 'Пауза')
  ttd.byId.overlay.click()
  assert.deepEqual(vmCalls, ['suspend', 'resume'])
  // Warzone 2100 останавливается сама (arcade-pause.js на её странице): окно зовёт arcadePause, клик — её «продолжить»
  const wzCalls = []
  ttdFrame.contentWindow = { arcadePause: () => { wzCalls.push('pause'); return () => wzCalls.push('play') }, Module: ttdModule, addEventListener() {} }
  ttd.fire('blur')
  for (let i = 0; i < 10 && !wzCalls.length; i++) await pause()
  assert.deepEqual(wzCalls, ['pause'])
  assert.equal(ttd.byId['overlay-title'].textContent, 'Пауза')
  ttd.byId.overlay.click()
  assert.deepEqual(wzCalls, ['pause', 'play'])
  assert.deepEqual(ttdCalls, ['pause', 'suspend', 'resume', 'play'], 'Module страницы не трогали')
  assert.equal(lib.byId.library.querySelectorAll('.open-rom').length, 1, 'только кнопка языка')
}

// --- Пауза Warzone 2100: arcade-pause.js со страницы игры — главный цикл и звук OpenAL ------------------------------
{
  const calls = []
  class FakeAudio {
    constructor() { this.state = 'running' }
    suspend() { calls.push('suspend'); this.state = 'suspended' }
    resume() { calls.push('resume'); this.state = 'running' }
  }
  const win = vm.createContext({ AudioContext: FakeAudio })
  win.window = win
  vm.runInContext(fs.readFileSync(path.join(DIST, 'web-games', 'warzone2100', 'arcade-pause.js'), 'utf8'), win)
  assert.equal(win.arcadePause(), null, 'игра ещё грузится — останавливать нечего')
  vm.runInContext('new AudioContext(); new AudioContext().state = "suspended"', win)
  // Так модуль выглядит в идущей игре: postRun уже был (main() вернулся), а главный цикл крутится
  win.LaunchedModule = { calledRun: true, wzEncounteredPostRun: true, pauseMainLoop: () => calls.push('pause'), resumeMainLoop: () => calls.push('play') }
  const resume = win.arcadePause()
  assert.deepEqual(calls, ['pause', 'suspend'], 'звук, который уже молчал, не трогаем')
  resume()
  assert.deepEqual(calls, ['pause', 'suspend', 'resume', 'play'])
}

// --- Шахматы с компьютером: экран выбора (сила 1–10, цвет, таймер), партия, запись ходов, вернуть ход, PGN ---------
{
  const { Chess } = await import(pathToFileURL(path.join(DIST, 'vendor', 'chess', 'chess.js')).href)
  const ch = await makePage(new Map(), { search: '?game=chess&vs=bot&lang=en', globals: { ArcadeChessLib: { Chess } } })
  await until(() => ch.byId.stage.children.some((n) => n.id === 'board-root' && n.querySelectorAll && n.querySelectorAll('.chess-level').length === 10))
  const root = ch.byId.stage.children.find((n) => n.id === 'board-root')
  assert.equal(root.querySelectorAll('.chess-level').length, 10, 'сила 1–10')
  assert.deepEqual(root.querySelectorAll('.chess-minutes').map((b) => b.textContent), ['no timer', '3 min', '5 min', '10 min'])
  root.querySelectorAll('.chess-level').find((b) => String(b.dataset.level) === '2').click()
  root.querySelectorAll('.chess-start')[0].click()
  await until(() => ch.ctx.ArcadeChess && ch.ctx.ArcadeChess.game)
  const g = ch.ctx.ArcadeChess.game
  assert.equal(g.options.level, 2)
  g.click('e2')
  g.click('e4')
  // в тестовом окне нет Worker — отвечает прежний простой компьютер; ход записан
  await until(() => g.chess.history().length === 2)
  assert.equal(g.chess.history()[0], 'e4')
  assert.match(root.querySelectorAll('.chess-moves')[0].children[0].textContent, /^1\. e4 \S+/)
  g.undo()
  assert.equal(g.chess.history().length, 0, '«Вернуть ход» снимает и свой ход, и ответ компьютера')
}

// --- Шахматы: запись ходов — последние 8, «Show all» раскрывает всю партию до конца партии, «Hide» — обратно ---------
{
  const { Chess } = await import(pathToFileURL(path.join(DIST, 'vendor', 'chess', 'chess.js')).href)
  const p = await makePage(new Map(), { search: '?game=chess&room=abcdef9999&lang=en', globals: { ArcadeChessLib: { Chess } } })
  await until(() => p.sockets.some((s) => /\/net\/board\/abcdef9999$/.test(s.url)))
  const ws = p.sockets.find((s) => /\/net\/board\/abcdef9999$/.test(s.url))
  ws.emit('open')
  const moves = ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6', 'c3', 'O-O', 'h3', 'Nb8', 'd4', 'Nbd7']
  ws.emit('message', JSON.stringify({ type: 'state', game: 'chess', seat: 0, seats: 2, moves, control: 0 }))
  const box = p.byId.stage.children.find((n) => n.id === 'board-root').querySelectorAll('.chess-moves')[0]
  const pairs = () => box.querySelectorAll('.pair').map((x) => x.textContent)
  const toggle = () => box.querySelectorAll('.chess-all')[0]
  assert.deepEqual([pairs().length, pairs()[0], pairs().at(-1), toggle().textContent], [8, '3. Bb5 a6', '10. d4 Nbd7', 'Show all (10)'])
  toggle().click()
  assert.deepEqual([pairs().length, pairs()[0], toggle().textContent], [10, '1. e4 e5', 'Hide'])
  ws.emit('message', JSON.stringify({ type: 'move', ply: 20, move: 'Nbd2' }))
  assert.equal(pairs().length, 11, 'после хода запись остаётся раскрытой')
  toggle().click()
  assert.deepEqual([pairs().length, pairs()[0], toggle().textContent], [8, '4. Ba4 Nf6', 'Show all (11)'])
}

// --- Шахматы по сети: контроль времени, лобби варианта, часы с сервера, флажок ------------------------------------
{
  const { Chess } = await import(pathToFileURL(path.join(DIST, 'vendor', 'chess', 'chess.js')).href)
  const lobby = await makePage(new Map(), { search: '?game=chess&lang=en', globals: { ArcadeChessLib: { Chess } } })
  await until(() => lobby.byId.stage.children.some((n) => n.id === 'board-root' && n.querySelectorAll('.chess-mode').length === 3))
  const root = lobby.byId.stage.children.find((n) => n.id === 'board-root')
  root.querySelectorAll('.chess-mode').find((b) => b.dataset.mode === 'net').click()
  root.querySelectorAll('.chess-control').find((b) => String(b.dataset.control) === '7').click()
  root.querySelectorAll('.chess-find')[0].click()
  await until(() => lobby.sockets.some((s) => /\/net\/room\/board-chess-7$/.test(s.url)))
  assert.ok(lobby.sockets.some((s) => /\/net\/room\/board-chess-7$/.test(s.url)), 'подбор — в лобби выбранного контроля')
  // Партия по ссылке: приветствие с контролем, часы с сервера, ход уходит на сервер, флажок — когда время вышло
  const net = await makePage(new Map(), { search: '?game=chess&room=abcdef5678&control=7&lang=en', hash: `#me=fefa.1790000000.${'A'.repeat(22)}`, globals: { ArcadeChessLib: { Chess } } })
  await until(() => net.sockets.some((s) => /\/net\/board\/abcdef5678$/.test(s.url)))
  const ws = net.sockets.find((s) => /\/net\/board\/abcdef5678$/.test(s.url))
  ws.emit('open')
  assert.deepEqual([JSON.parse(ws.sent[0]).type, JSON.parse(ws.sent[0]).control, JSON.parse(ws.sent[0]).me], ['hello', 420, `fefa.1790000000.${'A'.repeat(22)}`])
  const now = Date.now()
  ws.emit('message', JSON.stringify({ type: 'state', game: 'chess', seat: 0, seats: 2, moves: [], control: 420, clock: { left: [420000, 420000], since: now, now }, names: ['fefa', ''] }))
  assert.match(textOf(net.byId.stage), /You @fefa \(white\)/)
  assert.match(textOf(net.byId.stage), /Opponent \(black\)/, 'соперник без ника — как раньше')
  const g = net.ctx.ArcadeChess.game
  g.click('e2')
  g.click('e4')
  assert.deepEqual(JSON.parse(ws.sent.at(-1)), { type: 'move', ply: 0, move: 'e4' })
  ws.emit('message', JSON.stringify({ type: 'move', ply: 0, move: 'e4', clock: { left: [419000, 1], since: now - 10, now } }))
  await until(() => ws.sent.some((f) => JSON.parse(f).type === 'flag'))
  assert.ok(ws.sent.some((f) => JSON.parse(f).type === 'flag'), 'у соперника вышло время — флажок серверу')
}

// --- Го: с компьютером на 9×9, «Найти игрока» — в лобби своей доски ----------------------------------------------
{
  const go = await makePage(new Map(), { search: '?game=go&lang=en' })
  await until(() => go.byId.stage.children.some((n) => n.id === 'board-root' && n.querySelectorAll('.go-start').length === 1))
  const root = go.byId.stage.children.find((n) => n.id === 'board-root')
  root.querySelectorAll('.go-start')[0].click()
  await until(() => go.ctx.ArcadeGo.game && go.ctx.ArcadeGo.game.go)
  const g = go.ctx.ArcadeGo.game
  assert.equal(g.go.size, 9)
  g.click(40) // центр 9×9
  await until(() => g.go.moves === 2, 600)
  assert.equal(g.go.moves, 2, 'компьютер ответил')
  const net = await makePage(new Map(), { search: '?game=go&lang=en' })
  await until(() => net.byId.stage.children.some((n) => n.id === 'board-root' && n.querySelectorAll('.go-mode').length === 3))
  const r2 = net.byId.stage.children.find((n) => n.id === 'board-root')
  r2.querySelectorAll('.go-mode')[1].click()
  r2.querySelectorAll('.go-size').find((b) => String(b.dataset.size) === '13').click()
  r2.querySelectorAll('.go-start')[0].click()
  await until(() => net.sockets.some((s) => /\/net\/room\/board-go-13$/.test(s.url)))
  assert.ok(net.sockets.some((s) => /\/net\/room\/board-go-13$/.test(s.url)), 'подбор — среди выбравших ту же доску')
  // Партия по ссылке: подпись ника — в hello, ники игроков — под доской
  const room = await makePage(new Map([['arcade:me', `octo_cat.1790000000.${'A'.repeat(22)}`]]), { search: '?game=go&room=abcdef4321&size=9&lang=en' })
  await until(() => room.sockets.some((s) => /\/net\/board\/abcdef4321$/.test(s.url)))
  const gws = room.sockets.find((s) => /\/net\/board\/abcdef4321$/.test(s.url))
  gws.emit('open')
  assert.equal(JSON.parse(gws.sent[0]).me, `octo_cat.1790000000.${'A'.repeat(22)}`)
  gws.emit('message', JSON.stringify({ type: 'state', game: 'go', seat: 1, seats: 2, moves: [], variant: '9', names: ['fefa', 'octo_cat'] }))
  assert.match(textOf(room.byId.stage), /black — @fefa · white — @octo_cat/)
  // «Сдаться» по сети — и в чужой ход; итог присылает сервер
  room.byId.stage.querySelectorAll('.go-resign')[0].click()
  assert.deepEqual(JSON.parse(gws.sent.at(-1)), { type: 'resign' })
  gws.emit('message', JSON.stringify({ type: 'state', game: 'go', seat: 1, seats: 2, moves: [], variant: '9', result: { loser: 1, reason: 'resign' } }))
  assert.match(textOf(room.byId.stage), /You resigned — you lose/)
  assert.equal(room.byId.stage.querySelectorAll('.go-resign').length, 0, 'после сдачи кнопки нет')
  gws.emit('message', JSON.stringify({ type: 'state', game: 'go', seat: 0, seats: 2, moves: [], variant: '9', result: { loser: 1, reason: 'resign' } }))
  assert.match(textOf(room.byId.stage), /Your opponent resigned — you win!/)
  const before = gws.sent.length
  room.ctx.ArcadeGo.game.click(40)
  assert.equal(gws.sent.length, before, 'после сдачи ходов нет')
}

// --- Аудиокниги: проигрыватель (главы, скорость, место прослушивания), свои файлы, полка «Аудиокниги» -------------
{
  const withAudio = (bytes) => {
    const c = JSON.parse(bytes.toString('utf8'))
    // только тестовая книга: аудиокниги каталога и полки их языков убираем
    for (const [id, g] of Object.entries(c.games)) if (g.kind === 'audio') delete c.games[id]
    c.shelves = c.shelves.filter((s) => !/^audio-/.test(s.id) || s.id === 'audio-mine')
    c.shelves.splice(c.shelves.findIndex((s) => s.id === 'audio-mine'), 0, { id: 'audio-en', title: 'English' }) // как в сборке: языки — перед «Моими аудиокнигами»
    c.games['test-audio'] = { console: 'audiobooks', kind: 'audio', shelf: 'audio-en', title: 'The Test Tale', author: 'A. Author', reader: 'R. Reader', genre: 'сказки', keys: '…', chapters: [{ title: 'Chapter 1', url: 'https://archive.org/download/x/1.mp3', seconds: 600 }, { title: 'Chapter 2', url: 'https://archive.org/download/x/2.mp3', seconds: 540 }] }
    return JSON.stringify(c)
  }
  const store = new Map()
  const page = await makePage(store, { search: '?game=test-audio&lang=en', net: { override: { 'catalog.json': withAudio } } })
  await until(() => page.ctx.ArcadeAudio && page.ctx.ArcadeAudio.player)
  const p = page.ctx.ArcadeAudio.player
  const root = page.byId.stage.children.find((n) => n.id === 'audio-root')
  assert.equal(root.querySelectorAll('.audio-chapter').length, 2, 'главы списком')
  assert.equal(p.audio.src, 'https://archive.org/download/x/1.mp3', 'звук — прямо с archive.org')
  root.querySelectorAll('.audio-speed').find((b) => String(b.dataset.speed) === '1.5').click()
  assert.equal(p.speed, 1.5)
  root.querySelectorAll('.audio-next')[0].click()
  assert.equal(p.chapter, 1)
  assert.equal(p.audio.src, 'https://archive.org/download/x/2.mp3')
  assert.deepEqual([JSON.parse(store.get('arcade:audio:test-audio')).chapter, JSON.parse(store.get('arcade:audio:test-audio')).speed], [1, 1.5], 'место и скорость запомнились')
  // Свои аудиокниги: файлы глав — одна книга, по порядку имён; хранятся в браузере; «Удалить»
  const A = page.ctx.ArcadeAudio
  const entry = await A.addFiles([{ name: 'Book 02.mp3', type: 'audio/mpeg', size: 10 }, { name: 'Book 01.mp3', type: 'audio/mpeg', size: 12 }])
  assert.deepEqual(JSON.parse(JSON.stringify([entry.title, entry.files.map((f) => f.name)])), ['Book', ['Book 01.mp3', 'Book 02.mp3']])
  assert.equal((await A.listMine()).length, 1)
  await A.removeMine(entry.id)
  assert.equal((await A.listMine()).length, 0)
  await assert.rejects(A.addFiles([{ name: 'notes.txt', type: 'text/plain', size: 5 }]), /not audio files/)
  // Вкладка «Аудиокниги»: полки языков и «Мои аудиокниги»; на полке языка — жанры, как у книг
  const tab = await makePage(new Map(), { search: '?tab=listening&shelf=audio-en&lang=en', net: { override: { 'catalog.json': withAudio } } })
  assert.deepEqual(tab.byId.library.querySelectorAll('.shelf').filter((b) => !/genre-chip/.test(b.className)).map((b) => b.textContent), ['English', 'My audiobooks'])
  assert.deepEqual(tab.byId.library.querySelectorAll('.genre-chip').map((b) => b.textContent), ['All', 'Fairy tales'], 'жанры аудиокниг — как у книг')
  const mineShelf = await makePage(new Map(), { search: '?tab=listening&shelf=audio-mine&lang=en' })
  assert.deepEqual(mineShelf.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['my-audio'])
}

// --- Flappy Arcade: своя игра — движок flappy.js из мода, подсказка клавиш на языке окна ------------------------
{
  const fl = await makePage(new Map(), { search: '?game=flappy&lang=en' })
  await until(() => fl.appended.some((s) => s.src === 'flappy.js'))
  assert.equal(fl.byId.keys.textContent, 'flap — Space, ↑, W or click')
}

// --- Blasphemer: движок Heretic — одному без лобби, кооператив и BlasphDM в своих лобби ---------------------------
{
  const solo = await makePage(new Map(), { search: '?game=blasphemer' })
  await until(() => solo.appended.some((s) => s.src === 'heretic-wasm/websockets-heretic.js'))
  assert.equal(solo.sockets.length, 0, 'одному — без лобби')
  assert.equal(solo.ctx.Module.locateFile('websockets-heretic.wasm'), 'heretic-wasm/websockets-heretic.wasm')
  assert.equal(solo.byId.net.href, '?game=blasphemer&net=coop')
  // Холст движка — на всю область игры: экран Денди спрятан и не сдвигает его вбок, картинка 4:3 без растяжения
  assert.equal(solo.byId.screen.style.display, 'none')
  assert.equal(solo.ctx.Module.canvas.style.objectFit, 'contain')
  assert.match(solo.byId.keys.textContent, /предметы — \[ \] и Enter/)
  const args = Array.from(vm.runInContext("ArcadeNetDoom.doomArgs('heretic.wad', null, false, 'solo')", solo.ctx))
  assert.deepEqual(args.slice(0, 2), ['-iwad', 'heretic.wad'])
  for (const a of ['-server', '-connect', '-wss', '-nodes']) assert.ok(!args.includes(a), `одному — без ${a}`)
  // Игру открыли в фоне, пока работал Claude: одному — пауза клавишей Pause самого движка (главный цикл Emscripten
  // не трогаем — им управляет Asyncify движка), звук стоит
  const calls = []
  Object.assign(solo.ctx.Module, { callMain: () => calls.push('main'), SDL2: {} })
  solo.ctx.Module.canvas.dispatchEvent = (e) => calls.push(`${e.type} ${e.keyCode}`)
  solo.ctx.document.hasFocus = () => false
  solo.ctx.Module.onRuntimeInitialized()
  assert.deepEqual(calls, ['main', 'keydown 19', 'keyup 19'])
  assert.equal(solo.byId['overlay-title'].textContent, 'Пауза')
  // Звук движок открывает позже — его глушат, как только он появился
  solo.ctx.Module.SDL2.audioContext = { suspend() { calls.push('suspend') }, resume() { calls.push('resume') } }
  await until(() => calls.includes('suspend'))
  // Клавиша продолжает игру и в движок не попадает
  let stopped = false
  solo.fire('keydown', { code: 'Escape', stopPropagation() { stopped = true } })
  assert.ok(stopped)
  assert.deepEqual(calls.slice(4), ['resume', 'keydown 19', 'keyup 19'])
  assert.ok(!solo.byId.overlay.classList.contains('shown'))
  solo.fire('blur')
  solo.fire('blur')
  assert.deepEqual(calls.slice(7), ['keydown 19', 'keyup 19', 'suspend'])
  const coop = await makePage(new Map(), { search: '?game=blasphemer&net=coop' })
  await until(() => coop.sockets.length > 0)
  assert.match(coop.sockets[0].url, /\/net\/room\/coop-blasphemer$/)
  const dm = await makePage(new Map(), { search: '?game=blasphdm' })
  await until(() => dm.sockets.length > 0)
  assert.match(dm.sockets[0].url, /\/net\/room\/dm-blasphdm$/)
}

// --- Книги: разбор EPUB, FB2, TXT; читалка каталога и своей книги; закладка ------------------------------------------
{
  const BOOK = Object.keys(catalog.games).find((id) => catalog.games[id].kind === 'book')
  const page = await makePage(new Map(), { search: '' })
  vm.runInContext(fs.readFileSync(path.join(DIST, 'book-format.js'), 'utf8'), page.ctx)
  const F = page.ctx.ArcadeBookFormat
  // TXT в обёртке Project Gutenberg: обёртка срезана, главы найдены
  const txt = F.fromTxt('Header\n*** START OF THE PROJECT GUTENBERG EBOOK X ***\n\nCHAPTER I.\nThe Start\n\nFirst paragraph\nwraps here.\n\nII.\n\nSecond.\n*** END OF THE PROJECT GUTENBERG EBOOK X ***\nLicence', { title: 'X' })
  assert.deepEqual(Array.from(txt.chapters, (c) => c.title), ['CHAPTER I. The Start', 'II.'])
  assert.equal(txt.chapters[0].paragraphs[0], 'First paragraph wraps here.')
  assert.ok(!JSON.stringify(txt).includes('Licence'), 'лицензия Gutenberg срезана')
  // Оглавление (три и больше заголовков подряд) — не главы; «I Title» без точки — глава; «I.» внутри рассказа — раздел
  const story = (s) => Array(40).fill(s).join(' ')
  const ti = F.fromTxt(['CONTENTS', 'PART ONE--The Old Buccaneer', 'I. The Old Sea-dog', 'II. Black Dog', 'PART ONE--The Old Buccaneer', 'I\nThe Old Sea-dog at the “Admiral Benbow”', story('Squire Trelawney'), 'II\nBlack Dog Appears and Disappears', story('It was not long')].join('\n\n'), { title: 'TI' })
  assert.deepEqual(Array.from(ti.chapters.slice(-2), (c) => c.title), ['PART ONE--The Old Buccaneer. I The Old Sea-dog at the “Admiral Benbow”', 'II Black Dog Appears and Disappears'])
  const sh = F.fromTxt(['Contents', 'I. A Scandal in Bohemia', 'II. The Red-Headed League', 'I. A SCANDAL IN BOHEMIA', 'I.', story('To Sherlock Holmes'), 'II.', story('At three o’clock'), 'II. THE RED-HEADED LEAGUE', story('I had called')].join('\n\n'), { title: 'SH' })
  assert.deepEqual(Array.from(sh.chapters.slice(-2), (c) => c.title), ['I. A SCANDAL IN BOHEMIA', 'II. THE RED-HEADED LEAGUE'])
  assert.equal(sh.chapters.at(-2).paragraphs.length, 2, 'обе части рассказа — в одной главе')
  const tm = F.fromTxt(['CONTENTS', 'I Introduction', 'II The Machine', 'III The Time Traveller Returns', 'I.', story('The Time Traveller'), 'II.', story('I think that')].join('\n\n'), { title: 'TM' })
  assert.deepEqual(Array.from(tm.chapters.slice(-2), (c) => c.title), ['I.', 'II.'], 'оглавление не съедает главы')
  // FB2: заголовок секции из двух абзацев, сноски не в тексте
  const fb2 = F.fromFb2('<FictionBook><description><title-info><author><first-name>Александр</first-name><last-name>Пушкин</last-name></author><book-title>Капитанская дочка</book-title><lang>ru</lang></title-info></description><body><section><title><p>Глава I</p><p>Сержант гвардии</p></title><p>Отец мой Андрей Петрович.</p></section></body><body name="notes"><section><p>сноска</p></section></body></FictionBook>')
  assert.equal(fb2.author, 'Александр Пушкин')
  assert.equal(fb2.chapters[0].title, 'Глава I. Сержант гвардии')
  assert.ok(!JSON.stringify(fb2).includes('сноска'))
  // EPUB: свой разбор ZIP и распаковка
  const zipped = fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'book.epub'))
  page.ctx.__epub = new Uint8Array(zipped)
  const epub = await vm.runInContext("ArcadeBookFormat.fromEpub(__epub, { inflateRaw: async (d) => new Uint8Array(await new Response(new Blob([d]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) })", page.ctx)
  assert.equal(epub.title, 'The Time Machine')
  assert.deepEqual(Array.from(epub.chapters, (c) => c.title), ['I', 'II'])
  assert.equal(epub.chapters[0].paragraphs[1], 'His grey eyes shone & twinkled.')
  // Читалка книги каталога: главы, закладка запоминается и возвращает к абзацу
  const storage = new Map()
  const reader = await makePage(storage, { search: `?game=${BOOK}` })
  await until(() => reader.byId.stage.children.some((n) => n.id === 'reader-root'))
  const view = reader.ctx.ArcadeReader.view
  assert.equal(view.root.querySelectorAll('.reader-chapter').length, catalog.games[BOOK].chapters)
  view.save()
  const saved = JSON.parse(storage.get(`arcade:book:${BOOK}`))
  assert.equal(typeof saved.c, 'number')
  assert.equal(typeof saved.p, 'number')
  storage.set(`arcade:book:${BOOK}`, JSON.stringify({ c: 1, p: 3, percent: 42 }))
  const again = await makePage(storage, { search: `?game=${BOOK}` })
  await until(() => again.byId.stage.children.some((n) => n.id === 'reader-root'))
  assert.match(textOf(again.ctx.ArcadeReader.view.root), /42%/, 'вернулись к закладке')
  // Библиотека книг: жанры переведены; у книги — сколько прочитано по закладке
  const shelf = await makePage(new Map([[`arcade:book:${BOOK}`, JSON.stringify({ c: 0, p: 3, percent: 16 })]]), { search: '?tab=books&lang=en' })
  assert.ok(!/[А-Яа-яЁё]/.test(shelf.byId.library.querySelectorAll('.genre').map((g) => g.textContent.split(' · ').pop()).join(' ')), 'жанры книг по-английски')
  const stats = shelf.byId.library.querySelectorAll('.stats').map((x) => x.textContent)
  assert.ok(stats.includes('read 16%'), 'прочитано 16%')
  assert.ok(shelf.byId.library.querySelectorAll('.genre-head').length >= 1, 'на полке — заголовки жанров')
  // Непрочитанная книга — на своей языковой полке
  const other = Object.keys(catalog.games).find((id) => catalog.games[id].kind === 'book' && id !== BOOK)
  const otherShelf = await makePage(new Map(), { search: `?tab=reading&shelf=${catalog.games[other].shelf}&lang=en` })
  assert.ok(otherShelf.byId.library.querySelectorAll('.stats').map((x) => x.textContent).includes('not read yet'))
  assert.deepEqual(otherShelf.byId.library.querySelectorAll('.shelf').filter((b) => !/genre-chip/.test(b.className)).map((b) => b.textContent), ['English', 'Українська'], 'полки «Книг» — языки')
  // Ряд жанров на полке книг: «All» и жанры полки; выбор жанра оставляет его книги; адрес с &genre= открывает жанр
  const shelfId = catalog.games[BOOK].shelf
  const g0 = catalog.games[BOOK].genre
  const genres = await makePage(new Map(), { search: `?tab=reading&shelf=${shelfId}&lang=en` })
  const chips = genres.byId.library.querySelectorAll('.genre-chip')
  assert.equal(chips[0].textContent, 'All')
  assert.match(chips[0].className, /\bactive\b/)
  chips.find((c) => c.dataset.genre === g0).click()
  const shown = genres.byId.library.querySelectorAll('.card').map((c) => c.dataset.game)
  assert.ok(shown.length >= 1 && shown.every((id) => catalog.games[id].genre === g0), 'только книги выбранного жанра')
  const direct = await makePage(new Map(), { search: `?tab=reading&shelf=${shelfId}&genre=${encodeURIComponent(g0)}&lang=en` })
  assert.match(direct.byId.library.querySelectorAll('.genre-chip').find((c) => c.dataset.genre === g0).className, /\bactive\b/)
  // Украинский: описания игр — английские, а не русские
  const uk = await makePage(new Map(), { search: '?tab=nes&lang=uk' })
  assert.ok(!/[ыэъё]/i.test(uk.byId.library.querySelectorAll('.about').map((a) => a.textContent).join(' ')), 'описания не по-русски')
  // Описания и названия своих игр — на языке окна: «Шахи» с украинским описанием из каталога; в меню реверси — тоже
  const ukBoard = await makePage(new Map(), { search: '?tab=board&lang=uk' })
  const ukChess = ukBoard.byId.library.querySelectorAll('.card').find((c) => c.dataset.game === 'chess')
  assert.equal(ukChess.querySelectorAll('.title')[0].textContent, 'Шахи')
  assert.equal(ukChess.querySelectorAll('.about')[0].textContent, catalog.games.chess.about_i18n.uk)
  const enBoard = await makePage(new Map(), { search: '?tab=board&lang=en' })
  assert.deepEqual(enBoard.byId.library.querySelectorAll('.title').map((t) => t.textContent), ['Chess', 'Russian draughts', 'Reversi', 'Go'])
  const ukMenu = await makePage(new Map(), { search: '?game=reversi&lang=uk' })
  await until(() => ukMenu.ctx.ArcadeBoard)
  assert.ok(textOf(ukMenu.byId.stage).includes(catalog.games.reversi.about_i18n.uk), 'меню реверси — украинское описание')
  // Своя книга (TXT) — во вкладке «Книги»: добавить и открыть в читалке
  const lib = await makePage(new Map(), { search: '?tab=books' })
  lib.byId.library.querySelectorAll('.open-rom')[0].click()
  assert.equal(lib.byId['local-rom'].accept, '.epub,.fb2,.txt')
  lib.ctx.__txt = new TextEncoder().encode('CHAPTER I.\n\nMy own book text.\n\nCHAPTER II.\n\nMore text.')
  await vm.runInContext("(async () => ArcadePlayMine(await ArcadeMine.add(new File([__txt], 'my-book.txt'), 'books')))()", lib.ctx)
  await until(() => lib.byId.stage.children.some((n) => n.id === 'reader-root'))
  assert.equal(lib.ctx.ArcadeReader.view.root.querySelectorAll('.reader-chapter').length, 2)
  await assert.rejects(vm.runInContext("ArcadeMine.add(new File([new Uint8Array(4)], 'x.pdf'), 'books')", lib.ctx), /EPUB, FB2 или TXT/)
}

// --- Маппер 28 (Action 53): в окне JSNES знает его — сборник Action 53 открывается как своя игра ---------------------
{
  const page = await makePage(new Map(), { search: '' })
  assert.equal(vm.runInContext('typeof jsnes.Mappers[28]', page.ctx), 'function')
  assert.equal(vm.runInContext('typeof jsnes.Mappers[0]', page.ctx), 'function', 'остальные мапперы на месте')
}

// --- Master System: ядро Genesis Plus GX, свои файлы — с расширением в имени; Game Gear нет ------------------------
{
  const sms = await makePage(new Map(), { search: '?game=skyhaul' })
  assert.equal(sms.ctx.EJS_core, 'genesis_plus_gx', 'Master System — на нашем ядре, а не на SMS Plus с чужого CDN')
  assert.equal(sms.ctx.EJS_gameUrl, catalog.games.skyhaul.rom.url)
  const lib = await makePage(new Map(), { search: '?tab=sms' })
  lib.byId.library.querySelectorAll('.open-rom')[0].click()
  assert.equal(lib.byId['local-rom'].accept, '.sms')
  // Свой файл Master System: имя с расширением — по нему ядро узнаёт приставку
  lib.ctx.__sms = new Uint8Array(fs.readFileSync(path.join(ROOT, 'content', 'games', 'skyhaul', 'skyhaul.sms')))
  await vm.runInContext(`(async () => ArcadePlayMine(await ArcadeMine.add(new File([__sms], 'My_Game.sms'), 'sms')))()`, lib.ctx)
  await until(() => lib.ctx.EJS_core)
  assert.equal(lib.ctx.EJS_core, 'genesis_plus_gx')
  assert.equal(lib.ctx.EJS_gameName, 'My Game.sms')
  await assert.rejects(vm.runInContext(`ArcadeMine.add(new File([new Uint8Array(4096)], 'x.gg'), 'sms')`, lib.ctx), /не игра для Master System/)
  await assert.rejects(vm.runInContext(`ArcadeMine.add(new File([new Uint8Array(4096)], 'x.gg'), 'gg')`, lib.ctx), /не поддерживает свои файлы/)
}

// --- Просмотр подборки YouTube (watch.html): плеер, список, ошибки встраивания, новая подборка в той же вкладке --------
{
  const PLAYER = 'https://www.youtube-nocookie.com'
  async function watchPage({ hash, search = '', oembed = true }) {
    const page = { posted: [], replaced: null, fetched: [], handlers: {}, location: { hash, search, pathname: '/watch', origin: 'https://agent-arcade.test' } }
    const node = (tag) => {
      const n = {
        tagName: tag, className: '', children: [], attributes: {}, listeners: {}, hidden: false, title: '', own: '',
        classList: { set: new Set(), toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c) }, contains(c) { return this.set.has(c) } },
        get textContent() { return this.own + this.children.map((c) => c.textContent).join('') },
        set textContent(v) { this.own = String(v); this.children = [] },
        append(...kids) { this.children.push(...kids) },
        addEventListener(t, f) { (this.listeners[t] ??= []).push(f) },
        setAttribute(k, v) { this.attributes[k] = String(v) },
        removeAttribute(k) { delete this.attributes[k] },
        querySelector(selector) {
          const walk = (x) => { for (const c of x.children) { if (c.className.split(' ').includes(selector.slice(1))) return c; const f = walk(c); if (f) return f } return null }
          return walk(this)
        },
        fire(t) { for (const f of this.listeners[t] ?? []) f({}) },
      }
      if (tag === 'iframe') n.contentWindow = { postMessage: (data, origin) => page.posted.push({ ...JSON.parse(data), origin }) }
      return n
    }
    page.root = node('div')
    const storage = new Map()
    const ctx = {
      location: page.location, URLSearchParams, console,
      history: { replaceState: (s, t, url) => { page.replaced = url } },
      navigator: { language: 'ru-RU' },
      localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) },
      document: { title: '', documentElement: {}, createElement: node, getElementById: () => page.root },
      addEventListener: (t, f) => (page.handlers[t] ??= []).push(f),
      fetch: async (url) => {
        page.fetched.push(url)
        if (!oembed) throw new Error('Failed to fetch')
        const id = new URL(new URL(url).searchParams.get('url')).searchParams.get('v')
        return { ok: true, json: async () => ({ title: `Видео ${id}`, author_name: 'Канал' }) }
      },
    }
    ctx.window = ctx
    vm.createContext(ctx)
    for (const file of ['i18n.js', 'watch.js']) vm.runInContext(fs.readFileSync(path.join(DIST, file), 'utf8'), ctx, { filename: file })
    await new Promise((r) => setTimeout(r, 5))
    page.ctx = ctx
    page.frame = () => page.root.children[0].children[0].children[0]
    page.items = () => page.root.children[1].children
    page.note = () => page.root.children[0].children[2]
    page.send = (data, origin = PLAYER, source = page.frame().contentWindow) => { for (const f of page.handlers.message ?? []) f({ data: JSON.stringify(data), origin, source }) }
    return page
  }

  // Подборка из адреса: чужие id и повторы отбрасываются, открыто видео i
  const page = await watchPage({ hash: '#v=aaaaaaaaaaa,bad,bbbbbbbbbbb,aaaaaaaaaaa,<script>xx&i=1' })
  assert.equal(page.items().length, 2)
  assert.match(page.frame().src, /^https:\/\/www\.youtube-nocookie\.com\/embed\/bbbbbbbbbbb\?/)
  assert.match(page.frame().src, /enablejsapi=1/)
  assert.match(page.frame().src, /hl=ru/)
  assert.equal(page.root.children[0].children[1].children[1].href, 'https://www.youtube.com/watch?v=bbbbbbbbbbb')
  assert.ok(page.items()[1].classList.contains('active') && !page.items()[0].classList.contains('active'))
  assert.equal(page.replaced, '/watch#v=aaaaaaaaaaa,bbbbbbbbbbb&i=1', 'в адресе — только настоящая подборка')
  // Названия — из oEmbed YouTube
  assert.equal(page.fetched.length, 2)
  assert.equal(page.items()[0].querySelector('.name').textContent, 'Видео aaaaaaaaaaa')
  assert.equal(page.root.children[0].children[1].children[0].textContent, 'Видео bbbbbbbbbbb')
  assert.equal(page.ctx.document.title, 'Видео bbbbbbbbbbb · Arcade')
  // Плеер загрузился — страница подписывается на его ошибки и конец видео
  page.frame().fire('load')
  assert.deepEqual(page.posted.map((m) => [m.event, m.args?.[0], m.origin]), [['listening', undefined, PLAYER], ['command', 'onError', PLAYER], ['command', 'onStateChange', PLAYER]])
  // Сообщения не от плеера не слушаем
  page.send({ event: 'onError', info: 150 }, 'https://evil.test')
  page.send({ event: 'onError', info: 150 }, PLAYER, {})
  assert.equal(page.note().hidden, true)
  page.send({ event: 'onError', info: 150 })
  assert.equal(page.note().hidden, false)
  assert.match(page.note().textContent, /Автор не разрешил/)
  // Другое видео из списка — подсказка уходит; кончилось — следующее
  page.items()[0].fire('click')
  assert.match(page.frame().src, /embed\/aaaaaaaaaaa\?/)
  assert.equal(page.note().hidden, true)
  page.send({ event: 'onStateChange', info: 0 })
  assert.match(page.frame().src, /embed\/bbbbbbbbbbb\?/)
  page.send({ event: 'onStateChange', info: 0 })
  assert.match(page.frame().src, /embed\/bbbbbbbbbbb\?/, 'последнее видео — дальше некуда')
  // Мод открыл новую подборку в той же вкладке
  page.location.hash = '#v=ccccccccccc&i=0'
  for (const f of page.handlers.hashchange) f({})
  assert.equal(page.items().length, 1)
  assert.match(page.frame().src, /embed\/ccccccccccc\?/)

  // Без oEmbed — только миниатюры; по-английски — и плеер по-английски
  const en = await watchPage({ hash: '#v=ddddddddddd', search: '?lang=en', oembed: false })
  assert.equal(en.items()[0].querySelector('.name').textContent, '')
  assert.equal(en.items()[0].children[0].src, 'https://i.ytimg.com/vi/ddddddddddd/mqdefault.jpg')
  assert.equal(en.root.children[0].children[1].children[1].textContent, 'Open on YouTube')
  assert.match(en.frame().src, /hl=en/)
  en.send({ event: 'onError', info: 100 })
  assert.equal(en.note().textContent, 'The video has been removed or hidden.')

  // В адресе нет видео
  const empty = await watchPage({ hash: '' })
  assert.match(empty.root.textContent, /нет видео/)
}

// --- Каналы Twitch (live.html): плеер Twitch для этого сайта, список с эфирами, другие каналы в той же вкладке -------
{
  const API = {
    tsoding: { login: 'tsoding', name: 'Tsoding', avatar: 'https://static-cdn.jtvnw.net/jtv_user_pictures/tsoding.png', live: { title: 'Making a compiler', game: 'Software and Game Development', viewers: 1234, mature: false } },
    myfriend: { login: 'myfriend', name: 'MyFriend', avatar: 'https://evil.test/me.png', live: null },
  }
  async function livePage({ hash, search = '', api = true }) {
    const page = { replaced: null, fetched: [], handlers: {}, location: { hash, search, pathname: '/live', hostname: 'agent-arcade.test', origin: 'https://agent-arcade.test' } }
    const node = (tag) => ({
      tagName: tag, className: '', children: [], attributes: {}, listeners: {}, title: '', own: '',
      classList: { set: new Set(), toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c) }, contains(c) { return this.set.has(c) } },
      get textContent() { return this.own + this.children.map((c) => c.textContent).join('') },
      set textContent(v) { this.own = String(v); this.children = [] },
      append(...kids) { this.children.push(...kids) },
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f) },
      setAttribute(k, v) { this.attributes[k] = String(v) },
      removeAttribute(k) { delete this.attributes[k] },
      querySelector(selector) {
        const walk = (x) => { for (const c of x.children) { if (c.className.split(' ').includes(selector.slice(1))) return c; const f = walk(c); if (f) return f } return null }
        return walk(this)
      },
      fire(t) { for (const f of this.listeners[t] ?? []) f({}) },
    })
    page.root = node('div')
    const storage = new Map()
    const ctx = {
      location: page.location, URLSearchParams, console, Intl,
      history: { replaceState: (s, t, url) => { page.replaced = url } },
      navigator: { language: 'ru-RU' },
      localStorage: { getItem: (k) => storage.get(k) ?? null, setItem: (k, v) => storage.set(k, String(v)) },
      document: { title: '', documentElement: {}, createElement: node, getElementById: () => page.root },
      addEventListener: (t, f) => (page.handlers[t] ??= []).push(f),
      fetch: async (url) => {
        page.fetched.push(url)
        if (!api) return { ok: false, json: async () => ({ error: 'off' }) }
        const logins = new URL(url, 'https://agent-arcade.test').searchParams.get('logins').split(',')
        return { ok: true, json: async () => ({ channels: logins.filter((l) => API[l]).map((l) => API[l]), missing: logins.filter((l) => !API[l]), catalog: [] }) }
      },
    }
    ctx.window = ctx
    vm.createContext(ctx)
    for (const file of ['i18n.js', 'live.js']) vm.runInContext(fs.readFileSync(path.join(DIST, file), 'utf8'), ctx, { filename: file })
    await new Promise((r) => setTimeout(r, 5))
    page.ctx = ctx
    page.frame = () => page.root.children[0].children[0].children[0]
    page.under = () => page.root.children[0].children[1]
    page.items = () => page.root.children[1].children
    page.status = (k) => page.items()[k].querySelector('.status').textContent
    page.go = async (next) => {
      page.location.hash = next
      for (const f of page.handlers.hashchange) f({})
      await new Promise((r) => setTimeout(r, 5))
    }
    return page
  }

  // Каналы из адреса: чужое и повторы отбрасываются, открыт канал i; плеер знает адрес сайта (parent)
  const page = await livePage({ hash: '#c=Tsoding,bad%20name,myfriend,tsoding,<x>&i=1' })
  assert.equal(page.items().length, 2)
  assert.equal(page.frame().src, 'https://player.twitch.tv/?channel=myfriend&parent=agent-arcade.test&autoplay=true')
  assert.equal(page.under().children[1].href, 'https://www.twitch.tv/myfriend')
  assert.ok(page.items()[1].classList.contains('active') && !page.items()[0].classList.contains('active'))
  assert.equal(page.replaced, '/live#c=tsoding,myfriend&i=1', 'в адресе — только настоящие каналы')
  // Эфиры — с нашего сайта, одним вопросом
  assert.deepEqual(page.fetched, ['/api/twitch?logins=tsoding,myfriend'])
  assert.equal(page.items()[0].querySelector('.name').textContent, 'Tsoding')
  assert.match(page.status(0), /^В эфире · Software and Game Development · зрители: 1,2\sтыс\.$/)
  assert.ok(page.items()[0].classList.contains('on'))
  assert.equal(page.items()[0].title, 'Making a compiler')
  assert.equal(page.items()[0].querySelector('.avatar').children[0].src, API.tsoding.avatar)
  assert.equal(page.status(1), 'Не в эфире')
  assert.equal(page.items()[1].querySelector('.avatar').textContent, 'm', 'картинка не с CDN Twitch — вместо неё буква')
  assert.equal(page.under().children[0].textContent, 'MyFriend')
  assert.equal(page.ctx.document.title, 'MyFriend · Arcade')
  // Другой канал из списка — плеер и подпись под ним
  page.items()[0].fire('click')
  assert.match(page.frame().src, /channel=tsoding&/)
  assert.equal(page.under().children[0].textContent, 'Making a compiler')
  assert.equal(page.replaced, '/live#c=tsoding,myfriend&i=0')
  // Мод открыл другие каналы в той же вкладке; канала нет на Twitch — так и написано
  await page.go('#c=ghost_user')
  assert.equal(page.items().length, 1)
  assert.match(page.frame().src, /channel=ghost_user&/)
  assert.equal(page.status(0), 'Такого канала нет на Twitch')

  // Сайт не ответил — список без эфиров, плеер всё равно играет; по-английски
  const en = await livePage({ hash: '#c=tsoding', search: '?lang=en', api: false })
  assert.equal(en.status(0), '')
  assert.equal(en.items()[0].querySelector('.name').textContent, 'tsoding')
  assert.equal(en.under().children[1].textContent, 'Open on Twitch')
  assert.match(en.frame().src, /channel=tsoding&/)
  const en2 = await livePage({ hash: '#c=tsoding,myfriend', search: '?lang=en' })
  assert.equal(en2.status(0), 'Live · Software and Game Development · viewers: 1.2K')
  assert.equal(en2.status(1), 'Offline')

  // В адресе нет каналов
  const empty = await livePage({ hash: '' })
  assert.match(empty.root.textContent, /нет каналов/)
  assert.equal(empty.fetched.length, 0)
}

// --- Статьи и подкасты из мода: read.html ведёт только на сайты лент, listen.html — выпуск в проигрывателе аудиокниг --
{
  // verify — ответ сайта на /api/verify: (параметры) → true/false; без него сайт отвечает 404, 'down' — сеть недоступна
  async function feedPage(scripts, { pathname, hash, search = '', net = {}, verify = null }) {
    const page = { replaced: null, reloaded: false, handlers: {}, store: new Map(), verified: [] }
    const files = network(net)
    const node = (tag) => ({
      tagName: tag, className: '', children: [], style: {}, dataset: {}, listeners: {}, own: '', href: '', src: '',
      paused: true, currentTime: 0,
      play() { this.paused = false; return Promise.resolve() },
      pause() { this.paused = true },
      get textContent() { return this.own + this.children.map((c) => c.textContent).join('') },
      set textContent(v) { this.own = String(v); this.children = [] },
      append(...kids) { for (const k of kids) this.children.push(typeof k === 'string' ? { textContent: k, children: [] } : k) },
      replaceChildren() { this.children = [] },
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f) },
      fire(t) { for (const f of this.listeners[t] ?? []) f({}) },
      click() { this.fire('click') },
      querySelectorAll(selector) {
        const found = []
        const walk = (n) => { for (const c of n.children ?? []) { if ((c.className || '').split(' ').includes(selector.slice(1))) found.push(c); walk(c) } }
        walk(this)
        return found
      },
    })
    page.root = node('div')
    const ctx = {
      location: { hash, search, pathname, origin: 'https://agent-arcade.test', replace: (url) => { page.replaced = url }, reload: () => { page.reloaded = true } },
      URL, URLSearchParams, console,
      setInterval: (fn, ms) => { const h = setInterval(fn, ms); h.unref?.(); return h },
      navigator: { language: 'ru-RU' },
      localStorage: { getItem: (k) => page.store.get(k) ?? null, setItem: (k, v) => page.store.set(k, String(v)), removeItem: (k) => page.store.delete(k) },
      document: { title: '', documentElement: {}, createElement: node, getElementById: () => page.root },
      addEventListener: (t, f) => (page.handlers[t] ??= []).push(f),
      fetch: async (url) => {
        if (!String(url).startsWith('api/verify?')) return files(url)
        const params = new URLSearchParams(String(url).slice('api/verify?'.length))
        page.verified.push(Object.fromEntries(params))
        if (verify === 'down') throw new Error('Failed to fetch')
        if (!verify) return { ok: false, status: 404, json: async () => ({}) }
        const ok = verify(params)
        return { ok: true, status: 200, json: async () => ({ ok }) }
      },
    }
    ctx.window = ctx
    vm.createContext(ctx)
    for (const file of ['i18n.js', ...scripts]) vm.runInContext(fs.readFileSync(path.join(DIST, file), 'utf8'), ctx, { filename: file })
    await new Promise((r) => setTimeout(r, 5))
    page.ctx = ctx
    return page
  }
  const read = (hash, options = {}) => feedPage(['read.js'], { pathname: '/read', hash, ...options })
  const listen = (hash, options = {}) => feedPage(['audio.js', 'listen.js'], { pathname: '/listen', hash, ...options })
  const u = (text) => encodeURIComponent(text)

  // Статья с сайта из лент — переход на неё; чужой сайт, http и логин в адресе — нет
  const article = 'https://simonwillison.net/2026/Oct/20/agents/'
  const ok = await read(`#u=${u(article)}`)
  assert.equal(ok.replaced, article)
  assert.match(ok.root.textContent, /Открываю статью… simonwillison\.net/)
  assert.equal(ok.ctx.document.title, 'Arcade · Статьи')
  for (const bad of ['https://evil.test/agents/', 'https://simonwillison.net.evil.test/']) {
    const page = await read(`#u=${u(bad)}`)
    assert.equal(page.replaced, null, bad)
    assert.match(page.root.textContent, /не из лент Arcade/)
  }
  for (const bad of ['http://simonwillison.net/', 'https://me:pw@simonwillison.net/', 'javascript:alert(1)', '']) {
    const page = await read(`#u=${u(bad)}`)
    assert.equal(page.replaced, null, bad)
    assert.match(page.root.textContent, /нет статьи/)
  }
  const down = await read(`#u=${u(article)}`, { net: { down: true } })
  assert.equal(down.replaced, null)
  assert.match(down.root.textContent, /сайт Arcade не ответил/)
  const en = await read(`#u=${u(article)}`, { search: '?lang=en' })
  assert.match(en.root.textContent, /^Opening the article…/)

  // Выпуск: проигрыватель без глав и ⏮ ⏭, имя шоу — из лент, страница выпуска — только с сайта подкаста
  const audio = 'https://cdn.test/se-daily/ep-1.mp3'
  const episode = `#f=se-daily&u=${u(audio)}&t=${u('Agents at scale')}&l=${u('https://softwareengineeringdaily.com/2026/10/20/agents/')}&d=3600`
  const ep = await listen(episode)
  const p = ep.ctx.ArcadeAudio.player
  assert.equal(p.audio.src, audio, 'звук — прямо с сервера подкаста')
  assert.equal(p.book.episode, true)
  assert.match(ep.root.textContent, /Agents at scale.*Software Engineering Daily/)
  assert.equal(ep.ctx.document.title, 'Agents at scale · Arcade')
  assert.equal(ep.root.querySelectorAll('.audio-play').length, 1)
  assert.deepEqual(['.audio-prev', '.audio-next', '.audio-chapter'].map((s) => ep.root.querySelectorAll(s).length), [0, 0, 0], 'у выпуска нет глав')
  assert.equal(ep.root.querySelectorAll('.page')[0].href, 'https://softwareengineeringdaily.com/2026/10/20/agents/')
  ep.root.querySelectorAll('.audio-speed').find((b) => String(b.dataset.speed) === '1.5').click()
  const saved = [...ep.store.keys()].filter((k) => k.startsWith('arcade:audio:podcast-'))
  assert.equal(saved.length, 1, 'место выпуска запоминается')
  assert.equal(JSON.parse(ep.store.get(saved[0])).speed, 1.5)
  p.audio.fire('ended')
  assert.match(ep.root.textContent, /Выпуск дослушан/)
  // Мод включил другой выпуск в той же вкладке — страница начинает заново
  for (const f of ep.handlers.hashchange) f({})
  assert.equal(ep.reloaded, true)

  // Страница выпуска с чужого сайта не показывается; длинное название — обрезано
  const foreign = await listen(`#f=se-daily&u=${u(audio)}&t=${'x'.repeat(300)}&l=${u('https://evil.test/ep')}`)
  assert.equal(foreign.root.querySelectorAll('.page').length, 0)
  assert.equal(foreign.ctx.ArcadeAudio.player.book.title.length, 200)
  // Подкаста нет в лентах, нет звука, звук по http, сайт не ответил
  assert.match((await listen(`#f=nope&u=${u(audio)}`)).root.textContent, /нет в лентах Arcade/)
  assert.match((await listen('#f=se-daily')).root.textContent, /нет выпуска/)
  assert.match((await listen(`#f=se-daily&u=${u('http://cdn.test/ep.mp3')}`)).root.textContent, /нет выпуска/)
  assert.match((await listen(`#f=se-daily&u=${u(audio)}`, { net: { down: true } })).root.textContent, /сайт Arcade не ответил/)
  const enEp = await listen(episode, { search: '?lang=en' })
  enEp.ctx.ArcadeAudio.player.audio.fire('error')
  assert.match(enEp.root.textContent, /Could not load the episode/)

  // Своя тема: статья не с сайта лент открывается, только если сайт Arcade подтвердил подпись ссылки
  const found = 'https://blog.example.com/rust?x=1'
  const sig = 'Abcdefghijklmnopqrstu_'
  const good = (p) => p.get('kind') === 'read' && p.get('u') === found && p.get('s') === sig
  const signedRead = await read(`#u=${u(found)}&s=${sig}`, { verify: good })
  assert.equal(signedRead.replaced, found)
  assert.deepEqual(signedRead.verified, [{ kind: 'read', u: found, s: sig }])
  const forged = await read(`#u=${u('https://evil.test/')}&s=${sig}`, { verify: good })
  assert.equal(forged.replaced, null)
  assert.match(forged.root.textContent, /не из лент Arcade/)
  const unsigned = await read(`#u=${u(found)}`, { verify: good })
  assert.equal(unsigned.replaced, null)
  assert.deepEqual(unsigned.verified, [], 'без подписи сайт не спрашиваем')
  const fromFeed = await read(`#u=${u(article)}&s=${sig}`, { verify: () => false })
  assert.equal(fromFeed.replaced, article, 'сайт из лент открывается и без проверки подписи')
  assert.deepEqual(fromFeed.verified, [])
  const noVerify = await read(`#u=${u(found)}&s=${sig}`, { verify: 'down' })
  assert.equal(noVerify.replaced, null)
  assert.match(noVerify.root.textContent, /сайт Arcade не ответил/)

  // Своя тема: подкаст из Apple Podcasts — имя из адреса, если подпись верна; ссылка — на страницу подкаста
  const goodShow = (p) => p.get('kind') === 'listen' && p.get('f') === 'it1234' && p.get('n') === 'Rustacean Station' && p.get('s') === sig
  const searched = `#f=it1234&n=${u('Rustacean Station')}&s=${sig}&u=${u(audio)}&t=${u('Embedded Rust')}&l=${u('https://evil.test/ep')}`
  const show = await listen(searched, { verify: goodShow })
  assert.equal(show.ctx.ArcadeAudio.player.audio.src, audio)
  assert.match(show.root.textContent, /Embedded Rust.*Rustacean Station/)
  const links = show.root.querySelectorAll('.page')
  assert.deepEqual(links.map((a) => [a.href, a.textContent]), [['https://podcasts.apple.com/podcast/id1234', 'Страница подкаста']])
  assert.deepEqual(show.verified, [{ kind: 'listen', f: 'it1234', n: 'Rustacean Station', s: sig }])
  assert.match((await listen(searched.replace('Rustacean', 'Fake'), { verify: goodShow })).root.textContent, /нет в лентах Arcade/)
  assert.match((await listen(`#f=it1234&s=${sig}&u=${u(audio)}`, { verify: () => true })).root.textContent, /нет в лентах Arcade/, 'без названия — нет')
  assert.match((await listen(searched, { verify: 'down' })).root.textContent, /сайт Arcade не ответил/)
  const catalogShow = await listen(`${episode}&s=${sig}`, { verify: () => false })
  assert.equal(catalogShow.root.querySelectorAll('.page')[0].textContent, 'Страница выпуска', 'шоу из лент — как раньше')
  assert.deepEqual(catalogShow.verified, [])
}

// --- Чаты (chat.html): билет из адреса — в хранилище вкладки, список, переписка, отправка, группы, живое соединение --
{
  const until = Math.floor(Date.now() / 1000) + 3600
  const TICKET = `1.${until}.0123456789ab.${'A'.repeat(22)}`
  const LINK = `1.${until - 3480}.0123456789ab.${'L'.repeat(22)}`
  const GROUP = 'gabcdefghijklmnop'
  // Сайт: чаты Алисы (1) — с Бобом (2) и группа Squad с Бобом и Кэрол (3)
  function site() {
    const now = Date.now()
    return {
      // Алиса выбрала кота (0 — тоже аватарка), Боб — осьминога (7), у Кэрол аватарки нет — буква; Боб в сети
      me: { id: '1', handle: 'alice', pic: 0 },
      names: { 1: 'alice', 2: 'bob', 3: 'carol' },
      pics: { 1: 0, 2: 7 },
      online: ['2'],
      friends: [{ id: '2', handle: 'bob', pic: 7 }, { id: '3', handle: 'carol' }],
      chats: {
        'd1-2': { meta: { id: 'd1-2', kind: 'dm', members: ['1', '2'] }, with: '2', unread: 2, messages: [
          { s: 1, f: '1', t: 'привет', at: now - 3 * 86_400_000 },
          { s: 2, f: '2', t: 'смотри https://example.com/a?b=1. и javascript:alert(1)', at: now - 60_000 },
          { s: 3, f: '2', t: 'ну как?', at: now - 30_000 },
        ] },
        [GROUP]: { meta: { id: GROUP, kind: 'group', name: 'Squad', owner: '1', members: ['1', '2', '3'] }, unread: 0, messages: [
          { s: 1, f: '1', k: 'create', n: 'Squad', at: now - 120_000 },
          { s: 2, f: '3', t: 'всем привет', at: now - 100_000 },
        ] },
      },
      fail: {},
    }
  }
  async function chatPage({ hash = '', search = '', store = new Map(), data = site() }) {
    const page = { replaced: null, fetched: [], handlers: {}, timers: [], sockets: [], store, data, focused: null, location: { hash, search, pathname: '/chat', host: 'agent-arcade.test', protocol: 'https:' } }
    const node = (tag) => ({
      tagName: tag, className: '', children: [], attributes: {}, listeners: {}, title: '', own: '', value: '', disabled: false, scrollTop: 0, scrollHeight: 0, clientHeight: 0,
      classList: { set: new Set(), toggle(c, on) { if (on) this.set.add(c); else this.set.delete(c) }, contains(c) { return this.set.has(c) } },
      get textContent() { return this.own + this.children.map((c) => (typeof c === 'string' ? c : c.textContent)).join('') },
      set textContent(v) { this.own = String(v); this.children = [] },
      append(...kids) { this.children.push(...kids) },
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f) },
      setAttribute(k, v) { this.attributes[k] = String(v) },
      focus() { page.focused = this },
      fire(t, event = {}) { for (const f of this.listeners[t] ?? []) f({ preventDefault() {}, ...event }) },
    })
    const all = (x, test, out = []) => {
      for (const c of x.children) if (typeof c !== 'string') (test(c) && out.push(c), all(c, test, out))
      return out
    }
    page.all = (cls) => all(page.root, (n) => n.className.split(' ').includes(cls))
    page.one = (cls) => page.all(cls)[0]
    page.button = (text) => all(page.root, (n) => n.tagName === 'button' && n.textContent === text)[0]
    page.root = node('div')
    class Socket {
      constructor(url, protocols) {
        Object.assign(this, { url, protocols, listeners: {}, sent: [], closed: false })
        page.sockets.push(this)
      }
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f) }
      send(d) { this.sent.push(d) }
      close() { this.closed = true }
      fire(t, event = {}) { for (const f of this.listeners[t] ?? []) f(event) }
    }
    const reply = (status, body) => ({ ok: status < 400, status, json: async () => body })
    const summary = (c) => ({ ...c.meta, last: c.messages.at(-1)?.s ?? 0, ...(c.with ? { with: c.with } : {}) })
    const total = () => Object.values(data.chats).reduce((n, c) => n + c.unread, 0)
    const ctx = {
      location: page.location, URLSearchParams, console, Intl, WebSocket: Socket,
      history: { replaceState: (s, t, url) => { page.replaced = url } },
      navigator: { language: 'ru-RU' },
      localStorage: { getItem: () => null, setItem() {} },
      sessionStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) },
      document: { title: '', hidden: false, documentElement: {}, createElement: node, getElementById: () => page.root, addEventListener: (t, f) => (page.handlers[`document:${t}`] ??= []).push(f) },
      addEventListener: (t, f) => (page.handlers[t] ??= []).push(f),
      setTimeout: (f, ms) => page.timers.push({ f, ms }),
      fetch: async (url, init = {}) => {
        const u = new URL(url, 'https://agent-arcade.test')
        const route = u.pathname.replace('/api/me/', '')
        const body = init.body ? JSON.parse(init.body) : undefined
        page.fetched.push({ method: init.method, route, query: u.search, auth: init.headers.Authorization, body })
        // Код ссылки — один раз на билет
        if (route === 'chats/ticket' && init.headers.Authorization === `Link ${LINK}` && !data.traded) {
          data.traded = true
          return reply(200, { ticket: TICKET, until })
        }
        if (init.headers.Authorization !== `Chat ${TICKET}`) return reply(401, { error: 'auth' })
        if (data.fail[route]) return reply(400, { error: data.fail[route] })
        const chat = data.chats[u.searchParams.get('chat') ?? body?.chat]
        if (route === 'chats') {
          const list = Object.values(data.chats).map((c) => ({ id: c.meta.id, kind: c.meta.kind, ...(c.with ? { with: c.with } : { name: c.meta.name, ...(c.meta.pic !== undefined ? { pic: c.meta.pic } : {}) }), unread: c.unread, at: c.messages.at(-1)?.at ?? 0, ...(c.messages.length ? { last: c.messages.at(-1) } : {}) }))
          return reply(200, { me: data.me, chats: list.sort((a, b) => b.at - a.at), names: data.names, pics: data.pics, online: data.online, unread: total() })
        }
        if (route === 'chats/messages') {
          if (!chat) return reply(404, { error: 'gone' })
          const after = Number(u.searchParams.get('after') ?? -1)
          const before = Number(u.searchParams.get('before') ?? Infinity)
          if (!u.searchParams.has('before')) chat.unread = 0
          return reply(200, { me: data.me, chat: summary(chat), messages: chat.messages.filter((m) => m.s > after && m.s < before), first: 1, names: data.names, pics: data.pics, unread: total() })
        }
        if (route === 'chats/send') {
          const msg = { s: (chat.messages.at(-1)?.s ?? 0) + 1, f: '1', t: body.text, at: Date.now() }
          chat.messages.push(msg)
          return reply(200, { msg })
        }
        if (route === 'friends') return reply(200, { friends: data.friends, incoming: [], outgoing: [] })
        if (route === 'chats/open') {
          const id = `d1-${body.with}`
          data.chats[id] ??= { meta: { id, kind: 'dm', members: ['1', body.with] }, with: body.with, unread: 0, messages: [] }
          return reply(200, { chat: { id, kind: 'dm', with: body.with } })
        }
        if (route === 'chats/group') {
          const id = 'gzyxwvutsrqponmlk'
          const members = ['1', ...(body.all ? data.friends.map((f) => f.id) : body.members)]
          data.chats[id] = { meta: { id, kind: 'group', name: body.name, owner: '1', members }, unread: 0, messages: [{ s: 1, f: '1', k: 'create', n: body.name, at: Date.now() }] }
          return reply(200, { chat: summary(data.chats[id]) })
        }
        if (route === 'chats/members') {
          if (body.leave) {
            delete data.chats[body.chat]
            return reply(200, {})
          }
          if (body.name) chat.meta.name = body.name
          if (body.pic === null) delete chat.meta.pic
          else if (body.pic !== undefined) chat.meta.pic = body.pic
          for (const id of body.remove ?? []) chat.meta.members = chat.meta.members.filter((m) => m !== id)
          for (const id of body.add ?? []) chat.meta.members.push(id)
          const k = body.name ? 'name' : body.pic !== undefined ? 'pic' : body.add ? 'add' : 'remove'
          const about = k === 'name' ? { n: body.name } : k === 'pic' ? (body.pic === null ? {} : { n: body.pic }) : { o: (body.add ?? body.remove)[0] }
          chat.messages.push({ s: chat.messages.at(-1).s + 1, f: '1', k, ...about, at: Date.now() })
          return reply(200, { chat: summary(chat) })
        }
        return reply(404, { error: 'not found' })
      },
    }
    ctx.window = ctx
    vm.createContext(ctx)
    for (const file of ['i18n.js', 'avatars.js', 'chat.js']) vm.runInContext(fs.readFileSync(path.join(DIST, file), 'utf8'), ctx, { filename: file })
    page.ctx = ctx
    page.wait = () => new Promise((r) => setTimeout(r, 5))
    // Таймеры страницы идут по команде теста
    page.flush = async () => {
      const due = page.timers.splice(0)
      for (const t of due) t.f()
      await page.wait()
    }
    page.go = async (next) => {
      page.location.hash = next
      for (const f of page.handlers.hashchange) f({})
      await page.wait()
    }
    page.items = () => page.all('item')
    page.messages = () => page.all('msg')
    page.notice = () => page.one('notice').textContent
    page.input = () => page.root.children[0] && all(page.root, (n) => n.tagName === 'textarea')[0]
    page.send = async (text) => {
      page.input().value = text
      page.input().fire('keydown', { key: 'Enter', shiftKey: false })
      await page.wait()
    }
    await page.wait()
    return page
  }

  // Без билета — подсказка открыть чаты из Arcade; к сайту не ходим
  const bare = await chatPage({})
  assert.match(bare.root.textContent, /Чаты открываются из Arcade: \/arcade → Чаты/)
  assert.equal(bare.fetched.length, 0)
  assert.equal(bare.sockets.length, 0)
  assert.equal(bare.replaced, '/chat')
  // Билет истёк — тоже
  const old = await chatPage({ hash: `#t=1.${Math.floor(Date.now() / 1000) - 60}.0123456789ab.${'A'.repeat(22)}` })
  assert.match(old.root.textContent, /открываются из Arcade/)
  assert.equal(old.fetched.length, 0)

  // Билет и чат из адреса: билет — в хранилище вкладки и из адреса уходит, в адресе остаётся чат
  const page = await chatPage({ hash: `#t=${TICKET}&c=d1-2` })
  assert.equal(page.store.get('arcade:chat'), TICKET)
  assert.equal(page.replaced, '/chat#c=d1-2')
  assert.ok(page.fetched.every((f) => f.auth === `Chat ${TICKET}`), 'билет едет заголовком, не в адресе')
  assert.ok(page.fetched.every((f) => !f.query.includes(TICKET)))
  // Живое соединение: подпротоколы — имя и билет
  assert.equal(page.sockets.length, 1)
  assert.equal(page.sockets[0].url, 'wss://agent-arcade.test/net/chat')
  assert.deepEqual([...page.sockets[0].protocols], ['arcade-chat', TICKET])
  // Список: свежие сверху, превью с автором в группе; открытый чат прочитан
  assert.equal(page.one('me').textContent, '@alice')
  assert.deepEqual(page.items().map((i) => i.children[1].textContent), ['@bob', 'Squad'])
  assert.equal(page.items()[0].children[3].textContent, 'ну как?')
  assert.equal(page.items()[1].children[3].textContent, '@carol: всем привет')
  assert.ok(page.items()[0].classList.contains('active'))
  assert.equal(page.items()[0].children[4].textContent, '', 'прочитанный чат — без счётчика')
  // Аватарки: картинка SVG в img; у друга — его осьминог и точка «в сети», у группы без картинки — буква названия,
  // у себя наверху — кот (номер 0 — тоже аватарка)
  const A = page.ctx.ArcadeAvatars
  const svg = (ava) => (ava.children[0].src.startsWith('data:image/svg+xml,') ? decodeURIComponent(ava.children[0].src.slice(19)) : '')
  assert.equal(svg(page.items()[0].children[0]), A.avatarSvg(7))
  assert.equal(page.items()[0].children[0].className, 'ava on')
  assert.equal(svg(page.items()[1].children[0]), A.letterSvg('Squad', GROUP))
  assert.equal(page.items()[1].children[0].className, 'ava')
  assert.equal(svg(page.one('top').children[0]), A.avatarSvg(0))
  assert.equal(page.ctx.document.title, 'Чаты · Arcade')
  // Переписка: дни, свои справа, ссылки — только http(s)
  assert.equal(page.one('head').children[2].textContent, '@bobв сети')
  assert.equal(svg(page.one('head').children[1]), A.avatarSvg(7))
  assert.equal(page.one('sub').className, 'sub on')
  assert.deepEqual(page.all('day').map((d) => d.textContent).slice(1), ['Сегодня'])
  assert.equal(page.messages().length, 3)
  assert.ok(page.messages()[0].className.includes('mine') && !page.messages()[1].className.includes('mine'))
  assert.equal(page.all('who').length, 0, 'в чате на двоих автора не подписываем')
  assert.equal(page.all('line').length, 0, 'и аватарку у сообщений не ставим')
  // Своё — с галочкой «доставлено»; у чужих её нет
  assert.deepEqual(page.all('tick').map((t) => t.textContent), ['✓'])
  assert.match(page.all('at')[0].textContent, /^\d\d:\d\d✓$/)
  const text = page.all('text')[1]
  assert.equal(text.children[1].tagName, 'a')
  assert.equal(text.children[1].href, 'https://example.com/a?b=1')
  assert.equal(text.children[1].rel, 'noopener noreferrer')
  assert.equal(text.children[2], '. и javascript:alert(1)')
  assert.equal(page.all('more').length, 0, 'вся история уже здесь')
  assert.equal(page.one('plain').textContent, 'Переписка не шифруется — не пиши сюда пароли и ключи.')

  // Отправка: Enter, текст — на сайт, сообщение — в переписке, поле пустое
  await page.send('  салют  ')
  const sent = page.fetched.at(-1)
  assert.deepEqual([sent.method, sent.route, sent.body], ['POST', 'chats/send', { chat: 'd1-2', text: 'салют' }])
  assert.equal(page.messages().at(-1).children[0].textContent, 'салют')
  assert.ok(page.messages().at(-1).className.includes('mine'))
  assert.equal(page.input().value, '')
  // Сайт отказал — текст остаётся, объяснение — по-человечески
  page.data.fail['chats/send'] = 'often'
  await page.send('ещё')
  assert.equal(page.input().value, 'ещё')
  assert.equal(page.notice(), 'Слишком часто — подожди минуту.')
  delete page.data.fail['chats/send']

  // Кадр соединения: в открытом чате новое — страница забирает его после последнего показанного
  page.sockets[0].fire('open')
  await page.wait()
  assert.ok(page.one('dot').classList.contains('on'))
  page.data.chats['d1-2'].messages.push({ s: 5, f: '2', t: 'вижу', at: Date.now() })
  page.sockets[0].fire('message', { data: JSON.stringify({ type: 'note', chat: 'd1-2', msg: { f: '2' } }) })
  await page.wait()
  assert.equal(page.fetched.filter((f) => f.route === 'chats/messages').at(-1).query, '?chat=d1-2&after=4')
  assert.equal(page.messages().at(-1).children[0].textContent, 'вижу')
  // В другом чате новое — обновляется только список
  page.data.chats[GROUP].messages.push({ s: 3, f: '2', t: 'го', at: Date.now() + 1000 })
  page.data.chats[GROUP].unread = 1
  page.sockets[0].fire('message', { data: JSON.stringify({ type: 'note', chat: GROUP }) })
  await page.flush()
  assert.equal(page.items()[0].children[1].textContent, 'Squad')
  assert.equal(page.items()[0].children[4].textContent, '1')
  assert.equal(page.ctx.document.title, '(1) Чаты · Arcade')
  page.sockets[0].fire('message', { data: 'pong' })
  page.sockets[0].fire('message', { data: '{"type":"note","chat":"../x"}' })

  // Группа: автор подписан, служебные сообщения — словами, заголовок со счётом участников
  page.items()[0].fire('click')
  await page.wait()
  assert.equal(page.replaced, `/chat#c=${GROUP}`)
  assert.equal(page.all('note')[0].textContent, '@alice создал(а) группу «Squad»')
  assert.deepEqual(page.all('who').map((w) => w.textContent), ['@carol', '@bob'])
  assert.equal(page.one('sub').textContent, 'участники: 3, в сети: 1')
  // Чужие сообщения в группе — с аватаркой автора: у Кэрол буква, у Боба осьминог
  assert.deepEqual(page.all('line').map((l) => svg(l.children[0])), [A.letterSvg('carol', 'carol'), A.avatarSvg(7)])
  // Подряд от одного человека: имя — у первого, аватарка — у последнего
  page.data.chats[GROUP].messages.push({ s: 4, f: '2', t: 'кто тут', at: Date.now() + 2000 })
  await page.flush()
  page.sockets[0].fire('message', { data: JSON.stringify({ type: 'note', chat: GROUP }) })
  await page.wait()
  assert.deepEqual(page.all('who').map((w) => w.textContent), ['@carol', '@bob'])
  assert.deepEqual(page.all('line').map((l) => l.children[0].className), ['ava small', 'gap', 'ava small'])
  // Участники: хозяйка группы переименовывает, убирает и добавляет; выйти — двумя нажатиями
  page.button('Участники').fire('click')
  await page.wait()
  // Картинку группы выбирает хозяйка — одну из 24; убрать — «Без картинки»
  assert.equal(page.all('pick').length, 24)
  assert.equal(page.all('pick')[7].attributes['aria-label'], 'осьминог')
  assert.equal(page.button('Без картинки'), undefined, 'картинки ещё нет')
  page.all('pick')[5].fire('click')
  await page.wait()
  assert.deepEqual(page.fetched.filter((f) => f.route === 'chats/members').at(-1).body, { chat: GROUP, pic: 5 })
  assert.equal(page.all('pick')[5].className, 'pick active')
  assert.equal(page.all('pick')[5].attributes['aria-pressed'], 'true')
  page.button('Без картинки').fire('click')
  await page.wait()
  assert.deepEqual(page.fetched.filter((f) => f.route === 'chats/members').at(-1).body, { chat: GROUP, pic: null })
  assert.equal(page.all('pick').filter((p) => p.className === 'pick active').length, 0)
  assert.ok(page.all('mark').length === 1 && page.all('mark')[0].textContent === 'управляет группой')
  assert.equal(page.all('person').map((p) => p.textContent).join(' '), '@alice @bob @carol')
  page.button('Убрать').fire('click')
  await page.wait()
  assert.deepEqual(page.fetched.at(-2).body, { chat: GROUP, remove: ['2'] })
  assert.equal(page.all('person').map((p) => p.textContent).join(' '), '@alice @carol @bob', 'Боба можно позвать снова')
  page.button('Добавить').fire('click')
  await page.wait()
  assert.deepEqual(page.fetched.find((f) => f.route === 'chats/members' && f.body.add).body, { chat: GROUP, add: ['2'] })
  page.button('Закрыть').fire('click')
  assert.deepEqual(page.all('note').slice(-4).map((n) => n.textContent), ['@alice сменил(а) картинку группы', '@alice убрал(а) картинку группы', '@alice убрал(а) @bob', '@alice добавил(а) @bob'])
  page.button('Участники').fire('click')
  await page.wait()
  page.button('Выйти из группы').fire('click')
  assert.ok(page.button('Точно выйти? Нажми ещё раз'), 'первое нажатие только спрашивает')
  assert.ok(!page.fetched.some((f) => f.body?.leave))
  page.button('Точно выйти? Нажми ещё раз').fire('click')
  await page.wait()
  assert.deepEqual(page.fetched.at(-1).body, { chat: GROUP, leave: true })
  assert.equal(page.replaced, '/chat')
  assert.deepEqual(page.items().map((i) => i.children[1].textContent), ['@bob'])

  // Новый чат: друзья с сайта; «Написать» открывает чат на двоих, группа — из отмеченных или со всеми
  page.button('Новый чат').fire('click')
  await page.wait()
  assert.equal(page.all('person').map((p) => p.textContent).join(' '), '@bob @carol')
  page.button('Создать группу').fire('click')
  assert.equal(page.notice(), 'Отметь хотя бы одного друга.')
  assert.deepEqual(page.all('row').map((r) => r.children[1].className), ['ava tiny on', 'ava tiny'])
  page.all('row')[1].children[3].fire('click')
  await page.wait()
  assert.deepEqual(page.fetched.find((f) => f.route === 'chats/open').body, { with: '3' })
  assert.equal(page.replaced, '/chat#c=d1-3')
  assert.match(page.root.textContent, /Здесь пока пусто/)
  page.button('Новый чат').fire('click')
  await page.wait()
  page.button('Группа со всеми друзьями').fire('click')
  await page.wait()
  assert.deepEqual(page.fetched.find((f) => f.route === 'chats/group').body, { name: 'Все друзья', all: true })
  assert.equal(page.replaced, '/chat#c=gzyxwvutsrqponmlk')
  assert.equal(page.one('sub').textContent, 'участники: 3, в сети: 1')

  // Чата больше нет (выгнали из группы) — переписка остаётся, писать некуда
  page.sockets[0].fire('message', { data: JSON.stringify({ type: 'gone', chat: 'gzyxwvutsrqponmlk' }) })
  assert.match(page.one('feed').textContent, /Этого чата больше нет/)
  assert.equal(page.input(), undefined)

  // Соединение оборвалось — пробуем снова через секунду; уступили его другой вкладке — не переподключаемся
  page.timers.length = 0
  page.sockets[0].fire('close', { code: 1006 })
  assert.ok(!page.one('dot').classList.contains('on'))
  assert.deepEqual(page.timers.map((t) => t.ms), [1000])
  await page.flush()
  assert.equal(page.sockets.length, 2)
  page.sockets[1].fire('close', { code: 4000 })
  assert.equal(page.timers.length, 0)

  // Код ссылки из адреса: сразу уходит из адреса, меняется на билет — дальше как с билетом
  const linked = await chatPage({ hash: `#k=${LINK}&c=d1-2` })
  assert.deepEqual([linked.fetched[0].route, linked.fetched[0].method, linked.fetched[0].auth], ['chats/ticket', 'POST', `Link ${LINK}`])
  assert.equal(linked.store.get('arcade:chat'), TICKET)
  assert.equal(linked.replaced, '/chat#c=d1-2')
  assert.equal(linked.items().length, 2)
  assert.ok(linked.fetched.slice(1).every((f) => f.auth === `Chat ${TICKET}`))
  // Код уже использован, а билета во вкладке нет — просим открыть снова; есть — живём с ним
  const reused = await chatPage({ hash: `#k=${LINK}`, data: Object.assign(site(), { traded: true }) })
  assert.match(reused.root.textContent, /Вход на этой странице устарел/)
  assert.equal(reused.replaced, '/chat')
  const kept = await chatPage({ hash: `#k=${LINK}`, store: new Map(linked.store), data: Object.assign(site(), { traded: true }) })
  assert.equal(kept.items().length, 2)
  // Истёкший код сайту не шлём
  const stale = await chatPage({ hash: `#k=1.${Math.floor(Date.now() / 1000) - 1}.0123456789ab.${'L'.repeat(22)}` })
  assert.equal(stale.fetched.length, 0)
  assert.match(stale.root.textContent, /устарел/)

  // Перезагрузка вкладки: билет — из хранилища вкладки
  const again = await chatPage({ hash: '', store: page.store })
  assert.equal(again.items().length, 2)
  assert.equal(again.replaced, '/chat')
  // Билет перестал действовать — страница его забывает и просит открыть чаты снова
  const lost = await chatPage({ hash: `#t=1.${until}.0123456789ab.${'B'.repeat(22)}` })
  assert.match(lost.root.textContent, /Вход на этой странице устарел/)
  assert.equal(lost.store.size, 0)
  // Соединение сказало «билет не годен» — то же
  again.sockets[0].fire('close', { code: 4001 })
  assert.match(again.root.textContent, /устарел/)
  assert.equal(again.store.size, 0)

  // По-английски
  const en = await chatPage({ hash: `#t=${TICKET}&c=${GROUP}`, search: '?lang=en' })
  assert.equal(en.one('sub').textContent, 'members: 3, online: 1')
  assert.equal(en.all('note')[0].textContent, '@alice created the group “Squad”')
  assert.equal(en.button('New chat').textContent, 'New chat')
  assert.equal(en.ctx.document.title, '(2) Chats · Arcade', 'чат с Бобом не прочитан')
  en.button('Members').fire('click')
  await en.wait()
  assert.equal(en.all('pick')[7].attributes['aria-label'], 'octopus')
  assert.ok(en.one('sheet').children.some((c) => c.textContent === 'Group picture'))
  assert.match((await chatPage({ search: '?lang=en' })).root.textContent, /^Chats open from Arcade/)
}

console.log('окно: все проверки прошли')
