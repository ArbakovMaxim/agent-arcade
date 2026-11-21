// Arcade: питомец — зверёк, который растёт от работы с Claude. Здесь только чистые функции: запись в хранилище,
// сытость и настроение по отметкам времени (без таймеров), угощения из журнала «Итогов дня», серия дней, одежда.
// Рисунок — petart.js
import { dayKey } from './calendar.js'
import { SPECIES, WEAR } from './petart.js'

export const PET_KEY = 'pet'
const HOUR = 3_600_000
const DAY = 86_400_000
export const HUNGER_PER_HOUR = 4 // сытость падает на 4 из 100 в час: от полной до пустой — примерно за сутки
export const MOOD_PER_HOUR = 3 // настроение — чуть медленнее
export const FEED_FULL = 25 // угощение — +25 к сытости
export const FEED_MOOD = 8
export const PAT_MOOD = 12 // погладить — +12 к настроению
export const PAT_GAP_MS = 1_500 // гладить чаще — без новых очков (сердечки всё равно)
export const TREATS_MAX = 99
export const ADULT_XP = 30 // опыт — одно угощение = 1; с 30 — взрослый
export const NAME_MAX = 24
export const EAT_MS = 2_600 // сколько ест после «Покормить»
export const PAT_MS = 3_600 // сколько видны сердечки
export const NIGHT = [23, 7] // спит с 23:00 до 7:00 по часам компьютера

// Чем кормит работа: карточка в последней колонке доски, «Принять» в ревью, зелёная проверка между карточками.
// Отмеченные пункты чек-листа и строки кода — нет: иначе питомец поощрял бы мусор
const FOOD = (x) => x.kind === 'done' || x.kind === 'accept' || (x.kind === 'check' && x.ok)
export const QUEUE_TREATS = 2 // очередь доски прошла до конца — ещё 2

// Еда без досок (0.60, п. 47): кто работает с Claude прямо в чате, тоже кормит питомца.
// Печенье 2 и до 3 за ходы — до 5 угощений в день, а сытым держат 4 (угощение +25, голод 4 в час)
export const DAILY_COOKIES = 2 // первый заход в Arcade за день — 2 печенья: одно на компьютер, по его часам
export const TURNS_PER_TREAT = 5 // каждые 5 законченных ходов Claude — угощение
export const TURN_TREATS_DAY = 3 // но не больше 3 в день: ходы легко накрутить
const WORK_DAYS = 60 // сколько рабочих дней помнить для серии
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const dayOk = (d) => typeof d === 'string' && DAY_RE.test(d)

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

// Одежда открывается уровнем или серией рабочих дней. За деньги ничего нет: ещё вещи — в лавке за монетки из заданий (0.61)
export const UNLOCKS = [
  { id: 'scarf', stage: 'baby' },
  { id: 'cap', xp: 10 },
  { id: 'bow', streak: 2 },
  { id: 'glasses', streak: 3 },
  { id: 'beanie', stage: 'adult' },
  { id: 'crown', streak: 5 },
]

export function newPet(species, name, now) {
  return {
    v: 1,
    species: SPECIES.includes(species) ? species : SPECIES[Math.floor((now / 1000) % SPECIES.length)],
    name: cleanName(name),
    born: now,
    xp: 0,
    treats: 1, // первое угощение — сразу: покормить яйцо, и оно вылупится
    full: 60,
    fullAt: now,
    mood: 70,
    moodAt: now,
    fedAt: 0,
    patAt: 0,
    counted: now, // журнал до этого — уже не еда
    wear: [],
    best: 0,
    bestAt: 0, // когда лучшая серия выросла — реплика о новом трюке (0.59)
    style: { cards: 0, reviews: 0, queues: 0 }, // чем кормили — от этого облик взрослого (0.59)
    cookieDay: dayKey(now), // печенье дня (0.60): в день появления хватает первого угощения
    cookieAt: 0,
    turnDay: '', // ходы Claude за день (0.60): каждые TURNS_PER_TREAT — угощение
    turnN: 0,
    workDays: [], // дни с законченным ходом Claude — серия считает и их (0.60)
    coins: 0, // монетки 🪙 за задания (0.61) — только на лавку питомца
    quest: emptyQuest(),
    marks: emptyMarks(),
    questAt: 0, // когда последний раз выполнено задание — реплика «+N 🪙»
    questGain: 0,
    owned: [], // купленное в лавке (кроме печенья)
    decor: [], // какие купленные вещи стоят на полосе
  }
}

