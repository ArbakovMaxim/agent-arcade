// Календарь Arcade: события с днём, временем (или на весь день), заметкой и напоминанием. Хранится в $.store мода
// (ключ calendar) — один на все сессии Claude Code, как блокнот. Claude записывает и читает события инструментом
// mcp__arcade__calendar — его ответы для модели, поэтому по-английски. Здесь нет вызовов Claude Code: хранилище и
// напоминания — в hooks/app/calendar.js, экран — в hooks/screens/calendar.js, инструмент — в hooks/register.js.
// Время — по часам компьютера: день — «ГГГГ-ММ-ДД», время — «ЧЧ:ММ». У события на весь день времени нет, и напоминание
// о нём считается от 9:00 этого дня
import { MAX_TITLE, cleanBody, cleanTitle } from './notes.js'

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
const DAY = /^(\d{4})-(\d{2})-(\d{2})$/
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
// «ГГГГ-ММ-ДД», и такой день есть в календаре; иначе ''
export function cleanDay(text) {
  const m = DAY.exec(String(text ?? '').trim())
  if (!m) return ''
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  if (y < 1970 || y > 2999) return ''
  const date = new Date(y, mo - 1, d)
  return date.getMonth() === mo - 1 && date.getDate() === d ? m[0] : ''
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
    if (Number.isFinite(e.alerted)) ev.alerted = e.alerted
    if (ev.alerted !== undefined && typeof e.alertedBy === 'string' && e.alertedBy.length <= 20) ev.alertedBy = e.alertedBy
    out.push(ev)
  }
  return out.sort(compareEvents)
}

// Напоминание, время которого уже прошло, когда событие записали или сдвинули, — не пропущенное: его не показываем
function settle(ev, now) {
  const at = remindAt(ev)
  if (at !== null && at <= now) ev.alerted = at
  else delete ev.alerted
  delete ev.alertedBy
  return ev
}

// Новое событие. Календарь полон — уходит самое старое событие, прошедшее больше месяца назад; таких нет — { error }
export function addEvent(list, { title, day, time = '', note = '', remind, color = '' }, now) {
  const name = cleanTitle(title)
  if (!name) return { error: 'title' }
  const d = cleanDay(day)
  if (!d) return { error: 'day' }
  const t = time ? cleanTime(time) : ''
  if (time && !t) return { error: 'time' }
  const r = remind === undefined ? defaultRemind(t) : cleanRemind(remind)
  if (r === undefined) return { error: 'remind' }
  const c = cleanColor(color)
  if (c === undefined) return { error: 'color' }
  let base = list
  if (base.length >= MAX_EVENTS) {
    const old = base.find((e) => e.day < addDays(dayKey(now), -30))
    if (!old) return { error: 'full' }
    base = base.filter((e) => e !== old)
  }
  const stem = `e${Math.max(0, Math.floor(now)).toString(36)}`
  let id = stem
  for (let n = 1; base.some((e) => e.id === id); n++) id = `${stem}${n.toString(36)}`
  const ev = { id, title: name, day: d, ...(t ? { time: t } : {}), remind: r, at: now }
  const n = cleanNote(note)
  if (n) ev.note = n
  if (c) ev.color = c
  settle(ev, now)
  return { list: [...base, ev].sort(compareEvents), event: ev }
}

// Правка события: меняется только то, что передано; time: '' — на весь день, note: '' — без заметки, color: '' — цвет по
// умолчанию. Не вышло — { error }
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
  // Сдвинули время напоминания — оно снова впереди (или уже прошло — тогда не показываем)
  if (remindAt(ev) !== remindAt(old)) settle(ev, now)
  return { list: list.map((e) => (e.id === id ? ev : e)).sort(compareEvents), event: ev }
}

export const removeEvent = (list, id) => list.filter((e) => e.id !== id)

// События с дня from на days дней вперёд
export function between(list, from, days) {
  const to = addDays(from, days)
  return list.filter((e) => e.day >= from && e.day < to)
}

