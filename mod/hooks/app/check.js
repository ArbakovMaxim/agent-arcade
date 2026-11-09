// Arcade: проверка между карточками очереди. У доски — команда проверки (npm test, pytest, cargo build…), у карточки
// может быть своя. Claude закончил ход, карточка в последней колонке — очередь, прежде чем дать следующую, запускает
// команду в папке этой сессии. Код 0 — дальше; иначе карточка возвращается во вторую колонку с пометкой «проверка не
// прошла», очередь встаёт, а Claude получает хвост вывода. Команда хранится только на этом компьютере ($.store) и
// задаётся только с экрана: в блокнот и на сайт она не попадает, инструмент блокнота Claude её не видит и не меняет —
// команду с общей доски чужой человек не подложит
import { LANGS, tr } from '../i18n.js'
import { MAX_BODY, columnOf, isBoard, moveCard, updatePage } from '../notes.js'
import { S, nb } from './state.js'
import { log } from './status.js'
import { holdCard } from './agents.js'
import { hhmm } from './usage.js'
import { colName, editNotes, logCheck, modError } from './work.js'

const KEY = 'queueCheck'
export const CHECK_MAX = 500 // знаков в команде, не больше
export const CHECK_MS = 10 * 60_000 // столько команда может идти; дольше — не прошла
const KEEP = 200 // команд досок и карточек в хранилище, не больше
const TAIL_LINES = 40 // хвост вывода для Claude
const TAIL_CHARS = 3_000
const ID = /^[a-z0-9]{1,20}$/
const FAIL = 'Проверка не прошла'

// S.qc: boards — { [id доски]: команда }, cards — { [id карточки]: своя команда }; last — { [id доски]: последний итог
// { card, title, cmd, ok, code, tail, at } }; running — идёт проверка { board, card, title, cmd }; mine — карточки, чья
// проверка не прошла в этой сессии (после перезапуска очереди их проверить снова)
S.qc = { boards: {}, cards: {}, last: {}, running: null, mine: new Set() }

// Команда — одной строкой, без пробелов по краям, не длиннее CHECK_MAX; пустая — нет команды
export const cleanCmd = (value) => String(value ?? '').replace(/[\r\n]+/g, ' ').trim().slice(0, CHECK_MAX)

function restore(raw) {
  const pick = (obj) => {
    const out = {}
    if (!obj || typeof obj !== 'object') return out
    for (const [id, cmd] of Object.entries(obj).slice(-KEEP)) {
      const c = typeof cmd === 'string' ? cleanCmd(cmd) : ''
      if (ID.test(id) && c) out[id] = c
    }
    return out
  }
  return { boards: pick(raw?.boards), cards: pick(raw?.cards) }
}

// Команды — из $.store: при старте сессии и перед каждой проверкой (другая сессия могла поменять)
export async function loadChecks($) {
  const saved = restore(await $.store.get(KEY).catch(() => null))
  S.qc.boards = saved.boards
  S.qc.cards = saved.cards
}

// Команда проверки доски (kind 'boards') или карточки ('cards'); пустая — убрать. Поверх свежего из $.store; команды
// удалённых страниц — прочь
export async function setCheck($, kind, id, value) {
  await loadChecks($)
  const cmd = cleanCmd(value)
  const list = { ...S.qc[kind] }
  if (cmd) list[id] = cmd
  else delete list[id]
  S.qc[kind] = list
  const alive = new Set(S.notes.map((p) => p.id))
  const keep = (obj) => Object.fromEntries(Object.entries(obj).filter(([x]) => alive.has(x)))
  S.qc.boards = keep(S.qc.boards)
  S.qc.cards = keep(S.qc.cards)
  $.ui.invalidate('ui.render')
  await $.store.set(KEY, { boards: S.qc.boards, cards: S.qc.cards }).catch(modError)
  log(`проверка между карточками: ${kind === 'boards' ? 'доски' : 'карточки'} ${id} — ${cmd ? 'задана' : 'убрана'}`)
  return cmd
}

// Какая команда проверит карточку: своя или доски
export const cmdFor = (card) => (card ? S.qc.cards[card.id] || S.qc.boards[card.parent] || '' : '')

// Пометка «проверка не прошла» — первой строкой текста карточки, на любом из языков Arcade (её могли поставить при
// другом языке)
const MARKS = [...new Set(LANGS.map((l) => tr(FAIL, l)))]
const isMark = (line) => line.startsWith('⚠ ') && MARKS.some((m) => line.slice(2).startsWith(m))
export const hasMark = (body) => isMark(String(body ?? '').split('\n')[0])
function unmark(body) {
  const lines = String(body ?? '').split('\n')
  if (!isMark(lines[0])) return body
  lines.shift()
  if (lines[0] === '') lines.shift()
  return lines.join('\n')
}
const marked = (body, line) => {
  const rest = unmark(body)
  return (rest ? `${line}\n\n${rest}` : line).slice(0, MAX_BODY)
}

