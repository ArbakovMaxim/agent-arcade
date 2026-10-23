// Сборка сайта Arcade для Cloudflare Pages: node build.mjs → dist/
//
// Каждый файл игры получает имя по своему SHA-256 (files/<хеш>.nes). Такие файлы не меняются, поэтому
// браузер и CDN кешируют их навсегда, а окно и мод сверяют скачанное с хешем из каталога. Рядом лежит
// копия в base64 (files/<хеш>.nes.b64): мод в Claude Code скачивает файлы только как текст.
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import zlib from 'node:zlib'

const MAX_FILE = 25 * 1024 * 1024 // предел Cloudflare Pages на один файл
const PART = 24 * 1024 * 1024 // кусок большого файла чужой сборки — с запасом до предела
const ID = /^[a-z0-9-]+$/
// Чужие сборки, которых нет в git (Warzone 2100 — архив на 100 МБ): скачанный архив — в .cache/downloads/,
// разобранный — в .cache/web/. Папка — рядом со сборкой, а не в root: тесты собирают из временных копий root
const CACHE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache')
const archiveFile = (d) => path.join(CACHE, 'downloads', `${d.sha256}.zip`)

// Правила кеширования для Cloudflare Pages: файлы по хешам — навсегда, каталог — на минуту
const HEADERS = `/files/*
  Cache-Control: public, max-age=31536000, immutable
  Access-Control-Allow-Origin: *
/catalog.json
  Cache-Control: public, max-age=60
  Access-Control-Allow-Origin: *
/channels.json
  Cache-Control: public, max-age=3600
  Access-Control-Allow-Origin: *
/feeds.json
  Cache-Control: public, max-age=3600
  Access-Control-Allow-Origin: *
`

function fail(message) {
  throw new Error(`каталог: ${message}`)
}

// Каналы YouTube для мода (content/channels.json): мод пропускает каналы с ошибками молча, поэтому сборка строже —
// опечатка ловится здесь, а не пропавшим каналом у пользователей
const LANGS = ['en', 'ru', 'uk', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'tr', 'ja', 'zh', 'ko']
export function checkChannels(data) {
  const bad = (message) => {
    throw new Error(`каналы: ${message}`)
  }
  if (data?.version !== 1) bad('нужно "version": 1')
  if (!Array.isArray(data.directions) || !Array.isArray(data.channels)) bad('нужны списки directions и channels')
  const directions = new Set()
  for (const d of data.directions) {
    if (!/^[a-z]{2,20}$/.test(d?.id ?? '')) bad(`неправильный id направления ${JSON.stringify(d?.id)}`)
    if (directions.has(d.id)) bad(`направление ${d.id} описано дважды`)
    if (typeof d.about !== 'string' || !d.about || d.about.length > 200) bad(`направление ${d.id}: нужно описание about до 200 знаков`)
    directions.add(d.id)
  }
  if (!directions.has('news')) bad('нет направления news — новинок и презентаций')
  const ids = new Set()
  for (const c of data.channels) {
    const where = `канал ${c?.name ?? c?.id}`
    if (!/^UC[\w-]{22}$/.test(c?.id ?? '')) bad(`${where}: неправильный id ${JSON.stringify(c?.id)} — нужен UC и 22 знака`)
    if (ids.has(c.id)) bad(`${where}: ${c.id} уже есть в списке`)
    if (typeof c.name !== 'string' || !c.name || c.name.length > 80) bad(`${where}: нужно имя до 80 знаков`)
    if (!LANGS.includes(c.lang)) bad(`${where}: язык ${JSON.stringify(c.lang)} не из ${LANGS.join(', ')}`)
    if (!Array.isArray(c.topics) || !c.topics.length) bad(`${where}: нужен хотя бы один topic`)
    for (const t of c.topics) if (!directions.has(t)) bad(`${where}: нет направления ${t}`)
    ids.add(c.id)
  }
  return data
}

// Ленты статей и подкастов для мода (content/feeds.json), той же строгостью. hosts — сайты, на которые ведут ссылки
// ленты (статьи, страницы выпусков): страница /read открывает только их. directions — направления из channels.json
export function checkFeeds(data, directions) {
  const bad = (message) => {
    throw new Error(`ленты: ${message}`)
  }
  if (data?.version !== 1) bad('нужно "version": 1')
  if (!Array.isArray(data.articles) || !Array.isArray(data.podcasts)) bad('нужны списки articles и podcasts')
  const ids = new Set()
  for (const f of [...data.articles, ...data.podcasts]) {
    const where = `лента ${f?.name ?? f?.id}`
    if (!ID.test(f?.id ?? '')) bad(`${where}: неправильный id ${JSON.stringify(f?.id)} — только a-z, 0-9 и дефис`)
    if (ids.has(f.id)) bad(`${where}: ${f.id} уже есть в списке`)
    if (typeof f.name !== 'string' || !f.name || f.name.length > 80) bad(`${where}: нужно имя до 80 знаков`)
    if (!LANGS.includes(f.lang)) bad(`${where}: язык ${JSON.stringify(f.lang)} не из ${LANGS.join(', ')}`)
    let url = null
    try {
      url = new URL(f.url)
    } catch {
      // ниже — понятная ошибка
    }
    if (url?.protocol !== 'https:') bad(`${where}: нужен адрес ленты https://`)
    if (!Array.isArray(f.topics) || !f.topics.length) bad(`${where}: нужен хотя бы один topic`)
    for (const t of f.topics) if (!directions.has(t)) bad(`${where}: нет направления ${t}`)
    if (!Array.isArray(f.hosts) || !f.hosts.length) bad(`${where}: нужен список hosts — сайты статей или выпусков`)
    for (const h of f.hosts) if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h ?? '')) bad(`${where}: ${JSON.stringify(h)} — не имя сайта`)
    ids.add(f.id)
  }
  return data
}

