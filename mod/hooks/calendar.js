// Календарь Arcade: события с днём, временем (или на весь день), заметкой и напоминанием. Хранится в $.store мода
// (ключ calendar) — один на все сессии Claude Code, как блокнот. Claude записывает и читает события инструментом
// mcp__arcade__calendar — его ответы для модели, поэтому по-английски. Здесь нет вызовов Claude Code: хранилище и
// напоминания — в hooks/app/calendar.js, экран — в hooks/screens/calendar.js, инструмент — в hooks/register.js.
// Время — по часам компьютера: день — «ГГГГ-ММ-ДД», время — «ЧЧ:ММ». У события на весь день времени нет, и напоминание
// о нём считается от 9:00 этого дня
import { MAX_TITLE, cleanBody, cleanDay, cleanTitle, columnOf, isBoard, isPrompts, isProjectBoard } from './notes.js'

export { cleanDay }

export const MAX_EVENTS = 300
export const MAX_NOTE = 1_000
// Напоминание — за сколько минут до начала: не раньше чем за неделю
export const MAX_REMIND = 7 * 24 * 60
// Что предлагает экран. У события со временем — в момент начала, за 5, 10, 15, 30 минут, за 1 и 2 часа, за сутки,
// двое, неделю или без напоминания. У события на весь день минуты считаются до 9:00 этого дня: в 9:00, 8:00, 7:00,
// накануне в 21:00, 18:00 и 9:00, за два дня и за неделю в 9:00
export const REMIND_CHOICES = [0, 5, 10, 15, 30, 60, 120, 1440, 2880, 10080, null]
export const REMIND_CHOICES_ALL_DAY = [0, 60, 120, 720, 900, 1440, 2880, 10080, null]
// Напоминание нового события: за 15 минут, а о событии на весь день — в 9:00 этого дня
export const defaultRemind = (time) => (time ? 15 : 0)
export const ALL_DAY_HOUR = 9
// Цвета событий: в событии хранится название, без цвета — синий
export const COLORS = {
  blue: '#3B82F6',
  green: '#22A06B',
  yellow: '#E2B203',
  orange: '#F97316',
  red: '#E5484D',
  purple: '#8B5CF6',
  pink: '#E2489B',
  gray: '#8C8F98',
}
export const DEFAULT_COLOR = 'blue'
export const colorOf = (ev) => COLORS[ev?.color] ?? COLORS[DEFAULT_COLOR]
// Напоминания, пропущенные, пока Claude Code был закрыт, показываем, если событие было не раньше суток назад
export const MISSED_MS = 24 * 3600_000
// Сколько дней показывает list у Claude по умолчанию и самое большее
const LIST_DAYS = 7
const MAX_LIST_DAYS = 92
const DAY_MS = 24 * 3600_000
const ID = /^e[a-z0-9]{1,19}$/
const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/
const WEEKDAYS_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const pad = (n) => String(n).padStart(2, '0')
const clip = (text) => String(text ?? '').slice(0, 80)

