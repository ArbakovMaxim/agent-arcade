// Arcade: YouTube (свои темы и поиск), Twitch, TikTok.
import { siteUrl } from '../catalog.js'
import { openUrlCommand } from '../browsers.js'
import { PICKS, bundledChannels, candidates, channelsFor, choose, clean, contextFrom, feedUrl, parseChannels, parseFeed, parsePicks, parseTopics, picksPrompt, topicsPrompt } from '../youtube.js'
import { freshFound, mix, ownTopic, ownTopicPrompt, parseOwnTopic, parseSearch, plainTopic, rememberTopic, searchUrl } from '../search.js'
import { MY_CHANNELS, liveFirst, parseTwitch, rememberChannel, twitchLogin, twitchUrl } from '../twitch.js'
import { LAUNCH_TIMEOUT_MS, S, emptyReads, feedCache, searchCache } from './state.js'
import { log, windowNotice } from './status.js'
import { builtinBrowser, windowUrl } from './window.js'
import { desktopWindow } from './desktop.js'
import { loadReads } from './read.js'
import { saveSetting } from './profile.js'

// --- YouTube: темы по работе агента, свежие видео из лент каналов --------------------------------------------------
export const FEED_TTL_MS = 2 * 3_600_000
export const CHANNELS_TTL_MS = 6 * 3_600_000 // список каналов с сайта — не чаще раза в 6 часов
export const TOPICS_TTL_MS = 20 * 60_000 // темы подбираем заново, если с прошлого раза работа агента ушла вперёд
export const YT_FETCH_MS = 8_000 // сколько ждать сайт и каждую ленту
export const YT_MODEL_MS = 20_000 // сколько ждать haiku
export const YT_POOL = 30 // сколько кандидатов каждого языка показывать модели
const SEARCH_TTL_MS = 3 * 3_600_000 // найденное по своей теме помним 3 часа: «Другая подборка» не тратит поиск
const SEARCH_FETCH_MS = 15_000 // поиск сайта опрашивает несколько источников — ждём дольше, чем ленту
export const SEARCH_DAYS = 730 // найденное поиском — не старше двух лет, как и на сайте
export const SHOW_DAYS = 365 // выпуски шоу из поиска — за год: нишевые подкасты выходят нечасто

// Ответ сети или null, если не пришёл за ms: у $.http.fetch своего срока нет. init — метод, заголовки и тело запроса
export function fetchWithin($, url, ms, init = undefined) {
  return new Promise((resolve) => {
    let done = false
    const finish = (value) => {
      if (done) return
      done = true
      resolve(value)
    }
    $.clock.after(ms, () => finish(null))
    const answer = init ? $.http.fetch(url, init) : $.http.fetch(url)
    answer.then(finish, () => finish(null))
  })
}

