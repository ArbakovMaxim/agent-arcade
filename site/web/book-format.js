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
    decode(html.replace(/\s+/g, ' ').replace(/<br\s*\/?>/gi, '\n').replace(/<\/?(p|div|li|h[1-6]|title|subtitle|v)\b[^>]*>/gi, ' ').replace(/<[^>]+>/g, ''))
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
        // Части заголовка — через одну точку: «CHAPTER I.» + «Down the Rabbit-Hole» → «CHAPTER I. Down the Rabbit-Hole»
        const join = (a, b2) => `${a.replace(/[.\s]+$/, '')}. ${b2}`
        const title = b.text.split('\n').reduce((acc, part) => (acc ? join(acc, part) : part), '')
        const marker = (t) => /^((table of )?contents|(list of )?illustrations|зміст|оглавление|содержание)\.?$/i.test(t)
        if (current && current.paragraphs.length === 0) current.title = marker(current.title) ? title : join(current.title, title)
        else chapters.push((current = { title, paragraphs: [] }))
      } else {
        if (!current) chapters.push((current = { title: fallbackTitle, paragraphs: [] }))
        current.paragraphs.push(...pieces(b.text))
      }
    }
    return chapters.filter((c) => c.paragraphs.length)
  }

  // Длинная глава — на части по объёму текста (не по числу абзацев: в пьесе реплика — абзац). Название главы
  // остаётся: «Act I · 2». auto — часть нарезана сборкой, а не размечена автором
  function split(chapters) {
    const out = []
    for (const c of chapters) {
      const size = c.paragraphs.reduce((n, p) => n + p.length, 0)
      if (size <= 60000) {
        out.push(c)
        continue
      }
      let part = []
      let len = 0
      let k = 1
      for (const p of c.paragraphs) {
        part.push(p)
        len += p.length
        if (len >= 30000) {
          out.push({ title: `${c.title} · ${k++}`, paragraphs: part, auto: true })
          part = []
          len = 0
        }
      }
      if (part.length) out.push({ title: k > 1 ? `${c.title} · ${k}` : c.title, paragraphs: part, ...(k > 1 ? { auto: true } : {}) })
    }
    return out
  }


  // Форма книги: оглавление (три и больше заголовков подряд) схлопнуть до настоящей первой главы; при заголовках
  // «номер + название» голые «I.», «II.» — разделы, не главы. Общая для TXT и EPUB
  function shape(blocks) {
    // Оглавление: три и больше заголовков подряд без текста между ними. Остаётся последний — настоящая первая глава;
    // предпоследний — только если это часть («PART ONE») или рассказ, к которому относится раздел («I. A SCANDAL…» + «I.»)
    const numeral = (t) => (t.match(/^([IVXLC]{1,7})\b/) || [])[1]
    const collapsed = []
    for (let i = 0; i < blocks.length; ) {
      // «Contents» перед заголовками — не в счёт: «Contents», «CHAPTER I.», «Down the Rabbit-Hole» — это глава, не оглавление
      if (blocks[i].head && /^((table of )?contents|зміст|оглавление|содержание)\.?$/i.test(blocks[i].text) && blocks[i + 1]?.head) {
        i++
        continue
      }
      let j = i
      while (j < blocks.length && blocks[j].head) j++
      if (j - i >= 3) {
        const last = blocks[j - 1]
        const prev = blocks[j - 2]
        // часть перед главой («PART ONE» + «I The Old Sea-dog»), но не строка оглавления того же уровня («Book II» + «BOOK I.»)
        const partWord = /^(part|book|часть|книга|том|частина)(?=[\s.:—-]|$)/i
        const part = partWord.test(prev.text) && !partWord.test(last.text)
        const story = /^[IVXLC]{1,7}\.?$/.test(last.text) && /^[IVXLC]{1,7}\.?\s+\S/.test(prev.text) && numeral(prev.text) === numeral(last.text)
        // номер главы перед подзаголовком: «CHAPTER I.» + «Down the Rabbit-Hole»
        const numbered = /^(chapter|глава|розділ)(?=[\s.:—-]|$)|^[IVXLC]{1,7}\.?$/i
        const subtitle = numbered.test(prev.text) && !numbered.test(last.text)
        if (part || story || subtitle) collapsed.push(prev)
        collapsed.push(last)
        i = j
      } else collapsed.push(blocks[i++])
    }
    blocks = collapsed
    // Есть заголовки «номер + название» («I. A SCANDAL IN BOHEMIA») — тогда голые «I.», «II.» внутри — разделы, не главы
    if (blocks.some((b) => b.head && /^[IVXLC]{1,7}\.?\s+\S/.test(b.text))) blocks = blocks.filter((b) => !(b.head && /^[IVXLC]{1,7}\.?$/.test(b.text)))
    return blocks
  }

  // --- TXT ----------------------------------------------------------------------------------------------------------
  const HEADING = [
    // (?=…) вместо \b: в JavaScript \b — граница слова только для латиницы, после «глава» или «розділ» она не срабатывает
    /^(chapter|part|book|stave|adventure|epilogue|prologue|preface|introduction|conclusion|appendix|глава|часть|книга|том|эпилог|пролог|розділ|частина|епілог|передмова)(?=[\s.:—-]|$)/i,
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
    blocks = shape(blocks)
    const lang = meta.lang || (/[а-яё]/i.test(body.slice(0, 5000)) ? 'ru' : 'en')
    const chapters = split(toChapters(blocks, meta.title || (lang === 'ru' ? 'Начало' : 'Beginning')))
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
    const chapters = split(toChapters(blocks, title || meta.title || 'Начало'))
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
    let blocks = []
    const anchors = [] // места записей оглавления: { entry, doc, at }
    const toc = await epubToc(bytes, zip, opf, opfPath, items, meta.inflateRaw)
    let doc = -1
    for (const path of spine) {
      doc++
      const html = await readEntry(bytes, zip, path, meta.inflateRaw)
      if (!html) continue
      const verses = []
      // Подписи к картинкам (в том числе внутри заголовков) и строки оглавления <p class="toc"> — не текст книги
      const raw = ((html.match(/<body\b[^>]*>([\s\S]*)<\/body>/i) || [])[1] || html)
        .replace(/<(span|div|p|figcaption)\b[^>]*class="[^"]*\b(caption|figcaption|illus\w*)\b[^"]*"[^>]*>[\s\S]*?<\/\1>/gi, ' ')
        .replace(/<figure\b[\s\S]*?<\/figure>/gi, ' ')
        .replace(/<p\b[^>]*class="[^"]*\btoc\b[^"]*"[^>]*>[\s\S]*?<\/p>/gi, ' ')
      const body = poems(raw, verses)
      const before = blocks.length
      // Где в этом файле начинаются записи оглавления: без якоря — с начала файла, с якорем — у элемента с этим id
      toc.forEach((e, entry) => {
        if (e.path !== path) return
        if (!e.frag) return anchors.push({ entry, doc, at: 0 })
        const tag = new RegExp(`<(\\w+)\\b[^>]*\\b(id|name)\\s*=\\s*["']${e.frag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["'][^>]*>`, 'i').exec(body)
        // запись оглавления, указывающая на картинку («Marley’s Ghost»), — не начало главы
        if (tag && !/^(img|figure|svg|image)$/i.test(tag[1]) && !/class\s*=\s*["'][^"']*\b(fig\w*|illus\w*|image|caption)\b/i.test(tag[0])) anchors.push({ entry, doc, at: tag.index })
      })
      for (const m of body.matchAll(/<(h[1-3])\b[^>]*>([\s\S]*?)<\/\1>|<div\b[^>]*class="[^"]*\b(?:stanza|verse)\b[^"]*"[^>]*>([\s\S]*?)<\/div>|<(p|h[4-6]|li|dd)\b[^>]*>([\s\S]*?)<\/\4>|<pre\b[^>]*>([\s\S]*?)<\/pre>/gi)) {
        // строфа Gutenberg: строки — <span> или <div class="line">, между ними — перенос; в <pre> перенос исходника — строка
        const raw = m[6] !== undefined ? m[6].replace(/\r?\n/g, '<br/>') : m[3] !== undefined ? m[3].replace(/<\/(span|div)>\s*(<br\s*\/?>)?/gi, '<br/>') : (m[2] ?? m[5])
        const verseAt = m[4] && /data-verse="(\d+)"/.exec(m[0])
        const text = verseAt ? verses[Number(verseAt[1])] : clean(raw)
        if (text) blocks.push({ head: Boolean(m[1]), text, doc, end: m.index + m[0].length })
      }
      // В файле нет заголовков — название главы из его <title> (так делает ws-export: «ДІЯ ПЕРША»)
      const docTitle = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '')
      const mine = blocks.slice(before)
      const sameAsBook = (t) => [title, meta.title].some((x) => x && t.toLowerCase().includes(x.toLowerCase())) || /project gutenberg|твори|зібрання|собрание|(^|[\s/])том\s+[ivxlc\d]|\//i.test(t)
      if (docTitle && mine.length && !mine.some((x) => x.head) && !sameAsBook(docTitle) && docTitle.length <= 80) blocks.splice(before, 0, { head: true, text: docTitle })
    }
    // Главы по оглавлению книги — надёжнее угадывания по виду строк; не вышло — прежние правила
    const byToc = tocChapters(blocks, toc, anchors)
    // Project Gutenberg: только то, что между «*** START OF» и «*** END OF»
    const startAt = blocks.findIndex((x) => /\*{3}\s*START OF (THE|THIS) PROJECT GUTENBERG/i.test(x.text))
    if (startAt >= 0) blocks.splice(0, startAt + 1)
    const endAt = blocks.findIndex((x) => /\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG|THE FULL PROJECT GUTENBERG|START: FULL LICENSE/i.test(x.text))
    if (endAt >= 0) blocks.splice(endAt)
    // Короткий абзац «I», «Розділ II», «Дія перша», «Пісня третя» — тоже заголовок (так размечена Викитека)
    const mode = meta.chapters || 'auto'
    const realHeadings = mode !== 'text-loose' && blocks.some((x) => x.head)
    for (const x of blocks) if (!x.head && x.text.length <= 60 && !x.text.includes('\n') && (EPUB_HEADING.test(x.text) || (!realHeadings && HEADING.some((re) => re.test(x.text))))) x.head = true
    blocks = verse(shape(blocks))
    const guessed = split(toChapters(blocks, title || meta.title || 'Начало'))
    const size = (list) => list.reduce((n, c) => n + c.paragraphs.reduce((k, x) => k + x.length, 0), 0)
    // auto: по оглавлению, если оно полное (не меньше 60% текста и не вдвое меньше глав, чем в тексте); toc — всегда по нему;
    // text и text-loose — по заголовкам в тексте (text-loose: короткие абзацы «Chapter …» — тоже главы)
    const fullToc = byToc && byToc.length >= 2 && size(byToc) >= 0.6 * size(guessed) && byToc.length * 2 > guessed.length
    const chapters = mode === 'toc' ? (byToc && byToc.length ? byToc : guessed) : mode === 'auto' && fullToc ? byToc : guessed
    return { title: title || meta.title || '', author: author || meta.author || '', lang, chapters }
  }

  // Оглавление EPUB: toc.ncx (EPUB 2) или nav (EPUB 3) — записи по порядку: название, файл, якорь
  async function epubToc(bytes, zip, opf, opfPath, items, inflateRaw) {
    const target = (base, src) => {
      const [file, frag] = src.split('#')
      return { path: resolve(base, file), frag: frag ? decodeURIComponent(frag) : '' }
    }
    const out = []
    const ncxId = (opf.match(/<spine\b[^>]*\btoc\s*=\s*"([^"]+)"/i) || [])[1]
    let ncxPath = ncxId && items.get(ncxId)
    if (!ncxPath) {
      const item = opf.match(/<item\b[^>]*media-type\s*=\s*"application\/x-dtbncx\+xml"[^>]*>/i)
      const href = item && (item[0].match(/\bhref\s*=\s*"([^"]+)"/i) || [])[1]
      if (href) ncxPath = resolve(opfPath, href)
    }
    if (ncxPath) {
      const ncx = await readEntry(bytes, zip, ncxPath, inflateRaw)
      if (ncx) for (const m of ncx.matchAll(/<navPoint\b[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content\b[^>]*\bsrc\s*=\s*"([^"]+)"/gi)) out.push({ label: clean(m[1]), ...target(ncxPath, m[2]) })
    }
    if (!out.length) {
      const item = opf.match(/<item\b[^>]*properties\s*=\s*"[^"]*\bnav\b[^"]*"[^>]*>/i)
      const href = item && (item[0].match(/\bhref\s*=\s*"([^"]+)"/i) || [])[1]
      const navPath = href && resolve(opfPath, href)
      const nav = navPath && (await readEntry(bytes, zip, navPath, inflateRaw))
      if (nav) {
        const list = (nav.match(/<nav\b[^>]*toc[^>]*>([\s\S]*?)<\/nav>/i) || [])[1] || nav
        for (const a of list.matchAll(/<a\b[^>]*href\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)) out.push({ label: clean(a[2]), ...target(navPath, a[1]) })
      }
    }
    return out.filter((e) => e.label)
  }

  // Записи оглавления, которые не глава: само оглавление, иллюстрации, титул, лицензия, «об этом издании»
  const TOC_JUNK = /^(contents|table of contents|illustrations|list of illustrations|the full project gutenberg|project gutenberg|full license|title page|cover|copyright|colophon|зміст|оглавление|содержание|про це електронне видання|об этом электронном издании|about this digital edition|опис$|титульна сторінка|титульная страница)/i

  // Главы по оглавлению: каждый блок — в ту запись, что начинается раньше него; до первой записи — титул, долой.
  // Запись без своего текста (часть) — начало названия следующей главы: «Part I. Chapter I»
  function tocChapters(blocks, toc, anchors) {
    if (toc.filter((e) => !TOC_JUNK.test(e.label)).length < 2 || anchors.length < 2) return null
    const byDoc = new Map()
    for (const a of anchors) byDoc.set(a.doc, [...(byDoc.get(a.doc) ?? []), a].sort((x, y) => x.at - y.at))
    const owned = new Map()
    let current = -1
    let lastDoc = -1
    let next = []
    for (const b of blocks) {
      if (/\*{3}\s*END OF (THE|THIS) PROJECT GUTENBERG|THE FULL PROJECT GUTENBERG/i.test(b.text)) break
      if (b.doc !== lastDoc) {
        lastDoc = b.doc
        next = [...(byDoc.get(b.doc) ?? [])]
      }
      while (next.length && b.end > next[0].at) current = next.shift().entry
      if (current < 0) continue
      owned.set(current, [...(owned.get(current) ?? []), b])
    }
    const chapters = []
    let prefix = ''
    const join = (a, b2) => (a ? `${a.replace(/[.\s]+$/, '')}. ${b2}` : b2)
    const norm = (t) => t.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '')
    toc.forEach((e, i) => {
      if (TOC_JUNK.test(e.label)) return
      let own = owned.get(i) ?? []
      // Заголовок в тексте, начинающийся с названия из оглавления («CHAPTER I.» + «Down the Rabbit-Hole»), — полнее: берём его
      let label = e.label.replace(/^.+?\s((CHAPTER|Chapter|STAVE|BOOK|PART|ACT)\s+[IVXLC\d]+\b.*)$/, '$1')
      // заголовок — в первых двух блоках главы, хоть h2, хоть обычный <p> («Chapter I. The birth of the Prince…»)
      const heading = own.slice(0, 2).find((b) => (b.head || b.text.length <= 160) && norm(b.text).startsWith(norm(e.label)))
      if (heading) {
        label = heading.text.split('\n').reduce((acc, part) => join(acc, part), '')
        own = own.filter((b) => b !== heading)
      }
      const paragraphs = verse(own.map((b) => ({ head: false, text: b.text }))).flatMap((b) => pieces(b.text))
      if (!paragraphs.length) {
        // без своего текста: часть, книга, акт, том — начало названия следующей главы; остальное (издание, переводчик) — долой
        if (/^(part|book|act|volume|vol\.|canto|stave|section|частина|часть|книга|том|дія|действие)(?=[\s.:—-]|$)/i.test(label)) prefix = join(prefix, label)
        return
      }
      chapters.push({ title: join(prefix, label), paragraphs })
      prefix = ''
    })
    return chapters.length ? split(chapters) : null
  }
  // Стихи в контейнерах со вложенными <div> (Gutenberg: div.poem > div.stanza > div.line): вынимаем целиком, считая
  // вложенность, — строки через перенос, строфы через пустую строку; на их место — <p data-verse="N">
  function poems(html, verses) {
    const open = /<div\b[^>]*class="[^"]*\b(poem|poetry|stanza|verse|lg)\b[^"]*"[^>]*>/gi
    let out = ''
    let from = 0
    let m
    while ((m = open.exec(html))) {
      if (m.index < from) continue
      const tags = /<\/?div\b[^>]*>/gi
      tags.lastIndex = m.index
      let depth = 0
      let end = -1
      let t
      while ((t = tags.exec(html))) {
        depth += t[0][1] === '/' ? -1 : 1
        if (depth === 0) {
          end = t.index + t[0].length
          break
        }
      }
      if (end < 0) break
      const inner = html
        .slice(m.index, end)
        .replace(/<div\b[^>]*class="[^"]*\bstanza\b[^"]*"[^>]*>/gi, '<br/><br/>')
        .replace(/<\/(div|p)>/gi, '<br/>')
      out += `${html.slice(from, m.index)}<p data-verse="${verses.length}"></p>`
      verses.push(clean(inner))
      from = end
      open.lastIndex = end
    }
    return out + html.slice(from)
  }

  const EPUB_HEADING = /^(дія|розділ|частина|пісня|пролог|епілог|сцена|ява|глава|действие|песнь|canto|act|scene)(?=[\s.:—-]|$)[^.!?]{0,40}$/i
  // Стихи построчными абзацами (каждая строка — свой <p>): подряд 4 и больше коротких строк — строфы по 14 строк
  function verse(blocks) {
    const out = []
    for (let i = 0; i < blocks.length; ) {
      let j = i
      while (j < blocks.length && !blocks[j].head && blocks[j].text.length < 70 && !blocks[j].text.includes('\n') && !/^[—–-]/.test(blocks[j].text)) j++
      if (j - i >= 4) {
        for (let k = i; k < j; k += 14) out.push({ head: false, text: blocks.slice(k, Math.min(j, k + 14)).map((x) => x.text).join('\n') })
        i = j
      } else out.push(blocks[i++])
    }
    return out
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
