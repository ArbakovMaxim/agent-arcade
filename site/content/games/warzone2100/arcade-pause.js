// Пауза Arcade для Warzone 2100. Окно Arcade (web/boot.js, freeze) останавливает игру в рамке, когда уходит из
// фокуса, но снаружи эту сборку не остановить: у нового Emscripten главный цикл (MainLoop) спрятан в модуле, звук —
// OpenAL там же. Поэтому страница сама даёт окну arcadePause(): пока игра не идёт — null, иначе останавливает главный
// цикл и звук и возвращает «продолжить». Сборка сайта вставляет этот файл в index.html до скриптов игры
;(function () {
  'use strict'
  const contexts = []
  const Original = window.AudioContext || window.webkitAudioContext
  if (Original) {
    // Запоминаем каждый AudioContext страницы: свой OpenAL создаёт, когда игра открывает звук
    class Tracked extends Original {
      constructor(...args) {
        super(...args)
        contexts.push(this)
      }
    }
    window.AudioContext = Tracked
    if (window.webkitAudioContext) window.webkitAudioContext = Tracked
  }
  window.arcadePause = function () {
    // LaunchedModule страница WZ заводит, когда модуль запущен. Его wzEncounteredPostRun — не выход из игры: main()
    // вернулся, а главный цикл идёт, так модуль и выглядит всю игру
    const m = window.LaunchedModule
    if (!m || !m.calledRun || !m.pauseMainLoop) return null
    m.pauseMainLoop()
    const playing = contexts.filter((c) => c.state === 'running')
    for (const c of playing) c.suspend()
    return () => {
      for (const c of playing) c.resume()
      m.resumeMainLoop()
    }
  }
})()
