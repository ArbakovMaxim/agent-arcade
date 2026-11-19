// Arcade: ревью по карточке (п. 37) — чистые части. Построчный diff снимка с файлом, обрезка длинного diff, разбор
// вывода `git diff`, пометки «✓ Принято» / «↩ Вернули» в тексте карточки. Git здесь не запускается: только разбор того,
// что прочитала техническая часть
import { LANGS, tr } from './i18n.js'

export const REVIEW_KEY = 'cardReview' // ключ $.store: краткие итоги ревью по карточкам
export const REVIEW_MAX = 200 // карточек в итогах, не больше
export const REVIEW_SLOTS = 40 // файлов с подробностями (diff) в ~/.claude/arcade/review, не больше
export const REVIEW_FILES = 60 // файлов карточки в подробностях, не больше
export const DIFF_LINES = 150 // строк diff одного файла, не больше
export const DIFF_BYTES = 12_000 // и знаков
export const SNAP_FILE = 256 * 1024 // файл, изменённый ещё до карточки, запоминаем целиком, если не больше
export const SNAP_TOTAL = 2 * 1024 * 1024 // все такие файлы вместе
export const SNAP_PATHS = 500 // столько изменённых до карточки файлов запоминаем, не больше
export const COMMITS_MAX = 20 // коммитов карточки в подробностях
export const COMMENT_MAX = 500 // знаков в комментарии «Вернуть»
const MAX_D = 1_000 // дальше построчный diff не ищет и показывает «всё убрано — всё добавлено»
const CONTEXT = 3 // строк вокруг изменений

const ACCEPT = 'Принято'
const RETURN = 'Вернули'

// Строки файла: без последней пустой (файл кончается переводом строки)
export function splitLines(text) {
  if (!text) return []
  const lines = String(text).split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines
}

// Кратчайший путь правок (Майерс): массив ' ' / '-' / '+'; null — правок больше max
function myers(a, b, max) {
  const n = a.length
  const m = b.length
  const off = max + 1
  const v = new Int32Array(2 * max + 3)
  const trace = []
  let end = -1
  for (let d = 0; d <= max && end < 0; d++) {
    trace.push(v.slice())
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? v[off + k + 1] : v[off + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[off + k] = x
      if (x >= n && y >= m) {
        end = d
        break
      }
    }
  }
  if (end < 0) return null
  const ops = []
  let x = n
  let y = m
  for (let d = end; d >= 0; d--) {
    const w = trace[d]
    const k = x - y
    const pk = k === -d || (k !== d && w[off + k - 1] < w[off + k + 1]) ? k + 1 : k - 1
    const px = w[off + pk]
    const py = px - pk
    while (x > px && y > py) {
      ops.push(' ')
      x--
      y--
    }
    if (d > 0) {
      if (x === px) {
        ops.push('+')
        y--
      } else {
        ops.push('-')
        x--
      }
    }
    x = px
    y = py
  }
  return ops.reverse()
}

// Правки от a к b: общие начало и конец отрезаем сразу, середину — Майерсом
export function editScript(a, b, max = MAX_D) {
  let pre = 0
  while (pre < a.length && pre < b.length && a[pre] === b[pre]) pre++
  let suf = 0
  while (suf < a.length - pre && suf < b.length - pre && a[a.length - 1 - suf] === b[b.length - 1 - suf]) suf++
  const A = a.slice(pre, a.length - suf)
  const B = b.slice(pre, b.length - suf)
  const mid = !A.length ? B.map(() => '+') : !B.length ? A.map(() => '-') : (myers(A, B, Math.min(max, A.length + B.length)) ?? [...A.map(() => '-'), ...B.map(() => '+')])
  return [...Array(pre).fill(' '), ...mid, ...Array(suf).fill(' ')]
}

// Diff двух текстов как у git: куски «@@ -a,b +c,d @@» с тремя строками вокруг. { text, add, del }
export function lineDiff(before, after) {
  const a = splitLines(before)
  const b = splitLines(after)
  const ops = editScript(a, b)
  const rows = []
  let ai = 0
  let bi = 0
  for (const t of ops) {
    if (t === ' ') rows.push({ t, s: a[ai++], ai, bi: ++bi })
    else if (t === '-') rows.push({ t, s: a[ai++], ai, bi })
    else rows.push({ t, s: b[bi++], ai, bi })
  }
  const changed = rows.map((r, i) => (r.t === ' ' ? -1 : i)).filter((i) => i >= 0)
  if (!changed.length) return { text: '', add: 0, del: 0 }
  const hunks = []
  for (const i of changed) {
    const from = Math.max(0, i - CONTEXT)
    const to = Math.min(rows.length - 1, i + CONTEXT)
    const last = hunks.at(-1)
    if (last && from <= last.to + 1) last.to = to
    else hunks.push({ from, to })
  }
  const out = []
  for (const h of hunks) {
    const part = rows.slice(h.from, h.to + 1)
    const olds = part.filter((r) => r.t !== '+').length
    const news = part.filter((r) => r.t !== '-').length
    const first = rows[h.from]
    // Номер первой строки куска: у старого текста — строк до куска плюс один (без строк — номер строки перед ним)
    const aStart = (first.t === '+' ? first.ai : first.ai - 1) + (olds ? 1 : 0)
    const bStart = (first.t === '-' ? first.bi : first.bi - 1) + (news ? 1 : 0)
    out.push(`@@ -${aStart},${olds} +${bStart},${news} @@`)
    for (const r of part) out.push(`${r.t}${r.s.replace(/\r$/, '')}`)
  }
  return { text: out.join('\n'), add: ops.filter((t) => t === '+').length, del: ops.filter((t) => t === '-').length }
}

