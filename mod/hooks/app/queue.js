// Arcade: очередь карточек доски для Claude. Claude получает карточку первой колонки, а когда закончит ход и карточка
// уже в последней колонке — следующую. Задал вопрос, ход прервали или кончился ошибкой, карточка не доделана,
// Claude получил другую просьбу — очередь встаёт: решает человек. Запрос разрешения очередь не останавливает: пока
// человек не ответит, ход не кончится, а одобрили (человек или авто-режим) и карточка в последней колонке — можно
// дальше. Отказали — карточка обычно не доделана, и очередь встанет в конце хода. Очередь одной доски может идти в
// нескольких сессиях Claude Code: каждая свободная берёт следующую карточку, и две сессии одну карточку не получат
// (agents.js, takeCard). Кончился лимит Claude — очередь встаёт и может сама продолжиться после его сброса: с той же,
// недоделанной карточки (usage.js — откуда известно про лимит).
import { fill } from '../chats.js'
import { tr } from '../i18n.js'
import { columnCards, columnOf, isBoard, moveCard } from '../notes.js'
import { S, nb } from './state.js'
import { log } from './status.js'
import { AGENT_TTL_MS, boardMates, dropCard, queueMates, readOthers, samePath, takeCard } from './agents.js'
import { clockText, limitHit, resetText, spentWindow, usageNow, warnCheck } from './usage.js'
import { cardTaker, checkNotes, colName, editNotes, modError, refreshNotes, sendNote } from './work.js'

export const QUEUE_MAX = 10 // карточек за один запуск очереди, не больше: дальше — снова кнопкой
// Очередь сейчас: board — id доски, card — карточка у Claude, given — какие уже отданы, sent — карточка ушла, а её ход
// ещё не начался, turn — ход Claude с этой карточкой, started — когда запущена, of — сколько карточек будет в этом
// запуске (для «карточка 3 из 10»), joined — с какой сессией эта присоединилась (заметка после первой карточки)
S.queue = null
// «Остановить везде»: в $.store под этим ключом — { [id доски]: когда }; очередь, запущенная раньше, встаёт
const STOP_KEY = 'queueStop'
const STOP_KEEP_MS = 24 * 3_600_000 // старые остановки — не храним
// Очередь после сброса лимита. В $.store: RESUME_KEY — [{ sid, board, title, card, at }], очереди, которые ждут сброса
// (чтобы после перезапуска мода ждать дальше, а очередь закрытой сессии — назвать незапустившейся); ARMED_KEY — id
// досок, где очередь продолжается после сброса сама, без кнопки
const RESUME_KEY = 'queueResume'
const ARMED_KEY = 'queueArmed'
export const RESUME_AFTER_MS = 60_000 // после сброса лимита — ещё столько: счётчик успеет обнулиться
const RESUME_LATE_MS = 30 * 60_000 // сессия открылась, а время продолжить прошло давно — её закрывали: не продолжаем
const LATE_LIMIT_MS = 60_000 // очередь встала с ошибкой, а замер в течение столького показал кончившийся лимит — это он
export const ORPHANS_AFTER_MS = AGENT_TTL_MS + 5_000 // после старта — столько ждать, прежде чем звать чужую сессию закрытой
export const USAGE_POLL_MS = 30_000 // замер Claude Code спрашиваем сами раз во столько — и после каждого хода
// wait — очередь этой сессии ждёт сброса: { board, title, card, at } (at — когда продолжить); offer — то же, но пока
// предложение кнопкой; armed — доски, где без кнопки; missed — очереди, что не запустились: [{ board, title }]; err —
// последняя остановка с ошибкой (вдруг это лимит, а замер придёт чуть позже); sid — под каким id записано ожидание
S.qr = { wait: null, offer: null, armed: [], missed: [], err: null, sid: '', going: false, tick: 0, awake: 0, orphansAt: 0 }

const t = (text) => tr(text, S.lang)

// Свободные карточки — в первой колонке, которые очередь ещё не давала, которые не взял кто-то другой и которые не
// делает и не заявила другая сессия (others — их отметки); первая из них — следующая
function freeCards(board, others) {
  const busy = new Set(others.flatMap((r) => [r.card?.id, r.claim?.card]).filter(Boolean))
  const cards = columnCards(S.notes, board, board.board.cols[0].id)
  return cards.filter((p) => {
    if (S.queue.given.includes(p.id) || busy.has(p.id)) return false
    const { me, taken } = cardTaker(p)
    return !taken || taken === me
  })
}

