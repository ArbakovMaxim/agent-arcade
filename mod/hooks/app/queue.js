// Arcade: очередь карточек доски для Claude. Claude получает карточку первой колонки, а когда закончит ход и карточка
// уже в последней колонке — следующую. Спросил разрешения, ход прервали или кончился ошибкой, карточка не доделана,
// Claude получил другую просьбу — очередь встаёт: решает человек. Очередь одной доски может идти в нескольких сессиях
// Claude Code: каждая свободная берёт следующую карточку, и две сессии одну карточку не получат (agents.js, takeCard).
import { fill } from '../chats.js'
import { tr } from '../i18n.js'
import { columnCards, columnOf, isBoard, moveCard } from '../notes.js'
import { S, nb } from './state.js'
import { log } from './status.js'
import { boardMates, dropCard, queueMates, samePath, takeCard } from './agents.js'
import { cardTaker, colName, editNotes, modError, refreshNotes, sendNote } from './work.js'

export const QUEUE_MAX = 10 // карточек за один запуск очереди, не больше: дальше — снова кнопкой
// Очередь сейчас: board — id доски, card — карточка у Claude, given — какие уже отданы, sent — карточка ушла, а её ход
// ещё не начался, turn — ход Claude с этой карточкой, started — когда запущена, of — сколько карточек будет в этом
// запуске (для «карточка 3 из 10»), joined — с какой сессией эта присоединилась (заметка после первой карточки)
S.queue = null
// «Остановить везде»: в $.store под этим ключом — { [id доски]: когда }; очередь, запущенная раньше, встаёт
const STOP_KEY = 'queueStop'
const STOP_KEEP_MS = 24 * 3_600_000 // старые остановки — не храним

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
      return freeCards(board, others)[0]?.id ?? ''
    }
    const id = await takeCard($, pick, () => refreshNotes($).catch(() => {}))
    if (S.queue !== queue) return
    if (id === null) return stopQueue($, t('Очередь остановлена: не получилось занять карточку так, чтобы её не взяла другая сессия. Запусти очередь снова.'))
    const card = id === 'off' ? freeCards(board, [])[0] : S.notes.find((p) => p.id === id)
    if (!card) break
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

// Запустить очередь на доске id — кнопкой «Очередь для Claude»
export async function startQueue($, id) {
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
  if (same && S.ag.joinWarn !== id) {
    S.ag.joinWarn = id
    return say(`${fill(t('Эта сессия в той же папке, что «{0}»: две сессии могут править одни и те же файлы. Надёжнее — отдельная папка или git worktree.'), [same.name])} ${t('Нажми «Очередь для Claude» ещё раз, чтобы всё равно присоединиться.')}`)
  }
  if (S.ag) S.ag.joinWarn = ''
  if (S.queue) return
  S.queue = { board: id, card: '', given: [], sent: false, turn: '', started: await $.clock.now(), of: 0, joined: mates[0]?.name ?? '' }
  await queueNext($)
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

// Claude спросил разрешения — решает человек: дальше очередь не идёт
export function queuePermission($) {
  if (S.queue) stopQueue($, t('Очередь остановлена: Claude спросил разрешения. Ответь ему и запусти очередь снова.'))
}

// Ход Claude кончился — из turn.complete. Карточка очереди в последней колонке — true: следующую даст queueNext;
// нет — очередь встаёт
export async function queueTurnDone($, e) {
  const queue = S.queue
  if (!queue || queue.sent || e.turnId !== queue.turn) return false
  if (e.isAborted || e.reason === 'aborted') return stopQueue($, t('Очередь остановлена: ход Claude прервали.'))
  if (e.reason !== 'answer') return stopQueue($, t('Очередь остановлена: Claude не закончил ход — ошибка или отказ.'))
  await refreshNotes($)
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
