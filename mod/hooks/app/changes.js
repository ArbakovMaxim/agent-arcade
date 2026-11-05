// Arcade: «Что поменялось» во вкладке «Агенты» — ветка git и незакоммиченные файлы каждой сессии. git читает сама
// сессия, в своей папке: при старте и в конце каждого хода Claude — без таймера и без сети. git здесь только читает
// (--no-optional-locks: даже index.lock не пишет); Arcade ничего не коммитит, не откатывает и не прячет в stash.
// Итог уходит в отметку сессии (agents.js) — так его видят «Агенты» других сессий на этом компьютере
import { tr } from '../i18n.js'
import { S, nb } from './state.js'
import { log } from './status.js'
import { giveClaude } from './work.js'

export const CHANGES_MAX = 40 // файлов в отметке не больше стольких — остальные только числом
const GIT_MS = 10_000 // столько ждём git: большой репозиторий, медленный диск

// running — git сейчас читается; again — пока читался, кончился ещё ход: прочитать ещё раз; open — у каких сессий
// (sid или 'me') список файлов раскрыт; note, bad — что вышло с «Дать Claude: проверить изменения»
S.chg = { running: false, again: false, open: new Set(), note: '', bad: false }

// Путь — прямыми слешами, без слеша в конце. Абсолютный ли он: /…, C:/… или //сервер/…
const slashes = (p) => String(p ?? '').trim().replace(/\\/g, '/').replace(/\/+$/, '')
const isAbsolute = (p) => /^(\/|[A-Za-z]:\/)/.test(p)
// Папку, которую git назвал относительно папки сессии (.git, ../.git), — от папки сессии; «.» и «..» — убрать
export function resolveDir(dir, from) {
  const d = slashes(dir)
  const full = isAbsolute(d) ? d : `${slashes(from)}/${d}`
  const out = []
  for (const part of full.split('/')) {
    if (part === '.' || (part === '' && out.length)) continue
    if (part === '..' && out.length > 1) out.pop()
    else out.push(part)
  }
  return out.join('/')
}
// Сравнивать папки разных сессий — без регистра: на Windows и macOS D:/Work и d:/work — одна папка
const key = (p) => slashes(p).toLowerCase()

