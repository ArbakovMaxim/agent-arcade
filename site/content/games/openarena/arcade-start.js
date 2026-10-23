// Запуск OpenArena в окне Arcade. Движок — ioquake3, собранный для браузера в Actions (engine/,
// .github/workflows/ioquake3-wasm.yml); данные — pk3 из архива OpenArena 0.8.8, его скачивает сборка сайта
// (download в каталоге), большие pk3 лежат кусками и склеиваются на лету (arcade-parts.js).
// Порядок как у страницы самого ioquake3 (code/web/client.html.in): скачать pk3 с полосой загрузки, положить
// в файловую систему движка до старта и запустить с com_basegame baseoa. Сеть движку не нужна — только боты.
// Настройки и профиль игрока — в IndexedDB браузера (IDBFS на домашней папке): сохраняются раз в минуту,
// на паузе Arcade (arcade-pause.js) и при уходе со страницы

const DATA = 'openarena-0.8.8/baseoa/'
// pk3 и их размеры в байтах (архив openarena-0.8.8.zip). Порядок — как у движка: он читает pk3 по алфавиту,
// поздние перекрывают ранние. pak2-players-mature и missionpack сборка пропускает (skip в каталоге)
const PAKS = [
  ['pak0.pk3', 38138505],
  ['pak1-maps.pk3', 38421794],
  ['pak2-players.pk3', 74389371],
  ['pak4-textures.pk3', 97077243],
  ['pak5-TA.pk3', 2907315],
  ['pak6-misc.pk3', 24912892],
  ['pak6-patch085.pk3', 36972040],
  ['pak6-patch088.pk3', 70645224],
]

const HOME = '/home/web_user'
const loading = document.getElementById('loading')
const status = document.getElementById('status')
const bar = document.querySelector('#bar > div')
const mb = (bytes) => Math.round(bytes / 1048576)

// Движок (SDL) пишет в заголовок страницы своё «ioquake3» — при старте и на каждом vid_restart. Возвращаем
// имя из <title>, как только его сменили, чтобы вкладка и окно Arcade звались OpenArena
const TITLE = document.title
new MutationObserver(() => {
  if (document.title !== TITLE) document.title = TITLE
}).observe(document.querySelector('title'), { childList: true, characterData: true, subtree: true })

function failed(text) {
  loading.hidden = false
  loading.className = 'failed'
  status.textContent = text
}

// pk3 качаем по одному: сотни мегабайт сразу десятком запросов (большие pk3 — ещё и кусками, arcade-parts.js)
// только мешали бы друг другу. Каждый читаем прямо в буфер его размера — без второй копии файла
async function fetchPaks() {
  const total = PAKS.reduce((sum, [, size]) => sum + size, 0)
  let done = 0
  const show = () => {
    status.textContent = `Loading OpenArena… ${mb(done)} / ${mb(total)} MB`
    bar.style.width = `${(100 * done) / total}%`
  }
  show()
  const files = []
  for (const [name, size] of PAKS) {
    const response = await fetch(DATA + name)
    if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`)
    const reader = response.body.getReader()
    const data = new Uint8Array(size)
    let at = 0
    for (;;) {
      const { done: end, value } = await reader.read()
      if (end) break
      if (at + value.length > size) throw new Error(`${name}: файл больше ожидаемого — другая версия данных?`)
      data.set(value, at)
      at += value.length
      done += value.length
      show()
    }
    if (at !== size) throw new Error(`${name}: скачалось ${at} байт из ${size}`)
    files.push([name, data])
  }
  status.textContent = 'Starting OpenArena…'
  bar.style.width = '100%'
  return files
}

// IDBFS: два syncfs сразу Emscripten не любит — следующий ждёт предыдущий
let syncing = Promise.resolve()
function sync(FS, populate) {
  syncing = syncing.then(() => new Promise((resolve) => FS.syncfs(populate, (error) => {
    if (error) console.warn('OpenArena: настройки не сохранились', error)
    resolve()
  })))
  return syncing
}

// Размер кадра — окно Arcade в пикселях экрана, но не больше Full HD: картинка без полос и без лишней нагрузки
function size() {
  const scale = Math.min(window.devicePixelRatio || 1, 2)
  let w = Math.round(window.innerWidth * scale)
  let h = Math.round(window.innerHeight * scale)
  const fit = Math.min(1, 1920 / w, 1080 / h)
  w = Math.max(640, Math.round(w * fit))
  h = Math.max(400, Math.round(h * fit))
  return [w, h]
}

async function start() {
  // Данные качаются, пока грузится движок; ошибку разберёт preRun
  const paks = fetchPaks()
  paks.catch(() => {})
  const ioquake3 = (await import('./engine/ioquake3.js')).default
  const [width, height] = size()
  const args = [
    '+set', 'sv_pure', '0',
    '+set', 'net_enabled', '0',
    '+set', 'com_basegame', 'baseoa',
    '+set', 'r_mode', '-1',
    '+set', 'r_customwidth', String(width),
    '+set', 'r_customheight', String(height),
    '+set', 'r_fullscreen', '0',
    '+set', 'cl_allowDownload', '0',
  ]
  let FS = null
  await ioquake3({
    canvas: document.getElementById('canvas'),
    arguments: args,
    locateFile: (file) => new URL(`engine/${file}`, document.baseURI).href,
    preRun: [async (module) => {
      module.addRunDependency('arcade-openarena')
      try {
        FS = module.FS
        FS.mount(FS.filesystems.IDBFS, {}, HOME)
        await sync(FS, true)
        FS.mkdirTree('/baseoa')
        // canOwn — движок берёт скачанный буфер себе, без копии на сотни мегабайт
        for (const [name, data] of await paks) FS.writeFile(`/baseoa/${name}`, data, { canOwn: true })
      } catch (error) {
        // Без данных движок не запускаем — он упал бы с непонятной ошибкой; остаётся сообщение на экране
        console.error(error)
        failed(`OpenArena did not load: ${error.message}`)
        return
      }
      module.removeRunDependency('arcade-openarena')
    }],
    postRun: [() => {
      loading.hidden = true
      document.getElementById('canvas').focus()
      const save = () => sync(FS, false)
      window.arcadeQuake = { save }
      setInterval(save, 60000)
      window.addEventListener('pagehide', save)
      document.addEventListener('visibilitychange', () => document.hidden && save())
    }],
    onAbort: (what) => failed(`OpenArena stopped: ${what}`),
    print: (text) => console.log(text),
    printErr: (text) => console.warn(text),
  })
}

start().catch((error) => {
  console.error(error)
  if (loading.className !== 'failed') failed(`OpenArena did not load: ${error.message}`)
})
