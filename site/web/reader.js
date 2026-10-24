// Читалка Arcade в окне: книга из открытой библиотеки (Project Gutenberg, Викитека) или своя (EPUB, FB2, TXT из «Моих книг»).
// Текст — колонкой удобной ширины, глава за главой; оглавление, размер шрифта, светлая и тёмная тема.
// Закладка ставится сама: страница запоминает абзац в начале экрана (localStorage) и при открытии возвращается к нему.
;(function () {
  'use strict'

  const PREFS = 'arcade:reader'
  const positionKey = (id) => `arcade:book:${id}`
  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key)) || fallback
    } catch {
      return fallback
    }
  }
  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // браузер не даёт хранить — читать можно и без закладки
    }
  }

  function el(tag, cls, text) {
    const node = document.createElement(tag)
    if (cls) node.className = cls
    if (text !== undefined) node.textContent = text
    return node
  }

  function prepare(title, credit) {
    document.body.classList.remove('library-mode')
    document.title = `${title} · Arcade`
    document.getElementById('keys').textContent = T('колёсико или пробел — дальше · оглавление и шрифт — вверху')
    document.getElementById('credit').textContent = credit || ''
    for (const id of ['sound', 'restart', 'best', 'net']) {
      const node = document.getElementById(id)
      if (node) node.style.display = 'none'
    }
    const screen = document.getElementById('screen')
    if (screen) screen.style.display = 'none'
    document.getElementById('overlay').classList.remove('shown')
  }

  function render(book, id) {
    const prefs = read(PREFS, { size: 19, theme: 'dark' })
    const stage = document.getElementById('stage') || document.body
    const root = el('div', `reader theme-${prefs.theme}`)
    root.id = 'reader-root'
    root.style.cssText = `--reader-size: ${prefs.size}px`

    const bar = el('div', 'reader-bar')
    const name = el('div', 'reader-name', book.author ? `${book.author} — ${book.title}` : book.title)
    const progress = el('div', 'reader-progress', '0%')
    const tocButton = el('button', 'reader-btn', T('Оглавление'))
    const smaller = el('button', 'reader-btn', 'A−')
    const bigger = el('button', 'reader-btn', 'A+')
    const theme = el('button', 'reader-btn', prefs.theme === 'dark' ? '☀' : '☾')
    for (const b of [tocButton, smaller, bigger, theme]) b.type = 'button'
    bar.append(name, progress, tocButton, smaller, bigger, theme)

    const toc = el('div', 'reader-toc')
    toc.hidden = true
    const text = el('div', 'reader-text')
    const marks = [] // абзацы по порядку: для закладки
    book.chapters.forEach((chapter, c) => {
      const h = el('h2', 'reader-chapter', chapter.title)
      h.dataset.c = c
      text.append(h)
      const link = el('button', 'reader-toc-item', chapter.title)
      link.type = 'button'
      link.addEventListener('click', () => {
        toc.hidden = true
        root.scrollTop = h.offsetTop - bar.offsetHeight - 8
      })
      toc.append(link)
      chapter.paragraphs.forEach((paragraph, p) => {
        const node = el('p', paragraph.includes('\n') ? 'verse' : '', paragraph)
        node.dataset.c = c
        node.dataset.p = p
        text.append(node)
        marks.push(node)
      })
    })
    root.append(bar, toc, text)
    stage.append(root)

    // Закладка: первый абзац, который виден под панелью
    const visible = () => {
      const top = root.scrollTop + bar.offsetHeight
      let lo = 0
      let hi = marks.length - 1
      while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (marks[mid].offsetTop + marks[mid].offsetHeight < top) lo = mid + 1
        else hi = mid
      }
      return marks[lo]
    }
    let timer = 0
    const save = () => {
      const node = visible()
      if (!node) return
      const max = Math.max(1, root.scrollHeight - root.clientHeight)
      const percent = Math.min(100, Math.round((root.scrollTop / max) * 100))
      progress.textContent = `${percent}%`
      write(positionKey(id), { c: Number(node.dataset.c), p: Number(node.dataset.p), percent, at: Date.now() })
    }
    root.addEventListener('scroll', () => {
      clearTimeout(timer)
      timer = setTimeout(save, 400)
    })
    if (window.addEventListener) window.addEventListener('beforeunload', save)

    // Вернуться туда, где остановился
    const at = read(positionKey(id), null)
    if (at) {
      const node = marks.find((n) => Number(n.dataset.c) === at.c && Number(n.dataset.p) === at.p)
      if (node) root.scrollTop = node.offsetTop - bar.offsetHeight - 8
      progress.textContent = `${at.percent || 0}%`
    }

    tocButton.addEventListener('click', () => {
      toc.hidden = !toc.hidden
    })
    const setSize = (size) => {
      const node = visible()
      prefs.size = Math.max(14, Math.min(30, size))
      root.style.cssText = `--reader-size: ${prefs.size}px`
      write(PREFS, prefs)
      if (node) root.scrollTop = node.offsetTop - bar.offsetHeight - 8 // после смены шрифта — тот же абзац
    }
    smaller.addEventListener('click', () => setSize(prefs.size - 2))
    bigger.addEventListener('click', () => setSize(prefs.size + 2))
    theme.addEventListener('click', () => {
      prefs.theme = prefs.theme === 'dark' ? 'light' : 'dark'
      root.className = `reader theme-${prefs.theme}`
      theme.textContent = prefs.theme === 'dark' ? '☀' : '☾'
      write(PREFS, prefs)
    })
    // Пробел и PageDown листают, как в книге
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' || e.code === 'PageDown') root.scrollTop += root.clientHeight - bar.offsetHeight - 40
      else if (e.code === 'PageUp') root.scrollTop -= root.clientHeight - bar.offsetHeight - 40
      else return
      e.preventDefault()
    })
    window.ArcadeReader.view = { root, save, visible, marks }
    return root
  }

  // EPUB — zip: сжатые файлы распаковывает сам браузер
  const inflateRaw = async (data) => new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())

  // Своя книга: EPUB, FB2 или TXT — разбор прямо в браузере
  async function startMine(entry) {
    prepare(entry.title, T('Своя книга — только в этом браузере'))
    const bytes = new Uint8Array(await entry.file.arrayBuffer())
    const book = await window.ArcadeBookFormat.parse(bytes, entry.name || entry.title, { title: entry.title, inflateRaw })
    window.ArcadeBookFormat.check(book)
    render(book, entry.id)
  }

  // --- Книга из открытой библиотеки: gutenberg:<номер> или wikisource:<язык>:<страница> ---------------------------
  // Первый раз — скачать и собрать, затем положить в «Мои книги» (этот браузер): дальше книга открывается без сети
  const MAX_PAGES = 200 // страниц Викитеки в одной книге

  // «Капитанская дочка (Пушкин)» → название и автор; в скобках год или «ДО» — это не автор
  function wikiMeta(page) {
    const m = /^(.+?) \(([^()]+)\)$/.exec(page)
    const byAuthor = m && !/^\d{3,4}/.test(m[2]) && !/^(ДО|ВТ)$/.test(m[2])
    return { title: byAuthor ? m[1] : page, author: byAuthor ? m[2] : '' }
  }

  async function gutenbergBook(id, meta) {
    const response = await fetch(`/api/books/file?gutenberg=${encodeURIComponent(id)}`)
    if (!response.ok) throw new Error(response.status === 404 ? T('Этой книги в Project Gutenberg нет.') : T(`сервер ответил ${response.status}`))
    const bytes = new Uint8Array(await response.arrayBuffer())
    const book = await window.ArcadeBookFormat.parse(bytes, `${id}.epub`, { title: meta.title, inflateRaw })
    return window.ArcadeBookFormat.cleanGutenberg({ ...book, title: book.title || meta.title, author: book.author || meta.author })
  }

  // Викитека: главная страница → редакция (если там список редакций) → главы подстраницами, по три сразу
  async function wikisourceBook(lang, root, meta, progress) {
    const F = window.ArcadeBookFormat
    const load = async (page) => {
      const url = `https://${lang}.wikisource.org/w/api.php?action=parse&page=${encodeURIComponent(page)}&prop=text&formatversion=2&format=json&redirects=1&origin=*`
      // Сеть или сервер подвели — ещё одна попытка; страницы нет — сразу ошибка
      for (let attempt = 0; ; attempt++) {
        let json
        try {
          const response = await fetch(url)
          if (!response.ok) throw new Error(T(`сервер ответил ${response.status}`))
          json = await response.json()
        } catch (err) {
          if (attempt) throw err
          continue
        }
        if (json.error) throw new Error(json.error.code === 'missingtitle' ? T('Такой страницы в Викитеке нет.') : json.error.info || json.error.code)
        return json.parse
      }
    }
    let page = await load(root)
    let kind = F.wikiPage(page.text, page.title)
    for (let hop = 0; kind.kind === 'edition' && hop < 3; hop++) {
      page = await load(kind.page)
      kind = F.wikiPage(page.text, page.title)
    }
    if (kind.kind === 'edition') throw new Error(T('В Викитеке у этой книги только список изданий — открой другое из поиска.'))
    if (kind.kind === 'text') return F.fromWiki([{ title: meta.title, html: kind.html }], meta)
    // Главы по порядку; у главы свои подстраницы (том → главы) — раскрываем ещё на уровень
    const parts = kind.pages.slice(0, MAX_PAGES)
    let done = 0
    let total = parts.length
    const pool = async (items, work) => {
      const out = []
      let next = 0
      await Promise.all(Array.from({ length: 3 }, async () => {
        while (next < items.length) {
          const i = next++
          out[i] = await work(items[i])
        }
      }))
      return out
    }
    const fetchPart = async (part, deep) => {
      const got = await load(part.page)
      const inner = F.wikiPage(got.text, got.title)
      if (inner.kind === 'parts' && deep && total < MAX_PAGES) {
        const subs = inner.pages.slice(0, MAX_PAGES - total)
        total += subs.length - 1
        return (await pool(subs, (s) => fetchPart({ page: s.page, title: `${part.title}. ${s.title.split('. ').at(-1)}` }, false))).flat()
      }
      progress(++done, total)
      return [{ title: part.title, html: inner.kind === 'text' ? inner.html : F.wikiClean(got.text) }]
    }
    const pages = (await pool(parts, (p) => fetchPart(p, true))).flat()
    return F.fromWiki(pages, meta)
  }

  async function startRef(ref, hint = {}) {
    const saved = await window.ArcadeMine.get(ref)
    if (saved && saved.book) {
      prepare(saved.title, T(saved.credit || 'Своя книга — только в этом браузере'))
      return render(saved.book, ref)
    }
    const stage = document.getElementById('stage') || document.body
    const m = /^(gutenberg):(\d{1,6})$|^(wikisource):([a-z]{2,3}):(.{1,255})$/.exec(ref)
    const meta = !m ? { title: ref } : m[1] ? { title: hint.title || `Project Gutenberg #${m[2]}`, author: hint.author || '', lang: hint.lang || '' } : { ...wikiMeta(m[5]), lang: m[4] }
    // Подпись — по-русски, переводится при показе
    const credit = m && m[1] ? 'Project Gutenberg · общественное достояние' : 'Викитека · общественное достояние'
    prepare(meta.title, T(credit))
    const status = el('div', 'reader-status', T('Скачиваю книгу…'))
    stage.append(status)
    try {
      if (!m) throw new Error(T('Такой книги нет.'))
      let book = m[1] ? await gutenbergBook(m[2], meta) : await wikisourceBook(m[4], m[5], meta, (n, total) => (status.textContent = T(`Собираю книгу: глава ${n} из ${total}`)))
      if (!m[1]) book = window.ArcadeBookFormat.cleanWikisource(book)
      window.ArcadeBookFormat.check(book)
      book = { ...book, title: book.title || meta.title, author: book.author || meta.author, lang: book.lang || meta.lang }
      await window.ArcadeMine.save({ id: ref, console: 'books', ref, title: book.title, author: book.author, lang: book.lang, credit, book, size: JSON.stringify(book).length, added: Date.now() })
      status.remove()
      document.title = `${book.title} · Arcade`
      render(book, ref)
    } catch (err) {
      status.textContent = T(`Не получилось открыть книгу: ${err.message}`)
      status.classList.add('failed')
      const back = el('a', 'reader-back', T('← К книгам'))
      back.href = '?tab=books'
      status.append(document.createElement('br'), back)
    }
  }

  window.ArcadeReader = { startMine, startRef }
})()
