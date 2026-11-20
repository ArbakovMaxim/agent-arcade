// Питомец (п. 41): угощения из журнала «Итогов дня», сытость и настроение по отметкам времени, наряды, экран в
// терминале (картинка символами, кадры только пока экран открыт) и в Desktop (анимация внутри SVG), уголок на «Сегодня».
// П. 43: гуляет полосой по главному экрану, шалит и откликается на работу; выключатель в настройках
import { expect } from 'claude-code/testing'
import { collect, DONE_MS, EAT_MS, feed, fullness, moodOf, newPet, pat, PAT_MS, petCard, petMood, restoreCard, restorePet, stageOf, streakOf, toggleWear, TREAT_MS, TREATS_MAX, unlocked, walkReaction } from '../hooks/pet.js'
import { PET_SCENES, petSvg, petWalkSvg, pickScene, SPECIES } from '../hooks/petart.js'
import { petCells } from '../hooks/register.js'
import { HEAVY, PANE, WINDOWS, drawnTexts, go, start, stubs, test } from './kit.ts'

// Пятница, 20 ноября 2026, 13:00 по местному времени — день, питомец не спит
const T0 = new Date(2026, 10, 20, 13, 0).getTime()
const H = 3_600_000
const DAY = 24 * H
const entry = (at: number, kind: string, id: string, more: any = {}) => ({ at, kind, id, title: `Карточка ${id}`, board: 'Спринт', ...more })

// Ключ поля с номером (arcade-pet-name-N): номер растёт после каждой отправки
async function fieldKey(ui: any, prefix: string) {
  let found: string | undefined
  const walk = (n: any) => {
    if (found || !n || typeof n !== 'object') return
    const key = n.props?.key ?? n.key
    if (typeof key === 'string' && key.startsWith(prefix)) found = key
    for (const c of n.children ?? []) walk(c)
  }
  walk(await ui.drawn())
  if (!found) throw new Error(`нет поля ${prefix}`)
  return found
}
const petBlits = (blits: any[]) => blits.filter((b) => b.key === 'arcade-pet')

test('питомец: угощения — за закрытые карточки, принятые ревью и зелёные проверки; одна карточка — раз в день', () => {
  const pet = newPet('fox', '  Рыжик\n ', T0)
  expect(pet).toMatchObject({ species: 'fox', name: 'Рыжик', treats: 1, xp: 0, counted: T0 })
  expect(stageOf(pet)).toBe('egg')
  const at = T0 + 60_000
  const log = [
    entry(T0 - 1_000, 'done', 'old'), // до появления питомца — не еда
    entry(at, 'done', 'a'),
    entry(at + 1, 'done', 'a'), // та же карточка в тот же день — без нового угощения
    entry(at + 2, 'accept', 'a'), // принять ревью — отдельная работа
    entry(at + 3, 'check', 'b', { ok: true }),
    entry(at + 4, 'check', 'c', { ok: false }), // красная проверка — ничего
    entry(at + 5, 'return', 'd'), // вернуть с комментарием — ничего
    entry(at + 6, 'checked', 'e'), // пункты чек-листа — не еда
  ]
  const got = collect(pet, log, at + 10)
  expect(got.treats).toBe(4)
  // Ничего нового — та же запись: в хранилище писать нечего
  expect(collect(got, log, at + 20)).toBe(got)
  // Перетащили ту же карточку туда-обратно в тот же день — без угощения; назавтра — снова еда
  expect(collect(got, [...log, entry(at + 30, 'done', 'a')], at + 40)).toBe(got)
  expect(collect(got, [...log, entry(at + DAY, 'done', 'a')], at + DAY + 1).treats).toBe(5)
  // Очередь доски до конца — ещё 2; больше 99 не копится
  expect(collect(got, log, at + 20, 1).treats).toBe(6)
  expect(collect(got, log, at + 20, 500).treats).toBe(TREATS_MAX)
})