// Карточка, которую Claude не доделал, когда кончился лимит, — после сброса её первой (она уже может быть во второй
// колонке). Сделана, удалена или у другой сессии — нет
function again(board, others) {
  const id = S.queue.retry
  const page = id ? S.notes.find((p) => p.id === id && p.parent === board.id) : null
  if (!page || columnOf(page, board.board.cols) === board.board.cols.at(-1).id) return ''
  if (others.some((r) => r.card?.id === id || r.claim?.card === id)) return ''
  const { me, taken } = cardTaker(page)
  return !taken || taken === me ? id : ''
}

// Остановить очередь: why — уже переведённое объяснение на экран доски и во всплывашку. Всегда false: дальше — ничего
export function stopQueue($, why, bad = true) {
  if (!S.queue) return false
  S.queue = null
  S.dk.note = why
  S.dk.bad = bad
  log(`очередь Claude: ${why}`)
  $.ui.toast(why)
  $.ui.invalidate('ui.render')
  return false
}

// Отдать Claude следующую карточку; нечего отдавать — очередь пройдена
async function giveNext($) {
  const queue = S.queue
  const board = S.notes.find((p) => p.id === queue.board && isBoard(p))
  if (!board) return stopQueue($, t('Очередь остановлена: доску удалили.'))
  if (queue.given.length >= QUEUE_MAX) return stopQueue($, `${t('Очередь пройдена: Claude сделал карточек')} — ${queue.given.length}. ${t('Запусти её снова, чтобы продолжить.')}`, false)
  if (await stoppedEverywhere($, queue)) return stopQueue($, t('Очередь остановили во всех сессиях. Claude доделает текущую карточку, следующую не получит.'), false)
  for (;;) {
    // Карточку заявляем так, чтобы её не взяла другая сессия; отметок нет (нет домашней папки) — очередь одна, как раньше.
    // Перед каждым выбором блокнот — свежий: карточку, которую другая сессия уже перенесла в последнюю колонку, не взять
    let seen = []
    const pick = (others) => {
      seen = others
      return again(board, others) || (freeCards(board, others)[0]?.id ?? '')
    }
    const id = await takeCard($, pick, () => refreshNotes($).catch(() => {}))
    if (S.queue !== queue) return
    if (id === null) return stopQueue($, t('Очередь остановлена: не получилось занять карточку так, чтобы её не взяла другая сессия. Запусти очередь снова.'))
    const card = S.notes.find((p) => p.id === (id === 'off' ? pick([]) : id))
    if (!card) break
    queue.retry = ''
    queue.card = card.id
    queue.given.push(card.id)
    // Ход начинается раньше, чем submit ответит: отметка — заранее
    queue.sent = true
    queue.of = Math.min(QUEUE_MAX, queue.given.length + freeCards(board, seen).length)
    const sent = await sendNote($, card.id, true)
    if (S.queue !== queue) return
    if (sent === 'taken') {
      dropCard()
      continue
    }
    nb.note = ''
    nb.bad = false
    if (!sent) dropCard()
    if (!sent) return stopQueue($, `${t('Очередь остановлена: не получилось отдать карточку')} «${card.title}». ${t('Если она в поле ввода — отправь её сам.')}`)
    // Отданная карточка — во вторую колонку («В работе»), если в доске их больше двух
    const cols = board.board.cols
    if (cols.length > 2) {
      const doing = cols[1].id
      await editNotes($, (list, at) => {
        const now = list.find((p) => p.id === card.id)
        return now && columnOf(now, cols) === cols[0].id ? moveCard(list, card.id, { col: doing }, at) : list
      })
      nb.note = ''
      nb.bad = false
    }
    // Присоединилась к очереди другой сессии — так и сказать, когда пошла первая карточка
    S.dk.note = queue.joined ? fill(t('Очередь на этой доске уже идёт в сессии «{0}». Эта сессия тоже будет брать карточки.'), [queue.joined]) : ''
    S.dk.bad = false
    queue.joined = ''
    $.ui.invalidate('ui.render')
    return
  }
  const first = colName(board.board.cols[0])
  stopQueue($, queue.given.length ? `${t('Очередь пройдена: в колонке')} «${first}» ${t('карточек больше нет.')}` : `${t('В колонке')} «${first}» ${t('нет карточек для Claude.')}`, !queue.given.length)
}

