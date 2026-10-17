// Загрузчик окна Arcade: берёт каталог с сервера и открывает библиотеку или игру из адреса (?game=…)
;(async function () {
  'use strict'
  const id = new URLSearchParams(location.search).get('game')
  let catalog
  try {
    const response = await fetch('catalog.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(`сервер ответил ${response.status}`)
    catalog = await response.json()
  } catch (err) {
    document.getElementById('overlay-title').textContent = 'Нет связи с Arcade'
    document.getElementById('overlay-hint').textContent = `Не удалось получить список игр: ${err.message}`
    document.getElementById('overlay').classList.add('shown')
    return
  }
  if (id && catalog.games && catalog.games[id] && catalog.games[id].console === 'sega') {
    // Игры Sega идут в EmulatorJS: его обвязка подгружается, только когда нужна
    const script = document.createElement('script')
    script.src = 'sega.js'
    script.onload = () => window.ArcadeSega.start(catalog, id)
    document.body.appendChild(script)
  } else if (id) window.ArcadeGame.start(catalog, id)
  else window.ArcadeLibrary.start(catalog)
})()