// Список каналов: сохранённый, если свежий, иначе с сайта; сайт не ответил — старый сохранённый или запас мода
async function ytChannels($, now) {
  let stored = null
  try {
    const saved = await $.store.get('ytChannels')
    stored = saved?.list ? parseChannels(saved.list) : null
    if (stored && now - saved.at < CHANNELS_TTL_MS) return stored
    const response = await fetchWithin($, siteUrl('channels.json'), YT_FETCH_MS)
    const fresh = response?.ok ? parseChannels(response.text) : null
    if (fresh) {
      await $.store.set('ytChannels', { at: now, list: fresh })
      return fresh
    }
  } catch (err) {
    log(`каналы YouTube с сайта не получены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  return stored ?? bundledChannels()
}

// Записи ленты канала; лента не ответила — что было в прошлый раз
async function ytFeed($, id, now) {
  const hit = feedCache.get(id)
  if (hit && now - hit.at < FEED_TTL_MS) return hit.entries
  const response = await fetchWithin($, feedUrl(id), YT_FETCH_MS)
  const entries = response?.ok ? parseFeed(response.text) : []
  if (entries.length) feedCache.set(id, { at: now, entries })
  return entries.length ? entries : hit?.entries ?? []
}

// Тема по ключу меню: номер — из подобранных по работе агента, u<id> — своя тема человека
export const topicKey = (text) => (/^u[0-9a-z]+$/.test(text) ? text : Number(text))
export function topicOf(key) {
  return typeof key === 'string' ? S.myTopics.find((t) => `u${t.id}` === key) : S.yt.topics?.[key]
}

// Поиск сайта по своей теме → { list, error }; удачный ответ помним SEARCH_TTL_MS
export async function searchFor($, kind, query, now) {
  const key = `${kind}:${query.toLowerCase()}`
  const hit = searchCache.get(key)
  if (hit && now - hit.at < SEARCH_TTL_MS) return hit.found
  const found = parseSearch(kind, await fetchWithin($, searchUrl(kind, query), SEARCH_FETCH_MS))
  if (found.error) log(`поиск по своей теме (${kind}): ${found.error}`)
  else searchCache.set(key, { at: now, found })
  return found
}

// Почему по своей теме пусто: поиск на сегодня исчерпан, не ответил или ничего не нашёл
export function searchNote(found) {
  if (found?.error === 'limit') return 'Поиск по своей теме на сегодня исчерпан — попробуй завтра.'
  if (found?.error === 'feeds') return 'Подкасты по теме нашлись, но их ленты не ответили. Попробуй чуть позже.'
  if (found?.error) return 'Поиск по своей теме не ответил. Попробуй чуть позже.'
  return 'По этой теме ничего не нашлось — попробуй сказать иначе.'
}

// Своя тема: haiku делает из текста тему с английским запросом; не ответила — текст латиницей сам себе запрос.
// Тема встаёт первой в «Моих темах»; если человек всё ещё в темах раздела kind — открываем её подборку
export async function addTopic($, kind, value) {
  const text = clean(value, 200)
  const say = (note) => {
    S.ownNote = { kind, text: note }
    $.ui.invalidate('ui.render')
  }
  if (text.length < 2) return say('Напиши тему словами — например, «история Рима» или «хлеб на закваске».')
  const request = ++S.ownRequest
  say('Разбираю тему…')
  const now = await $.clock.now()
  let parsed = null
  try {
    const list = await ytChannels($, now)
    const answer = await $.model.complete({ model: 'haiku', ...ownTopicPrompt(text, S.lang, list.directions), maxTokens: 200, timeoutMs: YT_MODEL_MS })
    if (answer.isAnswered) parsed = parseOwnTopic(answer.text, list.directions)
    else log(`своя тема: модель не ответила (${answer.reason})`)
  } catch (err) {
    log(`своя тема не разобрана: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  if (request !== S.ownRequest) return
  parsed ??= plainTopic(text)
  if (!parsed) return say('Не получилось разобрать тему. Попробуй написать её по-английски.')
  if (parsed.refused) return say('Такую тему Arcade не ищет: политика и темы для взрослых — мимо. Попробуй другую.')
  const topic = ownTopic(parsed)
  S.myTopics = rememberTopic(S.myTopics, topic)
  S.ownNote = { kind: '', text: '' }
  try {
    await saveSetting($, 'myTopics', S.myTopics)
  } catch (err) {
    log(`свои темы не сохранены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  // Человек ушёл из тем этого раздела — тема только запомнилась: подборку открытой страницы не трогаем
  const key = `u${topic.id}`
  if (S.menu !== kind) return $.ui.invalidate('ui.render')
  S.menuFrom = S.menu
  S.menu = `${kind}:${key}`
  S.libraryNotice = ''
  if (kind === 'youtube') loadVideos($, key)
  else loadReads($, kind, key)
}

// «Забыть мои темы»: список пустеет и в $.store
export async function forgetTopics($) {
  S.myTopics = []
  S.ownNote = { kind: '', text: '' }
  $.ui.invalidate('ui.render')
  try {
    await saveSetting($, 'myTopics', [])
  } catch (err) {
    log(`свои темы не стёрты: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// --- Twitch: свои каналы и каталог Arcade ---------------------------------------------------------------------------
const TWITCH_TTL_MS = 60_000 // кто в эфире, спрашиваем сайт не чаще раза в минуту — сайт и сам помнит ответ Twitch минуту
const TWITCH_FETCH_MS = 10_000 // сколько ждать сайт: ему самому надо спросить Twitch

// Почему про эфиры не узнать: ключи Twitch у сайта неверные или их нет, лимит, сайт не ответил
export function twitchNote(error) {
  if (error === 'keys') return 'Twitch не принял ключи сайта Arcade — эфиры пока не показать.'
  if (error === 'off') return 'Twitch на сайте Arcade ещё не настроен — эфиры пока не показать.'
  if (error === 'limit') return 'Вопросы к Twitch на сегодня исчерпаны — попробуй завтра.'
  if (error) return 'Сайт Arcade не ответил про эфиры Twitch. Попробуй чуть позже.'
  return ''
}

// Что сайт сказал о каналах logins — поверх прежнего: эфиры других каналов не теряются
function rememberTwitch(logins, found) {
  for (const login of logins) {
    delete S.tw.info[login]
    S.tw.missing.delete(login)
  }
  for (const c of found.channels) S.tw.info[c.login] = c
  for (const login of found.missing) S.tw.missing.add(login)
}

// Кто в эфире: свои каналы и каталог — одним вопросом к сайту. force — «Обновить»: минуту не ждём
export async function loadTwitch($, force = false) {
  const now = await $.clock.now()
  if (S.tw.loading || (!force && !S.tw.error && S.tw.at && now - S.tw.at < TWITCH_TTL_MS)) return
  const request = ++S.tw.request
  const logins = S.tw.channels.map((c) => c.login)
  S.tw.loading = true
  $.ui.invalidate('ui.render')
  const found = parseTwitch(await fetchWithin($, twitchUrl(logins), TWITCH_FETCH_MS))
  if (request !== S.tw.request) return
  S.tw.loading = false
  S.tw.error = found.error
  if (found.error) log(`twitch: ${found.error}`)
  else {
    S.tw.at = now
    rememberTwitch(logins, found)
    S.tw.catalog = found.catalog
  }
  $.ui.invalidate('ui.render')
}

async function saveChannels($) {
  try {
    await saveSetting($, 'twitchChannels', S.tw.channels)
  } catch (err) {
    log(`каналы Twitch не сохранены: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// «Добавить канал»: имя или ссылка на twitch.tv; сайт проверяет, что канал есть. Канал встаёт первым в «Моих каналах»
S.addingChannel = 0
export async function addChannel($, value) {
  const say = (note) => {
    S.tw.note = note
    $.ui.invalidate('ui.render')
  }
  const login = twitchLogin(value)
  if (!login) return say('Напиши имя канала Twitch или ссылку на него — например, twitch.tv/tsoding.')
  if (!S.tw.channels.some((c) => c.login === login) && S.tw.channels.length >= MY_CHANNELS) return say('Своих каналов уже 20 — сначала убери какой-нибудь.')
  const request = ++S.addingChannel
  say('Ищу канал на Twitch…')
  const found = parseTwitch(await fetchWithin($, twitchUrl([login]), TWITCH_FETCH_MS))
  if (request !== S.addingChannel) return
  if (found.error) return say(twitchNote(found.error))
  rememberTwitch([login], found)
  const channel = found.channels.find((c) => c.login === login)
  if (!channel) return say('Такого канала нет на Twitch — проверь имя.')
  S.tw.channels = rememberChannel(S.tw.channels, { login, name: channel.name })
  say(`Канал добавлен: ${channel.name}.`)
  await saveChannels($)
}

// «Убрать канал»: из «Моих каналов» и из $.store
export async function removeChannel($, login) {
  const gone = S.tw.channels.find((c) => c.login === login)
  if (!gone) return
  S.tw.channels = S.tw.channels.filter((c) => c.login !== login)
  S.tw.note = `Канал убран: ${S.tw.info[login]?.name ?? gone.name}.`
  if (!S.tw.channels.length && S.menu === 'twitch:remove') {
    S.menuFrom = S.menu
    S.menu = 'twitch'
  }
  $.ui.invalidate('ui.render')
  await saveChannels($)
}

// Каналы для списка страницы /live: свои — если канал свой, иначе каталог; порядок — как в меню
export function twitchList(login) {
  const own = liveFirst(S.tw.channels, S.tw.info).map((c) => c.login)
  return own.includes(login) ? own : S.tw.catalog.map((c) => c.login)
}

// TikTok: лента «Для тебя» или поиск по запросу. В Desktop — встроенный браузер, иначе — браузер по умолчанию: там
// человек, скорее всего, уже вошёл в TikTok
export async function openTiktok($, surface, query) {
  const id = query ? `tiktok:${query}` : 'tiktok'
  if (builtinBrowser(surface)) return desktopWindow($, id, 'TikTok открыт во встроенном браузере Claude.')
  const url = windowUrl(id)
  const command = S.platform ? openUrlCommand(S.platform, url) : null
  if (!command) {
    S.libraryNotice = `TikTok: ${url}`
    return $.ui.invalidate('ui.render')
  }
  S.libraryNotice = 'Открываю браузер…'
  $.ui.invalidate('ui.render')
  try {
    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
    if (result?.exitCode === 0) {
      S.windowOpenedAt = await $.clock.now() // смотришь в браузере — «агент закончил» придёт системным уведомлением
      windowNotice($, 'TikTok открыт в браузере по умолчанию.')
    } else S.libraryNotice = `TikTok: ${url}`
  } catch (err) {
    S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
  }
  $.ui.invalidate('ui.render')
}

// Темы: haiku читает последнюю работу агента; работы ещё нет или модель не ответила — темы по умолчанию
export async function loadTopics($) {
  const request = ++S.yt.request
  S.yt.loading = 'topics'
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  const list = await ytChannels($, now)
  let text = ''
  try {
    const context = contextFrom(await $.session.messages())
    if (context) {
      const answer = await $.model.complete({ model: 'haiku', ...topicsPrompt(context, S.lang, list.directions), maxTokens: 400, timeoutMs: YT_MODEL_MS })
      if (answer.isAnswered) text = answer.text
      else log(`темы YouTube: модель не ответила (${answer.reason})`)
    }
  } catch (err) {
    log(`темы YouTube не подобраны: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  if (request !== S.yt.request) return
  S.yt = { ...S.yt, topics: parseTopics(text, list.directions), topicsAt: now, topicsLang: S.lang, topic: -1, videos: [], seen: new Set(), loading: '', note: '' }
  // Темы новые — подборки статей и подкастов по старым темам не нужны, и их загрузки тоже
  S.reads = { articles: emptyReads(S.reads.articles.request + 1), podcasts: emptyReads(S.reads.podcasts.request + 1) }
  $.ui.invalidate('ui.render')
}

// Подборка по теме: ленты каналов темы → свежие кандидаты → haiku выбирает. Своя тема — ещё и поиск сайта по её
// запросу: найденное идёт к английским видео вперемешку с лентами каналов по направлениям темы. again — другая
// подборка: уже показанные видео не повторяем, пока есть из чего выбрать
export async function loadVideos($, key, again = false) {
  const topic = topicOf(key)
  if (!topic) return
  const request = ++S.yt.request
  const seen = again && S.yt.topic === key ? new Set([...S.yt.seen, ...S.yt.videos.map((v) => v.id)]) : new Set()
  S.yt = { ...S.yt, topic: key, videos: [], loading: 'videos', note: '' }
  $.ui.invalidate('ui.render')
  const now = await $.clock.now()
  let videos = []
  let note = ''
  let used = seen
  try {
    const list = await ytChannels($, now)
    const pool = async (channels, direction) => candidates(await Promise.all(channels.map((c) => ytFeed($, c.id, now))), direction, now)
    const byDirection = (direction) => {
      const { local, en } = channelsFor(list, direction, S.lang, now)
      return Promise.all([pool(local, direction), pool(en, direction)])
    }
    let found = null
    let mine = []
    let english = []
    if (topic.own) {
      const [search, ...lists] = await Promise.all([searchFor($, 'youtube', topic.query, now), ...topic.directions.map(byDirection)])
      found = search
      mine = lists.reduce((all, [l]) => mix(all, l, Infinity), [])
      english = mix(freshFound(search.list, now, SEARCH_DAYS), lists.reduce((all, [, en]) => mix(all, en, Infinity), []), Infinity)
    } else [mine, english] = await byDirection(topic.direction)
    // Всё уже показывали — начинаем круг заново
    if (mine.length + english.length - [...mine, ...english].filter((v) => seen.has(v.id)).length < PICKS) used = new Set()
    mine = mine.filter((v) => !used.has(v.id)).slice(0, YT_POOL)
    english = english.filter((v) => !used.has(v.id)).slice(0, YT_POOL)
    if (!mine.length && !english.length) note = topic.own ? searchNote(found) : 'Не получилось загрузить видео: YouTube не ответил. Попробуй чуть позже.'
    else {
      let ranked = []
      const answer = await $.model.complete({ model: 'haiku', ...picksPrompt(topic, mine, english, S.lang), maxTokens: 300, timeoutMs: YT_MODEL_MS })
      if (answer.isAnswered) ranked = parsePicks(answer.text, [...mine, ...english])
      else log(`видео YouTube: модель не ответила (${answer.reason})`)
      videos = choose(ranked, mine, english)
    }
  } catch (err) {
    note = `Не получилось загрузить видео: ${String(err?.message ?? err).slice(0, 200)}`
  }
  if (request !== S.yt.request) return
  S.yt = { ...S.yt, videos, seen: used, loading: '', note }
  $.ui.invalidate('ui.render')
}
