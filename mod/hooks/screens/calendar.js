// Arcade: экран календаря.
import { keep, tr } from '../i18n.js'
import { ALL_DAY_HOUR, COLORS, DEFAULT_COLOR, addDays, addMonths, between, colorOf, dayKey, monthGrid, parseRemind, quickParse, weekday } from '../calendar.js'
import { PANE_COLUMNS, S, cal } from '../app/state.js'
import { addFromScreen, deleteEvent, editEvent, nextRemind, remindChoices, whenText } from '../app/calendar.js'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
// Цвета событий словами — в выборе цвета
const COLOR_NAMES = { blue: 'синий', green: 'зелёный', yellow: 'жёлтый', orange: 'оранжевый', red: 'красный', purple: 'фиолетовый', pink: 'розовый', gray: 'серый' }
// «Ближайшее»: события на UPCOMING_DAYS дней вперёд, не больше UPCOMING_MAX
const UPCOMING_DAYS = 30
const UPCOMING_MAX = 10
// Плитка дня в Desktop: ширина в клетках — от ширины панели, в этих пределах; цветных точек событий — не больше DOTS_MAX
const CELL_MIN = 6
const CELL_MAX = 11
const CELL_GAP = 1
const DOTS_MAX = 3
// Сегодняшний день — с голубой подложкой, плитка под мышью — с серой
const TODAY_BG = '#3a78b526'
const HOVER_BG = '#8080801a'

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const dm = (day) => `${day.slice(8)}.${day.slice(5, 7)}`
const clock = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
const remindValue = (m) => (m === null ? 'none' : String(m))

// Напоминание словами. У события со временем — «за 15 мин», «за 1 ч 30 мин», «за сутки»; у события на весь день —
// часами: «в 8:00», «накануне в 21:00», «за 2 дн. в 9:00»
function remindText(ev, m = ev.remind) {
  if (m === null || m === undefined) return tr('без напоминания', S.lang)
  if (!ev.time) {
    const at = ALL_DAY_HOUR * 60 - m // минуты от полуночи дня события; накануне — меньше нуля
    const back = Math.max(0, -Math.floor(at / 1440))
    const time = clock(at + back * 1440)
    if (!back) return tr(`в ${time}`, S.lang)
    if (back === 1) return tr(`накануне в ${time}`, S.lang)
    return tr(back === 7 ? `за неделю в ${time}` : `за ${back} дн. в ${time}`, S.lang)
  }
  if (m === 0) return tr('в начале', S.lang)
  if (m === 60) return tr('за час', S.lang)
  if (m === 1440) return tr('за сутки', S.lang)
  if (m === 10080) return tr('за неделю', S.lang)
  if (m % 1440 === 0) return tr(`за ${m / 1440} дн.`, S.lang)
  if (m < 60) return tr(`за ${m} мин`, S.lang)
  return tr(m % 60 ? `за ${Math.floor(m / 60)} ч ${m % 60} мин` : `за ${m / 60} ч`, S.lang)
}