export const cleanName = (s) =>
  String(s ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, NAME_MAX)

const num = (x, lo, hi, d) => (Number.isFinite(x) ? clamp(x, lo, hi) : d)

// Из хранилища: чего нет или что не подходит — null (питомца нет) или по умолчанию
export function restorePet(raw, now) {
  if (!raw || typeof raw !== 'object' || !SPECIES.includes(raw.species)) return null
  const at = (x) => (Number.isFinite(x) && x > 0 && x <= now + DAY ? x : 0)
  const owned = Array.isArray(raw.owned) ? [...new Set(raw.owned.filter((id) => SHOP_KIND[id] && SHOP_KIND[id] !== 'food'))] : []
  return {
    v: 1,
    species: raw.species,
    name: cleanName(raw.name),
    born: at(raw.born) || now,
    xp: Math.floor(num(raw.xp, 0, 1e6, 0)),
    treats: Math.floor(num(raw.treats, 0, TREATS_MAX, 0)),
    full: num(raw.full, 0, 100, 60),
    fullAt: at(raw.fullAt) || now,
    mood: num(raw.mood, 0, 100, 70),
    moodAt: at(raw.moodAt) || now,
    fedAt: at(raw.fedAt),
    patAt: at(raw.patAt),
    counted: at(raw.counted) || now,
    wear: Array.isArray(raw.wear) ? [...new Set(raw.wear.filter((id) => WEAR[id]))].slice(0, 3) : [],
    best: Math.floor(num(raw.best, 0, 1000, 0)),
    bestAt: at(raw.bestAt),
    style: restoreStyle(raw.style),
    // До 0.60 этого не было: печенье дня придёт при первом чтении, ходы и рабочие дни — с нуля
    cookieDay: dayOk(raw.cookieDay) ? raw.cookieDay : '',
    cookieAt: at(raw.cookieAt),
    turnDay: dayOk(raw.turnDay) ? raw.turnDay : '',
    turnN: Math.floor(num(raw.turnN, 0, 1e6, 0)),
    workDays: Array.isArray(raw.workDays) ? [...new Set(raw.workDays.filter(dayOk))].sort().slice(-WORK_DAYS) : [],
    // До 0.61 этого не было: монеток 0, задания выдадутся при первом чтении, лавка пустая
    coins: Math.floor(num(raw.coins, 0, COINS_MAX, 0)),
    quest: restoreQuest(raw.quest),
    marks: restoreMarks(raw.marks),
    questAt: at(raw.questAt),
    questGain: Math.floor(num(raw.questGain, 0, 1000, 0)),
    owned,
    decor: Array.isArray(raw.decor) ? [...new Set(raw.decor.filter((id) => owned.includes(id) && SHOP_KIND[id] === 'decor'))] : [],
  }
}

// Стиль работы (0.59): закрытые карточки, принятые ревью, шаги очередей доски (зелёные проверки и пройденные очереди)
const STYLE_KEYS = ['cards', 'reviews', 'queues']
const restoreStyle = (s) => Object.fromEntries(STYLE_KEYS.map((k) => [k, Math.floor(num(s && typeof s === 'object' ? s[k] : 0, 0, 1e6, 0))]))
const styleOf = (x) => (x.kind === 'done' ? 'cards' : x.kind === 'accept' ? 'reviews' : 'queues')

export const stageOf = (pet) => (pet.xp < 1 ? 'egg' : pet.xp < ADULT_XP ? 'baby' : 'adult')
export const fullness = (pet, now) => clamp(pet.full - ((now - pet.fullAt) / HOUR) * HUNGER_PER_HOUR)
// Настроение падает со временем и быстрее, когда голоден
export function moodOf(pet, now) {
  const hungry = fullness(pet, now) < 25 ? 2 : 1
  return clamp(pet.mood - ((now - pet.moodAt) / HOUR) * MOOD_PER_HOUR * hungry)
}

