// Arcade: статьи, подкасты, книги.
import { siteUrl } from '../catalog.js'
import { PICKS, candidates, channelsFor, choose, parsePicks } from '../youtube.js'
import { bundledFeeds, parseFeeds, parseItems, readsPrompt } from '../rss.js'
import { SEARCH_SHOWS, feedLanguage, freshFound, mix, showFeed } from '../search.js'
import { bookLang, booksPath, parseBooks } from '../books.js'
import { S, emptyBooks, rssCache } from './state.js'
import { log } from './status.js'
import { CHANNELS_TTL_MS, FEED_TTL_MS, SEARCH_DAYS, SHOW_DAYS, YT_FETCH_MS, YT_MODEL_MS, YT_POOL, fetchWithin, searchFor, searchNote, topicOf } from './watch.js'

// --- Статьи и подкасты: те же темы, записи — из открытых RSS- и Atom-лент ---------------------------------------
// Список лент: сохранённый, если свежий, иначе с сайта; сайт не ответил — старый сохранённый или запас мода
async function feedsList($, now) {
  let stored = null
  try {
    const saved = await $.store.get('feedsList')
    stored = saved?.list ? parseFeeds(saved.list) : null
    if (stored && now - saved.at < CHANNELS_TTL_MS) return stored
    const response = await fetchWithin($, siteUrl('feeds.json'), YT_FETCH_MS)
    const fresh = response?.ok ? parseFeeds(response.text) : null
    if (fresh) {
      await $.store.set('feedsList', { at: now, list: fresh })
      return fresh
    }
  } catch (err) {
    log(`ленты статей и подкастов с сайта не получены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  return stored ?? bundledFeeds()
}

// Записи ленты; лента не ответила — что было в прошлый раз. accept — годится ли лента по её тексту (язык шоу из поиска)
async function rssFeed($, feed, kind, now, accept = () => true) {
  const key = `${kind}:${feed.id}`
  const hit = rssCache.get(key)
  if (hit && now - hit.at < FEED_TTL_MS) return hit.items
  const response = await fetchWithin($, feed.url, YT_FETCH_MS)
  const items = response?.ok && accept(response.text) ? parseItems(response.text, feed, kind) : []
  if (items.length) rssCache.set(key, { at: now, items })
  return items.length ? items : hit?.items ?? []
}

// Найденное по своей теме для статей и подкастов → { list, error }. Статьи — с Hacker News и Medium, подписанные сайтом.
// Подкасты: поиск находит шоу, выпуски — из их лент; лента не на английском (по её <language>) не годится. Шоу нашлись,
// а ни одна лента не ответила — error 'feeds'
async function foundReads($, kind, query, now) {
  const found = await searchFor($, kind, query, now)
  if (kind === 'articles') return { ...found, list: freshFound(found.list, now, SEARCH_DAYS) }
  const shows = found.list.slice(0, SEARCH_SHOWS)
  let answered = 0
  const english = (xml) => {
    answered++
    return ['', 'en'].includes(feedLanguage(xml))
  }
  const feeds = await Promise.all(
    shows.map(async (show) => {
      const items = await rssFeed($, showFeed(show), kind, now, english)
      if (items.length) answered++
      return items.map((x) => ({ ...x, s: show.s }))
    }),
  )
  return { error: shows.length && !answered ? 'feeds' : found.error, list: candidates(feeds, '', now, 3, SHOW_DAYS) }
}

// Подборка статей или выпусков по теме: ленты темы (английские — других языков в лентах нет) → свежие кандидаты →
// haiku выбирает. Своя тема — ещё и поиск сайта по её запросу, вперемешку с лентами по направлениям темы. again —
// другая подборка: уже показанное не повторяем, пока есть из чего выбрать
export async function loadReads($, kind, key, again = false) {
  const topic = topicOf(key)
  if (!topic) return
  const was = S.reads[kind]
  const request = was.request + 1
  const seen = again && was.topic === key ? new Set([...was.seen, ...was.items.map((x) => x.id)]) : new Set()
  S.reads = { ...S.reads, [kind]: { ...was, topic: key, items: [], loading: true, note: '', request } }
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  const articles = kind === 'articles'
  let items = []
  let note = ''
  let used = seen
  try {
    const list = await feedsList($, now)
    const byDirection = async (direction) => {
      const { en } = channelsFor({ channels: list[kind] }, direction, 'en', now)
      return candidates(await Promise.all(en.map((f) => rssFeed($, f, kind, now))), direction, now)
    }
    let found = null
    let pool
    if (topic.own) {
      const [search, ...lists] = await Promise.all([foundReads($, kind, topic.query, now), ...topic.directions.map(byDirection)])
      found = search
      pool = mix(search.list, lists.reduce((all, x) => mix(all, x, Infinity), []), Infinity)
    } else pool = await byDirection(topic.direction)
    // Всё уже показывали — начинаем круг заново
    if (pool.filter((x) => !seen.has(x.id)).length < PICKS) used = new Set()
    pool = pool.filter((x) => !used.has(x.id)).slice(0, YT_POOL)
    if (!pool.length)
      note = topic.own
        ? searchNote(found)
        : articles
        ? 'Не получилось загрузить статьи: ленты не ответили. Попробуй чуть позже.'
        : 'Не получилось загрузить выпуски: ленты не ответили. Попробуй чуть позже.'
    else {
      let ranked = []
      const answer = await $.model.complete({ model: 'haiku', ...readsPrompt(topic, pool, kind), maxTokens: 300, timeoutMs: YT_MODEL_MS })
      if (answer.isAnswered) ranked = parsePicks(answer.text, pool)
      else log(`${kind}: модель не ответила (${answer.reason})`)
      items = choose(ranked, [], pool)
    }
  } catch (err) {
    const reason = String(err?.message ?? err).slice(0, 200)
    note = articles ? `Не получилось загрузить статьи: ${reason}` : `Не получилось загрузить выпуски: ${reason}`
  }
  if (request !== S.reads[kind].request) return
  S.reads = { ...S.reads, [kind]: { ...S.reads[kind], items, seen: used, loading: false, note } }
  $.ui.invalidate('ui.render')
}

// Список книг или аудиокниг с сайта: раздел или поиск на языке книг; more — следующая страница к уже показанной.
// Сайт собирает его из Project Gutenberg, Викитеки или archive.org — ждём дольше, чем ленту
const BOOKS_FETCH_MS = 20_000
export async function loadBooks($, kind, { section = '', q = '', more = false } = {}) {
  const was = S.bk[kind]
  const request = was.request + 1
  const page = more ? was.page + 1 : 1
  const next = more ? { ...was, loading: true, error: '', request } : { ...emptyBooks(request), section, q, loading: true }
  S.bk = { ...S.bk, [kind]: next }
  $.ui.invalidate('ui.render')
  const url = siteUrl(booksPath(kind, S.bk.lang, { section: next.section || 'popular', q: next.q, page }))
  const answer = parseBooks(kind, await fetchWithin($, url, BOOKS_FETCH_MS))
  if (request !== S.bk[kind].request) return
  const cur = S.bk[kind]
  const fresh = answer.error ? [] : answer.items.filter((x) => !cur.items.some((y) => y.ref === x.ref))
  S.bk = {
    ...S.bk,
    [kind]: answer.error ? { ...cur, loading: false, error: answer.error } : { ...cur, items: [...cur.items, ...fresh], page, more: answer.more, loading: false },
  }
  if (answer.error) log(`книги: список не загрузился (${answer.error})`)
  $.ui.invalidate('ui.render')
}

// Язык книг сменили: прежние списки — на старом языке, их ответы уже не нужны
function resetBooks(code) {
  if (code !== S.bk.lang) S.bk = { lang: code, book: emptyBooks(S.bk.book.request + 1), audio: emptyBooks(S.bk.audio.request + 1) }
}
export async function setBookLang($, code) {
  resetBooks(code)
  await $.store.set('booksLang', code)
  $.ui.invalidate('ui.render')
}
// Сменили язык интерфейса: язык книг, который человек не выбирал, идёт за ним
export async function followBookLang($) {
  resetBooks(bookLang(await $.store.get('booksLang'), S.lang))
}