// Каталог Twitch (content/twitch.json) — его читает Worker (/api/twitch). Логины — как в адресе twitch.tv, все
// вместе — один вопрос к Twitch (до 100). directions — направления из channels.json
export function checkTwitch(data, directions) {
  const bad = (message) => {
    throw new Error(`Twitch: ${message}`)
  }
  if (data?.version !== 1) bad('нужно "version": 1')
  if (!Array.isArray(data.channels) || !data.channels.length) bad('нужен список channels')
  if (data.channels.length > 100) bad('больше 100 каналов — Twitch за один вопрос столько не отдаст')
  const logins = new Set()
  for (const c of data.channels) {
    const where = `канал ${c?.login}`
    if (!/^[a-z0-9][a-z0-9_]{1,24}$/.test(c?.login ?? '')) bad(`${where}: логин — как в адресе twitch.tv, строчными буквами`)
    if (logins.has(c.login)) bad(`${where}: уже есть в списке`)
    if (!Array.isArray(c.topics) || !c.topics.length || c.topics.length > 2) bad(`${where}: нужно одно-два направления topics`)
    for (const t of c.topics) if (!directions.has(t)) bad(`${where}: нет направления ${t}`)
    logins.add(c.login)
  }
  return data
}

// "0x3d9" или 985 → 985; адрес в памяти приставки
function address(value, where) {
  const n = typeof value === 'string' ? Number.parseInt(value, value.startsWith('0x') ? 16 : 10) : value
  if (!Number.isInteger(n) || n < 0 || n > 0xffff) fail(`${where}: адрес ${JSON.stringify(value)} вне памяти приставки`)
  return n
}

// Переводы окна на 11 языков: web/locales/<язык>.json → { язык: { exact, templates, words, about } }
function readLocales(root) {
  const dir = path.join(root, 'web', 'locales')
  const locales = {}
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) locales[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
  }
  return locales
}

function copy(from, to) {
  fs.mkdirSync(path.dirname(to), { recursive: true })
  fs.copyFileSync(from, to)
}

// Файл из кеша скачанных игр (.cache/web) — жёсткой ссылкой, если сборка на том же диске: сотни мегабайт OpenArena
// не копируются в каждую сборку заново. Ссылкой — только крупные файлы, мелкие проще скопировать. Править такой
// файл на месте нельзя — правка ушла бы и в кеш. Другой диск или ссылки запрещены — обычная копия
const LINK_MIN = 1024 * 1024
function place(from, to) {
  if (fs.statSync(from).size < LINK_MIN) return copy(from, to)
  fs.mkdirSync(path.dirname(to), { recursive: true })
  try {
    fs.linkSync(from, to)
  } catch {
    fs.copyFileSync(from, to)
  }
}

// Эмулятор Sega (EmulatorJS + ядро Genesis Plus GX) → dist/emulatorjs/, лицензии → dist/licenses/emulatorjs/.
// Одна правка: без проверки обновлений, чтобы страница не обращалась к cdn.emulatorjs.org.
function copyEmulatorJS(from, out) {
  const walk = (dir, rel = '') => {
    for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const relPath = path.join(rel, entry.name)
      if (entry.isDirectory()) walk(dir, relPath)
      else if (rel.split(path.sep)[0] === 'licenses') copy(path.join(dir, relPath), path.join(out, 'licenses', 'emulatorjs', entry.name))
      else copy(path.join(dir, relPath), path.join(out, 'emulatorjs', relPath))
    }
  }
  walk(from)
  const emulator = path.join(out, 'emulatorjs', 'src', 'emulator.js')
  const code = fs.readFileSync(emulator, 'utf8')
  const marker = '    checkForUpdates() {\n'
  if (code.split(marker).length !== 2) throw new Error('EmulatorJS: не нашёл checkForUpdates — проверь версию эмулятора')
  fs.writeFileSync(emulator, code.replace(marker, `${marker}        return // Arcade: без запроса к cdn.emulatorjs.org\n`))
}

// Скачивает архивы браузерных игр (поле download в каталоге), которых ещё нет в .cache/downloads/, и сверяет
// размер и SHA-256 с каталогом. Сама сборка (build) — без сети: без скачанного архива она останавливается
export async function download({ root, log = console.log }) {
  const source = JSON.parse(fs.readFileSync(path.join(root, 'content', 'catalog.json'), 'utf8'))
  for (const g of source.games ?? []) {
    const d = g.download
    if (!d || fs.existsSync(archiveFile(d))) continue
    log(`Скачиваю ${g.id}: ${d.url} (${Math.round(d.size / 1e6)} МБ)`)
    const res = await fetch(d.url)
    if (!res.ok) throw new Error(`игра ${g.id}: ${d.url} ответил ${res.status}`)
    const data = Buffer.from(await res.arrayBuffer())
    if (data.length !== d.size) throw new Error(`игра ${g.id}: скачалось ${data.length} байт, а в каталоге ${d.size}`)
    const sha256 = createHash('sha256').update(data).digest('hex')
    if (sha256 !== d.sha256) throw new Error(`игра ${g.id}: SHA-256 архива ${sha256}, а в каталоге ${d.sha256}`)
    const file = archiveFile(d)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(`${file}.tmp`, data)
    fs.renameSync(`${file}.tmp`, file)
  }
}

