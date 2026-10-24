// Arcade: где открываются игры, адреса страниц, подписи настроек.
import { SITE, minePageUrl, pageUrl, tabPageUrl } from '../catalog.js'
import { launchCommand, windowBounds } from '../browsers.js'
import { watchUrl } from '../youtube.js'
import { listenUrl, readUrl } from '../rss.js'
import { liveUrl } from '../twitch.js'
import { GRAPHICS_LABEL, LAUNCH_TIMEOUT_MS, S } from './state.js'
import { gameById } from './library.js'
import { windowNotice } from './status.js'
import { desktopWindow } from './desktop.js'
import { twitchList } from './watch.js'

export function windowMode() {
  return S.platform !== null && (S.opener ?? 'window') === 'window'
}

// Открывать ли игру окном браузера на этой поверхности. В терминале — по выбору в настройках (по умолчанию да).
// В VS Code по умолчанию игра в панели, окно — только если его выбрали явно. В Desktop Денди всегда в панели,
// остальное — по своей настройке (builtinBrowser).
export function opensWindow(surface) {
  if (!windowMode()) return false
  if (surface === 'terminal') return true
  return surface === 'vscode' && S.opener === 'window'
}

// Desktop: игра не Денди открывается во встроенном браузере приложения (desktopWindow) — по умолчанию — или окном
// браузера, как в терминале, если так выбрано в настройках. Окно — только когда ОС уже определена. Шутерам (mouse)
// нужна захваченная мышь, а встроенный браузер её не отдаёт — они идут окном и при выбранном встроенном браузере
export function builtinBrowser(surface, mouse = false) {
  return surface === 'desktop' && (!S.platform || (S.desktopOpener === 'builtin' && !mouse))
}

// Шутеры: Doom-подобные и браузерные игры, которым каталог сайта ставит mouse (OpenArena)
export function mouseGame(id) {
  const g = gameById(id)
  return g?.console === 'doom' || g?.mouse === true
}
export const MOUSE_NOTE = 'Встроенный браузер Claude не даёт игре захватить мышь, поэтому шутеры открываются окном браузера.'

export function webGame(id) {
  return gameById(id)?.web === true
}

// Чем открыть окно: выбранный браузер, браузер по умолчанию, если его узнали, или то, что открывает ссылки
function windowTarget() {
  const browsers = S.detection?.browsers ?? []
  const id = S.browserChoice === 'default' ? S.detection?.defaultId : S.browserChoice
  const browser = browsers.find((b) => b.id === id)
  return browser ? { kind: 'browser', browser } : { kind: 'default' }
}

// TikTok смотрят на его сайте: вход — человека, страницы TikTok Arcade не трогает
export const TIKTOK = 'https://www.tiktok.com'

