// Arcade: экраны языка и настроек.
import { LANGS, LANG_NAMES } from '../i18n.js'
import { SITE } from '../catalog.js'
import { openUrlCommand } from '../browsers.js'
import { FIELD, GRAPHICS, HIDEABLE, LAUNCH_TIMEOUT_MS, PANE, PANE_ROWS, S, SIGNAL_LABELS, SIGNAL_MODES } from '../app/state.js'
import { paneColumns } from '../app/status.js'
import { graphicsLabel, launch, startAssign } from '../app/play.js'
import { MOUSE_NOTE, builtinBrowser, desktopLabel, desktopOptions, openerLabel, openerOptions, windowMode } from '../app/window.js'
import { followBookLang } from '../app/read.js'
import { saveSetting } from '../app/profile.js'

// Выбор языка: плитки, как остальное меню, в Desktop — с флажком; каждый язык подписан на самом себе, текущий
// отмечен
export function langScreen($, e, kit) {
  const { Button, gap, hint, open, tiles } = kit
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open(S.langReturn) }),
    gap,
    tiles(
      LANGS.map((code) =>
        Button({
          key: `arcade-lang-${code}`,
          label: `${LANG_NAMES[code]}${code === S.lang ? ' ✓' : ''}`,
          ...(code === S.lang ? { autoFocus: true } : {}),
          onPress: async () => {
            S.lang = code
            S.menu = S.langReturn
            $.ui.invalidate('ui.render')
            await saveSetting($, 'lang', S.lang)
            await followBookLang($)
          },
        }),
      ),
      22,
    ),
    ...hint,
  ]
}

// Условия использования и политика конфиденциальности — страницы сайта в браузере по умолчанию; браузер не открылся
// (или его не открыть, как в VS Code без системы) — адрес строкой под настройками
export async function openLegal($, page) {
  const url = `${SITE}/${page}`
  const command = S.platform ? openUrlCommand(S.platform, url) : null
  let opened = false
  if (command) {
    try {
      opened = (await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS }))?.exitCode === 0
    } catch {
      // не открылся — покажем адрес
    }
  }
  S.libraryNotice = opened ? 'Страница открыта в браузере.' : url
  $.ui.invalidate('ui.render')
}