// Вывод команды — хвостом: без цветовых кодов терминала, последние строки
const ANSI = /\x1b\[[0-9;?]*[ -/]*[@-~]|\x1b\][^\x07]*\x07/g
export function tailOf(out) {
  const text = [out?.stdout, out?.stderr]
    .map((s) => String(s ?? '').replace(ANSI, '').split(/\r?\n/).map((l) => l.split('\r').at(-1).trimEnd()).join('\n').trim())
    .filter(Boolean)
    .join('\n')
  const tail = text.split('\n').slice(-TAIL_LINES).join('\n')
  return tail.length > TAIL_CHARS ? `…${tail.slice(-TAIL_CHARS)}` : tail
}

// Запустить команду в папке сессии: без оболочки команды не разобрать, а саму команду — переменной окружения, чтобы её
// кавычки не ломали строку запуска cmd.exe. { ok, code, tail }; code: число, 'time' — время вышло, 'start' — не запустилась
async function run($, cmd) {
  const windows = S.platform ? S.platform === 'windows' : (await $.env.get('OS').catch(() => '')) === 'Windows_NT'
  const argv = windows ? ['cmd.exe', '/d', '/c', '%ARCADE_CHECK%'] : ['sh', '-c', 'eval "$ARCADE_CHECK"']
  try {
    const out = await $.process.run(argv, { env: { ARCADE_CHECK: cmd }, timeoutMs: CHECK_MS })
    return { ok: out.exitCode === 0, code: out.exitCode, tail: tailOf(out) }
  } catch (err) {
    const text = String(err?.message ?? err)
    return { ok: false, code: /time/i.test(text) ? 'time' : 'start', tail: text.slice(0, 500) }
  }
}

const t = (text) => tr(text, S.lang)
export const codeText = (code) => (code === 'time' ? t('время вышло') : code === 'start' ? t('команда не запустилась') : `${t('код')} ${code}`)

// Снять пометку «проверка не прошла» с карточки id
async function clearMark($, id) {
  S.qc.mine.delete(id)
  await editNotes($, (list, when) => {
    const now = list.find((p) => p.id === id)
    return now && hasMark(now.body) ? updatePage(list, id, { body: unmark(now.body) }, when) : list
  })
}

// Проверить карточку id: прошла (или проверять нечем) — null; не прошла — карточка во второй колонке с пометкой, а
// ответ — { title, code, col, text }: text — для Claude. Очередь остановили, пока шла проверка, — пометка всё равно
export async function checkCard($, id) {
  await loadChecks($)
  const card = S.notes.find((p) => p.id === id)
  const board = card?.parent ? S.notes.find((p) => p.id === card.parent && isBoard(p)) : null
  const cmd = cmdFor(card)
  if (!card || !board) return null
  // Команду убрали, а пометка осталась с прошлого раза — проверять нечем, значит, и не провалено
  if (!cmd) {
    if (hasMark(card.body)) await clearMark($, id)
    return null
  }
  S.qc.running = { board: board.id, card: id, title: card.title, cmd }
  $.ui.invalidate('ui.render')
  log(`проверка между карточками: «${card.title}» — ${cmd}`)
  const res = await run($, cmd)
  S.qc.running = null
  const at = await $.clock.now()
  S.qc.last[board.id] = { card: id, title: card.title, cmd, ...res, at }
  log(`проверка между карточками: «${card.title}» — ${res.ok ? 'прошла' : `не прошла (${res.code})`}`)
  await logCheck($, { at, kind: 'check', id, title: card.title, board: board.title, ok: res.ok, code: typeof res.code === 'number' ? res.code : -1, cmd, tail: res.tail.split('\n').slice(-5).join('\n').slice(-400) })
  const cols = board.board.cols
  if (res.ok) {
    await clearMark($, id)
    nb.note = ''
    nb.bad = false
    $.ui.invalidate('ui.render')
    return null
  }
  // Не прошла: во вторую колонку («В работе»; в доске из двух колонок — в первую) и пометка первой строкой
  const back = cols.length > 2 ? cols[1] : cols[0]
  const line = `⚠ ${t(FAIL)} — ${codeText(res.code)}, ${hhmm(at)}`
  await editNotes($, (list, when) => {
    const now = list.find((p) => p.id === id)
    if (!now) return list
    const moved = columnOf(now, cols) === cols.at(-1).id ? moveCard(list, id, { col: back.id }, when) : list
    return updatePage(moved, id, { body: marked(now.body, line) }, when)
  })
  S.qc.mine.add(id)
  holdCard(id)
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
  const last = cols.at(-1)
  const fence = res.tail.includes('```') ? '~~~' : '```'
  const text = [
    `${t('Проверка между карточками не прошла')}: ${t('карточка')} «${card.title}» (id ${id}) ${t('на доске')} «${board.title}».`,
    `${t('Команда')}: ${cmd}`,
    `${t('Итог')}: ${codeText(res.code)}.`,
    '',
    `${t('Конец вывода')}:`,
    fence,
    res.tail || t('(вывода нет)'),
    fence,
    '',
    `${t('Карточка вернулась в колонку')} «${colName(back)}». ${t('Исправь, что сломалось, и снова перенеси карточку в колонку')} «${colName(last)}» (${t('колонка')} ${last.id}) ${t('действием move инструмента mcp__arcade__notes.')} ${t('Команду можно запустить и самому — как обычно, с разрешения. Очередь продолжит человек, когда запустит её снова: Arcade сначала проверит эту карточку.')}`,
  ].join('\n')
  return { title: card.title, code: res.code, col: colName(back), text }
}
