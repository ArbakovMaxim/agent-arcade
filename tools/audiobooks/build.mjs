// Аудиокниги из LibriVox: для каждой книги из audiobooks.json — главы (ссылки на MP3 на archive.org), длительность и
// чтецы — через API LibriVox (https://librivox.org/api/info). Пишет site/content/audiobooks/index.json; сам звук не
// качаем — окно играет его прямо с archive.org. Книги LibriVox — общественное достояние.
//   node tools/audiobooks/build.mjs            — все книги со своим номером LibriVox
//   node tools/audiobooks/build.mjs <id> …     — только эти
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LIST = path.join(ROOT, 'tools', 'audiobooks', 'audiobooks.json')
const OUT = path.join(ROOT, 'site', 'content', 'audiobooks', 'index.json')
const UA = { 'User-Agent': 'agent-arcade/1.0 (+https://github.com/ArbakovMaxim/agent-arcade)' }
const ARCHIVE = /^https:\/\/([a-z0-9-]+\.)*archive\.org\//

const only = process.argv.slice(2)
const list = JSON.parse(fs.readFileSync(LIST, 'utf8'))
const previous = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
const result = new Map(previous.filter((e) => list.some((b) => b.id === e.id && b.librivox)).map((e) => [e.id, e]))
let failed = 0

for (const b of list) {
  if (only.length && !only.includes(b.id)) continue
  if (!b.librivox) {
    console.log(`– ${b.id}: нет номера LibriVox — пропускаю`)
    continue
  }
  try {
    const res = await fetch(`https://librivox.org/api/feed/audiobooks/?id=${encodeURIComponent(b.librivox)}&format=json&extended=1`, { headers: UA })
    if (!res.ok) throw new Error(`LibriVox ответил ${res.status}`)
    const data = await res.json()
    const book = Array.isArray(data.books) ? data.books[0] : data.books && Object.values(data.books)[0]
    if (!book) throw new Error(`в LibriVox нет книги ${b.librivox}`)
    const sections = [...(book.sections || [])].sort((x, y) => Number(x.section_number) - Number(y.section_number))
    if (!sections.length) throw new Error('у книги нет глав')
    const chapters = sections.map((s) => {
      const seconds = Number(s.playtime)
      return { title: String(s.title || `Глава ${s.section_number}`).trim(), url: String(s.listen_url || '').replace(/^http:\/\//, 'https://'), ...(Number.isInteger(seconds) && seconds > 0 ? { seconds } : {}) }
    })
    const bad = chapters.find((c) => !ARCHIVE.test(c.url))
    if (bad) throw new Error(`адрес главы «${bad.title}» — не на archive.org: ${bad.url}`)
    const readers = [...new Set(sections.flatMap((s) => (s.readers || []).map((r) => r.display_name)).filter(Boolean))]
    const author = b.author || (book.authors || []).map((a) => `${a.first_name || ''} ${a.last_name || ''}`.trim()).join(', ')
    const total = chapters.reduce((n, c) => n + (c.seconds || 0), 0)
    result.set(b.id, {
      id: b.id,
      title: b.title || book.title,
      author,
      lang: b.lang,
      genre: b.genre || 'аудиокнига',
      reader: b.reader || (readers.length === 1 ? readers[0] : readers.length ? 'разные чтецы' : ''),
      ...(b.year ? { year: b.year } : {}),
      ...(b.about ? { about: b.about } : {}),
      ...(b.about_en ? { about_en: b.about_en } : {}),
      source: book.url_librivox || `https://librivox.org/`,
      chapters,
    })
    const n = chapters.length
    const word = n % 10 === 1 && n % 100 !== 11 ? 'глава' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'главы' : 'глав'
    console.log(`✓ ${b.id}: ${n} ${word}, ${Math.round(total / 60)} мин, читает ${result.get(b.id).reader || '—'}`)
  } catch (err) {
    failed++
    console.log(`✗ ${b.id}: ${err.message}`)
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
const ordered = list.map((b) => result.get(b.id)).filter(Boolean)
fs.writeFileSync(OUT, `${JSON.stringify(ordered, null, 1)}\n`)
console.log(`Готово: аудиокниг в каталоге — ${ordered.length}${failed ? `, не собралось — ${failed}` : ''}. ${path.relative(ROOT, OUT)}`)
if (failed) process.exitCode = 1