test('питомец: покормить, погладить, сытость и настроение со временем; что делает', () => {
  const pet = { ...newPet('owl', 'Ухти', T0), treats: 2 }
  // Сытость: 60 и −4 в час, не ниже нуля
  expect(fullness(pet, T0 + 10 * H)).toBe(20)
  expect(fullness(pet, T0 + 100 * H)).toBe(0)
  // Голодный грустит быстрее
  expect(moodOf(pet, T0 + 5 * H)).toBe(55)
  expect(moodOf(pet, T0 + 10 * H)).toBe(10)
  const eaten = feed(pet, T0 + 1_000)
  expect(eaten).toMatchObject({ treats: 1, xp: 1, fedAt: T0 + 1_000 })
  expect(stageOf(eaten)).toBe('baby')
  expect(Math.round(fullness(eaten, T0 + 1_000))).toBe(85)
  const none = { ...eaten, treats: 0 }
  expect(feed(none, T0 + 2_000)).toBe(none)
  // Что делает: ест, радуется после «Погладить», грустит, пока сессия ждёт, спит ночью и без сессий
  const day = { hour: 13 }
  expect(petMood(eaten, { now: T0 + 2_000, ...day })).toBe('eat')
  expect(petMood(eaten, { now: T0 + 1_000 + EAT_MS, ...day })).toBe('idle')
  expect(petMood(eaten, { now: T0 + 5_000, ...day, waiting: 1 })).toBe('sad')
  expect(petMood(eaten, { now: T0 + 5_000, hour: 23 })).toBe('sleep')
  expect(petMood(eaten, { now: T0 + 5_000, hour: 6 })).toBe('sleep')
  expect(petMood(eaten, { now: T0 + 5_000, ...day, sessions: 0 })).toBe('sleep')
  expect(petMood(pet, { now: T0 + 12 * H, ...day })).toBe('sad')
  const petted = pat(eaten, T0 + 10_000)
  expect(petted.mood).toBeGreaterThan(moodOf(eaten, T0 + 10_000))
  expect(petMood(petted, { now: T0 + 10_000 + PAT_MS - 1, ...day, waiting: 1 })).toBe('happy')
  // Гладить подряд — сердечки есть, лишних очков нет
  const again = pat(petted, T0 + 10_500)
  expect(again.mood).toBe(petted.mood)
  expect(again.patAt).toBe(T0 + 10_500)
})

test('питомец: наряды открываются стадией, опытом и серией; в слоте — одна вещь; запись из хранилища проверяется', () => {
  const egg = newPet('robot', 'Бип', T0)
  expect(unlocked(egg, 0)).toEqual([])
  expect(unlocked({ ...egg, xp: 1 }, 0)).toEqual(['scarf'])
  expect(unlocked({ ...egg, xp: 10 }, 2)).toEqual(['scarf', 'cap', 'bow'])
  expect(unlocked({ ...egg, xp: 30, best: 5 }, 0)).toEqual(['scarf', 'cap', 'bow', 'glasses', 'beanie', 'crown'])
  const grown = { ...egg, xp: 30, best: 5 }
  const open = unlocked(grown, 0)
  const capped = toggleWear(grown, 'cap', open)
  expect(capped.wear).toEqual(['cap'])
  // Корона — на ту же голову: кепка снимается
  expect(toggleWear(capped, 'crown', open).wear).toEqual(['crown'])
  expect(toggleWear(toggleWear(capped, 'bow', open), 'glasses', open).wear).toEqual(['cap', 'bow', 'glasses'])
  expect(toggleWear(capped, 'cap', open).wear).toEqual([])
  // Закрытое не надеть
  expect(toggleWear(egg, 'crown', unlocked(egg, 0))).toBe(egg)
  // Серия — дни подряд по сегодня или по вчера
  const days = (...ago: number[]) => ago.map((n, i) => entry(T0 - n * DAY, 'done', `s${i}`))
  expect(streakOf(days(0, 1, 2), T0)).toBe(3)
  expect(streakOf(days(1, 2), T0)).toBe(2)
  expect(streakOf(days(0, 2, 3), T0)).toBe(1)
  expect(streakOf([entry(T0, 'check', 'x', { ok: true })], T0)).toBe(0)
  // Из хранилища: чужое — null, лишнее — обрезано
  expect(restorePet(null, T0)).toBe(null)
  expect(restorePet({ species: 'cat', name: 'Мурка' }, T0)).toBe(null)
  const back = restorePet({ species: 'drop', name: 'x'.repeat(40), treats: 500, xp: -3, full: 300, wear: ['cap', 'zzz', 'cap'], fedAt: T0 + 10 * DAY }, T0)
  expect(back).toMatchObject({ species: 'drop', treats: TREATS_MAX, xp: 0, full: 100, wear: ['cap'], fedAt: 0 })
  expect(back?.name.length).toBe(24)
  // Для друзей — без еды и отметок времени
  expect(petCard(grown)).toEqual({ species: 'robot', name: 'Бип', stage: 'adult', wear: [] })
  expect(restoreCard({ species: 'fox', name: 'Лис', stage: 'zzz', wear: ['crown', 'zzz'] })).toEqual({ species: 'fox', name: 'Лис', stage: 'baby', wear: ['crown'] })
})

