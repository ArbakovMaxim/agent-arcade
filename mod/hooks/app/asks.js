// Arcade: Claude ждёт человека — разрешения на инструмент или ответа на вопрос (AskUserQuestion). Отсюда — статус
// «ждёт разрешения», уведомление, остановка очереди на вопрос и что показать в карточке вкладки «Агенты».
// Классический хук PermissionRequest на Team и Enterprise до мода не доходит: встроенная защита cc-plugin-sec-default
// идёт первой и выключает классические хуки плагинов. Поэтому запрос замечаем и по решению tool.check — «спросить» у
// вызова Claude, — а что человек ответил, узнаём из телеметрии (tool_decision) или по концу вызова. Решений мод не
// меняет: вердикт tool.check и телеметрию отдаёт дальше как есть.
// На вопрос Claude можно ответить из «Агентов» другой сессии: ответ — файл a<место>.json рядом с отметками сессий;
// сессия, которая спросила, читает его, пока вопрос открыт, и отдаёт модели как ответ человека. Разрешения так не даются.
import { notifyCommand } from '../browsers.js'
import { tr } from '../i18n.js'
import { CALENDAR_TOOL_NAME, NOTES_TOOL_NAME, NOTIFY_WINDOW_MS, PANE, S } from './state.js'
import { log } from './status.js'
import { releaseAll } from './play.js'
import { queueQuestion } from './queue.js'
import { AGENT_SLOTS } from './agents.js'

export const ANSWER_POLL_MS = 1_000 // пока вопрос открыт, файл ответа читаем раз в столько
// Сколько ждать, прежде чем «спросить» считать вопросом человеку: в авто-режиме сначала решает классификатор (обычно за
// секунду-две), в остальных режимах диалог показывается сразу. Режим узнаём из телеметрии; пока не знаем — середина
const GRACE_AUTO_MS = 20_000
const GRACE_UNKNOWN_MS = 3_000
const GRACE_MS = 700
// Эти вызовы — не запрос разрешения: вопрос ловит questionCall, а блокнот и календарь Arcade разрешает сам
const NOT_ASKS = new Set(['AskUserQuestion', NOTES_TOOL_NAME, CALENDAR_TOOL_NAME])
const QUESTION_MAX = 300 // текст вопроса в отметке — не длиннее (для показа; ответ строится по полному)

// Чего ждёт Claude: { kind: 'permission', tool, what } или { kind: 'question', id, questions: [{ question, header,
// options: [подписи], multi }] }; null — ничего
S.ask = null
S.permMode = '' // режим разрешений сессии — из телеметрии и классических хуков
// id вызова → запрос: «спросить» ещё может решить классификатор
const waiting = new Map()
// Открытые запросы: id вызова, 'classic' (классический хук) или 'q:<id вопроса>'
const asks = new Map()
// Вызовы, о которых решение уже пришло: телеметрия может обогнать вердикт tool.check
const decided = new Set()
// Ответы на свои вопросы из своей же вкладки «Агенты»: id вопроса → выбор
const ownAnswers = new Map()
// Вкладка «Агенты»: выбранные варианты ('<сессия>:<вопрос>' → [[подписи] на каждый вопрос]) и уже отправленные ответы
const picked = new Map()
const sent = new Set()

const answerPath = (slot) => `${S.ag.dir}${S.sep}a${slot}.json`

// Claude ждёт человека: статус, плашка над игрой, уведомление; вопрос ещё и останавливает очередь. Уже ждёт — только
// новый запрос
export async function waitForPerson($, ask) {
  S.ask = ask
  const question = ask.kind === 'question'
  // Вопрос останавливает очередь, даже если статус «ждёт» уже стоит (например, от запроса разрешения рядом)
  if (question) queueQuestion($)
  if (S.status === 'permission') return $.ui.invalidate('ui.render')
  S.status = 'permission'
  S.askVisible = false
  if (S.paneOpen && S.view !== 'library') {
    S.agentAlert = question ? 'question' : 'permission'
    if (S.onPermission === 'pause') {
      S.paused = true
      releaseAll()
    }
    if (S.onPermission === 'close') await $.ui.close({ id: PANE })
  }
  log(question ? 'Claude задал вопрос' : `запрос разрешения: ${ask.tool || 'инструмент'}`)
  const now = await $.clock.now()
  const command = S.osNotify && S.windowOpenedAt && now - S.windowOpenedAt < NOTIFY_WINDOW_MS
    ? notifyCommand(S.platform, 'Claude Code', tr(question ? 'Агент задал вопрос' : 'Агент ждёт разрешения', S.lang))
    : null
  if (command) {
    $.clock.after(0, async () => {
      try {
        await $.process.run(command.argv, { env: command.env, timeoutMs: 15_000 })
      } catch (err) {
        log(`уведомление не показалось: ${err?.message ?? err}`)
      }
    })
  }
  $.ui.invalidate('ui.render')
}

