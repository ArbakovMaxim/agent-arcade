// Arcade: календарь — хранилище, правки с экрана, инструмент Claude и напоминания.
import { notifyCommand } from '../browsers.js'
import { tr } from '../i18n.js'
import { REMIND_STEPS, addDays, addEvent, applyCalendarTool, dayKey, dueReminders, markAlerted, nextReminder, quickParse, remindAt, removeEvent, restoreCalendar, updateEvent } from '../calendar.js'
import { S, cal } from './state.js'
import { log } from './status.js'

const modError = (err) => log(`ошибка мода: ${err?.message ?? err}`)

// Календарь в $.store — один на все сессии, как блокнот (см. work.js): всякая правка — по очереди и поверх свежего
// календаря из хранилища. calJson — календарь, каким его последний раз прочли или записали
let calJson = ''
let queue = Promise.resolve()

function fresh($, work) {
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
const sameEvent = (a, b) => ['title', 'day', 'time', 'note', 'remind'].every((k) => a[k] === b[k])
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

async function calendarChanged($, list) {
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
export function calendarTool($, input) {
  return fresh($, async () => {
    const at = await $.clock.now()
    const out = applyCalendarTool(S.calendar, input, at)
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
  full: 'Календарь полон — удали старые события.',
  missing: 'Событие удалили в другой сессии.',
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

// Напоминание по кругу; у события на весь день — без него, в 9:00 или за сутки
export function nextRemind(ev) {
  const steps = ev.time ? REMIND_STEPS : [null, 0, 1440]
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
const CLAIM_MS = 500
// Напоминание показали позже его времени больше чем на LATE_MS (Claude Code был закрыт) — «Пропущено»
const LATE_MS = 2 * 60_000
const SHOW_MAX = 3
const me = `s${Math.random().toString(36).slice(2, 10)}`
let timer = null
let gen = 0

export function schedule($) {
  const my = ++gen
  timer?.cancel?.()
  timer = null
  $.clock
    .now()
    .then((now) => {
      if (my !== gen) return
      const next = nextReminder(S.calendar, now)
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
    const { due, stale } = dueReminders(S.calendar, now)
    if (!due.length && !stale.length) {
      schedule($)
      return []
    }
    const list = markAlerted(
      markAlerted(
        S.calendar,
        stale.map((e) => e.id),
      ),
      due.map((e) => e.id),
      me,
    )
    await calendarChanged($, list)
    return due.map((e) => e.id)
  })
  if (!mine.length) return
  await new Promise((done) => $.clock.after(CLAIM_MS, done))
  const shown = await fresh($, async () => S.calendar.filter((e) => mine.includes(e.id) && e.alertedBy === me))
  if (shown.length) await showReminders($, shown, await $.clock.now())
}

// «сегодня 15:00», «завтра, весь день», «06.11 9:30»
export function whenText(ev, today) {
  const day =
    ev.day === today ? tr('сегодня', S.lang) : ev.day === addDays(today, 1) ? tr('завтра', S.lang) : ev.day === addDays(today, -1) ? tr('вчера', S.lang) : `${ev.day.slice(8)}.${ev.day.slice(5, 7)}`
  return ev.time ? `${day} ${ev.time}` : `${day}, ${tr('весь день', S.lang)}`
}

async function showReminders($, events, now) {
  const today = dayKey(now)
  const line = (ev) => `${now - remindAt(ev) > LATE_MS ? `${tr('Пропущено', S.lang)}: ` : ''}${ev.title} — ${whenText(ev, today)}`
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
