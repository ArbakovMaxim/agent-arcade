// Аудиокниги: проигрыватель (главы, пауза, ±30 с, ползунок, скорость, клавиши, кнопки системы — Media Session),
// место прослушивания запоминается само. Книги LibriVox (общественное достояние) — по ссылке librivox:<запись
// archive.org>: звук идёт прямо с archive.org, «Скачать» кладёт главы в этот браузер. Свои аудиокниги — файлы
// MP3/M4A/M4B/OGG/Opus, хранятся только в этом браузере (IndexedDB), на сервер не уходят. Несколько файлов — главы,
// по порядку имён.
;(() => {
  const T = (s) => (typeof window.T === 'function' ? window.T(s) : s)
  const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2]
  const ACCEPT = '.mp3,.m4a,.m4b,.aac,.ogg,.oga,.opus,.wav,audio/*'
  const POS = (id) => `arcade:audio:${id}`
  const memory = new Map() // если IndexedDB недоступна — только до закрытия окна

  // --- Свои аудиокниги: IndexedDB «arcade-audio», хранилище «books» -------------------------------------------------
  let opening = null
  function db() {
    opening ??= new Promise((resolve) => {
      try {
        if (!window.indexedDB) return resolve(null)
        const request = indexedDB.open('arcade-audio', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('books', { keyPath: 'id' })
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    return opening
  }
  function ask(base, mode, make) {
    return new Promise((resolve, reject) => {
      const request = make(base.transaction('books', mode).objectStore('books'))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }
  async function listMine() {
    const base = await db()
    const all = base ? await ask(base, 'readonly', (s) => s.getAll()) : [...memory.values()]
    return (all || []).sort((a, b) => b.at - a.at)
  }
  async function getMine(id) {
    const base = await db()
    return base ? (await ask(base, 'readonly', (s) => s.get(id))) ?? null : memory.get(id) ?? null
  }
  async function removeMine(id) {
    const base = await db()
    if (base) await ask(base, 'readwrite', (s) => s.delete(id))
    memory.delete(id)
    try {
      localStorage.removeItem(POS(id))
    } catch {
      // без хранилища
    }
  }
  // Название: общая часть имён файлов, без номеров и расширения («Остров сокровищ 01.mp3» → «Остров сокровищ»)
  const bare = (name) => name.replace(/\.[^.]+$/, '').replace(/[_]+/g, ' ').trim()
  function titleOf(names) {
    if (names.length === 1) return bare(names[0])
    let prefix = bare(names[0])
    for (const n of names.slice(1)) {
      const b = bare(n)
      let k = 0
      while (k < prefix.length && k < b.length && prefix[k] === b[k]) k++
      prefix = prefix.slice(0, k)
    }
    prefix = prefix.replace(/[\s\-–—._(\[]*\d*$/, '').trim()
    return prefix.length >= 3 ? prefix : bare(names[0])
  }
  async function addFiles(fileList) {
    const files = [...fileList].filter((f) => /^audio\//.test(f.type) || /\.(mp3|m4a|m4b|aac|ogg|oga|opus|wav)$/i.test(f.name))
    if (!files.length) throw new Error(T('Это не аудиофайлы: подойдут MP3, M4A, M4B, OGG, Opus'))
    files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }))
    const entry = {
      id: `my-audio-${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
      title: titleOf(files.map((f) => f.name)),
      files: files.map((f) => ({ name: f.name, type: f.type || 'audio/mpeg', blob: f })),
      size: files.reduce((n, f) => n + f.size, 0),
      at: Date.now(),
    }
    const base = await db()
    if (base) await ask(base, 'readwrite', (s) => s.put(entry))
    else memory.set(entry.id, entry)
    return entry
  }

  // --- Страница ----------------------------------------------------------------------------------------------------
  function el(tag, style, text) {
    const node = document.createElement(tag)
    if (style) node.style.cssText = style
    if (text !== undefined) node.textContent = text
    return node
  }
  function button(label, onClick, cls, active) {
    const b = el('button', `margin:4px;padding:8px 14px;border-radius:8px;border:1px solid ${active ? '#7fb2ff' : '#3a3a44'};background:${active ? '#24324a' : '#1c1c22'};color:#e6e6ea;cursor:pointer;font:inherit`, label)
    b.type = 'button'
    if (cls) b.className = cls
    b.addEventListener('click', onClick)
    return b
  }
  const time = (s) => {
    s = Math.max(0, Math.floor(s || 0))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const sec = String(s % 60).padStart(2, '0')
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
  }
  const mb = (bytes) => `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} МБ`
  const rootOf = () => {
    document.body.classList.remove('library-mode')
    const screen = document.getElementById('screen')
    if (screen) screen.style.display = 'none'
    for (const node of ['sound', 'restart', 'best', 'net']) {
      const n = document.getElementById(node)
      if (n) n.style.display = 'none'
    }
    const overlay = document.getElementById('overlay')
    if (overlay) overlay.classList.remove('shown')
    const root = el('div', 'max-width:760px;margin:0 auto;padding:14px 18px;color:#e6e6ea;font:15px/1.5 system-ui,sans-serif;overflow:auto;height:100%;box-sizing:border-box')
    root.id = 'audio-root'
    ;(document.getElementById('stage') || document.body).appendChild(root)
    return root
  }

  // Книга из этого браузера: свои файлы или скачанная из LibriVox
  function playMine(root, own) {
    document.title = `${own.title} · Arcade`
    const chapters = own.files.map((f) => ({ title: f.title || bare(f.name), src: URL.createObjectURL(f.blob), seconds: f.seconds }))
    return player(root, { id: own.id, title: own.title, author: own.author || '', reader: '', chapters, mine: true })
  }

  // --- LibriVox: запись archive.org → главы (MP3 64 кбит/с) ---------------------------------------------------------
  const one = (v) => String((Array.isArray(v) ? v[0] : v) ?? '').trim()
  // «18:52», «1:02:03» или секунды «1132.4»
  const seconds = (v) => {
    const parts = String(v ?? '').split(':').map(Number)
    if (parts.some((n) => !Number.isFinite(n))) return 0
    return Math.round(parts.reduce((sum, n) => sum * 60 + n, 0))
  }
  async function librivox(id) {
    const response = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}`)
    if (!response.ok) throw new Error(T(`сервер ответил ${response.status}`))
    const data = await response.json()
    const files = (data.files || []).filter((f) => /_64kb.mp3$/i.test(f.name || ''))
    if (!files.length) throw new Error(T('В этой записи нет глав в MP3.'))
    files.sort((a, b) => (Number.parseInt(a.track, 10) || 0) - (Number.parseInt(b.track, 10) || 0) || a.name.localeCompare(b.name, undefined, { numeric: true }))
    const meta = data.metadata || {}
    const path = (name) => name.split('/').map(encodeURIComponent).join('/')
    return {
      title: one(meta.title) || id,
      author: one(meta.creator),
      chapters: files.map((f) => ({ title: one(f.title) || bare(f.name).replace(/ 64kb$/i, ''), src: `https://archive.org/download/${encodeURIComponent(id)}/${path(f.name)}`, seconds: seconds(f.length), size: Number(f.size) || 0 })),
    }
  }

  // Аудиокнига по ссылке: своя (my-audio-…) или уже скачанная — из браузера; LibriVox — с archive.org, с кнопкой «Скачать»
  async function startRef(ref) {
    const root = rootOf()
    const own = await getMine(ref)
    if (own) return playMine(root, own)
    if (ref.startsWith('my-audio-')) {
      root.append(el('p', 'color:#e0c070', T('Этой аудиокниги в браузере больше нет — открой свои файлы ещё раз')))
      return
    }
    const m = /^librivox:([\w.-]{1,100})$/.exec(ref)
    const status = el('p', 'color:#9a9aa3', T('Загружаю главы…'))
    root.append(status)
    let book
    try {
      if (!m) throw new Error(T('Такой книги нет.'))
      book = await librivox(m[1])
    } catch (err) {
      status.style.color = '#e0c070'
      status.textContent = T(`Не получилось открыть аудиокнигу: ${err.message}`)
      const back = el('a', 'color:#7fb2ff', T('← К аудиокнигам'))
      back.href = '?tab=audiobooks'
      root.append(back)
      return
    }
    status.remove()
    document.title = `${book.title} · Arcade`
    player(root, { id: ref, ...book, reader: '', download: true })
  }

  // «Скачать»: все главы — в этот браузер, по одной; потом книга играет без интернета и лежит в «Моих аудиокнигах»
  function downloadButton(book, status) {
    const total = book.chapters.reduce((n, c) => n + (c.size || 0), 0)
    const b = button(total ? T(`Скачать в этот браузер · ${mb(total)}`) : T('Скачать в этот браузер'), async () => {
      b.disabled = true
      try {
        const files = []
        for (const [i, c] of book.chapters.entries()) {
          status.textContent = T(`Скачиваю главу ${i + 1} из ${book.chapters.length}`)
          const response = await fetch(c.src)
          if (!response.ok) throw new Error(T(`сервер ответил ${response.status}`))
          files.push({ name: `${String(i + 1).padStart(3, '0')}.mp3`, title: c.title, seconds: c.seconds, type: 'audio/mpeg', blob: await response.blob() })
        }
        const entry = { id: book.id, ref: book.id, title: book.title, author: book.author, files, size: files.reduce((n, f) => n + f.blob.size, 0), at: Date.now() }
        const base = await db()
        if (base) await ask(base, 'readwrite', (s) => s.put(entry))
        else memory.set(entry.id, entry)
        status.textContent = T('Скачано: книга играет и без интернета — она в «Моих аудиокнигах»')
        b.remove()
      } catch (err) {
        status.textContent = T(`Не получилось скачать: ${err.message}`)
        b.disabled = false
      }
    }, 'audio-download')
    return b
  }

  // Проигрыватель. book.episode — один выпуск подкаста: без глав, ⏮ ⏭ и списка
  function player(root, book) {
    let saved = {}
    try {
      saved = JSON.parse(localStorage.getItem(POS(book.id))) || {}
    } catch {
      // без хранилища
    }
    let chapter = Math.max(0, Math.min(book.chapters.length - 1, Number(saved.chapter) || 0))
    let speed = SPEEDS.includes(saved.speed) ? saved.speed : 1
    let resumeAt = Number(saved.time) || 0
    const audio = el('audio')
    audio.preload = 'metadata'
    const head = el('div')
    head.append(el('h2', 'margin:6px 0 2px', book.title), el('div', 'color:#9a9aa3', [book.author, book.reader ? `${T('читает')} ${book.reader}` : ''].filter(Boolean).join(' · ')))
    const status = el('p', 'min-height:1.4em;color:#e0c070;margin:8px 0', '')
    const now = el('div', 'font:600 16px system-ui,sans-serif;margin:10px 0 4px', '')
    const bar = el('input', 'width:100%')
    bar.type = 'range'
    bar.min = '0'
    bar.max = '1000'
    bar.value = '0'
    bar.className = 'audio-bar'
    const clock = el('div', 'font:13px ui-monospace,monospace;color:#9a9aa3', '0:00 / 0:00')
    const controls = el('div', 'margin:10px 0')
    const speeds = el('div', 'margin:6px 0')
    const list = el('div', 'margin-top:14px;max-height:40vh;overflow:auto;border:1px solid #3a3a44;border-radius:8px')
    list.className = 'audio-chapters'
    root.append(head, status, now, bar, clock, controls, speeds, list, audio)
    if (book.download) root.insertBefore(downloadButton(book, status), list)

    // Запуск звука: в старых браузерах play() не возвращает Promise, а где-то его нет вовсе
    const playAudio = () => {
      try {
        return Promise.resolve(typeof audio.play === 'function' ? audio.play() : undefined)
      } catch (err) {
        return Promise.reject(err)
      }
    }
    const save = () => {
      try {
        localStorage.setItem(POS(book.id), JSON.stringify({ chapter, time: Math.floor(audio.currentTime || 0), speed, at: Date.now(), total: book.chapters.length }))
      } catch {
        // без хранилища
      }
    }
    const load = (i, at = 0, play = false) => {
      chapter = Math.max(0, Math.min(book.chapters.length - 1, i))
      resumeAt = at
      audio.src = book.chapters[chapter].src
      audio.playbackRate = speed
      if (play) playAudio().catch(() => {})
      draw()
      save()
    }
    const toggle = () => (audio.paused ? playAudio().catch(() => (status.textContent = T('Нажми «Слушать» ещё раз — браузер не дал начать без нажатия'))) : audio.pause && audio.pause())
    const seek = (delta) => {
      audio.currentTime = Math.max(0, Math.min((audio.duration || 0) - 0.5, (audio.currentTime || 0) + delta))
      save()
    }

    function draw() {
      if (!book.episode) now.textContent = `${chapter + 1} / ${book.chapters.length} · ${book.chapters[chapter].title}`
      const main = [
        button(T('−30 с'), () => seek(-30), 'audio-back'),
        button(audio.paused ? T('▶ Слушать') : T('⏸ Пауза'), toggle, 'audio-play', true),
        button(T('+30 с'), () => seek(30), 'audio-forward'),
      ]
      controls.replaceChildren()
      if (book.episode) controls.append(...main)
      else controls.append(button('⏮', () => load(chapter - 1, 0, !audio.paused), 'audio-prev'), ...main, button('⏭', () => load(chapter + 1, 0, !audio.paused), 'audio-next'))
      speeds.replaceChildren()
      speeds.append(
        el('span', 'color:#9a9aa3;margin-right:6px', T('Скорость')),
        ...SPEEDS.map((s) => {
          const b = button(`${s}×`, () => {
            speed = s
            audio.playbackRate = s
            save()
            draw()
          }, 'audio-speed', s === speed)
          b.dataset.speed = s
          return b
        }),
      )
      list.replaceChildren()
      if (book.episode) return
      list.append(
        ...book.chapters.map((c, i) => {
          const row = button(`${i + 1}. ${c.title}${c.seconds ? ` · ${time(c.seconds)}` : ''}`, () => load(i, 0, true), 'audio-chapter', i === chapter)
          row.style.cssText += ';display:block;width:calc(100% - 8px);text-align:left'
          return row
        }),
      )
    }
    const tick = () => {
      const d = audio.duration || book.chapters[chapter].seconds || 0
      clock.textContent = `${time(audio.currentTime)} / ${time(d)}`
      if (d) bar.value = String(Math.round(((audio.currentTime || 0) / d) * 1000))
    }
    audio.addEventListener('loadedmetadata', () => {
      if (resumeAt) audio.currentTime = Math.min(resumeAt, (audio.duration || resumeAt) - 1)
      resumeAt = 0
      audio.playbackRate = speed
      tick()
    })
    audio.addEventListener('timeupdate', tick)
    audio.addEventListener('play', () => {
      status.textContent = ''
      draw()
    })
    audio.addEventListener('pause', () => {
      save()
      draw()
    })
    audio.addEventListener('ended', () => {
      if (chapter < book.chapters.length - 1) load(chapter + 1, 0, true)
      else {
        status.textContent = book.episode ? T('Выпуск дослушан') : T('Книга дослушана')
        save()
      }
    })
    audio.addEventListener('error', () => {
      status.textContent = book.mine
        ? T('Браузер не смог открыть этот файл — попробуй MP3')
        : book.episode
          ? T('Не получилось загрузить выпуск — проверь интернет и нажми «Слушать» ещё раз')
          : T('Не получилось загрузить главу — проверь интернет и нажми «Слушать» ещё раз')
    })
    bar.addEventListener('input', () => {
      const d = audio.duration || 0
      if (d) audio.currentTime = (Number(bar.value) / 1000) * d
    })
    bar.addEventListener('change', save)
    setInterval(() => {
      if (!audio.paused) save()
    }, 5000)
    window.addEventListener('pagehide', save)
    // Клавиши: пробел — пауза, ← → — на 10 секунд
    window.addEventListener('keydown', (e) => {
      if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) && e.target.type !== 'range') return
      if (e.code === 'Space') {
        e.preventDefault()
        toggle()
      } else if (e.code === 'ArrowLeft') seek(-10)
      else if (e.code === 'ArrowRight') seek(10)
    })
    // Кнопки на клавиатуре, наушниках и в системе
    if (navigator.mediaSession && typeof MediaMetadata !== 'undefined') {
      try {
        navigator.mediaSession.metadata = new MediaMetadata({ title: book.chapters[chapter].title, artist: book.author || book.title, album: book.title })
        const handlers = { play: () => playAudio(), pause: () => audio.pause(), seekbackward: () => seek(-30), seekforward: () => seek(30) }
        if (!book.episode) Object.assign(handlers, { previoustrack: () => load(chapter - 1, 0, true), nexttrack: () => load(chapter + 1, 0, true) })
        for (const [action, handler] of Object.entries(handlers)) navigator.mediaSession.setActionHandler(action, handler)
      } catch {
        // браузер без Media Session
      }
    }
    if (book.mine) {
      root.append(el('p', 'color:#6f6f78;font-size:13px;margin-top:14px', T('Файлы этой книги хранятся только в этом браузере и никуда не отправляются')))
      const back = el('a', 'color:#7fb2ff', T('← Мои аудиокниги'))
      back.href = '?tab=audiobooks&section=mine'
      root.append(back)
    }
    load(chapter, resumeAt, false)
    window.ArcadeAudio.player = { audio, book, get chapter() { return chapter }, get speed() { return speed }, load, toggle, seek, save }
  }

  window.ArcadeAudio = { startRef, open: (root, book) => player(root, book), addFiles, listMine, getMine, removeMine, titleOf, ACCEPT }
})()