// Запустить очередь на доске id — кнопкой «Очередь для Claude» или сама после сброса лимита (auto): тогда retry —
// карточка, которую Claude не доделал, а о той же папке уже предупреждали, когда очередь запускали
export async function startQueue($, id, { retry = '', auto = false } = {}) {
  const say = (text) => {
    S.dk.note = text
    S.dk.bad = true
    $.ui.invalidate('ui.render')
  }
  if (S.queue) {
    const other = S.notes.find((p) => p.id === S.queue.board)
    return say(`${t('Очередь уже идёт на доске')} «${other?.title ?? ''}». ${t('Останови её там, чтобы начать здесь.')}`)
  }
  if (S.status === 'working' || S.status === 'permission') return say(t('Claude занят — запусти очередь, когда он закончит ход.'))
  if (!(await editNotes($, (list) => list))) return
  nb.note = ''
  if (!S.notes.some((p) => p.id === id && isBoard(p))) return
  // Очередь на этой доске уже идёт в других сессиях — эта присоединяется. Сессия в той же папке может править те же
  // файлы — присоединить только по второму нажатию
  const mates = await queueMates($, id)
  const same = mates.find((r) => samePath(r.path, S.ag?.path))
  if (same && !auto && S.ag.joinWarn !== id) {
    S.ag.joinWarn = id
    return say(`${fill(t('Эта сессия в той же папке, что «{0}»: две сессии могут править одни и те же файлы. Надёжнее — отдельная папка или git worktree.'), [same.name])} ${t('Нажми «Очередь для Claude» ещё раз, чтобы всё равно присоединиться.')}`)
  }
  if (S.ag) S.ag.joinWarn = ''
  if (S.queue) return
  // Запустили сами — предложение продолжить после сброса уже ни к чему, а ожидание этой доски — тем более
  S.qr.offer = null
  S.qr.err = null
  if (!auto && S.qr.wait?.board === id) await cancelWait($, false)
  S.queue = { board: id, card: '', given: [], sent: false, turn: '', started: await $.clock.now(), of: 0, joined: mates[0]?.name ?? '', retry }
  await queueNext($)
}

// ——— Лимит Claude кончился ———

const boardTitle = (id) => S.notes.find((p) => p.id === id)?.title ?? ''

// Очередь встала, потому что кончился лимит. w — { board, title, card }; reset — когда сбросится (0 — неизвестно).
// Доска из «продолжать после сброса» — ждём сами, иначе — предложение кнопкой на доске. Возвращает текст остановки
async function limitNote($, w, reset) {
  const now = await $.clock.now()
  const when = resetText(reset, now)
  let why = `${t('Очередь остановлена: кончился лимит Claude')}${when ? ` — ${when}` : ''}.`
  if (reset > now) {
    const next = { board: w.board, title: w.title, card: w.card, at: reset + RESUME_AFTER_MS }
    if (S.qr.armed.includes(w.board)) {
      await waitFor($, next)
      why += ` ${fill(t('Очередь продолжится в {0}.'), [clockText(next.at, now)])}`
    } else S.qr.offer = next
  }
  return why
}

// Ход с карточкой очереди кончился ошибкой API: кончился лимит — остановить с временем сброса и предложить продолжить.
// true — это лимит (очередь уже стоит)
async function limitStop($, queue) {
  const w = { board: queue.board, title: boardTitle(queue.board), card: queue.card }
  const hit = await limitHit($)
  if (S.queue !== queue) return true
  if (hit) {
    stopQueue($, await limitNote($, w, hit.reset))
    return true
  }
  // Замер мог ещё не прийти — если придёт вскоре и покажет кончившийся лимит, скажем об этом (limitLate)
  S.qr.err = { ...w, at: await $.clock.now() }
  return false
}

// Замер вскоре после того, как очередь встала с ошибкой, показал кончившийся лимит: уточнить, что это лимит
export async function limitLate($) {
  const err = S.qr.err
  if (!err || S.queue) return
  const now = await $.clock.now()
  if (now - err.at > LATE_LIMIT_MS) {
    S.qr.err = null
    return
  }
  const w = spentWindow(S.us.me?.limits, now)
  if (!w) return
  S.qr.err = null
  const why = await limitNote($, err, w.reset)
  S.dk.note = why
  S.dk.bad = true
  log(`очередь Claude: ${why}`)
  $.ui.toast(why)
  $.ui.invalidate('ui.render')
}

