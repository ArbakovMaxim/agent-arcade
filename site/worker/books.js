// Открытая библиотека: книги и аудиокниги из открытых источников, у себя ничего не храним.
// Книги — Project Gutenberg и Викитека нужного языка: в поиске обе, в разделе Викитека — там, где у Gutenberg на этом
// языке нет и страницы книг; аудио — LibriVox на archive.org. Язык выбирает читатель. Gutenberg не отдаёт CORS — поэтому список и файл книги идут через воркер; Викитеку и
// archive.org окно спрашивает и само, но список аудио тоже здесь, чтобы разделы и языки были в одном месте.

const FETCH_MS = 10_000
const RETRY_MS = 500
const PAGE = 25 // книг на странице: столько отдаёт Gutenberg
const MAX_PAGE = 40
const WIKI_MAX = 10 // книг из Викитеки к первой странице поиска
const WIKI_PAGE = 50 // страниц Викитеки на страницу раздела: главы одной книги сворачиваются в книгу, книг выходит меньше
const MAX_FILE = 30 * 1024 * 1024 // EPUB больше 30 МБ не тянем
const LIST_TTL = 6 * 3600 // секунд: список меняется редко
const FILE_TTL = 7 * 86400
const UA = 'Arcade (https://github.com/ArbakovMaxim/agent-arcade)'

// Языки: код Gutenberg и Викитеки → как язык записан у LibriVox на archive.org
export const LANGS = {
  en: ['eng', 'English'],
  fr: ['fre', 'fra', 'French'],
  de: ['ger', 'deu', 'German'],
  es: ['spa', 'Spanish'],
  it: ['ita', 'Italian'],
  pt: ['por', 'Portuguese'],
  nl: ['dut', 'nld', 'Dutch'],
  ru: ['rus', 'Russian'],
  uk: ['ukr', 'Ukrainian'],
  pl: ['pol', 'Polish'],
  cs: ['cze', 'ces', 'Czech'],
  hu: ['hun', 'Hungarian'],
  ro: ['rum', 'ron', 'Romanian'],
  bg: ['bul', 'Bulgarian'],
  el: ['gre', 'ell', 'grc', 'Greek'],
  la: ['lat', 'Latin'],
  fi: ['fin', 'Finnish'],
  sv: ['swe', 'Swedish'],
  da: ['dan', 'Danish'],
  no: ['nor', 'Norwegian'],
  ca: ['cat', 'Catalan'],
  eo: ['epo', 'Esperanto'],
  tr: ['tur', 'Turkish'],
  he: ['heb', 'Hebrew'],
  ar: ['ara', 'Arabic'],
  hi: ['hin', 'Hindi'],
  zh: ['chi', 'zho', 'Chinese'],
  ja: ['jpn', 'Japanese'],
  ko: ['kor', 'Korean'],
  tl: ['tgl', 'Tagalog'],
}