// День по местным часам: «ГГГГ-ММ-ДД»
export function dayKey(ms) {
  const d = new Date(ms)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const dateOf = (day) => {
  const [y, m, d] = day.split('-').map(Number)
  return new Date(y, m - 1, d)
}
// «9:05» и «09:05» → «09:05»; не время — ''. С точкой — это дата: «12.11»
export function cleanTime(text) {
  const m = TIME.exec(String(text ?? '').trim())
  return m ? `${pad(m[1])}:${m[2]}` : ''
}
export const cleanNote = (text) => cleanBody(text).trim().slice(0, MAX_NOTE)
// Напоминание: null — без него, иначе минуты до начала; не подходит — undefined
export const cleanRemind = (v) => (v === null || v === undefined ? null : Number.isInteger(v) && v >= 0 && v <= MAX_REMIND ? v : undefined)
// Цвет: '' — по умолчанию, иначе название из COLORS; не подходит — undefined
export const cleanColor = (v) => (v === null || v === undefined || v === '' ? '' : typeof v === 'string' && Object.hasOwn(COLORS, v) ? v : undefined)
// Повтор: каждый день, по будням (пн–пт), каждую неделю (в тот же день недели), каждый месяц (того же числа), каждый год.
// day у такого события — первый раз серии. '' — не повторяется; не подходит — undefined
export const REPEATS = ['daily', 'weekdays', 'weekly', 'monthly', 'yearly']
export const cleanRepeat = (v) => (v === null || v === undefined || v === '' ? '' : REPEATS.includes(v) ? v : undefined)

// «Дать Claude» — задание по расписанию: в своё время событие даёт Claude очередь доски, одну карточку, шаблон из
// «Промптов» или свой текст. give — { kind: 'queue', board, name } | { kind: 'card', card, name } | { kind: 'prompt',
// prompt, name } | { kind: 'text', text }; name — название цели, каким оно было, когда её выбрали (цель могут удалить).
// cwd — папка сессии, где задание дали: оно идёт только в открытой сессии этой папки. Отметки — во времени запуска раза
// (fireAt): fired — последний раз, с которым разобрались; firedBy — какая сессия его взяла; held — раз, который пришёл,
// пока Claude был занят (ждёт конца хода); missed — раз, когда ни одной сессии этой папки не было (ждёт «Запустить сейчас»);
// warned — раз, о котором сессия другой папки уже сказала «пропущено» (warnedBy — какая: говорит одна)
export const GIVE_KINDS = ['queue', 'card', 'prompt', 'text']
export const GIVE_KEY = { queue: 'board', card: 'card', prompt: 'prompt' }
export const MAX_TASK = 4_000
const MAX_PATH = 1_000
const PAGE_ID = /^[a-z0-9]{1,20}$/
export function cleanGive(g) {
  if (!g || typeof g !== 'object' || !GIVE_KINDS.includes(g.kind)) return null
  if (g.kind === 'text') {
    const text = cleanBody(g.text).trim().slice(0, MAX_TASK)
    return text ? { kind: 'text', text } : null
  }
  const key = GIVE_KEY[g.kind]
  if (typeof g[key] !== 'string' || !PAGE_ID.test(g[key])) return null
  return { kind: g.kind, [key]: g[key], name: cleanTitle(g.name) }
}
const cleanCwd = (v) => (typeof v === 'string' && v.length <= MAX_PATH ? v.trim() : '')
// Отметки задания — всё, кроме самого задания и папки
const TASK_MARKS = ['fired', 'firedBy', 'held', 'missed', 'warned', 'warnedBy']

// Сдвиг дня и месяца («ГГГГ-ММ»)
export function addDays(day, n) {
  const d = dateOf(day)
  d.setDate(d.getDate() + n)
  return dayKey(d.getTime())
}
export function addMonths(month, n) {
  const [y, m] = month.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}
// День недели: 0 — понедельник
export const weekday = (day) => (dateOf(day).getDay() + 6) % 7

// Начало события, мс: его время, а у события на весь день — полночь
export function startOf(ev) {
  const d = dateOf(ev.day)
  if (ev.time) d.setHours(Number(ev.time.slice(0, 2)), Number(ev.time.slice(3)))
  return d.getTime()
}
// Когда напомнить, мс; без напоминания — null
export function remindAt(ev) {
  if (ev.remind === null || ev.remind === undefined) return null
  const d = dateOf(ev.day)
  if (ev.time) d.setHours(Number(ev.time.slice(0, 2)), Number(ev.time.slice(3)))
  else d.setHours(ALL_DAY_HOUR)
  return d.getTime() - ev.remind * 60_000
}
// Конец события для пропущенных напоминаний: событие на весь день идёт до полуночи
const endOf = (ev) => startOf(ev) + (ev.time ? 0 : DAY_MS)
// Когда задание события уходит Claude, мс: в его время, а у события на весь день — в 9:00
export function fireAt(ev) {
  const d = dateOf(ev.day)
  if (ev.time) d.setHours(Number(ev.time.slice(0, 2)), Number(ev.time.slice(3)))
  else d.setHours(ALL_DAY_HOUR)
  return d.getTime()
}

// Бывает ли событие в этот день: обычное — в свой, повторяющееся — с первого раза по своему правилу. Месячное 31-го
// пропускает короткие месяцы, годовое 29 февраля — невисокосные годы
export function occursOn(ev, day) {
  if (!ev.repeat) return day === ev.day
  if (day < ev.day) return false
  if (ev.repeat === 'daily') return true
  if (ev.repeat === 'weekdays') return weekday(day) < 5
  if (ev.repeat === 'weekly') return weekday(day) === weekday(ev.day)
  if (ev.repeat === 'monthly') return day.slice(8) === ev.day.slice(8)
  return day.slice(5) === ev.day.slice(5)
}
// Один раз серии: то же событие (и тот же id) со своим днём; first — первый раз серии
const instance = (ev, day) => ({ ...ev, day, first: ev.day })
// Серия по будням, начатая в выходной, начинается с понедельника — первый раз серии всегда бывает
const firstDay = (day, repeat) => (repeat === 'weekdays' && weekday(day) > 4 ? addDays(day, 7 - weekday(day)) : day)

// Последний раз события, о котором к now уже пора было напомнить; нет такого — null. У серии смотрим дни от позавчера
// до недели с лишним вперёд: напоминание бывает самое раннее за неделю до начала, а раньше позавчера — давно прошедшие
export function lastReminded(ev, now) {
  if (ev.remind === null || ev.remind === undefined) return null
  if (!ev.repeat) return remindAt(ev) <= now ? ev : null
  const today = dayKey(now)
  const stop = addDays(today, -2)
  for (let d = addDays(today, 8); d >= stop && d >= ev.day; d = addDays(d, -1)) {
    if (!occursOn(ev, d)) continue
    const x = instance(ev, d)
    if (remindAt(x) <= now) return x
  }
  return null
}
// Последний раз задания, которому к now уже пора было уйти; нет — null. У серии смотрим сегодня, вчера и позавчера:
// раньше — давно прошедшие, их уже не запускают
export function lastFired(ev, now) {
  if (!ev.give) return null
  if (!ev.repeat) return fireAt(ev) <= now ? ev : null
  const today = dayKey(now)
  const stop = addDays(today, -2)
  for (let d = today; d >= stop && d >= ev.day; d = addDays(d, -1)) {
    if (!occursOn(ev, d)) continue
    const x = instance(ev, d)
    if (fireAt(x) <= now) return x
  }
  return null
}
// Ближайшее напоминание события впереди, мс; у серии — ближайшего её раза на неделю с лишним вперёд; нет — null
function nextRemindOf(ev, now) {
  if (!ev.repeat) return remindAt(ev)
  if (ev.remind === null || ev.remind === undefined) return null
  const today = dayKey(now)
  const stop = addDays(today, 8)
  for (let d = ev.day > today ? ev.day : today; d <= stop; d = addDays(d, 1)) {
    if (!occursOn(ev, d)) continue
    const at = remindAt(instance(ev, d))
    if (at > now) return at
  }
  return null
}

// По порядку: день, в нём сначала события на весь день, потом по времени
export function compareEvents(a, b) {
  if (a.day !== b.day) return a.day < b.day ? -1 : 1
  const ta = a.time ?? ''
  const tb = b.time ?? ''
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

// Календарь из $.store: что не сходится — пропускаем
export function restoreCalendar(saved) {
  if (!Array.isArray(saved)) return []
  const out = []
  const ids = new Set()
  for (const e of saved) {
    if (out.length >= MAX_EVENTS) break
    if (!e || typeof e !== 'object' || typeof e.id !== 'string' || !ID.test(e.id) || ids.has(e.id)) continue
    const title = cleanTitle(e.title)
    const day = cleanDay(e.day)
    const time = e.time ? cleanTime(e.time) : ''
    if (!title || !day || (e.time && !time)) continue
    ids.add(e.id)
    const remind = cleanRemind(e.remind)
    const ev = { id: e.id, title, day, ...(time ? { time } : {}), remind: remind === undefined ? null : remind, at: Number.isFinite(e.at) ? e.at : 0 }
    const note = cleanNote(e.note)
    if (note) ev.note = note
    if (cleanColor(e.color)) ev.color = e.color
    if (cleanRepeat(e.repeat)) ev.repeat = e.repeat
    if (Number.isFinite(e.alerted)) ev.alerted = e.alerted
    if (ev.alerted !== undefined && typeof e.alertedBy === 'string' && e.alertedBy.length <= 20) ev.alertedBy = e.alertedBy
    const give = cleanGive(e.give)
    if (give) {
      ev.give = give
      const cwd = cleanCwd(e.cwd)
      if (cwd) ev.cwd = cwd
      for (const k of ['fired', 'held', 'missed', 'warned']) if (Number.isFinite(e[k])) ev[k] = e[k]
      if (ev.fired !== undefined && typeof e.firedBy === 'string' && e.firedBy.length <= 20) ev.firedBy = e.firedBy
      if (ev.warned !== undefined && typeof e.warnedBy === 'string' && e.warnedBy.length <= 20) ev.warnedBy = e.warnedBy
    }
    out.push(ev)
  }
  return out.sort(compareEvents)
}

// Напоминание, время которого уже прошло, когда событие записали или сдвинули, — не пропущенное: его не показываем.
// У серии — напоминание её последнего раза, которому уже было пора
function settle(ev, now) {
  const last = lastReminded(ev, now)
  if (last) ev.alerted = remindAt(last)
  else delete ev.alerted
  delete ev.alertedBy
  return ev
}
// Задание так же: раз, время которого уже прошло, когда задание дали или сдвинули, — не пропущенный, его не запускаем
function settleTask(ev, now) {
  for (const k of TASK_MARKS) delete ev[k]
  const last = lastFired(ev, now)
  if (last) ev.fired = fireAt(last)
  return ev
}

// Новое событие. Календарь полон — уходит самое старое событие, прошедшее больше месяца назад (не серия: она ещё идёт);
// таких нет — { error }
export function addEvent(list, { title, day, time = '', note = '', remind, color = '', repeat = '', give = null, cwd = '' }, now) {
  const name = cleanTitle(title)
  if (!name) return { error: 'title' }
  const d = cleanDay(day)
  if (!d) return { error: 'day' }
  const t = time ? cleanTime(time) : ''
  if (time && !t) return { error: 'time' }
  const g = give ? cleanGive(give) : null
  if (give && !g) return { error: 'give' }
  // Задание без слова о напоминании — без него: напоминать о ночной очереди незачем
  const r = remind === undefined ? (g ? null : defaultRemind(t)) : cleanRemind(remind)
  if (r === undefined) return { error: 'remind' }
  const c = cleanColor(color)
  if (c === undefined) return { error: 'color' }
  const p = cleanRepeat(repeat)
  if (p === undefined) return { error: 'repeat' }
  let base = list
  if (base.length >= MAX_EVENTS) {
    const old = base.find((e) => !e.repeat && e.day < addDays(dayKey(now), -30))
    if (!old) return { error: 'full' }
    base = base.filter((e) => e !== old)
  }
  const stem = `e${Math.max(0, Math.floor(now)).toString(36)}`
  let id = stem
  for (let n = 1; base.some((e) => e.id === id); n++) id = `${stem}${n.toString(36)}`
  const ev = { id, title: name, day: firstDay(d, p), ...(t ? { time: t } : {}), remind: r, at: now }
  const n = cleanNote(note)
  if (n) ev.note = n
  if (c) ev.color = c
  if (p) ev.repeat = p
  settle(ev, now)
  if (g) {
    ev.give = g
    if (cleanCwd(cwd)) ev.cwd = cleanCwd(cwd)
    settleTask(ev, now)
  }
  return { list: [...base, ev].sort(compareEvents), event: ev }
}

// Правка события: меняется только то, что передано; time: '' — на весь день, note: '' — без заметки, color: '' — цвет по
// умолчанию, repeat: '' — больше не повторяется. Не вышло — { error }
export function updateEvent(list, id, changes, now) {
  const old = list.find((e) => e.id === id)
  if (!old) return { error: 'missing' }
  const ev = { ...old }
  if (changes.title !== undefined) {
    ev.title = cleanTitle(changes.title)
    if (!ev.title) return { error: 'title' }
  }
  if (changes.day !== undefined) {
    ev.day = cleanDay(changes.day)
    if (!ev.day) return { error: 'day' }
  }
  if (changes.time !== undefined) {
    const t = changes.time ? cleanTime(changes.time) : ''
    if (changes.time && !t) return { error: 'time' }
    if (t) ev.time = t
    else delete ev.time
  }
  if (changes.note !== undefined) {
    const n = cleanNote(changes.note)
    if (n) ev.note = n
    else delete ev.note
  }
  if (changes.remind !== undefined) {
    const r = cleanRemind(changes.remind)
    if (r === undefined) return { error: 'remind' }
    ev.remind = r
  }
  if (changes.color !== undefined) {
    const c = cleanColor(changes.color)
    if (c === undefined) return { error: 'color' }
    if (c) ev.color = c
    else delete ev.color
  }
  if (changes.repeat !== undefined) {
    const p = cleanRepeat(changes.repeat)
    if (p === undefined) return { error: 'repeat' }
    if (p) ev.repeat = p
    else delete ev.repeat
  }
  // give: null — больше не давать Claude (уходят и папка, и отметки); cwd — папка, где задание идёт
  if (changes.give !== undefined) {
    if (changes.give) {
      const g = cleanGive(changes.give)
      if (!g) return { error: 'give' }
      ev.give = g
    } else for (const k of ['give', 'cwd', ...TASK_MARKS]) delete ev[k]
  }
  if (changes.cwd !== undefined && ev.give) {
    if (cleanCwd(changes.cwd)) ev.cwd = cleanCwd(changes.cwd)
    else delete ev.cwd
  }
  ev.day = firstDay(ev.day, ev.repeat)
  // Сдвинули время напоминания или повтор — оно снова впереди (или уже прошло — тогда не показываем)
  if (remindAt(ev) !== remindAt(old) || ev.repeat !== old.repeat) settle(ev, now)
  // Задание дали только что или сдвинули его время — так же
  if (ev.give && (!old.give || fireAt(ev) !== fireAt(old) || ev.repeat !== old.repeat)) settleTask(ev, now)
  return { list: list.map((e) => (e.id === id ? ev : e)).sort(compareEvents), event: ev }
}

export const removeEvent = (list, id) => list.filter((e) => e.id !== id)

// Сроки карточек досок блокнота — в календаре как события на весь день: id «card-<id карточки>», card — id карточки,
// board — название доски. Карточка в последней колонке доски сделана (done) — о ней не напоминаем, остальные — в 9:00
// дня срока
export function cardDues(notes) {
  const out = []
  for (const board of notes) {
    if (!isBoard(board)) continue
    const last = board.board.cols.at(-1).id
    for (const card of notes) {
      if (card.parent !== board.id || !card.due) continue
      const done = columnOf(card, board.board.cols) === last
      out.push({ id: `card-${card.id}`, card: card.id, board: board.title, title: card.title, day: card.due, remind: done ? null : 0, color: 'gray', ...(done ? { done } : {}) })
    }
  }
  return out.sort(compareEvents)
}

// События с дня from на days дней вперёд, по порядку; серия — каждым своим разом в эти дни (instance)
export function between(list, from, days) {
  const to = addDays(from, days)
  const out = []
  for (const e of list) {
    if (!e.repeat) {
      if (e.day >= from && e.day < to) out.push(e)
      continue
    }
    for (let d = e.day > from ? e.day : from; d < to; d = addDays(d, 1)) if (occursOn(e, d)) out.push(instance(e, d))
  }
  return out.sort(compareEvents)
}

// Напоминания, которым пора: due — показать (и пропущенные, если событие было не раньше суток назад), stale — давно
// прошедшие, их отмечают молча. Показанное помечено alerted — временем напоминания: сдвинули событие — напомнит снова.
// У серии alerted — напоминание последнего показанного раза, в due и stale — сам этот раз (instance)
export function dueReminders(list, now) {
  const due = []
  const stale = []
  for (const ev of list) {
    const x = lastReminded(ev, now)
    if (!x) continue
    const at = remindAt(x)
    if (ev.alerted === at || (ev.repeat && ev.alerted > at)) continue
    ;(endOf(x) >= now - MISSED_MS ? due : stale).push(x)
  }
  return { due, stale }
}
// Задания, которым пора и с которыми ещё не разобрались: раз события (instance у серии) и его время запуска at
export function dueTasks(list, now) {
  const out = []
  for (const ev of list) {
    const x = lastFired(ev, now)
    if (!x) continue
    const at = fireAt(x)
    if (Number.isFinite(ev.fired) && ev.fired >= at) continue
    out.push({ ...x, at })
  }
  return out
}
// Отметки задания: marks — { fired, firedBy, held, missed, warned, warnedBy }; undefined убирает отметку
export function markTask(list, id, marks) {
  return list.map((e) => {
    if (e.id !== id || !e.give) return e
    const ev = { ...e }
    for (const [k, v] of Object.entries(marks)) {
      if (v === undefined) delete ev[k]
      else ev[k] = v
    }
    return ev
  })
}
// Отметить напоминания показанными. by — какая сессия их показывает: таймеры всех сессий срабатывают разом, и показывает
// та, чья отметка осталась в хранилище. now — для серий: у них отмечается последний раз, которому было пора
export function markAlerted(list, ids, by = '', now = 0) {
  const set = new Set(ids)
  return list.map((e) => {
    if (!set.has(e.id)) return e
    const { alertedBy, ...rest } = e
    return { ...rest, alerted: remindAt((e.repeat && lastReminded(e, now)) || e), ...(by ? { alertedBy: by } : {}) }
  })
}
// Ближайшее напоминание впереди, мс; нет — null
export function nextReminder(list, now) {
  let next = null
  for (const ev of list) {
    const at = nextRemindOf(ev, now)
    if (at !== null && at > now && ev.alerted !== at && (next === null || at < next)) next = at
  }
  return next
}

// Сетка месяца «ГГГГ-ММ»: недели с понедельника, в каждой 7 дней { day, date, inMonth }; дни соседних месяцев — по краям
export function monthGrid(month) {
  const first = `${month}-01`
  let start = addDays(first, -weekday(first))
  const weeks = []
  do {
    weeks.push(Array.from({ length: 7 }, (_, k) => {
      const day = addDays(start, k)
      return { day, date: Number(day.slice(8)), inMonth: day.startsWith(month) }
    }))
    start = addDays(start, 7)
  } while (start.startsWith(month))
  return weeks
}

// Своё напоминание словами, по-русски или по-английски: «за 45 мин», «за 1 ч 30 мин», «за час», «в 8:30», «накануне
// в 20:00», «за 2 дня в 18:00», «нет»; «45 min», «2 hours before», «the day before at 20:00». Время без «накануне» и «за N
// дней» — в день события. → минуты до начала (у события на весь день — до 9:00), null — без напоминания; не понял или
// не подходит (позже начала, раньше чем за неделю) — undefined
const REMIND_UNITS = [
  [/^(m|min|mins|minutes?|м|мин|минуту|минуты|минут)$/, 1],
  [/^(h|hr|hrs|hours?|ч|час|часа|часов)$/, 60],
  [/^(d|days?|д|дн|день|дня|дней|сут|сутки|суток)$/, 1440],
  [/^(w|weeks?|нед|неделю|недели|недель)$/, 10080],
  [/^полчаса$/, 30],
]
const REMIND_NONE = /^(нет|без|без напоминания|не напоминать|никогда|no|none|off|never|no reminder)$/
const REMIND_START = /^(в начале|вовремя|в момент начала|at (the )?start|on time)$/
const remindUnit = (word) => REMIND_UNITS.find(([re]) => re.test(word.replace(/\.$/, '')))?.[1]
export function parseRemind(text, ev) {
  let s = String(text ?? '')
    .toLowerCase()
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/[,!]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!s) return undefined
  if (REMIND_NONE.test(s)) return null
  if (REMIND_START.test(s)) return 0
  let clock = null
  const t = /(\d{1,2}):(\d{2})/.exec(s)
  if (t) {
    if (!cleanTime(t[0])) return undefined
    clock = Number(t[1]) * 60 + Number(t[2])
    s = s.replace(t[0], ' ')
  }
  let back = 0
  s = s.replace(/накануне|(the )?day before/, () => {
    back = 1
    return ' '
  })
  // Служебные слова: «за», «в», «before», «at», «напомнить»
  s = s.replace(/(^|\s)(за|в|во|a|an|at|before|earlier|remind|me|напомни|напомнить)(?=\s|$)/g, ' ')
  let span = 0
  let bad = false
  s = s.replace(/(\d+(?:\.\d+)?)\s*([a-zа-яё]+\.?)?/g, (_, n, unit) => {
    const k = unit ? remindUnit(unit) : 1
    if (k === undefined) bad = true
    else span += Number(n) * k
    return ' '
  })
  // Единица без числа: «за час», «за сутки», «an hour»
  s = s.replace(/(^|\s)([a-zа-яё]+\.?)(?=\s|$)/g, (all, sp, word) => {
    const k = remindUnit(word)
    if (k === undefined) return all
    span += k
    return ' '
  })
  if (bad || s.trim()) return undefined
  let minutes
  if (clock === null) {
    if (back || !span) return undefined
    minutes = Math.round(span)
  } else {
    // «за 2 дня в 18:00» — дни назад и время; «за 2 часа в 18:00» не понять
    if (span % 1440) return undefined
    const start = ev?.time ? Number(ev.time.slice(0, 2)) * 60 + Number(ev.time.slice(3)) : ALL_DAY_HOUR * 60
    minutes = start - (clock - (back + span / 1440) * 1440)
  }
  return cleanRemind(minutes) ?? undefined
}

// Быстрая запись одной строкой: «завтра 15:00 Созвон», «пт в 9:30 стендап», «12.11 Ревью», «Созвон 2026-11-20 10:00».
// День и время можно поставить где угодно в строке, остальное — название. Без дня — день base, без времени — весь день
const WORDS = {
  сегодня: 0,
  today: 0,
  завтра: 1,
  tomorrow: 1,
  послезавтра: 2,
}
const WEEKDAY_WORDS = [
  ['пн', 'пон', 'понедельник', 'mon', 'monday'],
  ['вт', 'вторник', 'tue', 'tuesday'],
  ['ср', 'среда', 'среду', 'wed', 'wednesday'],
  ['чт', 'четверг', 'thu', 'thursday'],
  ['пт', 'пятница', 'пятницу', 'fri', 'friday'],
  ['сб', 'суббота', 'субботу', 'sat', 'saturday'],
  ['вс', 'воскресенье', 'sun', 'sunday'],
]
const PREPOSITIONS = new Set(['в', 'во', 'на', 'on', 'at'])
// Повтор словами: «каждый день», «по будням», «каждую неделю», «каждый месяц», «каждый год»; день недели — «каждую
// пятницу», «по пятницам», «every Friday», «on Fridays»: серия начинается с ближайшего такого дня
const REPEAT_WORDS = {
  daily: ['каждый день', 'ежедневно', 'every day'],
  weekdays: ['каждый будний день', 'по будням', 'every weekday', 'on weekdays'],
  weekly: ['каждую неделю', 'еженедельно', 'every week'],
  monthly: ['каждый месяц', 'ежемесячно', 'every month'],
  yearly: ['каждый год', 'ежегодно', 'every year'],
}
const WEEKDAY_PLURALS = [
  ['понедельникам', 'mondays'],
  ['вторникам', 'tuesdays'],
  ['средам', 'wednesdays'],
  ['четвергам', 'thursdays'],
  ['пятницам', 'fridays'],
  ['субботам', 'saturdays'],
  ['воскресеньям', 'sundays'],
]
const REPEAT_PHRASES = new Map()
for (const [repeat, phrases] of Object.entries(REPEAT_WORDS)) for (const p of phrases) REPEAT_PHRASES.set(p, { repeat })
WEEKDAY_WORDS.forEach((names, wd) => {
  for (const name of names) for (const each of ['каждый', 'каждую', 'каждое', 'every']) REPEAT_PHRASES.set(`${each} ${name}`, { repeat: 'weekly', wd })
  REPEAT_PHRASES.set(`по ${WEEKDAY_PLURALS[wd][0]}`, { repeat: 'weekly', wd }).set(`on ${WEEKDAY_PLURALS[wd][1]}`, { repeat: 'weekly', wd })
})
export function quickParse(text, base, today = base) {
  const words = cleanTitle(text, 200).split(' ').filter(Boolean)
  const low = words.map((w) => w.toLowerCase().replace(/[,]$/, ''))
  let day = ''
  let time = ''
  let repeat = null
  const used = new Set()
  // Сначала повтор — в нём бывает день недели («каждую пятницу»), его не принять за день
  for (let k = 0; k < words.length && !repeat; k++)
    for (let n = 3; n >= 1 && !repeat; n--) {
      repeat = REPEAT_PHRASES.get(low.slice(k, k + n).join(' ')) ?? null
      if (repeat) for (let j = k; j < k + n; j++) used.add(j)
    }
  low.forEach((word, k) => {
    if (used.has(k)) return
    let found = ''
    if (!time && (found = cleanTime(word))) time = found
    else if (!day && (found = dayWord(word, today))) day = found
    else return
    used.add(k)
    if (k > 0 && PREPOSITIONS.has(low[k - 1]) && !used.has(k - 1)) used.add(k - 1)
  })
  let start = day || base
  if (repeat?.wd !== undefined) start = addDays(start, (repeat.wd - weekday(start) + 7) % 7)
  return { title: words.filter((_, k) => !used.has(k)).join(' '), day: start, time, ...(repeat ? { repeat: repeat.repeat } : {}) }
}
function dayWord(word, today) {
  if (word in WORDS) return addDays(today, WORDS[word])
  const wd = WEEKDAY_WORDS.findIndex((names) => names.includes(word))
  if (wd >= 0) return addDays(today, (wd - weekday(today) + 7) % 7)
  const iso = cleanDay(word)
  if (iso) return iso
  // «12.11» — ближайшее такое число впереди (или сегодня); «12.11.2026» — как есть
  const m = /^(\d{1,2})\.(\d{1,2})(?:\.(\d{4}))?$/.exec(word)
  if (!m) return ''
  const year = Number(today.slice(0, 4))
  const make = (y) => cleanDay(`${y}-${pad(m[2])}-${pad(m[1])}`)
  if (m[3]) return make(m[3])
  const day = make(year)
  return day && day < today ? make(year + 1) : day
}

// --- Инструмент Claude ---------------------------------------------------------------------------------------------
const remindLabel = (ev) => {
  if (ev.remind === null || ev.remind === undefined) return 'no reminder'
  if (ev.remind === 0) return ev.time ? 'reminder at the start' : 'reminder at 9:00'
  const m = ev.remind
  const span = m % 1440 === 0 ? `${m / 1440} d` : m % 60 === 0 ? `${m / 60} h` : `${m} min`
  return `reminder ${span} before${ev.time ? '' : ' 9:00'}`
}
const whenLabel = (ev) => `${WEEKDAYS_EN[dateOf(ev.day).getDay()]} ${ev.day} ${ev.time ?? 'all day'}`
const cardLine = (c) => `- ${c.day}: ${c.title} (card ${c.card} on board ${c.board}${c.done ? ', done' : ''})`
const REPEAT_EN = { daily: 'every day', weekdays: 'every weekday', monthly: 'every month', yearly: 'every year' }
const repeatLabel = (ev) => {
  const first = ev.first ?? ev.day
  return `repeats ${ev.repeat === 'weekly' ? `every ${WEEKDAYS_EN[dateOf(first).getDay()]}` : REPEAT_EN[ev.repeat]} from ${first}, `
}
const GIVE_EN = { queue: 'the queue of board', card: 'board card', prompt: 'prompt template' }
const TARGET_EN = { queue: 'board', card: 'board card', prompt: 'prompt template' }
const giveLabel = (g) => (g.kind === 'text' ? `the text "${clip(g.text.replace(/\n/g, ' / '))}"` : `${GIVE_EN[g.kind]} "${g.name}" (${g[GIVE_KEY[g.kind]]})`)
const stampLabel = (ms) => {
  const d = new Date(ms)
  return `${dayKey(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const taskLine = (ev) =>
  ev.give
    ? `\n  at ${ev.time || `${ALL_DAY_HOUR}:00`} gives Claude ${giveLabel(ev.give)} in a Claude Code session in ${ev.cwd || 'any folder'}${ev.missed ? `; missed on ${stampLabel(ev.missed)}, waits for the user to press Run now in Arcade` : ''}`
    : ''
const eventLine = (ev) =>
  `- ${ev.id}: ${whenLabel(ev)} — ${ev.title} (${ev.repeat ? repeatLabel(ev) : ''}${remindLabel(ev)}${ev.color ? `, ${ev.color}` : ''})${ev.note ? `\n  note: ${ev.note.replace(/\n/g, ' / ')}` : ''}${taskLine(ev)}`
const todayLine = (now) => {
  const d = new Date(now)
  return `Today is ${WEEKDAYS_EN[d.getDay()]} ${dayKey(now)}, ${pad(d.getHours())}:${pad(d.getMinutes())} local time.`
}

export const CALENDAR_TOOL = {
  name: 'calendar',
  description:
    "The user's Arcade calendar: events with a day, a time or all day, a note, a reminder and a color. Arcade shows reminders as system notifications while Claude Code runs. " +
    'Use it when the user asks to put something on their calendar, to be reminded of something at a time, or what they have planned. ' +
    "Days are YYYY-MM-DD and times HH:MM (24-hour) in the local time of the user's computer; work out words like Friday or tomorrow from today's date, which every answer starts with. " +
    'Actions: list (events from day, default today, for days days, default 7; it also shows due dates of cards on Arcade boards, which change with the notes tool), add (title and day; without time the event lasts all day; note and remind are optional), ' +
    'update (an event by id or exact title: only the fields given change; time "" makes it all-day, note "" removes the note), remove (delete an event by id or exact title). ' +
    'remind is minutes before the start: 0 is at the start, for an all-day event counted from 9:00 that day; -1 is no reminder. ' +
    'Without remind a new event reminds 15 minutes before, an all-day one at 9:00. ' +
    `color is one of ${Object.keys(COLORS).join(', ')}; without it the event is ${DEFAULT_COLOR}, color "" resets it. ` +
    'repeat makes the event a series: daily, weekdays (Monday to Friday), weekly (the same weekday), monthly (the same date) or yearly; its day is the first time. ' +
    'list shows every time of a series under the series id; update and remove change the whole series; repeat "" stops repeating. ' +
    'give makes the event a scheduled task for Claude: at its time (an all-day event at 9:00) Arcade gives Claude, in a running Claude Code session in the folder where the task was set (this session\'s folder), one of: ' +
    'queue (runs the queue of an Arcade board; target is the board), card (one board card; target is the card), prompt (a template from Prompts; target is the template) or text (task is the text, sent as is). ' +
    'target is an id or exact title from the notes tool. It runs in one session only; if Claude is busy, it waits for the end of the turn. ' +
    'If no session of that folder was running at the time (after a Claude Code restart a session runs again only once the user opens it), any running session with Arcade shows the user a system notification, ' +
    "and that folder's session shows it as missed with Run now; Arcade never runs it later by itself or in another folder. It runs in the session's current permission mode and needs Claude Code running and the computer awake. " +
    'give "" stops the task. Without remind a new task has no reminder. Set a task only when the user asks for one.',
  inputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['list', 'add', 'update', 'remove'] },
      event: { type: 'string', description: 'Event id or exact title (update, remove)' },
      title: { type: 'string', description: `Event title, up to ${MAX_TITLE} characters (add, update)` },
      day: { type: 'string', description: 'YYYY-MM-DD: the day of the event (add, update) or the first day to show (list)' },
      time: { type: 'string', description: 'HH:MM, 24-hour; empty for an all-day event (add, update)' },
      note: { type: 'string', description: `Note, up to ${MAX_NOTE} characters (add, update)` },
      remind: { type: 'integer', description: `Minutes before the start, 0 to ${MAX_REMIND}; -1 for no reminder (add, update)` },
      color: { type: 'string', enum: [...Object.keys(COLORS), ''], description: `Event color, default ${DEFAULT_COLOR} (add, update)` },
      repeat: { type: 'string', enum: [...REPEATS, ''], description: 'Repeat the event from its day; "" stops repeating (add, update)' },
      days: { type: 'integer', description: `How many days to show, 1 to ${MAX_LIST_DAYS} (list, default ${LIST_DAYS})` },
      give: { type: 'string', enum: [...GIVE_KINDS, ''], description: 'Make the event a scheduled task for Claude; "" stops it (add, update)' },
      target: { type: 'string', description: 'Board (give queue), board card (give card) or prompt template (give prompt): id or exact title (add, update)' },
      task: { type: 'string', description: `The text Claude gets at the event's time (give text), up to ${MAX_TASK} characters (add, update)` },
    },
    required: ['action'],
  },
  isDeferred: true,
}

