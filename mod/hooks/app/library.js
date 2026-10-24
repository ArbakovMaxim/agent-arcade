// Arcade: каталог игр, разделы главного меню, полки, избранное и свои игры.
import { tr } from '../i18n.js'
import { CONSOLE_NAMES, MINE_MAX_BYTES, cleanPath, identifyRom, mineId, sha256Hex, titleFromPath } from '../mine.js'
import { FIELD, S } from './state.js'
import { plural } from './status.js'
import { shownBoard } from './work.js'

export function consoles() {
  return S.catalog.consoles
}

// Группы вкладок и полки: «Игры» — шутеры, гонки, стратегии, настольные
// «Поддержать проект»: ссылка из каталога сайта, пока каталога нет — запасная
const SUPPORT_URL = 'https://ko-fi.com/agentarcade'
export function supportUrl() {
  return S.catalog.support?.url ?? SUPPORT_URL
}

// Пункты главного меню в порядке каталога: группа стоит там, где её первая приставка
export function menuTabs() {
  const tabs = []
  for (const c of consoles()) {
    const g = c.group && groupsList().find((x) => x.id === c.group)
    if (!g) tabs.push(c)
    else if (!tabs.includes(g)) tabs.push(g)
  }
  return tabs
}

// Жанр игры для заголовка раздела: перевод на язык интерфейса и с заглавной буквы («аркада» → «Аркада», «Arcade»)
export function genreLabel(genre) {
  const t = tr(genre, S.lang)
  return t.charAt(0).toLocaleUpperCase() + t.slice(1)
}

export function groupsList() {
  return S.catalog.groups ?? []
}
export function shelvesList() {
  return S.catalog.shelves ?? []
}
export function groupConsoles(groupId) {
  return consoles().filter((c) => c.group === groupId).map((c) => c.id)
}
export function shelfGames(shelfId) {
  return games().filter((g) => g.shelf === shelfId && !g.mine && consoles().some((c) => c.id === g.console && c.group))
}
// Полка как «приставка» для списка игр: заголовок, адрес вкладки окна, группа для «Назад»
export function shelfView(menuId) {
  const s = shelvesList().find((x) => `shelf:${x.id}` === menuId)
  if (!s) return null
  const g = shelfGames(s.id)[0]
  const group = consoles().find((c) => c.id === g?.console)?.group ?? groupsList()[0]?.id
  return { id: menuId, title: s.title, tab: `${group}:${s.id}`, group, list: shelfGames(s.id) }
}

// Игры каталога и проверка клавиш; note — строка под названием в меню
export function games() {
  return [
    ...S.catalog.games.map((g) => {
      // Описание: по-русски, перевод с английского или английское, если перевода на этот язык нет
      const about = S.lang === 'ru' || !g.about_en ? g.about : g.about_i18n?.[S.lang] || g.about_en
      return { ...g, note: `${tr(g.genre, S.lang)}${about ? ` — ${about}` : ''}`, web: true }
    }),
    ...S.mine.map((m) => ({
      id: m.id,
      console: m.console,
      title: m.title,
      note: `${CONSOLE_NAMES[m.console]} — твой файл, хранится только у тебя`,
      rom: { sha256: m.sha256, mine: true },
      web: true, // в окне: страница найдёт файл в браузере или один раз попросит его выбрать
      mine: true,
    })),
    FIELD,
  ]
}

export function mineFile(sha256) {
  return `${S.dataDir}${S.sep}${sha256}.b64`
}

export function gameById(id) {
  return games().find((g) => g.id === id)
}

export function consoleNote(c) {
  const count = c.group === undefined && groupsList().some((g) => g.id === c.id)
    ? games().filter((g) => groupConsoles(c.id).includes(g.console) && !g.mine).length
    : games().filter((g) => g.console === c.id && !g.mine).length
  return count ? `${count} ${plural(count, 'игра', 'игры', 'игр')}` : 'скоро'
}

// Пункт главного меню, где лежит игра или книга: группа («Игры», «Книги») или приставка без группы
export function tabOf(g) {
  const c = consoles().find((x) => x.id === g.console)
  return (c?.group && groupsList().find((x) => x.id === c.group)) || c || null
}
// Избранное: игры и книги по порядку отметки. Чего нет в каталоге (своя игра с другого компьютера) — не показываем
export function favoriteGames() {
  return S.favorites.map((id) => gameById(id)).filter((g) => g && g.id !== FIELD.id)
}
// Избранное внутри группы («Игры») или полки книг: заголовок и что в него входит. null — всё избранное
export function favoritesScope(scope) {
  const shelf = shelfView(scope)
  if (shelf) return { title: shelf.title, has: (g) => shelf.list.some((x) => x.id === g.id) }
  const group = groupsList().find((x) => x.id === scope)
  if (group) return { title: group.title, has: (g) => groupConsoles(group.id).includes(g.console) }
  return null
}

