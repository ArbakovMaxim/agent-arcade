// Фоновые агенты: главный ход кончился, а субагенты и напарники, запущенные из него, ещё работают. Тогда сессия не
// «закончил ход», а «работает в фоне · агентов: N»: «закончил», плашка, всплывашка, уведомление и следующая карточка
// очереди — только когда в фоне никого не осталось. Фоновые команды (Bash в фоне) не считаем: о их конце мод не узнаёт
import { notifyCommand } from '../browsers.js'
import { tr } from '../i18n.js'
import { NOTIFY_AFTER_MS, NOTIFY_WINDOW_MS, PANE, S } from './state.js'
import { log } from './status.js'
import { releaseAll } from './play.js'
import { closeWatchTab } from './desktop.js'
import { queueNext, queueTurnDone } from './queue.js'

// В фоне никого не видно — ещё столько ждём: конец субагента будит Claude новым ходом (уведомление о задаче), и его
// начало не должно опоздать за «закончил»
export const BG_GRACE_MS = 5_000
// Работает или ждёт своего: pending — ещё стартует, waiting — ждёт свою фоновую работу или одобрения плана. idle —
// напарник ждёт сообщения: это не работа
const ACTIVE = new Set(['pending', 'running', 'waiting'])

const modError = (err) => log(`ошибка мода: ${err?.message ?? err}`)

// Сколько агентов главного цикла сейчас работает. Запущенные другими плагинами (spawnedBy) — их дело, вложенные
// (parentId) — часть своего родителя
export async function bgCount($) {
  const list = await $.agent.list().catch(() => [])
  return list.filter((a) => ACTIVE.has(a.status) && !a.parentId && !a.spawnedBy).length
}

// Ход Claude по уведомлению о фоновой задаче — не новая просьба, а продолжение той же работы (prompt.submit отмечает
// S.wake; на случай, если тот хук не дошёл, — и по тексту)
export const wakeText = (text) => /^\s*<task-notification>/.test(text ?? '')

// Главный ход кончился, а в фоне n агентов: «закончил» откладываем. e — конец хода для очереди; ход прервали или он
// упал — очередь решает сейчас же (стоп или ожидание лимита), ответ — когда фон кончится
export async function bgHold($, turnId, e, n) {
  let held = e
  if (e.reason !== 'answer' && S.queue) {
    await queueTurnDone($, e)
    held = null
  }
  S.status = 'background'
  S.bg = { n, zeroAt: 0, checking: false, end: { turnId, e: held } }
  log(`агент закончил ход, в фоне агентов: ${n}`)
  $.ui.invalidate('ui.render')
}

// Начался главный ход: отложенного конца больше нет. true — ход продолжает работу, которая шла в фоне
export function bgResume() {
  const going = Boolean(S.bg?.end)
  S.bg = { n: 0, zeroAt: 0, checking: false, end: null }
  return going
}

// Сессию очистили (/clear): ждать фоновых больше незачем
export function bgClear($) {
  if (!S.bg?.end) return
  S.bg = { n: 0, zeroAt: 0, checking: false, end: null }
  if (S.status === 'background') S.status = 'idle'
  $.ui.invalidate('ui.render')
}

// Пересчитать фон — шагом отметки сессии и после конца каждого субагента. Никого не осталось дольше BG_GRACE_MS, а
// новый ход не начался — Claude закончил
export async function bgCheck($) {
  const bg = S.bg
  if (!bg?.end || bg.checking) return
  bg.checking = true
  try {
    const n = await bgCount($)
    if (S.bg !== bg || !bg.end) return
    const now = await $.clock.now()
    if (n > 0) {
      bg.zeroAt = 0
      if (n !== bg.n) {
        bg.n = n
        $.ui.invalidate('ui.render')
      }
      return
    }
    if (!bg.zeroAt) bg.zeroAt = now
    if (now - bg.zeroAt < BG_GRACE_MS || S.agentTurn) return
    const { turnId, e } = bg.end
    // Пока ждали, мог прийти запрос разрешения от субагента — тогда «закончил» после него (asks.js вернёт «в фоне»)
    if (S.status !== 'background') return
    await turnDone($, turnId, e)
  } catch (err) {
    modError(err)
  } finally {
    bg.checking = false
  }
}

// Claude закончил — и в фоне никого: статус, очередь, плашка над игрой, всплывашка, уведомление ОС. e — конец хода
// для очереди (null — очередь уже решила)
export async function turnDone($, turnId, e) {
  S.bg = { n: 0, zeroAt: 0, checking: false, end: null }
  S.status = 'done'
  S.askVisible = false
  // Очередь карточек: карточка сделана — следующая уходит новым ходом, не изнутри конца этого
  if (e && S.queue && (await queueTurnDone($, e))) $.clock.after(0, () => queueNext($).catch(modError))
  if (S.paneOpen && S.view !== 'library') {
    S.agentAlert = 'done'
    if (S.onDone === 'pause') {
      S.paused = true
      releaseAll()
    }
    if (S.onDone === 'close') await $.ui.close({ id: PANE }) // панель закрывается — игра встаёт на паузу, клавиатура у Claude Code
  }
  log('агент закончил ход')
  // Смотришь во встроенном браузере — вкладку закрываем, если так выбрано: снова виден разговор. Ход, которым Claude
  // открыл её по просьбе Arcade, — не тот: его конец вкладку не закрывает. Закрыть не дали (в режиме Auto
  // классификатор не пускает вызовы мода) — хотя бы сообщаем
  const watching = Boolean(S.backOnDone && S.watchTab && S.watchTab.turn !== turnId)
  const back = watching && (await closeWatchTab($))
  if (back) await $.ui.toast(tr('Агент закончил — вкладку закрыл, перед тобой снова разговор', S.lang))
  else if (S.paneOpen) await $.ui.toast(tr('Агент закончил — Esc, чтобы вернуться', S.lang))
  else if (watching) await $.ui.toast(tr('Агент закончил — можно возвращаться', S.lang))
  // Играешь в окне браузера — Claude Code не видно: системное уведомление, если ход был долгим
  const now = await $.clock.now()
  const command = S.osNotify && S.windowOpenedAt && now - S.windowOpenedAt < NOTIFY_WINDOW_MS && now - S.turnStartedAt >= NOTIFY_AFTER_MS
    ? notifyCommand(S.platform, 'Claude Code', tr('Агент закончил — можно возвращаться', S.lang))
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