// Файлы zip-архива: { путь: Buffer } для тех, что пропускает keep. Только обычные архивы: без zip64 и шифрования,
// сжатие deflate или без сжатия
function unzip(zip, where, keep) {
  let end = zip.length - 22
  while (end >= 0 && zip.readUInt32LE(end) !== 0x06054b50) end--
  if (end < 0) fail(`${where}: архив — не zip`)
  const files = {}
  let at = zip.readUInt32LE(end + 16)
  for (let i = zip.readUInt16LE(end + 10); i > 0; i--) {
    if (zip.readUInt32LE(at) !== 0x02014b50) fail(`${where}: испорчено оглавление архива`)
    const flags = zip.readUInt16LE(at + 8)
    const method = zip.readUInt16LE(at + 10)
    const packed = zip.readUInt32LE(at + 20)
    const size = zip.readUInt32LE(at + 24)
    const local = zip.readUInt32LE(at + 42)
    const nameEnd = at + 46 + zip.readUInt16LE(at + 28)
    const name = zip.toString('utf8', at + 46, nameEnd)
    at = nameEnd + zip.readUInt16LE(at + 30) + zip.readUInt16LE(at + 32)
    if (name.endsWith('/') || !keep(name)) continue
    if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) fail(`${where}: в архиве опасный путь ${name}`)
    if (flags & 1) fail(`${where}: ${name} в архиве зашифрован`)
    if ([packed, size, local].includes(0xffffffff)) fail(`${where}: архив zip64 — такие не разбираем`)
    if (zip.readUInt32LE(local) !== 0x04034b50) fail(`${where}: испорчен архив у ${name}`)
    const start = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28)
    const raw = zip.subarray(start, start + packed)
    if (method !== 0 && method !== 8) fail(`${where}: ${name} сжат способом ${method} — разбираем только deflate`)
    const data = method === 8 ? zlib.inflateRawSync(raw) : raw
    if (data.length !== size) fail(`${where}: ${name} распаковался не целиком`)
    files[name] = data
  }
  return files
}

// Скачанная игра → папка в .cache/web/<id>-<ключ>: без лишних файлов (skip), с правками (edit — каждая находит
// ровно одно место, иначе архив другой версии), файлы больше 25 МиБ — кусками по 24 МиБ, сжатыми gzip, если так
// меньше. Куски склеивает на странице arcade-parts.js (манифест + web/parts.js), его сборка вставит первым скриптом.
// Ключ — от описания в каталоге и этого кода: поменялось что-то из них — папка собирается заново
function prepare(root, g, where) {
  const d = g.download
  for (const field of ['url', 'sha256', 'size']) if (!d[field]) fail(`${where}: в download нет поля ${field}`)
  const shim = fs.readFileSync(path.join(root, 'web', 'parts.js'), 'utf8')
  const key = createHash('sha256').update(JSON.stringify(d)).update(String(prepare)).update(String(unzip)).update(shim).digest('hex').slice(0, 16)
  const dir = path.join(CACHE, 'web', `${g.id}-${key}`)
  if (fs.existsSync(dir)) return dir
  const file = archiveFile(d)
  if (!fs.existsSync(file)) fail(`${where}: архива ещё нет — node build.mjs сначала скачает его из ${d.url}`)
  const zip = fs.readFileSync(file)
  if (createHash('sha256').update(zip).digest('hex') !== d.sha256) fail(`${where}: архив в кеше испорчен — удалите ${file}`)
  // Шаблон без / — по имени файла в любой папке; * — любые символы, кроме /
  const skip = (d.skip ?? []).map((p) => {
    const re = new RegExp(`^${p.split('*').map((s) => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('[^/]*')}$`)
    return (name) => re.test(p.includes('/') ? name : path.posix.basename(name))
  })
  const files = unzip(zip, where, (name) => !skip.some((test) => test(name)))
  for (const [name, edits] of Object.entries(d.edit ?? {})) {
    if (!files[name]) fail(`${where}: правка для ${name}, а такого файла в архиве нет`)
    let text = files[name].toString('utf8')
    for (const e of edits) {
      const re = new RegExp(e.find, 'g')
      const found = text.match(re)?.length ?? 0
      if (found !== 1) fail(`${where}: в ${name} правка «${e.why}» нашла мест: ${found}, а нужно одно — другая версия архива?`)
      text = text.replace(re, () => e.replace)
    }
    files[name] = Buffer.from(text, 'utf8')
  }
  const parts = {}
  for (const [name, data] of Object.entries(files)) {
    if (data.length <= MAX_FILE) continue
    const gz = zlib.gzipSync(data)
    const body = gz.length < data.length * 0.9 ? gz : data
    // В имени кусков — хеш файла: после выкладки новой версии браузер не склеит старый кусок с новым
    const hash = createHash('sha256').update(data).digest('hex').slice(0, 12)
    const list = []
    for (let i = 0; i * PART < body.length; i++) {
      const part = `${name}.${hash}.part${i}`
      files[part] = body.subarray(i * PART, (i + 1) * PART)
      list.push(path.posix.basename(part))
    }
    parts[name] = { size: data.length, gzip: body === gz, parts: list }
    delete files[name]
  }
  if (Object.keys(parts).length) files['arcade-parts.js'] = Buffer.from(`// Собрано build.mjs: куски больших файлов игры и их склейка (web/parts.js)\nwindow.ARCADE_PARTS = ${JSON.stringify(parts)}\n${shim}`)
  // Старые разборы этой игры больше не нужны; новый пишется рядом и встаёт на место целиком
  fs.mkdirSync(path.dirname(dir), { recursive: true })
  const mine = new RegExp(`^${g.id}-[0-9a-f]{16}(\\.tmp)?$`)
  for (const old of fs.readdirSync(path.dirname(dir)).filter((n) => mine.test(n))) fs.rmSync(path.join(path.dirname(dir), old), { recursive: true, force: true })
  const tmp = `${dir}.tmp`
  for (const [name, data] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(tmp, name)), { recursive: true })
    fs.writeFileSync(path.join(tmp, name), data)
  }
  fs.renameSync(tmp, dir)
  return dir
}

