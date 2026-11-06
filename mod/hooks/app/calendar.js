// Arcade: календарь — хранилище, правки с экрана, инструмент Claude и напоминания.
import { notifyCommand } from '../browsers.js'
import { tr } from '../i18n.js'
import { REMIND_CHOICES, REMIND_CHOICES_ALL_DAY, addDays, addEvent, applyCalendarTool, cardDues, dayKey, dueReminders, markAlerted, nextReminder, quickParse, remindAt, removeEvent, restoreCalendar, updateEvent } from '../calendar.js'
import { S, cal } from './state.js'
import { log } from './status.js'
import { refreshNotes } from './work.js'

const modError = (err) => log(`ошибка мода: ${err?.message ?? err}`)

// Календарь в $.store — один на все сессии, как блокнот (см. work.js): всякая правка — по очереди и поверх свежего
// календаря из хранилища. calJson — календарь, каким его последний раз прочли или записали
let calJson = ''
let queue = Promise.resolve()

export function fresh($, work) {
  const run = queue.then(async () => work(await readCalendar($)))
  queue = run.catch(() => {})
  return run
}

export async function loadCalendar($) {
  const raw = await $.store.get('calendar')
  calJson = JSON.stringify(raw ?? null)
  S.calendar = restoreCalendar(raw)
}

// Перечитать календарь: false — не поменялся, true — поменялся, 'gone' — открытое событие удалили (экран ушёл назад)
async function readCalendar($) {
  let raw
  try {
    raw = await $.store.get('calendar')
  } catch (err) {
    modError(err)
    return false
  }
  const json = JSON.stringify(raw ?? null)
  if (json === calJson) return false
  calJson = json
  return follow($, restoreCalendar(raw))
}

// Календарь поменялся в другой сессии: экран идёт за ним, напоминания — тоже. Поля открытого события рисуются заново,
// только если поменялось само событие, а не отметка о показанном напоминании
const sameEvent = (a, b) =>
  ['title', 'day', 'time', 'note', 'remind', 'color', 'repeat', 'cwd', 'missed'].every((k) => a[k] === b[k]) && JSON.stringify(a.give ?? null) === JSON.stringify(b.give ?? null)
function follow($, list) {
  const open = S.menu.startsWith('calendar:') ? S.menu.slice(9) : ''
  const was = open ? S.calendar.find((e) => e.id === open) : null
  const now = open ? list.find((e) => e.id === open) : null
  S.calendar = list
  let gone = false
  if (open && !now) {
    S.menuFrom = null
    S.menu = 'calendar'
    cal.note = 'Открытое событие удалили в другой сессии.'
    cal.bad = true
    cal.confirm = false
    gone = true
  } else if (was && now && !sameEvent(was, now)) cal.field++
  schedule($)
  $.ui.invalidate('ui.render')
  return gone ? 'gone' : true
}

// Перечитать календарь, пока он на экране, — по таймеру, как блокнот (NOTES_POLL_MS)
export function refreshCalendar($) {
  return fresh($, (moved) => moved)
}
export const calendarShown = () => S.menu === 'calendar' || S.menu.startsWith('calendar:')

export async function calendarChanged($, list) {
  S.calendar = list
  calJson = JSON.stringify(list)
  $.ui.invalidate('ui.render')
  await $.store.set('calendar', list).catch((err) => {
    cal.note = 'Не получилось сохранить календарь.'
    cal.bad = true
    modError(err)
  })
  schedule($)
}

// Инструмент календаря у Claude — поверх свежего календаря: list видит события других сессий
export async function calendarTool($, input) {
  // Задание смотрит в блокнот (доска, карточка, шаблон) — сначала свежий блокнот: его могли поправить в другой сессии
  if (input?.give || input?.target !== undefined) await refreshNotes($).catch(() => {})
  return fresh($, async () => {
    const at = await $.clock.now()
    const out = applyCalendarTool(S.calendar, input, at, cardDues(S.notes), { notes: S.notes, cwd: S.ag?.path ?? '' })
    if (out.changed) await calendarChanged($, out.list)
    return out
  })
}