// Календарь: в Desktop — сетка месяца плитками одного размера, события выбранного дня и «Ближайшее» карточками своего
// цвета; в терминале — только «Ближайшее». Событие открывается своим экраном (calendar:<id>): название, когда, заметка,
// цвет, напоминание, удаление. Названия и заметки — человека, без перевода (keep)
export function calendarScreen($, e, kit) {
  const { Box, Button, Input, Select, Text, desktop, dim, gap, hint, noticeLines, now, open, section } = kit
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
  const dot = (x, more = {}) => Text({ color: colorOf(x), ...more, children: ['●'] })
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
    // Цвет — кнопками с цветным кружком; выбранный — главной кнопкой
    const color = ev.color || DEFAULT_COLOR
    const colors = Box({
      key: 'cal-colors',
      flexDirection: 'row',
      flexWrap: 'wrap',
      columnGap: 1,
      rowGap: 'xs',
      children: Object.keys(COLORS).map((name) =>
        keep(
          Button({
            key: `arcade-cal-color-${name}`,
            label: tr(COLOR_NAMES[name], S.lang),
            ...(name === color ? { variant: 'primary' } : {}),
            ...focusOn(`color-${name}`),
            children: [Text({ color: COLORS[name], children: ['● '] }), tr(COLOR_NAMES[name], S.lang)],
            onPress: () => {
              cal.focus = `color-${name}`
              editEvent($, ev.id, { color: name === DEFAULT_COLOR ? '' : name }, '')
            },
          }),
        ),
      ),
    })
    // Напоминание — выбором из списка; где выбора нет (Claude на телефоне) — кнопкой по кругу
    const remindPick = Select
      ? keep(
          Select({
            key: 'arcade-cal-remind',
            label: tr('Напомнить', S.lang),
            options: remindChoices(ev).map((m) => ({ value: remindValue(m), label: remindText(ev, m) })),
            value: remindValue(ev.remind),
            ...focusOn('remind'),
            onSelect: (value) => {
              cal.focus = 'remind'
              editEvent($, ev.id, { remind: value === 'none' ? null : Number(value) }, '')
            },
          }),
        )
      : keep(
          Button({
            key: 'arcade-cal-remind',
            label: `${tr('Напомнить', S.lang)}: ${remindText(ev)}`,
            ...focusOn('remind'),
            onPress: () => {
              cal.focus = 'remind'
              editEvent($, ev.id, { remind: nextRemind(ev) }, '')
            },
          }),
        )
    // Своё время напоминания словами: «за 45 мин», «накануне в 20:00»
    const remindOwn = Input({
      key: `arcade-cal-remind-own-${cal.field}`,
      label: 'Или своё время',
      placeholder: ev.time ? 'за 45 мин, в 14:30, накануне в 20:00' : 'в 8:30, накануне в 20:00, за 3 дня в 9:00',
      submitLabel: tr('Сохранить', S.lang),
      onSubmit: async (value) => {
        const m = parseRemind(value, ev)
        if (m === undefined)
          return say(
            ev.time
              ? 'Не понял, когда напомнить: пиши как «за 45 мин», «в 14:30» или «накануне в 20:00» — не позже начала и не раньше чем за неделю.'
              : 'Не понял, когда напомнить: пиши как «в 8:30», «накануне в 20:00» или «за 3 дня в 9:00» — не позже 9:00 этого дня и не раньше чем за неделю.',
          )
        if (await editEvent($, ev.id, { remind: m })) {
          cal.field++
          $.ui.invalidate('ui.render')
        }
      },
    })
    const title = desktop ? { size: 'heading', weight: 'semibold', wrap: 'wrap' } : { bold: true }
    return [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave }),
      gap,
      keep(Box({ flexDirection: 'row', columnGap: 1, alignItems: 'center', children: [dot(ev, desktop ? { size: 'heading' } : {}), Text({ ...title, children: [ev.title] })] })),
      keep(dim(`${cap(whenText(ev, today))}${ev.remind === null ? '' : ` · 🔔 ${remindText(ev)}`}`)),
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
      strong('Цвет'),
      colors,
      gap,
      strong('Напоминание'),
      ...stack('cal-event-remind', [remindPick, remindOwn]),
      dim('  Приходит системным уведомлением, пока открыт Claude Code.'),
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

  // Событие кнопкой с цветным кружком: время (или «весь день») и название; в «Ближайшем» — ещё и день. Событие бывает
  // в обоих списках разом — ключи у списков свои
  const eventButton = (x, label, list) =>
    keep(Button({ key: `arcade-cal-${list}-${x.id}`, label, ...focusOn(`${list}-${x.id}`), children: [dot(x), ` ${label}`], onPress: openEvent(x, list) }))
  // В Desktop событие — карточка его цвета: название кнопкой, ниже когда и напоминание, первая строка заметки
  const eventCard = (x, when, list) => {
    const hex = colorOf(x)
    const line = [when, x.remind === null ? '' : `🔔 ${remindText(x)}`].filter(Boolean).join(' · ')
    const first = x.note?.split('\n')[0] ?? ''
    return Box({
      key: `cal-card-${list}-${x.id}`,
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'xs',
      borderStyle: 'round',
      borderColor: `${hex}80`,
      backgroundColor: `${hex}14`,
      paddingX: 'sm',
      paddingY: 'xs',
      hover: { borderColor: hex, backgroundColor: `${hex}26` },
      children: [
        eventButton(x, x.title, list),
        keep(dim(line)),
        ...(first ? [keep(Text({ dimColor: true, size: 'footnote', wrap: 'truncate-end', children: [first] }))] : []),
      ],
    })
  }
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
    dim('  Цвет и напоминание — в самом событии. Claude тоже ведёт календарь: «запиши созвон в пятницу в 15:00», «что у меня завтра?».'),
  ]
  const upcomingList = [
    section('Ближайшее'),
    ...(upcoming.length
      ? stack(
          'cal-upcoming',
          upcoming.map((x) => (desktop ? eventCard(x, cap(whenText(x, today)), 'ev') : eventButton(x, `${cap(whenText(x, today))} · ${x.title}`, 'ev'))),
        )
      : [dim(S.calendar.length ? 'В ближайший месяц событий нет.' : 'Календарь пуст — запиши первое событие.')]),
  ]
  const reminders = [gap, dim('Напоминания приходят системным уведомлением, пока открыт Claude Code; пропущенные — при следующем запуске.')]
  if (!desktop) return [Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }), gap, ...addField, ...noteLine, ...upcomingList, ...reminders, ...noticeLines, ...hint]

  // Сетка месяца: 7 плиток одного размера в ряд. На плитке — число кнопкой и цветные точки событий дня; выбранный
  // день — в рамке цвета выбора, сегодняшний — с подложкой
  const room = (e.viewport?.columns ?? PANE_COLUMNS) - 4
  const width = Math.max(CELL_MIN, Math.min(CELL_MAX, Math.floor((room - 6 * CELL_GAP) / 7)))
  const byDay = new Map()
  for (const x of S.calendar) byDay.set(x.day, [...(byDay.get(x.day) ?? []), x])
  const dots = (list) =>
    Text({
      size: 'caption',
      children: list.length ? [...list.slice(0, DOTS_MAX).map((x) => dot(x)), ...(list.length > DOTS_MAX ? [Text({ dimColor: true, children: [`+${list.length - DOTS_MAX}`] })] : [])] : [' '],
    })
  const dayTile = (d) =>
    Box({
      key: `cal-cell-${d.day}`,
      width,
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'xs',
      paddingY: 'xs',
      overflow: 'hidden',
      borderStyle: 'round',
      borderColor: d.day === selected ? 'suggestion' : 'subtle',
      ...(d.day === today ? { backgroundColor: TODAY_BG } : {}),
      hover: { borderColor: 'suggestion', backgroundColor: HOVER_BG },
      children: [
        Button({
          key: `arcade-cal-day-${d.day}`,
          label: String(d.date),
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
        dots(byDay.get(d.day) ?? []),
      ],
    })
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
    rowGap: CELL_GAP,
    children: [
      Box({ flexDirection: 'row', columnGap: CELL_GAP, children: WEEKDAYS.map((w) => Box({ key: `cal-wd-${w}`, width, alignItems: 'center', children: [dim(w)] })) }),
      ...monthGrid(cal.month).map((week) => Box({ key: `cal-week-${week[0].day}`, flexDirection: 'row', columnGap: CELL_GAP, children: week.map(dayTile) })),
    ],
  })
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    row([
      Button({ key: 'arcade-cal-prev', label: '‹', ...focusOn('prev'), onPress: shift(-1, 'prev') }),
      keep(Text({ size: 'heading', weight: 'semibold', children: [monthTitle] })),
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
    ...(dayEvents.length
      ? stack(
          'cal-day',
          dayEvents.map((x) => eventCard(x, x.time ?? tr('весь день', S.lang), 'dayev')),
        )
      : [dim(selected < today ? 'В этот день ничего не было.' : 'Свободный день — запиши что-нибудь ниже.')]),
    gap,
    ...addField,
    ...noteLine,
    ...upcomingList,
    ...reminders,
    ...noticeLines,
    ...hint,
  ]
}
