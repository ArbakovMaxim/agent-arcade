// Arcade: экран календаря.
import { fill } from '../chats.js'
import { keep, tr } from '../i18n.js'
import { ALL_DAY_HOUR, COLORS, DEFAULT_COLOR, GIVE_KEY, GIVE_KINDS, REPEATS, addDays, addMonths, between, cardDues, colorOf, compareEvents, dayKey, giveTargets, monthGrid, parseRemind, quickParse, weekday } from '../calendar.js'
import { columnOf } from '../notes.js'
import { S, cal } from '../app/state.js'
import { samePath } from '../app/agents.js'
import { addFromScreen, dayText, deleteEvent, editEvent, nextRemind, remindChoices, whenText } from '../app/calendar.js'
import { dropMissed, missedTasks, runMissed } from '../app/schedule.js'

const MONTHS = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь']
const WEEKDAYS = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс']
const WEEKDAYS_FULL = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']
// Цвета событий словами — в выборе цвета
const COLOR_NAMES = { blue: 'синий', green: 'зелёный', yellow: 'жёлтый', orange: 'оранжевый', red: 'красный', purple: 'фиолетовый', pink: 'розовый', gray: 'серый' }
// Повтор словами — в выборе повтора и в строках событий
const REPEAT_NAMES = { '': 'Не повторять', daily: 'Каждый день', weekdays: 'По будням', weekly: 'Каждую неделю', monthly: 'Каждый месяц', yearly: 'Каждый год' }
const repeatText = (r) => tr(REPEAT_NAMES[r ?? ''], S.lang)
// «Ближайшее»: события на UPCOMING_DAYS дней вперёд, не больше UPCOMING_MAX
const UPCOMING_DAYS = 30
const UPCOMING_MAX = 10
// Плитка дня в Desktop: семь плиток делят ширину панели поровну и ужимаются вместе с ней; цветных точек событий —
// не больше DOTS_MAX. Панель уже LIST_BELOW знаков (около 360 px) — месяц не сеткой, а списком дней
const CELL_GAP = 'xs'
const DOTS_MAX = 3
const LIST_BELOW = 44
// Сегодняшний день — с голубой подложкой, плитка под мышью — с серой
const TODAY_BG = '#3a78b526'
const HOVER_BG = '#8080801a'