// --- Правки с экрана -----------------------------------------------------------------------------------------------
const PROBLEMS = {
  title: 'Впиши, что за событие.',
  day: 'Такого дня нет в календаре.',
  time: 'Время пиши как 15:00.',
  remind: 'Такого напоминания нет.',
  color: 'Такого цвета нет.',
  repeat: 'Такого повтора нет.',
  full: 'Календарь полон — удали старые события.',
  missing: 'Событие удалили в другой сессии.',
  give: 'Такого задания для Claude нет.',
}

// change(list, at) → новый список или { error }. true — сделано, false — нет (заметка скажет почему), null — открытое
// событие удалили в другой сессии
function editCalendar($, change, saved = '') {
  return fresh($, async (moved) => {
    if (moved === 'gone') return null
    const at = await $.clock.now()
    const out = change(S.calendar, at)
    if (out.error) {
      cal.note = PROBLEMS[out.error] ?? PROBLEMS.missing
      cal.bad = true
      $.ui.invalidate('ui.render')
      return false
    }
    cal.note = saved
    cal.bad = false
    await calendarChanged($, out.list ?? out)
    return true
  })
}

// Запись одной строкой: «завтра 15:00 Созвон». Без дня — день base (в Desktop — выбранный в сетке), без него — сегодня;
// экран переходит к дню события
export async function addFromScreen($, text, base = '') {
  const at = await $.clock.now()
  const today = dayKey(at)
  const parsed = quickParse(text, base || today, today)
  let made = null
  const done = await editCalendar(
    $,
    (list, now) => {
      const out = addEvent(list, parsed, now)
      made = out.event ?? null
      return out
    },
    'Записано.',
  )
  if (!done || !made) return
  cal.day = made.day
  cal.month = made.day.slice(0, 7)
  cal.field++
  $.ui.invalidate('ui.render')
}

// Правка события: changes — как у updateEvent
export function editEvent($, id, changes, saved = 'Сохранено.') {
  return editCalendar($, (list, now) => updateEvent(list, id, changes, now), saved)
}

// Что предложить в выборе напоминания: готовые варианты и, если Claude поставил другое, — его тоже, по порядку
export function remindChoices(ev) {
  const base = ev.time ? REMIND_CHOICES : REMIND_CHOICES_ALL_DAY
  if (base.includes(ev.remind)) return base
  return [...base.filter((m) => m !== null && m < ev.remind), ev.remind, ...base.filter((m) => m === null || m > ev.remind)]
}
// Напоминание по кругу — где нет выбора из списка (Claude на телефоне)
export function nextRemind(ev) {
  const steps = remindChoices(ev)
  return steps[(steps.indexOf(ev.remind) + 1) % steps.length]
}

export async function deleteEvent($, id) {
  const done = await editCalendar($, (list) => (list.some((e) => e.id === id) ? removeEvent(list, id) : { error: 'missing' }), 'Событие удалено.')
  if (done === null) return
  cal.confirm = false
  S.menuFrom = null
  S.menu = 'calendar'
  $.ui.invalidate('ui.render')
}

// --- Напоминания ---------------------------------------------------------------------------------------------------
// Один таймер — до ближайшего напоминания, но не дольше RECHECK_MS: событие могли записать в сессии, которую потом
// закрыли, а часы компьютера — уйти вперёд во сне. Таймеры всех открытых сессий срабатывают разом, поэтому сессия
// помечает напоминания своей отметкой (me) и через CLAIM_MS перечитывает хранилище: показывает та, чья отметка осталась
const RECHECK_MS = 10 * 60_000
export const CLAIM_MS = 500
// Напоминание показали позже его времени больше чем на LATE_MS (Claude Code был закрыт) — «Пропущено»
export const LATE_MS = 2 * 60_000
const SHOW_MAX = 3
export const me = `s${Math.random().toString(36).slice(2, 10)}`
let timer = null
let gen = 0

