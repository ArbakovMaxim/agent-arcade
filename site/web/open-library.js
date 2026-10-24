// Открытая библиотека в окне: книги (Project Gutenberg и Викитека) и аудиокниги (LibriVox) — список приходит с
// сервера (/api/books/list), у себя книг не храним. Язык книг выбирает читатель (сначала — язык окна), разделы одни
// на все языки, поиск — по названию или автору. «Мои книги» и «Мои аудиокниги» — открытое и скачанное в этом
// браузере и свои файлы. Вкладки books и audiobooks рисует library.js, их содержимое — здесь.
;(function () {
  'use strict'

  // Те же языки и разделы, что у сервера (site/worker/books.js): тест следит, чтобы списки совпадали
  const LANGS = ['en', 'fr', 'de', 'es', 'it', 'pt', 'nl', 'ru', 'uk', 'pl', 'cs', 'hu', 'ro', 'bg', 'el', 'la', 'fi', 'sv', 'da', 'no', 'ca', 'eo', 'tr', 'he', 'ar', 'hi', 'zh', 'ja', 'ko', 'tl']
  const SECTIONS = {
    popular: 'Популярное',
    fiction: 'Проза',
    poetry: 'Стихи',
    drama: 'Пьесы',
    adventure: 'Приключения',
    detective: 'Детективы',
    love: 'О любви',
    scifi: 'Фантастика',
    fairy: 'Сказки',
    children: 'Детям',
    stories: 'Рассказы',
    horror: 'Ужасы',
    humor: 'Юмор',
    history: 'История',
    biography: 'Биографии',
    philosophy: 'Философия',
    religion: 'Религия',
    science: 'Наука',
    travel: 'Путешествия',
  }
  const SOURCES = { gutenberg: 'Project Gutenberg', wikisource: 'Викитека', librivox: 'LibriVox' }
  const KINDS = {
    book: { tab: 'books', mine: 'Мои книги', param: 'book' },
    audio: { tab: 'audiobooks', mine: 'Мои аудиокниги', param: 'audio' },
  }
  const LANG_KEY = 'arcade:books-lang'
  const AUDIO_ACCEPT = '.mp3,.m4a,.m4b,.aac,.ogg,.oga,.opus,.wav,audio/*' // как в audio.js: окно выбора файлов — сразу по нажатию

  const store = (fn, fallback) => {
    try {
      return fn()
    } catch {
      return fallback // без хранилища
    }
  }
  // Название языка — на нём самом: «Українська», «Deutsch», «日本語»
  const langName = (code) => {
    const name = store(() => new Intl.DisplayNames([code], { type: 'language' }).of(code), code) || code
    return name.charAt(0).toLocaleUpperCase(code) + name.slice(1)
  }
  const startLang = () => {
    const fromUrl = new URLSearchParams(location.search).get('book-lang')
    if (LANGS.includes(fromUrl)) return fromUrl
    const saved = store(() => localStorage.getItem(LANG_KEY), null)
    if (LANGS.includes(saved)) return saved
    const own = window.ArcadeI18n && window.ArcadeI18n.lang
    return LANGS.includes(own) ? own : 'en'
  }

  // Состояние по виду: язык общий, раздел и поиск — у книг и аудио свои
  const lang = { code: startLang() }
  const state = {}
  function stateOf(kind) {
    if (state[kind]) return state[kind]
    const params = new URLSearchParams(location.search)
    const fromUrl = params.get('tab') === KINDS[kind].tab
    const section = fromUrl ? params.get('section') : null
    const q = fromUrl ? (params.get('q') || '').slice(0, 80) : ''
    state[kind] = {
      section: q ? null : section === 'mine' || Object.hasOwn(SECTIONS, section || '') ? section : null, // null — решим по «Моим»
      q,
      items: [],
      page: 0,
      more: false,
      loading: false,
      error: '',
      mine: null, // список «Моих» — после первой загрузки
      run: 0, // номер запроса: ответ на старый запрос не рисуем
      box: null, // куда рисовать список
    }
    return state[kind]
  }

  function el(tag, className, text) {
    const node = document.createElement(tag)
    if (className) node.className = className
    if (text !== undefined) node.textContent = text
    return node
  }

  // Адрес вкладки: язык, раздел или поиск — его можно скопировать, «Назад» вернёт на прошлый раздел
  function remember(kind) {
    const s = stateOf(kind)
    const params = new URLSearchParams({ tab: KINDS[kind].tab, 'book-lang': lang.code })
    if (s.q) params.set('q', s.q)
    else if (s.section) params.set('section', s.section)
    history.pushState(null, '', `?${params}`)
  }

  let audioScript = null
  function loadAudio() {
    audioScript ??= new Promise((resolve, reject) => {
      if (window.ArcadeAudio) return resolve()
      const script = document.createElement('script')
      script.src = 'audio.js'
      script.onload = resolve
      script.onerror = () => reject(new Error(T('Не удалось загрузить проигрыватель.')))
      document.body.appendChild(script)
    })
    return audioScript
  }

  async function loadMine(kind) {
    const s = stateOf(kind)
    try {
      if (kind === 'book') s.mine = window.ArcadeMine ? await window.ArcadeMine.list('books') : []
      else {
        await loadAudio()
        s.mine = await window.ArcadeAudio.listMine()
      }
    } catch {
      s.mine = []
    }
  }

  // Список раздела или поиска; more — следующая страница к уже показанной
  async function load(kind, more) {
    const s = stateOf(kind)
    const run = ++s.run
    s.loading = true
    s.error = ''
    if (!more) {
      s.items = []
      s.page = 0
      s.more = false
    }
    paint(kind)
    const params = new URLSearchParams({ kind, lang: lang.code, page: String(s.page + 1) })
    if (s.q) params.set('q', s.q)
    else params.set('section', s.section)
    try {
      const response = await fetch(`/api/books/list?${params}`)
      if (!response.ok) throw new Error(T(`сервер ответил ${response.status}`))
      const data = await response.json()
      if (run !== s.run) return
      // Книга Викитеки бывает и на следующей странице раздела — там другая её глава; показываем один раз
      const shown = new Set(s.items.map((i) => i.ref))
      s.items = s.items.concat((Array.isArray(data.items) ? data.items : []).filter((i) => !shown.has(i.ref)))
      s.page += 1
      s.more = Boolean(data.more)
    } catch (err) {
      if (run !== s.run) return
      s.error = err && err.message ? err.message : T('нет связи')
    }
    s.loading = false
    paint(kind)
  }

  function choose(kind, section) {
    const s = stateOf(kind)
    s.section = section
    s.q = ''
    remember(kind)
    rerender()
    if (section === 'mine') loadMine(kind).then(() => paint(kind))
    else load(kind)
  }

  function search(kind, text) {
    const s = stateOf(kind)
    const q = text.replace(/\s+/g, ' ').trim().slice(0, 80)
    if (q.length < 2) return
    s.q = q
    s.section = null
    remember(kind)
    rerender()
    load(kind)
  }

  function setLang(kind, code) {
    lang.code = code
    store(() => localStorage.setItem(LANG_KEY, code))
    // Список другого вида — тоже на старом языке: при переходе туда загрузим заново
    for (const k of Object.keys(state)) if (k !== kind) state[k].page = 0
    const s = stateOf(kind)
    if (s.section === 'mine') s.section = 'popular'
    remember(kind)
    rerender()
    load(kind)
  }

  // Прочитано и прослушано — по закладке и запомненному месту
  function progress(kind, ref) {
    const at = store(() => JSON.parse(localStorage.getItem(`arcade:${kind}:${ref}`)), null)
    if (kind === 'book') return at && typeof at.percent === 'number' ? T(`прочитано ${at.percent}%`) : T('ещё не читали')
    const total = at && Number(at.total)
    return total ? T(`прослушано ${Math.min(100, Math.round(((Number(at.chapter) || 0) / total) * 100))}%`) : T('ещё не слушали')
  }

  function card(kind, href, title, label, stats) {
    const node = el('a', 'card')
    node.href = href
    const top = el('div', 'card-top')
    top.append(el('span', 'title', title), el('span', 'genre', label))
    node.append(top)
    if (stats) node.append(el('div', 'stats', stats))
    return node
  }

  const link = (kind, ref) => `?${KINDS[kind].param}=${encodeURIComponent(ref)}`
  const sourceOf = (ref) => T(SOURCES[String(ref).split(':')[0]] || '')
  const both = (a, b) => [a, b].filter(Boolean).join(' · ')

  function paintMine(kind, box) {
    const s = stateOf(kind)
    if (!s.mine) {
      box.append(el('div', 'empty', T('Загружаю…')))
      return
    }
    if (!s.mine.length) {
      box.append(el('div', 'empty', kind === 'book' ? T('Здесь пока пусто: открой книгу из раздела или найди её — она останется в этом браузере. Свой файл EPUB, FB2 или TXT — кнопка «Открыть свой файл».') : T('Здесь пока пусто: скачай аудиокнигу из раздела или открой свои файлы — они останутся в этом браузере.')))
      return
    }
    for (const m of s.mine) {
      const own = kind === 'book' ? !m.ref : String(m.id).startsWith('my-audio-')
      const href = kind === 'book' && own ? `#mine=${encodeURIComponent(m.id)}` : link(kind, m.ref || m.id)
      const label = own ? (kind === 'book' ? T('свой файл') : T('свои файлы')) : both(m.author, sourceOf(m.ref || m.id))
      const node = card(kind, href, m.title, label, both(progress(kind, m.ref || m.id), m.size ? T(`${(m.size / 1024 / 1024).toFixed(1)} МБ`) : ''))
      const remove = el('button', 'remove', '✕')
      remove.type = 'button'
      remove.title = T('Удалить из этого браузера')
      remove.addEventListener('click', async (e) => {
        e.preventDefault()
        e.stopPropagation()
        if (kind === 'book') await window.ArcadeMine.remove(m.id)
        else await window.ArcadeAudio.removeMine(m.id)
        await loadMine(kind)
        paint(kind)
      })
      node.querySelector('.card-top').append(remove)
      box.append(node)
    }
  }

  // Список — отдельно от кнопок: ответ сервера перерисовывает только его, поле поиска не теряет фокус
  function paint(kind) {
    const s = stateOf(kind)
    const box = s.box
    if (!box || !box.isConnected) return
    box.replaceChildren()
    if (s.section === 'mine') return paintMine(kind, box)
    if (s.section === null && !s.q) return box.append(el('div', 'empty', T('Загружаю…')))
    for (const item of s.items) box.append(card(kind, link(kind, item.ref), item.title, both(item.author, sourceOf(item.ref)), progress(kind, item.ref)))
    if (s.loading) box.append(el('div', 'empty', s.q ? T('Ищу…') : T('Загружаю список…')))
    else if (s.error) {
      const fail = el('div', 'empty failed', T(`Список не загрузился: ${s.error}`))
      const again = el('button', 'open-rom ol-more', T('Ещё раз'))
      again.type = 'button'
      again.addEventListener('click', () => load(kind, s.items.length > 0))
      fail.append(' ', again)
      box.append(fail)
    } else if (!s.items.length) {
      const empty = !s.q
        ? 'В этом разделе на этом языке пока пусто. Попробуй поиск или другой язык книг.'
        : kind === 'audio'
          ? 'Ничего не нашлось. Попробуй другое название или автора — у LibriVox они часто записаны латиницей.'
          : 'Ничего не нашлось. Попробуй другое название или автора.'
      box.append(el('div', 'empty', T(empty)))
    } else if (s.more) {
      const more = el('button', 'open-rom ol-more', T('Ещё'))
      more.type = 'button'
      more.addEventListener('click', () => load(kind, true))
      box.append(more)
    }
  }

  let rerender = () => {}

  // Вкладка книг или аудиокниг: язык и поиск, ряд разделов, список. redraw — перерисовать всю библиотеку
  function view(kind, redraw) {
    rerender = redraw
    const s = stateOf(kind)
    const wrap = el('div', 'open-library')

    const controls = el('form', 'ol-controls')
    const pick = el('select', 'open-rom lang')
    pick.title = T('Язык книг')
    for (const code of LANGS) {
      const option = el('option', '', `📚 ${langName(code)}`)
      option.value = code
      pick.append(option)
    }
    pick.value = lang.code
    pick.addEventListener('change', () => setLang(kind, pick.value))
    const input = el('input')
    input.type = 'search'
    input.name = 'q'
    input.maxLength = 80
    input.value = s.q
    input.placeholder = T('Название или автор')
    input.setAttribute('aria-label', T('Найти книгу'))
    const find = el('button', 'open-rom', T('Найти'))
    find.type = 'submit'
    controls.append(pick, input, find)
    controls.addEventListener('submit', (e) => {
      e.preventDefault()
      search(kind, input.value)
    })
    wrap.append(controls)

    const row = el('div', 'tabs shelves genres')
    for (const [id, title] of [['mine', KINDS[kind].mine], ...Object.entries(SECTIONS)]) {
      const button = el('button', id === s.section && !s.q ? 'tab shelf genre-chip active' : 'tab shelf genre-chip', T(title))
      button.type = 'button'
      button.tabIndex = -1
      button.dataset.section = id
      button.addEventListener('click', () => choose(kind, id))
      row.append(button)
    }
    wrap.append(row)

    if (s.q) wrap.append(el('div', 'genre-head', `${T('Поиск')}: ${s.q}`))
    const box = el('div', 'games')
    s.box = box
    wrap.append(box)

    // Первый показ: раздел из адреса; без него — «Мои», если там что-то есть, иначе «Популярное»
    if (s.mine === null) {
      loadMine(kind).then(() => {
        if (s.section === null && !s.q) {
          s.section = s.mine.length ? 'mine' : 'popular'
          rerender()
        }
        if (s.section !== 'mine' && !s.page && !s.loading) load(kind)
        else paint(kind)
      })
    } else if (s.section !== 'mine' && (s.section || s.q) && !s.page && !s.loading && !s.error) load(kind)
    paint(kind)
    return wrap
  }

  // «Открыть свои файлы» на вкладке аудиокниг: несколько файлов — главы одной книги
  function openAudioFiles() {
    const input = el('input')
    input.type = 'file'
    input.multiple = true
    input.hidden = true
    input.accept = AUDIO_ACCEPT
    input.addEventListener('change', async () => {
      const files = input.files
      input.remove()
      if (!files || !files.length) return
      const s = stateOf('audio')
      try {
        await loadAudio()
        const entry = await window.ArcadeAudio.addFiles(files)
        location.search = link('audio', entry.id)
      } catch (err) {
        s.section = 'mine'
        s.error = ''
        rerender()
        if (s.box) s.box.prepend(el('div', 'local-error', err && err.message ? err.message : T('Не удалось открыть файл.')))
      }
    })
    document.body.append(input)
    input.click()
  }

  window.ArcadeOpenLibrary = { LANGS, SECTIONS, view, openAudioFiles }
})()
