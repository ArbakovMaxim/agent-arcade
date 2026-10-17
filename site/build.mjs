// Сборка сайта Arcade для Cloudflare Pages: node build.mjs → dist/
//
// Каждый файл игры получает имя по своему SHA-256 (files/<хеш>.nes). Такие файлы не меняются, поэтому
// браузер и CDN кешируют их навсегда, а окно и мод сверяют скачанное с хешем из каталога. Рядом лежит
// копия в base64 (files/<хеш>.nes.b64): мод в Claude Code скачивает файлы только как текст.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const MAX_FILE = 25 * 1024 * 1024 // предел Cloudflare Pages на один файл
const ID = /^[a-z0-9-]+$/

// Правила кеширования для Cloudflare Pages: файлы по хешам — навсегда, каталог — на минуту
const HEADERS = `/files/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *
/catalog.json
  Cache-Control: public, max-age=60
  Access-Control-Allow-Origin: *
`

function fail(message) {
  throw new Error(`каталог: ${message}`)
}

// "0x3d9" или 985 → 985; адрес в памяти приставки
function address(value, where) {
  const n = typeof value === 'string' ? Number.parseInt(value, value.startsWith('0x') ? 16 : 10) : value
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) fail(`${where}: адрес ${JSON.stringify(value)} вне памяти приставки`)
  return n
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

export function build({ root, out, now = new Date() }) {
  const content = path.join(root, 'content')
  const source = JSON.parse(fs.readFileSync(path.join(content, 'catalog.json'), 'utf8'))
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })

  // Приставки
  const consoles = source.consoles ?? []
  const consoleIds = new Set()
  for (const c of consoles) {
    if (!ID.test(c.id ?? '')) fail(`у приставки неправильный id ${JSON.stringify(c.id)}`)
    if (consoleIds.has(c.id)) fail(`приставка ${c.id} описана дважды`)
    if (!c.title) fail(`у приставки ${c.id} нет названия`)
    consoleIds.add(c.id)
  }

  // Игры
  const games = {}
  for (const g of source.games ?? []) {
    const where = `игра ${g.id}`
    if (!ID.test(g.id ?? '')) fail(`у игры неправильный id ${JSON.stringify(g.id)}`)
    if (games[g.id]) fail(`${where} описана дважды`)
    if (!consoleIds.has(g.console)) fail(`${where}: нет приставки ${g.console}`)
    for (const field of ['title', 'genre', 'about', 'keys', 'rom']) if (!g[field]) fail(`${where}: нет поля ${field}`)
    const license = g.license ?? {}
    for (const field of ['name', 'author', 'source']) if (!license[field]) fail(`${where}: в лицензии нет поля ${field}`)

    const romPath = path.join(content, g.rom)
    if (!fs.existsSync(romPath)) fail(`${where}: нет файла ${g.rom}`)
    const bytes = fs.readFileSync(romPath)
    if (bytes.length > MAX_FILE) fail(`${where}: файл больше 25 МиБ — для Pages нужен R2`)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const ext = path.extname(g.rom) || '.bin'
    const url = `files/${sha256}${ext}`
    copy(romPath, path.join(out, url))
    fs.writeFileSync(path.join(out, `${url}.b64`), bytes.toString('base64'))

    const licenseFiles = (license.files ?? []).map((file) => {
      const from = path.join(content, file)
      if (!fs.existsSync(from)) fail(`${where}: нет файла лицензии ${file}`)
      const name = path.basename(file)
      copy(from, path.join(out, 'licenses', g.id, name))
      return { name, url: `licenses/${g.id}/${name}` }
    })

    games[g.id] = {
      console: g.console,
      title: g.title,
      genre: g.genre,
      about: g.about,
      keys: g.keys,
      credit: `${g.title} \u00a9 ${license.author}, ${license.name}`,
      ...(g.score
        ? { score: { label: g.score.label, parts: g.score.parts.map(([a, weight]) => [address(a, where), weight]) } }
        : {}),
      rom: { url, base64: `${url}.b64`, sha256, size: bytes.length },
      license: { name: license.name, author: license.author, source: license.source, commit: license.commit ?? null, files: licenseFiles },
    }
  }

  const catalog = { version: 1, built: now.toISOString(), consoles, games }
  fs.writeFileSync(path.join(out, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)

  // Окно Arcade и лицензии сторонних библиотек
  for (const file of fs.readdirSync(path.join(root, 'web'))) copy(path.join(root, 'web', file), path.join(out, file))
  copy(path.join(root, 'third_party', 'jsnes', 'LICENSE.txt'), path.join(out, 'licenses', 'jsnes', 'LICENSE.txt'))
  fs.writeFileSync(path.join(out, '_headers'), HEADERS)
  // Wrangler читает _headers как правила, но не выкладывает его как обычный файл
  fs.writeFileSync(path.join(out, '.assetsignore'), '_headers\n')
  return catalog
}

// Запуск из командной строки: node build.mjs [папка]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.dirname(fileURLToPath(import.meta.url))
  const out = path.resolve(process.argv[2] ?? path.join(root, 'dist'))
  const catalog = build({ root, out })
  console.log(`Готово. Игр в каталоге: ${Object.keys(catalog.games).length}. Сайт — в ${out}`)
}
