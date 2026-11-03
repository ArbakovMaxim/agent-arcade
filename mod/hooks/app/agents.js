// Arcade: сессии Claude Code на этом компьютере — вкладка «Агенты» и очередь доски на несколько сессий. Каждая сессия
// держит отметку — маленький файл в ~/.claude/arcade/agents/: кто она, в какой папке, что делает, какую карточку взяла.
// Отметки читает только этот компьютер, на сайт они не уходят. Сессия, которая давно не обновляла отметку, — закрыта.
// Удалять файлы мод не умеет, поэтому мест (файлов) — AGENT_SLOTS, и каждое место сессия сперва занимает: пишет в него
// отметку, выжидает и перечитывает — как и карточку очереди (claimCard)
import { fill } from '../chats.js'
import { tr } from '../i18n.js'
import { columnOf, isBoard } from '../notes.js'
import { S } from './state.js'
import { log } from './status.js'

export const AGENT_TICK_MS = 2_500 // шаг: своя отметка, а когда нужно — и чужие
export const AGENT_WRITE_MS = 15_000 // ничего не поменялось — отметку всё равно обновить раз в столько
export const AGENT_READ_MS = 5_000 // вкладки нет на экране, а всплывашки включены — чужие отметки раз в столько
export const AGENT_TTL_MS = 45_000 // отметка старше — сессию закрыли или она упала: в списке её нет
export const CLAIM_MS = 1_000 // заявив место или карточку, столько выжидаем и перечитываем: не заявил ли кто раньше
export const CLAIM_TRIES = 8 // столько раз подряд проиграть заявку — и сдаться
export const DONE_HOLD_MS = 5_000 // сделанную карточку отметка держит ещё столько: другие сессии успеют увидеть её сделанной
export const AGENT_SLOTS = 32 // мест для отметок: столько сессий разом
export const HIDDEN_MAX = 64 // скрытых сессий помним не больше стольких — последних

// on — отметки работают (есть домашняя папка и id сессии); ready — место slot моё; files — что лежит в местах:
// { sig, rec, bad }; seen — какое состояние каждой чужой сессии уже видели (для всплывашек), null — ещё ни разу не читали
S.ag = null
S.agNotify = true // всплывашка «Сессия «…» ждёт разрешения» — настройка agentsNotify
S.agDone = false // всплывашка «В сессии «…» Claude закончил ход» — настройка agentsDone
S.agHidden = [] // id сессий, скрытых крестиком во вкладке «Агенты»: их нет в списке и нет всплывашек о них — agentsHidden

const STATUS_ORDER = { permission: 0, done: 1, working: 2, idle: 3 }
export const STATUS_LABEL = { permission: 'ждёт разрешения', done: 'закончил ход', working: 'работает', idle: 'свободна' }

const base = (p) => String(p ?? '').split(/[\\/]+/).filter(Boolean).pop() ?? ''
const norm = (p) => String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
export const samePath = (a, b) => Boolean(a) && norm(a) === norm(b)
const slotPath = (slot) => `${S.ag.dir}${S.sep}s${slot}.json`

// Запустить отметки — из session.start. Нет домашней папки или id сессии — их нет: очередь идёт по-старому, одна
export async function startAgents($, home) {
  const old = S.ag
  S.ag = { on: false, dir: '', sid: '', name: '', path: '', slot: 0, ready: false, status: S.status, since: 0, wrote: 0, sent: '', read: 0, sig: '', files: {}, seen: null, card: null, doneAt: 0, claim: null, joinWarn: '', chain: Promise.resolve(), taking: null, ticking: false }
  if (!home) return
  try {
    const ag = S.ag
    ag.sid = await $.session.id()
    const root = (await $.session.root().catch(() => '')) || (await $.session.cwd())
    const repo = await $.session.repo().catch(() => null)
    ag.path = root
    ag.name = base(root) || root
    // Сессия в git worktree: папка у неё случайная — впереди имя самого репозитория
    if (repo?.root && !samePath(repo.root, root)) ag.name = `${base(repo.root)}/${ag.name}`
    ag.dir = [home.replace(/[\\/]+$/, ''), '.claude', 'arcade', 'agents'].join(S.sep)
    ag.since = await $.clock.now()
    if (old?.card) ag.card = old.card
    ag.on = Boolean(ag.sid && ag.path)
  } catch (err) {
    S.ag.on = false
    log(`отметки сессий выключены: ${err?.message ?? err}`)
  }
}

