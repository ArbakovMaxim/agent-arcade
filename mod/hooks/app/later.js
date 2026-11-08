// Arcade: «Не сейчас» у строки «сыграть?» — отложить её на 5 или 10 минут или до перезапуска Claude. Отсрочка общая для
// всех сессий этого компьютера и на сайт не уходит: файл ~/.claude/arcade/ask-later.json — { v: 1, until } (до какого
// времени) или { v: 1, launch } (до перезапуска: id запуска Claude, в котором отложили); { v: 1 } — не отложено
// (удалять файлы мод не умеет). Запуск Claude — файл ~/.claude/arcade/launch.json { v: 1, id, at }: его переписывает
// сессия, которая стартовала, когда других открытых сессий нет (по отметкам agents.js). Перезагрузка мода — не запуск
import { S } from './state.js'
import { log } from './status.js'

export const LATER_READ_MS = 5_000 // файлы отсрочки и запуска перечитываем не чаще — их могли поменять другие сессии
export const LATER_MINUTES = [5, 10] // на сколько минут отложить — кнопки второго шага

// dir — папка ~/.claude/arcade (null — домашней папки нет: отсрочка только в памяти этой сессии); until — до какого
// времени отложено; launch — id запуска, до конца которого отложено; current — id нынешнего запуска (из launch.json);
// readAt — когда перечитывали; reading — чтение, которое идёт сейчас; writes — растёт с каждой записью: чтение, начатое
// до записи, её не откатит
S.later = { dir: null, until: 0, launch: '', current: '', readAt: -Infinity, reading: null, writes: 0 }

const laterPath = () => `${S.later.dir}${S.sep}ask-later.json`
const launchPath = () => `${S.later.dir}${S.sep}launch.json`
const newId = (now) => `${Math.floor(now).toString(36)}${Math.random().toString(36).slice(2, 8)}`

// Прочитать файл: null — его нет, undefined — битый (его как раз пишут) — прежнее не забываем
async function readJson($, path) {
  const text = await $.fs.read(path).catch(() => null)
  if (text === null || text === undefined) return null
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' && v.v === 1 ? v : undefined
  } catch {
    return undefined
  }
}

// Папка отсрочки — из session.start, когда узнали домашнюю папку
export function startLater(home) {
  S.later = { dir: null, until: 0, launch: '', current: '', readAt: -Infinity, reading: null, writes: 0 }
  if (home) S.later.dir = [home.replace(/[\\/]+$/, ''), '.claude', 'arcade'].join(S.sep)
}

async function readLater($) {
  const L = S.later
  const writes = L.writes
  const [later, launch] = await Promise.all([readJson($, laterPath()), readJson($, launchPath())])
  if (writes !== L.writes) return
  if (later !== undefined) {
    L.until = Number(later?.until) || 0
    L.launch = typeof later?.launch === 'string' ? later.launch : ''
  }
  if (launch !== undefined) L.current = typeof launch?.id === 'string' ? launch.id : ''
}

// Отложена ли строка сейчас: файлы перечитываем не чаще LATER_READ_MS, одно чтение за раз
export async function laterOn($, now) {
  const L = S.later
  if (L.dir && now - L.readAt >= LATER_READ_MS) {
    L.readAt = now
    L.reading ??= readLater($)
      .catch((err) => log(`отсрочка «сыграть?»: ${err?.message ?? err}`))
      .finally(() => {
        L.reading = null
      })
    await L.reading
  }
  return laterUntil(now) !== 0
}

// До какого времени отложено, как знаем сейчас: время, Infinity — до перезапуска Claude, 0 — не отложено
export function laterUntil(now) {
  const L = S.later
  if (L.launch && L.launch === L.current) return Infinity
  return L.until > now ? L.until : 0
}

// Отложить: kind — минуты (LATER_MINUTES) или 'restart' — до перезапуска Claude
export async function laterSet($, kind) {
  const L = S.later
  const now = await $.clock.now()
  L.writes++
  if (kind === 'restart') {
    if (L.dir) {
      // Запуска ещё нет в файле (отметок нет или их не успели прочитать) — этот запуск и есть первый
      const launch = await readJson($, launchPath())
      if (typeof launch?.id === 'string' && launch.id) L.current = launch.id
      else if (launch === null || !L.current) {
        L.current = newId(now)
        await $.fs.write(launchPath(), JSON.stringify({ v: 1, id: L.current, at: now }))
      }
    } else L.current ||= newId(now)
    L.until = 0
    L.launch = L.current
  } else {
    L.until = now + Number(kind) * 60_000
    L.launch = ''
  }
  L.readAt = now
  if (L.dir) await $.fs.write(laterPath(), JSON.stringify(L.launch ? { v: 1, launch: L.launch } : { v: 1, until: L.until }))
}

// Вернуть строку — из настроек
export async function laterClear($) {
  const L = S.later
  L.writes++
  L.until = 0
  L.launch = ''
  L.readAt = await $.clock.now()
  if (L.dir) await $.fs.write(laterPath(), JSON.stringify({ v: 1 }))
}

// Запуск Claude — из agents.js, когда сессия впервые занимает место для отметки. first — других открытых сессий нет и
// своей свежей отметки нет (это не перезагрузка мода): Claude только что запустили — новый id запуска, и отсрочка «до
// перезапуска» кончается во всех сессиях. Иначе запуск тот же: берём его id из файла (файла нет — заводим)
export async function launchCheck($, now, first) {
  const L = S.later
  if (!L.dir) return
  try {
    const launch = first ? null : await readJson($, launchPath())
    if (typeof launch?.id === 'string' && launch.id) {
      L.current = launch.id
      return
    }
    // Битый — его пишет соседняя сессия, которая стартовала вместе с этой: её id и возьмём при следующем чтении
    if (launch === undefined) return
    L.writes++
    L.current = newId(now)
    await $.fs.write(launchPath(), JSON.stringify({ v: 1, id: L.current, at: now }))
    log('новый запуск Claude')
  } catch (err) {
    log(`запуск Claude: ${err?.message ?? err}`)
  }
}