// Замер Claude Code — спрашиваем сами, после хода и по таймеру: события замера у Claude Code постарше нет, а хук на
// незнакомое событие не дал бы Arcade загрузиться. Окна лимитов сдвинулись — всплывашка 80 и 90% и «не лимит ли
// остановил очередь»; экран «Лимиты» или «Агенты» открыт — перерисовать
export async function usagePoll($) {
  const before = JSON.stringify(S.us.me?.limits ?? [])
  const api = S.us.api
  const u = await usageNow($)
  if (u && JSON.stringify(u.limits) !== before) {
    await warnCheck($)
    await limitLate($)
  }
  // Перерисовать — и когда Claude Code перестал или снова начал отвечать: экран скажет, что лимитов он не сообщает
  if (!u && api === S.us.api) return
  if (S.paneOpen && S.view === 'library' && (S.menu === 'usage' || S.menu === 'agents' || S.menu === 'today')) $.ui.invalidate('ui.render')
}

// Записи ожиданий из $.store: только целые
const entriesOf = (v) =>
  Array.isArray(v) ? v.filter((x) => x && typeof x.sid === 'string' && x.sid && typeof x.board === 'string' && Number.isFinite(x.at)) : []

// Своё ожидание — в $.store: список общий для всех сессий, перед записью — перечитать. Своё — и под прежним id (после
// /clear id сессии новый)
async function saveWait($) {
  const sid = (await $.session.id().catch(() => '')) || S.qr.sid
  const mine = new Set([sid, S.qr.sid].filter(Boolean))
  const list = entriesOf(await $.store.get(RESUME_KEY).catch(() => null)).filter((x) => !mine.has(x.sid))
  const w = S.qr.wait
  if (w && sid) list.push({ sid, board: w.board, title: w.title, card: w.card, at: w.at })
  S.qr.sid = sid
  await $.store.set(RESUME_KEY, list).catch((err) => log(`очередь после сброса: ${err?.message ?? err}`))
}

// Ждать сброса лимита и продолжить очередь: w — { board, title, card, at }
export async function waitFor($, w) {
  S.qr.wait = w
  S.qr.offer = null
  $.ui.invalidate('ui.render')
  await saveWait($)
}

// «Не продолжать»: ожидание снять; если сброс ещё впереди — снова предложить кнопкой (offer)
export async function cancelWait($, offer = true) {
  const w = S.qr.wait
  if (!w) return
  S.qr.wait = null
  if (offer && (await $.clock.now()) < w.at) S.qr.offer = w
  $.ui.invalidate('ui.render')
  await saveWait($)
}

// Доска id: продолжать её очередь после сброса лимита самой, без кнопки (on) или нет. Предложение на ней — сразу в ожидание
export async function armBoard($, id, on) {
  const saved = await $.store.get(ARMED_KEY).catch(() => undefined)
  const list = (Array.isArray(saved) ? saved.filter((x) => typeof x === 'string') : S.qr.armed).filter((x) => x !== id)
  S.qr.armed = (on ? [...list, id] : list).slice(-64)
  $.ui.invalidate('ui.render')
  await $.store.set(ARMED_KEY, S.qr.armed).catch((err) => log(`очередь после сброса: ${err?.message ?? err}`))
  if (on && S.qr.offer?.board === id) await waitFor($, S.qr.offer)
}

// Очередь, которая не продолжилась после сброса: сказать всплывашкой и держать заметку в «Лимитах» и на доске
function missedAdd($, w, why) {
  const text = fill(t(why), [w.title || boardTitle(w.board)])
  S.qr.missed = [...S.qr.missed.filter((m) => m.board !== w.board), { board: w.board, text }].slice(-5)
  log(`очередь после сброса: ${text}`)
  $.ui.toast(text)
  $.ui.invalidate('ui.render')
}
export function missedClear($, board) {
  S.qr.missed = board ? S.qr.missed.filter((m) => m.board !== board) : []
  $.ui.invalidate('ui.render')
}

// Старт сессии (и перезагрузка мода): доски «продолжать после сброса» и своё ожидание — из $.store
export async function resumeStart($) {
  const armed = await $.store.get(ARMED_KEY).catch(() => null)
  S.qr.armed = Array.isArray(armed) ? armed.filter((x) => typeof x === 'string') : []
  const sid = await $.session.id().catch(() => '')
  if (!sid) return
  const mine = entriesOf(await $.store.get(RESUME_KEY).catch(() => null)).find((x) => x.sid === sid)
  S.qr.sid = sid
  if (mine && !S.qr.wait) S.qr.wait = { board: mine.board, title: String(mine.title ?? ''), card: String(mine.card ?? ''), at: mine.at }
}

