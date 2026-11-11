// Arcade: задания по расписанию — «Дать Claude» у события календаря. В своё время событие даёт Claude очередь доски,
// одну карточку, шаблон из «Промптов» или свой текст — в открытой сессии той папки, где задание дали, и только в одной.
// Claude занят — задание ждёт конца хода. Ни одной сессии этой папки не было — «Пропущено» с «Запустить сейчас»: задним
// числом само не идёт. Задание уходит обычным сообщением в режиме разрешений сессии: новых прав Arcade не даёт.
// Пропущенное говорит о себе сразу: в срок сессии его папки не было — любая запущенная сессия с Arcade показывает
// системное уведомление (одна, как напоминания). Само задание в чужой папке не идёт: там другой контекст и другие права
import { fill } from '../chats.js'
import { MISSED_MS, dueTasks, markTask } from '../calendar.js'
import { tr } from '../i18n.js'
import { isProjectBoard, isPrompts } from '../notes.js'
import { samePath } from './agents.js'
import { CLAIM_MS, LATE_MS, calendarChanged, fresh, me, osNotify, refreshCalendar } from './calendar.js'
import { startQueue } from './queue.js'
import { S, cal } from './state.js'
import { log } from './status.js'
import { editNotes, giveClaude, sendNote } from './work.js'

const t = (text) => tr(text, S.lang)
// Календарь из хранилища — раз в READ_MS: задание могли дать в другой сессии этой папки
const READ_MS = 30_000
// После отданного задания — пауза: ход начнётся чуть позже, чем submit ответит, а второе задание в ту же секунду не нужно
const GAP_MS = 15_000

// going — шаг идёт; read — когда календарь последний раз перечитали; gap — до каких пор не отдавать новое задание
S.sc = { going: false, read: 0, gap: 0 }

// Задание этой сессии: дано в её папке (или без папки — тогда в любой)
const mine = (ev) => Boolean(ev.give) && (!ev.cwd || samePath(ev.cwd, S.ag?.path))
const busy = (now) => Boolean(S.queue) || S.status === 'working' || S.status === 'permission' || S.status === 'background' || now < S.sc.gap
// Задание другой папки, которое в свой срок никто не взял: прошло больше LATE_MS (сессия той папки взяла бы его сразу
// или отметила held, если Claude занят), но не больше MISSED_MS, и о нём ещё не сказали
const folder = (p) => String(p ?? '').split(/[\\/]+/).filter(Boolean).pop() || p
function lostTasks(list, now) {
  if (!S.ag?.path) return []
  const others = list.filter((e) => e.give && e.cwd && !samePath(e.cwd, S.ag.path))
  return dueTasks(others, now).filter((x) => {
    const ev = list.find((e) => e.id === x.id)
    return now - x.at > LATE_MS && now - x.at <= MISSED_MS && ev.held !== x.at && ev.warned !== x.at
  })
}

// Шаг — вместе с отметками сессий и «Очередью после сброса лимита» (resumeTick: тот же S.qr.awake — с каких пор сессия
// на ногах). Пришло время задания — взять его: отметка своей сессией, через CLAIM_MS перечитать — запускает та, чья
// отметка осталась (как напоминания)
export async function scheduleTick($) {
  if (S.sc.going) return
  S.sc.going = true
  try {
    const now = await $.clock.now()
    if (now - S.sc.read >= READ_MS) {
      S.sc.read = now
      await refreshCalendar($)
    }
    if (lostTasks(S.calendar, now).length) await warnLost($, now)
    if (!dueTasks(S.calendar.filter(mine), now).length) return
    const taken = await fresh($, async () => {
      const before = S.calendar
      let list = before
      let run = null
      const missed = []
      for (const x of dueTasks(list.filter(mine), now)) {
        const ev = list.find((e) => e.id === x.id)
        // Давно прошедшее — молча: о нём уже не скажешь ничего полезного
        if (now - x.at > MISSED_MS) {
          list = markTask(list, x.id, { fired: x.at, firedBy: undefined, held: undefined, missed: undefined })
          continue
        }
        // Вовремя: сессия была на ногах, когда пришло время, или задание уже ждало конца хода (held), или опоздали
        // меньше чем на LATE_MS (сессию открыли в ту же минуту)
        const onTime = ev.held === x.at || S.qr.awake <= x.at || now - x.at <= LATE_MS
        if (!onTime) {
          list = markTask(list, x.id, { fired: x.at, firedBy: me, held: undefined, missed: x.at })
          missed.push(x)
          continue
        }
        if (busy(now) || run) {
          if (ev.held !== x.at) list = markTask(list, x.id, { held: x.at })
          continue
        }
        run = x
        list = markTask(list, x.id, { fired: x.at, firedBy: me, held: undefined, missed: undefined })
      }
      if (list !== before) await calendarChanged($, list)
      return [run, ...missed].filter(Boolean)
    })
    if (!taken.length) return
    await new Promise((done) => $.clock.after(CLAIM_MS, done))
    const ours = await fresh($, async () => taken.filter((x) => S.calendar.some((e) => e.id === x.id && e.firedBy === me && e.fired === x.at)))
    // x — раз события до отметки, missed у него прежний: пропущенный — тот, что в календаре сейчас помечен missed
    const missedNow = ours.filter((x) => S.calendar.some((e) => e.id === x.id && e.missed === x.at))
    const toRun = ours.find((x) => !missedNow.includes(x))
    // Всплывашка — всегда (человек тут, в этой сессии); системное уведомление — если о пропуске ещё не сказала сессия
    // другой папки
    const loud = []
    for (const x of missedNow) {
      const text = fill(t('Пропущено по расписанию: «{0}» — Claude Code был закрыт или компьютер спал. Запустить можно в календаре Arcade.'), [x.title])
      log(`по расписанию: ${text}`)
      $.ui.toast(text)
      if (!S.calendar.some((e) => e.id === x.id && e.warned === x.at)) loud.push(text)
    }
    if (loud.length) osNotify($, loud.join('\n'))
    if (!toRun) return
    // Пока брали, Claude мог занять ход — тогда задание снова ждёт его конца
    if (busy(await $.clock.now())) {
      await fresh($, async () => calendarChanged($, markTask(S.calendar, toRun.id, { fired: toRun.at - 1, firedBy: undefined, held: toRun.at })))
      return
    }
    await runTask($, toRun)
  } catch (err) {
    log(`по расписанию: ${err?.message ?? err}`)
  } finally {
    S.sc.going = false
  }
}

