// Сборка книг каталога Arcade: скачивает книги из общественного достояния (Project Gutenberg — TXT,
// Викитека — EPUB через ws-export), разбирает общим разбором окна (site/web/book-format.js) и кладёт
// site/content/books/<id>/book.json и LICENSE.txt. Запуск: node tools/books/build.mjs [id ...]
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
// import() принимает только адреса file:// — на Windows обычный путь D:\… он не понимает
await import(pathToFileURL(path.join(ROOT, 'site', 'web', 'book-format.js')).href)
const F = globalThis.ArcadeBookFormat
const list = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'books', 'books.json'), 'utf8'))
const only = process.argv.slice(2)
const inflateRaw = async (d) => new Uint8Array(zlib.inflateRawSync(d))

const words = (c) => c.paragraphs.join(' ').split(/\s+/).length
// Оглавление в начале: подряд короткие строки
const tocLike = (c) => c.paragraphs.length >= 2 && c.paragraphs.every((p) => p.length <= 60) && words(c) < 150

// Викитека (ws-export, русская и украинская): служебная строка, главы о самом издании, сноски, «----» как продолжение текста
const WIKISOURCE_JUNK = /^(об этом электронном издании|про це електронне видання|about this digital edition|примечани[яе]|приміт(ки|ка)|см\.\s*также|див\.\s*також|оглавление|содержание|зміст|список редакц|джерела|версії роботи)/i
const EXPORTED = /^((Экспортировано|Загружено) из Викитеки|(Експортовано|Завантажено) з Вікіджерел|Exported from Wikisource|Downloaded from Wikisource)/i
// Выходные данные издательства и год-дата в начале книги
const IMPRINT = /(Головліт|Укрголовліт|Книгоспілка|Друкарня|Державне видавництво|Зам\.\s*№|Тираж|Наклад|Типографія|Типография|Бібліографічний опис|Видавництво|ВИДАННЯ|Ціна \d|^стор\.)/i
// Текст Викитеки о лицензии и навигация по частям
const WIKI_NOTE = /(суспільному надбанні|общественном достоянии|public domain|Автор помер у|Автор умер в|Ця робота|This work is)/i
const WIKI_NAV = /^(([IVXLC]+|\d+)\s*[•·|]\s*)+([IVXLC]+|\d+)$|^(Частини|Глави|Розділи|Зміст|Части|Главы):?$/i
const EDITORIAL = /^(Впервые напечатано|Вперше надруковано|Впервые опубликовано|Вперше опубліковано)/i
function cleanWikisource(book) {
  let chapters = book.chapters.map((c) => ({
    title: c.title.replace(/\.?\s*автор\s+.+$/i, '').trim() || book.title,
    paragraphs: c.paragraphs
      .filter((p) => !EXPORTED.test(p) && !p.startsWith('↑') && !WIKI_NAV.test(p) && !(p.length < 400 && WIKI_NOTE.test(p)) && !(p.length < 200 && IMPRINT.test(p)))
      .map((p) => p.replace(/\[\d{1,3}\]/g, '').replace(/[ \t]+([,.;:!?»)])/g, '$1').trim())
      .filter(Boolean),
  }))
  // Сноска редакции в начале главы («1 Глава эта не включена… — Ред.») — и её цифра в конце заголовка
  for (const c of chapters) {
    const n = (c.title.match(/\s(\d{1,2})$/) || [])[1]
    if (n && c.paragraphs[0] && c.paragraphs[0].startsWith(`${n} `) && /Ред\.?\s*$/.test(c.paragraphs[0])) {
      c.paragraphs.shift()
      c.title = c.title.slice(0, -n.length).trim()
    }
  }
  chapters = chapters.filter((c) => c.paragraphs.length && !WIKISOURCE_JUNK.test(c.title) && !/список редакций|словни(к|чок)/i.test(c.title) && !c.paragraphs.every((p) => p.startsWith('↑')))
  const merged = []
  for (const c of chapters) {
    if (/^[-—–*\s]+$/.test(c.title) && merged.length) merged.at(-1).paragraphs.push(...c.paragraphs)
    else merged.push(c)
  }
  while (merged.length > 1 && tocLike(merged[0])) merged.shift()
  // Начало первой главы: год-дата («1911») и выходные данные («ХАРКІВ КНИГОСПІЛКА 1925», «Укрголовліт № …»)
  const first = merged[0]
  while (first && first.paragraphs.length > 1 && (/^\d{4}(\s*(р|г)\.?)?$/.test(first.paragraphs[0]) || IMPRINT.test(first.paragraphs[0]) || (first.paragraphs[0].length < 40 && first.paragraphs[0] === first.paragraphs[0].toUpperCase() && /[А-ЯЁЇІЄҐ]{3}/.test(first.paragraphs[0])))) first.paragraphs.shift()
  // Хвост: служебные строки электронных библиотек
  const last = merged.at(-1)
  while (last && last.paragraphs.length > 1 && (EDITORIAL.test(last.paragraphs.at(-1)) || /(https?:\/\/|^Версия \d|Сверка произведена|Электронная Библиотека)/i.test(last.paragraphs.at(-1)))) last.paragraphs.pop()
  return { ...book, chapters: merged }
}