const ERRORS = {
  title: 'The title is empty.',
  day: 'day must be a real date as YYYY-MM-DD.',
  time: 'time must be HH:MM, 24-hour, e.g. 15:00, or empty for all day.',
  remind: `remind is minutes before the start, 0 to ${MAX_REMIND}, or -1 for no reminder.`,
  color: `color is one of ${Object.keys(COLORS).join(', ')}, or "" for the default.`,
  repeat: `repeat is one of ${REPEATS.join(', ')}, or "" to stop repeating.`,
  full: `The calendar is full: ${MAX_EVENTS} events. The user can delete old ones in Arcade.`,
  give: `give is one of ${GIVE_KINDS.join(', ')}, or "" to stop the task.`,
}
// Куда задание может смотреть: queue — доски проектов, card — их карточки, prompt — шаблоны наборов «Промптов»
export function giveTargets(notes, kind) {
  const boards = notes.filter(kind === 'prompt' ? isPrompts : isProjectBoard)
  if (kind === 'queue') return boards
  const ids = new Set(boards.map((b) => b.id))
  return notes.filter((p) => ids.has(p.parent))
}
function findTarget(notes, kind, ref) {
  const key = String(ref ?? '').trim()
  const list = giveTargets(notes, kind)
  const byId = list.find((p) => p.id === key)
  if (byId) return { page: byId }
  const named = list.filter((p) => p.title.toLowerCase() === key.toLowerCase())
  if (named.length === 1) return { page: named[0] }
  if (named.length > 1) return { error: `Several ${TARGET_EN[kind]}s are called "${clip(key)}": ${named.map((p) => p.id).join(', ')}. Pass the id.` }
  return { error: `No ${TARGET_EN[kind]} "${clip(key)}". Read the notebook with the notes tool to find it.` }
}
// give, target и task из вызова → { give } (null — убрать задание), {} — задание не трогали, { error }. current — задание
// события до правки: без give правится его цель или текст
function giveFrom(input, current, notes) {
  const touched = input.target !== undefined || input.task !== undefined
  const kind = input.give !== undefined ? input.give : touched ? current?.kind : undefined
  if (kind === undefined) return touched ? { error: 'Pass give too: queue, card, prompt or text.' } : {}
  if (kind === '' || kind === null) return { give: null }
  if (!GIVE_KINDS.includes(kind)) return { error: ERRORS.give }
  if (kind === 'text' && input.target !== undefined) return { error: 'target is for give queue, card or prompt; give text takes task.' }
  if (kind !== 'text' && input.task !== undefined) return { error: 'task is for give text; give queue, card or prompt takes target.' }
  if (kind === 'text') {
    const text = input.task !== undefined ? input.task : current?.kind === 'text' ? current.text : ''
    const give = cleanGive({ kind, text })
    return give ? { give } : { error: 'Pass task: the text Claude gets.' }
  }
  const ref = input.target !== undefined ? input.target : current?.kind === kind ? current[GIVE_KEY[kind]] : undefined
  if (ref === undefined) return { error: `Pass target: the ${TARGET_EN[kind]} id or exact title.` }
  const found = findTarget(notes, kind, ref)
  if (found.error) return found
  return { give: { kind, [GIVE_KEY[kind]]: found.page.id, name: found.page.title } }
}
// Событие по id или точному названию; несколько с таким названием — { error }
function findEvent(list, ref) {
  const key = String(ref ?? '').trim()
  const byId = list.find((e) => e.id === key)
  if (byId) return { event: byId }
  const named = list.filter((e) => e.title.toLowerCase() === key.toLowerCase())
  if (named.length === 1) return { event: named[0] }
  if (named.length > 1) return { error: `Several events are called "${clip(key)}": ${named.map((e) => `${e.id} (${whenLabel(e)})`).join(', ')}. Pass the id.` }
  return { error: `No event "${clip(key)}". Use list to see the events and their ids.` }
}
const remindFrom = (v) => (v === -1 ? null : v)