export function libraryTitle() {
  if (S.menu === 'settings') return 'Arcade · настройки'
  if (S.menu === 'lang') return 'Arcade · язык'
  if (S.menu === 'account') return 'Arcade · аккаунт'
  if (S.menu === 'friends' || S.menu.startsWith('friends:')) return 'Arcade · друзья'
  if (S.menu === 'chats' || S.menu.startsWith('chats:')) return 'Arcade · чаты'
  if (S.menu === 'report') return 'Arcade · отчёт об ошибке'
  if (S.menu === 'reports') return 'Arcade · отчёты об ошибках'
  if (S.menu === 'search') return 'Arcade · поиск'
  if (S.menu === 'favorites') return 'Arcade · избранное'
  if (S.menu.startsWith('favorites:')) return `Arcade · ★ ${favoritesScope(S.menu.slice(10))?.title ?? ''}`
  if (S.menu === 'youtube' || S.menu.startsWith('youtube:')) return 'Arcade · YouTube'
  if (S.menu === 'articles' || S.menu.startsWith('articles:')) return 'Arcade · Статьи'
  if (S.menu === 'podcasts' || S.menu.startsWith('podcasts:')) return 'Arcade · Подкасты'
  if (S.menu === 'twitch' || S.menu.startsWith('twitch:')) return 'Arcade · Twitch'
  if (S.menu === 'tiktok') return 'Arcade · TikTok'
  if (S.menu === 'boards' || S.menu.startsWith('board:') || shownBoard()) return 'Arcade · доска проектов'
  if (S.menu === 'notes' || S.menu.startsWith('note:')) return 'Arcade · блокнот'
  if (S.menu === 'books' || S.menu.startsWith('books:')) return 'Arcade · Книги'
  if (S.menu === 'audiobooks' || S.menu.startsWith('audiobooks:')) return 'Arcade · Аудиокниги'
  if (S.menu === 'mine') return 'Arcade · мои игры'
  const c = consoles().find((x) => x.id === S.menu) ?? groupsList().find((x) => x.id === S.menu) ?? shelfView(S.menu)
  return c ? `Arcade · ${c.title}` : 'Arcade'
}

// Добавить свою игру: путь → сообщение для меню. Копия файла — в папку данных, запись — в «Мои игры».
// Файл никуда не отправляется. Вызывают команда /arcade-add и поле «Добавить файл» в меню.
export async function addMine($, rawPath) {
  const path = cleanPath(rawPath)
  let message
  if (!path) {
    message = 'Укажи путь к файлу: /arcade-add C:\\Games\\game.nes — или перетащи файл в терминал после команды.'
  } else if (!S.dataDir) {
    message = 'Не нашёл домашнюю папку, некуда сохранить копию игры.'
  } else {
    try {
      const stat = await $.fs.stat(path).catch(() => null)
      if (!stat) throw new Error(`файл не найден: ${path}`)
      if (stat.kind !== 'file') throw new Error('это не файл')
      if (stat.size > MINE_MAX_BYTES) {
        throw new Error('файл больше 4 МБ. Здесь добавляются игры Денди и Sega, а диски PlayStation — в окне Arcade: меню PlayStation → «Открыть в окне»')
      }
      const { base64 } = await $.fs.read(path, { as: 'bytes' })
      const bytes = Uint8Array.fromBase64(base64)
      const info = identifyRom(bytes, path)
      if (info.error) throw new Error(info.error)
      const sha = await sha256Hex(bytes)
      const title = titleFromPath(path)
      if (S.mine.some((m) => m.sha256 === sha)) {
        message = `«${title}» уже есть в «Моих играх».`
      } else {
        await $.fs.write(mineFile(sha), base64)
        S.mine = [...S.mine, { id: mineId(sha), console: info.console, title, sha256: sha }]
        await $.store.set('mine', S.mine)
        message = `Добавлено: ${title} (${CONSOLE_NAMES[info.console]}).`
      }
    } catch (err) {
      message = `Не получилось добавить: ${err?.message ?? err}`
    }
  }
  return message
}
