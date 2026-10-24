// Arcade: состояние агента для шапки и полосы над вводом, журнал событий, время, кто ждёт в сети.
import { CONSOLE_NAMES } from '../mine.js'
import { PANE_COLUMNS, S, WIDE_COLUMNS } from './state.js'

function clockTime() {
  const d = new Date()
  return [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':')
}

export function log(text) {
  S.events = [`${clockTime()} ${text}`, ...S.events].slice(0, 6)
}

export function consoleTitle(id) {
  return S.catalog.consoles.find((c) => c.id === id)?.title ?? CONSOLE_NAMES[id] ?? id
}

const WINDOW_NOTICE_MS = 15_000

// Сообщение про окно браузера («… открыт в Google Chrome») — на время: что окно закрыли, мод узнать не может,
// и через минуту такое сообщение уже неправда. Убираем его, если за это время его не сменило другое.
export function windowNotice($, text) {
  S.libraryNotice = text
  $.clock.after(WINDOW_NOTICE_MS, () => {
    if (S.libraryNotice === text) {
      S.libraryNotice = ''
      $.ui.invalidate('ui.render')
    }
  })
}

export const LOBBIES_EVERY_MS = 60_000

// Сводка сайта «кто ждёт» → игры каталога: номер игры EmulatorJS — из хеша ROM, как в окне; Doom — лобби FreeDM
export function waitingFrom(data) {
  const list = []
  for (const g of S.catalog.games) {
    let count = 0
    let variants = []
    if (g.net === 'doom') count = Number(data?.doom) || 0
    else if (g.net === 'heretic-dm') count = Number(data?.dm?.[g.id]) || 0 // BlasphDM
    else if (g.net === 'heretic') count = Number(data?.coop?.[g.id]) || 0 // Blasphemer по сети — кооператив
    else if (g.console === 'doom') count = Number(data?.coop?.[g.id]) || 0 // кооператив Freedoom
    else if (g.kind === 'board') {
      // настольные: у каждого варианта своё лобби — «chess-7» (7 минут), «chess-0» (без таймера), «go-9» (доска 9×9)
      variants = Object.entries(data?.board ?? {})
        .filter(([k]) => k === g.id || k.startsWith(`${g.id}-`))
        .map(([k, v]) => ({ key: k.slice(g.id.length + 1), count: Number(v) || 0 }))
        .filter((v) => v.count > 0)
      count = variants.reduce((n, v) => n + v.count, 0)
    }
    else if (['nes', 'sega', 'sms', 'psx'].includes(g.console) && g.rom?.sha256) count = Number(data?.games?.[parseInt(g.rom.sha256.slice(0, 7), 16)]) || 0
    if (count > 0) list.push({ id: g.id, title: g.title, console: g.console, coop: g.console === 'doom' && g.net !== 'doom' && g.net !== 'heretic-dm', count, ...(variants.some((v) => v.key) ? { variants } : {}) })
  }
  return list.sort((a, b) => b.count - a.count)
}

// Вариант партии: го — размер доски, остальное — контроль времени в минутах (0 — без таймера)
function variantLabel(id, key) {
  if (id === 'go' && /^\d+$/.test(key)) return `${key}×${key}`
  if (key === '0') return 'без таймера'
  return /^\d+$/.test(key) ? `${key} мин` : key
}

export function waitingText() {
  return S.netWaiting
    .slice(0, 2)
    .map((w) => (w.variants ? `${w.title}: ${w.variants.map((v) => `${variantLabel(w.id, v.key)} — ${v.count}`).join(', ')}` : `${w.title} (${w.count})`))
    .join(', ')
}

export function paneColumns() {
  return S.wide ? WIDE_COLUMNS : PANE_COLUMNS
}

export function workedSeconds(now) {
  return Math.max(0, Math.round((now - S.turnStartedAt) / 1000))
}

// Длинный текст — не длиннее max знаков, по границе слова и с многоточием; короткий — как есть
export function clip(text, max) {
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:\-–—|]+$/, '')}…`
}

// Сколько работает агент — по-человечески: «48 с», «2 мин 14 с», «1 ч 5 мин»
export function workedText(seconds) {
  const s = Math.max(0, Math.floor(seconds))
  if (s < 60) return `${s} с`
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  if (h > 0) return m ? `${h} ч ${m} мин` : `${h} ч`
  const rest = s % 60
  return rest ? `${m} мин ${rest} с` : `${m} мин`
}

export function statusText(now) {
  if (S.status === 'working') return `Агент работает ${workedText(workedSeconds(now))}`
  if (S.status === 'permission') return 'Агент ждёт разрешения — Esc, чтобы ответить'
  if (S.status === 'done') return 'Агент закончил — Esc, чтобы вернуться'
  return 'Агент свободен'
}

export function plural(n, one, few, many) {
  const tens = n % 100
  const units = n % 10
  if (tens >= 11 && tens <= 14) return many
  if (units === 1) return one
  if (units >= 2 && units <= 4) return few
  return many
}