// Записи — по одной, в том порядке, в каком их просили: поздняя отметка не обгонит раннюю
function enqueue(fn) {
  const ag = S.ag
  const run = ag.chain.then(fn)
  ag.chain = run.catch(() => {})
  return run
}

// Моя отметка — как сейчас; at — когда записана
function recordOf(at) {
  const ag = S.ag
  const q = S.queue
  return {
    v: 1,
    sid: ag.sid,
    name: ag.name,
    path: ag.path,
    status: ag.status,
    since: ag.since,
    at,
    card: ag.card,
    queue: q ? { board: q.board, n: q.given.length, of: q.of ?? 0, started: q.started ?? 0 } : null,
    claim: ag.claim,
    ask: S.ask ?? null,
  }
}
const bodyOf = (rec) => JSON.stringify({ ...rec, at: 0 })

// Записать свою отметку в своё место; true — записана, false — места нет
function put($) {
  return enqueue(async () => {
    const ag = S.ag
    if (!ag.on || !ag.ready) return false
    const at = await $.clock.now()
    const rec = recordOf(at)
    await $.fs.write(slotPath(ag.slot), JSON.stringify(rec))
    ag.wrote = at
    ag.sent = bodyOf(rec)
    return true
  })
}

// Разобрать отметку: пустая или битая — null (её как раз пишут, или запись оборвалась)
function parse(text) {
  if (!text) return null
  try {
    const rec = JSON.parse(text)
    return rec && typeof rec === 'object' && rec.v === 1 ? rec : null
  } catch {
    return null
  }
}
const live = (rec, now) => Boolean(rec?.sid) && !rec.left && now - rec.at < AGENT_TTL_MS

// Прочитать места. fresh — каждое заново (для заявок), иначе — только поменявшиеся. Возвращает false, если какое-то
// свежее место прочитать не удалось: его как раз пишут — заявке такого чтения мало
async function readSlots($, now, fresh = false) {
  const ag = S.ag
  const entries = await $.fs.list(ag.dir).catch(() => []) // папки ещё нет — никого нет
  let sure = true
  for (const ent of entries) {
    const m = /^s(\d+)\.json$/.exec(ent.name)
    const slot = m ? Number(m[1]) : 0
    if (!slot || slot > AGENT_SLOTS || ent.kind !== 'file') continue
    const sig = `${ent.mtimeMs}:${ent.size}`
    const old = ag.files[slot]
    if (!fresh && old && old.sig === sig) continue
    // Своё место, пока оно моё, не перечитываем: что в нём, мы знаем
    if (!fresh && ag.ready && slot === ag.slot && old) continue
    const text = await $.fs.read(slotPath(slot)).catch(() => null)
    const rec = parse(text)
    // Пусто или битое, а файл свежий — его пишут сейчас: прежнее не забываем, а заявка пусть попробует ещё раз
    if (!rec && text !== null && now - ent.mtimeMs < AGENT_TTL_MS) {
      sure = false
      ag.files[slot] = { sig: '', rec: old?.rec ?? null }
      continue
    }
    ag.files[slot] = { sig, rec }
  }
  // Моё место занял другой (я надолго замолкала, и меня сочли закрытой) — место надо искать заново
  const mine = ag.ready ? ag.files[ag.slot]?.rec : null
  if (mine && mine.sid !== ag.sid && live(mine, now)) {
    ag.ready = false
    log('отметка сессии: место заняла другая сессия, ищу новое')
  }
  ag.read = now
  return sure
}

// Другие открытые сессии: по одной на id, самая свежая отметка
function othersFrom(now) {
  const ag = S.ag
  const by = new Map()
  for (const [slot, f] of Object.entries(ag.files)) {
    const rec = f.rec
    if (!live(rec, now) || rec.sid === ag.sid || (ag.ready && Number(slot) === ag.slot)) continue
    if (!by.has(rec.sid) || by.get(rec.sid).at < rec.at) by.set(rec.sid, { ...rec, slot: Number(slot) })
  }
  return [...by.values()]
}

