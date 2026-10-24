// Arcade: встроенный браузер Claude в Desktop.
import { SITE } from '../catalog.js'
import { tr } from '../i18n.js'
import { CUT_TOOL_MS, PANE, S } from './state.js'
import { log, windowNotice } from './status.js'
import { TIKTOK, windowUrl, withName } from './window.js'

// В Desktop окно — встроенный браузер приложения, его MCP-сервер. Его инструменты Arcade зовёт тем же путём, что
// и Claude ($.tool.call, через проверку разрешений), и свои вызовы разрешает сам — хук tool.check в register:
// прямой $.mcp.call авто-режим не пропускал, просил ведь не человек. В авто-режиме не выходит и так: вызовы мода
// классификатор не судит, а разрешение мода движок там не слушает (как и субагента мода) — тогда игру открывает Claude
// по просьбе Arcade: его вызовы классификатор оценит. Просьба мода ждёт, пока Claude освободится, поэтому работающего
// агента Arcade прерывает: дожидается конца текущего инструмента (не дольше CUT_TOOL_MS — потом обрывает и его, и
// просит Claude проверить, что тот успел), обрывает ход ($.turn.abort) и сразу просит открыть игру и вернуться к
// работе. Не прервался — просьба ждёт конца хода. Не приняли просьбу или браузер ответил ошибкой —
// кладём её в поле ввода, и по Enter её выполнит Claude. Черновик в поле не стираем: просьба встаёт после него. Поле
// может и не взять текст: под вопросом Claude Code — 'dialog'; где поле рисует само приложение — 'manual', просьбу
// человек отправит сам. Игру открыл Claude — панель Arcade закрываем, как и после своего открытия.
export const BROWSER = 'mcp__Claude_Browser__'
// Боковые панели приложения: скрытую панель браузера показывает он
const SHOW_PANE = 'mcp__ccd_view__show_pane'
// Инструменты приложения, которые Arcade зовёт сам
export const DESKTOP_TOOLS = [`${BROWSER}tabs_context`, `${BROWSER}navigate`, `${BROWSER}tabs_select`, `${BROWSER}preview_start`, `${BROWSER}tabs_close`, SHOW_PANE]

// Адрес, который открывает Arcade: страницы его сайта и TikTok
export function arcadeUrl(url) {
  return typeof url === 'string' && (url.startsWith(`${SITE}/`) || url.startsWith(`${TIKTOK}/`))
}

// Вызов, который Arcade разрешает себе без вопроса: вкладки браузера, адрес только на сайте Arcade или TikTok, панель
// браузера. Закрывает Arcade только вкладку, которую открыл сам (watchTab)
export function ownDesktopCall(tool, input) {
  if (tool === `${BROWSER}tabs_context` || tool === `${BROWSER}tabs_select` || tool === `${BROWSER}tabs_close`) return true
  if (tool === `${BROWSER}navigate` || tool === `${BROWSER}preview_start`) return arcadeUrl(input?.url)
  return tool === SHOW_PANE && input?.pane === 'preview'
}

// Вызов инструмента приложения. Отказ — исключение с пометкой denied, неизвестный инструмент — исключение без неё.
// consent — что нажал человек: если решать всё же будет классификатор авто-режима, он прочтёт это как просьбу человека
async function desktopCall($, tool, args, consent) {
  const result = await $.tool.call({ tool, ...args, consent })
  if (result?.deny) throw Object.assign(new Error(result.deny), { denied: true })
  return result
}

// Ответ инструмента одной строкой — для журнала
function toolText(result) {
  return result?.text ?? (typeof result?.result === 'string' ? result.result : '')
}

// Вкладки встроенного браузера: tabs_context отвечает JSON-ом, а за ним строкой — виден ли браузер
async function browserTabs($, consent) {
  const text = toolText(await desktopCall($, `${BROWSER}tabs_context`, {}, consent))
  try {
    return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)).tabs ?? []
  } catch {
    return []
  }
}

// Вкладка Arcade (или TikTok — origin), если она уже открыта: активная, иначе последняя
async function arcadeTab($, consent, origin = SITE) {
  const ours = (await browserTabs($, consent)).filter((t) => t.origin === origin)
  return ours.find((t) => t.isActive) ?? ours.pop() ?? null
}

