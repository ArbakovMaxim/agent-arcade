// Проверка окна Arcade без браузера: поддельный DOM и поддельная сеть, которая отдаёт файлы собранного сайта.
// Запуск: node tests/page.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { build } from '../build.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-site-'))
process.on('exit', () => fs.rmSync(DIST, { recursive: true, force: true })) // собранный сайт — только на время теста
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
  assert.deepEqual(lib.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['freedm', 'freedoom-1', 'freedoom-2', 'blasphemer', 'blasphdm'])
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
  assert.deepEqual(lib.byId.library.querySelectorAll('.shelf').map((b) => b.textContent), ['Аркады', 'Шутеры', 'Гонки', 'Стратегии', 'Настольные'])
  assert.equal(lib.byId.library.querySelectorAll('.shelf').find((b) => /\bactive\b/.test(b.className)).textContent, 'Гонки')
  // «☕ Поддержать» в шапке — новой вкладкой, без лишних прав для открытой страницы
  const support = lib.byId.library.querySelectorAll('.support')[0]
  assert.equal(support.href, catalog.support.url)
  assert.equal(support.target, '_blank')
  assert.equal(support.rel, 'noopener')
  const strategy = await makePage(new Map(), { search: '?tab=games&shelf=strategy' })
  assert.deepEqual(strategy.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['openttd'])
  // по умолчанию — первая полка, аркады: Flappy Arcade
  const arcade = await makePage(new Map(), { search: '?tab=games' })
  assert.deepEqual(arcade.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['flappy'], 'по умолчанию — первая полка, аркады')
  const shooters = await makePage(new Map(), { search: '?tab=games&shelf=shooters' })
  assert.deepEqual(shooters.byId.library.querySelectorAll('.card').map((c) => c.dataset.game), ['freedm', 'freedoom-1', 'freedoom-2', 'blasphemer', 'blasphdm'], 'полка шутеров')
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
  ttdFrame.contentWindow = { Module: ttdModule, addEventListener() {} }
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
  assert.equal(lib.byId.library.querySelectorAll('.open-rom').length, 1, 'только кнопка языка')
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
  const net = await makePage(new Map(), { search: '?game=chess&room=abcdef5678&control=7&lang=en', globals: { ArcadeChessLib: { Chess } } })
  await until(() => net.sockets.some((s) => /\/net\/board\/abcdef5678$/.test(s.url)))
  const ws = net.sockets.find((s) => /\/net\/board\/abcdef5678$/.test(s.url))
  ws.emit('open')
  assert.deepEqual([JSON.parse(ws.sent[0]).type, JSON.parse(ws.sent[0]).control], ['hello', 420])
  const now = Date.now()
  ws.emit('message', JSON.stringify({ type: 'state', game: 'chess', seat: 0, seats: 2, moves: [], control: 420, clock: { left: [420000, 420000], since: now, now } }))
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

console.log('окно: все проверки прошли')