// Первая строка git status --porcelain -b: «## ветка...origin/ветка [ahead 2, behind 1]», «## No commits yet on ветка»,
// «## HEAD (no branch)». Эти строки git не переводит
export function branchOf(head) {
  const fresh = /^(?:No commits yet on|Initial commit on) (\S+)/.exec(head)
  if (fresh) return { branch: fresh[1], ahead: 0, fresh: true }
  if (head.startsWith('HEAD (no branch)')) return { branch: '', ahead: 0, fresh: false }
  const name = head.split(' ')[0].split('...')[0]
  return { branch: name, ahead: Number(/\[ahead (\d+)/.exec(head)?.[1] ?? 0), fresh: false }
}

// git status --porcelain=v1 -b -z: «XY путь\0»; у переименованных и скопированных за путём — ещё прежний путь. Пути —
// от корня репозитория
export function parseStatus(out) {
  const parts = String(out ?? '').split('\0')
  let head = { branch: '', ahead: 0, fresh: false }
  const files = []
  for (let i = 0; i < parts.length; i++) {
    const ent = parts[i]
    if (!ent) continue
    if (i === 0 && ent.startsWith('## ')) {
      head = branchOf(ent.slice(3))
      continue
    }
    const xy = ent.slice(0, 2)
    if (/[RC]/.test(xy)) i++
    files.push({ path: ent.slice(3), xy })
  }
  return { ...head, files }
}

// git diff --numstat -z HEAD: «добавлено\tудалено\tпуть\0»; у переименованного путь пустой, а за ним — прежний и новый.
// Двоичный файл — «-\t-». Возвращает путь → { add, del } или { bin: true }
export function parseNumstat(out) {
  const parts = String(out ?? '').split('\0')
  const map = new Map()
  for (let i = 0; i < parts.length; i++) {
    const m = /^(-|\d+)\t(-|\d+)\t([\s\S]*)$/.exec(parts[i])
    if (!m) continue
    let path = m[3]
    if (!path) {
      path = parts[i + 2] ?? ''
      i += 2
    }
    map.set(path, m[1] === '-' ? { bin: true } : { add: Number(m[1]), del: Number(m[2]) })
  }
  return map
}

// Что поменялось в папке — для отметки: { branch, ahead, top, repo, files: [{ path, add, del, state }], n, at };
// state — 'new' (git его ещё не знает), 'bin' (двоичный) или ''; add и del — null, если чисел нет. null — не git
async function readChanges($, path) {
  const git = (args) => $.process.run(['git', '--no-optional-locks', '-C', path, ...args], { timeoutMs: GIT_MS })
  const where = await git(['rev-parse', '--show-toplevel', '--git-common-dir'])
  if (where?.exitCode !== 0) return null
  const [top, common] = String(where.stdout ?? '').split(/\r?\n/).map((x) => x.trim())
  if (!top || !common) return null
  const status = await git(['status', '--porcelain=v1', '-b', '-z'])
  if (status?.exitCode !== 0) return null
  const st = parseStatus(status.stdout)
  // Числа строк — от последнего коммита; коммитов ещё нет или git не ответил — без чисел
  let nums = new Map()
  if (st.files.length && !st.fresh) {
    const diff = await git(['diff', '--numstat', '-z', 'HEAD']).catch(() => null)
    if (diff?.exitCode === 0) nums = parseNumstat(diff.stdout)
  }
  const files = st.files.slice(0, CHANGES_MAX).map((f) => {
    const num = nums.get(f.path)
    const state = f.xy === '??' ? 'new' : num?.bin ? 'bin' : ''
    return { path: f.path, add: num && !num.bin ? num.add : null, del: num && !num.bin ? num.del : null, state }
  })
  return { branch: st.branch, ahead: st.ahead, top: key(top), repo: key(resolveDir(common, path)), files, n: st.files.length, at: 0 }
}

// Прочитать, что поменялось в папке этой сессии, — при старте и в конце хода. Поменялось — в отметку (её запишет
// следующий шаг отметок) и, если «Агенты» на экране, перерисовать
export async function changesPoll($) {
  const ag = S.ag
  if (!ag?.on || !ag.path) return
  if (S.chg.running) {
    S.chg.again = true
    return
  }
  S.chg.running = true
  try {
    do {
      S.chg.again = false
      let now = null
      try {
        now = await readChanges($, ag.path)
      } catch (err) {
        // git нет или запускать его не дали — строки нет
        log(`что поменялось: ${err?.message ?? err}`)
      }
      if (S.ag !== ag) return
      const same = (now && ag.changes ? JSON.stringify({ ...now, at: 0 }) === JSON.stringify({ ...ag.changes, at: 0 }) : now === ag.changes)
      if (!same) {
        ag.changes = now ? { ...now, at: await $.clock.now() } : null
        if (S.paneOpen && S.view === 'library' && (S.menu === 'agents' || S.menu === 'today')) $.ui.invalidate('ui.render')
      }
    } while (S.chg.again)
  } finally {
    S.chg.running = false
  }
}

// «Что поменялось» из отметки сессии. Чужая отметка — из файла (и, может, от другой версии Arcade): что на неё не
// похоже, не показываем
export function changesOf(r) {
  const c = r?.changes
  if (!c || typeof c !== 'object' || !Array.isArray(c.files)) return null
  const files = c.files
    .filter((f) => typeof f?.path === 'string' && f.path)
    .slice(0, CHANGES_MAX)
    .map((f) => ({ path: f.path, add: Number.isFinite(f.add) ? f.add : null, del: Number.isFinite(f.del) ? f.del : null, state: f.state === 'new' || f.state === 'bin' ? f.state : '' }))
  const n = Number.isFinite(c.n) ? Math.max(c.n, files.length) : files.length
  const str = (x) => (typeof x === 'string' ? x : '')
  return { branch: str(c.branch), ahead: Number.isFinite(c.ahead) && c.ahead > 0 ? c.ahead : 0, top: str(c.top), repo: str(c.repo), files, n }
}

// Пересечения: какие файлы сессии r правит и другая сессия. Сессии в одной папке — одни и те же изменения: кто что
// правил, не различить. Другая папка того же репозитория (git worktree) — общие файлы. Другой репозиторий — ничего.
// Возвращает { same: [имя сессии], files: [{ path, who: [{ name, me }] }] }
export function overlapsOf(r, all) {
  const c = changesOf(r)
  const out = { same: [], files: [] }
  if (!c?.n || !c.repo) return out
  const mine = new Set(c.files.map((f) => f.path))
  const by = new Map()
  for (const o of all) {
    const oc = changesOf(o)
    if (o === r || (o.sid && o.sid === r.sid) || !oc?.n || oc.repo !== c.repo) continue
    if (oc.top === c.top) {
      out.same.push({ name: o.name, me: Boolean(o.me) })
      continue
    }
    for (const f of oc.files) {
      if (!mine.has(f.path)) continue
      if (!by.has(f.path)) by.set(f.path, [])
      by.get(f.path).push({ name: o.name, me: Boolean(o.me) })
    }
  }
  out.files = [...by.entries()].map(([path, who]) => ({ path, who }))
  return out
}

// Просьба Claude проверить незакоммиченные изменения этой сессии: только посмотреть и рассказать — ничего не менять
export function reviewPrompt() {
  return tr('Проверь незакоммиченные изменения в этой папке: посмотри git status и git diff, и новые файлы тоже. Найди ошибки, забытое и что стоит поправить — и расскажи коротко. Ничего не коммить, не откатывай и не прячь в stash. Если что-то стоит поправить — сначала скажи, что именно.', S.lang)
}

// «Дать Claude: проверить изменения» — у своей сессии. Заметка о том, ушла ли просьба, — под карточками «Агентов»
export async function reviewChanges($) {
  await giveClaude($, reviewPrompt(), 'ask')
  S.chg.note = nb.note
  S.chg.bad = nb.bad
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
}
