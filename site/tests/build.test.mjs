// Проверка сборки сайта: node tests/build.test.mjs
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from '../build.mjs'

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const temp = (name) => fs.mkdtempSync(path.join(os.tmpdir(), `arcade-${name}-`))
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

// Настоящий каталог
const out = temp('dist')
const catalog = build({ root: ROOT, out, now: new Date('2026-10-17T12:00:00Z') })
assert.equal(catalog.version, 1)
assert.equal(catalog.built, '2026-10-17T12:00:00.000Z')
assert.deepEqual(catalog.consoles.map((c) => c.id), ['nes', 'sega'])
assert.deepEqual(Object.keys(catalog.games), ['thwaite', 'croom', 'rfk'])
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(out, 'catalog.json'), 'utf8')), catalog)

for (const [id, game] of Object.entries(catalog.games)) {
  const source = fs.readFileSync(path.join(ROOT, 'content', 'games', id, path.basename(id === 'rfk' ? 'robotfindskitten.nes' : `${id}.nes`)))
  assert.match(game.rom.url, /^files\/[0-9a-f]{64}\.nes$/, id)
  assert.equal(game.rom.sha256, sha256(source), `${id}: хеш`)
  assert.equal(game.rom.url, `files/${game.rom.sha256}.nes`)
  assert.equal(game.rom.size, source.length)
  assert.deepEqual(fs.readFileSync(path.join(out, game.rom.url)), source, `${id}: файл лежит по хешу`)
  assert.equal(fs.readFileSync(path.join(out, game.rom.base64), 'utf8'), source.toString('base64'), `${id}: копия для мода`)
  assert.equal(game.license.files.length, 2)
  for (const f of game.license.files) assert.ok(fs.existsSync(path.join(out, f.url)), `${id}: ${f.url}`)
  assert.match(game.credit, new RegExp(`^${game.title} © `))
}
assert.deepEqual(catalog.games.thwaite.score, { label: 'рекорд', parts: [[0x3d9, 10000], [0x3da, 100]] })
assert.deepEqual(catalog.games.rfk.score, { label: 'котят найдено', parts: [[0xde, 1]] })
assert.equal(catalog.games.croom.score, undefined)
assert.equal(catalog.games.thwaite.license.commit, '00e36745188bc165990f60eed6b093c3ce6ad0e3')

for (const f of ['index.html', 'boot.js', 'library.js', 'game.js', 'stats.js', 'jsnes.js', 'licenses/jsnes/LICENSE.txt']) {
  assert.ok(fs.existsSync(path.join(out, f)), f)
}
const headers = fs.readFileSync(path.join(out, '_headers'), 'utf8')
assert.match(headers, /\/files\/\*\n  Cache-Control: public, max-age=31536000, immutable/)
assert.match(headers, /\/catalog\.json\n  Cache-Control: public, max-age=60/)
assert.equal(fs.readFileSync(path.join(out, '.assetsignore'), 'utf8'), '_headers\n')

// Повторная сборка даёт те же файлы (кроме времени сборки)
const again = build({ root: ROOT, out: temp('again'), now: new Date('2026-10-17T12:00:00Z') })
assert.deepEqual(again, catalog)

// Ошибки в каталоге ловятся при сборке, а не у пользователей
function broken(change) {
  const root = temp('broken')
  fs.cpSync(path.join(ROOT, 'content'), path.join(root, 'content'), { recursive: true })
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
