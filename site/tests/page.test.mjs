// Проверка окна Arcade без браузера: поддельный DOM и поддельная сеть, которая отдаёт файлы собранного сайта.
// Запуск: node tests/page.test.mjs
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { webcrypto } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { build } from '../build.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const DIST = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-site-'))
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

async function makePage(storage, { search = '?game=thwaite', pads = [], net = {} } = {}) {
  let now = 0
  const raf = []
  const audioNodes = []
  const handlers = {}
  const page = { draws: 0, focused: null, navigated: null, appended: [], onScript: null }
  function element(tag) {
    const node = {
      tagName: tag, className: '', textContent: '', href: '', tabIndex: 0, style: {}, dataset: {}, children: [],
      clientWidth: 900, clientHeight: 800, listeners: {},
      classList: { set: new Set(), add(c) { this.set.add(c) }, remove(c) { this.set.delete(c) }, contains(c) { return this.set.has(c) } },
      addEventListener(t, f) { (this.listeners[t] ??= []).push(f) },
      blur() {},
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
    location: { get search() { return search }, set search(v) { page.navigated = v } },
    URLSearchParams, console, crypto: webcrypto,
    fetch: network(net),
    performance: { now: () => now },
    requestAnimationFrame: (cb) => raf.push(cb),
    navigator: { getGamepads: () => pads },
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
  ctx.window = ctx
  vm.createContext(ctx)
  // Скрипт, который страница подгружает сама: sega.js — выполнить, как браузер; loader.js эмулятора — только запомнить
  page.onScript = (script) => {
    if (script.src === 'sega.js') {
      vm.runInContext(fs.readFileSync(path.join(DIST, 'sega.js'), 'utf8'), ctx, { filename: 'sega.js' })
      setTimeout(() => script.onload && script.onload(), 0)
    }
  }
  for (const file of ['jsnes.js', 'stats.js', 'library.js', 'game.js', 'boot.js']) {
    vm.runInContext(fs.readFileSync(path.join(DIST, file), 'utf8'), ctx, { filename: file })
  }
  // Ждём, пока каталог и игра скачаются и проверятся: проверка хеша в Node идёт в другом потоке
  const settled = () => {
    const hint = byId['overlay-hint']?.textContent ?? ''
    const library = byId.library?.children?.length ?? 0
    const overlayShown = byId.overlay?.classList.contains('shown')
    const segaStarted = page.appended.some((s) => s.src === 'emulatorjs/loader.js')
    return library > 0 || segaStarted || (overlayShown && hint !== '' && hint !== 'Загружаю игру…')
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
  const library = lib.byId.library
  let cards = library.querySelectorAll('.card')
  const nesIds = Object.keys(catalog.games).filter((id) => catalog.games[id].console === 'nes')
  assert.deepEqual(cards.map((c) => c.dataset.game), nesIds)
  assert.match(textOf(cards[0]), /Thwaite.*аркада.*ещё не играли/)
  assert.equal(lib.focused, cards[0])
  lib.fire('keydown', { code: 'ArrowRight' })
  assert.deepEqual(library.querySelectorAll('.card').map((c) => c.dataset.game), ['miniplanets', 'dragons-castle', 'kleleatoms', 'lunch-break'])
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
  assert.ok(sega.appended.some((s) => s.src === 'sega.js'), 'обвязка Sega подгружена')
  assert.ok(sega.appended.some((s) => s.src === 'emulatorjs/loader.js'), 'загрузчик эмулятора подключён')
  assert.equal(sega.ctx.EJS_core, 'segaMD')
  assert.equal(sega.ctx.EJS_gameUrl, catalog.games.miniplanets.rom.url)
  assert.equal(sega.ctx.EJS_pathtodata, 'emulatorjs/')
  assert.equal(sega.ctx.EJS_language, 'ru-RU')
  assert.equal(sega.ctx.EJS_player, '#sega-player')
  assert.equal(sega.byId.keys.textContent, 'движение — стрелки · A — S · B — X · C — Z · Start — Enter')
  assert.equal(sega.byId.license.href, 'licenses/miniplanets/LICENSE.txt')
  assert.equal(sega.byId.screen.style.display, 'none', 'экран Денди спрятан')
  // Подменённый файл Sega до эмулятора не доходит
  const rom = catalog.games.miniplanets.rom.url
  const bad = await makePage(new Map(), { search: '?game=miniplanets', net: { override: { [rom]: (b) => Buffer.concat([b.subarray(0, 300), Buffer.from([1]), b.subarray(301)]) } } })
  assert.match(bad.byId['overlay-hint'].textContent, /хеш не совпал/)
  assert.ok(!bad.appended.some((s) => s.src === 'emulatorjs/loader.js'))
}
console.log('окно: все проверки прошли')