// Разделы одни на все языки: тема Gutenberg (s.слово), темы LibriVox на archive.org и категории Викитеки — элементы
// Wikidata, потому что у каждой Викитеки своё название категории («Романы», «Романи», «Romane»…); берётся первый, у
// которого в Викитеке языка есть категория. popular — самое скачиваемое у Gutenberg, а у Викитеки — романы и стихи
export const SECTIONS = {
  popular: { gutenberg: [], archive: [], wikisource: ['Q3919902', 'Q8263'] },
  fiction: { gutenberg: ['fiction'], archive: ['fiction', 'novel', 'literature'], wikisource: ['Q8938093', 'Q3919902', 'Q8005537', 'Q7233872'] },
  poetry: { gutenberg: ['poetry'], archive: ['poetry', 'poems', 'poem'], wikisource: ['Q8263'] },
  drama: { gutenberg: ['drama'], archive: ['drama', 'play', 'plays', 'tragedy', 'comedy'], wikisource: ['Q6483380', 'Q7149649', 'Q7732583'] },
  adventure: { gutenberg: ['adventure'], archive: ['adventure', 'sea stories'], wikisource: ['Q9248894', 'Q21127839'] },
  detective: { gutenberg: ['detective'], archive: ['mystery', 'detective', 'crime', 'sherlock holmes'], wikisource: ['Q5625331', 'Q7999644'] },
  love: { gutenberg: ['love'], archive: ['romance', 'love'], wikisource: ['Q6464409', 'Q8603685'] },
  scifi: { gutenberg: ['science', 'fiction'], archive: ['science fiction', 'sci-fi', 'fantasy'], wikisource: ['Q6483905', 'Q7005415'] },
  fairy: { gutenberg: ['fairy', 'tales'], archive: ['fairy tales', 'fables', 'folklore'], wikisource: ['Q7214269'] },
  children: { gutenberg: ['juvenile'], archive: ['children', "children's literature", 'young adult'], wikisource: ['Q6469838'] },
  stories: { gutenberg: ['short', 'stories'], archive: ['short stories', 'short story', 'stories'], wikisource: ['Q8741516'] },
  horror: { gutenberg: ['horror'], archive: ['horror', 'ghost stories', 'ghost'], wikisource: ['Q7400403', 'Q8491695'] },
  humor: { gutenberg: ['humor'], archive: ['humor', 'humour', 'satire'], wikisource: ['Q8527584'] },
  history: { gutenberg: ['history'], archive: ['history', 'historical fiction'], wikisource: ['Q8516498', 'Q6242829'] },
  biography: { gutenberg: ['biography'], archive: ['biography', 'autobiography', 'memoirs'], wikisource: ['Q5640343'] },
  philosophy: { gutenberg: ['philosophy'], archive: ['philosophy'], wikisource: ['Q1983674'] },
  religion: { gutenberg: ['religion'], archive: ['religion', 'christianity'], wikisource: ['Q1457903'] },
  science: { gutenberg: ['science'], archive: ['science', 'nature'], wikisource: ['Q7882560'] },
  travel: { gutenberg: ['travel'], archive: ['travel'], wikisource: ['Q8894303'] },
}
// Энциклопедии и словари: их статьи лежат и в тематических категориях Викитеки, но это не книги — из разделов вычитаем
const WIKI_SKIP = ['Q5611832', 'Q7137948']

// Поиск: буквы любых языков, цифры, пробел, дефис и апостроф; до 80 знаков
export function bookQuery(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M}'’ -]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim()
}

const unxml = (text) =>
  String(text ?? '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, '&')
const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max)

// Источник изредка сбивается на одном запросе из многих — тогда второй раз через полсекунды.
// Не повторяем 4xx (кроме 429) и истёкшее время: второй раз будет то же, а человек ждёт вдвое дольше
async function get(url, accept, tries = 2) {
  let response
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(FETCH_MS), headers: { Accept: accept, 'User-Agent': UA } })
    if (response.ok) return response
  } catch (error) {
    if (tries < 2 || error?.name === 'TimeoutError') throw error
  }
  if (response && (tries < 2 || (response.status < 500 && response.status !== 429))) {
    throw new Error(`${new URL(url).hostname}: ${response.status}`)
  }
  await response?.body?.cancel()
  await new Promise((resolve) => setTimeout(resolve, RETRY_MS))
  return get(url, accept, tries - 1)
}

// --- Gutenberg: OPDS-лента поиска ---------------------------------------------------------------------------------
const LANG_SUFFIX = new RegExp(`\\s*\\((?:(?:Middle|Old) )?(?:${Object.values(LANGS).map((v) => v.at(-1)).join('|')})\\)$`)
// Название без приписки языка: «Ivanhoe (Finnish)» → «Ivanhoe»; в <content> — автор
export function parseOpds(xml) {
  const items = []
  for (const [, entry] of String(xml).matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = entry.match(/<id>[^<]*\/ebooks\/(\d+)\.opds<\/id>/)?.[1]
    if (!id) continue // служебные записи ленты: «сортировать по…», «похожие авторы»
    const title = clip(unxml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]), 300).replace(LANG_SUFFIX, '')
    const author = clip(unxml(entry.match(/<content type="text">([\s\S]*?)<\/content>/)?.[1]), 200)
    if (title) items.push({ ref: `gutenberg:${id}`, source: 'gutenberg', title, author })
  }
  return { items, more: /<link rel="next"/.test(xml) }
}

