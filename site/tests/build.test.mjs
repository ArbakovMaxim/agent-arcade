// Проверка сборки сайта: node tests/build.test.mjs
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '../build.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
// Временные папки теста — каждая с копией каталога; в конце всё убираем, чтобы не забивать диск
const temps = []
const temp = (name) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), `arcade-${name}-`))
  temps.push(dir)
  return dir
}
process.on('exit', () => {
  for (const dir of temps) fs.rmSync(dir, { recursive: true, force: true })
})
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

// Настоящий каталог
const out = temp('dist')
const catalog = build({ root: ROOT, out, now: new Date('2026-10-17T12:00:00Z') })
assert.equal(catalog.version, 1)
assert.equal(catalog.built, '2026-10-17T12:00:00.000Z')
assert.deepEqual(catalog.consoles.map((c) => c.id), ['nes', 'sega', 'sms', 'gg', 'psx'])
const source = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'catalog.json'), 'utf8'))
assert.deepEqual(Object.keys(catalog.games), source.games.map((g) => g.id))
assert.deepEqual(Object.keys(catalog.games).slice(0, 3), ['thwaite', 'croom', 'rfk'])
assert.ok(Object.keys(catalog.games).length >= 12, 'в каталоге все игры')
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8')), catalog)

for (const [id, game] of Object.entries(catalog.games)) {
  const romPath = source.games.find((g) => g.id === id).rom
  const rom = fs.readFileSync(path.join(ROOT, 'content', romPath))
  const ext = path.extname(romPath)
  assert.match(game.rom.url, /^files\/[0-9a-f]{64}\.(nes|bin|zip|sms|gg)$/, id)
  assert.equal(game.rom.sha256, sha256(rom), `${id}: хеш`)
  assert.equal(game.rom.url, `files/${game.rom.sha256}${ext}`)
  assert.equal(game.rom.size, rom.length)
  assert.deepEqual(fs.readFileSync(path.join(out, game.rom.url)), rom, `${id}: файл лежит по хешу`)
  if (game.console === 'nes') assert.equal(fs.readFileSync(path.join(out, game.rom.base64), 'utf8'), rom.toString('base64'), `${id}: копия для мода`)
  if (game.console === 'nes') {
    assert.equal(rom.subarray(0, 4).toString('latin1'), 'NES\x1a', `${id}: это ROM Денди`)
    const mapper = (rom[6] >> 4) | (rom[7] & 0xf0)
    assert.ok([0, 1, 2, 3, 4, 7, 66].includes(mapper), `${id}: маппер ${mapper} JSNES поддерживает`)
  } else if (game.console === 'sms' || game.console === 'gg') {
    const tmr = rom.subarray(0x7ff0, 0x7ff8).toString('latin1') === 'TMR SEGA'
    assert.ok(tmr || path.extname(romPath) === `.${game.console}`, `${id}: ROM Master System или Game Gear`)
  } else if (game.console === 'sega') {
    assert.equal(rom.subarray(0x100, 0x104).toString('latin1'), 'SEGA', `${id}: это ROM Mega Drive`)
  } else {
    assert.equal(game.console, 'psx', `${id}: приставка`)
    assert.equal(rom.subarray(0, 4).toString('latin1'), 'PK\x03\x04', `${id}: диск PlayStation в .zip`)
  }
  assert.ok(game.license.files.some((f) => /license|notice/i.test(f.name)), `${id}: условия распространения рядом с игрой`)
  assert.match(game.license.source, /^https?:\/\//, `${id}: ссылка на источник`)
  for (const f of game.license.files) assert.ok(fs.existsSync(path.join(out, f.url)), `${id}: ${f.url}`)
  assert.match(game.credit, new RegExp(`^${game.title} © `))
}
assert.deepEqual(catalog.games.thwaite.score, { label: 'рекорд', parts: [[0x3d9, 10000], [0x3da, 100]] })
assert.deepEqual(catalog.games.rfk.score, { label: 'котят найдено', parts: [[0xde, 1]] })
assert.equal(catalog.games.croom.score, undefined)
assert.equal(catalog.games.nova.noncommercial, true)
assert.deepEqual(Object.keys(catalog.games).filter((id) => catalog.games[id].noncommercial), ['nova', 'super-uwol', 'driar'])
assert.equal(catalog.games.thwaite.license.commit, '00e36745188bc165990f60eed6b093c3ce6ad0e3')

for (const f of ['index.html', 'boot.js', 'library.js', 'game.js', 'stats.js', 'jsnes.js', 'licenses/jsnes/LICENSE.txt']) {
  assert.ok(fs.existsSync(path.join(out, f)), f)
}
const headers = fs.readFileSync(path.join(out, '_headers'), 'utf8')
assert.match(headers, /\/files\/\*\n  Cache-Control: public, max-age=31536000, immutable/)
assert.match(headers, /\/catalog\.json\n  Cache-Control: public, max-age=60/)
assert.equal(fs.readFileSync(path.join(out, '.assetsignore'), 'utf8'), '_headers\n_redirects\n')

// Повторная сборка даёт те же файлы (кроме времени сборки)
const again = build({ root: ROOT, out: temp('again'), now: new Date('2026-10-17T12:00:00Z') })
assert.deepEqual(again, catalog)

// Ошибки в каталоге ловятся при сборке, а не у пользователей
function broken(change) {
  const root = temp('broken')
  fs.cpSync(path.join(ROOT, 'content'), path.join(root, 'content'), { recursive: true, filter: (src) => !src.includes(`${path.sep}voxide`) })
  fs.cpSync(path.join(ROOT, 'web'), path.join(root, 'web'), { recursive: true })
  fs.cpSync(path.join(ROOT, 'third_party'), path.join(root, 'third_party'), { recursive: true })
  const file = path.join(root, 'content', 'catalog.json')
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  change(data, root)
  fs.writeFileSync(file, JSON.stringify(data))
  return () => build({ root, out: path.join(root, 'dist') })
}
assert.throws(broken((d) => { d.games[0].rom = 'games/thwaite/нет.nes' }), /игра thwaite: нет файла games\/thwaite\/нет\.nes/)
assert.throws(broken((d) => { d.games[1].console = 'snes' }), /игра croom: нет приставки snes/)
assert.throws(broken((d) => { d.games.push({ ...d.games[0] }) }), /игра thwaite описана дважды/)
assert.throws(broken((d) => { d.games[0].score.parts[0][0] = '0x10000' }), /адрес "0x10000" вне памяти приставки/)
assert.throws(broken((d) => { delete d.games[2].license.source }), /игра rfk: в лицензии нет поля source/)
assert.throws(broken((d) => { d.games[0].id = 'Thwaite!' }), /неправильный id "Thwaite!"/)
assert.throws(broken((d) => { d.games[0].license.files.push('games/thwaite/нет.txt') }), /нет файла лицензии/)
console.log('сборка: все проверки прошли')

// Эмулятор Sega: EmulatorJS и ядро Genesis Plus GX на нашем сайте, без проверки обновлений через чужой CDN
{
  const dir = temp('sega')
  const built = build({ root: ROOT, out: dir })
  assert.deepEqual(Object.keys(built.games).filter((id) => built.games[id].console === 'sega'), ['miniplanets', 'dragons-castle', 'kleleatoms', 'lunch-break', '5stars', 'tank-battle', 'battle-4tris', 'pong', 'snake-arena', 'space-shooter', 'breakout'])
  // Копия base64 — только у Денди: Sega и PlayStation идут в окне. VoXide пока не в каталоге: игра не видит геймпад в PCSX ReARMed
  assert.ok(!fs.existsSync(path.join(dir, `${built.games.miniplanets.rom.url}.b64`)), 'у Sega нет копии base64')
  assert.ok(fs.existsSync(path.join(dir, `${built.games.thwaite.rom.url}.b64`)), 'у Денди копия base64 есть')
  assert.equal(built.games.voxide, undefined)
  assert.equal(built.consoles.find((c) => c.id === 'sega').soon, undefined, 'у Sega больше нет пометки «скоро»')
  assert.equal(built.consoles.find((c) => c.id === 'sega').noncommercial, true, 'ядро Genesis Plus GX — некоммерческое, это видно в каталоге')
  for (const f of ['emulatorjs/loader.js', 'emulatorjs/emulator.css', 'emulatorjs/src/emulator.js', 'emulatorjs/cores/genesis_plus_gx-wasm.data', 'emulatorjs/cores/reports/genesis_plus_gx.json', 'emulatorjs/cores/pcsx_rearmed-wasm.data', 'emulatorjs/cores/reports/pcsx_rearmed.json', 'emulatorjs/localization/ru-RU.json', 'ejs.js', 'mine.js']) {
    assert.ok(fs.existsSync(path.join(dir, f)), f)
  }
  const emulator = fs.readFileSync(path.join(dir, 'emulatorjs', 'src', 'emulator.js'), 'utf8')
  assert.match(emulator, /checkForUpdates\(\) \{\n {8}return \/\/ Arcade: без запроса к cdn\.emulatorjs\.org/)
  for (const f of ['EmulatorJS-LICENSE.txt', 'Genesis-Plus-GX-LICENSE.txt', 'PCSX-ReARMed-COPYING.txt', 'NOTICE.txt']) assert.ok(fs.existsSync(path.join(dir, 'licenses', 'emulatorjs', f)), f)
  // PlayStation: приставка есть, своих игр в каталоге нет — подсказка про свой диск
  const psx = built.consoles.find((c) => c.id === 'psx')
  assert.equal(psx.title, 'PlayStation')
  assert.match(psx.empty, /Открой свой диск/)
  // Hello Pong — диск в .zip, собран в Arcade из исходников (MIT + PSn00bSDK под MPL-2.0)
  assert.deepEqual(Object.keys(built.games).filter((id) => built.games[id].console === 'psx'), ['hello-pong'])
  assert.match(built.games['hello-pong'].rom.url, /^files\/[0-9a-f]{64}\.zip$/)
  assert.ok(!fs.existsSync(path.join(dir, `${built.games['hello-pong'].rom.url}.b64`)), 'у PlayStation нет копии base64')
  assert.deepEqual(built.games['hello-pong'].license.files.map((f) => f.name), ['LICENSE.txt', 'NOTICE.txt', 'PSn00bSDK-LICENSE.txt', 'hello-pong-dec2f3f-src.tar.gz'])
  assert.ok(!fs.existsSync(path.join(dir, 'emulatorjs', 'licenses')), 'лицензии — в licenses/, а не рядом с эмулятором')
}
// Игра не той приставки — ошибка сборки, а не у пользователей
assert.throws(broken((d) => { d.games.find((g) => g.id === 'miniplanets').console = 'nes' }), /игра miniplanets: это не ROM Денди/)
assert.throws(broken((d) => { d.games.find((g) => g.id === 'thwaite').console = 'sega' }), /игра thwaite: это не ROM Sega Mega Drive/)
assert.throws(broken((d) => { d.games.find((g) => g.id === 'thwaite').console = 'psx' }), /игра thwaite: диск PlayStation должен быть \.zip/)
// Master System и Game Gear: игры, короткие адреса приставок, проверка метки TMR SEGA
{
  const dir = temp('sms')
  const built = build({ root: ROOT, out: dir })
  assert.deepEqual(Object.keys(built.games).filter((id) => built.games[id].console === 'sms'), ['balloon-master', 'skyhaul', 'food-fighter', 'escape-from-monster-dimension'])
  assert.equal(Object.values(built.games).filter((g) => g.console === 'gg').length, 0)
  const redirects = fs.readFileSync(path.join(dir, '_redirects'), 'utf8')
  for (const c of ['nes', 'sega', 'sms', 'gg', 'psx']) assert.ok(redirects.includes(`/${c} /?tab=${c} 302`), c)
  assert.match(fs.readFileSync(path.join(dir, '.assetsignore'), 'utf8'), /_redirects/)
}
assert.throws(broken((d) => { d.games.find((g) => g.id === 'thwaite').console = 'sms' }), /игра thwaite: это не ROM Master System или Game Gear \(нет метки TMR SEGA и расширение не/)
// Маппер 28 — общий с модом: сборка делает из модуля мода обычный скрипт
{
  const dir = temp('mapper28')
  build({ root: ROOT, out: dir })
  const script = fs.readFileSync(path.join(dir, 'mapper28.js'), 'utf8')
  assert.ok(!/^export /m.test(script), 'без export — это обычный скрипт')
  assert.match(script, /installMapper28\(window\.jsnes && window\.jsnes\.Mappers\)/)
}
console.log('Sega: все проверки прошли')
