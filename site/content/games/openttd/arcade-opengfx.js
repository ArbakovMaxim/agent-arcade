// Arcade: графика OpenGFX — с сайта Arcade, до старта игры. OpenTTD находит её в /baseset и не запускает
// «первичную загрузку» графики с openttd.org. Сборка сайта вставляет этот скрипт в openttd.html перед openttd.js:
// Module к этому моменту уже объявлен, а preRun выполнится до запуска игры.
Module.preRun.push(function () {
  Module.addRunDependency('arcade-opengfx')
  fetch('baseset/opengfx-8.0.tar')
    .then(function (response) {
      if (!response.ok) throw new Error('сервер ответил ' + response.status)
      return response.arrayBuffer()
    })
    .then(function (data) {
      Module.FS_createPath('/', 'baseset', true, true)
      Module.FS_createDataFile('/baseset', 'opengfx-8.0.tar', new Uint8Array(data), true, true, true)
    })
    .catch(function (err) {
      console.error('Arcade: графика OpenGFX не загрузилась —', err)
    })
    .finally(function () {
      Module.removeRunDependency('arcade-opengfx')
    })
})
