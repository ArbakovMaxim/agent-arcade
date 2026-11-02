// Arcade: экран календаря.
import { keep, tr } from '../i18n.js'
import { addDays, addMonths, between, dayKey, monthGrid, quickParse, weekday } from '../calendar.js'
import { PANE_COLUMNS, S, cal } from '../app/state.js'
import { addFromScreen, deleteEvent, editEvent, nextRemind, whenText } from '../app/calendar.js'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
// «Ближайшее»: события на UPCOMING_DAYS дней вперёд, не больше UPCOMING_MAX
const UPCOMING_DAYS = 30
const UPCOMING_MAX = 10

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const dm = (day) => `${day.slice(8)}.${day.slice(5, 7)}`

// Напоминание словами: «за 15 мин», «за час», «в 9:00»
function remindText(ev) {
  const m = ev.remind
  if (m === null || m === undefined) return tr('нет', S.lang)
  if (m === 0) return ev.time ? tr('в начале', S.lang) : tr('в 9:00', S.lang)
  if (m === 60) return tr('за час', S.lang)
  if (m === 1440) return tr('за сутки', S.lang)
  if (m % 1440 === 0) return tr(`за ${m / 1440} дн.`, S.lang)
  return m % 60 === 0 ? tr(`за ${m / 60} ч`, S.lang) : tr(`за ${m} мин`, S.lang)
}