// Ожидания сессий, которых уже нет (закрыли до сброса лимита): их очередь не запустится — сказать здесь. Кто жив — по
// отметкам (agents.js); без отметок не узнать — молчим
async function resumeOrphans($, now) {
  const list = entriesOf(await $.store.get(RESUME_KEY).catch(() => null))
  if (!list.some((x) => now >= x.at)) return
  const others = await readOthers($)
  if (!others) return
  const live = new Set([...others.map((r) => r.sid), S.ag?.sid, S.qr.sid].filter(Boolean))
  const gone = list.filter((x) => now >= x.at && !live.has(x.sid))
  if (!gone.length) return
  const same = (a, b) => a.sid === b.sid && a.at === b.at
  const left = entriesOf(await $.store.get(RESUME_KEY).catch(() => null)).filter((x) => !gone.some((g) => same(g, x)))
  await $.store.set(RESUME_KEY, left).catch((err) => log(`очередь после сброса: ${err?.message ?? err}`))
  for (const g of gone) missedAdd($, g, 'Очередь «{0}» не запустилась после сброса лимита: сессия была закрыта.')
}

// Шаг — вместе с отметками сессий: пришло время — продолжить очередь, если Claude свободен и лимит правда сбросился.
// Сессия была закрыта или компьютер спал дольше RESUME_LATE_MS после сброса — не продолжаем: человек мог давно уйти
export async function resumeTick($) {
  if (S.qr.going) return
  S.qr.going = true
  try {
    const now = await $.clock.now()
    // Шагов долго не было (старт, сон) — отсюда считаем, сколько мы на ногах
    if (now - S.qr.tick > 30_000) S.qr.awake = now
    S.qr.tick = now
    if (now - S.qr.awake >= ORPHANS_AFTER_MS && now - S.qr.orphansAt >= 60_000) {
      S.qr.orphansAt = now
      await resumeOrphans($, now)
    }
    const w = S.qr.wait
    if (!w) return
    // После /clear id сессии новый — ожидание переписать на него, иначе другие сессии сочтут его брошенным
    if (S.ag?.sid && S.ag.sid !== S.qr.sid) await saveWait($)
    if (now < w.at) return
    if (S.qr.awake - w.at > RESUME_LATE_MS) {
      S.qr.wait = null
      await saveWait($)
      return missedAdd($, w, 'Очередь «{0}» не продолжилась после сброса лимита: Claude Code был закрыт или компьютер спал.')
    }
    if (S.queue || S.status === 'working' || S.status === 'permission') return
    // Окно всё ещё кончилось (лимит сдвинулся, сброс другого окна) — ждать до нового сброса
    const u = await usageNow($)
    if (S.qr.wait !== w) return
    const still = spentWindow(u?.limits, now)
    if (still) {
      S.qr.wait = { ...w, at: still.reset ? still.reset + RESUME_AFTER_MS : now + 5 * 60_000 }
      $.ui.invalidate('ui.render')
      return saveWait($)
    }
    S.qr.wait = null
    await saveWait($)
    await refreshNotes($).catch(() => {})
    const title = w.title || boardTitle(w.board)
    if (!S.notes.some((p) => p.id === w.board && isBoard(p))) return missedAdd($, { ...w, title }, 'Очередь «{0}» не продолжилась после сброса лимита: доску удалили.')
    await startQueue($, w.board, { retry: w.card, auto: true })
    if (S.queue?.board === w.board) $.ui.toast(fill(t('Лимит Claude сбросился — очередь «{0}» продолжается.'), [title]))
    else missedAdd($, { ...w, title }, 'Очередь «{0}» не продолжилась после сброса лимита.')
  } catch (err) {
    log(`очередь после сброса: ${err?.message ?? err}`)
  } finally {
    S.qr.going = false
  }
}

// «Остановить везде»: эта сессия и все другие с очередью на доске id доделывают текущие карточки и новых не берут
export async function stopEverywhere($, id) {
  const now = await $.clock.now()
  const old = await $.store.get(STOP_KEY).catch(() => null)
  const stops = Object.fromEntries(Object.entries(old && typeof old === 'object' ? old : {}).filter(([, at]) => now - Number(at) < STOP_KEEP_MS))
  stops[id] = now
  await $.store.set(STOP_KEY, stops)
  const why = t('Очередь остановлена во всех сессиях: каждая доделает текущую карточку, новую не возьмёт.')
  if (S.queue?.board === id) return stopQueue($, why, false)
  S.dk.note = why
  S.dk.bad = false
  $.ui.toast(why)
  $.ui.invalidate('ui.render')
}

