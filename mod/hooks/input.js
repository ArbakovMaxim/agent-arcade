// Экран игры ловит клавиши и сообщает моду, что сейчас зажато и сколько раз что нажималось.
// Клавиши сюда приходят после клика по экрану; Esc возвращает их полю ввода Claude Code.
// Пока клика не было, поверх экрана видна подсказка.
//
// Терминал сообщает нажатия, но не отпускания. Клавиша считается зажатой, пока идёт её автоповтор:
// после первого нажатия — HOLD_AFTER_PRESS_MS (первый повтор приходит поздно), между повторами — коротко.
// Если удержание дёргается, уменьши в системе задержку перед повтором клавиш.

const HOLD_AFTER_PRESS_MS = 260
const HOLD_WHILE_REPEATING_MS = 120
const POST_EVERY_MS = 30

export default function GameInput(props, surface) {
  let input = surface.state
  if (input === undefined) {
    input = {
      clock: 0, // своё время в мс: растёт на POST_EVERY_MS с каждым тиком кадровых часов
      presses: new Map(), // клавиша → { at, isRepeating }
      counts: {}, // клавиша → сколько раз нажата; мод сравнивает с прошлым сообщением
      posted: '',
      active: false, // по экрану кликнули, клавиши идут сюда
    }
    const state = input

    const activate = () => {
      if (state.active) return
      state.active = true
      surface.setState(state)
    }

    surface.onPointer((e) => {
      if (e.type === 'down') activate()
    })

    surface.onKey((e) => {
      if (e.ctrl || e.meta) return
      activate()
      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      const now = state.clock
      const last = state.presses.get(key)
      state.presses.set(key, { at: now, isRepeating: !!last && now - last.at < HOLD_AFTER_PRESS_MS })
      state.counts[key] = (state.counts[key] ?? 0) + 1
    })

    // Сообщение уходит, только когда что-то изменилось; счётчики не теряются, даже если сообщение пропало
    surface.every(POST_EVERY_MS, () => {
      state.clock += POST_EVERY_MS
      const now = state.clock
      const held = []
      for (const [key, press] of state.presses) {
        const holdMs = press.isRepeating ? HOLD_WHILE_REPEATING_MS : HOLD_AFTER_PRESS_MS
        if (now - press.at < holdMs) held.push(key)
        else state.presses.delete(key)
      }
      held.sort()
      const data = { held, counts: { ...state.counts } }
      const line = JSON.stringify(data)
      if (line === state.posted) return
      state.posted = line
      surface.post(data)
    })

    surface.setState(input)
  }

  // Панель потеряла фокус (Esc) — клавиши снова у Claude Code, нужен новый клик
  if (props?.focused === false) input.active = false

  const { Box, Text } = surface.elements
  if (input.active) return Box({ width: '100%', height: '100%' })
  return Box({
    width: '100%',
    height: '100%',
    children: [Text({ bold: true, inverse: true, children: [' Кликни сюда, чтобы играть '] })],
  })
}