test('питомец: картинки — SVG не длиннее 131 072 знаков, кадр терминала 32×16 клеток', () => {
  for (const species of SPECIES)
    for (const stage of ['egg', 'baby', 'adult'])
      for (const mood of ['idle', 'eat', 'happy', 'sleep', 'sad']) {
        const svg = petSvg({ species, stage, mood, wear: ['crown', 'bow', 'glasses'], pat: true, walk: true, size: 160 })
        expect(svg.startsWith('<svg')).toBe(true)
        expect(svg.length <= 131_072).toBe(true)
      }
  const pet = { ...newPet('dragon', 'Искра', T0), xp: 5 }
  const cells = petCells(pet, 'idle', 0)
  // 32×16 клеток по три числа u32 — 6144 байта, в base64 — 8192 знака
  expect(cells.length).toBe(8192)
  // Кадры разные: дыхание и моргание
  expect(petCells(pet, 'idle', 1) === cells).toBe(false)
})

test('питомец в терминале: плитка в «Ещё», строка на главном, выбрать вид и имя, покормить; кадры — только пока экран открыт', HEAVY, async ($, on) => {
  const { clock, saved, blits } = stubs(on, { env: WINDOWS })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await ui.find({ key: 'arcade-menu-pet' })).toMatchObject({ props: { label: 'Питомец' } })
  expect(await ui.find({ type: 'Text', text: '  растёт от закрытых карточек, ревью и проверок' })).toBeDefined()
  // На главном в терминале — одна строка без кадров: питомца ещё нет — к выбору вида
  expect(await ui.find({ key: 'arcade-pet-strip-open' })).toMatchObject({ props: { label: 'Питомец: выбрать, кто это' } })
  expect(await ui.find({ key: 'arcade-pet-strip' })).toBeUndefined()
  // Питомца нет — на «Сегодня» уголка нет
  await ui.press({ key: 'arcade-menu-today' })
  await clock.advance(50)
  expect(await ui.find({ key: 'today-pet' })).toBeUndefined()
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-kind-robot' })).toMatchObject({ props: { label: '● Робот' } })
  await ui.press({ key: 'arcade-pet-kind-owl' })
  expect(await ui.find({ key: 'arcade-pet-kind-owl' })).toMatchObject({ props: { label: '● Сова' } })
  expect(await ui.find({ key: 'arcade-pet-kind-robot' })).toMatchObject({ props: { label: '○ Робот' } })
  // Пустое имя — подсказка, питомца нет
  await ui.input({ key: await fieldKey(ui, 'arcade-pet-name-'), text: '   ', kind: 'submit' })
  expect(await ui.find({ type: 'Text', text: 'Впиши имя питомца.' })).toBeDefined()
  expect(saved.has('pet')).toBe(false)
  await ui.input({ key: await fieldKey(ui, 'arcade-pet-name-'), text: 'Ухти', kind: 'submit' })
  await clock.advance(50)
  expect(saved.get('pet')).toMatchObject({ species: 'owl', name: 'Ухти', treats: 1, xp: 0 })
  expect(await ui.find({ key: 'arcade-pet' })).toMatchObject({ type: 'Raster', props: { columns: 32, rows: 16 } })
  expect(await ui.find({ type: 'Text', text: 'Ухти · Яйцо · Сова' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Яйцо: покорми — и вылупится' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Угощения: 1' })).toBeDefined()
  // Покормить: яйцо вылупилось и ест; угощений больше нет — подсказка, откуда они
  await ui.press({ key: 'arcade-pet-feed' })
  await clock.advance(50)
  expect(saved.get('pet')).toMatchObject({ treats: 0, xp: 1 })
  expect(await ui.find({ type: 'Text', text: 'Ухти · Малыш · Сова' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Ест' })).toMatchObject({ props: { color: 'success' } })
  expect(await ui.find({ type: 'Text', text: /^Угощения — за закрытые карточки/ })).toBeDefined()
  await ui.press({ key: 'arcade-pet-feed' })
  expect(await ui.find({ type: 'Text', text: 'Угощений пока нет.' })).toBeDefined()
  // Поел — гуляет: одна перерисовка в конце еды, без постоянного таймера
  await clock.advance(3_000)
  expect(await ui.find({ type: 'Text', text: 'Гуляет' })).toBeDefined()
  // Шарф открылся, как только вылупился; остальное — чем открыть
  expect(await ui.find({ key: 'arcade-pet-wear-scarf' })).toMatchObject({ props: { label: 'Шарф' } })
  expect(await ui.find({ type: 'Text', text: 'Кепка — после 10 угощений' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Корона — 5 дн. подряд с закрытыми карточками' })).toBeDefined()
  // Кадры идут, пока экран открыт
  const first = petBlits(blits).length
  await clock.advance(1_300)
  const shown = petBlits(blits)
  expect(shown.length - first >= 2).toBe(true)
  expect(shown.at(-1)).toMatchObject({ requestId: 'arcade', columns: 32, rows: 16 })
  expect(typeof shown.at(-1).cells).toBe('string')
  // Ушли с экрана — кадров больше нет
  await ui.press({ key: 'arcade-back' })
  await clock.advance(1_300)
  const after = petBlits(blits).length
  await clock.advance(3_000)
  expect(petBlits(blits).length).toBe(after)
  expect(await ui.find({ key: 'arcade-menu-pet' })).toBeDefined()
  expect((await ui.find({ key: 'arcade-pet-strip-open' })).props.label.startsWith('Ухти · ')).toBe(true)
  await ui.unmount()
})

test('питомец в Desktop: угощения из журнала при открытии, голодный грустит, анимация SVG, наряды и новое имя', HEAVY, async ($, on) => {
  const born = T0 - 2 * DAY
  const pet = { ...newPet('dragon', 'Искра', born), xp: 12, treats: 0 }
  const daylog = [entry(T0 - DAY, 'done', 'y1'), entry(T0 - 60_000, 'done', 'k1'), entry(T0 - 50_000, 'accept', 'k1'), entry(T0 - 40_000, 'check', 'k2', { ok: false })]
  const { clock, saved } = stubs(on, { env: WINDOWS, stored: { pet, daylog } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  // Вчера и сегодня закрыты карточки: три угощения, серия 2 дня
  expect(saved.get('pet')).toMatchObject({ treats: 3, best: 2 })
  expect(await ui.find({ type: 'Text', text: 'Угощения: 3' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Серия: 2 дн. подряд' })).toBeDefined()
  // Двое суток без еды: сытость на нуле — грустит и просит есть
  expect(await ui.find({ type: 'Text', text: 'Грустит: хочет есть' })).toMatchObject({ props: { color: 'warning' } })
  const svgs = await ui.findAll({ type: 'Svg' })
  const big = svgs.filter((s: any) => s.props.isInteractive === true)
  expect(big.length).toBe(1)
  expect(big[0].props).toMatchObject({ width: 160, height: 160, alt: 'Искра' })
  expect(big[0].props.source.length <= 131_072).toBe(true)
  expect(svgs.some((s: any) => s.props.alt === '0%')).toBe(true)
  // Покормить — новая картинка: сердечки и еда проигрываются снова
  await ui.press({ key: 'arcade-pet-feed' })
  await clock.advance(50)
  const fed = (await ui.findAll({ type: 'Svg' })).find((s: any) => s.props.isInteractive === true)
  expect(fed.props.source === big[0].props.source).toBe(false)
  expect(saved.get('pet')).toMatchObject({ treats: 2, xp: 13 })
  // Наряды: шарф, кепка и бабочка открыты; надеть и снять
  expect(await ui.find({ key: 'arcade-pet-wear-bow' })).toMatchObject({ props: { label: 'Бабочка' } })
  expect(await ui.find({ key: 'arcade-pet-wear-glasses' })).toBeUndefined()
  await ui.press({ key: 'arcade-pet-wear-cap' })
  await clock.advance(50)
  expect(saved.get('pet').wear).toEqual(['cap'])
  expect(await ui.find({ key: 'arcade-pet-wear-cap' })).toMatchObject({ props: { label: '✓ Кепка' } })
  await ui.press({ key: 'arcade-pet-wear-cap' })
  await clock.advance(50)
  expect(saved.get('pet').wear).toEqual([])
  // Новое имя
  await ui.press({ key: 'arcade-pet-rename' })
  await ui.input({ key: await fieldKey(ui, 'arcade-pet-rename-'), text: 'Искорка', kind: 'submit' })
  await clock.advance(50)
  expect(saved.get('pet').name).toBe('Искорка')
  expect(await ui.find({ key: 'arcade-pet-rename' })).toBeDefined()
  await ui.unmount()
})

test('питомец на «Сегодня»: уголок, когда не гуляет по главному, — что делает и угощения; оттуда — на экран и назад', HEAVY, async ($, on) => {
  const pet = { ...newPet('fox', 'Рыжик', T0 - H), xp: 3, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet, daylog: [entry(T0 - 1_000, 'done', 'k1')], petWalk: false } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  // Выключен — полосы на главном нет, вход — плиткой в «Ещё»
  expect(await ui.find({ key: 'arcade-pet-strip-open' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-menu-pet' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-today' })
  await clock.advance(50)
  expect(await ui.find({ key: 'today-pet' })).toMatchObject({ props: { label: 'Рыжик · Гуляет · угощений: 1' } })
  await ui.press({ key: 'today-pet' })
  await clock.advance(50)
  expect(await ui.find({ type: 'Text', text: 'Рыжик · Малыш · Лиса' })).toBeDefined()
  await ui.press({ key: 'arcade-back' })
  await clock.advance(50)
  expect(await ui.find({ key: 'today-pet' })).toBeDefined()
  await ui.unmount()
  // В Desktop — с картинкой, без анимации
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  if (!(await desk.find({ key: 'today-pet' }))) await go(desk, 'arcade-menu-today')
  await clock.advance(50)
  const small = (await desk.findAll({ type: 'Svg' })).filter((s: any) => s.props.alt === 'Рыжик')
  expect(small.length).toBe(1)
  expect(small[0].props).toMatchObject({ width: 48, height: 48 })
  expect(small[0].props.isInteractive).toBeUndefined()
  await desk.unmount()
})

test('питомец по-английски: экран без русских строк', HEAVY, async ($, on) => {
  const pet = { ...newPet('drop', 'Spark', T0 - H), xp: 2, treats: 0 }
  const { clock } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, stored: { pet } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  for (const surface of ['terminal', 'desktop']) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (!(await ui.find({ key: 'arcade-menu-pet' }))) await ui.press({ key: 'arcade-back' })
    expect(await ui.find({ key: 'arcade-menu-pet' })).toMatchObject({ props: { label: 'Pet' } })
    expect(await ui.find({ key: 'arcade-pet-strip-open' })).toMatchObject({ props: { label: 'Spark · Walking around · treats: 0' } })
    await ui.press({ key: 'arcade-menu-pet' })
    await clock.advance(50)
    expect(await ui.find({ key: 'arcade-pet-feed' })).toMatchObject({ props: { label: 'Feed' } })
    expect(await ui.find({ type: 'Text', text: 'Spark · Baby · Droplet' })).toBeDefined()
    const russian = (await drawnTexts(ui)).filter((s) => /[а-яё]/i.test(s))
    expect(russian).toEqual([])
    await ui.press({ key: 'arcade-back' })
    await ui.unmount()
  }
})

test('питомец на главном: что показывает — угощение, радость, ждёт, конец хода, ночь, голод, грусть', () => {
  const pet = { ...newPet('fox', 'Рыжик', T0), xp: 3 }
  const at = T0 + 10_000
  const day = { now: at, hour: 13 }
  expect(walkReaction(pet, day)).toBe('idle')
  expect(walkReaction(pet, { ...day, doneAt: at - 1_000 })).toBe('done')
  expect(walkReaction(pet, { ...day, doneAt: at - DONE_MS })).toBe('idle')
  expect(walkReaction(pet, { ...day, treatAt: at - 1_000 })).toBe('treat')
  expect(walkReaction(pet, { ...day, treatAt: at - TREAT_MS })).toBe('idle')
  expect(walkReaction({ ...pet, fedAt: at - 1_000 }, day)).toBe('treat')
  expect(walkReaction({ ...pet, patAt: at - 1_000 }, { ...day, waiting: 1 })).toBe('happy')
  // Сессия ждёт — важнее конца хода и ночи
  expect(walkReaction(pet, { ...day, waiting: 1, doneAt: at - 1_000 })).toBe('wait')
  expect(walkReaction(pet, { now: at, hour: 23, waiting: 2 })).toBe('wait')
  expect(walkReaction(pet, { now: at, hour: 23, doneAt: at - 1_000 })).toBe('sleep')
  expect(walkReaction(pet, { now: at, hour: 3 })).toBe('sleep')
  // Голодный сидит у пустой миски, грустный — грустит; ночью оба спят
  expect(walkReaction(pet, { now: T0 + 12 * H, hour: 13 })).toBe('hungry')
  expect(walkReaction(pet, { now: T0 + 12 * H, hour: 1 })).toBe('sleep')
  expect(walkReaction({ ...pet, mood: 10 }, day)).toBe('sad')
})

test('питомец на главном: шалость не повторяет прошлую, шапку роняет только в шапке; картинка полосы', () => {
  for (const r of [0, 0.2, 0.5, 0.8, 0.999]) {
    const scene = pickScene(r, 'peek')
    expect(PET_SCENES.includes(scene) && scene !== 'peek').toBe(true)
    expect(pickScene(r, '', { hat: false }) === 'hat').toBe(false)
  }
  expect(new Set([0, 0.15, 0.3, 0.45, 0.6, 0.75, 0.9].map((r) => pickScene(r))).size).toBe(PET_SCENES.length)
  for (const species of SPECIES)
    for (const reaction of ['idle', 'done', 'treat', 'happy', 'wait', 'sleep', 'hungry', 'sad'])
      for (const scene of PET_SCENES) {
        const svg = petWalkSvg({ species, stage: 'adult', wear: ['crown', 'scarf', 'glasses'], scene, reaction, width: 1400 })
        expect(svg.startsWith('<svg') && svg.length <= 131_072).toBe(true)
      }
  // Те же вводные — та же картинка: Desktop не начинает анимацию заново от перерисовки
  const one = { species: 'fox', stage: 'baby', wear: ['bow'], scene: 'ball', reaction: 'idle', width: 600 }
  expect(petWalkSvg(one)).toBe(petWalkSvg({ ...one }))
  expect(petWalkSvg({ ...one, scene: 'star' }) === petWalkSvg(one)).toBe(false)
  // Яйцо качается; питомца нет — тоже яйцо
  expect(petWalkSvg({ species: 'owl', stage: 'egg' }) === petWalkSvg({ species: 'owl', stage: 'baby' })).toBe(false)
  expect(petWalkSvg({ species: '', stage: 'baby' }).startsWith('<svg')).toBe(true)
})

test('питомец гуляет по главному экрану Desktop: полоса под шапкой, шалость при входе, «Питомец» — в «Ещё»', HEAVY, async ($, on) => {
  const pet = { ...newPet('dragon', 'Искра', T0 - H), xp: 5, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const strip = async () => (await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.isInteractive === true)
  const label = async () => (await ui.find({ key: 'arcade-pet-strip-open' }))?.props.label
  expect(await ui.find({ key: 'arcade-pet-strip' })).toBeDefined()
  const first = await strip()
  expect(first.length).toBe(1)
  // Во всю ширину тела панели: 60 клеток без двух — по 7,5 пикселя
  expect(first[0].props).toMatchObject({ alt: 'Искра', width: 435, height: 72 })
  expect(first[0].props.source.length <= 131_072).toBe(true)
  expect(await label()).toBe('Искра · Гуляет · угощений: 0')
  // «Питомца» нет в «Работе»: свернули «Работу» — плитка на месте; свернули «Ещё» — пропала
  await ui.press({ key: 'arcade-fold-work' })
  expect(await ui.find({ key: 'arcade-menu-pet' })).toBeDefined()
  // Перерисовка без ухода с главного — та же картинка, анимация не начинается заново
  expect((await strip())[0].props.source).toBe(first[0].props.source)
  await ui.press({ key: 'arcade-fold-more' })
  expect(await ui.find({ key: 'arcade-menu-pet' })).toBeUndefined()
  await ui.press({ key: 'arcade-fold-more' })
  await ui.press({ key: 'arcade-fold-work' })
  // Нажатие — экран питомца; назад — снова гуляет, с новой шалостью, фокус на полосе
  await ui.press({ key: 'arcade-pet-strip-open' })
  await clock.advance(50)
  expect(await ui.find({ type: 'Text', text: 'Искра · Малыш · Дракон' })).toBeDefined()
  await ui.press({ key: 'arcade-back' })
  await clock.advance(50)
  expect((await strip())[0].props.source === first[0].props.source).toBe(false)
  expect(await ui.find({ key: 'arcade-pet-strip-open' })).toMatchObject({ props: { autoFocus: true } })
  await ui.unmount()
})

test('питомец гуляет по главному экрану Desktop: конец хода — радуется минуту, потом снова гуляет', HEAVY, async ($, on) => {
  const pet = { ...newPet('dragon', 'Искра', T0 - H), xp: 5, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await ui.find({ key: 'arcade-pet-strip-open' }))?.props.label
  expect(await label()).toBe('Искра · Гуляет · угощений: 0')
  // Агент закончил ход — радуется минуту, потом одна перерисовка — снова гуляет
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'answer' })
  await clock.advance(50)
  expect(await label()).toBe('Искра · Радуется: агент закончил · угощений: 0')
  await clock.advance(DONE_MS + 1_000)
  expect(await label()).toBe('Искра · Гуляет · угощений: 0')
  await ui.unmount()
})

// Ночь — с запуска: перевод часов на 10 часов вперёд прокрутил бы все таймеры мода за это время
test('питомец гуляет по главному экрану Desktop: ночью спит', HEAVY, async ($, on) => {
  const night = new Date(2026, 10, 20, 23, 30).getTime()
  const pet = { ...newPet('dragon', 'Искра', night - H), xp: 5, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet } })
  await clock.set(night)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'arcade-pet-strip-open' }))?.props.label).toBe('Искра · Спит · угощений: 0')
  await ui.unmount()
})

test('питомец на главном: выключатель в настройках — полосы нет, «Питомец» в «Ещё» и уголком на «Сегодня»; включили — гуляет', HEAVY, async ($, on) => {
  const pet = { ...newPet('owl', 'Ухти', T0 - H), xp: 2, treats: 1 }
  const { clock, saved } = stubs(on, { env: WINDOWS, stored: { pet } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'arcade-pet-strip' })).toBeDefined()
  // Гуляет — на «Сегодня» уголка нет
  await ui.press({ key: 'arcade-menu-today' })
  await clock.advance(50)
  expect(await ui.find({ key: 'today-pet' })).toBeUndefined()
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-pet-walk' })).toMatchObject({ props: { label: 'Питомец гуляет по Arcade: да' } })
  await ui.press({ key: 'arcade-pet-walk' })
  expect(await ui.find({ key: 'arcade-pet-walk' })).toMatchObject({ props: { label: 'Питомец гуляет по Arcade: нет' } })
  await clock.advance(50)
  expect(saved.get('petWalk')).toBe(false)
  await ui.press({ key: 'arcade-back' })
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-strip' })).toBeUndefined()
  expect((await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.isInteractive === true).length).toBe(0)
  expect(await ui.find({ key: 'arcade-menu-pet' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-today' })
  await clock.advance(50)
  expect(await ui.find({ key: 'today-pet' })).toMatchObject({ props: { label: 'Ухти · Гуляет · угощений: 1' } })
  await ui.press({ key: 'arcade-back' })
  // Снова включили — гуляет
  await go(ui, 'arcade-pet-walk')
  await clock.advance(50)
  expect(saved.get('petWalk')).toBe(true)
  await ui.press({ key: 'arcade-back' })
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-strip' })).toBeDefined()
  await ui.unmount()
})

test('питомец на главном: яйцо до выбора вида — нажатие ведёт к выбору', HEAVY, async ($, on) => {
  const { clock } = stubs(on, { env: WINDOWS })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const desk = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const egg = (await desk.findAll({ type: 'Svg' })).filter((s: any) => s.props.isInteractive === true)
  expect(egg.length).toBe(1)
  expect(egg[0].props.alt).toBe('Питомец')
  expect(await desk.find({ key: 'arcade-pet-strip-open' })).toMatchObject({ props: { label: 'Питомец: выбрать, кто это' } })
  await desk.press({ key: 'arcade-pet-strip-open' })
  await clock.advance(50)
  expect(await desk.find({ key: 'arcade-pet-kind-robot' })).toBeDefined()
  await desk.unmount()
})

test('питомец на главном: выключен в хранилище — с запуска не гуляет', HEAVY, async ($, on) => {
  const pet = { ...newPet('robot', 'Бип', T0 - H), xp: 2, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet, petWalk: false } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'arcade-pet-strip' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-menu-pet' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-settings' })
  expect(await ui.find({ key: 'arcade-pet-walk' })).toMatchObject({ props: { label: 'Питомец гуляет по Arcade: нет' } })
  await ui.unmount()
})