// Вызов инструмента: → { list, text, isError?, changed? }; list — календарь после вызова. cards — сроки карточек досок
// (cardDues): list показывает и их, а правят их инструментом блокнота. notes — блокнот (цели заданий), cwd — папка
// сессии, где Claude даёт задание
export function applyCalendarTool(list, input, now, cards = [], { notes = [], cwd = '' } = {}) {
  const head = todayLine(now)
  const fail = (text) => ({ list, text: `${head}\n${text}`, isError: true })
  const action = input?.action
  if (action === 'list') {
    const from = input.day === undefined ? dayKey(now) : cleanDay(input.day)
    if (!from) return fail(ERRORS.day)
    const days = input.days === undefined ? LIST_DAYS : input.days
    if (!Number.isInteger(days) || days < 1 || days > MAX_LIST_DAYS) return fail(`days is 1 to ${MAX_LIST_DAYS}.`)
    const shown = between(list, from, days)
    const span = `${from} to ${addDays(from, days - 1)}`
    const due = between(cards, from, days)
    const dueText = due.length ? `\nBoard cards due from ${span} (change them with the notes tool, action due):\n${due.map(cardLine).join('\n')}` : ''
    if (!shown.length) return { list, text: `${head}\nNo events from ${span}.${list.length ? '' : ' The calendar is empty.'}${dueText}` }
    return { list, text: `${head}\nEvents from ${span}:\n${shown.map(eventLine).join('\n')}${dueText}` }
  }
  if (action === 'add') {
    const g = giveFrom(input, null, notes)
    if (g.error) return fail(g.error)
    const task = g.give ? { give: g.give, cwd } : {}
    const out = addEvent(list, { title: input.title, day: input.day, time: input.time ?? '', note: input.note ?? '', remind: remindFrom(input.remind), color: input.color ?? '', repeat: input.repeat ?? '', ...task }, now)
    if (out.error) return fail(ERRORS[out.error])
    return { list: out.list, text: `${head}\nAdded:\n${eventLine(out.event)}`, changed: true }
  }
  if (action === 'update' || action === 'remove') {
    const found = findEvent(list, input.event)
    if (found.error) return fail(found.error)
    if (action === 'remove') return { list: removeEvent(list, found.event.id), text: `${head}\nRemoved: ${found.event.title} (${whenLabel(found.event)}).`, changed: true }
    const changes = {}
    for (const key of ['title', 'day', 'time', 'note', 'color', 'repeat']) if (input[key] !== undefined) changes[key] = input[key]
    if (input.remind !== undefined) changes.remind = remindFrom(input.remind)
    const g = giveFrom(input, found.event.give, notes)
    if (g.error) return fail(g.error)
    if (g.give !== undefined) {
      changes.give = g.give
      if (g.give && !found.event.cwd && cwd) changes.cwd = cwd
    }
    if (!Object.keys(changes).length) return fail('Nothing to change: pass title, day, time, note, remind, color, repeat or give.')
    const out = updateEvent(list, found.event.id, changes, now)
    if (out.error) return fail(ERRORS[out.error])
    return { list: out.list, text: `${head}\nUpdated:\n${eventLine(out.event)}`, changed: true }
  }
  return fail('Unknown action: use list, add, update or remove.')
}