// Сроки карточек досок напоминают как события на весь день (cardDues). Отметки о показанном — отдельно от календаря, в
// $.store под ключом cardAlerts: id карточки → { alerted, alertedBy }. Блокнот — из памяти сессии (S.notes): его
// перечитывают по таймеру, пока он на экране, и всякая его правка
async function cardEvents($) {
  const raw = await $.store.get('cardAlerts').catch(() => null)
  const marks = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  return cardDues(S.notes)
    .filter((x) => x.remind !== null)
    .map((x) => {
      const m = marks[x.card]
      return { ...x, ...(Number.isFinite(m?.alerted) ? { alerted: m.alerted } : {}), ...(typeof m?.alertedBy === 'string' ? { alertedBy: m.alertedBy } : {}) }
    })
}
async function saveCardAlerts($, cards) {
  const marks = {}
  for (const x of cards) if (x.alerted !== undefined) marks[x.card] = { alerted: x.alerted, ...(x.alertedBy ? { alertedBy: x.alertedBy } : {}) }
  await $.store.set('cardAlerts', marks).catch(modError)
}

export function schedule($) {
  const my = ++gen
  timer?.cancel?.()
  timer = null
  $.clock
    .now()
    .then(async (now) => {
      const cards = await cardEvents($)
      if (my !== gen) return
      const next = nextReminder([...S.calendar, ...cards], now)
      const wait = next === null ? RECHECK_MS : Math.max(0, Math.min(next - now, RECHECK_MS))
      timer = $.clock.after(wait, () => {
        timer = null
        remindNow($).catch(modError)
      })
    })
    .catch(modError)
}

// Показать напоминания, которым пора, и пропущенные; давно прошедшие — отметить молча
export async function remindNow($) {
  const mine = await fresh($, async () => {
    const now = await $.clock.now()
    const cards = await cardEvents($)
    const { due, stale } = dueReminders([...S.calendar, ...cards], now)
    if (!due.length && !stale.length) {
      schedule($)
      return []
    }
    const mark = (list) =>
      markAlerted(
        markAlerted(
          list,
          stale.map((e) => e.id),
          '',
          now,
        ),
        due.map((e) => e.id),
        me,
        now,
      )
    const touched = new Set([...due, ...stale].map((e) => e.id))
    if (cards.some((x) => touched.has(x.id))) await saveCardAlerts($, mark(cards))
    if (S.calendar.some((e) => touched.has(e.id))) await calendarChanged($, mark(S.calendar))
    else schedule($)
    return due
  })
  if (!mine.length) return
  await new Promise((done) => $.clock.after(CLAIM_MS, done))
  // Показывает та сессия, чья отметка осталась; у серии показываем тот её раз, которому было пора (из due)
  const shown = await fresh($, async () => {
    const claimed = new Set([...S.calendar, ...(await cardEvents($))].filter((e) => e.alertedBy === me).map((e) => e.id))
    return mine.filter((x) => claimed.has(x.id))
  })
  if (shown.length) await showReminders($, shown, await $.clock.now())
}

// «сегодня», «завтра», «вчера», «06.11»
export const dayText = (day, today) =>
  day === today ? tr('сегодня', S.lang) : day === addDays(today, 1) ? tr('завтра', S.lang) : day === addDays(today, -1) ? tr('вчера', S.lang) : `${day.slice(8)}.${day.slice(5, 7)}`

// «сегодня 15:00», «завтра, весь день», «06.11 9:30»
export function whenText(ev, today) {
  const day = dayText(ev.day, today)
  return ev.time ? `${day} ${ev.time}` : `${day}, ${tr('весь день', S.lang)}`
}

async function showReminders($, events, now) {
  const today = dayKey(now)
  const line = (ev) =>
    `${now - remindAt(ev) > LATE_MS ? `${tr('Пропущено', S.lang)}: ` : ''}${ev.card ? `${tr('Срок карточки', S.lang)}: ${ev.title} — ${dayText(ev.day, today)}` : `${ev.title} — ${whenText(ev, today)}`}`
  const lines = events.slice(0, SHOW_MAX).map(line)
  if (events.length > SHOW_MAX) lines.push(`${tr('и ещё', S.lang)} ${events.length - SHOW_MAX}`)
  await $.ui.toast(`${tr('Календарь', S.lang)}: ${lines.join('; ')}`)
  const command = notifyCommand(S.platform, tr('Календарь Arcade', S.lang), lines.join('\n'))
  if (!command) return
  $.clock.after(0, async () => {
    try {
      await $.process.run(command.argv, { env: command.env, timeoutMs: 15_000 })
    } catch (err) {
      log(`уведомление не показалось: ${err?.message ?? err}`)
    }
  })
}