// audiobooks — список аудиокниг вместо content/audiobooks/index.json (для тестов)
export function build({ root, out, now = new Date(), audiobooks = null }) {
  const content = path.join(root, 'content')
  const source = JSON.parse(fs.readFileSync(path.join(content, 'catalog.json'), 'utf8'))
  fs.rmSync(out, { recursive: true, force: true })
  fs.mkdirSync(out, { recursive: true })

  // Приставки
  const consoles = source.consoles ?? []
  // Книги каталога — из content/books/index.json, который пишет tools/books/build.mjs (150 книг вручную не перечисляем)
  const bookIndex = path.join(content, 'books', 'index.json')
  if (fs.existsSync(bookIndex)) {
    const listed = new Set((source.games ?? []).map((g) => g.id))
    for (const b of JSON.parse(fs.readFileSync(bookIndex, 'utf8'))) {
      if (listed.has(b.id)) continue
      ;(source.games ??= []).push({
        // полка — по языку книги: «Книги» → English, Українська…
        id: b.id, console: 'books', kind: 'book', shelf: `books-${b.lang}`, text: `books/${b.id}/book.json`, title: b.title, author: b.author, lang: b.lang, year: b.year, genre: b.genre,
        about: b.about ?? '', about_en: b.about_en ?? '', keys: 'колёсико или пробел — дальше',
        license: { name: 'общественное достояние', author: b.author, source: b.source, files: [`books/${b.id}/LICENSE.txt`] },
      })
    }
  }
  // Аудиокниги — из content/audiobooks/index.json (пишет tools/audiobooks/build.mjs из LibriVox); звук — на archive.org.
  // Карточка «Мои аудиокниги» — всегда, если в каталоге есть полка аудиокниг: свои файлы хранятся в браузере
  const audioIndex = path.join(content, 'audiobooks', 'index.json')
  if (consoles.some((c) => c.id === 'audiobooks')) {
    const listed = new Set((source.games ?? []).map((g) => g.id))
    if (audiobooks || fs.existsSync(audioIndex)) {
      for (const b of audiobooks || JSON.parse(fs.readFileSync(audioIndex, 'utf8'))) {
        if (listed.has(b.id)) continue
        ;(source.games ??= []).push({
          id: b.id, console: 'audiobooks', kind: 'audio', shelf: `audio-${b.lang}`, title: b.title, author: b.author, reader: b.reader ?? '', lang: b.lang, year: b.year, genre: b.genre ?? 'аудиокнига',
          about: b.about ?? '', about_en: b.about_en ?? '', keys: 'пробел — пауза · ← → — на 10 секунд', chapters: b.chapters,
          license: { name: 'общественное достояние (LibriVox)', author: b.author, source: b.source },
        })
      }
    }
    if (!listed.has('my-audio')) {
      ;(source.games ??= []).push({
        id: 'my-audio', console: 'audiobooks', kind: 'audio-mine', shelf: 'audio-mine', title: 'Мои аудиокниги', genre: 'свои файлы',
        about: 'Свои MP3, M4A, M4B, OGG или Opus — файлы хранятся только в этом браузере.', about_en: 'Your own MP3, M4A, M4B, OGG or Opus — the files stay in this browser only.',
        keys: 'пробел — пауза · ← → — на 10 секунд', license: { name: 'свои файлы', author: '—', source: 'https://github.com/ArbakovMaxim/agent-arcade' },
      })
    }
  }
  // Полки языков: книга или аудиокнига на новом языке — новая полка (books-<язык>, audio-<язык>), название — на этом языке
  const LANG_NAMES = { en: 'English', uk: 'Українська', ru: 'Русский', de: 'Deutsch', fr: 'Français', es: 'Español', it: 'Italiano', pl: 'Polski', pt: 'Português', tr: 'Türkçe', ja: '日本語', zh: '中文', ko: '한국어', la: 'Latina', nl: 'Nederlands', cs: 'Čeština' }
  source.shelves ??= []
  for (const g of source.games ?? []) {
    const m = /^(books|audio)-([a-z]{2,3})$/.exec(g.shelf || '')
    if (m && !source.shelves.some((s) => s.id === g.shelf)) {
      const mine = source.shelves.findIndex((s) => s.id === 'audio-mine')
      const shelf = { id: g.shelf, title: LANG_NAMES[m[2]] || m[2] }
      if (m[1] === 'audio' && mine >= 0) source.shelves.splice(mine, 0, shelf) // языки — перед «Моими аудиокнигами»
      else source.shelves.push(shelf)
    }
  }
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
    for (const field of [...(g.kind === 'book' ? ['title', 'genre', 'keys', 'text', 'author', 'lang'] : g.kind === 'audio' ? ['title', 'genre', 'keys', 'author', 'chapters'] : g.kind === 'audio-mine' ? ['title', 'genre', 'about', 'keys'] : ['title', 'genre', 'about', 'about_en', 'keys', ...(g.kind === 'board' ? ['board'] : g.kind === 'web' ? ['page'] : g.kind === 'pane' ? ['engine'] : ['rom'])])]) if (!g[field]) fail(`${where}: нет поля ${field}`)
    if (/[А-Яа-яЁё]/.test(g.about_en)) fail(`${where}: в about_en русские буквы — нужно английское описание`)
    const license = g.license ?? {}
    for (const field of ['name', 'author', 'source']) if (!license[field]) fail(`${where}: в лицензии нет поля ${field}`)

    // Браузерная игра — своя страница: папка игры целиком в web-games/<id>/, окно открывает её в рамке
    if (g.kind === 'web') {
      // Скачанная игра (download): файлы архива поверх своей папки игры — в ней лицензии и заметка о сборке
      const folder = path.dirname(path.join(content, g.page))
      const prepared = g.download ? prepare(root, g, where) : null
      const folders = [folder, ...(prepared ? [prepared] : [])].filter((f) => fs.existsSync(f))
      if (!folders.some((f) => fs.existsSync(path.join(f, path.basename(g.page))))) fail(`${where}: нет страницы игры ${g.page}`)
      if (g.isolated !== undefined && g.isolated !== true) fail(`${where}: isolated — только true`)
      if (g.offline !== undefined && g.offline !== true) fail(`${where}: offline — только true`)
      if (g.mouse !== undefined && g.mouse !== true) fail(`${where}: mouse — только true`)
      const walk = (base, dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) walk(base, full)
          else {
            if (fs.statSync(full).size > MAX_FILE) fail(`${where}: файл ${entry.name} больше 25 МиБ`)
            // Никаких счётчиков и аналитики в чужих играх: игроки Arcade не должны уходить в чужие аккаунты
            if (/\.(html?|js)$/i.test(entry.name) && /google-analytics|googletagmanager|_gaq\b|gtag\(|cloudflareinsights/.test(fs.readFileSync(full, 'utf8'))) {
              fail(`${where}: в ${path.relative(base, full)} счётчик аналитики — уберите его`)
            }
            const to = path.join(out, 'web-games', g.id, path.relative(base, full))
            if (fs.existsSync(to)) fail(`${where}: ${path.relative(base, full)} есть и в архиве, и в папке игры`)
            if (base === prepared) place(full, to)
            else copy(full, to)
          }
        }
      }
      for (const f of folders) walk(f, f)
      // Свои скрипты Arcade — в страницу игры, перед её первым скриптом (у OpenTTD — графика OpenGFX до старта).
      // Каждый следующий встаёт перед предыдущим, поэтому склейка кусков (arcade-parts.js) — последней в списке
      const inject = [...(g.inject ?? []), ...(prepared && fs.existsSync(path.join(prepared, 'arcade-parts.js')) ? ['arcade-parts.js'] : [])]
      for (const script of inject) {
        if (!folders.some((f) => fs.existsSync(path.join(f, script)))) fail(`${where}: нет скрипта ${script}`)
        const pageOut = path.join(out, 'web-games', g.id, path.basename(g.page))
        const html = fs.readFileSync(pageOut, 'utf8')
        const at = html.search(/<script[^>]*\ssrc=/i)
        if (at < 0) fail(`${where}: в странице игры нет подключаемого скрипта — некуда вставить ${script}`)
        fs.rmSync(pageOut) // вдруг это жёсткая ссылка в кеш (place) — пишем новый файл, кеш не трогаем
        fs.writeFileSync(pageOut, `${html.slice(0, at)}<script src="${script}"></script>${html.slice(at)}`)
      }
      // В одной сборке бывает несколько игр с одноимёнными readme (ScummVM) — тогда к имени добавляется папка: sky-readme.txt
      const names = (license.files ?? []).map((file) => path.basename(file))
      const files = (license.files ?? []).map((file, i) => {
        const from = path.join(content, file)
        if (!fs.existsSync(from)) fail(`${where}: нет файла лицензии ${file}`)
        const name = names.filter((n) => n === names[i]).length > 1 ? `${path.basename(path.dirname(file))}-${names[i]}` : names[i]
        copy(from, path.join(out, 'licenses', g.id, name))
        return { name, url: `licenses/${g.id}/${name}` }
      })
      games[g.id] = {
        ...(g.shelf ? { shelf: g.shelf } : {}), // полка во вкладке группы: шутеры, гонки, стратегии, настольные
        // Игре нужна захваченная мышь (шутер): мод открывает её окном браузера, а не во встроенном браузере Claude
        ...(g.mouse ? { mouse: true } : {}),
        // Cloudflare отвечает на …/index.html переходом на папку — сразу даём адрес папки
        console: g.console, kind: 'web', page: `web-games/${g.id}/${path.basename(g.page) === 'index.html' ? '' : path.basename(g.page).replace(/\.html?$/i, '')}`, title: g.title, genre: g.genre, about: g.about, about_en: g.about_en, keys: g.keys,
        credit: `${g.title} \u00a9 ${license.author}, ${license.name}`,
        license: { name: license.name, author: license.author, source: license.source, commit: license.commit ?? null, files },
      }
      continue
    }
    // Книга — book.json (главы и абзацы): его читают и окно, и панель мода; собирает его tools/books/build.mjs
    if (g.kind === 'book') {
      const textPath = path.join(content, g.text)
      if (!fs.existsSync(textPath)) fail(`${where}: нет файла книги ${g.text} — собери книги: node tools/books/build.mjs`)
      let book
      try {
        book = JSON.parse(fs.readFileSync(textPath, 'utf8'))
      } catch {
        fail(`${where}: ${g.text} — не JSON`)
      }
      if (!Array.isArray(book.chapters) || !book.chapters.length || !book.chapters.every((c) => typeof c.title === 'string' && Array.isArray(c.paragraphs))) fail(`${where}: в ${g.text} нет глав с текстом`)
      if (fs.statSync(textPath).size > MAX_FILE) fail(`${where}: ${g.text} больше 25 МиБ`)
      copy(textPath, path.join(out, 'books', g.id, 'book.json'))
      const files = (license.files ?? []).map((file) => {
        const from = path.join(content, file)
        if (!fs.existsSync(from)) fail(`${where}: нет файла лицензии ${file}`)
        copy(from, path.join(out, 'licenses', g.id, path.basename(file)))
        return { name: path.basename(file), url: `licenses/${g.id}/${path.basename(file)}` }
      })
      const words = book.chapters.reduce((n, c) => n + c.paragraphs.reduce((k, p) => k + String(p).split(/\s+/).length, 0), 0)
      games[g.id] = {
        ...(g.shelf ? { shelf: g.shelf } : {}), // полка — язык книги
        console: g.console, kind: 'book', text: `books/${g.id}/book.json`, title: g.title, author: g.author, lang: g.lang, year: g.year ?? null,
        genre: g.genre, about: g.about ?? '', about_en: g.about_en ?? '', keys: g.keys, chapters: book.chapters.length, words,
        credit: `${g.author} — «${g.title}»${g.year > 0 ? `, ${g.year}` : ''} · ${license.name}`,
        license: { name: license.name, author: license.author, source: license.source, commit: null, files },
      }
      continue
    }
    // Настольная игра — без ROM: доска, правила и сеть — страница board.js
    // Аудиокнига: главы — https-адреса на archive.org (LibriVox хранит звук там), длительность — секунды
    if (g.kind === 'audio') {
      if (!Array.isArray(g.chapters) || !g.chapters.length || g.chapters.length > 400) fail(`${where}: нужно от 1 до 400 глав`)
      for (const c of g.chapters) {
        if (!c || typeof c.title !== 'string' || !c.title) fail(`${where}: у главы нет названия`)
        if (!/^https:\/\/([a-z0-9-]+\.)*archive\.org\//.test(c.url || '')) fail(`${where}: адрес главы «${c.title}» — не https на archive.org`)
        if (c.seconds !== undefined && !(Number.isInteger(c.seconds) && c.seconds >= 0)) fail(`${where}: длительность главы «${c.title}» — не целое число секунд`)
      }
      games[g.id] = {
        ...(g.shelf ? { shelf: g.shelf } : {}),
        console: g.console, kind: 'audio', title: g.title, author: g.author, reader: g.reader || '', lang: g.lang, year: g.year, genre: g.genre, about: g.about || '', about_en: g.about_en || '', keys: g.keys,
        chapters: g.chapters.map((c) => ({ title: c.title, url: c.url, ...(c.seconds !== undefined ? { seconds: c.seconds } : {}) })),
        credit: `${g.title} — ${g.author}${g.reader ? `, читает ${g.reader}` : ''} · LibriVox, ${license.name}`,
        license: { name: license.name, author: license.author, source: license.source, files: [] },
      }
      continue
    }
    if (g.kind === 'audio-mine') {
      games[g.id] = { ...(g.shelf ? { shelf: g.shelf } : {}), console: g.console, kind: 'audio-mine', title: g.title, genre: g.genre, about: g.about, about_en: g.about_en || '', keys: g.keys }
      continue
    }

    // Своя игра (Flappy Arcade): движок — файл мода hooks/<engine>.js, в окне — тот же файл (dist/<engine>.js)
    if (g.kind === 'pane') {
      if (!['flappy'].includes(g.engine)) fail(`${where}: неизвестный движок ${g.engine}`)
      games[g.id] = {
        ...(g.shelf ? { shelf: g.shelf } : {}),
        console: g.console, kind: 'pane', engine: g.engine, title: g.title, genre: g.genre, about: g.about, about_en: g.about_en, keys: g.keys,
        credit: `${g.title} \u00a9 ${license.author}, ${license.name}`,
        license: { name: license.name, author: license.author, source: license.source, files: [] },
      }
      continue
    }

    if (g.kind === 'board') {
      if (!['chess', 'checkers', 'reversi', 'go'].includes(g.board)) fail(`${where}: неизвестная настольная игра ${g.board}`)
      const files = (license.files ?? []).map((file) => {
        const from = path.join(content, file)
        if (!fs.existsSync(from)) fail(`${where}: нет файла лицензии ${file}`)
        copy(from, path.join(out, 'licenses', g.id, path.basename(file)))
        return { name: path.basename(file), url: `licenses/${g.id}/${path.basename(file)}` }
      })
      games[g.id] = {
        ...(g.shelf ? { shelf: g.shelf } : {}), // полка во вкладке группы: шутеры, гонки, стратегии, настольные
        console: g.console, kind: 'board', board: g.board, title: g.title, genre: g.genre, about: g.about, about_en: g.about_en, keys: g.keys,
        credit: `${g.title} \u00a9 ${license.author}, ${license.name}`,
        license: { name: license.name, author: license.author, source: license.source, commit: license.commit ?? null, files },
      }
      continue
    }
    const romPath = path.join(content, g.rom)
    if (!fs.existsSync(romPath)) fail(`${where}: нет файла ${g.rom}`)
    const bytes = fs.readFileSync(romPath)
    if (bytes.length > MAX_FILE) fail(`${where}: файл больше 25 МиБ — для Pages нужен R2`)
    // Файл должен быть игрой своей приставки: Денди — заголовок iNES, Mega Drive — метка SEGA в заголовке картриджа
    if (g.console === 'nes' && bytes.subarray(0, 4).toString('latin1') !== 'NES\x1a') fail(`${where}: это не ROM Денди (нет заголовка iNES)`)
    if (g.console === 'sega' && !['SEGA'].includes(bytes.subarray(0x100, 0x104).toString('latin1')) && bytes.subarray(0x101, 0x105).toString('latin1') !== 'SEGA') {
      fail(`${where}: это не ROM Sega Mega Drive (нет метки SEGA в заголовке)`)
    }
    // Master System — метка TMR SEGA в заголовке картриджа
    const tmr = [0x7ff0, 0x3ff0, 0x1ff0].some((o) => bytes.length >= o + 8 && bytes.subarray(o, o + 8).toString('latin1') === 'TMR SEGA')
    // У части картриджей метки нет — тогда эмулятор узнаёт приставку по расширению, и оно должно совпадать
    const extOk = path.extname(romPath).slice(1).toLowerCase() === g.console
    if (g.console === 'sms' && !tmr && !extOk) fail(`${where}: это не ROM Master System (нет метки TMR SEGA и расширение не .sms)`)
    // Doom — WAD в .zip: эмулятор распакует его сам
    // Сетевой Doom (doom-wasm) берёт сам WAD, без архива: метка IWAD в начале
    if (g.console === 'doom' && g.net && bytes.subarray(0, 4).toString('latin1') !== 'IWAD') fail(`${where}: для сетевого движка нужен сам файл .wad`)
    if (g.engine && g.engine !== 'heretic') fail(`${where}: неизвестный движок ${g.engine}`)
    if (g.console === 'doom' && !g.net && (bytes.subarray(0, 4).toString('latin1') !== 'PK\x03\x04' || !bytes.includes(Buffer.from('.wad')))) {
      fail(`${where}: игра для Doom должна быть .zip, где лежит .wad`)
    }
    // PlayStation — диск в .zip, внутри .cue и .bin: эмулятор распакует его сам
    if (g.console === 'psx' && (bytes.subarray(0, 4).toString('latin1') !== 'PK\x03\x04' || !bytes.includes(Buffer.from('.cue')))) {
      fail(`${where}: диск PlayStation должен быть .zip, где лежат .cue и .bin`)
    }
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    const ext = path.extname(g.rom) || '.bin'
    const url = `files/${sha256}${ext}`
    copy(romPath, path.join(out, url))
    // Копия в base64 нужна только моду для игры Денди в панели; Sega и PlayStation идут в окне браузера
    if (g.console === 'nes') fs.writeFileSync(path.join(out, `${url}.b64`), bytes.toString('base64'))

    const licenseFiles = (license.files ?? []).map((file) => {
      const from = path.join(content, file)
      if (!fs.existsSync(from)) fail(`${where}: нет файла лицензии ${file}`)
      const name = path.basename(file)
      copy(from, path.join(out, 'licenses', g.id, name))
      return { name, url: `licenses/${g.id}/${name}` }
    })

    games[g.id] = {
      ...(g.shelf ? { shelf: g.shelf } : {}), // полка во вкладке группы: шутеры, гонки, стратегии, настольные
      console: g.console,
      title: g.title,
      genre: g.genre,
      about: g.about,
      about_en: g.about_en,
      keys: g.keys,
      credit: `${g.title} \u00a9 ${license.author}, ${license.name}`,
      ...(g.score
        ? { score: { label: g.score.label, parts: g.score.parts.map(([a, weight]) => [address(a, where), weight]) } }
        : {}),
      rom: { url, base64: `${url}.b64`, sha256, size: bytes.length },
      ...(g.noncommercial ? { noncommercial: true } : {}), // графика или уровни только для некоммерческого использования
      ...(g.net ? { net: g.net } : {}), // сетевой движок: doom — FreeDM, heretic — Blasphemer, heretic-dm — BlasphDM
      ...(g.engine ? { engine: g.engine } : {}), // heretic — движок heretic-wasm вместо doom-wasm
      license: { name: license.name, author: license.author, source: license.source, commit: license.commit ?? null, files: licenseFiles },
    }
  }

  // Группы вкладок и полки: «Игры» — шутеры, гонки, стратегии, настольные (у каждой игры группы — своя полка)
  const groups = (source.groups ?? []).map((g) => ({ id: g.id, title: g.title, ...(g.about ? { about: g.about } : {}) }))
  const shelves = (source.shelves ?? []).map((s) => ({ id: s.id, title: s.title }))
  for (const c of consoles) if (c.group && !groups.some((g) => g.id === c.group)) fail(`приставка ${c.id}: нет группы ${c.group}`)
  for (const [id, g] of Object.entries(games)) {
    const c = consoles.find((x) => x.id === g.console)
    if (c?.group && !shelves.some((s) => s.id === g.shelf)) fail(`игра ${id}: у игр группы ${c.group} должна быть полка (shelf) из списка shelves`)
  }
  // Описания на остальных 11 языках — переводы английского описания (раздел about в web/locales/<язык>.json). Перевода
  // нет или английское описание поменялось — окно и мод покажут английское
  const locales = readLocales(root)
  for (const g of Object.values(games)) {
    if (!g.about_en) continue
    const translated = Object.entries(locales).filter(([, L]) => typeof L.about?.[g.about_en] === 'string' && L.about[g.about_en])
    if (translated.length) g.about_i18n = Object.fromEntries(translated.map(([lang, L]) => [lang, L.about[g.about_en]]))
  }
  // «Поддержать проект» — добровольно; ссылку видят окно и мод, менять её — здесь, в каталоге
  const support = source.support && /^https:\/\//.test(source.support.url ?? '') ? { url: source.support.url, title: source.support.title ?? '' } : null
  const catalog = { version: 1, built: now.toISOString(), consoles, groups, shelves, ...(support ? { support } : {}), games }
  fs.writeFileSync(path.join(out, 'catalog.json'), `${JSON.stringify(catalog, null, 2)}\n`)
  // Каналы для YouTube в моде — как есть, после проверки
  const channels = checkChannels(JSON.parse(fs.readFileSync(path.join(content, 'channels.json'), 'utf8')))
  fs.writeFileSync(path.join(out, 'channels.json'), `${JSON.stringify(channels)}\n`)
  // Ленты статей и подкастов — для мода и страниц /read и /listen
  const feeds = checkFeeds(JSON.parse(fs.readFileSync(path.join(content, 'feeds.json'), 'utf8')), new Set(channels.directions.map((d) => d.id)))
  fs.writeFileSync(path.join(out, 'feeds.json'), `${JSON.stringify(feeds)}\n`)
  // Каталог Twitch Worker берёт из content/ сам — здесь только проверка
  checkTwitch(JSON.parse(fs.readFileSync(path.join(content, 'twitch.json'), 'utf8')), new Set(channels.directions.map((d) => d.id)))

  // Окно Arcade и лицензии сторонних библиотек
  // Движки своих игр — из мода, как есть: export убирается, движок — в window.ArcadeFlappy
  const flappySource = path.join(root, '..', 'mod', 'hooks', 'flappy.js')
  if (fs.existsSync(flappySource)) {
    const code = fs.readFileSync(flappySource, 'utf8').replace(/^export \{[^}]*\}\s*$/m, '')
    fs.writeFileSync(path.join(out, 'flappy.js'), `// Собрано из mod/hooks/flappy.js\n;(() => {\n${code}\nwindow.ArcadeFlappy = { createFlappy, daySeed }\n})()\n`)
  }
  for (const file of fs.readdirSync(path.join(root, 'web'))) {
    const from = path.join(root, 'web', file)
    if (fs.statSync(from).isDirectory()) continue // locales/ — вставляются в i18n.js ниже
    copy(from, path.join(out, file))
  }
  // Переводы окна на 11 языков — прямо в i18n.js: одна загрузка, без лишних запросов. Описания игр — уже в каталоге
  const windowLocales = Object.fromEntries(Object.entries(locales).map(([lang, { about, ...rest }]) => [lang, rest]))
  const i18nOut = path.join(out, 'i18n.js')
  const i18nText = fs.readFileSync(i18nOut, 'utf8')
  if (!i18nText.includes('const LOCALES = {} /* LOCALES */')) fail('в web/i18n.js нет места для переводов: const LOCALES = {} /* LOCALES */')
  fs.writeFileSync(i18nOut, i18nText.replace('const LOCALES = {} /* LOCALES */', `const LOCALES = ${JSON.stringify(windowLocales)}`))
  copy(path.join(root, 'third_party', 'jsnes', 'LICENSE.txt'), path.join(out, 'licenses', 'jsnes', 'LICENSE.txt'))
  copyEmulatorJS(path.join(root, 'vendor', 'emulatorjs'), out)
  // Движок сетевого Doom (doom-wasm, GPL-2.0): собран в GitHub Actions; лицензия, заметка о сборке и исходники — в licenses/
  const doomWasm = path.join(root, 'vendor', 'doom-wasm')
  for (const name of ['websockets-doom.js', 'websockets-doom.wasm']) copy(path.join(doomWasm, name), path.join(out, 'doom-wasm', name))
  for (const name of fs.readdirSync(doomWasm).filter((n) => !n.startsWith('websockets-doom'))) copy(path.join(doomWasm, name), path.join(out, 'licenses', 'doom-wasm', name))
  // Движок Heretic (Blasphemer): doom-wasm + Chocolate Heretic, собран в GitHub Actions
  const hereticWasm = path.join(root, 'vendor', 'heretic-wasm')
  for (const name of ['websockets-heretic.js', 'websockets-heretic.wasm']) copy(path.join(hereticWasm, name), path.join(out, 'heretic-wasm', name))
  for (const name of fs.readdirSync(hereticWasm).filter((n) => !n.startsWith('websockets-heretic'))) copy(path.join(hereticWasm, name), path.join(out, 'licenses', 'heretic-wasm', name))
  // Шахматы — правила chess.js (BSD-2-Clause), модуль для страницы board.js
  copy(path.join(root, 'vendor', 'chess.js', 'chess.js'), path.join(out, 'vendor', 'chess', 'chess.js'))
  copy(path.join(root, 'vendor', 'chess.js', 'LICENSE.txt'), path.join(out, 'licenses', 'chess.js', 'LICENSE.txt'))
  // Stockfish 19 lite (GPL-3.0) — компьютер в шахматах: загрузчик и WebAssembly рядом, лицензия — к остальным
  for (const file of ['stockfish-19-lite-single.js', 'stockfish-19-lite-single.wasm']) copy(path.join(root, 'vendor', 'stockfish', file), path.join(out, 'vendor', 'stockfish', file))
  copy(path.join(root, 'vendor', 'stockfish', 'LICENSE.txt'), path.join(out, 'licenses', 'stockfish', 'LICENSE.txt'))
  // Bootstrap 5.3.2 (MIT) — оформление страницы Warzone 2100: с нашего сайта, а не с cdnjs (правка в каталоге)
  for (const file of ['bootstrap.min.css', 'bootstrap.bundle.min.js']) copy(path.join(root, 'vendor', 'bootstrap', file), path.join(out, 'vendor', 'bootstrap', file))
  copy(path.join(root, 'vendor', 'bootstrap', 'LICENSE.txt'), path.join(out, 'licenses', 'bootstrap', 'LICENSE.txt'))
  // Сетевая игра EmulatorJS — через наш сервер: вместо socket.io эмулятор получает нашу прослойку (web/netplay-io.js)
  copy(path.join(root, 'web', 'netplay-io.js'), path.join(out, 'emulatorjs', 'src', 'socket.io.min.js'))
  // Маппер 28 (Action 53) — общий с модом: из модуля мода делаем обычный скрипт для страницы
  const mapper28 = fs.readFileSync(path.join(root, '..', 'mod', 'hooks', 'mapper28.js'), 'utf8').replace(/^export /gm, '')
  fs.writeFileSync(path.join(out, 'mapper28.js'), `;(function () {\n'use strict'\n${mapper28}\ninstallMapper28(window.jsnes && window.jsnes.Mappers)\n})()\n`)
  // Игре на WebAssembly с потоками (isolated) нужен SharedArrayBuffer — только в изолированной странице (COOP + COEP).
  // Здесь — страница игры в рамке; окно с ней (/?game=<id>) изолирует worker/index.js, список там сверяют тесты.
  // Игра offline сама в сеть не ходит: fetch, XHR и WebSocket — только к сайту Arcade. Заголовок, а не <meta>: он
  // действует и на потоки игры (Warzone 2100 иначе спрашивает обновления у wz2100.net)
  const rules = (source.games ?? []).filter((g) => g.kind === 'web' && (g.isolated || g.offline)).map((g) => {
    const lines = [
      ...(g.isolated ? ['Cross-Origin-Embedder-Policy: require-corp', 'Cross-Origin-Opener-Policy: same-origin', 'Cross-Origin-Resource-Policy: same-origin'] : []),
      ...(g.offline ? ["Content-Security-Policy: connect-src 'self'"] : []),
    ]
    return `/web-games/${g.id}/*\n${lines.map((l) => `  ${l}\n`).join('')}`
  })
  fs.writeFileSync(path.join(out, '_headers'), HEADERS + rules.join(''))
  // Короткие адреса приставок: /sega — сразу вкладка Sega
  fs.writeFileSync(path.join(out, '_redirects'), [...catalog.consoles, ...catalog.groups].map((c) => `/${c.id} /?tab=${c.id} 302`).join('\n') + '\n')
  // Wrangler читает _headers как правила, но не выкладывает его как обычный файл
  fs.writeFileSync(path.join(out, '.assetsignore'), '_headers\n_redirects\n')
  return catalog
}

// Запуск из командной строки: node build.mjs [папка]
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = path.dirname(fileURLToPath(import.meta.url))
  const out = path.resolve(process.argv[2] ?? path.join(root, 'dist'))
  await download({ root })
  const catalog = build({ root, out })
  console.log(`Готово. Игр в каталоге: ${Object.keys(catalog.games).length}. Сайт — в ${out}`)
}