// Команда, которая открывает окно с игрой (или с библиотекой, если id нет) на сайте Arcade.
// На Windows — выбранным браузером, отдельным окном справа; на macOS и Linux — браузером по умолчанию.
export function windowUrl(id) {
  // tiktok — лента «Для тебя», tiktok:<запрос> — поиск TikTok; язык TikTok берёт свой
  if (id === 'tiktok') return `${TIKTOK}/foryou`
  if (typeof id === 'string' && id.startsWith('tiktok:')) return `${TIKTOK}/search?q=${encodeURIComponent(id.slice(7))}`
  // chat — страница чатов на сайте: код ссылки после #, страница обменяет его на свой билет и уберёт из адреса
  if (id === 'chat') return `${SITE}/chat${S.lang === 'ru' ? '' : `?lang=${S.lang}`}#k=${S.chatLink}${S.ch.talk && (S.menu === 'chats:talk' || S.menu === 'chats:members') ? `&c=${S.ch.talk}` : ''}`
  // video:<номер> — страница просмотра с подборкой YouTube; язык она берёт сама
  if (typeof id === 'string' && id.startsWith('video:')) return watchUrl(S.yt.videos, Number(id.slice(6)) || 0, S.lang)
  // article:<номер> — переход к статье через страницу /read, episode:<номер> — выпуск подкаста на странице /listen
  if (typeof id === 'string' && id.startsWith('article:')) return readUrl(S.reads.articles.items[Number(id.slice(8)) || 0], S.lang)
  if (typeof id === 'string' && id.startsWith('episode:')) return listenUrl(S.reads.podcasts.items[Number(id.slice(8)) || 0], S.lang)
  // live:<логин> — страница /live с плеером Twitch; в списке рядом — свои каналы, если канал свой, иначе каталог
  if (typeof id === 'string' && id.startsWith('live:')) return liveUrl(twitchList(id.slice(5)), id.slice(5), S.lang)
  let url
  // tab:<вкладка> или tab:<группа>:<полка>
  if (typeof id === 'string' && id.startsWith('tab:')) url = tabPageUrl(...id.slice(4).split(':'))
  // book:<ссылка> — читалка окна, audio:<ссылка> — проигрыватель; mine:book и mine:audio — «Мои книги» и «Мои
  // аудиокниги» окна, с языком книг: на нём окно покажет свои разделы
  else if (typeof id === 'string' && id.startsWith('book:')) url = `${SITE}/?book=${encodeURIComponent(id.slice(5))}`
  else if (typeof id === 'string' && id.startsWith('audio:')) url = `${SITE}/?audio=${encodeURIComponent(id.slice(6))}`
  else if (id === 'mine:book' || id === 'mine:audio') url = `${SITE}/?tab=${id === 'mine:book' ? 'books' : 'audiobooks'}&section=mine&book-lang=${S.bk.lang}`
  // Денди по сети — та же игра в окне на EmulatorJS (FCEUmm) с его сетевой игрой
  else if (typeof id === 'string' && id.startsWith('net:')) url = `${pageUrl(id.slice(4))}&net=1`
  // Кооператив Freedoom — лобби кооператива этой игры
  else if (typeof id === 'string' && id.startsWith('coop:')) url = `${pageUrl(id.slice(5))}&net=coop`
  // room:<игра>:<код> — комната настольной игры, куда позвали друга или куда позвал друг
  else if (typeof id === 'string' && id.startsWith('room:')) {
    const [, game, code] = id.split(':')
    url = `${pageUrl(game)}&room=${code}`
  } else {
    const m = S.mine.find((x) => x.id === id)
    url = m ? minePageUrl(m) : pageUrl(id)
  }
  if (S.lang === 'ru') return url
  // Язык передаём в адресе: после # — если своя игра там, иначе обычным параметром
  if (url.includes('#')) return `${url}&lang=${S.lang}`
  return url.includes('?') ? `${url}&lang=${S.lang}` : `${url}?lang=${S.lang}`
}

// Сетевая настольная игра: подпись @ника — после #, страница покажет ник соперникам и уберёт его из адреса. Вышли —
// пустая подпись: страница забудет прежнюю. Только в окна, которые мод открывает сам: в просьбу к Claude подпись не идёт
export function withName(url, id) {
  if (gameById(netGame(id))?.kind !== 'board') return url
  if (S.acct.ticket) return `${url}#me=${S.acct.ticket}`
  return S.acct.session ? url : `${url}#me=`
}

// Сетевая игра для окна: Денди — net:<id>, кооператив Doom — coop:<id>, настольная с комнатой — room:<id>:<код>,
// дефматч Doom — сама игра (лобби общее)
export function netWhere(id, room = '') {
  const g = gameById(id)
  if (g?.kind === 'board' && room) return `room:${id}:${room}`
  if (g?.console === 'nes') return `net:${id}`
  if (g?.console === 'doom' && g.net !== 'doom' && g.net !== 'heretic-dm') return `coop:${id}`
  return id
}

// Игра из адреса окна: net:<id>, coop:<id> или room:<id>:<код> → id
function netGame(where) {
  if (typeof where !== 'string') return where
  if (where.startsWith('net:') || where.startsWith('coop:') || where.startsWith('room:')) return where.split(':')[1]
  return where
}

// Открыть сетевую игру: во встроенном браузере Desktop (шутеры — окном) или окном браузера
export async function openNet($, surface, where) {
  const id = netGame(where)
  const title = gameById(id)?.title ?? id
  S.lastGame = id
  if (builtinBrowser(surface, mouseGame(id))) return desktopWindow($, where, `${title} открыт во встроенном браузере Claude.`)
  S.libraryNotice = 'Открываю окно…'
  $.ui.invalidate('ui.render')
  const command = windowCommand(where)
  try {
    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
    windowNotice($, launchNotice(result, id))
    if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
  } catch (err) {
    S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
  }
  $.ui.invalidate('ui.render')
}

export function windowCommand(id) {
  const url = withName(windowUrl(id), id)
  if (S.platform === 'mac') return { argv: ['open', url], env: {} }
  if (S.platform === 'linux') return { argv: ['xdg-open', url], env: {} }
  return launchCommand(windowTarget(), url, windowBounds(S.detection?.screen ?? null), S.profileRoot)
}