// Запрос закрыт: остались другие — показываем последний, нет — Claude снова работает
function resume($) {
  if (asks.size) {
    S.ask = [...asks.values()].at(-1)
    $.ui.invalidate('ui.render')
    return
  }
  S.ask = null
  if (S.status !== 'permission') return
  S.status = 'working'
  log('агент снова работает')
  $.ui.invalidate('ui.render')
}

// Решение по вызову id пришло (телеметрия) или вызов кончился
export function settle($, id) {
  if (!id) return
  decided.add(id)
  if (decided.size > 64) decided.delete(decided.values().next().value)
  waiting.delete(id)
  if (!asks.delete(id)) return
  asks.delete('classic')
  resume($)
}

// Новый ход главного цикла или его конец: прежних запросов больше нет
export function asksReset() {
  waiting.clear()
  asks.clear()
  ownAnswers.clear()
  S.ask = null
}

// Что спрашивают, коротко: первая строка команды, файл или адрес
export function whatOf(input) {
  const i = input && typeof input === 'object' ? input : {}
  const cut = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
  if (typeof i.command === 'string') return cut(i.command.trim().split('\n')[0], 80)
  const file = [i.file_path, i.notebook_path, i.path].find((x) => typeof x === 'string')
  if (file) return file.length > 60 ? `…${file.slice(-59)}` : file
  if (typeof i.url === 'string') return cut(i.url, 80)
  return ''
}

// tool.check без отбора: вердикт — как есть. «Спросить» у вызова Claude там, где есть кого спросить, — запрос
// разрешения, если за GRACE решение не пришло
export async function checkObserved($, e, next) {
  const verdict = await next(e)
  try {
    const id = e.tool_use_id
    if (verdict?.decision === 'ask' && id && e.approver && next.origin?.plugin === 'engine' && !NOT_ASKS.has(e.tool) && !decided.has(id)) {
      waiting.set(id, { kind: 'permission', tool: e.tool, what: whatOf(e.input) })
      const grace = S.permMode === 'auto' ? GRACE_AUTO_MS : S.permMode ? GRACE_MS : GRACE_UNKNOWN_MS
      $.clock.after(grace, async () => {
        const ask = waiting.get(id)
        if (!ask) return
        waiting.delete(id)
        asks.set(id, ask)
        await waitForPerson($, ask).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
      })
    }
  } catch (err) {
    log(`ошибка мода: ${err?.message ?? err}`)
  }
  return verdict
}

// Телеметрия: из решения о вызове берём только режим и id вызова
export function toolDecided($, e) {
  if (!String(e.event ?? '').endsWith('tool_decision')) return
  const a = e.attributes ?? {}
  if (typeof a.permission_mode === 'string') S.permMode = a.permission_mode
  if (typeof a.tool_use_id === 'string') settle($, a.tool_use_id)
}

// Режим разрешений из входа классического хука (Pro и Max): он есть у каждого
function modeOf(e) {
  if (typeof e?.permission_mode === 'string' && e.permission_mode) S.permMode = e.permission_mode
}

// Классический хук (Pro и Max): запрос показан человеку сейчас. Вопрос ловит questionCall
export async function classicAsk($, e) {
  modeOf(e)
  if (e.tool_name === 'AskUserQuestion') return
  const ask = { kind: 'permission', tool: e.tool_name ?? '', what: whatOf(e.tool_input) }
  asks.set('classic', ask)
  await waitForPerson($, ask)
}
// Инструмент отработал: классический запрос закрыт (вопрос, если он открыт, — нет)
export function classicDone($, e) {
  modeOf(e)
  asks.delete('classic')
  resume($)
}
// Инструментов главного цикла больше не идёт: классический запрос тоже закрыт — в разрешении могли отказать, а тогда
// PostToolUse не будет
export function callsOver($) {
  if (asks.delete('classic')) resume($)
}

// Вопросы вызова AskUserQuestion — для отметки: текст (для показа — не длиннее QUESTION_MAX), подписи вариантов,
// можно ли несколько. Что-то не так — null: такой вопрос из «Агентов» не ответить
function questionsOf(list) {
  if (!Array.isArray(list) || !list.length) return null
  const out = []
  for (const q of list) {
    const labels = Array.isArray(q?.options) ? q.options.map((o) => o?.label) : []
    if (typeof q?.question !== 'string' || !labels.length || !labels.every((x) => typeof x === 'string' && x)) return null
    const question = q.question.length > QUESTION_MAX ? `${q.question.slice(0, QUESTION_MAX - 1)}…` : q.question
    out.push({ question, header: typeof q.header === 'string' ? q.header : '', options: labels, multi: Boolean(q.multiSelect) })
  }
  return out
}