// Занять место для своей отметки: сначала — место, где моя отметка уже есть (перезагрузка мода), иначе — свободное
// наугад: записать, выждать CLAIM_MS и перечитать. Осталась там моя — место моё
function takeSlot($) {
  const ag = S.ag
  if (ag.taking) return ag.taking
  ag.taking = enqueue(async () => {
    if (!ag.on || ag.ready) return ag.ready
    const now = await $.clock.now()
    await readSlots($, now, true)
    const own = Object.entries(ag.files).find(([, f]) => f.rec?.sid === ag.sid && now - f.rec.at < AGENT_TTL_MS / 2)
    if (own) {
      ag.slot = Number(own[0])
      ag.ready = true
      return true
    }
    const free = []
    for (let slot = 1; slot <= AGENT_SLOTS; slot++) {
      const f = ag.files[slot]
      if (!f || (f.sig && !live(f.rec, now))) free.push(slot)
    }
    if (!free.length) return false
    const slot = free[Math.floor(Math.random() * free.length)]
    const at = await $.clock.now()
    // Перед записью — ещё раз: место могли занять, пока мы читали остальные
    const before = await $.fs.read(slotPath(slot)).catch(() => null)
    const was = parse(before)
    if ((before && !was) || (live(was, at) && was.sid !== ag.sid)) return false
    const rec = recordOf(at)
    await $.fs.write(slotPath(slot), JSON.stringify(rec))
    // Запись шла слишком долго — выжидания уже не хватит, чтобы увидеть, кто писал вместе с нами: в другой раз
    if ((await $.clock.now()) - at > CLAIM_MS / 2) return false
    const wait = at + CLAIM_MS - (await $.clock.now())
    if (wait > 0) await $.clock.sleep(wait)
    const after = parse(await $.fs.read(slotPath(slot)).catch(() => null))
    if (after?.sid !== ag.sid || after.at !== at) return false
    ag.slot = slot
    ag.ready = true
    ag.wrote = at
    ag.sent = bodyOf(rec)
    ag.files[slot] = { sig: '', rec }
    return true
  }).finally(() => {
    ag.taking = null
  })
  return ag.taking
}

// Отметки готовы к заявкам: 'off' — отметок нет (очередь идёт одна, как раньше), true — место моё, false — не вышло
export async function agentsReady($) {
  const ag = S.ag
  if (!ag?.on) return 'off'
  if (ag.ready) return true
  return takeSlot($).catch((err) => {
    log(`отметка сессии: ${err?.message ?? err}`)
    return false
  })
}

// Шаг отметок — таймером раз в AGENT_TICK_MS: обновить свою, отпустить сделанную карточку, прочитать чужие, когда они
// нужны (вкладка «Агенты» или доска на экране, всплывашки включены), — и всплывашки о них
export async function agentsTick($) {
  const ag = S.ag
  if (!ag?.on || ag.ticking) return
  ag.ticking = true
  try {
    const now = await $.clock.now()
    // После /clear сессия та же, а id у неё новый: session.start не приходит — берём его здесь
    if (!ag.sid) {
      ag.sid = await $.session.id()
      ag.sent = ''
    }
    // Записи не уходили дольше, чем живёт отметка (компьютер спал, процесс стоял): место могли счесть свободным
    if (ag.ready && now - ag.wrote > AGENT_TTL_MS * 0.8) ag.ready = false
    if (!ag.ready) await takeSlot($)
    if (S.status !== ag.status) {
      ag.status = S.status
      ag.since = now
    }
    holdCheck(now)
    if (ag.ready && (bodyOf(recordOf(0)) !== ag.sent || now - ag.wrote >= AGENT_WRITE_MS)) await put($)
    const shown = S.paneOpen && S.view === 'library' && (S.menu === 'agents' || /^(boards|board:|note:)/.test(S.menu))
    if (shown || ((S.agNotify || S.agDone) && now - ag.read >= AGENT_READ_MS)) {
      await readSlots($, now)
      if (await readHidden($)) ag.sig = ''
      const others = othersFrom(now)
      notify($, others)
      const sig = JSON.stringify(others.map((r) => [r.sid, r.name, r.status, r.since, r.card?.id, r.queue?.n, r.queue?.of, r.ask?.kind, r.ask?.id, r.ask?.what]).sort())
      if (sig !== ag.sig) {
        ag.sig = sig
        if (shown) $.ui.invalidate('ui.render')
      }
    }
  } catch (err) {
    log(`отметка сессии: ${err?.message ?? err}`)
  } finally {
    ag.ticking = false
  }
}

// Всплывашки о других сессиях: первое чтение только запоминает, что видно; дальше — «ждёт разрешения» или «ждёт
// ответа на вопрос» (и у новой сессии тоже; каждый новый вопрос — заново) и, если включено, «закончил ход» у знакомой
const seenOf = (r) => (r.status === 'permission' && r.ask?.kind === 'question' ? `question:${r.ask.id}` : r.status)
function notify($, others) {
  const ag = S.ag
  const first = !ag.seen
  const was = ag.seen ?? new Map()
  ag.seen = new Map(others.map((r) => [r.sid, seenOf(r)]))
  if (first) return
  for (const r of others) {
    const before = was.get(r.sid)
    if (before === seenOf(r) || S.agHidden.includes(r.sid)) continue
    if (r.status === 'permission' && S.agNotify)
      $.ui.toast(fill(tr(r.ask?.kind === 'question' ? 'Сессия «{0}» ждёт ответа на вопрос' : 'Сессия «{0}» ждёт разрешения', S.lang), [r.name]))
    else if (r.status === 'done' && before !== undefined && S.agDone) $.ui.toast(fill(tr('В сессии «{0}» Claude закончил ход', S.lang), [r.name]))
  }
}

