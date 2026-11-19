// Arcade: «Пока тебя не было» — что сделала каждая сессия за последний ход, одной строкой. Строка — начало ответа
// Claude как есть, без Markdown: модель для пересказа не зовём. Сессия пишет её в свою отметку на этом компьютере
// (~/.claude/arcade/agents), на сайт она не уходит. Здесь только чистые функции, без $

export const REPLY_MAX = 160 // знаков в строке ответа, с «…»
export const SEEN_KEY = 'agentsSeen' // в $.store: { [id сессии]: время конца хода, который человек уже видел }
export const SEEN_MAX = 64

// Знаки, которыми кончается фраза: после такой строки точку не ставим
const ENDS = /[.!?:;…»"')\]]$/

// Одна строка Markdown — текстом: без решёток заголовка, цитаты, маркера списка, флажка, ссылок, выделения и кода.
// Пустая или разделитель — ''. heading — это был заголовок
function plainLine(raw) {
  let s = raw.trim()
  if (!s) return { text: '', heading: false }
  // Разделитель таблицы и черта
  if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(s) || /^([-*_]\s*){3,}$/.test(s)) return { text: '', heading: false }
  // Строка таблицы — ячейки через «·»
  if (s.startsWith('|')) s = s.split('|').map((x) => x.trim()).filter(Boolean).join(' · ')
  const heading = /^#{1,6}\s/.test(s)
  s = s
    .replace(/^#{1,6}\s+/, '')
    .replace(/^(>\s?)+/, '')
    .replace(/^([-*+]|\d{1,3}[.)])\s+/, '')
    .replace(/^\[[ xX]\]\s+/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<(https?:\/\/[^>\s]+)>/g, '$1')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ')
    .replace(/`+/g, '')
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, '$2')
    .replace(/~~(?=\S)(.+?)(?<=\S)~~/g, '$1')
    .replace(/(^|[^\w*])\*(?=\S)([^*]+?)(?<=\S)\*(?!\w)/g, '$1$2')
    .replace(/\s+/g, ' ')
    .trim()
  return { text: s, heading }
}

// Обрезать до max знаков (по буквам, не по половинкам эмодзи): по последнему пробелу, если он не слишком далеко, и «…»
export function cut(text, max = REPLY_MAX) {
  const chars = Array.from(text)
  if (chars.length <= max) return text
  let s = chars.slice(0, max - 1).join('')
  const space = s.lastIndexOf(' ')
  if (space >= max * 0.6) s = s.slice(0, space)
  return `${s.replace(/[\s,;:.—–-]+$/, '')}…`
}

// Строка из ответа Claude: начало ответа без Markdown. Ответ начинается с кода — берём текст после него; ответ —
// один код — его первые строки. Пусто — ''
export function replyLine(text, max = REPLY_MAX) {
  if (typeof text !== 'string' || !text.trim()) return ''
  const prose = []
  const code = []
  let fence = ''
  let size = 0
  for (const raw of text.replace(/\r\n?/g, '\n').split('\n')) {
    const m = /^\s*(`{3,}|~{3,})/.exec(raw)
    if (m) {
      if (!fence) fence = m[1]
      else if (m[1][0] === fence[0] && m[1].length >= fence.length) fence = ''
      continue
    }
    if (fence) {
      if (raw.trim() && code.length < 3) code.push(raw.trim().replace(/\s+/g, ' '))
      continue
    }
    const line = plainLine(raw)
    if (!line.text) continue
    prose.push(line)
    size += line.text.length + 1
    if (size > max * 2) break
  }
  const parts = prose.length ? prose : code.map((x) => ({ text: x, heading: false }))
  // Строки — одной фразой: где строка кончилась без знака, ставим точку, после заголовка — двоеточие
  const joined = parts.map((p, i) => (i < parts.length - 1 && !ENDS.test(p.text) ? `${p.text}${p.heading ? ':' : '.'}` : p.text)).join(' ')
  return cut(joined, max)
}

// Что поменялось в начале хода — для сравнения в конце: путь → числа. null — не знаем (не git или ещё не читали)
const sigOf = (f) => `${f.add ?? ''}|${f.del ?? ''}|${f.state ?? ''}`
export function changeBase(changes) {
  if (!changes || !Array.isArray(changes.files)) return null
  return Object.fromEntries(changes.files.filter((f) => typeof f?.path === 'string').map((f) => [f.path, sigOf(f)]))
}
// Сколько файлов поменялось за ход: новые в списке и с другими числами строк. null — не знаем
export function turnFiles(base, changes) {
  if (!base || !changes || !Array.isArray(changes.files)) return null
  return changes.files.filter((f) => typeof f?.path === 'string' && base[f.path] !== sigOf(f)).length
}

// Последний ход из отметки сессии. Чужая отметка — из файла (и, может, от другой версии Arcade): что на неё не похоже,
// не показываем
export function lastOf(r) {
  const x = r?.last
  if (!x || typeof x !== 'object' || !Number.isFinite(x.at) || x.at <= 0) return null
  const text = typeof x.text === 'string' ? cut(x.text.replace(/\s+/g, ' ').trim()) : ''
  const files = Number.isFinite(x.files) && x.files > 0 ? Math.floor(x.files) : 0
  return { text, at: x.at, files }
}

// Что человек уже видел, из $.store: { id: время }. Битое — пусто
export function restoreSeen(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out
  for (const [sid, at] of Object.entries(raw)) if (sid && Number.isFinite(at) && at > 0) out[sid] = at
  return out
}
// Отметить увиденными концы ходов сессий list ([{ sid, at }]) поверх того, что уже в хранилище. Записей — не больше
// SEEN_MAX, самые старые уходят. null — ничего нового
export function addSeen(seen, list) {
  const out = { ...seen }
  let changed = false
  for (const { sid, at } of list) {
    if (!sid || !(at > (out[sid] ?? 0))) continue
    out[sid] = at
    changed = true
  }
  if (!changed) return null
  const keys = Object.keys(out)
  if (keys.length > SEEN_MAX) for (const k of keys.sort((a, b) => out[a] - out[b]).slice(0, keys.length - SEEN_MAX)) delete out[k]
  return out
}
