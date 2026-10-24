// Twitch в Arcade: свои каналы человека и каталог Arcade — английские эфиры о программировании, технике, науке и
// ретро-играх. Кто в эфире, мод спрашивает у сайта Arcade (/api/twitch): ключи Twitch — у сайта, регистрация не нужна.
// Свои каналы хранятся в $.store. Смотреть — на странице /live сайта: плеер Twitch и список каналов. Здесь нет вызовов
// Claude Code — сеть и хранилище в hooks/app/watch.js.
import { SITE, siteUrl } from './catalog.js'
import { clean, jsonFrom } from './youtube.js'

// Сколько своих каналов помнить и сколько каналов отдавать странице /live
export const MY_CHANNELS = 20
export const PAGE_CHANNELS = 20
const LOGIN = /^[a-z0-9][a-z0-9_]{1,24}$/
const AVATAR = /^https:\/\/static-cdn\.jtvnw\.net\/[\w./%-]+$/
const TOPIC = /^[a-z]{2,20}$/
// Адреса twitch.tv, которые не каналы
const RESERVED = new Set(
  'directory videos settings search p store downloads jobs turbo prime subscriptions inventory wallet friends messages drops login signup logout popout embed moderator u team collections clips following broadcast dashboard bits redeem privacy legal'.split(' '),
)

// Названия направлений каталога (id — как в channels.json сайта)
export const TOPIC_TITLES = {
  news: 'Новинки и презентации',
  ai: 'Искусственный интеллект',
  web: 'Веб-разработка',
  backend: 'Бэкенд и базы данных',
  devops: 'DevOps и облака',
  langs: 'Языки программирования',
  arch: 'Архитектура программ',
  security: 'Безопасность',
  gamedev: 'Разработка игр',
  cs: 'Информатика и алгоритмы',
  tools: 'Инструменты разработчика',
  mobile: 'Мобильная разработка',
  data: 'Данные и аналитика',
  hardware: 'Железо и электроника',
  opensource: 'Открытый код',
  testing: 'Тестирование',
  design: 'Дизайн',
  career: 'Карьера',
  startups: 'Стартапы',
  science: 'Наука',
  space: 'Космос',
  math: 'Математика',
  history: 'История технологий',
  retro: 'Ретро-игры и ретро-компьютеры',
}

// Что написал человек → логин канала или null. Годится имя, @имя и ссылка на канал twitch.tv
export function twitchLogin(text) {
  let t = String(text ?? '').trim()
  const link = t.match(/^(?:https?:\/\/)?(?:(?:www|m)\.)?twitch\.tv\/([^/?#\s]+)\/?(?:[?#].*)?$/i)
  if (link) {
    if (RESERVED.has(link[1].toLowerCase())) return null
    t = link[1]
  }
  t = t.replace(/^@/, '').toLowerCase()
  return LOGIN.test(t) ? t : null
}

// Свои каналы из $.store: что не сходится — пропускаем
export function restoreTwitch(saved) {
  if (!Array.isArray(saved)) return []
  const seen = new Set()
  return saved
    .filter((c) => c && typeof c.login === 'string' && LOGIN.test(c.login) && !seen.has(c.login) && seen.add(c.login))
    .map((c) => ({ login: c.login, name: clean(c.name, 40) || c.login }))
    .slice(0, MY_CHANNELS)
}

// Новый канал — первым, без повторов, не больше MY_CHANNELS
export function rememberChannel(list, channel) {
  return [channel, ...list.filter((c) => c.login !== channel.login)].slice(0, MY_CHANNELS)
}

// Вопрос сайту: кто из этих каналов есть на Twitch и кто в эфире; каталог Arcade приходит в том же ответе
export function twitchUrl(logins) {
  return siteUrl(`api/twitch?logins=${logins.join(',')}`)
}

// Ответ /api/twitch → { channels, missing, catalog, error }. error — '' (сайт ответил), 'limit' (лимит на сегодня),
// 'keys' (Twitch не принял ключи сайта), 'off' (Twitch на сайте не настроен), 'down' (сайт или Twitch не ответили).
// Ответ пришёл по сети, поэтому каждое поле проверяется; каналы с ошибками пропускаются
export function parseTwitch(response) {
  const none = (error) => ({ channels: [], missing: [], catalog: [], error })
  if (!response) return none('down')
  if (response.status === 429) return none('limit')
  const data = jsonFrom(response.text)
  if (response.status === 503 && (data?.error === 'keys' || data?.error === 'off')) return none(data.error)
  if (!response.ok || !data) return none('down')
  const channel = (c) => {
    if (!c || typeof c.login !== 'string' || !LOGIN.test(c.login)) return null
    const out = { login: c.login, name: clean(c.name, 40) || c.login, ...(AVATAR.test(c.avatar ?? '') ? { avatar: c.avatar } : {}), live: null }
    const s = c.live
    if (s && typeof s === 'object')
      out.live = {
        title: clean(s.title, 140),
        game: clean(s.game, 60),
        viewers: Number.isFinite(s.viewers) && s.viewers >= 0 ? Math.floor(s.viewers) : 0,
        ...(Number.isFinite(s.since) ? { since: s.since } : {}),
        mature: s.mature === true,
      }
    return out
  }
  const list = (x) => (Array.isArray(x) ? x : [])
  const channels = list(data.channels).map(channel).filter(Boolean)
  const missing = list(data.missing).filter((l) => typeof l === 'string' && LOGIN.test(l))
  const catalog = list(data.catalog)
    .map((c) => {
      const out = channel(c)
      if (!out || out.live?.mature) return null
      out.topics = list(c.topics).filter((t) => typeof t === 'string' && TOPIC.test(t)).slice(0, 3)
      return out
    })
    .filter(Boolean)
  return { channels, missing, catalog, error: '' }
}

// Свои каналы по порядку для списка: сначала эфиры (больше зрителей — выше), потом остальные в своём порядке
export function liveFirst(list, info) {
  return list
    .map((c, k) => ({ c, k, v: info[c.login]?.live?.viewers ?? -1 }))
    .sort((a, b) => b.v - a.v || a.k - b.k)
    .map((x) => x.c)
}

// Подпись канала: в эфире ли, игра и зрители — числа в формате языка интерфейса; '' — пока не знаем
export function liveStatus(info, missing, lang) {
  if (missing) return 'такого канала нет на Twitch'
  if (!info) return ''
  if (!info.live) return 'не в эфире'
  let n = String(info.live.viewers)
  try {
    n = new Intl.NumberFormat(lang, { notation: 'compact', maximumFractionDigits: 1 }).format(info.live.viewers)
  } catch {
    // без Intl — просто число
  }
  return info.live.game ? `в эфире · ${info.live.game} · зрители: ${n}` : `в эфире · зрители: ${n}`
}

// Страница /live: плеер Twitch и список каналов. Каналы — после #: эту часть браузер не отправляет на сервер.
// Список — не длиннее PAGE_CHANNELS, вокруг выбранного канала. Язык — параметром (русский — без него)
export function liveUrl(logins, login, lang) {
  const all = [...new Set(logins.filter((l) => LOGIN.test(l)))]
  if (!all.includes(login)) all.unshift(login)
  const at = all.indexOf(login)
  const from = Math.max(0, Math.min(at - Math.floor(PAGE_CHANNELS / 2), all.length - PAGE_CHANNELS))
  const win = all.slice(from, from + PAGE_CHANNELS)
  return `${SITE}/live${lang && lang !== 'ru' ? `?lang=${lang}` : ''}#c=${win.join(',')}&i=${win.indexOf(login)}`
}