// Новые угощения из журнала «Итогов дня»: записи после pet.counted. queues — сколько очередей прошло до конца.
// Одна карточка кормит одним видом работы раз в день: перетаскивать её туда-обратно — без новых угощений.
// Ничего нового — та же запись: счётчик не двигается, и записывать в хранилище нечего
const foodKey = (x) => `${x.kind}:${x.id}:${dayKey(x.at)}`
export function collect(pet, log, now, queues = 0) {
  const seen = new Set(log.filter((x) => x.at <= pet.counted && FOOD(x)).map(foodKey))
  let n = queues * QUEUE_TREATS
  const style = { ...restoreStyle(pet.style) }
  style.queues += queues
  for (const x of log) {
    if (x.at <= pet.counted || x.at > now || !FOOD(x) || seen.has(foodKey(x))) continue
    seen.add(foodKey(x))
    style[styleOf(x)]++
    n++
  }
  if (!n) return pet
  return { ...pet, treats: Math.min(TREATS_MAX, pet.treats + n), counted: Math.max(pet.counted, now), style }
}

// Печенье дня (0.60): первый раз за день, когда Arcade читает питомца, — DAILY_COOKIES угощений. День — по часам
// компьютера, запись общая для всех сессий: второй заход и другая сессия печенья не дают
export function dailyCookie(pet, now) {
  const day = dayKey(now)
  if (pet.cookieDay === day) return pet
  return { ...pet, treats: Math.min(TREATS_MAX, pet.treats + DAILY_COOKIES), cookieDay: day, cookieAt: now }
}

// Claude закончил ход (0.60): счёт ходов за день, каждые TURNS_PER_TREAT — угощение, не больше TURN_TREATS_DAY в день.
// День с ходом — рабочий: серия для нарядов, трюков и уголка считает и его
export function turnFed(pet, now) {
  const day = dayKey(now)
  const n = Math.min(1e6, (pet.turnDay === day ? pet.turnN : 0) + 1)
  const treat = n % TURNS_PER_TREAT === 0 && n / TURNS_PER_TREAT <= TURN_TREATS_DAY ? 1 : 0
  const days = pet.workDays ?? []
  const workDays = days.includes(day) ? days : [...days, day].slice(-WORK_DAYS)
  return { ...pet, turnDay: day, turnN: n, treats: Math.min(TREATS_MAX, pet.treats + treat), workDays }
}
export const turnsToday = (pet, now) => (pet.turnDay === dayKey(now) ? pet.turnN : 0)

// Задания (0.61, п. 47): три простых на день и одно побольше на неделю, за них — монетки 🪙 на лавку питомца.
// Только полезное: ни строк кода, ни «N карточек» без предела — перетаскивать карточку туда-обратно бесполезно,
// дневное задание засчитывается раз. Задания выбираются по дате, одинаково во всех сессиях, и хранятся в питомце.
// Отметки marks — последний день, когда было действие, которого нет в журнале «Итогов дня»: блокнот, итоги, чат,
// игра, очередь доски. Таймеров нет: проверка — при чтении питомца и после действия
export const COINS_MAX = 9999
export const DAY_QUEST_COINS = 3
export const WEEK_QUEST_COINS = 15
export const QUEST_TURNS = 5 // «Claude закончил 5 ходов»
export const WEEK_STREAK = 5 // «5 дней подряд с работой» — внутри этой недели
export const WEEK_REVIEWS = 3 // «3 принятых ревью»
export const DAY_QUESTS = ['turns', 'card', 'review', 'pat', 'note', 'digest']
export const WEEK_QUESTS = ['streak', 'queue', 'reviews', 'chat', 'game']
const MARKS = ['note', 'digest', 'chat', 'game', 'queue']
const emptyQuest = () => ({ day: '', ids: [], done: [], week: '', wid: '', wdone: false })
const emptyMarks = () => Object.fromEntries(MARKS.map((k) => [k, '']))
function restoreQuest(q) {
  const o = q && typeof q === 'object' ? q : {}
  const ids = Array.isArray(o.ids) ? [...new Set(o.ids.filter((x) => DAY_QUESTS.includes(x)))].slice(0, 3) : []
  return {
    day: dayOk(o.day) ? o.day : '',
    ids,
    done: Array.isArray(o.done) ? [...new Set(o.done.filter((x) => ids.includes(x)))] : [],
    week: dayOk(o.week) ? o.week : '',
    wid: WEEK_QUESTS.includes(o.wid) ? o.wid : '',
    wdone: o.wdone === true,
  }
}
const restoreMarks = (m) => Object.fromEntries(MARKS.map((k) => [k, m && typeof m === 'object' && dayOk(m[k]) ? m[k] : '']))