// Что сказать после попытки открыть окно
export function launchNotice(result, id) {
  const title = id ? gameById(id)?.title ?? id : 'Arcade'
  if (result?.exitCode === 0) {
    const target = S.platform === 'windows' ? windowTarget() : { kind: 'default' }
    const where = target.kind === 'browser' ? target.browser.name : 'браузере по умолчанию'
    if (id === 'chat') return `Чаты открыты в ${where}.`
    if (typeof id === 'string' && id.startsWith('video:')) return `Видео открыто в ${where}.`
    if (typeof id === 'string' && id.startsWith('article:')) return `Статья открыта в ${where}.`
    if (typeof id === 'string' && id.startsWith('episode:')) return `Выпуск открыт в ${where}.`
    if (typeof id === 'string' && id.startsWith('live:')) return `Трансляция открыта в ${where}.`
    if (typeof id === 'string' && id.startsWith('book:')) return `Книга открыта в ${where}.`
    if (typeof id === 'string' && id.startsWith('audio:')) return `Аудиокнига открыта в ${where}.`
    if (id === 'mine:book') return `«Мои книги» открыты в ${where}.`
    if (id === 'mine:audio') return `«Мои аудиокниги» открыты в ${where}.`
    return id
      ? `${title} открыт в ${where}. Игра стоит на паузе, пока окно не в фокусе.`
      : `Arcade открыт в ${where}: выбирай приставку и игру.`
  }
  const reason = String(result?.stderr ?? '').trim().split('\n')[0] || `код ${result?.exitCode}`
  return `Не получилось открыть окно: ${reason}`
}

// Варианты «где открывать» по кругу: браузер по умолчанию, каждый найденный браузер, панель
export function openerOptions() {
  const browsers = S.platform === 'windows' ? S.detection?.browsers ?? [] : []
  return [
    { opener: 'window', browser: 'default' },
    ...browsers.map((b) => ({ opener: 'window', browser: b.id })),
    { opener: 'pane', browser: S.browserChoice },
  ]
}

// В Desktop: встроенный браузер приложения, окно браузера по умолчанию, окно каждого найденного браузера.
// Каким браузером открывать окно — общий выбор с терминалом
export function desktopOptions() {
  return [{ opener: 'builtin', browser: S.browserChoice }, ...openerOptions().filter((o) => o.opener === 'window')]
}

export function desktopLabel() {
  return builtinBrowser('desktop') ? 'Открывать: встроенный браузер Claude' : windowLabel()
}

export function openerLabel() {
  return windowMode() ? windowLabel() : 'Открывать: здесь, в панели'
}

function windowLabel() {
  if (S.platform !== 'windows') return 'Открывать: окно браузера по умолчанию'
  const searching = S.detection === null ? ' (ищу браузеры…)' : ''
  const browsers = S.detection?.browsers ?? []
  if (S.browserChoice !== 'default') {
    const chosen = browsers.find((b) => b.id === S.browserChoice)
    if (chosen) return `Открывать: окно ${chosen.name}${chosen.app ? '' : ' (обычное окно браузера)'}`
  }
  const fallback = browsers.find((b) => b.id === S.detection?.defaultId)
  return `Открывать: окно браузера по умолчанию${fallback ? ` (${fallback.name})` : ''}${searching}`
}

export function settingsNote(surface) {
  if (surface === 'desktop') return desktopLabel().replace('Открывать: ', 'открывать: ')
  const where = windowMode() ? openerLabel().replace('Открывать: ', 'открывать: ') : 'играть здесь, в панели'
  return windowMode() ? where : `${where} · графика: ${GRAPHICS_LABEL[S.graphics]}`
}

// Где откроется игра — для подсказки под списком игр
export function whereText() {
  if (S.platform !== 'windows') return 'в окне браузера по умолчанию'
  const browsers = S.detection?.browsers ?? []
  if (S.browserChoice !== 'default') {
    const chosen = browsers.find((b) => b.id === S.browserChoice)
    if (chosen) return chosen.app ? `в окне ${chosen.name}` : `в обычном окне ${chosen.name}`
  }
  const fallback = browsers.find((b) => b.id === S.detection?.defaultId)
  return `в окне браузера по умолчанию${fallback ? ` (${fallback.name})` : ''}`
}
