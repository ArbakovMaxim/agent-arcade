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

const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n))

// Одежда открывается уровнем или серией дней с закрытыми карточками. Покупок нет
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
  }
}

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
  for (const x of log) {
    if (x.at <= pet.counted || x.at > now || !FOOD(x) || seen.has(foodKey(x))) continue
    seen.add(foodKey(x))
    n++
  }
  if (!n) return pet
  return { ...pet, treats: Math.min(TREATS_MAX, pet.treats + n), counted: Math.max(pet.counted, now) }
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

// Серия: сколько дней подряд (по сегодня или по вчера) в журнале есть закрытая карточка или принятое ревью
export function streakOf(log, now) {
  const days = new Set(log.filter((x) => x.kind === 'done' || x.kind === 'accept').map((x) => dayKey(x.at)))
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
// человека, голоден или грустно; иначе idle. waiting — сессии, что ждут ответа; sessions — сколько сессий открыто
export function petMood(pet, { now, hour, waiting = 0, sessions = 1 }) {
  if (now - pet.fedAt < EAT_MS) return 'eat'
  if (now - pet.patAt < PAT_MS) return 'happy'
  if (waiting > 0) return 'sad'
  const night = hour >= NIGHT[0] || hour < NIGHT[1]
  if (night || sessions < 1) return 'sleep'
  if (fullness(pet, now) < 15 || moodOf(pet, now) < 20) return 'sad'
  return 'idle'
}

// Полоса на главном экране (п. 43): что питомец показывает. treat — только покормили или пришло угощение (в том числе
// за очередь доски); happy — погладили; wait — сессия ждёт человека; sleep — ночь; hungry — сидит у пустой миски;
// sad — грустно; done — агент закончил ход; иначе idle (гуляет и шалит)
export const DONE_MS = 60_000 // сколько радуется концу хода
export const TREAT_MS = 8_000 // сколько радуется новому угощению
export function walkReaction(pet, { now, hour, waiting = 0, doneAt = 0, treatAt = 0 }) {
  const mood = petMood(pet, { now, hour, waiting, sessions: 1 })
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