// Очередь этой сессии остановили во всех сессиях после её запуска
async function stoppedEverywhere($, queue) {
  const stops = await $.store.get(STOP_KEY).catch(() => null)
  return Boolean(stops && typeof stops === 'object' && Number(stops[queue.board]) > queue.started)
}

// Таймером, пока идёт очередь: её остановили в другой сессии — встать, текущую карточку Claude доделает
export async function queueStopCheck($) {
  const queue = S.queue
  if (!queue || !(await stoppedEverywhere($, queue)) || S.queue !== queue) return
  stopQueue($, t('Очередь остановили во всех сессиях. Claude доделает текущую карточку, следующую не получит.'), false)
}

// Следующая карточка очереди: после старта — сразу, после хода Claude — таймером, новым ходом (не изнутри конца прошлого)
export async function queueNext($) {
  if (!S.queue) return
  await giveNext($).catch((err) => {
    modError(err)
    stopQueue($, t('Очередь остановлена: ошибка Arcade.'))
  })
}

// Кнопка «Остановить очередь»: текущую карточку Claude доделает, следующую не получит
export function endQueue($) {
  const others = S.queue ? boardMates(S.queue.board).length : 0
  stopQueue($, `${t('Очередь остановлена. Claude доделает текущую карточку, следующую не получит.')}${others ? ` ${t('В других сессиях она идёт дальше.')}` : ''}`, false)
}

// Начался ход Claude. Ход с карточкой очереди — её; продолжение без текста и ход, где Claude по просьбе Arcade открывает
// игру и работает дальше, — тоже её. Любой другой — человек попросил о своём: очередь встаёт
export function queueTurnStart($, e) {
  const queue = S.queue
  if (!queue) return
  const text = e.text ?? ''
  if (queue.sent && text.includes(`(id ${queue.card})`)) {
    queue.sent = false
    queue.turn = e.turnId
    return
  }
  if (!queue.sent && (!text.trim() || S.asking)) {
    queue.turn = e.turnId
    return
  }
  stopQueue($, t('Очередь остановлена: Claude получил другую просьбу.'))
}

// Claude задал вопрос — решает человек: дальше очередь не идёт. Запрос разрешения сюда не приходит: в авто-режиме его
// часто решает классификатор, а «ждёт разрешения» мод может показать и зря — что дальше, решает конец хода
export function queueQuestion($) {
  if (!S.queue) return
  stopQueue($, t('Очередь остановлена: Claude задал вопрос. Ответь ему и запусти очередь снова.'))
}

// Ход Claude кончился — из turn.complete. Карточка очереди в последней колонке — true: следующую даст queueNext;
// нет — очередь встаёт
export async function queueTurnDone($, e) {
  const queue = S.queue
  if (!queue || queue.sent || e.turnId !== queue.turn) return false
  if (e.isAborted || e.reason === 'aborted') return stopQueue($, t('Очередь остановлена: ход Claude прервали.'))
  // Ошибка API — это может быть кончившийся лимит: тогда — когда он сбросится и как продолжить
  if (e.reason === 'error' && (await limitStop($, queue))) return false
  if (S.queue !== queue) return false
  if (e.reason !== 'answer') return stopQueue($, t('Очередь остановлена: Claude не закончил ход — ошибка или отказ.'))
  // Свежий блокнот, а в нём — правки Claude за этот ход: перенос карточки могла затереть запись другой сессии
  await checkNotes($)
  if (S.queue !== queue) return false
  const card = S.notes.find((p) => p.id === queue.card)
  const board = S.notes.find((p) => p.id === queue.board && isBoard(p))
  if (!board) return stopQueue($, t('Очередь остановлена: доску удалили.'))
  const last = board.board.cols.at(-1)
  if (!card || columnOf(card, board.board.cols) !== last.id) {
    const title = card?.title ?? ''
    return stopQueue($, `${t('Очередь стоит: Claude закончил ход, а карточка')} «${title}» ${t('не в колонке')} «${colName(last)}». ${t('Посмотри, что он ответил.')}`)
  }
  return true
}