// Ответ, собранный из выбора picks (на каждый вопрос — подписи), в том виде, в каком его даёт сам диалог:
// { [вопрос]: подпись или подписи через запятую }. Выбор не подходит к вопросам — null
export function answersOf(list, picks) {
  if (!Array.isArray(picks) || picks.length !== list.length) return null
  const out = {}
  for (const [i, q] of list.entries()) {
    const labels = q.options.map((o) => o.label)
    const chosen = picks[i]
    if (!Array.isArray(chosen) || !chosen.length || !chosen.every((x) => labels.includes(x))) return null
    if (!q.multiSelect && chosen.length > 1) return null
    out[q.question] = chosen.join(', ')
  }
  return out
}

// Ответ на вопрос id: из своей вкладки или из файла ответа, который написала другая сессия
async function answerFor($, id, list) {
  let picks = ownAnswers.get(id)
  const ag = S.ag
  if (!picks && ag?.on && ag.ready) {
    const text = await $.fs.read(answerPath(ag.slot)).catch(() => null)
    try {
      const got = text ? JSON.parse(text) : null
      if (got?.v === 1 && got.to === ag.sid && got.id === id) picks = got.picks
    } catch {}
  }
  return picks ? answersOf(list, picks) : null
}

// tool.call AskUserQuestion: вопрос — человеку, как обычно, а пока он открыт — читаем, не ответили ли из «Агентов».
// Ответили — отдаём модели этот ответ, а диалог движок снимает сам
export async function questionCall($, e, next) {
  const questions = questionsOf(e.questions)
  if (!questions) return next(e)
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 12)
  const key = `q:${id}`
  const asked = next(e)
  let over = false
  const done = asked.then(() => (over = true), () => (over = true))
  asks.set(key, { kind: 'question', id, questions })
  try {
    await waitForPerson($, asks.get(key)).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    while (!over) {
      await Promise.race([done, $.clock.sleep(ANSWER_POLL_MS, { signal: next.signal }).catch(() => {})])
      if (over || next.signal?.aborted) break
      const answers = await answerFor($, id, e.questions).catch(() => null)
      if (answers) {
        log('ответ на вопрос пришёл из «Агентов»')
        return { result: { questions: e.questions, answers } }
      }
    }
    return await asked
  } finally {
    asks.delete(key)
    ownAnswers.delete(id)
    resume($)
  }
}

// --- Вкладка «Агенты» ----------------------------------------------------------------------------------------------

// Запрос сессии r — проверенный: чужая отметка могла прийти от старой версии Arcade или быть битой. null — нечего показать
export function askOf(r) {
  const a = r?.status === 'permission' ? r.ask : null
  if (!a || typeof a !== 'object') return null
  if (a.kind === 'permission') return { kind: 'permission', tool: String(a.tool ?? ''), what: String(a.what ?? '') }
  if (a.kind !== 'question' || typeof a.id !== 'string' || !Array.isArray(a.questions) || !a.questions.length) return null
  const ok = a.questions.every((q) => typeof q?.question === 'string' && Array.isArray(q.options) && q.options.length && q.options.every((x) => typeof x === 'string'))
  return ok ? { kind: 'question', id: a.id, questions: a.questions.map((q) => ({ ...q, header: String(q.header ?? ''), multi: Boolean(q.multi) })) } : null
}

const keyOf = (r, ask) => `${r.sid}:${ask.id}`
// Выбранные варианты вопроса сессии r: на каждый вопрос — подписи
export function picksOf(r, ask) {
  return picked.get(keyOf(r, ask)) ?? ask.questions.map(() => [])
}
export const isSent = (r, ask) => sent.has(keyOf(r, ask))

// Нажали вариант: один вопрос с одним ответом — ответ уходит сразу; иначе — отметить (или снять) и ждать «Ответить»
export async function pickOption($, r, ask, qi, label) {
  const picks = picksOf(r, ask).map((x) => [...x])
  const q = ask.questions[qi]
  if (!q) return
  if (ask.questions.length === 1 && !q.multi) return sendAnswer($, r, ask, [[label]])
  picks[qi] = q.multi ? (picks[qi].includes(label) ? picks[qi].filter((x) => x !== label) : [...picks[qi], label]) : [label]
  picked.set(keyOf(r, ask), picks)
  $.ui.invalidate('ui.render')
}
export const allPicked = (r, ask) => picksOf(r, ask).every((x) => x.length > 0)

// Отправить ответ сессии r: своей — сразу в память, другой — файлом в её место
export async function sendAnswer($, r, ask, picks) {
  if (r.me) ownAnswers.set(ask.id, picks)
  else {
    const slot = Number(r.slot)
    if (!S.ag?.on || !Number.isInteger(slot) || slot < 1 || slot > AGENT_SLOTS) return
    await $.fs.write(answerPath(slot), JSON.stringify({ v: 1, to: r.sid, id: ask.id, picks, at: await $.clock.now() }))
  }
  sent.add(keyOf(r, ask))
  picked.delete(keyOf(r, ask))
  log(`ответ на вопрос ушёл сессии «${r.name}»`)
  $.ui.invalidate('ui.render')
}