// Неделя — с понедельника по часам компьютера; ключ — день понедельника
const monday = (now) => {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - ((d.getDay() + 6) % 7))
}
export const weekKey = (now) => dayKey(monday(now).getTime())
const hash = (s) => {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

// Какие задания сегодня: «5 ходов Claude» — всегда, и два из простых. Карточка и ревью — только тем, кто уже закрывал
// карточки или принимал ревью: задания под то, чем человек и так занят
export function dayQuests(pet, day) {
  const style = restoreStyle(pet.style)
  const pool = ['pat', 'note', 'digest', ...(style.cards ? ['card'] : []), ...(style.reviews ? ['review'] : [])]
  return ['turns', ...pool.sort((a, b) => hash(`${day}:${a}`) - hash(`${day}:${b}`)).slice(0, 2)]
}
// Задание недели: серия, очередь доски (кто их запускал), ревью (кто их принимал), чат (со входом) — и изредка игра:
// игры в Arcade — последним пунктом
export function weekQuest(pet, week, acct = false) {
  const style = restoreStyle(pet.style)
  const main = ['streak', ...(style.queues ? ['queue'] : []), ...(style.reviews ? ['reviews'] : []), ...(acct ? ['chat'] : [])]
  const n = hash(`week:${week}`) % (2 * main.length + 1)
  return n === 2 * main.length ? 'game' : main[n % main.length]
}

// Отметить действие (блокнот, итоги, чат, игра, очередь) сегодняшним днём. Уже отмечено — та же запись
export function questMark(pet, kind, now) {
  const day = dayKey(now)
  if (!MARKS.includes(kind) || pet.marks?.[kind] === day) return pet
  return { ...pet, marks: { ...restoreMarks(pet.marks), [kind]: day } }
}

const workDaysOf = (pet, log) => new Set([...log.filter((x) => x.kind === 'done' || x.kind === 'accept').map((x) => dayKey(x.at)), ...(pet.workDays ?? [])])
// Самая длинная серия рабочих дней внутри этой недели — по сегодня
function weekRun(pet, log, now) {
  const days = workDaysOf(pet, log)
  const start = monday(now)
  const today = dayKey(now)
  let run = 0
  let best = 0
  for (let i = 0; i < 7; i++) {
    const day = dayKey(new Date(start.getFullYear(), start.getMonth(), start.getDate() + i).getTime())
    if (day > today) break
    run = days.has(day) ? run + 1 : 0
    best = Math.max(best, run)
  }
  return best
}

// Сделано ли задание: progress — сколько из скольких (для экрана), done — да или нет
export function questProgress(id, pet, log, now) {
  const day = dayKey(now)
  const week = weekKey(now)
  const marks = restoreMarks(pet.marks)
  const today = (kind) => log.some((x) => x.kind === kind && x.at <= now && dayKey(x.at) === day)
  const one = (ok) => ({ n: ok ? 1 : 0, of: 1 })
  switch (id) {
    case 'turns':
      return { n: Math.min(QUEST_TURNS, turnsToday(pet, now)), of: QUEST_TURNS }
    case 'card':
      return one(today('done'))
    case 'review':
      return one(today('accept'))
    case 'pat':
      return one(pet.patAt > 0 && dayKey(pet.patAt) === day)
    case 'note':
    case 'digest':
      return one(marks[id] === day)
    case 'streak':
      return { n: Math.min(WEEK_STREAK, weekRun(pet, log, now)), of: WEEK_STREAK }
    case 'reviews':
      return { n: Math.min(WEEK_REVIEWS, new Set(log.filter((x) => x.kind === 'accept' && x.at <= now && dayKey(x.at) >= week).map((x) => x.id)).size), of: WEEK_REVIEWS }
    case 'queue':
    case 'chat':
    case 'game':
      return one(marks[id] >= week)
    default:
      return { n: 0, of: 1 }
  }
}

// Выдать задания нового дня и недели, засчитать сделанные и дать монетки. Ничего не поменялось — та же запись.
// acct — вошёл ли человек (задание «написать другу» — только со входом)
export function questCheck(pet, log, now, { acct = false } = {}) {
  const day = dayKey(now)
  const week = weekKey(now)
  let q = pet.quest ?? emptyQuest()
  const fresh = q.day !== day || !q.ids.length
  const freshWeek = q.week !== week || !q.wid
  if (fresh) q = { ...q, day, ids: dayQuests(pet, day), done: [] }
  if (freshWeek) q = { ...q, week, wid: weekQuest(pet, week, acct), wdone: false }
  const ok = (id) => {
    const p = questProgress(id, pet, log, now)
    return p.n >= p.of
  }
  const done = q.ids.filter((id) => !q.done.includes(id) && ok(id))
  const wdone = !q.wdone && ok(q.wid)
  if (!done.length && !wdone) return fresh || freshWeek ? { ...pet, quest: q } : pet
  const gain = done.length * DAY_QUEST_COINS + (wdone ? WEEK_QUEST_COINS : 0)
  return {
    ...pet,
    coins: Math.min(COINS_MAX, (pet.coins ?? 0) + gain),
    quest: { ...q, done: [...q.done, ...done], wdone: q.wdone || wdone },
    questAt: now,
    questGain: gain,
  }
}

// Лавка (0.61): всё — за монетки из заданий, настоящих денег нет. Печенье — только когда угощений не осталось;
// одежда, игрушки (шалости на полосе), домик и садик (у полосы) и трюки покупаются раз и остаются
export const SHOP = [
  { id: 'cookie', kind: 'food', price: 4 },
  { id: 'party', kind: 'wear', price: 15 },
  { id: 'shades', kind: 'wear', price: 15 },
  { id: 'bandana', kind: 'wear', price: 15 },
  { id: 'tophat', kind: 'wear', price: 20 },
  { id: 'cape', kind: 'wear', price: 25 },
  { id: 'bubbles', kind: 'toy', price: 15 },
  { id: 'kite', kind: 'toy', price: 20 },
  { id: 'bounce', kind: 'trick', price: 15 },
  { id: 'fireworks', kind: 'trick', price: 25 },
  { id: 'garden', kind: 'decor', price: 20 },
  { id: 'house', kind: 'decor', price: 30 },
]
const SHOP_KIND = Object.fromEntries(SHOP.map((x) => [x.id, x.kind]))
// Можно ли купить: хватает монеток, вещи ещё нет, печенье — только без угощений
export function canBuy(pet, id) {
  const item = SHOP.find((x) => x.id === id)
  if (!item || (pet.coins ?? 0) < item.price) return false
  return item.kind === 'food' ? pet.treats < 1 : !(pet.owned ?? []).includes(id)
}
// Купить: одежда сразу надевается, домик или садик сразу встаёт на полосу
export function buy(pet, id) {
  if (!canBuy(pet, id)) return pet
  const item = SHOP.find((x) => x.id === id)
  const paid = { ...pet, coins: pet.coins - item.price }
  if (item.kind === 'food') return { ...paid, treats: 1 }
  const next = { ...paid, owned: [...(pet.owned ?? []), id] }
  // Уже надета (старая запись) — не снимать покупкой
  if (item.kind === 'wear') return next.wear.includes(id) ? next : toggleWear(next, id, [id])
  if (item.kind === 'decor') return { ...next, decor: [...(pet.decor ?? []), id] }
  return next
}
// Убрать или поставить купленную вещь у полосы
export function toggleDecor(pet, id) {
  if (SHOP_KIND[id] !== 'decor' || !(pet.owned ?? []).includes(id)) return pet
  const decor = pet.decor ?? []
  return { ...pet, decor: decor.includes(id) ? decor.filter((x) => x !== id) : [...decor, id] }
}
// Купленные игрушки и трюки — шалости на полосе
export const shopScenes = (pet) => (pet?.owned ?? []).filter((id) => SHOP_KIND[id] === 'toy' || SHOP_KIND[id] === 'trick')

// Облик взрослого (0.59) — по тому, чем кормили больше: карточки — «мастер», ревью — «ревьюер», очереди — «бегун».
// У яйца и малыша облика нет; ровно поровну — «мастер»
export const FORMS = ['maker', 'reviewer', 'runner']
export function formOf(pet) {
  if (!pet || stageOf(pet) !== 'adult') return ''
  const { cards, reviews, queues } = restoreStyle(pet.style)
  if (!cards && !reviews && !queues) return ''
  if (reviews > cards && reviews >= queues) return 'reviewer'
  if (queues > cards && queues > reviews) return 'runner'
  return 'maker'
}

// Трюки (0.59): открываются лучшей серией рабочих дней и потом остаются; питомец показывает их на полосе
export const TRICKS = [
  { id: 'twirl', streak: 2 },
  { id: 'leap', streak: 3 },
  { id: 'dance', streak: 5 },
  { id: 'confetti', streak: 7 },
  { id: 'rainbow', streak: 10 },
]
export const tricksOf = (pet, streak) => {
  const best = Math.max(pet?.best ?? 0, streak)
  return TRICKS.filter((x) => best >= x.streak).map((x) => x.id)
}

// Уголок с вещами (0.59): открывается угощениями (опыт), серией, очередями, ревью и взрослой формой. Не покупается
export const CORNER = [
  { id: 'bed', xp: 3 },
  { id: 'ball', xp: 15 },
  { id: 'plant', streak: 3 },
  { id: 'rug', queues: 3 },
  { id: 'lamp', stage: 'adult' },
  { id: 'picture', reviews: 10 },
]
export function cornerOf(pet, streak) {
  if (!pet) return []
  const best = Math.max(pet.best, streak)
  const style = restoreStyle(pet.style)
  const adult = stageOf(pet) === 'adult'
  return CORNER.filter((c) => (c.xp ? pet.xp >= c.xp : c.streak ? best >= c.streak : c.queues ? style.queues >= c.queues : c.reviews ? style.reviews >= c.reviews : adult)).map((c) => c.id)
}

// Реплика-подсказка (0.59): одна строка по событиям Arcade, без своих таймеров — пересчитывается при перерисовке.
// Порядок: сессия ждёт человека 5 минут и дольше → очередь доски только что пройдена → три карточки за час →
// новый трюк → задание выполнено (0.61) → печенье дня (0.60) → есть угощения, а питомец голоден. Иначе молчит.
// waiting — [{ name, since }] сессий, что ждут ответа; queueAt — когда очередь прошла до конца; dones — когда закрыты
// карточки. Новый трюк — лучшая серия выросла ровно до порога трюка (pet.bestAt) не больше LINE_TRICK_MS назад:
// прерванная серия, дошедшая до того же числа снова, нового трюка не даёт
export const LINE_WAIT_MS = 5 * 60_000
export const LINE_QUEUE_MS = 15 * 60_000
export const LINE_TRICK_MS = 2 * HOUR
export const LINE_COOKIE_MS = 10 * 60_000
export const LINE_QUEST_MS = 10 * 60_000 // задание выполнено — «+N 🪙» (0.61)
export function petLine({ pet, now, waiting = [], queueAt = 0, dones = [] }) {
  if (!pet) return null
  const long = waiting.filter((r) => r && r.since > 0 && now - r.since >= LINE_WAIT_MS).sort((a, b) => a.since - b.since)[0]
  if (long) return { kind: 'wait', name: String(long.name ?? ''), min: Math.floor((now - long.since) / 60_000) }
  if (queueAt && now >= queueAt && now - queueAt < LINE_QUEUE_MS) return { kind: 'queue' }
  const n = dones.filter((at) => at <= now && now - at < HOUR).length
  if (n >= 3) return { kind: 'cards', n }
  const trick = TRICKS.find((x) => x.streak === pet.best)
  if (trick && pet.bestAt && now >= pet.bestAt && now - pet.bestAt < LINE_TRICK_MS) return { kind: 'trick', id: trick.id }
  if (pet.questAt && pet.questGain > 0 && now >= pet.questAt && now - pet.questAt < LINE_QUEST_MS) return { kind: 'quest', n: pet.questGain }
  if (pet.cookieAt && now >= pet.cookieAt && now - pet.cookieAt < LINE_COOKIE_MS) return { kind: 'cookie' }
  if (pet.treats > 0 && stageOf(pet) !== 'egg' && fullness(pet, now) < 25) return { kind: 'hungry' }
  return null
}

export function feed(pet, now) {
  if (pet.treats < 1) return pet
  return {
    ...pet,
    treats: pet.treats - 1,
    xp: pet.xp + 1,
    full: clamp(fullness(pet, now) + FEED_FULL),
    fullAt: now,
    mood: clamp(moodOf(pet, now) + FEED_MOOD),
    moodAt: now,
    fedAt: now,
  }
}

export function pat(pet, now) {
  if (now - pet.patAt < PAT_GAP_MS) return { ...pet, patAt: now }
  return { ...pet, mood: clamp(moodOf(pet, now) + PAT_MOOD), moodAt: now, patAt: now }
}

// Серия: сколько дней подряд (по сегодня или по вчера) была работа — закрытая карточка или принятое ревью в журнале,
// а с 0.60 и законченный ход Claude (more — рабочие дни из питомца)
export function streakOf(log, now, more = []) {
  const days = new Set([...log.filter((x) => x.kind === 'done' || x.kind === 'accept').map((x) => dayKey(x.at)), ...more])
  let day = now
  if (!days.has(dayKey(day))) day -= DAY
  let n = 0
  while (days.has(dayKey(day))) {
    n++
    day -= DAY
  }
  return n
}

// Что открыто: по стадии, опыту и лучшей серии (best — запомненная, журнал помнит только 14 дней)
export function unlocked(pet, streak) {
  const best = Math.max(pet.best, streak)
  const stage = stageOf(pet)
  return UNLOCKS.filter((u) => (u.stage === 'baby' ? stage !== 'egg' : u.stage === 'adult' ? stage === 'adult' : u.xp ? pet.xp >= u.xp : best >= u.streak)).map((u) => u.id)
}

// Надеть или снять: в слоте — одна вещь
export function toggleWear(pet, id, open) {
  if (!WEAR[id]) return pet
  if (pet.wear.includes(id)) return { ...pet, wear: pet.wear.filter((x) => x !== id) }
  if (!open.includes(id)) return pet
  return { ...pet, wear: [...pet.wear.filter((x) => WEAR[x].slot !== WEAR[id].slot), id] }
}

// Что сейчас делает: eat — только покормили; happy — погладили; sleep — ночь или ни одной сессии; sad — сессия ждёт
// человека, голоден или грустно; иначе idle. waiting — сессии, что ждут ответа; sessions — сколько сессий открыто;
// night — спать ли ночью (настройка на экране «Питомец», п. 45)
export function petMood(pet, { now, hour, waiting = 0, sessions = 1, night = true }) {
  if (now - pet.fedAt < EAT_MS) return 'eat'
  if (now - pet.patAt < PAT_MS) return 'happy'
  if (waiting > 0) return 'sad'
  const asleep = night && (hour >= NIGHT[0] || hour < NIGHT[1])
  if (asleep || sessions < 1) return 'sleep'
  if (fullness(pet, now) < 15 || moodOf(pet, now) < 20) return 'sad'
  return 'idle'
}

// Полоса на главном экране (п. 43): что питомец показывает. treat — только покормили или пришло угощение (в том числе
// за очередь доски); happy — погладили; wait — сессия ждёт человека; sleep — ночь; hungry — сидит у пустой миски;
// sad — грустно; done — агент закончил ход; иначе idle (гуляет и шалит)
export const DONE_MS = 60_000 // сколько радуется концу хода
export const TREAT_MS = 8_000 // сколько радуется новому угощению
export function walkReaction(pet, { now, hour, waiting = 0, doneAt = 0, treatAt = 0, night = true }) {
  const mood = petMood(pet, { now, hour, waiting, sessions: 1, night })
  if (mood === 'eat' || now - treatAt < TREAT_MS) return 'treat'
  if (mood === 'happy') return 'happy'
  if (waiting > 0) return 'wait'
  if (mood === 'sleep') return 'sleep'
  if (fullness(pet, now) < 15) return 'hungry'
  if (mood === 'sad') return 'sad'
  if (doneAt && now - doneAt < DONE_MS) return 'done'
  return 'idle'
}

// Когда настроение сменится само (конец еды или сердечек) — чтобы перерисовать экран один раз, без постоянного таймера
export function moodChangeIn(pet, now) {
  const ends = [pet.fedAt + EAT_MS, pet.patAt + PAT_MS].filter((t) => t > now)
  return ends.length ? Math.min(...ends) - now : 0
}

// Для профиля и друзей: только вид, имя, стадия и наряд — без еды и отметок времени
export const petCard = (pet) => (pet ? { species: pet.species, name: pet.name, stage: stageOf(pet), wear: pet.wear } : null)
export function restoreCard(raw) {
  if (!raw || typeof raw !== 'object' || !SPECIES.includes(raw.species)) return null
  return { species: raw.species, name: cleanName(raw.name), stage: ['egg', 'baby', 'adult'].includes(raw.stage) ? raw.stage : 'baby', wear: Array.isArray(raw.wear) ? raw.wear.filter((id) => WEAR[id]).slice(0, 3) : [] }
}