// Что открыто для просмотра — видео, трансляция, TikTok, статья или выпуск: такую вкладку закроет «агент закончил»
function viewing(url) {
  return ['watch', 'live', 'read', 'listen'].some((path) => String(url).startsWith(`${SITE}/${path}`)) || String(url).startsWith(`${TIKTOK}/`)
}

// Запомнить вкладку, где Arcade только что открыл адрес (она — активная). Во вкладку, где было видео, открылась игра
// или чаты — закрывать её «агент закончил» уже не должен. turn — ход Claude, который её открыл. Настройка выключена —
// вкладки не спрашиваем: лишний вызов браузера ни к чему
async function rememberTab($, url, consent, turn = null) {
  if (!S.backOnDone || (!viewing(url) && !S.watchTab)) return
  const tab = (await browserTabs($, consent)).find((t) => t.isActive)
  if (!tab) return
  if (viewing(url)) S.watchTab = { tabId: tab.tabId, turn }
  else if (S.watchTab?.tabId === tab.tabId) S.watchTab = null
}

// Агент закончил, а человек смотрит во встроенном браузере: вкладку, которую открыл Arcade, закрываем — перед ним
// снова разговор с Claude. Последняя вкладка закрывается вместе с панелью браузера. true — закрыли
export async function closeWatchTab($) {
  const { tabId } = S.watchTab
  S.watchTab = null
  try {
    const result = await desktopCall($, `${BROWSER}tabs_close`, { tabId }, 'The agent finished its turn, and the user chose in Arcade settings to close the tab Arcade opened for watching.')
    if (!result?.isError) return true
    log(`вкладка не закрылась: ${toolText(result).slice(0, 200)}`)
  } catch (err) {
    log(`вкладка не закрылась: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  return false
}

// Адрес — во вкладку Arcade, если она уже открыта: новая вкладка на каждое нажатие упирается в предел вкладок
// браузера, а прошлые игры так и играют в фоне. Своей вкладки нет — открываем новую
async function browse($, url, tab, consent) {
  if (tab) {
    const result = await desktopCall($, `${BROWSER}navigate`, { url, tabId: tab.tabId }, consent)
    if (!result?.isError) {
      await desktopCall($, `${BROWSER}tabs_select`, { tabId: tab.tabId }, consent)
      return result
    }
  }
  return desktopCall($, `${BROWSER}preview_start`, { url }, consent)
}

// Скрытая панель браузера сама не появляется — показываем. Не вышло — игра всё равно открыта, пишем в журнал
async function showBrowser($, consent) {
  try {
    const result = await desktopCall($, SHOW_PANE, { pane: 'preview' }, consent)
    if (result?.isError) log(`панель браузера не показалась: ${toolText(result).slice(0, 200)}`)
  } catch (err) {
    log(`панель браузера не показалась: ${String(err?.message ?? err).slice(0, 200)}`)
  }
}

// Нажатие человека для вызовов инструментов приложения: если решать будет классификатор авто-режима, он прочтёт его
// как просьбу человека
function desktopConsent(url) {
  return `The user pressed a button in the Arcade pane to open ${url} in the built-in browser.`
}

async function openDesktopBrowser($, id) {
  const url = windowUrl(id)
  const consent = desktopConsent(url)
  let denied = false
  try {
    const result = await browse($, withName(url, id), await arcadeTab($, consent, url.startsWith(`${TIKTOK}/`) ? TIKTOK : SITE), consent)
    if (!result?.isError) {
      await showBrowser($, consent)
      await rememberTab($, url, consent).catch((err) => log(`вкладка не запомнилась: ${String(err?.message ?? err).slice(0, 200)}`))
      return 'opened'
    }
    log(`встроенный браузер ответил ошибкой: ${toolText(result).slice(0, 200)}`)
  } catch (err) {
    denied = err?.denied === true
    log(`встроенный браузер не открылся: ${String(err?.message ?? err).slice(0, 200)}`)
  }
  // Отказ в разрешении — просим Claude. Сжимает он контекст — ждём конца сжатия: прерванный в это время ход не
  // обрывается, а просьбы копятся в очереди
  if (denied && S.compacting) {
    S.pendingOpen = url // откроем, когда сжатие кончится: хук session.compact в register
    return 'compacting'
  }
  // Работает — сначала прерываем, иначе просьба ждёт конца его хода. Уже открывает другую игру по просьбе Arcade —
  // второй раз не прерываем: просьба встанет следом
  if (denied && S.agentTurn && !S.asking) {
    // Идёт инструмент или Claude Code спрашивает разрешение (прерванный ход унёс бы и вопрос) — ждём
    if (S.toolsRunning > 0 || S.status === 'permission') {
      S.pendingOpen = url // прервём, когда закончится текущий инструмент: хук tool.call в register
      $.clock.after(CUT_TOOL_MS, () => cutPending($, url).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
      return 'waiting'
    }
    return interruptAgent($, url)
  }
  return askClaude($, url, denied)
}

// Прервать ход агента и сразу попросить открыть игру и вернуться к работе; cut — оборван и идущий инструмент.
// Не прервался — просьба ждёт конца хода
async function interruptAgent($, url, cut) {
  S.pendingOpen = null
  const turnId = S.agentTurn
  if (!turnId) return askClaude($, url, true)
  S.interrupting = true
  try {
    await $.turn.abort({ turnId })
  } catch (err) {
    S.interrupting = false
    log(`ход агента не прервался: ${String(err?.message ?? err).slice(0, 200)}`)
    return askClaude($, url, true)
  }
  log(cut ? 'Arcade оборвал инструмент и ход агента' : 'Arcade прервал ход агента')
  // Об оборванном инструменте Claude больше никто не скажет: маркера прерывания нет
  const then = [
    tr('Потом вернись к работе, которую делал до этого.', S.lang),
    cut ? tr('Твой последний инструмент оборван на полпути: проверь, что он успел сделать, прежде чем продолжать.', S.lang) : null,
  ]
  const outcome = await askClaude($, url, true, then.filter(Boolean).join('\n'))
  return outcome === 'sent' ? 'interrupted' : outcome
}

// Инструмент агента идёт дольше CUT_TOOL_MS, а игра всё ждёт — обрываем и его. Пока Claude Code спрашивает
// разрешение, не обрываем: ход унёс бы и вопрос
async function cutPending($, url) {
  if (S.pendingOpen !== url || S.toolsRunning === 0 || S.status === 'permission' || !S.agentTurn || S.compacting) return
  S.pendingOpen = null
  desktopNotice($, await interruptAgent($, url, true), '', url)
}

// Текущий инструмент агента или сжатие контекста закончились, а игра ждёт — прерываем ход. Ход уже кончился сам —
// просьба уходит как обычно
export async function openPending($) {
  if (!S.pendingOpen || S.toolsRunning > 0 || S.compacting) return
  const url = S.pendingOpen
  S.pendingOpen = null
  desktopNotice($, S.agentTurn ? await interruptAgent($, url) : await askClaude($, url, true), '', url)
}

// Просьба открыть адрес — Claude: сразу (submit) или в поле ввода; then — что сделать после. Откроет — панель закроет
// хук tool.call в register
export async function askClaude($, url, submit, then) {
  const ask = [tr(`Открой во встроенном браузере: ${url}`, S.lang), then].filter(Boolean).join('\n')
  S.opening = true
  if (submit) {
    // Отмечаем до отправки: ход с просьбой может и кончиться раньше, чем ответит submit
    S.asking = url
    S.askResumes = Boolean(then)
    const sent = await $.prompt.submit({ text: ask }).catch((err) => ({ drop: String(err?.message ?? err) }))
    if (!sent.drop) return 'sent'
    S.asking = null
    log(`просьба Claude не ушла: ${sent.drop.slice(0, 200)}`)
  }
  const { text: draft } = await $.prompt.read()
  if (draft.includes(url)) return 'filled'
  const filled = await $.prompt.fill({ text: draft.trim() ? `\n${ask}` : ask, mode: 'append' })
  if (filled.isFilled) return 'filled'
  return filled.refusal === 'dialog' ? 'dialog' : 'manual'
}

// Что сказать о попытке открыть встроенный браузер; opened — если он открылся сразу
export function desktopNotice($, outcome, opened, url) {
  // Адрес для ручной просьбы не убираем через 15 секунд: его ещё надо переписать. Ожидание — пока не кончится
  // инструмент агента или сжатие, сколько бы они ни шли
  // Что открывается: видео (и трансляция), статья или выпуск (о них — «ссылка») или игра
  const page = (path) => String(url).startsWith(`${SITE}/${path}`)
  const kind = page('watch') || page('live') || String(url).startsWith(`${TIKTOK}/`) ? 'video' : page('read') || page('listen') || page('chat') ? 'link' : 'game'
  const pick = (video, link, game) => ({ video, link, game })[kind]
  if (outcome === 'manual') S.libraryNotice = `Попроси Claude открыть во встроенном браузере: ${url}`
  else if (outcome === 'waiting')
    S.libraryNotice = pick(
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть видео во встроенном браузере.',
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть ссылку во встроенном браузере.',
      'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть игру во встроенном браузере.',
    )
  else if (outcome === 'compacting')
    S.libraryNotice = pick(
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть видео во встроенном браузере.',
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть ссылку во встроенном браузере.',
      'Claude сжимает контекст — когда закончит, Arcade попросит его открыть игру во встроенном браузере.',
    )
  else if (outcome === 'asking')
    windowNotice(
      $,
      pick(
        'Claude уже открывает это видео во встроенном браузере — подожди немного.',
        'Claude уже открывает эту ссылку во встроенном браузере — подожди немного.',
        'Claude уже открывает эту игру во встроенном браузере — подожди немного.',
      ),
    )
  else
    windowNotice(
      $,
      outcome === 'opened'
        ? opened
        : outcome === 'interrupted'
          ? pick(
              'Arcade прервал Claude: он откроет видео во встроенном браузере и вернётся к работе.',
              'Arcade прервал Claude: он откроет ссылку во встроенном браузере и вернётся к работе.',
              'Arcade прервал Claude: он откроет игру во встроенном браузере и вернётся к работе.',
            )
          : outcome === 'sent'
            ? 'Arcade попросил Claude открыть ссылку во встроенном браузере.'
            : outcome === 'filled'
              ? 'Ссылка — в поле ввода: нажми Enter, и Claude откроет её во встроенном браузере.'
              : 'Не получилось открыть встроенный браузер: сначала ответь на вопрос Claude Code.',
    )
  $.ui.invalidate('ui.render')
}

// Открыть во встроенном браузере и сказать, что вышло; opened — что сказать, если он открылся сразу
export async function desktopWindow($, id, opened) {
  // Эту же игру Claude уже открывает по просьбе Arcade или она ждёт конца инструмента или сжатия — повторное
  // нажатие только напоминает, что происходит: второй раз ход не прерываем
  const url = windowUrl(id)
  if (S.asking === url || S.pendingOpen === url) {
    desktopNotice($, S.asking === url ? 'asking' : S.compacting ? 'compacting' : 'waiting', '', url)
    return
  }
  S.opening = false
  S.pendingOpen = null
  S.libraryNotice = 'Открываю встроенный браузер…'
  $.ui.invalidate('ui.render')
  const outcome = await openDesktopBrowser($, id)
  desktopNotice($, outcome, opened, url)
  // Браузер встаёт под панелью Arcade, и игре тесно — панель закрываем, если в настройках не выбрано оставлять меню.
  // Назад — /arcade или «Библиотека» на сайте
  if (outcome === 'opened' && !S.keepMenu) await $.ui.close({ id: PANE })
}

// Игру открыл Claude по просьбе Arcade: панель Arcade закрываем (или оставляем — keepMenu). Вызов Claude панель
// браузера не показывает — показываем сами (в авто-режиме может и не выйти)
export async function openedForArcade($, e) {
  S.opening = false
  S.asking = null
  await showBrowser($, desktopConsent(e.url))
  // Claude открыл вкладку и вернулся к прерванной работе — конец хода закроет её; открыл и только — не закроет
  const turn = S.askResumes ? null : S.agentTurn
  S.askResumes = false
  await rememberTab($, e.url, desktopConsent(e.url), turn).catch((err) => log(`вкладка не запомнилась: ${String(err?.message ?? err).slice(0, 200)}`))
  if (S.paneOpen && !S.keepMenu) await $.ui.close({ id: PANE })
}