// Календарь: в Desktop — сетка месяца, события выбранного дня и «Ближайшее»; в терминале — только «Ближайшее».
// Событие открывается своим экраном (calendar:<id>): название, когда, напоминание, заметка, удаление. Названия и заметки —
// человека, без перевода (keep)
export function calendarScreen($, e, kit) {
  const { Box, Button, Input, TILE_GAP, Text, desktop, dim, gap, hint, noticeLines, now, open, section } = kit
  const today = dayKey(now)
  const ev = S.menu.startsWith('calendar:') ? S.calendar.find((x) => x.id === S.menu.slice(9)) : null
  if (!ev && S.menu !== 'calendar') S.menu = 'calendar'
  if (!cal.month) cal.month = today.slice(0, 7)
  const selected = cal.day || today
  const focusOn = (name) => (cal.focus === name ? { autoFocus: true } : {})
  const say = (text, bad = true) => {
    cal.note = text
    cal.bad = bad
    $.ui.invalidate('ui.render')
  }
  const noteLine = cal.note ? [gap, cal.bad ? Text({ color: 'warning', children: [cal.note] }) : dim(cal.note)] : []
  const row = (children) => Box({ flexDirection: 'row', columnGap: 2, alignItems: 'center', children })
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', children: list })] : list)
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  // Открыть событие; назад — фокус на той же кнопке (cal.back — её список)
  const openEvent = (x, list) => () => {
    cal.note = ''
    cal.bad = false
    cal.confirm = false
    cal.focus = ''
    cal.back = list
    open(`calendar:${x.id}`)()
  }

  if (ev) {
    const leave = () => {
      cal.note = ''
      cal.bad = false
      cal.confirm = false
      cal.focus = `${cal.back || 'ev'}-${ev.id}`
      open('calendar')()
    }
    const confirm = cal.confirm
      ? [
          gap,
          Text({ color: 'warning', children: ['Удалить событие насовсем?'] }),
          row([
            Button({ key: 'arcade-cal-delete-yes', label: 'Да, удалить', autoFocus: true, onPress: () => deleteEvent($, ev.id) }),
            Button({
              key: 'arcade-cal-delete-no',
              label: 'Отмена',
              onPress: () => {
                cal.confirm = false
                cal.focus = 'delete'
                $.ui.invalidate('ui.render')
              },
            }),
          ]),
        ]
      : []
    return [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave }),
      gap,
      keep(strong(ev.title)),
      keep(dim(cap(whenText(ev, today)))),
      gap,
      ...stack('cal-event-fields', [
        Input({
          key: `arcade-cal-title-${cal.field}`,
          label: 'Название',
          value: ev.title,
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: (value) => editEvent($, ev.id, { title: value }),
        }),
        // Когда — как в быстрой записи: «пт 15:00», «завтра», «2026-11-20 10:00»; без времени — на весь день
        Input({
          key: `arcade-cal-when-${cal.field}`,
          label: 'Когда',
          value: ev.time ? `${ev.day} ${ev.time}` : ev.day,
          placeholder: 'пт 15:00, завтра, 2026-11-20 10:00',
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: async (value) => {
            const when = quickParse(value, ev.day, today)
            if (when.title) return say('Не понял, когда: пиши как «пт 15:00» или «2026-11-20 10:00».')
            if (await editEvent($, ev.id, { day: when.day, time: when.time })) {
              cal.field++
              $.ui.invalidate('ui.render')
            }
          },
        }),
        dim('  Без времени — на весь день.'),
        Input({
          key: `arcade-cal-note-${cal.field}`,
          label: 'Заметка',
          rows: 4,
          value: ev.note ?? '',
          placeholder: 'ссылка на созвон, что взять, о чём спросить',
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: (value) => editEvent($, ev.id, { note: value }),
        }),
      ]),
      gap,
      keep(
        Button({
          key: 'arcade-cal-remind',
          label: `${tr('Напоминание', S.lang)}: ${remindText(ev)}`,
          ...focusOn('remind'),
          onPress: () => {
            cal.focus = 'remind'
            editEvent($, ev.id, { remind: nextRemind(ev) }, '')
          },
        }),
      ),
      dim(ev.time ? '  Нажми, чтобы сменить: за 5, 15, 30 минут, за час, за сутки, в начале или без напоминания.' : '  У события на весь день — в 9:00 этого дня, за сутки или без напоминания.'),
      ...(cal.confirm
        ? []
        : [
            gap,
            Button({
              key: 'arcade-cal-delete',
              label: 'Удалить событие',
              ...focusOn('delete'),
              onPress: () => {
                cal.confirm = true
                $.ui.invalidate('ui.render')
              },
            }),
          ]),
      ...confirm,
      ...noteLine,
      ...noticeLines,
      ...hint,
    ]
  }

  // Событие кнопкой: время (или «весь день») и название; в «Ближайшем» — ещё и день. Событие бывает в обоих списках
  // разом — ключи у списков свои
  const eventButton = (x, label, list = 'ev') => keep(Button({ key: `arcade-cal-${list}-${x.id}`, label, ...focusOn(`${list}-${x.id}`), onPress: openEvent(x, list) }))
  const dayEvents = between(S.calendar, selected, 1)
  const upcoming = between(S.calendar, today, UPCOMING_DAYS).slice(0, UPCOMING_MAX)
  const addField = [
    Input({
      key: `arcade-cal-add-${cal.field}`,
      label: 'Новое событие',
      placeholder: 'завтра 15:00 Созвон',
      submitLabel: tr('Записать', S.lang),
      ...(cal.focus === 'add' || (!cal.focus && !S.calendar.length) ? { autoFocus: true } : {}),
      onSubmit: (value) => {
        cal.focus = 'add'
        return addFromScreen($, value, desktop ? selected : '')
      },
    }),
    dim(desktop ? '  День и время — словами или числами: «пт 9:30 стендап», «12.11 ревью». Без дня — на выбранный день, без времени — на весь день.' : '  День и время — словами или числами: «пт 9:30 стендап», «12.11 ревью». Без дня — на сегодня, без времени — на весь день.'),
    dim('  Claude тоже ведёт календарь: «запиши созвон в пятницу в 15:00», «что у меня завтра?».'),
  ]
  const upcomingList = [
    section('Ближайшее'),
    ...(upcoming.length
      ? stack('cal-upcoming', upcoming.map((x) => eventButton(x, `${cap(whenText(x, today))} · ${x.title}`)))
      : [dim(S.calendar.length ? 'В ближайший месяц событий нет.' : 'Календарь пуст — запиши первое событие.')]),
  ]
  const reminders = [gap, dim('Напоминания приходят системным уведомлением, пока открыт Claude Code; пропущенные — при следующем запуске.')]
  if (!desktop) return [Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }), gap, ...addField, ...noteLine, ...upcomingList, ...reminders, ...noticeLines, ...hint]

  // Сетка месяца: 7 клеток в ряд, ширина — от ширины панели. День с событиями — с точкой, выбранный — выделен
  const room = (e.viewport?.columns ?? PANE_COLUMNS) - 4
  const width = Math.max(5, Math.min(12, Math.floor((room - 6 * TILE_GAP) / 7)))
  const busy = new Set(S.calendar.map((x) => x.day))
  const cell = (key, child) => Box({ key, width, children: [child] })
  const dayButton = (d) =>
    cell(
      `cal-cell-${d.day}`,
      Button({
        key: `arcade-cal-day-${d.day}`,
        label: `${d.date}${busy.has(d.day) ? '•' : ''}`,
        ...(d.day === selected ? { variant: 'primary' } : {}),
        ...(d.inMonth ? {} : { dimColor: true }),
        ...focusOn(`day-${d.day}`),
        onPress: () => {
          cal.day = d.day
          if (!d.inMonth) cal.month = d.day.slice(0, 7)
          cal.focus = `day-${d.day}`
          cal.note = ''
          $.ui.invalidate('ui.render')
        },
      }),
    )
  const shift = (n, name) => () => {
    cal.month = addMonths(cal.month, n)
    cal.focus = name
    $.ui.invalidate('ui.render')
  }
  const monthTitle = `${tr(MONTHS[Number(cal.month.slice(5)) - 1], S.lang)} ${cal.month.slice(0, 4)}`
  const dayTitle = `${selected === today ? tr('Сегодня', S.lang) : selected === addDays(today, 1) ? tr('Завтра', S.lang) : tr(WEEKDAYS_FULL[weekday(selected)], S.lang)} · ${dm(selected)}`
  const grid = Box({
    key: 'cal-grid',
    flexDirection: 'column',
    rowGap: 'xs',
    children: [
      Box({ flexDirection: 'row', columnGap: TILE_GAP, children: WEEKDAYS.map((w) => cell(`cal-wd-${w}`, dim(w))) }),
      ...monthGrid(cal.month).map((week) => Box({ key: `cal-week-${week[0].day}`, flexDirection: 'row', columnGap: TILE_GAP, children: week.map(dayButton) })),
    ],
  })
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    row([
      Button({ key: 'arcade-cal-prev', label: '‹', ...focusOn('prev'), onPress: shift(-1, 'prev') }),
      keep(strong(monthTitle)),
      Button({ key: 'arcade-cal-next', label: '›', ...focusOn('next'), onPress: shift(1, 'next') }),
      ...(cal.month === today.slice(0, 7) && selected === today
        ? []
        : [
            Button({
              key: 'arcade-cal-today',
              label: 'Сегодня',
              ...focusOn('today'),
              onPress: () => {
                cal.month = today.slice(0, 7)
                cal.day = ''
                cal.focus = `day-${today}`
                $.ui.invalidate('ui.render')
              },
            }),
          ]),
    ]),
    gap,
    grid,
    keep(section(dayTitle)),
    ...(dayEvents.length ? stack('cal-day', dayEvents.map((x) => eventButton(x, `${x.time ?? tr('весь день', S.lang)} · ${x.title}`, 'dayev'))) : [dim('В этот день событий нет.')]),
    gap,
    ...addField,
    ...noteLine,
    ...upcomingList,
    ...reminders,
    ...noticeLines,
    ...hint,
  ]
}