async function gutenberg(lang, section, q, page) {
  const words = q ? q.split(' ') : SECTIONS[section].gutenberg.map((w) => `s.${w}`)
  const url = new URL('https://www.gutenberg.org/ebooks/search.opds/')
  // !cat.audio — без аудиозаписей Gutenberg: их EPUB — только список mp3-глав, читать там нечего
  url.searchParams.set('query', [...words, `l.${lang}`, '!cat.audio'].join(' '))
  url.searchParams.set('sort_order', 'downloads')
  if (page > 1) url.searchParams.set('start_index', String((page - 1) * PAGE + 1))
  return parseOpds(await (await get(url, 'application/atom+xml')).text())
}

// --- Викитека: поиск по названиям и разделы по категориям нужного языка --------------------------------------------
const ABBR = /^(?=.*\p{Lu})[\p{Lu}\p{N}]{2,6}$/u // «ЭСБЕ», «МЭСБЕ», «ТСД3» — так называются словари и энциклопедии
// Глава книги («Война и мир (Толстой)/Том 1») → сама книга. В поиске — если в её названии есть слово запроса; иначе это
// статья словаря или журнала («ВЭ/ВТ/…», «Стара Україна/1925/…») — мимо. В разделе (q пустой) книга берётся всегда,
// кроме сокращений. Страницы-неоднозначности и «ADB:…» — мимо. Автор — из скобок «Название (Автор)», если в скобках не год
export function wikiBooks(pages, q, lang, max = WIKI_MAX) {
  const words = q.toLowerCase().split(' ').filter((w) => w.length > 1)
  const seen = new Set()
  const items = []
  for (const page of [...pages].sort((a, b) => (a.index ?? 0) - (b.index ?? 0))) {
    if (page.pageprops && 'disambiguation' in page.pageprops) continue
    let title = String(page.title ?? '')
    if (/^[^\s/:]{1,12}:/.test(title)) continue
    if (title.includes('/')) {
      title = title.slice(0, title.indexOf('/'))
      const low = title.toLowerCase()
      if (q && !words.some((w) => low.includes(w))) continue
    }
    if (!q && ABBR.test(title)) continue
    if (!title || seen.has(title)) continue
    seen.add(title)
    const m = title.match(/^(.+?) \(([^()]+)\)$/)
    const byAuthor = m && !/^\d{3,4}/.test(m[2]) && !/^(ДО|ВТ)$/.test(m[2])
    items.push({ ref: `wikisource:${lang}:${title}`, source: 'wikisource', title: byAuthor ? m[1] : title, author: byAuthor ? m[2] : '' })
    if (items.length >= max) break
  }
  return items
}

async function wikiApi(host, params) {
  const url = new URL(`https://${host}/w/api.php`)
  for (const [k, v] of Object.entries({ ...params, format: 'json', formatversion: '2' })) url.searchParams.set(k, v)
  return (await get(url, 'application/json')).json()
}

async function wikisource(lang, q) {
  const json = await wikiApi(`${lang}.wikisource.org`, {
    action: 'query', generator: 'search', gsrsearch: q, gsrnamespace: '0', gsrlimit: '30', prop: 'pageprops', ppprop: 'disambiguation',
  })
  return wikiBooks(json?.query?.pages ?? [], q, lang)
}

