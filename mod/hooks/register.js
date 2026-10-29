// Arcade — пробная игровая платформа в Claude Code: вопрос «сыграть?», панель с библиотекой игр и Денди.
// Правило мода: каждый обработчик событий Claude Code только наблюдает и всегда возвращает next(e).
// Требования проверки модов: обработчик в on(...) — сама функция, а $ всегда пишется как $.ui.open(...) и т. п.
// Здесь — только подписки на события Claude Code. Состояние и помощники — в hooks/app/, экраны панели — в hooks/screens/,
// чистые модули без $ (каталог, переводы, ленты и т. п.) — рядом, в hooks/.
import { parseCatalog, restoreCatalog, siteUrl } from './catalog.js'
import { DETECT_ARGV, notifyCommand, parseDetection } from './browsers.js'
import { detectLang, tr, translateTree } from './i18n.js'
import { restoreMine } from './mine.js'
import { SYNC_KEYS, restoreAccount, restoreStamps } from './account.js'
import { NOTES_TOOL } from './notes.js'
import { bookLang } from './books.js'
import { DEBUG, GRAPHICS, INPUT, LAUNCH_TIMEOUT_MS, NOTES_TOOL_NAME, NOTIFY_AFTER_MS, NOTIFY_WINDOW_MS, PANE, S, savedKeys } from './app/state.js'
import { addMine, gameById, games } from './app/library.js'
import { LOBBIES_EVERY_MS, log, waitingFrom, waitingText, windowNotice, workedSeconds, workedText } from './app/status.js'
import { followPane, nesView, openPane, paneClosedBy, pressStart, readInput, releaseAll, runGameLoop, toLibrary, typedFrom } from './app/play.js'
import { builtinBrowser, launchNotice, mouseGame, webGame, windowCommand } from './app/window.js'
import { BROWSER, DESKTOP_TOOLS, arcadeUrl, askClaude, closeWatchTab, desktopNotice, desktopWindow, openPending, openedForArcade, ownDesktopCall } from './app/desktop.js'
import { SYNC_EVERY_MS, applySetting, saveSetting, syncAccount } from './app/profile.js'
import { CHATS_POLL_MS, CHAT_POLL_MS, POPUP_POLL_MS, PULSE_SOON_MS, loadChats, pollChat, pulse, watchMessages } from './app/talk.js'
import { BOARDS_POLL_MS, BOARD_POLL_MS, NOTES_POLL_MS, loadBoards, loadNotes, notesShown, notesTool, pushBoards, refreshNotes, shownBoard, syncBoard } from './app/work.js'
import { drawPane } from './screens/pane.js'
// для тестов (tests/arcade.test.ts)
export { clip, workedText } from './app/status.js'
export { ownDesktopCall } from './app/desktop.js'
export { paneClosedBy } from './app/play.js'