// Project Gutenberg: служебные абзацы, сноски изданий, титул и оглавление до первой настоящей главы, «THE END» и
// выходные данные типографии в конце
const GUTENBERG_JUNK = /(Project Gutenberg|^Produced by|\btranscriber\b|^This e-?text was|^The book cover and spine|^E-?text prepared by|^Updated editions will replace|^Note:\s.*(etext|e-text|ebook)|^\S+\.(jpe?g|png|gif)(\s*\(\d+K\))?$|^Full Size$|^\d+ \(return\))/i
function cleanGutenberg(book) {
  let chapters = book.chapters
    .filter((c) => !/transcriber['’]?s? notes?|^(table of )?contents\b|^(list of )?illustrations\b/i.test(c.title))
    .map((c) => ({
      ...c,
      paragraphs: c.paragraphs
        .filter((p) => !GUTENBERG_JUNK.test(p) && !/^\[\d{1,3}\]/.test(p)) // сноски изданий: текст сноски — долой
        .map((p) => p.replace(/\s*\[\d{1,3}\]/g, '').replace(/\s*\(return\)/g, '').trim()) // и её номер в тексте
        .filter(Boolean),
    }))
    .filter((c) => c.paragraphs.length)
  // Оглавление внутри первых глав: «CONTENTS» и короткие строки за ним
  for (const c of chapters.slice(0, 3)) {
    const at = c.paragraphs.findIndex((p) => /^(table of )?contents\.?$/i.test(p))
    if (at < 0) continue
    let end = at + 1
    while (end < c.paragraphs.length && c.paragraphs[end].length < 80) end++
    c.paragraphs.splice(at, end - at)
  }
  // Титул в начале первой главы: название заглавными, «by …»
  if (chapters[0]) {
    const p = chapters[0].paragraphs
    while (p.length > 1 && p[0].length < 80 && (/^by\s/i.test(p[0]) || (p[0] === p[0].toUpperCase() && /[A-Z]{3}/.test(p[0])))) p.shift()
  }
  chapters = chapters.filter((c) => c.paragraphs.length)
  // Титул в начале: короткая глава из одних коротких строк (название, автор, издатель) или с «Contents»
  const titlePage = (c) => tocLike(c) || /\bcontents\b/i.test(c.paragraphs.join(' ').slice(0, 400)) || (words(c) < 150 && c.paragraphs.every((p) => p.length < 80 && !p.includes('\n')))
  while (chapters.length > 1 && titlePage(chapters[0])) chapters.shift()
  const last = chapters.at(-1)
  // Выходные данные типографии («CHISWICK PRESS: …») и «THE END»
  while (last && last.paragraphs.length > 1 && last.paragraphs.at(-1).length < 200 && /(PRESS|PRINTED BY|PRINTERS|LONDON:|NEW YORK:|BOSTON:)/.test(last.paragraphs.at(-1))) last.paragraphs.pop()
  if (last && /^THE END\.?$/i.test(last.paragraphs.at(-1) || '')) last.paragraphs.pop()
  return { ...book, chapters }
}

// Страница Викитеки по названию и автору — через поиск (если в books.json её ещё нет); найденное записываем в books.json
async function findPage(b) {
  const lang = b.source.lang || b.lang
  const surname = b.author.split(' ').at(-1)
  const api = `https://${lang}.wikisource.org/w/api.php?action=query&list=search&format=json&srnamespace=0&srlimit=10&srsearch=${encodeURIComponent(`${b.title} ${surname}`)}`
  const found = (await (await fetch(api, { headers: UA })).json())?.query?.search ?? []
  const norm = (s) => s.toLowerCase().replace(/[«»"'’.,!?]/g, '').trim()
  const exact = found.find((r) => norm(r.title).startsWith(norm(b.title)) && r.title.includes(surname))
  const pick = exact ?? found.find((r) => norm(r.title).startsWith(norm(b.title))) ?? found[0]
  if (!pick) throw new Error('в Викитеке не нашлось страницы — укажи page в books.json вручную')
  return pick.title
}
const UA = { 'User-Agent': 'Arcade books builder (https://github.com/ArbakovMaxim/agent-arcade)' }

function sourceUrl(src) {
  if (src.kind === 'gutenberg') return { url: `https://www.gutenberg.org/ebooks/${src.id}.epub.noimages`, name: 'book.epub', page: `https://www.gutenberg.org/ebooks/${src.id}` }
  if (src.kind === 'wikisource') {
    const lang = src.lang || 'ru'
    const page = encodeURIComponent(src.page)
    // В LICENSE.txt — читаемая ссылка (кириллицей), скачивание — по закодированной
    return { url: `https://ws-export.wmcloud.org/?format=epub&lang=${lang}&page=${page}`, name: 'book.epub', page: `https://${lang}.wikisource.org/wiki/${src.page.replace(/ /g, '_')}` }
  }
  throw new Error(`неизвестный источник ${src.kind}`)
}

let failed = 0
let pinned = 0
const index = []
for (const b of list) {
  if (only.length && !only.includes(b.id)) continue
  try {
    if (b.source.kind === 'wikisource' && !b.source.page) {
      b.source.page = await findPage(b)
      pinned++
      console.log(`  ! ${b.id}: страница Викитеки найдена поиском — «${b.source.page}». Поиск ошибается (списки изданий, чужие тексты): проверь и при необходимости впиши page вручную`)
    }
  } catch (err) {
    failed++
    console.log(`✗ ${b.id}: ${err.message}`)
    continue
  }
  const src = sourceUrl(b.source)
  try {
    const response = await fetch(src.url, { headers: UA })
    if (!response.ok) throw new Error(`источник ответил ${response.status}`)
    const bytes = new Uint8Array(await response.arrayBuffer())
    const parsed = await F.parse(bytes, src.name, { title: b.title, author: b.author, lang: b.lang, inflateRaw })
    // Gutenberg: название из шапки — та ли книга (номер в books.json легко перепутать)
    let mismatch = ''
    if (b.source.kind === 'gutenberg') {
      const real = (parsed.title || '').trim()
      const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').replace(/\b(the|a|an|of|and)\b/g, ' ').replace(/\s+/g, ' ').trim()
      if (real && !norm(real).includes(norm(b.title).split(' ').slice(0, 3).join(' '))) mismatch = `в шапке Gutenberg другое название: «${real}» — проверь номер книги`
    }
    // Название и автор — из списка: у источников они бывают с лишним («… (Пушкин)», латиницей)
    const raw = { title: b.title, author: b.author, lang: b.lang, chapters: parsed.chapters }
    const book = b.source.kind === 'wikisource' ? cleanWikisource(raw) : cleanGutenberg(raw)
    const stats = F.check(book)
    const sample = book.chapters.map((c) => c.paragraphs.join(' ')).join(' ').slice(0, 20000)
    const warnings = []
    if (b.lang === 'ru' && /[ѣѳѵі]/i.test(sample)) warnings.push('старая орфография (ѣ, і) — найди версию в современной орфографии')
    if (stats.chapters < 2) warnings.push('всего одна глава — проверь, нашлись ли заголовки')
    if (stats.words < 2000) warnings.push('меньше 2000 слов — похоже, скачалась не вся книга')
    if (mismatch) warnings.push(mismatch)
    // Проверка качества: остатки служебного текста, склеенная проза, книга без настоящих глав — в каталог не идёт
    const all = book.chapters.flatMap((c) => c.paragraphs)
    const junk = all.find((p) => /(Project Gutenberg|transcriber|Вікіджерел|Викитек|Wikisource|суспільному надбанні|Тираж|Друкарня|\.jpe?g\b)/i.test(p))
    const longest = Math.max(0, ...all.filter((p) => !p.includes('\n')).map((p) => p.length))
    const parts = book.chapters.filter((c) => /^(Part|Частина|Часть) \d+$/.test(c.title)).length
    const fails = []
    if (junk) fails.push(`служебный текст: «${junk.slice(0, 80)}»`)
    if (longest > 6000) fails.push(`абзац прозы на ${longest} знаков — похоже, склеены абзацы`)
    if (stats.words > 15000 && book.chapters.length < 3) fails.push(`${stats.words} слов и всего ${book.chapters.length} глав`)
    if (parts > book.chapters.length / 2) fails.push(`нет настоящих глав: ${parts} из ${book.chapters.length} — «Part N»`)
    if (fails.length) {
      fs.rmSync(path.join(ROOT, 'site', 'content', 'books', b.id), { recursive: true, force: true })
      failed++
      console.log(`✗ ${b.id}: не прошла проверку качества — ${fails.join('; ')}`)
      continue
    }
    const dir = path.join(ROOT, 'site', 'content', 'books', b.id)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'book.json'), JSON.stringify(book))
    fs.writeFileSync(
      path.join(dir, 'LICENSE.txt'),
      [
        `${b.author} — «${b.title}» (${b.year}).`,
        'Текст произведения — общественное достояние: автор умер больше 70 лет назад, книга издана до 1930 года.',
        `Источник: ${src.page}`,
        b.source.kind === 'wikisource' ? 'Оформление текста в Викитеке — CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/), участники Викитеки.' : '',
        'В Arcade текст переведён в простой вид (главы и абзацы) без изменений содержания.',
      ]
        .filter(Boolean)
        .join('\n') + '\n',
    )
    const kb = Math.round(fs.statSync(path.join(dir, 'book.json')).size / 1024)
    index.push({ id: b.id, title: b.title, author: b.author, lang: b.lang, year: b.year, genre: b.genre, ...(b.about ? { about: b.about } : {}), ...(b.about_en ? { about_en: b.about_en } : {}), source: src.page })
    console.log(`✓ ${b.id}: глав ${stats.chapters}, слов ${stats.words}, ${kb} КБ${warnings.length ? `\n  ! ${warnings.join('\n  ! ')}` : ''}`)
  } catch (err) {
    failed++
    console.log(`✗ ${b.id}: ${err.message} (${src.url})`)
  }
}
// Список собранных книг — по нему сайт заводит книги в каталог; найденные страницы Викитеки — в books.json
// Обновляем точечно: собранные заменяем, книги, которых больше нет в books.json, убираем
const indexPath = path.join(ROOT, 'site', 'content', 'books', 'index.json')
const previous = fs.existsSync(indexPath) ? JSON.parse(fs.readFileSync(indexPath, 'utf8')) : []
const merged = new Map(previous.filter((e) => list.some((b) => b.id === e.id)).map((e) => [e.id, e]))
for (const e of index) merged.set(e.id, e)
const ordered = list.map((b) => merged.get(b.id)).filter(Boolean)
fs.mkdirSync(path.dirname(indexPath), { recursive: true })
fs.writeFileSync(indexPath, JSON.stringify(ordered, null, 1) + '\n')
if (pinned) fs.writeFileSync(path.join(ROOT, 'tools', 'books', 'books.json'), JSON.stringify(list, null, 1) + '\n')
console.log(`\nСобрано сейчас: ${index.length}, всего в каталоге книг: ${ordered.length} из ${list.length}`)
if (failed) {
  console.log(`\nНе собрано книг: ${failed}. Для Викитеки проверь точное название страницы на ru.wikisource.org и поправь tools/books/books.json.`)
  process.exitCode = 1
}