// Длинный diff — обрезать: { text, cut } — cut: сколько строк не показали
export function cutDiff(text) {
  const lines = String(text ?? '').split('\n')
  if (!text) return { text: '', cut: 0 }
  const keep = []
  let size = 0
  for (const line of lines) {
    if (keep.length >= DIFF_LINES || size + line.length + 1 > DIFF_BYTES) break
    keep.push(line)
    size += line.length + 1
  }
  if (!keep.length) keep.push(lines[0].slice(0, DIFF_BYTES))
  return { text: keep.join('\n'), cut: lines.length - keep.length }
}

// Имя в кавычках, как его пишет git ("a/\303\244.txt"): без кавычек и с разобранными \-последовательностями
export function unquotePath(raw) {
  const s = String(raw ?? '')
  if (!s.startsWith('"') || !s.endsWith('"') || s.length < 2) return s
  const bytes = []
  const body = s.slice(1, -1)
  const SIMPLE = { n: 10, t: 9, r: 13, b: 8, f: 12, v: 11, a: 7, '\\': 92, '"': 34 }
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (ch !== '\\') {
      for (const byte of new TextEncoder().encode(ch)) bytes.push(byte)
      continue
    }
    const next = body[i + 1] ?? ''
    if (/[0-7]/.test(next)) {
      const oct = body.slice(i + 1, i + 4).match(/^[0-7]{1,3}/)[0]
      bytes.push(parseInt(oct, 8) & 255)
      i += oct.length
    } else {
      bytes.push(SIMPLE[next] ?? next.charCodeAt(0))
      i += 1
    }
  }
  return new TextDecoder().decode(new Uint8Array(bytes))
}

// Путь из строки «--- a/путь» / «+++ b/путь»: без приставки и табуляции в конце (git ставит её, если в имени пробел)
function sidePath(line) {
  const raw = unquotePath(line.slice(4).replace(/\t$/, ''))
  if (raw === '/dev/null') return ''
  return raw.replace(/^[ab]\//, '')
}

// Вывод `git diff --no-renames` по нескольким файлам — по файлам: Map путь → { diff, bin }. diff — с первого «@@»
export function splitPatch(out) {
  const files = new Map()
  const text = String(out ?? '')
  if (!text) return files
  const chunks = text.split(/^diff --git /m).slice(1)
  for (const chunk of chunks) {
    const lines = chunk.split('\n')
    const head = lines[0]
    let path = ''
    let bin = false
    let at = -1
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i]
      if (line.startsWith('@@')) {
        at = i
        break
      }
      if (line.startsWith('--- ') || line.startsWith('+++ ')) path = sidePath(line) || path
      else if (line.startsWith('Binary files ')) bin = true
    }
    // Без «---/+++» (двоичный файл, только права) — из заголовка «a/путь b/путь»: обе половины одинаковы
    if (!path) {
      if (head.startsWith('"')) path = unquotePath(head.slice(0, head.indexOf('" ') + 1)).replace(/^a\//, '')
      else if (head.startsWith('a/') && (head.length - 5) % 2 === 0) path = head.slice(2, 2 + (head.length - 5) / 2)
    }
    if (!path) continue
    const body = at < 0 ? '' : lines.slice(at).join('\n').replace(/\n+$/, '')
    files.set(path, { diff: body, bin })
  }
  return files
}

// Пометки ревью — первыми строками текста карточки, на любом из языков Arcade
const marks = (word, sign) => [...new Set(LANGS.map((l) => `${sign} ${tr(word, l)}`))]
const ACCEPTS = marks(ACCEPT, '✓')
const RETURNS = marks(RETURN, '↩')
const LEAD = 3 // пометку ищем в первых строках, не дальше
export const markOf = (line) => (ACCEPTS.includes(line) ? 'accepted' : RETURNS.includes(line) ? 'returned' : '')

// Что сказало ревью по тексту карточки: 'accepted' / 'returned' / ''
export function reviewMark(body) {
  const lines = String(body ?? '').split('\n').slice(0, LEAD)
  for (const line of lines) {
    const mark = markOf(line)
    if (mark) return mark
  }
  return ''
}

