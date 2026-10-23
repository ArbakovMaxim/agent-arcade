// Пауза Arcade для OpenArena (ioquake3). Окно Arcade (web/boot.js, freeze) останавливает игру в рамке, когда уходит
// из фокуса, но модуль ioquake3 собран как ES6 и снаружи его главный цикл не виден. Поэтому страница сама даёт окну
// arcadePause(): пока игра не запущена — null, иначе держит кадры, часы и звук и возвращает «продолжить».
// - Кадры: главный цикл Emscripten просит каждый кадр через requestAnimationFrame — на паузе просьбы ждут.
// - Часы: Date.now и performance.now стоят на паузе и потом идут без её времени. Иначе сервер игры догнал бы
//   пропущенное (до 5 секунд за кадр) и боты успели бы сыграть это время без игрока.
// - Звук: каждый AudioContext страницы, его создаёт звук игры (OpenAL или SDL).
// Подключается до скриптов игры
;(function () {
  'use strict'
  const contexts = []
  const Original = window.AudioContext || window.webkitAudioContext
  if (Original) {
    class Tracked extends Original {
      constructor(...args) {
        super(...args)
        contexts.push(this)
      }
    }
    window.AudioContext = Tracked
    if (window.webkitAudioContext) window.webkitAudioContext = Tracked
  }

  const perfNow = performance.now.bind(performance)
  const dateNow = Date.now
  let shift = 0 // сколько миллисекунд простояли прошлые паузы
  let stopped = null // { perf, date } — когда началась текущая пауза
  performance.now = () => (stopped ? stopped.perf : perfNow()) - shift
  Date.now = () => (stopped ? stopped.date : dateNow()) - shift

  const raf = window.requestAnimationFrame.bind(window)
  let held = null // кадры, которые попросили на паузе
  window.requestAnimationFrame = (callback) => {
    if (!held) return raf(callback)
    held.push(callback)
    return 0
  }

  window.arcadePause = function () {
    // arcadeQuake страница заводит, когда движок запущен (arcade-start.js)
    if (!window.arcadeQuake || stopped) return null
    stopped = { perf: perfNow(), date: dateNow() }
    held = []
    const playing = contexts.filter((c) => c.state === 'running')
    for (const c of playing) c.suspend()
    if (window.arcadeQuake.save) window.arcadeQuake.save()
    return () => {
      shift += perfNow() - stopped.perf
      stopped = null
      for (const c of playing) c.resume()
      const frames = held
      held = null
      for (const callback of frames) raf(callback)
    }
  }
})()
