// Мои игры в окне: свои файлы хранятся только в этом браузере (IndexedDB) и никуда не отправляются.
// Денди и Sega узнаются по заголовку и получают id по хешу — тот же, что в моде (/arcade-add), поэтому мод
// может открыть свою игру здесь. PlayStation — образы дисков на сотни мегабайт: их не читаем целиком,
// id — по имени, размеру и дате файла.
;(function () {
  'use strict'

  const ACCEPT = {
    nes: '.nes',
    sega: '.md,.bin,.gen,.smd',
    sms: '.sms',
    gg: '.gg',
    psx: '.chd,.pbp,.iso,.cue,.bin,.img,.zip,.7z,.m3u',
  }
  const PSX_EXT = ['chd', 'pbp', 'iso', 'cue', 'bin', 'img', 'zip', '7z', 'm3u']
  const MAX_SMALL = 16 * 1024 * 1024 // Денди и Sega читаем целиком: проверить заголовок и посчитать хеш
  const memory = new Map() // если IndexedDB недоступна (приватный режим) — только до закрытия окна

  let opening = null
  function db() {
    opening ??= new Promise((resolve) => {
      try {
        if (!window.indexedDB) return resolve(null)
        const request = indexedDB.open('arcade-mine', 1)
        request.onupgradeneeded = () => request.result.createObjectStore('games', { keyPath: 'id' })
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => resolve(null)
      } catch {
        resolve(null)
      }
    })
    return opening
  }

  function ask(base, mode, make) {
    return new Promise((resolve, reject) => {
      const request = make(base.transaction('games', mode).objectStore('games'))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  async function get(id) {
    const base = await db()
    if (!base) return memory.get(id) ?? null
    return (await ask(base, 'readonly', (s) => s.get(id))) ?? null
  }

  async function put(entry) {
    const base = await db()
    if (!base) memory.set(entry.id, entry)
    else await ask(base, 'readwrite', (s) => s.put(entry))
  }

  async function remove(id) {
    const base = await db()
    if (!base) memory.delete(id)
    else await ask(base, 'readwrite', (s) => s.delete(id))
  }

  // Свои игры приставки, новые сверху — без самих файлов
  async function list(consoleId) {
    const base = await db()
    const all = base ? await ask(base, 'readonly', (s) => s.getAll()) : [...memory.values()]
    return all
      .filter((e) => e.console === consoleId)
      .sort((a, b) => b.added - a.added)
      .map(({ id, console, title, size, added }) => ({ id, console, title, size, added }))
  }

  async function sha256(bytes) {
    const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
    return Array.from(digest, (b) => b.toString(16).padStart(2, '0')).join('')
  }

  function titleOf(name) {
    return String(name || '').replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60) || T('Моя игра')
  }

  const isArchive = (b) => {
    const head = String.fromCharCode(...b.subarray(0, 6))
    return head.startsWith('PK\x03\x04') || head.startsWith('7z\xbc\xaf\x27\x1c') || head.startsWith('Rar!')
  }
  const isNes = (b) => b.length >= 16 && b[0] === 0x4e && b[1] === 0x45 && b[2] === 0x53 && b[3] === 0x1a
  const label = (b, at) => String.fromCharCode(...b.subarray(at, at + 4))
  const isSega = (b) => b.length >= 0x200 && (label(b, 0x100) === 'SEGA' || label(b, 0x101) === 'SEGA')

  // Добавить файл в «Мои игры» приставки. expectSha — если мод просит именно этот файл.
  async function add(file, consoleId, expectSha) {
    if (!file) throw new Error(T('Файл не выбран.'))
    let id
    let sha = null
    if (consoleId === 'nes' || consoleId === 'sega') {
      if (file.size > MAX_SMALL) throw new Error(T('Файл больше 16 МБ — для Денди и Sega это не игра.'))
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (isArchive(bytes)) throw new Error(T('Это архив. Распакуй его и выбери сам файл игры: .nes, .md или .bin.'))
      if (consoleId === 'nes' && !isNes(bytes)) throw new Error(T('Это не игра для Денди: в файле нет заголовка iNES.'))
      if (consoleId === 'sega' && !isSega(bytes)) throw new Error(T('Это не игра для Sega Mega Drive: в заголовке нет метки SEGA.'))
      sha = await sha256(bytes)
      if (expectSha && sha !== expectSha) throw new Error(T('Это другой файл: он не совпадает с тем, что добавлен в моде.'))
      id = `mine-${sha.slice(0, 12)}`
    } else if (consoleId === 'sms' || consoleId === 'gg') {
      if (file.size > MAX_SMALL) throw new Error(T('Файл больше 16 МБ — для Master System и Game Gear это не игра.'))
      const bytes = new Uint8Array(await file.arrayBuffer())
      if (isArchive(bytes)) throw new Error(T('Это архив. Распакуй его и выбери сам файл игры: .sms или .gg.'))
      const ext = (String(file.name).match(/\.([^.]+)$/) || [])[1]
      const hasTmr = [0x7ff0, 0x3ff0, 0x1ff0].some((o) => bytes.length >= o + 8 && String.fromCharCode(...bytes.subarray(o, o + 8)) === 'TMR SEGA')
      // У японских картриджей метки бывает нет — тогда верим расширению
      if (!hasTmr && (!ext || ext.toLowerCase() !== consoleId)) throw new Error(T(`Это не игра для ${consoleId === 'gg' ? 'Game Gear' : 'Master System'}: нет метки TMR SEGA и расширение не .${consoleId}.`))
      sha = await sha256(bytes)
      if (expectSha && sha !== expectSha) throw new Error(T('Это другой файл: он не совпадает с тем, что добавлен в моде.'))
      id = `mine-${sha.slice(0, 12)}`
    } else if (consoleId === 'psx') {
      const ext = (String(file.name).match(/\.([^.]+)$/) || [])[1]
      if (!ext || !PSX_EXT.includes(ext.toLowerCase())) {
        throw new Error(T('Для PlayStation нужен образ диска: .chd, .pbp, .iso или .zip, где лежат .cue и .bin.'))
      }
      const key = new TextEncoder().encode(`${file.name}:${file.size}:${file.lastModified}`)
      id = `psx-${(await sha256(key)).slice(0, 12)}`
    } else {
      throw new Error(T('Эта приставка пока не поддерживает свои файлы.'))
    }
    const entry = { id, console: consoleId, title: titleOf(file.name), size: file.size, added: Date.now(), sha256: sha, file }
    await put(entry)
    return entry
  }

  window.ArcadeMine = { ACCEPT, list, get, add, remove }
})()