// Текст без пометки ревью (строка «↩ Вернули ДД.ММ ЧЧ:ММ: …» с комментарием остаётся)
export function unreview(body) {
  const lines = String(body ?? '').split('\n')
  const i = lines.slice(0, LEAD).findIndex((line) => markOf(line))
  if (i < 0) return String(body ?? '')
  lines.splice(i, 1)
  if (lines[i] === '' && (i === 0 || lines[i - 1] === '')) lines.splice(i, 1)
  return lines.join('\n')
}

// Пометка ревью первой строкой: state 'accepted' / 'returned'; max — предел длины текста
export function reviewed(body, state, lang, max) {
  const rest = unreview(body)
  const line = state === 'accepted' ? `✓ ${tr(ACCEPT, lang)}` : `↩ ${tr(RETURN, lang)}`
  return (rest ? `${line}\n\n${rest}` : line).slice(0, max)
}

// Комментарий «Вернуть» — одной строкой, без пробелов по краям
export const cleanComment = (text) => String(text ?? '').replace(/\s*[\r\n]+\s*/g, ' ').trim().slice(0, COMMENT_MAX)

// Строка комментария в конце карточки: «↩ Вернули 19.11 18:05: добавь тест»
export const returnLine = (lang, when, comment) => `↩ ${tr(RETURN, lang)} ${when}: ${comment}`

// Последний комментарий «Вернуть» из текста карточки (строка returnLine на любом языке) или ''
const WHEN = /^ \d\d\.\d\d \d\d:\d\d: (.*)$/
export function lastComment(body) {
  const lines = String(body ?? '').split('\n')
  for (let i = lines.length - 1; i >= 0; i--) {
    const mark = RETURNS.find((m) => lines[i].startsWith(m))
    const hit = mark && lines[i].slice(mark.length).match(WHEN)
    if (hit) return hit[1].trim()
  }
  return ''
}

// Краткие итоги ревью из $.store — проверенные: { [id]: { at, n, add, del, commits, mixed, git, top, slot, prev, state } }
const ID = /^[a-z0-9]{1,20}$/
const num = (x) => (Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0)
const sum = (x) => (x && typeof x === 'object' ? { n: num(x.n), add: num(x.add), del: num(x.del), commits: num(x.commits) } : null)
export function restoreReviews(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  const list = Object.entries(raw)
    .filter(([id, r]) => ID.test(id) && r && typeof r === 'object' && Number.isFinite(r.at))
    .sort((x, y) => x[1].at - y[1].at)
    .slice(-REVIEW_MAX)
  for (const [id, r] of list) {
    out[id] = {
      at: r.at,
      git: r.git !== false,
      n: num(r.n),
      add: num(r.add),
      del: num(r.del),
      commits: num(r.commits),
      mixed: typeof r.mixed === 'string' ? r.mixed.slice(0, 80) : '',
      top: typeof r.top === 'string' ? r.top.slice(0, 1000) : '',
      slot: Number.isInteger(r.slot) && r.slot >= 1 && r.slot <= REVIEW_SLOTS ? r.slot : 0,
      prev: sum(r.prev),
      state: r.state === 'accepted' || r.state === 'returned' ? r.state : '',
      cut: Boolean(r.cut),
    }
  }
  return out
}

// Свободное место для подробностей: своё прежнее, иначе незанятое, иначе самое старое
export function pickSlot(reviews, id) {
  if (reviews[id]?.slot) return reviews[id].slot
  const used = new Map()
  for (const [x, r] of Object.entries(reviews)) if (r.slot && x !== id) used.set(r.slot, r.at)
  for (let n = 1; n <= REVIEW_SLOTS; n++) if (!used.has(n)) return n
  return [...used.entries()].sort((x, y) => x[1] - y[1])[0][0]
}

// Подробности из файла места — проверенные; чужая карточка (место уже заняли) — null
export function restoreDetail(raw, id) {
  if (!raw || typeof raw !== 'object' || raw.id !== id || !Array.isArray(raw.files)) return null
  const files = raw.files.slice(0, REVIEW_FILES).filter((f) => f && typeof f.path === 'string').map((f) => ({
    path: f.path.slice(0, 1000),
    add: num(f.add),
    del: num(f.del),
    state: ['new', 'gone', 'bin', 'big'].includes(f.state) ? f.state : '',
    diff: typeof f.diff === 'string' ? f.diff.slice(0, DIFF_BYTES + 1000) : '',
    cut: num(f.cut),
  }))
  const commits = Array.isArray(raw.commits) ? raw.commits.slice(0, COMMITS_MAX).filter((c) => typeof c === 'string').map((c) => c.slice(0, 200)) : []
  return { id, at: Number.isFinite(raw.at) ? raw.at : 0, files, more: num(raw.more), commits }
}