// Уйти — из session.end. /clear: процесс тот же, id сессии будет новый — место оставляем себе. Иначе — место свободно
export async function leaveAgents($, reason) {
  const ag = S.ag
  if (!ag?.on) return
  if (reason === 'clear') {
    ag.sid = ''
    ag.seen = null
    return
  }
  const slot = ag.ready ? ag.slot : 0
  // Записи, что ещё в очереди, уже ничего не напишут (on — false); пометка «ушла» — после них
  ag.on = false
  ag.ready = false
  if (slot) await enqueue(async () => $.fs.write(slotPath(slot), JSON.stringify({ v: 1, left: true, at: await $.clock.now() })))
}

// Заявить карточку очереди так, чтобы две сессии не получили одну. Сессия выбирает карточку (pick — по чужим
// отметкам), пишет заявку { card, at }, выжидает CLAIM_MS и перечитывает чужие: карточку уже держит другая или заявила
// раньше (при равенстве — у кого id меньше) — проиграла, берёт следующую. Запись заявки, которая шла дольше CLAIM_MS/2,
// не в счёт: кто заявил раньше, к перечитыванию соперника уже точно записан. io: me — мой id; now, sleep — часы;
// others(fresh) — чужие отметки (null — какое-то место не прочиталось); write(claim) — записать заявку (null — снять).
// Возвращает id карточки, '' — свободных карточек нет, или null — заявки раз за разом проигрываются
export async function claimCard(io, pick) {
  for (let i = 0; i < CLAIM_TRIES; i++) {
    const at = await io.now()
    const others = await io.others(false)
    const card = pick(others ?? [])
    if (!card) return ''
    await io.write({ card, at })
    if ((await io.now()) - at > CLAIM_MS / 2) {
      await io.write(null)
      continue
    }
    const wait = at + CLAIM_MS - (await io.now())
    if (wait > 0) await io.sleep(wait)
    const after = await io.others(true)
    const lost = after === null || after.some((r) => r.card?.id === card || (r.claim?.card === card && (r.claim.at < at || (r.claim.at === at && r.sid < io.me))))
    if (lost) {
      await io.write(null)
      continue
    }
    return card
  }
  return null
}

// Взять следующую карточку очереди. pick(others) — какую (по чужим отметкам); before() — перед каждым выбором (освежить
// блокнот: карточку, которую другая сессия уже сделала, не брать); 'off' — отметок нет, решай сам; '' — свободных
// карточек нет; null — занять карточку не вышло; иначе — id карточки, уже записанной в мою отметку
export async function takeCard($, pick, before) {
  const ready = await agentsReady($)
  if (ready === 'off') return 'off'
  if (!ready) return null
  const ag = S.ag
  const io = {
    me: ag.sid,
    now: () => $.clock.now(),
    sleep: (ms) => $.clock.sleep(ms),
    others: async (fresh) => {
      if (!fresh && before) await before()
      const now = await $.clock.now()
      const sure = await readSlots($, now, fresh)
      return fresh && !sure ? null : othersFrom(now)
    },
    // Заявка не записалась (место пропало) — заявлять нельзя: соперник её не увидит
    write: async (claim) => {
      ag.claim = claim
      if (!(await put($)) && claim) throw new Error('нет места для отметки')
    },
  }
  const id = await claimCard(io, pick).catch((err) => {
    log(`заявка на карточку: ${err?.message ?? err}`)
    return null
  })
  ag.claim = null
  if (id) holdCard(id)
  await put($)
  return id
}

// Карточка у этой сессии — её видят другие сессии («у сессии «…»») и очередь их не возьмёт
export function holdCard(id) {
  const ag = S.ag
  if (!ag?.on) return
  const page = S.notes.find((p) => p.id === id)
  const board = page?.parent ? S.notes.find((p) => p.id === page.parent && isBoard(p)) : null
  ag.card = page ? { id, title: page.title, board: board?.id ?? '', boardTitle: board?.title ?? '' } : null
  ag.doneAt = 0
}
export function dropCard() {
  if (S.ag) S.ag.card = null
}