// Напоминания, которым пора: due — показать (и пропущенные, если событие было не раньше суток назад), stale — давно
// прошедшие, их отмечают молча. Показанное помечено alerted — временем напоминания: сдвинули событие — напомнит снова
export function dueReminders(list, now) {
  const due = []
  const stale = []
  for (const ev of list) {
    const at = remindAt(ev)
    if (at === null || at > now || ev.alerted === at) continue
    ;(endOf(ev) >= now - MISSED_MS ? due : stale).push(ev)
  }
  return { due, stale }
}
// Отметить напоминания показанными. by — какая сессия их показывает: таймеры всех сессий срабатывают разом, и показывает
// та, чья отметка осталась в хранилище
export function markAlerted(list, ids, by = '') {
  const set = new Set(ids)
  return list.map((e) => {
    if (!set.has(e.id)) return e
    const { alertedBy, ...rest } = e
    return { ...rest, alerted: remindAt(e), ...(by ? { alertedBy: by } : {}) }
  })
}
// Ближайшее напоминание впереди, мс; нет — null
export function nextReminder(list, now) {
  let next = null
  for (const ev of list) {
    const at = remindAt(ev)
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
export function quickParse(text, base, today = base) {
  const words = cleanTitle(text, 200).split(' ').filter(Boolean)
  let day = ''
  let time = ''
  const used = new Set()
  words.forEach((w, k) => {
    const word = w.toLowerCase().replace(/[,]$/, '')
    let found = ''
    if (!time && (found = cleanTime(word))) time = found
    else if (!day && (found = dayWord(word, today))) day = found
    else return
    used.add(k)
    if (k > 0 && PREPOSITIONS.has(words[k - 1].toLowerCase()) && !used.has(k - 1)) used.add(k - 1)
  })
  return { title: words.filter((_, k) => !used.has(k)).join(' '), day: day || base, time }
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
const eventLine = (ev) => `- ${ev.id}: ${whenLabel(ev)} — ${ev.title} (${remindLabel(ev)}${ev.color ? `, ${ev.color}` : ''})${ev.note ? `\n  note: ${ev.note.replace(/\n/g, ' / ')}` : ''}`
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
    'Actions: list (events from day, default today, for days days, default 7), add (title and day; without time the event lasts all day; note and remind are optional), ' +
    'update (an event by id or exact title: only the fields given change; time "" makes it all-day, note "" removes the note), remove (delete an event by id or exact title). ' +
    'remind is minutes before the start: 0 is at the start, for an all-day event counted from 9:00 that day; -1 is no reminder. ' +
    'Without remind a new event reminds 15 minutes before, an all-day one at 9:00. ' +
    `color is one of ${Object.keys(COLORS).join(', ')}; without it the event is ${DEFAULT_COLOR}, color "" resets it.`,
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
      days: { type: 'integer', description: `How many days to show, 1 to ${MAX_LIST_DAYS} (list, default ${LIST_DAYS})` },
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
  full: `The calendar is full: ${MAX_EVENTS} events. The user can delete old ones in Arcade.`,
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

// Вызов инструмента: → { list, text, isError?, changed? }; list — календарь после вызова
export function applyCalendarTool(list, input, now) {
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
    if (!shown.length) return { list, text: `${head}\nNo events from ${span}.${list.length ? '' : ' The calendar is empty.'}` }
    return { list, text: `${head}\nEvents from ${span}:\n${shown.map(eventLine).join('\n')}` }
  }
  if (action === 'add') {
    const out = addEvent(list, { title: input.title, day: input.day, time: input.time ?? '', note: input.note ?? '', remind: remindFrom(input.remind), color: input.color ?? '' }, now)
    if (out.error) return fail(ERRORS[out.error])
    return { list: out.list, text: `${head}\nAdded:\n${eventLine(out.event)}`, changed: true }
  }
  if (action === 'update' || action === 'remove') {
    const found = findEvent(list, input.event)
    if (found.error) return fail(found.error)
    if (action === 'remove') return { list: removeEvent(list, found.event.id), text: `${head}\nRemoved: ${found.event.title} (${whenLabel(found.event)}).`, changed: true }
    const changes = {}
    for (const key of ['title', 'day', 'time', 'note', 'color']) if (input[key] !== undefined) changes[key] = input[key]
    if (input.remind !== undefined) changes.remind = remindFrom(input.remind)
    if (!Object.keys(changes).length) return fail('Nothing to change: pass title, day, time, note, remind or color.')
    const out = updateEvent(list, found.event.id, changes, now)
    if (out.error) return fail(ERRORS[out.error])
    return { list: out.list, text: `${head}\nUpdated:\n${eventLine(out.event)}`, changed: true }
  }
  return fail('Unknown action: use list, add, update or remove.')
}
