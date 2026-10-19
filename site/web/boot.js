// Загрузчик окна Arcade: берёт каталог с сервера и открывает библиотеку, игру (?game=…) или свою игру (#mine=…).
// Своя игра — в части адреса после #: браузер не отправляет её на сервер, поэтому хеш и название файла
// не попадают в запросы и логи.
// Денди идёт в JSNES (game.js), Sega и PlayStation — в EmulatorJS (ejs.js, подгружается, только когда нужен).
;(async function () {
  'use strict'
  // Статичные надписи страницы — на языке окна
  for (const id of ['to-library', 'license', 'source', 'restart']) {
    const node = document.getElementById(id)
    if (node) node.textContent = T(node.textContent)
  }
  const params = new URLSearchParams(location.search)
  const id = params.get('game')
  const local = new URLSearchParams(location.hash.slice(1))
  const mineId = local.get('mine')
  // Переход на другую свою игру меняет только часть после # — страницу надо открыть заново
  window.addEventListener('hashchange', () => location.reload())

  const overlay = (title, hint) => {
    document.getElementById('overlay-title').textContent = title
    document.getElementById('overlay-hint').textContent = hint
    document.getElementById('overlay').classList.add('shown')
  }
  const loadEJS = () =>
    new Promise((resolve) => {
      if (window.ArcadeEJS) return resolve()
      const script = document.createElement('script')
      script.src = 'ejs.js'
      script.onload = resolve
      document.body.appendChild(script)
    })

  // Своя игра: Денди — в JSNES, остальное — в EmulatorJS
  async function play(entry) {
    if (entry.console === 'nes') return window.ArcadeGame.startLocal(new Uint8Array(await entry.file.arrayBuffer()), entry.title)
    await loadEJS()
    window.ArcadeEJS.startLocal(entry)
  }
  window.ArcadePlayMine = play

  // Мод просит свою игру, которой в этом браузере ещё нет: человек один раз выбирает файл, хеш сверяется
  function askForFile(consoleId, sha, title) {
    const input = document.getElementById('local-rom')
    input.accept = window.ArcadeMine.ACCEPT[consoleId] || ''
    overlay(T(`Выбери файл «${title}»`), T('Кликни сюда или нажми любую клавишу. Это нужно один раз: браузер запомнит файл у себя, на сервер он не уходит.'))
    const pick = () => input.click()
    document.getElementById('overlay').addEventListener('click', pick)
    window.addEventListener('keydown', pick, { once: true })
    input.addEventListener('change', async () => {
      const file = input.files && input.files[0]
      input.value = ''
      if (!file) return
      try {
        const entry = await window.ArcadeMine.add(file, consoleId, sha)
        history.replaceState(null, '', `#mine=${encodeURIComponent(entry.id)}`)
        document.getElementById('overlay').classList.remove('shown')
        await play(entry)
      } catch (err) {
        overlay(T('Не получилось'), T(`${err.message} Кликни, чтобы выбрать другой файл.`))
      }
    })
  }

  let catalog
  try {
    const response = await fetch('catalog.json', { cache: 'no-cache' })
    if (!response.ok) throw new Error(T(`сервер ответил ${response.status}`))
    catalog = await response.json()
  } catch (err) {
    overlay(T('Нет связи с Arcade'), T(`Не удалось получить список игр: ${err.message}`))
    return
  }

  if (mineId) {
    const entry = await window.ArcadeMine.get(mineId)
    if (entry) await play(entry)
    else if (local.get('console') && local.get('sha')) askForFile(local.get('console'), local.get('sha'), local.get('title') || T('свою игру'))
    else overlay(T('Игра не найдена'), T('В этом браузере её нет. Вернись в библиотеку и открой файл заново.'))
  } else if (id && catalog.games && catalog.games[id] && ['sega', 'sms', 'psx', 'doom'].includes(catalog.games[id].console)) {
    await loadEJS()
    window.ArcadeEJS.start(catalog, id)
  } else if (id) window.ArcadeGame.start(catalog, id)
  else window.ArcadeLibrary.start(catalog, params.get('tab'))
})()