// Названия категорий в Викитеке языка: раздела — первая, что есть; вычитаемых — все, что есть
async function wikiCategories(lang, section) {
  const site = `${lang}wikisource`
  const own = SECTIONS[section].wikisource
  const json = await wikiApi('www.wikidata.org', { action: 'wbgetentities', ids: [...own, ...WIKI_SKIP].join('|'), props: 'sitelinks', sitefilter: site })
  const name = (id) => json?.entities?.[id]?.sitelinks?.[site]?.title?.replace(/^[^:]+:/, '').replace(/"/g, '')
  return { category: own.map(name).find(Boolean), skip: WIKI_SKIP.map(name).filter(Boolean) }
}

// Раздел из Викитеки: книги категории и всех её подкатегорий (deepcat), сначала те, на которые больше ссылок
async function wikiSection(lang, section, page) {
  const { category, skip } = await wikiCategories(lang, section)
  if (!category) return { items: [], more: false }
  const json = await wikiApi(`${lang}.wikisource.org`, {
    action: 'query', generator: 'search', gsrsearch: [`deepcat:"${category}"`, ...skip.map((c) => `-deepcat:"${c}"`)].join(' '),
    gsrnamespace: '0', gsrlimit: String(WIKI_PAGE), gsroffset: String((page - 1) * WIKI_PAGE), gsrsort: 'incoming_links_desc',
    prop: 'pageprops', ppprop: 'disambiguation',
  })
  return { items: wikiBooks(json?.query?.pages ?? [], '', lang, WIKI_PAGE), more: Boolean(json?.continue) && page < MAX_PAGE }
}

// --- LibriVox на archive.org ---------------------------------------------------------------------------------------
const quoted = (words) => words.map((w) => `"${w.replace(/["\\]/g, '')}"`).join(' OR ')

export function archiveQuery(lang, section, q) {
  const parts = ['collection:librivoxaudio', `language:(${quoted(LANGS[lang])})`]
  // Дефис в начале слова для archive.org — «без этого слова»
  const words = q.replace(/(^| )[-'’]+/g, '$1').trim()
  if (words) parts.push(`(title:(${words}) OR creator:(${words}))`)
  else if (SECTIONS[section].archive.length) parts.push(`subject:(${quoted(SECTIONS[section].archive)})`)
  return parts.join(' AND ')
}

// «Alice's Adventures in Wonderland, by Lewis Carroll» → без «, by …»: автор и так в creator
export function parseArchive(json, page) {
  const docs = json?.response?.docs ?? []
  const items = docs
    .filter((d) => typeof d.identifier === 'string' && /^[\w.-]{1,100}$/.test(d.identifier))
    .map((d) => ({
      ref: `librivox:${d.identifier}`,
      source: 'librivox',
      title: clip(String([].concat(d.title ?? '')[0]).replace(/,\s+by\s+[^,]+$/i, ''), 300),
      author: clip([].concat(d.creator ?? []).join(', '), 200),
    }))
    .filter((i) => i.title)
  return { items, more: (json?.response?.numFound ?? 0) > page * PAGE }
}

async function librivox(lang, section, q, page) {
  const url = new URL('https://archive.org/advancedsearch.php')
  url.searchParams.set('q', archiveQuery(lang, section, q))
  for (const f of ['identifier', 'title', 'creator']) url.searchParams.append('fl[]', f)
  url.searchParams.set('sort[]', 'downloads desc')
  url.searchParams.set('rows', String(PAGE))
  url.searchParams.set('page', String(page))
  url.searchParams.set('output', 'json')
  return parseArchive(await (await get(url, 'application/json')).json(), page)
}

// --- Маршруты ------------------------------------------------------------------------------------------------------
// Кеш Cloudflare: на workers.dev он ничего не делает — тогда просто идём к источнику
async function cached(request, ttl, make) {
  const cache = globalThis.caches?.default
  const key = new Request(new URL(request.url).href, { method: 'GET' })
  try {
    const hit = await cache?.match(key)
    if (hit) return hit
  } catch {
    // кеша нет
  }
  const response = await make()
  // Свой Cache-Control (no-store у неполного списка) — не кешируем
  if (response.ok && !response.headers.has('Cache-Control')) {
    response.headers.set('Cache-Control', `public, max-age=${ttl}`)
    try {
      await cache?.put(key, response.clone())
    } catch {
      // кеша нет
    }
  }
  return response
}

const fail = (status, error) => Response.json({ error }, { status })

// Поиск книги: Gutenberg и, на первой странице, Викитека того же языка; одна из них может не ответить
async function search(lang, q, page) {
  const [gut, wiki] = await Promise.allSettled([gutenberg(lang, 'popular', q, page), page === 1 ? wikisource(lang, q) : []])
  if (gut.status === 'rejected' && (page > 1 || wiki.status === 'rejected')) throw gut.reason
  const found = gut.status === 'fulfilled' ? gut.value : { items: [], more: false }
  const extra = wiki.status === 'fulfilled' ? wiki.value : []
  return { items: [...found.items, ...extra], more: found.more, partial: gut.status === 'rejected' || wiki.status === 'rejected' }
}

// Раздел: Gutenberg; где у него на этом языке нет и страницы книг (русский, украинский, японский…), к ним — книги из
// категорий Викитеки. Следующие страницы такого раздела — уже только Викитека: у Gutenberg там пусто.
// Gutenberg не ответил — хватит и Викитеки (такой список не кешируем); нет книг и там — ошибка Gutenberg
async function shelf(lang, section, page) {
  let gut
  try {
    gut = await gutenberg(lang, section, '', page)
  } catch (error) {
    const wiki = await wikiSection(lang, section, page).catch(() => null)
    if (!wiki?.items.length) throw error
    return { ...wiki, partial: true }
  }
  if (gut.more || (page === 1 ? gut.items.length >= PAGE : gut.items.length)) return gut
  try {
    const wiki = await wikiSection(lang, section, page)
    return { items: [...gut.items, ...wiki.items], more: wiki.more }
  } catch (error) {
    if (!gut.items.length) throw error
    return { ...gut, partial: true }
  }
}

// GET /api/books/list?kind=book|audio&lang=xx&section=id | q=текст &page=N → { items: [{ ref, source, title, author }], more }
async function list(request, url) {
  const p = url.searchParams
  const kind = p.get('kind')
  const lang = p.get('lang')
  const section = p.get('section') || 'popular'
  const q = bookQuery(p.get('q'))
  const page = Math.min(MAX_PAGE, Math.max(1, Number.parseInt(p.get('page') || '1', 10) || 1))
  if (kind !== 'book' && kind !== 'audio') return fail(400, 'kind: book или audio')
  if (!Object.hasOwn(LANGS, lang ?? '')) return fail(400, 'неизвестный язык')
  if (!Object.hasOwn(SECTIONS, section)) return fail(400, 'неизвестный раздел')
  if (p.has('q') && q.length < 2) return fail(400, 'запрос короче двух букв')
  return cached(request, LIST_TTL, async () => {
    try {
      const { partial, ...found } =
        kind === 'audio' ? await librivox(lang, section, q, page) : q ? await search(lang, q, page) : await shelf(lang, section, page)
      // Один из источников не ответил — список неполный: отдаём, но не кешируем
      return Response.json(found, partial ? { headers: { 'Cache-Control': 'no-store' } } : {})
    } catch {
      return fail(502, 'источник не ответил')
    }
  })
}

// GET /api/books/file?gutenberg=1342 → EPUB без картинок: у Gutenberg нет CORS, окно само его не скачает
async function file(request, url) {
  const id = url.searchParams.get('gutenberg') ?? ''
  if (!/^\d{1,6}$/.test(id)) return fail(400, 'номер книги Gutenberg')
  return cached(request, FILE_TTL, async () => {
    try {
      const response = await fetch(`https://www.gutenberg.org/ebooks/${id}.epub.noimages`, {
        signal: AbortSignal.timeout(FETCH_MS * 3),
        headers: { 'User-Agent': UA },
      })
      if (!response.ok) return fail(response.status === 404 ? 404 : 502, 'книги нет')
      if (Number(response.headers.get('Content-Length') || 0) > MAX_FILE) return fail(413, 'книга слишком большая')
      const bytes = await response.arrayBuffer()
      if (bytes.byteLength > MAX_FILE) return fail(413, 'книга слишком большая')
      return new Response(bytes, { headers: { 'Content-Type': 'application/epub+zip' } })
    } catch {
      return fail(502, 'источник не ответил')
    }
  })
}

export function books(request, url) {
  if (request.method !== 'GET') return fail(405, 'только GET')
  if (url.pathname === '/api/books/list') return list(request, url)
  if (url.pathname === '/api/books/file') return file(request, url)
  return fail(404, 'нет такого адреса')
}