export function register(on) {
  on('session.start', async ($, e, next) => {
    try {
      // Модуль перезагрузили (/reload-plugins, обновление), а панель осталась открытой: движок её помнит, а наш флаг — нет.
      // Без этого после перезагрузки панель не закрывалась, когда Claude открывал игру во встроенном браузере
      S.paneOpen = (await $.ui.panes().catch(() => [])).some((p) => p.id === PANE)
      if (S.paneOpen) S.paneSeen = true
      // Общие настройки (SYNC_KEYS): чего в $.store нет или что не подходит — остаётся по умолчанию
      for (const key of SYNC_KEYS) if (applySetting(key, await $.store.get(key))) savedKeys.add(key)
      if (!savedKeys.has('lang')) S.lang = detectLang(await $.env.get('LC_ALL'), await $.env.get('LC_MESSAGES'), await $.env.get('LANG'))
      // Язык книг: выбранный в «Книгах», иначе язык интерфейса
      S.bk = { ...S.bk, lang: bookLang(await $.store.get('booksLang'), S.lang) }
      S.stamps = restoreStamps(await $.store.get('syncAt'))
      S.msgNotify = (await $.store.get('msgNotify')) !== false
      S.acct.session = restoreAccount(await $.store.get('account'))
      S.mine = restoreMine(await $.store.get('mine'))
      await loadNotes($)
      const home = (await $.env.get('USERPROFILE')) || (await $.env.get('HOME'))
      if (home) {
        S.sep = home.includes('\\') ? '\\' : '/'
        S.dataDir = [home.replace(/[\\/]+$/, ''), '.claude', 'arcade', 'roms'].join(S.sep)
      }
      S.catalog = restoreCatalog(await $.store.get('catalog')) ?? S.catalog
      const savedGame = await $.store.get('lastGame')
      S.played = games().some((g) => g.id === savedGame)
      if (S.played) S.lastGame = savedGame
      // Кто Arcade уже пользовался (играл, менял настройки, входил), приветствия не видит
      S.welcomed = (await $.store.get('welcomed')) === true || S.played || savedKeys.size > 0 || Boolean(S.acct.session)
      const savedGraphics = await $.store.get('graphics')
      if (GRAPHICS.includes(savedGraphics)) S.graphics = savedGraphics
      const savedOpener = await $.store.get('opener')
      if (savedOpener?.opener === 'window' || savedOpener?.opener === 'pane') S.opener = savedOpener.opener
      // Браузер Desktop сохраняет и без выбора терминала (opener — null)
      if (typeof savedOpener?.browser === 'string') S.browserChoice = savedOpener.browser
      if ((await $.store.get('desktopOpener')) === 'window') S.desktopOpener = 'window'
      const localAppData = await $.env.get('LOCALAPPDATA')
      S.profileRoot = localAppData ? `${localAppData}\\claude-arcade` : ''
      if ((await $.env.get('OS')) === 'Windows_NT') S.platform = 'windows'
      // Кто ждёт в сети — раз в минуту; первый раз — сразу после каталога
      const pollLobbies = async () => {
        try {
          const response = await $.http.fetch(siteUrl('api/lobbies'))
          if (!response.ok) return
          const fresh = waitingFrom(JSON.parse(response.text))
          if (JSON.stringify(fresh) !== JSON.stringify(S.netWaiting)) {
            S.netWaiting = fresh
            $.ui.invalidate('ui.render')
          }
        } catch {
          // сайт недоступен — показываем то, что было
        }
      }
      $.clock.after(2_000, pollLobbies)
      $.clock.every(LOBBIES_EVERY_MS, pollLobbies)
      // Настройки с других компьютеров — вскоре после старта и раз в полчаса; без входа syncAccount ничего не делает
      $.clock.after(3_000, () => syncAccount($))
      $.clock.every(SYNC_EVERY_MS, () => syncAccount($))
      // Чаты — пока панель открыта на библиотеке и человек вошёл: открытый чат спрашиваем часто, список — реже;
      // сколько непрочитанных для плитки «Чаты» приносит отметка «в сети»
      const chatsOn = () => S.paneOpen && S.acct.session && S.view === 'library'
      const chatError = (err) => log(`ошибка мода: ${err?.message ?? err}`)
      $.clock.every(CHAT_POLL_MS, () => {
        if (chatsOn() && S.menu === 'chats:talk') pollChat($).catch(chatError)
      })
      $.clock.every(CHATS_POLL_MS, () => {
        // Список — на всех экранах чатов: в широкой панели Desktop он слева от переписки, нового чата и участников
        if (chatsOn() && (S.menu === 'chats' || S.menu.startsWith('chats:'))) loadChats($, true).catch(chatError)
      })
      // «В сети» — пока панель открыта на библиотеке: отметка раз в PULSE_MS, а когда просили — сразу
      $.clock.every(PULSE_SOON_MS, () => {
        if (chatsOn()) pulse($).catch(chatError)
      })
      // Всплывающие уведомления о сообщениях — и при закрытой панели, пока они включены и человек вошёл
      $.clock.every(POPUP_POLL_MS, () => watchMessages($).catch(chatError))
      // Доска проектов: открытую общую доску сверяем с сайтом, список общих досок на её экране — обновляем; свои правки,
      // не ушедшие в прошлый раз, — на сайт вскоре после старта
      $.clock.every(BOARD_POLL_MS, () => {
        if (!chatsOn()) return
        const share = shownBoard()?.board.share
        if (share && (!S.desks[share] || !S.dk.me)) loadBoards($, true).catch(chatError)
        else if (share) syncBoard($, share).catch(chatError)
      })
      $.clock.every(BOARDS_POLL_MS, () => {
        if (chatsOn() && S.menu === 'boards') loadBoards($, true).catch(chatError)
      })
      $.clock.after(4_000, () => pushBoards($))
      // Блокнот на экране — перечитываем: его могли поправить в другой сессии Claude Code
      $.clock.every(NOTES_POLL_MS, () => {
        if (S.paneOpen && S.view === 'library' && notesShown()) refreshNotes($).catch(chatError)
      })
      // Каталог с сайта и ОС — в фоне, чтобы не держать старт сессии
      $.clock.after(150, async () => {
        try {
          const response = await $.http.fetch(siteUrl('catalog.json'))
          const fresh = response.ok ? parseCatalog(response.text) : null
          if (fresh) {
            S.catalog = fresh
            await $.store.set('catalog', { consoles: fresh.consoles, groups: fresh.groups, shelves: fresh.shelves, support: fresh.support, games: fresh.games })
            $.ui.invalidate('ui.render')
          }
        } catch (err) {
          log(`каталог с сайта не получен: ${err?.message ?? err}`)
        }
      })
      if (!S.platform) {
        $.clock.after(100, async () => {
          try {
            const result = await $.process.run(['uname', '-s'], { timeoutMs: 5000 })
            const name = result.stdout.trim()
            if (name === 'Darwin') S.platform = 'mac'
            if (name === 'Linux') S.platform = 'linux'
            $.ui.invalidate('ui.render')
          } catch {
            // Нет uname — не macOS и не Linux; играем в панели
          }
        })
      }
      // Браузеры на Windows ищем в фоне: PowerShell стартует за полсекунды, сессию из-за него не держим
      if (S.platform === 'windows') {
        $.clock.after(100, async () => {
          try {
            const result = await $.process.run(DETECT_ARGV, { timeoutMs: LAUNCH_TIMEOUT_MS })
            S.detection = parseDetection(result.stdout)
          } catch (err) {
            S.detection = { browsers: [], defaultId: null, screen: null }
            log(`не удалось найти браузеры: ${err?.message ?? err}`)
          }
          $.ui.invalidate('ui.render')
        })
      }
      await $.command.register({ name: 'arcade', description: tr('Открыть Arcade', S.lang), immediate: true })
      // Блокнот — и инструмент Claude: читать, создавать страницы, дописывать и отмечать пункты
      await $.tool.register(NOTES_TOOL).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
      await $.command.register({
        name: 'arcade-add',
        description: tr('Arcade: добавить свою игру — файл ROM Денди или Sega', S.lang),
        argumentHint: tr('путь к файлу .nes, .md или .bin', S.lang),
        immediate: true,
      })
      // Раз в секунду: проверить порог вопроса и обновить счётчик секунд. Счётчик идёт, только пока агент работает;
      // в остальное время открытую панель перерисовываем раз в минуту — «5 мин назад» в чатах и подборках
      let quiet = 0
      $.clock.every(1000, async () => {
        const now = await $.clock.now()
        if (S.status === 'working' && S.askAfter > 0 && !S.asked && !S.paneOpen && now - S.turnStartedAt >= S.askAfter * 1000) {
          S.askVisible = true
        }
        quiet = S.paneOpen && S.status !== 'working' ? quiet + 1 : 0
        if (S.askVisible || (S.paneOpen && (quiet === 0 || quiet % 60 === 0))) $.ui.invalidate('ui.render')
      })
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    const started = await next(e)
    // Панель оставили открытой в другой сессии — открываем и здесь. Desktop и VS Code рисуют не со старта, а с session.attach
    if (e.surface && e.surface !== 'mobile') await followPane($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    return started
  })

  // Desktop или VS Code подключился к сессии: панель, оставленную открытой в другой сессии, открываем и здесь
  on('session.attach', async ($, e, next) => {
    const attached = await next(e)
    if (e.surface === 'desktop' || e.surface === 'vscode') await followPane($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    return attached
  })

  on('turn.start', async ($, e, next) => {
    if (e.agentId) return next(e) // ход субагента — не ход агента: Claude как работал, так и работает
    try {
      S.agentTurn = e.turnId
      S.toolsRunning = 0
      S.interrupting = false
      S.status = 'working'
      S.turnStartedAt = await $.clock.now()
      S.asked = false
      S.askVisible = false
      S.agentAlert = null
      S.paused = false
      log('агент начал ход')
      if (DEBUG) await $.ui.toast('arcade: агент начал ход')
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  on('classic.PermissionRequest', async ($, e, next) => {
    try {
      S.status = 'permission'
      S.askVisible = false
      if (S.paneOpen && S.view !== 'library') {
        S.agentAlert = 'permission'
        if (S.onPermission === 'pause') {
          S.paused = true
          releaseAll()
        }
        if (S.onPermission === 'close') await $.ui.close({ id: PANE })
      }
      log(`запрос разрешения: ${e.tool_name ?? 'инструмент'}`)
      const now = await $.clock.now()
      const command = S.osNotify && S.windowOpenedAt && now - S.windowOpenedAt < NOTIFY_WINDOW_MS
        ? notifyCommand(S.platform, 'Claude Code', tr('Агент ждёт разрешения', S.lang))
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
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  on('classic.PostToolUse', async ($, e, next) => {
    try {
      if (S.status === 'permission') {
        S.status = 'working'
        log('агент снова работает')
        $.ui.invalidate('ui.render')
      }
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId) return next(e) // субагент закончил — агент ещё нет: «агент закончил» не про него
    const turnId = S.agentTurn
    S.agentTurn = null
    S.toolsRunning = 0
    // Ход оборвал Arcade, чтобы открыть игру: агент сейчас же продолжит по просьбе Arcade
    if (S.interrupting) {
      S.interrupting = false
      return next(e)
    }
    // Ход с просьбой Arcade кончился: открыл Claude игру или нет, следующее нажатие просит заново
    S.asking = null
    try {
      // Игра ждала конца инструмента, а ход кончился сам — прерывать нечего, просим как обычно
      if (S.pendingOpen) {
        const url = S.pendingOpen
        S.pendingOpen = null
        desktopNotice($, await askClaude($, url, true), '', url)
      }
      S.status = 'done'
      S.askVisible = false
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
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return next(e)
  })

  // Сжатие контекста: пока Claude пишет сводку, прерывать ход бесполезно — он не обрывается, а просьбы Arcade копятся
  // в очереди. Игру, нажатую в это время, открываем, когда сжатие кончится. Сжатие у субагента и сводка заранее
  // (precompute: ничего не ставит, ход идёт дальше) — не то
  on('session.compact', async ($, e, next) => {
    if (e.agentId !== undefined || e.trigger === 'precompute') return next(e)
    S.compacting = true
    try {
      return await next(e)
    } finally {
      S.compacting = false
      if (S.pendingOpen) $.clock.after(0, () => openPending($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
    }
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      S.paneOpen = false
      S.agentAlert = null
      S.paused = false // закрытая панель и так стоит на паузе
      releaseAll() // Денди стоит на паузе, пока панель закрыта
      await paneClosedBy($, e.origin).catch((err) => log(`ошибка мода: ${err?.message ?? err}`))
    }
    return next(e)
  })

  // Встроенный браузер Desktop по нажатию в панели: свои вызовы Arcade разрешает сам, иначе авто-режим отдаёт их
  // классификатору, и тот отказывает — просил не человек словами. Только вызовы самого Arcade и только то, что
  // пропускает ownDesktopCall; эти же инструменты у Claude решаются как обычно. Разрешаем только то, о чём спросили бы
  // человека: правило в настройках (разрешить или запретить) отдаём как есть — встроенная защита Claude Code
  // (cc-plugin-sec-default, на Team и Enterprise) переписанное модом правило считает обходом и пишет об этом в чат
  on('tool.check', { tool: DESKTOP_TOOLS }, async ($, e, next) => {
    if (next.origin.plugin !== $.plugin.name || !ownDesktopCall(e.tool, e.input)) return next(e)
    const decided = await next(e)
    if (decided?.decision !== 'ask') return decided
    return { decision: 'allow', reason: 'Arcade открывает игру во встроенном браузере по нажатию в своей панели' }
  })

  // Инструмент блокнота меняет только блокнот Arcade и ничего не удаляет: разрешаем сам, если Claude Code спросил бы
  // человека. Правило в настройках (разрешить или запретить) отдаём как есть
  on('tool.check', { tool: NOTES_TOOL_NAME }, async ($, e, next) => {
    const decided = await next(e)
    if (decided?.decision !== 'ask') return decided
    return { decision: 'allow', reason: 'Блокнот Arcade: инструмент меняет только блокнот мода' }
  })
  // Вызов инструмента блокнота: поверх свежего блокнота из хранилища (его могли поправить в другой сессии), несохранённый
  // текст поля «Текст» сначала уходит в страницу — правка Claude ложится поверх. Ошибку (нет страницы, не помещается)
  // модель получает ошибкой — отказом с текстом
  on('tool.call', { tool: NOTES_TOOL_NAME }, async ($, e) => {
    const out = await notesTool($, e)
    return out.isError ? { deny: out.text } : { result: out.text }
  })

  // Инструменты агента (главного цикла; свои вызовы Arcade — нет): игру, которую надо открыть, пока агент работает,
  // открываем, когда закончится текущий — оборванный посреди инструмент может оставить работу недоделанной. Дольше
  // CUT_TOOL_MS не ждём: обрываем (cutPending)
  on('tool.call', async ($, e, next) => {
    if (e.agentId !== undefined || next.origin?.plugin === $.plugin.name) return next(e)
    S.toolsRunning++
    try {
      return await next(e)
    } finally {
      S.toolsRunning = Math.max(0, S.toolsRunning - 1)
      // Ход прерываем после того, как результат инструмента дойдёт до агента
      if (S.pendingOpen && S.toolsRunning === 0)
        $.clock.after(0, () => openPending($).catch((err) => log(`ошибка мода: ${err?.message ?? err}`)))
    }
  })

  // Игру, которую Arcade попросил открыть Claude, открыли — браузеру нужно место
  on('tool.call', { tool: [`${BROWSER}preview_start`, `${BROWSER}navigate`] }, async ($, e, next) => {
    const result = await next(e)
    try {
      if (S.opening && arcadeUrl(e.url) && !result?.deny && !result?.isError)
        await openedForArcade($, e)
    } catch (err) {
      log(`ошибка мода: ${err?.message ?? err}`)
    }
    return result
  })

  // Сообщения от экрана игры (hooks/input.js): нажатия и зажатые клавиши
  on('ui.message', async ($, e) => {
    if (e.element !== INPUT) return {}
    const { save, redraw } = readInput(e.data)
    if (redraw) $.ui.invalidate('ui.render')
    if (save) await saveSetting($, 'keys', S.keymap)
    if (S.flappyDirty) {
      S.flappyDirty = false
      await saveSetting($, 'flappyBest', S.flappyBest)
    }
    return {}
  })

  on('command.run', { command: 'arcade' }, async ($) => {
    await openPane($)
    $.ui.invalidate('ui.render')
    return {}
  })

  // /arcade-add путь: копия файла — в папку данных, запись — в «Мои игры». Файл никуда не отправляется.
  on('command.run', { command: 'arcade-add' }, async ($, e) => {
    const message = await addMine($, e.args)
    S.libraryNotice = message
    if (S.view !== 'library') toLibrary()
    S.menu = 'mine'
    await openPane($)
    $.ui.invalidate('ui.render')
    return {}
  })

  // Полоса над полем ввода: «1» — играть, «2» — не сейчас (цифра в пустом поле ввода и пауза).
  // Пока вопрос виден, полоса занята целиком: то, что рисуют там другие моды, скрыто.
  // Вопрос самого Claude Code (опрос, «включить моды?») важнее: пока он в полосе, «сыграть?» ждёт.
  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) =>
    translateTree(
      await (async () => {
    // VS Code: пока в панели идёт игра, клавиатура — в поле над строкой ввода. Саму панель VS Code
    // не делает фокусом, а поле в колонке чата получает клавиши. Что рисуют в полосе другие моды, остаётся ниже.
    if (!S.askVisible && e.surface === 'vscode' && S.paneOpen && nesView()) {
      const { Box, Input } = $.ui.resolve(e)
      S.bandId = e.requestId
      if (S.bandResetWanted) {
        // Значение меняется — VS Code перезаписывает поле, и набранное исчезает
        S.bandResetWanted = false
        S.bandToken = S.bandToken === '' ? '\u200b' : ''
        S.bandLength = S.bandToken.length
      }
      if (S.bandFocusWanted) {
        S.bandFocusWanted = false
        // Если полоса уже держит клавиатуру, ставим фокус в поле; если нет — VS Code откажет, и хватит одного клика
        $.clock.after(50, async () => {
          try {
            await $.ui.focus({ requestId: S.bandId, key: 'arcade-keys-band' })
          } catch {
            // отказ — обычное дело: клавиатуру отдаёт человек
          }
        })
      }
      const ours = Box({
        flexDirection: 'row',
        children: [
          Input({
            key: 'arcade-keys-band',
            label: '🎮',
            placeholder: 'кликни — и игра слушает клавиатуру: W A S D, K J, Enter',
            value: S.bandToken,
            autoFocus: true,
            onInput: async (value) => {
              const save = typedFrom(value)
              $.ui.invalidate('ui.render')
              if (save) await saveSetting($, 'keys', S.keymap)
              if (S.flappyDirty) {
                S.flappyDirty = false
                await saveSetting($, 'flappyBest', S.flappyBest)
              }
            },
            onSubmit: () => {
              pressStart()
              $.ui.invalidate('ui.render')
            },
          }),
        ],
      })
      const below = await next(e)
      return below ? Box({ flexDirection: 'column', children: [ours, below] }) : ours
    }
    // Строку выключили в настройках — здесь или на другом компьютере — она уходит сразу, не дожидаясь хода
    if (!S.askVisible || !S.askAfter || e.props.hasSurvey) return next(e)
    const { Box, Text, Button } = $.ui.resolve(e)
    const now = await $.clock.now()
    const canWindow = (S.platform !== null || e.surface === 'desktop') && webGame(S.lastGame)
    return Box({
      flexDirection: 'row',
      columnGap: 2,
      children: [
        Text({ children: [`Агент работает ${workedText(workedSeconds(now))} — сыграть?${S.netWaiting.length ? ` В сети ждут: ${waitingText()}` : ''}`] }),
        // «Здесь» — панель Claude Code: в VS Code и Desktop картинкой, в терминале символами или пикселями.
        // «В окне» — браузер: в Desktop по настройке встроенный, иначе — программа браузера, когда ОС уже определена.
        Button({
          key: 'arcade-play',
          label: canWindow ? 'Здесь' : 'Играть',
          hotkey: '1',
          plain: true,
          onPress: async () => {
            await openPane($)
            $.ui.invalidate('ui.render')
          },
        }),
        ...(canWindow
          ? [
              Button({
                key: 'arcade-play-window',
                label: 'В окне',
                hotkey: '2',
                plain: true,
                onPress: async () => {
                  S.asked = true
                  S.askVisible = false
                  if (builtinBrowser(e.surface, mouseGame(S.lastGame))) {
                    await desktopWindow($, S.lastGame, `${gameById(S.lastGame)?.title ?? S.lastGame} открыт во встроенном браузере Claude.`)
                    await $.ui.toast(tr(S.libraryNotice, S.lang))
                    return
                  }
                  const command = windowCommand(S.lastGame)
                  try {
                    const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                    windowNotice($, launchNotice(result, S.lastGame))
                    if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
                  } catch (err) {
                    S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                  }
                  $.ui.invalidate('ui.render')
                  await $.ui.toast(tr(S.libraryNotice, S.lang))
                },
              }),
            ]
          : []),
        Button({
          key: 'arcade-later',
          label: 'Не сейчас',
          hotkey: canWindow ? '3' : '2',
          plain: true,
          onPress: () => {
            S.asked = true
            S.askVisible = false
            $.ui.invalidate('ui.render')
          },
        }),
      ],
    })
      })(),
      S.lang,
    ),
  )

  // Панель: библиотека игр или сама игра. Клавиши над экраном игры ловит Client (hooks/input.js)
  // после клика по экрану, в любой раскладке.
  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== PANE) return translateTree(await next(e), S.lang)
    const tree = await drawPane($, e)
    // Игру открыли в панели — заводим игровой цикл; когда игру закроют, он снимется сам
    runGameLoop($)
    return translateTree(tree, S.lang)
  })
}
