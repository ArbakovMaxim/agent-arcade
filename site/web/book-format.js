// Книги Arcade: разбор EPUB, FB2 и TXT в общий вид — { title, author, lang, chapters: [{ title, paragraphs }] }.
// Один и тот же файл работает в браузере (окно Arcade: свои книги) и в Node (tools/books: сборка книг каталога).
// Без библиотек: свой разбор ZIP для EPUB, распаковка — функцией inflateRaw, которую передаёт вызывающий
// (в браузере — DecompressionStream, в Node — zlib.inflateRawSync).
;(function (root) {
  'use strict'

  const ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', shy: '',
    mdash: '—', ndash: '–', hellip: '…', laquo: '«', raquo: '»', ldquo: '“', rdquo: '”', bdquo: '„', lsquo: '‘', rsquo: '’',
  }
  const decode = (s) =>
    s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
      if (e[0] === '#') return String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      return ENTITIES[e.toLowerCase()] ?? m
    })
  // Текст элемента: теги долой, переносы <br> — пробелом, пробелы — по одному
  const clean = (html) =>
    decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(p|div|li|h[1-6]|title|subtitle|v)\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, ''))
      .split('\n')
      .map((line) => line.replace(/\s+/g, ' ').trim())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n') // пустая строка — граница строфы
      .trim()
  // Текст с переносами: длинные строки — отдельные абзацы прозы; короткие — стих: строфа — один абзац,
  // строфа длиннее 40 строк (стихотворная драма без пустых строк) — кусками по 20 строк, чтобы закладка была точной
  const pieces = (text) => {
    if (!text.includes('\n')) return [text]
    const out = []
    for (const stanza of text.split(/\n\n+/)) {
      const lines = stanza.split('\n').filter(Boolean)
      if (!lines.length) continue
      const avg = lines.reduce((n, l) => n + l.length, 0) / lines.length
      if (avg > 90) out.push(...lines)
      else if (lines.length > 40) for (let i = 0; i < lines.length; i += 20) out.push(lines.slice(i, i + 20).join('\n'))
      else out.push(lines.join('\n'))
    }
    return out
  }

  // Последовательность заголовков и абзацев → главы. Подряд идущие заголовки — одно название главы
  function toChapters(blocks, fallbackTitle) {
    const chapters = []
    let current = null
    for (const b of blocks) {
      if (b.head) {
        const title = b.text.replace(/\n/g, '. ')
        if (current && current.paragraphs.length === 0) current.title = `${current.title}. ${title}`
        else chapters.push((current = { title, paragraphs: [] }))
      } else {
        if (!current) chapters.push((current = { title: fallbackTitle, paragraphs: [] }))
        current.paragraphs.push(...pieces(b.text))
      }
    }
    return chapters.filter((c) => c.paragraphs.length)
  }

  // Слишком длинная глава без деления (весь TXT одним куском) — режем на части по 80 абзацев
  function split(chapters, partWord) {
    const out = []
    for (const c of chapters) {
      if (c.paragraphs.length <= 400) out.push(c)
      else for (let i = 0; i < c.paragraphs.length; i += 80) out.push({ title: `${partWord} ${out.length + 1}`, paragraphs: c.paragraphs.slice(i, i + 80) })
    }
    return out
  }

  // --- TXT ----------------------------------------------------------------------------------------------------------
  const HEADING = [
    /^(chapter|part|book|stave|adventure|epilogue|prologue|preface|introduction|conclusion|appendix|глава|часть|книга|том|эпилог|пролог|розділ|частина|епілог|передмова)\b[\s.:—-]*[\wivxlcдмаъ.]*/i,
    /^[IVXLC]{1,7}\.?$/,
    /^[IVXLC]{1,7}\.\s+\S/,
    /^[IVXLC]{1,7}\s+[A-ZА-ЯЁ“"'][^.!?]{2,80}$/, // «I The Old Sea-dog at the “Admiral Benbow”»
    /^\d{1,3}\.?$/,
  ]
  function fromTxt(text, meta = {}) {
    let body = text.replace(/\r\n?/g, '\n').replace(/^\ufeff/, '')
    // Обёртка Project Gutenberg — между «*** START OF» и «*** END OF»
    const start = body.search(/^\*{3}\s*START OF.*$/im)
    if (start >= 0) body = body.slice(body.indexOf('\n', start) + 1)
    // Конец текста: «*** END OF …» или «End of (the) Project Gutenberg …» без звёздочек; метки [Illustration] — долой
    body = body.replace(/\[Illustration[\s\S]*?\]/gi, '')
    const footer = body.search(/^End of (the )?Project Gutenberg/im)
    if (footer >= 0) body = body.slice(0, footer)
    const end = body.search(/^\*{3}\s*END OF.*$/im)
    if (end >= 0) body = body.slice(0, end)
    const paras = body
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
    let blocks = paras.map((p) => ({ head: p.length <= 80 && HEADING.some((re) => re.test(p)), text: p }))
    // Заголовки целиком заглавными («STORY OF THE DOOR»): если таких коротких строк в книге три и больше — это главы
    const caps = (p) => p.length <= 60 && /[A-ZА-ЯЁЇІЄҐ]{3}/.test(p) && p === p.toUpperCase() && !/[.!?…]$/.test(p) && !/^THE END$/i.test(p)
    if (blocks.filter((b) => !b.head && caps(b.text)).length >= 3) blocks = blocks.map((b) => (caps(b.text) ? { ...b, head: true } : b))
    // Оглавление: три и больше заголовков подряд без текста между ними. Остаётся последний — настоящая первая глава;
    // предпоследний — только если это часть («PART ONE») или рассказ, к которому относится раздел («I. A SCANDAL…» + «I.»)
    const numeral = (t) => (t.match(/^([IVXLC]{1,7})\b/) || [])[1]
    const collapsed = []
    for (let i = 0; i < blocks.length; ) {
      let j = i
      while (j < blocks.length && blocks[j].head) j++
      if (j - i >= 3) {
        const last = blocks[j - 1]
        const prev = blocks[j - 2]
        const part = /^(part|book|часть|книга|том)\b/i.test(prev.text)
        const story = /^[IVXLC]{1,7}\.?$/.test(last.text) && /^[IVXLC]{1,7}\.?\s+\S/.test(prev.text) && numeral(prev.text) === numeral(last.text)
        if (part || story) collapsed.push(prev)
        collapsed.push(last)
        i = j
      } else collapsed.push(blocks[i++])
    }
    blocks = collapsed
    // Есть заголовки «номер + название» («I. A SCANDAL IN BOHEMIA») — тогда голые «I.», «II.» внутри — разделы, не главы
    if (blocks.some((b) => b.head && /^[IVXLC]{1,7}\.?\s+\S/.test(b.text))) blocks = blocks.filter((b) => !(b.head && /^[IVXLC]{1,7}\.?$/.test(b.text)))
    const lang = meta.lang || (/[а-яё]/i.test(body.slice(0, 5000)) ? 'ru' : 'en')
    const chapters = split(toChapters(blocks, meta.title || (lang === 'ru' ? 'Начало' : 'Beginning')), lang === 'ru' ? 'Часть' : 'Part')
    return { title: meta.title || '', author: meta.author || '', lang, chapters }
  }

  // --- FB2 ----------------------------------------------------------------------------------------------------------
  function fromFb2(xml, meta = {}) {
    const info = (xml.match(/<title-info>([\s\S]*?)<\/title-info>/i) || [])[1] || ''
    const title = clean((info.match(/<book-title>([\s\S]*?)<\/book-title>/i) || [])[1] || '')
    const a = (info.match(/<author>([\s\S]*?)<\/author>/i) || [])[1] || ''
    const name = (tag) => clean((a.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'i')) || [])[1] || '')
    const author = [name('first-name'), name('middle-name'), name('last-name')].filter(Boolean).join(' ')
    const lang = clean((info.match(/<lang>([\s\S]*?)<\/lang>/i) || [])[1] || '') || meta.lang || 'ru'
    // Основной текст — первое <body> без name="notes"; заголовок секции начинает главу
    const bodies = [...xml.matchAll(/<body\b([^>]*)>([\s\S]*?)<\/body>/gi)].filter((m) => !/name\s*=\s*["']notes/i.test(m[1]))
    const html = bodies.map((m) => m[2]).join('\n')
    const blocks = []
    const re = /<title\b[^>]*>([\s\S]*?)<\/title>|<(p|subtitle|v|text-author)\b[^>]*>([\s\S]*?)<\/\2>/gi
    let m
    while ((m = re.exec(html))) {
      if (m[1] !== undefined) {
        // Заголовок секции из нескольких абзацев («Глава I», «Сержант гвардии») — через точку
        const parts = [...m[1].matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((x) => clean(x[1])).filter(Boolean)
        const t = (parts.length ? parts : [clean(m[1])]).map((x) => x.replace(/[.\s]+$/, '')).join('. ')
        if (t) blocks.push({ head: true, text: t })
      } else {
        const t = clean(m[3])
        if (t) blocks.push({ head: false, text: t })
      }
    }
    const chapters = split(toChapters(blocks, title || meta.title || 'Начало'), lang === 'en' ? 'Part' : 'Часть')
    return { title: title || meta.title || '', author: author || meta.author || '', lang, chapters }
  }

  // --- EPUB: ZIP вручную ------------------------------------------------------------------------------------------
  function unzipIndex(bytes) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    let eocd = -1
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
      if (view.getUint32(i, true) === 0x06054b50) {
        eocd = i
        break
      }
    }
    if (eocd < 0) throw new Error('это не EPUB: не найдено оглавление архива')
    const count = view.getUint16(eocd + 10, true)
    let at = view.getUint32(eocd + 16, true)
    const files = new Map()
    const td = new TextDecoder()
    for (let n = 0; n < count; n++) {
      if (view.getUint32(at, true) !== 0x02014b50) break
      const method = view.getUint16(at + 10, true)
      const size = view.getUint32(at + 20, true)
      const nameLen = view.getUint16(at + 28, true)
      const extraLen = view.getUint16(at + 30, true)
      const commentLen = view.getUint16(at + 32, true)
      const local = view.getUint32(at + 42, true)
      const name = td.decode(bytes.subarray(at + 46, at + 46 + nameLen))
      files.set(name, { method, size, local })
      at += 46 + nameLen + extraLen + commentLen
    }
    return { files, view }
  }
  async function readEntry(bytes, zip, name, inflateRaw) {
    const e = zip.files.get(name)
    if (!e) return null
    const v = zip.view
    const start = e.local + 30 + v.getUint16(e.local + 26, true) + v.getUint16(e.local + 28, true)
    const data = bytes.subarray(start, start + e.size)
    const raw = e.method === 0 ? data : await inflateRaw(data)
    return new TextDecoder().decode(raw)
  }
  const resolve = (base, href) => {
    const parts = (base.includes('/') ? base.slice(0, base.lastIndexOf('/') + 1) : '').concat(decodeURIComponent(href.split('#')[0])).split('/')
    const out = []
    for (const p of parts) {
      if (p === '..') out.pop()
      else if (p && p !== '.') out.push(p)
    }
    return out.join('/')
  }
  async function fromEpub(bytes, meta = {}) {
    if (!meta.inflateRaw) throw new Error('для EPUB нужна функция inflateRaw')
    const zip = unzipIndex(bytes)
    const container = await readEntry(bytes, zip, 'META-INF/container.xml', meta.inflateRaw)
    const opfPath = (container && (container.match(/full-path\s*=\s*"([^"]+)"/i) || [])[1]) || [...zip.files.keys()].find((n) => n.endsWith('.opf'))
    if (!opfPath) throw new Error('это не EPUB: нет описания книги (.opf)')
    const opf = await readEntry(bytes, zip, opfPath, meta.inflateRaw)
    const title = clean((opf.match(/<dc:title[^>]*>([\s\S]*?)<\/dc:title>/i) || [])[1] || '')
    const author = clean((opf.match(/<dc:creator[^>]*>([\s\S]*?)<\/dc:creator>/i) || [])[1] || '')
    const lang = clean((opf.match(/<dc:language[^>]*>([\s\S]*?)<\/dc:language>/i) || [])[1] || '').slice(0, 2).toLowerCase() || meta.lang || 'en'
    const items = new Map()
    for (const m of opf.matchAll(/<item\b[^>]*>/gi)) {
      const id = (m[0].match(/\bid\s*=\s*"([^"]+)"/i) || [])[1]
      const href = (m[0].match(/\bhref\s*=\s*"([^"]+)"/i) || [])[1]
      if (id && href) items.set(id, resolve(opfPath, href))
    }
    const spine = [...opf.matchAll(/<itemref\b[^>]*idref\s*=\s*"([^"]+)"/gi)].map((m) => items.get(m[1])).filter(Boolean)
    const blocks = []
    for (const path of spine) {
      const html = await readEntry(bytes, zip, path, meta.inflateRaw)
      if (!html) continue
      const body = (html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [])[1] || html
      for (const m of body.matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>|<(p|h[4-6]|li|dd)\b[^>]*>([\s\S]*?)<\/\3>/gi)) {
        const text = clean(m[2] ?? m[4])
        if (text) blocks.push({ head: Boolean(m[1]), text })
      }
    }
    const chapters = split(toChapters(blocks, title || meta.title || 'Начало'), lang === 'ru' ? 'Часть' : 'Part')
    return { title: title || meta.title || '', author: author || meta.author || '', lang, chapters }
  }

  // --- Общее: по расширению и содержимому -----------------------------------------------------------------------
  function textOf(bytes) {
    // UTF-8, иначе — Windows-1251 (так часто сохранены русские TXT и FB2)
    try {
      return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return new TextDecoder('windows-1251').decode(bytes)
    }
  }
  function fb2Text(bytes) {
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200))
    const enc = (head.match(/encoding\s*=\s*["']([\w-]+)["']/i) || [])[1]
    if (enc && !/utf-?8/i.test(enc)) {
      try {
        return new TextDecoder(enc.toLowerCase()).decode(bytes)
      } catch {
        // неизвестная кодировка — пробуем как обычно
      }
    }
    return textOf(bytes)
  }
  async function parse(bytes, name, meta = {}) {
    const ext = ((String(name).match(/\.([^.]+)$/) || [])[1] || '').toLowerCase()
    const isZip = bytes[0] === 0x50 && bytes[1] === 0x4b
    if (ext === 'epub' || (isZip && ext !== 'fb2')) return fromEpub(bytes, meta)
    if (ext === 'fb2') return fromFb2(fb2Text(bytes), meta)
    if (ext === 'txt') return fromTxt(textOf(bytes), meta)
    throw new Error('книга должна быть в EPUB, FB2 или TXT')
  }

  // Проверка готовой книги — для сборки каталога и своих книг
  function check(book) {
    if (!book || !Array.isArray(book.chapters) || !book.chapters.length) throw new Error('в книге не нашлось ни одной главы с текстом')
    const words = book.chapters.reduce((n, c) => n + c.paragraphs.reduce((k, p) => k + p.split(/\s+/).length, 0), 0)
    return { chapters: book.chapters.length, words }
  }

  root.ArcadeBookFormat = { fromTxt, fromFb2, fromEpub, parse, check, textOf }
})(typeof window !== 'undefined' ? window : globalThis)