// Сказать о заданиях других папок, которые в срок никто не взял: отметка своей сессией, через CLAIM_MS перечитать —
// говорит та, чья отметка осталась. Сессия той папки, когда её запустят, сама отметит пропущенное с «Запустить сейчас»
async function warnLost($, now) {
  const marked = await fresh($, async () => {
    const lost = lostTasks(S.calendar, now)
    if (!lost.length) return []
    let list = S.calendar
    for (const x of lost) list = markTask(list, x.id, { warned: x.at, warnedBy: me })
    await calendarChanged($, list)
    return lost
  })
  if (!marked.length) return
  await new Promise((done) => $.clock.after(CLAIM_MS, done))
  const ours = await fresh($, async () => marked.filter((x) => S.calendar.some((e) => e.id === x.id && e.warned === x.at && e.warnedBy === me)))
  if (!ours.length) return
  const lines = ours.map((x) =>
    fill(t('Пропущено по расписанию: «{0}» — в папке {1} не было запущенной сессии Claude Code. Открой сессию этой папки и нажми «Запустить сейчас» в календаре Arcade.'), [x.title, folder(x.cwd)]),
  )
  for (const text of lines) {
    log(`по расписанию: ${text}`)
    $.ui.toast(text)
  }
  osNotify($, lines.join('\n'))
}

// Отдать задание Claude и сказать, как вышло: '' — ушло, иначе — почему нет
async function runTask($, ev) {
  S.sc.gap = (await $.clock.now()) + GAP_MS
  const why = await give($, ev.give).catch((err) => {
    log(`по расписанию: ${err?.message ?? err}`)
    return t('ошибка мода')
  })
  const text = why ? fill(t('По расписанию: «{0}» — задание не ушло: {1}.'), [ev.title, why]) : fill(t('По расписанию: «{0}» — ушло Claude.'), [ev.title])
  log(text)
  $.ui.toast(text)
  $.ui.invalidate('ui.render')
  return !why
}

async function give($, g) {
  // Цель смотрим в свежем блокноте: её могли поправить или удалить в другой сессии
  await editNotes($, (list) => list)
  if (g.kind === 'queue') {
    const board = S.notes.find((p) => p.id === g.board && isProjectBoard(p))
    if (!board) return t('доски больше нет')
    await startQueue($, board.id, { auto: true })
    if (S.queue?.board === board.id) return ''
    return (S.dk.note || t('очередь не запустилась')).replace(/[.\s]+$/, '')
  }
  if (g.kind === 'card') {
    const page = S.notes.find((p) => p.id === g.card && S.notes.some((b) => b.id === p.parent && isProjectBoard(b)))
    if (!page) return t('карточки больше нет')
    const sent = await sendNote($, page.id, false, true)
    if (sent === 'taken') return t('карточку уже взял другой')
    return sent ? '' : t('Claude был занят — карточка ждёт в поле ввода')
  }
  if (g.kind === 'prompt') {
    const page = S.notes.find((p) => p.id === g.prompt && S.notes.some((b) => b.id === p.parent && isPrompts(b)))
    if (!page) return t('шаблона больше нет')
    const text = (page.body ?? '').trim()
    if (!text) return t('в шаблоне нет текста')
    return (await giveClaude($, text, 'prompt')) ? '' : t('Claude был занят — шаблон ждёт в поле ввода')
  }
  return (await giveClaude($, g.text, 'ask')) ? '' : t('Claude был занят — текст ждёт в поле ввода')
}

// Пропущенные задания этой папки — для экрана календаря
export const missedTasks = () => S.calendar.filter((e) => mine(e) && Number.isFinite(e.missed))

// «Запустить сейчас» у пропущенного задания
export async function runMissed($, id) {
  const now = await $.clock.now()
  if (busy(now)) {
    cal.note = 'Claude занят — запусти, когда он закончит ход.'
    cal.bad = true
    $.ui.invalidate('ui.render')
    return
  }
  let ev = null
  await fresh($, async () => {
    const e = S.calendar.find((x) => x.id === id)
    if (!e?.give || !Number.isFinite(e.missed)) return
    ev = e
    await calendarChanged($, markTask(S.calendar, id, { missed: undefined }))
  })
  if (!ev) return
  const ok = await runTask($, ev)
  cal.note = ok ? 'Задание ушло Claude.' : 'Задание не ушло — что случилось, сказано во всплывашке.'
  cal.bad = !ok
  $.ui.invalidate('ui.render')
}

// «Не запускать»: пропущенное убрать, задание остаётся на следующие разы
export async function dropMissed($, id) {
  await fresh($, async () => {
    if (!S.calendar.some((x) => x.id === id && Number.isFinite(x.missed))) return
    await calendarChanged($, markTask(S.calendar, id, { missed: undefined }))
  })
  cal.note = 'Пропущенное не запускаем.'
  cal.bad = false
  $.ui.invalidate('ui.render')
}