export function settingsScreen($, e, kit) {
  const { Button, back, dim, gameButton, gap, hint, noticeLines, open, section, sectionSwitches, tiles } = kit
  const field = FIELD
  // Настройки — плитками по группам, как главное меню. Фокус — на первой плитке, а вернулись с выбора языка — на «Язык»
  const focusKey = S.menuFrom === 'lang' || S.menuFrom === 'settings' ? 'arcade-lang' : `arcade-show-${HIDEABLE[0]}`
  const focus = (key) => (key === focusKey ? { autoFocus: true } : {})
  const group = (title, list, after = []) => (list.length ? [section(title), tiles(list, 40), ...after] : [])
  const sectionTiles = sectionSwitches(focus)
  // Desktop: встроенный браузер приложения или окно браузера; Денди там всегда в панели, графика — картинкой
  const openTiles = [
    ...(e.surface === 'desktop' && S.platform
      ? [
          Button({
            key: 'arcade-opener',
            label: desktopLabel(),
            onPress: async () => {
              const options = desktopOptions()
              const current = options.findIndex((o) =>
                builtinBrowser(e.surface) ? o.opener === 'builtin' : o.opener === 'window' && o.browser === S.browserChoice,
              )
              const nextOption = options[(current + 1) % options.length]
              S.desktopOpener = nextOption.opener
              S.browserChoice = nextOption.browser
              S.libraryNotice = ''
              $.ui.invalidate('ui.render')
              await $.store.set('desktopOpener', S.desktopOpener)
              await $.store.set('opener', { opener: S.opener, browser: S.browserChoice })
            },
          }),
          dim(
            builtinBrowser(e.surface)
              ? '  рядом с разговором; в авто-режиме игру открывает Claude — он прервётся и вернётся к работе'
              : '  игра откроется в браузере; пауза, пока окно не в фокусе; прогресс сохраняется',
          ),
        ]
      : []),
    // Desktop сам ставит встроенный браузер под панель Arcade: рядом их не поставить, поэтому — закрыть или оставить
    ...(builtinBrowser(e.surface)
      ? [
          Button({
            key: 'arcade-keep-menu',
            label: `Когда открывается браузер: ${S.keepMenu ? 'оставлять меню' : 'закрывать меню'}`,
            onPress: async () => {
              S.keepMenu = !S.keepMenu
              $.ui.invalidate('ui.render')
              await saveSetting($, 'keepMenu', S.keepMenu)
            },
          }),
          dim('  закрывать — браузер во всю высоту; оставлять — браузер встаёт под меню Arcade'),
          Button({
            key: 'arcade-back-on-done',
            label: `Агент закончил, пока смотришь: ${S.backOnDone ? 'закрыть вкладку' : 'только сообщить'}`,
            onPress: async () => {
              S.backOnDone = !S.backOnDone
              S.watchTab = null
              $.ui.invalidate('ui.render')
              await saveSetting($, 'backOnDone', S.backOnDone)
            },
          }),
          dim('  видео, TikTok, Twitch, статьи и подкасты; закрыть — вкладка закрывается, и перед тобой снова разговор с Claude'),
        ]
      : []),
    ...(e.surface !== 'desktop' && S.platform
      ? [
          Button({
            key: 'arcade-opener',
            label: openerLabel(),
            onPress: async () => {
              const options = openerOptions()
              const current = options.findIndex((o) =>
                windowMode() ? o.opener === 'window' && o.browser === S.browserChoice : o.opener === 'pane',
              )
              const nextOption = options[(current + 1) % options.length]
              S.opener = nextOption.opener
              S.browserChoice = nextOption.browser
              S.libraryNotice = ''
              $.ui.invalidate('ui.render')
              await $.store.set('opener', { opener: S.opener, browser: S.browserChoice })
            },
          }),
          dim(
            !windowMode()
              ? '  символы или пиксели — зависит от терминала'
              : S.platform === 'windows'
                ? '  окно встаёт справа от терминала; пауза, пока оно не в фокусе; прогресс сохраняется'
                : '  игра откроется в браузере; пауза, пока окно не в фокусе; прогресс сохраняется',
          ),
        ]
      : []),
    ...(windowMode() || e.surface === 'desktop'
      ? []
      : [
          Button({
            key: 'arcade-graphics',
            label: graphicsLabel(),
            onPress: async () => {
              S.graphics = GRAPHICS[(GRAPHICS.indexOf(S.graphics) + 1) % GRAPHICS.length]
              S.pixelsFailed = false // «авто» заново проверит, умеет ли терминал картинки
              S.denies = 0
              $.ui.invalidate('ui.render')
              await $.store.set('graphics', S.graphics)
            },
          }),
          dim('  пиксели — в терминалах с картинками (kitty, Ghostty, Rio), символы — везде'),
        ]),
  ]
  const paneTiles = [
    Button({
      key: 'arcade-lang',
      label: `Язык: ${LANG_NAMES[S.lang] ?? S.lang}`,
      ...focus('arcade-lang'),
      onPress: () => {
        S.langReturn = 'settings'
        open('lang')()
      },
    }),
    dim('  язык интерфейса — 13 на выбор'),
    Button({
      key: 'arcade-wide',
      label: `Размер панели: ${S.wide ? 'во всю ширину' : 'обычный'}`,
      onPress: async () => {
        S.wide = !S.wide
        $.ui.invalidate('ui.render')
        await saveSetting($, 'wide', S.wide)
        // Панель уже открыта — просим новую ширину сразу
        await $.ui.open({ id: PANE, title: 'Arcade', focus: true, closeOnEscape: true, columns: paneColumns(), rows: PANE_ROWS })
      },
    }),
    dim('  во всю ширину разговор с агентом сжимается в узкую полосу; поправить ширину можно мышью'),
  ]
  // Сигналы агента: у каждой плитки своё описание — плитка берёт только описание сразу под кнопкой
  const signalNote = '  для игры в панели Claude; в окне браузера — системное уведомление'
  const notifyTiles = [
    Button({
      key: 'arcade-on-done',
      label: `Когда агент закончил: ${SIGNAL_LABELS[S.onDone]}`,
      onPress: async () => {
        S.onDone = SIGNAL_MODES[(SIGNAL_MODES.indexOf(S.onDone) + 1) % SIGNAL_MODES.length]
        $.ui.invalidate('ui.render')
        await saveSetting($, 'onDone', S.onDone)
      },
    }),
    dim(signalNote),
    Button({
      key: 'arcade-on-permission',
      label: `Когда агент ждёт разрешения: ${SIGNAL_LABELS[S.onPermission]}`,
      onPress: async () => {
        S.onPermission = SIGNAL_MODES[(SIGNAL_MODES.indexOf(S.onPermission) + 1) % SIGNAL_MODES.length]
        $.ui.invalidate('ui.render')
        await saveSetting($, 'onPermission', S.onPermission)
      },
    }),
    dim(signalNote),
    ...(S.platform
      ? [
          Button({
            key: 'arcade-notify',
            label: `Уведомления, пока играешь в окне: ${S.osNotify ? 'да' : 'нет'}`,
            onPress: async () => {
              S.osNotify = !S.osNotify
              $.ui.invalidate('ui.render')
              await saveSetting($, 'notify', S.osNotify)
            },
          }),
          dim('  системное уведомление со звуком, когда агент закончил или ждёт разрешения'),
          Button({
            key: 'arcade-msg-notify',
            label: `Уведомления о сообщениях: ${S.msgNotify ? 'да' : 'нет'}`,
            onPress: async () => {
              S.msgNotify = !S.msgNotify
              $.ui.invalidate('ui.render')
              await $.store.set('msgNotify', S.msgNotify)
            },
          }),
          dim(S.platform === 'windows' ? '  всплывают внизу слева поверх всех окон; клик открывает чат' : '  системное уведомление, когда друг пишет в чат'),
        ]
      : []),
  ]
  // Проверка и назначение клавиш — только в терминале: в VS Code клавиши идут через строку 🎮, в Desktop поля нет
  const keyTiles =
    e.surface === 'terminal'
      ? [
          gameButton(field, false),
          dim(`  ${field.note}`),
          Button({
            key: 'arcade-assign',
            label: 'Назначить клавиши заново',
            onPress: () => {
              launch('field')
              startAssign('Назначаем управление заново.')
              $.ui.invalidate('ui.render')
            },
          }),
          dim('  мод попросит нажать клавиши по очереди: вверх, вниз, влево, вправо, A, B, Start, Select'),
        ]
      : []
  // Правила сайта Arcade — в самом конце настроек, чтобы не мешали; их требуют правила YouTube API Services
  const legalTiles = [
    Button({ key: 'arcade-terms', label: 'Условия использования', onPress: () => openLegal($, 'terms') }),
    dim('  правила Arcade и условия YouTube'),
    Button({ key: 'arcade-privacy', label: 'Политика конфиденциальности', onPress: () => openLegal($, 'privacy') }),
    dim('  что хранит сайт Arcade, сколько и как это удалить'),
  ]
  return [
    back,
    ...group('Разделы главного меню', sectionTiles),
    dim('Убранного раздела нет в главном меню совсем; «Ещё» с настройками остаётся всегда.'),
    // Подсказка про мышь — строкой под плитками: у плитки одно описание
    ...group('Где открывать', openTiles, builtinBrowser(e.surface) ? [gap, dim(MOUSE_NOTE)] : []),
    ...group('Панель и язык', paneTiles),
    ...group('Уведомления', notifyTiles),
    ...group('Клавиши', keyTiles),
    ...group('Условия и конфиденциальность', legalTiles),
    ...noticeLines,
    ...hint,
  ]
}