// Своя карточка удалена или сделана (в последней колонке) — она больше не у этой сессии. Сделанную держим ещё
// DONE_HOLD_MS: сессия, которая прочитала блокнот чуть раньше, видит карточку в первой колонке — пусть видит и что её
// держат, а не возьмёт снова
function holdCheck(now) {
  const ag = S.ag
  if (!ag.card) return
  const page = S.notes.find((p) => p.id === ag.card.id)
  const board = page?.parent ? S.notes.find((p) => p.id === page.parent && isBoard(p)) : null
  if (!page) ag.card = null
  else if (board && columnOf(page, board.board.cols) === board.board.cols.at(-1).id) {
    ag.doneAt ||= now
    if (now - ag.doneAt >= DONE_HOLD_MS) ag.card = null
  } else {
    ag.doneAt = 0
    if (page.title !== ag.card.title) ag.card = { ...ag.card, title: page.title }
  }
}

// Какая сессия делает карточку: { name, me } или null
export function sessionOf(id) {
  const ag = S.ag
  if (!ag?.on || !id) return null
  if (ag.card?.id === id) return { name: ag.name, me: true }
  // Чужие — как их прочитали в последний раз: пока доска на экране, это каждый шаг
  const r = othersFrom(ag.read).find((x) => x.card?.id === id)
  return r ? { name: r.name, me: false } : null
}

// Другие сессии, где идёт очередь на доске id: перечитать отметки сейчас (перед присоединением)
export async function queueMates($, id) {
  const ag = S.ag
  if (!ag?.on) return []
  const now = await $.clock.now()
  await readSlots($, now)
  return othersFrom(now).filter((r) => r.queue?.board === id)
}
// Они же — как их прочитали в последний раз: для экрана доски
export function boardMates(id) {
  const ag = S.ag
  return ag?.on ? othersFrom(ag.read).filter((r) => r.queue?.board === id) : []
}

// Список для вкладки «Агенты»: эта сессия и другие открытые, по порядку — ждёт разрешения, закончил ход, работает,
// свободна; в одном состоянии — дольше в нём выше
export function agentsList(now) {
  const ag = S.ag
  if (!ag) return []
  const q = S.queue
  const me = { sid: ag.sid, name: ag.name || base(ag.path), path: ag.path, status: S.status, since: ag.status === S.status ? ag.since : now, card: ag.card, queue: q ? { board: q.board, n: q.given.length, of: q.of ?? 0 } : null, ask: S.ask ?? null, me: true }
  const others = ag.on ? othersFrom(now) : []
  return [me, ...others].sort((a, b) => (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9) || a.since - b.since)
}

// Скрытые сессии из $.store: только строки
export const hiddenOf = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x) : [])

// Скрыть другую сессию во вкладке «Агенты» (hide) или вернуть. Хранилище общее для всех сессий: перед записью —
// перечитать, чтобы не затереть, что скрыли в другой
let hiding = 0 // нажатий, которые ещё пишут в хранилище
let hiddenTurn = 0 // растёт с каждым нажатием: чтение, начатое до нажатия, его не откатит
export async function hideAgent($, sid, hide) {
  hiding++
  hiddenTurn++
  try {
    const saved = await $.store.get('agentsHidden').catch(() => undefined)
    const list = (saved === undefined ? S.agHidden : hiddenOf(saved)).filter((x) => x !== sid)
    S.agHidden = (hide ? [...list, sid] : list).slice(-HIDDEN_MAX)
    $.ui.invalidate('ui.render')
    await $.store.set('agentsHidden', S.agHidden).catch((err) => log(`скрытые сессии: ${err?.message ?? err}`))
  } finally {
    hiding--
  }
}

// Что скрыли в других сессиях — вместе с чужими отметками. true — список изменился
async function readHidden($) {
  const turn = hiddenTurn
  const saved = await $.store.get('agentsHidden').catch(() => undefined)
  if (saved === undefined || hiding || turn !== hiddenTurn) return false
  const list = hiddenOf(saved)
  if (list.join('\n') === S.agHidden.join('\n')) return false
  S.agHidden = list
  return true
}

// Сколько в состоянии: «меньше минуты», «5 мин», «2 ч 10 мин»
export function agoText(ms) {
  const min = Math.floor(Math.max(0, ms) / 60_000)
  if (min < 1) return 'меньше минуты'
  if (min < 60) return `${min} мин`
  return min % 60 ? `${Math.floor(min / 60)} ч ${min % 60} мин` : `${Math.floor(min / 60)} ч`
}