const cap = (text) => text.charAt(0).toUpperCase() + text.slice(1)
const dm = (day) => `${day.slice(8)}.${day.slice(5, 7)}`
const clock = (min) => `${Math.floor(min / 60)}:${String(min % 60).padStart(2, '0')}`
const remindValue = (m) => (m === null ? 'none' : String(m))
// «Дать Claude»: что событие даёт Claude в своё время — в выборе и коротко в карточке события
const GIVE_NAMES = { none: 'Ничего', queue: 'Очередь доски', card: 'Одну карточку', prompt: 'Шаблон из «Промптов»', text: 'Свой текст' }
const GIVE_SHORT = { queue: 'очередь доски', card: 'карточка', prompt: 'шаблон', text: 'свой текст' }
const GIVE_PICK = { queue: 'Выбери доску', card: 'Выбери карточку', prompt: 'Выбери шаблон' }
const GIVE_EMPTY = {
  queue: '  Досок проектов пока нет — заведи доску в «Работе».',
  card: '  На досках проектов пока нет карточек, кроме сделанных.',
  prompt: '  Шаблонов пока нет — заведи их в «Промптах».',
}
// Когда пропущенное задание должно было пойти: «сегодня 9:00», «06.11 18:30»
const stampText = (ms, today) => {
  const d = new Date(ms)
  return `${dayText(dayKey(ms), today)} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}
// Цели задания для выбора: доски проектов; карточки досок (без сделанных) — «Доска · Карточка»; шаблоны — «Набор · Шаблон»
function giveOptions(kind) {
  const list = giveTargets(S.notes, kind)
  if (kind === 'queue') return list.map((b) => ({ value: b.id, label: b.title }))
  const parent = (p) => S.notes.find((b) => b.id === p.parent)
  return list
    .filter((p) => kind !== 'card' || columnOf(p, parent(p).board.cols) !== parent(p).board.cols.at(-1).id)
    .map((p) => ({ value: p.id, label: `${parent(p).title} · ${p.title}` }))
}

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
  // Серия бывает в списке несколько раз — ключ и фокус у каждого её раза свои, с днём
  const ref = (x) => (x.first ? `${x.id}-${x.day}` : x.id)
  // Открыть событие; назад — фокус на той же кнопке (cal.back — её фокус). Срок карточки доски открывает саму карточку,
  // раз серии — всю серию
  const openEvent = (x, list) => () => {
    cal.note = ''
    cal.bad = false
    cal.confirm = false
    cal.giveKind = null
    cal.focus = ''
    cal.back = `${list}-${ref(x)}`
    open(x.card ? `note:${x.card}` : `calendar:${x.id}`)()
  }

  if (ev) {
    const leave = () => {
      cal.note = ''
      cal.bad = false
      cal.confirm = false
      cal.giveKind = null
      cal.focus = cal.back || `ev-${ev.id}`
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
    // Повтор — выбором из списка, где выбора нет — кнопкой по кругу. Серия по будням с выходного дня начинается с
    // понедельника: день первого раза поменялся — поле «Когда» рисуется заново
    const repeats = ['', ...REPEATS]
    const setRepeat = async (repeat) => {
      cal.focus = 'repeat'
      const day = ev.day
      if ((await editEvent($, ev.id, { repeat }, '')) && S.calendar.find((x) => x.id === ev.id)?.day !== day) {
        cal.field++
        $.ui.invalidate('ui.render')
      }
    }
    const repeatPick = Select
      ? keep(
          Select({
            key: 'arcade-cal-repeat',
            label: tr('Повтор', S.lang),
            options: repeats.map((r) => ({ value: r || 'none', label: repeatText(r) })),
            value: ev.repeat || 'none',
            ...focusOn('repeat'),
            onSelect: (value) => setRepeat(value === 'none' ? '' : value),
          }),
        )
      : keep(
          Button({
            key: 'arcade-cal-repeat',
            label: `${tr('Повтор', S.lang)}: ${repeatText(ev.repeat)}`,
            ...focusOn('repeat'),
            onPress: () => setRepeat(repeats[(repeats.indexOf(ev.repeat ?? '') + 1) % repeats.length]),
          }),
        )
    // Дать Claude: вид задания — выбором из списка (где выбора нет — кнопкой по кругу); цель — вторым выбором, свой текст —
    // полем. Выбранный, но ещё не заданный вид ждёт в cal.giveKind. Задание помнит папку сессии, где его дали
    const g = ev.give ?? null
    const here = S.ag?.path ?? ''
    const kind = cal.giveKind?.id === ev.id ? cal.giveKind.kind : (g?.kind ?? 'none')
    const pick = (name, label, options, value, onSelect) =>
      Select
        ? keep(
            Select({
              key: `arcade-cal-${name}`,
              label: tr(label, S.lang),
              options,
              value,
              ...focusOn(name),
              onSelect: (v) => {
                cal.focus = name
                onSelect(v)
              },
            }),
          )
        : keep(
            Button({
              key: `arcade-cal-${name}`,
              label: `${tr(label, S.lang)}: ${options.find((o) => o.value === value)?.label ?? ''}`,
              ...focusOn(name),
              onPress: () => {
                cal.focus = name
                const real = options.filter((o) => o.value !== 'pick')
                onSelect(real[(real.findIndex((o) => o.value === value) + 1) % real.length].value)
              },
            }),
          )
    const setGive = async (give, saved = '') => {
      if (await editEvent($, ev.id, { give, ...(ev.cwd || !here ? {} : { cwd: here }) }, saved)) {
        cal.giveKind = null
        if (give.kind === 'text') cal.field++
        $.ui.invalidate('ui.render')
      }
    }
    const kindPick = pick(
      'give-kind',
      'Что дать',
      ['none', ...GIVE_KINDS].map((k) => ({ value: k, label: tr(GIVE_NAMES[k], S.lang) })),
      kind,
      (value) => {
        if (value === 'none') {
          cal.giveKind = null
          if (g) return editEvent($, ev.id, { give: null }, '')
        } else cal.giveKind = value === g?.kind ? null : { id: ev.id, kind: value }
        $.ui.invalidate('ui.render')
      },
    )
    const targetOf = () => {
      const options = giveOptions(kind)
      const current = g?.kind === kind ? g[GIVE_KEY[kind]] : ''
      // Цель удалили — её имя остаётся в выборе, пока не выбрана другая
      if (current && !options.some((o) => o.value === current)) options.unshift({ value: current, label: `${g.name} — ${tr('больше нет', S.lang)}` })
      if (!options.length) return [dim(GIVE_EMPTY[kind])]
      if (!current) options.unshift({ value: 'pick', label: tr(GIVE_PICK[kind], S.lang) })
      return [
        pick('give-target', GIVE_NAMES[kind], options, current || 'pick', (value) => {
          if (value === 'pick' || value === current) return
          setGive({ kind, [GIVE_KEY[kind]]: value, name: giveTargets(S.notes, kind).find((p) => p.id === value)?.title ?? '' })
        }),
      ]
    }
    const textField = Input({
      key: `arcade-cal-task-${cal.field}`,
      label: 'Текст для Claude',
      rows: 4,
      value: g?.kind === 'text' ? g.text : '',
      placeholder: 'проверь открытые PR и напиши, что горит',
      submitLabel: tr('Сохранить', S.lang),
      onSubmit: (value) => (value.trim() ? setGive({ kind: 'text', text: value }, 'Сохранено.') : say('Напиши, что дать Claude.')),
    })
    const inFolder = !ev.cwd || samePath(ev.cwd, here)
    const missedLine = Number.isFinite(ev.missed)
      ? [
          Text({ color: 'warning', children: [fill(tr('Пропущено {0}: Claude Code был закрыт или компьютер спал.', S.lang), [stampText(ev.missed, today)])] }),
          inFolder
            ? row([
                Button({ key: 'arcade-cal-run-missed', label: 'Запустить сейчас', ...focusOn('run-missed'), onPress: () => runMissed($, ev.id) }),
                Button({ key: 'arcade-cal-drop-missed', label: 'Не запускать', ...focusOn('drop-missed'), onPress: () => dropMissed($, ev.id) }),
              ])
            : dim('  Запустить можно в сессии Claude Code в папке задания.'),
        ]
      : []
    const giveBlock =
      kind === 'none'
        ? [kindPick, dim('  В своё время событие даст Claude очередь доски, одну карточку, шаблон из «Промптов» или свой текст.')]
        : [
            ...stack('cal-event-give', [kindPick, ...(kind === 'text' ? [textField] : targetOf())]),
            dim(ev.time ? '  В своё время — в открытой сессии Claude Code в этой папке, только в одной. Claude занят — задание ждёт конца хода.' : '  В 9:00 — в открытой сессии Claude Code в этой папке, только в одной. Claude занят — задание ждёт конца хода.'),
            ...(g && ev.cwd ? [keep(dim(`  ${tr('Папка', S.lang)}: ${ev.cwd}`))] : []),
            ...(g && ev.cwd && here && !inFolder
              ? [Button({ key: 'arcade-cal-give-here', label: 'Запускать в этой папке', ...focusOn('give-here'), onPress: () => editEvent($, ev.id, { cwd: here }) })]
              : []),
            dim('  Работает, пока открыт Claude Code и компьютер не спит. Задание идёт в режиме разрешений сессии: вне Auto Claude может ждать разрешения.'),
            ...missedLine,
          ]
    // Когда: «Завтра 15:00»; у серии — «🔁 По будням, 09:30 · первый раз сегодня»
    const when = ev.repeat ? `🔁 ${repeatText(ev.repeat)}, ${ev.time || tr('весь день', S.lang)} · ${tr('первый раз', S.lang)} ${dayText(ev.day, today)}` : cap(whenText(ev, today))
    const title = desktop ? { size: 'heading', weight: 'semibold', wrap: 'wrap' } : { bold: true }
    return [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave }),
      gap,
      keep(Box({ flexDirection: 'row', columnGap: 1, alignItems: 'center', children: [dot(ev, desktop ? { size: 'heading' } : {}), Text({ ...title, children: [ev.title] })] })),
      keep(dim(`${when}${ev.remind === null ? '' : ` · 🔔 ${remindText(ev)}`}`)),
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
            if (await editEvent($, ev.id, { day: when.day, time: when.time, ...(when.repeat ? { repeat: when.repeat } : {}) })) {
              cal.field++
              $.ui.invalidate('ui.render')
            }
          },
        }),
        dim('  Без времени — на весь день.'),
        ...(ev.repeat ? [dim('  У повторяющегося события здесь — день первого раза.')] : []),
        repeatPick,
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
      gap,
      strong('Дать Claude'),
      ...giveBlock,
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
    keep(Button({ key: `arcade-cal-${list}-${ref(x)}`, label, ...focusOn(`${list}-${ref(x)}`), children: [dot(x), ` ${label}`], onPress: openEvent(x, list) }))
  // В Desktop событие — карточка его цвета: название кнопкой, ниже когда и напоминание, первая строка заметки
  const eventCard = (x, when, list) => {
    const hex = colorOf(x)
    const line = (x.card ? [when, `${tr('доска', S.lang)} ${x.board}`, x.done ? tr('сделано', S.lang) : ''] : [when, x.repeat ? `🔁 ${repeatText(x.repeat)}` : '', x.remind === null ? '' : `🔔 ${remindText(x)}`, x.give ? `🤖 ${tr(GIVE_SHORT[x.give.kind], S.lang)}` : '', Number.isFinite(x.missed) ? `⚠ ${tr('пропущено', S.lang)}` : '']).filter(Boolean).join(' · ')
    const first = x.note?.split('\n')[0] ?? ''
    return Box({
      key: `cal-card-${list}-${ref(x)}`,
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
  // События и сроки карточек досок вместе; в «Ближайшем» — без сделанных карточек, серия — один раз, ближайшим
  const all = [...S.calendar, ...cardDues(S.notes)].sort(compareEvents)
  const dayEvents = between(all, selected, 1)
  const seen = new Set()
  const upcoming = between(all, today, UPCOMING_DAYS)
    .filter((x) => !x.done && !seen.has(x.id) && seen.add(x.id))
    .slice(0, UPCOMING_MAX)
  // Когда: «Сегодня, весь день», «Завтра 15:00»; у карточки — «Сегодня, срок карточки»
  const whenOf = (x) => cap(x.card ? `${dayText(x.day, today)}, ${tr('срок карточки', S.lang)}` : whenText(x, today))
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
    dim('  Цвет, напоминание и «Дать Claude» — в самом событии. Claude тоже ведёт календарь: «запиши созвон в пятницу в 15:00», «что у меня завтра?».'),
  ]
  const upcomingList = [
    section('Ближайшее'),
    ...(upcoming.length
      ? stack(
          'cal-upcoming',
          upcoming.map((x) => (desktop ? eventCard(x, whenOf(x), 'ev') : eventButton(x, `${whenOf(x)} · ${x.title}${x.repeat ? ' 🔁' : ''}${x.give ? ' 🤖' : ''}`, 'ev'))),
        )
      : [dim(S.calendar.length ? 'В ближайший месяц событий нет.' : 'Календарь пуст — запиши первое событие.')]),
  ]
  const reminders = [gap, dim('Напоминания приходят системным уведомлением, пока открыт Claude Code; пропущенные — при следующем запуске.')]
  // Пропущенные задания этой папки: Claude Code был закрыт или компьютер спал — задним числом само не идёт,
  // только по «Запустить сейчас»
  const missed = missedTasks()
  const missedBlock = missed.length
    ? [
        section('Пропущено'),
        ...stack(
          'cal-missed',
          missed.map((x) =>
            Box({
              key: `cal-missed-${x.id}`,
              flexDirection: 'column',
              rowGap: 'xs',
              children: [
                keep(Text({ ...(desktop ? { wrap: 'wrap' } : {}), children: [dot(x), ` ${x.title} · ${stampText(x.missed, today)}`] })),
                row([
                  Button({ key: `arcade-cal-run-${x.id}`, label: 'Запустить сейчас', ...focusOn(`run-${x.id}`), onPress: () => runMissed($, x.id) }),
                  Button({ key: `arcade-cal-drop-${x.id}`, label: 'Не запускать', ...focusOn(`drop-${x.id}`), onPress: () => dropMissed($, x.id) }),
                ]),
              ],
            }),
          ),
        ),
        dim('  Задание не пошло в своё время: Claude Code был закрыт или компьютер спал. Само задним числом не запускается.'),
        gap,
      ]
    : []
  if (!desktop) return [Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }), gap, ...missedBlock, ...addField, ...noteLine, ...upcomingList, ...reminders, ...noticeLines, ...hint]

  // Сетка месяца: 7 плиток одного размера в ряд, растянутых на всю ширину панели — плитка шире, чем выше. На плитке —
  // число кнопкой и цветные точки событий дня; выбранный день — в рамке цвета выбора, сегодняшний — с подложкой.
  // Боковые поля плитки заданы явно: Box с рамкой Desktop сам обводит полями pad.lg, и на узкой плитке кнопке с числом
  // не оставалось места — число обрезалось целиком. Кнопка с числом — без «пилюли» (plain): та шире самого числа и не
  // давала плиткам ужаться, ряд уезжал за край панели. Плитка ужимается до нуля, лишнее обрезается — но не ряд
  const cell = { width: 0, flexGrow: 1, minWidth: 0, overflow: 'hidden' }
  // События по дням всей сетки месяца — с разами серий
  const weeks = monthGrid(cal.month)
  const byDay = new Map()
  for (const x of between(all, weeks[0][0].day, weeks.length * 7)) byDay.set(x.day, [...(byDay.get(x.day) ?? []), x])
  const pickDay = (d) => () => {
    cal.day = d.day
    if (!d.inMonth) cal.month = d.day.slice(0, 7)
    cal.focus = `day-${d.day}`
    cal.note = ''
    $.ui.invalidate('ui.render')
  }
  const dayName = (day) =>
    `${day === today ? tr('Сегодня', S.lang) : day === addDays(today, 1) ? tr('Завтра', S.lang) : tr(WEEKDAYS_FULL[weekday(day)], S.lang)} · ${dm(day)}`
  const freeDay = (day) => dim(day < today ? 'В этот день ничего не было.' : 'Свободный день — запиши что-нибудь ниже.')
  const dayCards = (list) => list.map((x) => eventCard(x, x.card ? tr('срок карточки', S.lang) : (x.time ?? tr('весь день', S.lang)), 'dayev'))
  const dots = (list) =>
    Text({
      size: 'caption',
      children: list.length ? [...list.slice(0, DOTS_MAX).map((x) => dot(x)), ...(list.length > DOTS_MAX ? [Text({ dimColor: true, children: [`+${list.length - DOTS_MAX}`] })] : [])] : [' '],
    })
  const dayTile = (d) =>
    Box({
      key: `cal-cell-${d.day}`,
      ...cell,
      flexDirection: 'column',
      alignItems: 'center',
      rowGap: 'xs',
      paddingX: 'xs',
      paddingY: 'xs',
      borderStyle: 'round',
      borderColor: d.day === selected ? 'suggestion' : 'subtle',
      ...(d.day === today ? { backgroundColor: TODAY_BG } : {}),
      hover: { borderColor: 'suggestion', backgroundColor: HOVER_BG },
      children: [
        Button({
          key: `arcade-cal-day-${d.day}`,
          label: String(d.date),
          plain: true,
          ...(d.inMonth ? {} : { dimColor: true }),
          ...focusOn(`day-${d.day}`),
          onPress: pickDay(d),
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
  const grid = Box({
    key: 'cal-grid',
    flexDirection: 'column',
    rowGap: CELL_GAP,
    children: [
      Box({ flexDirection: 'row', columnGap: CELL_GAP, children: WEEKDAYS.map((w) => Box({ key: `cal-wd-${w}`, ...cell, alignItems: 'center', children: [dim(w)] })) }),
      ...weeks.map((week) => Box({ key: `cal-week-${week[0].day}`, flexDirection: 'row', columnGap: CELL_GAP, children: week.map(dayTile) })),
    ],
  })
  // Узкая панель — месяц списком, как «Расписание» в календаре телефона: дни с событиями, сегодняшний и выбранный;
  // день — кнопкой, под ним карточки его событий
  const monthList = () => {
    const listed = weeks
      .flat()
      .filter((d) => d.inMonth && (byDay.has(d.day) || d.day === today || d.day === selected))
    return Box({
    key: 'cal-list',
    flexDirection: 'column',
    rowGap: 'md',
    children: listed.length
      ? listed.map((d) => {
          const cards = dayCards(byDay.get(d.day) ?? [])
          return Box({
            key: `cal-list-${d.day}`,
            flexDirection: 'column',
            rowGap: 'xs',
            children: [
              Button({ key: `arcade-cal-day-${d.day}`, label: dayName(d.day), ...(d.day === selected ? { variant: 'primary' } : {}), ...focusOn(`day-${d.day}`), onPress: pickDay(d) }),
              ...(cards.length ? [Box({ key: `cal-list-cards-${d.day}`, flexDirection: 'column', rowGap: 'sm', children: cards })] : [freeDay(d.day)]),
            ],
          })
        })
      : [dim('В этом месяце событий нет.')],
  })
  }
  const narrow = (e.viewport?.columns ?? Infinity) < LIST_BELOW
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    ...missedBlock,
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
    ...(narrow ? [monthList()] : [grid, keep(section(dayName(selected))), ...(dayEvents.length ? stack('cal-day', dayCards(dayEvents)) : [freeDay(selected)])]),
    gap,
    ...addField,
    ...noteLine,
    ...upcomingList,
    ...reminders,
    ...noticeLines,
    ...hint,
  ]
}
