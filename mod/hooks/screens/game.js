// Arcade: экран игры в панели — Денди, Flappy или проверка клавиш.
import { frameToSvg, screenSize } from '../nes-screen.js'
import { ACTIONS, COLS, HOLD_TICKS_FIRST, HOLD_TICKS_REPEAT, INPUT, MAX_IMAGE_COLUMNS, MAX_SYMBOL_COLUMNS, PANE, REMOTE_MAX_WIDTH, REMOTE_MAX_WIDTH_WIDE, ROWS, S } from '../app/state.js'
import { cellsOf, fieldRows, first, flappyLine, freeRows, pixelMode, screenContent, toLibrary } from '../app/play.js'

export function gameScreen($, e, kit) {
  const { Box, Button, Client, Image, Raster, Svg, Text, eventLines, game, header, terminal } = kit
  const libraryButton = Button({
    key: 'arcade-library',
    label: 'Библиотека',
    onPress: () => {
      toLibrary()
      $.ui.invalidate('ui.render')
    },
  })
  const moves = `${first('up')} ${first('left')} ${first('down')} ${first('right')} или стрелки`
  const legend =
    game.engine === 'flappy'
      ? `взмах — любая кнопка: ${first('up')}, ${first('a')} или ${first('b')}`
      : game.id === 'thwaite'
      ? `прицел ${moves} · огонь ${first('b')} ${first('a')} · Start ${first('start')}`
      : `движение ${moves} · A ${first('a')} · B ${first('b')} · Start ${first('start')}`
  // Назначение клавиш или сообщение мода; иначе — подсказка для этой поверхности
  const message = S.paused
    ? Text({
        color: 'warning',
        children: [`Пауза: ${S.agentAlert === 'permission' ? 'агент ждёт разрешения' : 'агент закончил'}. Любая клавиша игры — играть дальше, Esc — к агенту`],
      })
    : S.mode === 'assign'
      ? Text({ color: 'warning', children: [`${S.notice} Нажми клавишу для «${ACTIONS[S.assignStep].label}» (${S.assignStep + 1} из ${ACTIONS.length})`] })
      : S.notice
        ? Text({ color: 'warning', children: [S.notice] })
        : game.engine === 'flappy'
          ? Text({ color: S.nes?.state === 'over' ? 'warning' : 'success', children: [flappyLine()] })
          : null

  // Desktop и VS Code: кадр Денди — PNG внутри Svg, панель перерисовывается каждый шаг игры
  if (!terminal) {
    if (!game.rom && !game.engine) {
      return Box({
        flexDirection: 'column',
        children: [header, Text({ children: ['Проверка клавиш работает только в терминале.'] }), libraryButton],
      })
    }
    // Во всю ширину картинка крупнее, но целиком помещается и по высоте панели
    const byWidth = Math.floor(((e.props.bodyColumns ?? 60) * 7.5) / 256)
    const byHeight = S.wide ? Math.floor(((e.props.scroll?.bodyRows ?? 30) * 17) / 240) : Infinity
    const scale = Math.max(1, Math.min((S.wide ? REMOTE_MAX_WIDTH_WIDE : REMOTE_MAX_WIDTH) / 256, byWidth, byHeight))
    const width = 256 * scale
    const height = 240 * scale
    const picture = Svg({ source: frameToSvg(S.frame, width, height), alt: game.title, width, height })
    // Агент закончил или ждёт разрешения, пока идёт игра: яркая плашка над экраном — её видно и во всю ширину
    const alertBar = S.agentAlert
      ? Box({
          flexDirection: 'row',
          columnGap: 2,
          children: [
            Text({
              bold: true,
              color: 'black',
              backgroundColor: S.agentAlert === 'permission' ? 'yellow' : 'green',
              children: [`${S.agentAlert === 'permission' ? ' Агент ждёт разрешения ' : ' Агент закончил '}${S.paused ? '· пауза ' : ''}`],
            }),
            Button({ key: 'arcade-to-agent', label: 'К агенту', onPress: async () => { await $.ui.close({ id: PANE }) } }),
            Button({
              key: 'arcade-alert-ok',
              label: 'Играть дальше',
              onPress: () => {
                S.agentAlert = null
                S.paused = false
                $.ui.invalidate('ui.render')
              },
            }),
          ],
        })
      : null
    // В Desktop клавиши ловит Client поверх экрана, как в терминале; в VS Code его пока нет
    if (e.surface === 'desktop') {
      return Box({
        flexDirection: 'column',
        children: [
          header,
          ...(alertBar ? [alertBar] : []),
          message ?? Text({ dimColor: true, children: ['Кликни по экрану — играть · Esc — к агенту · Backspace — библиотека'] }),
          Box({
            children: [
              picture,
              Box({
                position: 'absolute',
                top: 0,
                left: 0,
                children: [Client({ key: INPUT, module: '../input.js', props: { focused: e.props.isFocused }, width: '100%', height: '100%' })],
              }),
            ],
          }),
          Text({ dimColor: true, children: [legend] }),
          libraryButton,
        ],
      })
    }
    // В VS Code Client пока нет. Клавиши — горячие клавиши экранных кнопок: они работают, пока панель в фокусе.
    // Поле ввода не годится: панель перерисовывается 30 раз в секунду, и поле каждый раз сбрасывается.
    // Зажатая клавиша повторяет нажатия — кнопка держится, пока идут повторы, и не отпускается между ними.
    const pad = (id, label, hotkey) =>
      Button({
        key: `arcade-pad-${id}`,
        label,
        hotkey,
        onPress: () => {
          if (!S.holdTicks[id]) S.taps.add(id)
          S.holdTicks[id] = S.holdTicks[id] ? HOLD_TICKS_REPEAT : HOLD_TICKS_FIRST
          $.ui.invalidate('ui.render')
        },
      })
    return Box({
      flexDirection: 'column',
      children: [
        header,
        ...(alertBar ? [alertBar] : []),
        message ?? Text({ dimColor: true, children: ['Клавиатура — в строке 🎮 над строкой ввода Claude · кнопки — мышью'] }),
        picture,
        Box({
          flexDirection: 'row',
          columnGap: 1,
          children: [
            pad('left', '← (A)', 'a'),
            pad('up', '↑ (W)', 'w'),
            pad('down', '↓ (S)', 's'),
            pad('right', '→ (D)', 'd'),
            pad('b', 'B (J)', 'j'),
            pad('a', 'A (K)', 'k'),
            pad('start', 'Start (N)', 'n'),
            pad('select', 'Select (M)', 'm'),
          ],
        }),
        Text({ dimColor: true, children: ['W A S D — движение · K — A · J — B · Enter или N — Start · M — Select · русская раскладка тоже подходит'] }),
        libraryButton,
      ],
    })
  }

  // Терминал: подсказка, или назначение клавиш, или сообщение мода
  const line = message ?? Text({ dimColor: true, children: ['Кликни по экрану — играть · Esc — к агенту · Backspace — библиотека'] })

  // Экран игры и Client поверх него: клики и клавиши над экраном попадают в hooks/input.js.
  // Других кнопок в игре нет, чтобы клавиатуру у экрана ничто не перехватывало.
  const withInput = (picture, columns, rows) =>
    Box({
      children: [
        picture,
        Box({
          position: 'absolute',
          top: 0,
          left: 0,
          children: [Client({ key: INPUT, module: '../input.js', props: { focused: e.props.isFocused }, width: columns, height: rows })],
        }),
      ],
    })

  if (game.rom || game.engine) {
    const pixels = pixelMode()
    S.screen = screenSize(e.props.bodyColumns ?? 60, freeRows(e.props), pixels ? MAX_IMAGE_COLUMNS : MAX_SYMBOL_COLUMNS)
    const content = screenContent()
    const picture = pixels
      ? Image({ key: 'arcade-screen', columns: S.screen.columns, rows: S.screen.rows, alt: `${game.title} — этот терминал не показывает картинки`, ...content })
      : Raster({ key: 'arcade-screen', columns: S.screen.columns, rows: S.screen.rows, ...content })
    return Box({
      flexDirection: 'column',
      children: [header, line, withInput(picture, S.screen.columns, S.screen.rows), Text({ dimColor: true, children: [legend] })],
    })
  }

  return Box({
    flexDirection: 'column',
    children: [
      header,
      line,
      withInput(Raster({ key: 'arcade-field', columns: COLS, rows: ROWS, cells: cellsOf(fieldRows()) }), COLS, ROWS),
      Text({ dimColor: true, children: [`Нажатия: ${S.pressed.join(' ') || '—'}`] }),
      Text({ dimColor: true, children: [`Зажато: ${S.heldKeys.join(' ') || '—'}`] }),
      Text({ dimColor: true, children: [`Клавиши: ${ACTIONS.map((a) => `${a.label} ${S.keymap[a.id].join(' ')}`).join(' · ')}`] }),
      Text({ dimColor: true, children: ['Назначить заново: «Настройки» → «Назначить клавиши заново»'] }),
      Text({ children: [' '] }),
      ...eventLines,
    ],
  })
}
