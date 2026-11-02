// Arcade: очередь карточек доски для Claude. Claude получает карточку первой колонки, а когда закончит ход и карточка
// уже в последней колонке — следующую. Спросил разрешения, ход прервали или кончился ошибкой, карточка не доделана,
// Claude получил другую просьбу — очередь встаёт: решает человек.
import { tr } from '../i18n.js'
import { columnCards, columnOf, isBoard, moveCard } from '../notes.js'
import { S, nb } from './state.js'
import { log } from './status.js'
import { cardTaker, colName, editNotes, modError, refreshNotes, sendNote } from './work.js'

export const QUEUE_MAX = 10 // карточек за один запуск очереди, не больше: дальше — снова кнопкой
// Очередь сейчас: board — id доски, card — карточка у Claude, given — какие уже отданы, sent — карточка ушла, а её ход
// ещё не начался, turn — ход Claude с этой карточкой
S.queue = null

const t = (text) => tr(text, S.lang)

// Следующая карточка — первая в первой колонке, которую очередь ещё не давала и которую не взял кто-то другой
function nextCard(board) {
  const cards = columnCards(S.notes, board, board.board.cols[0].id)
  return cards.find((p) => {
    if (S.queue.given.includes(p.id)) return false
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
  for (let card = nextCard(board); card; card = nextCard(board)) {
    queue.card = card.id
    queue.given.push(card.id)
    // Ход начинается раньше, чем submit ответит: отметка — заранее
    queue.sent = true
    const sent = await sendNote($, card.id, true)
    if (S.queue !== queue) return
    if (sent === 'taken') continue
    nb.note = ''
    nb.bad = false
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
    S.dk.note = ''
    S.dk.bad = false
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
  S.queue = { board: id, card: '', given: [], sent: false, turn: '' }
  await queueNext($)
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
  stopQueue($, t('Очередь остановлена. Claude доделает текущую карточку, следующую не получит.'), false)
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
