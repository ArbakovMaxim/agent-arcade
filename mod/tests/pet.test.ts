// Питомец (п. 41): угощения из журнала «Итогов дня», сытость и настроение по отметкам времени, наряды, экран в
// терминале (картинка символами, кадры только пока экран открыт) и в Desktop (анимация внутри SVG), уголок на «Сегодня».
// П. 43: гуляет полосой по главному экрану, шалит и откликается на работу; выключатель в настройках.
// 0.59: облик взрослого по стилю работы, трюки за серии, уголок с вещами, реплики-подсказки.
// 0.60 (п. 47): печенье дня, угощения за ходы Claude, серия по рабочим дням
// 0.61 (п. 47): задания дня и недели, монетки 🪙 и лавка
// 0.62.1 (п. 48): бесконечные петли — неподвижные кадры по 0,2 с, чтобы питомец не стоил ядра процессора
import { expect } from 'claude-code/testing'
import { buy, canBuy, collect, CORNER, cornerOf, DAILY_COOKIES, dailyCookie, DAY_QUEST_COINS, DAY_QUESTS, dayQuests, DONE_MS, EAT_MS, feed, FORMS, formOf, fullness, LINE_COOKIE_MS, LINE_QUEST_MS, LINE_QUEUE_MS, LINE_TRICK_MS, LINE_WAIT_MS, moodOf, newPet, pat, PAT_MS, petCard, petLine, petMood, questCheck, questMark, questProgress, restoreCard, restorePet, SHOP, shopScenes, stageOf, streakOf, toggleDecor, toggleWear, TREAT_MS, TREATS_MAX, TRICKS, tricksOf, TURN_TREATS_DAY, turnFed, turnsToday, unlocked, walkReaction, WEEK_QUEST_COINS, WEEK_QUESTS, weekKey, weekQuest } from '../hooks/pet.js'
import { dayKey } from '../hooks/calendar.js'
import { CORNER_ITEMS, FORM_COLOR, PET_SCENES, petBadgeSvg, petCornerSvg, petSvg, petWalkSvg, pickScene, SHOP_SCENES, SPECIES, stepFrames, TRICK_SCENES } from '../hooks/petart.js'
import { petCells } from '../hooks/register.js'
import { HEAVY, PANE, WINDOWS, drawnTexts, go, start, stubs, test } from './kit.ts'

// Пятница, 20 ноября 2026, 13:00 по местному времени — день, питомец не спит
const T0 = new Date(2026, 10, 20, 13, 0).getTime()
const H = 3_600_000
const DAY = 24 * H
const entry = (at: number, kind: string, id: string, more: any = {}) => ({ at, kind, id, title: `Карточка ${id}`, board: 'Спринт', ...more })
// Печенье дня (0.60) за сегодня уже выдано — проверки угощений до 0.60 считают без него
const cookied = (pet: any) => ({ ...pet, cookieDay: dayKey(T0) })

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
  expect(await ui.find({ type: 'Text', text: 'Корона — 5 дн. подряд с работой' })).toBeDefined()
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
  const { clock, saved } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet), daylog } })
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
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet), daylog: [entry(T0 - 1_000, 'done', 'k1')], petWalk: false } })
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
  const { clock } = stubs(on, { env: { ...WINDOWS, LANG: 'en_US.UTF-8' }, stored: { pet: cookied(pet) } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  for (const surface of ['terminal', 'desktop']) {
    const ui = await $.ui.mount({ ...PANE, surface })
    if (!(await ui.find({ key: 'arcade-menu-pet' }))) await ui.press({ key: 'arcade-back' })
    expect(await ui.find({ key: 'arcade-menu-pet' })).toMatchObject({ props: { label: 'Pet' } })
    expect(await ui.find({ key: 'arcade-pet-strip-open' })).toMatchObject({ props: { label: 'Spark · Walking around · treats: 0 · 🪙 0' } })
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
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
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
  expect(await label()).toBe('Искра · Гуляет · угощений: 0 · 🪙 0')
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
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async () => (await ui.find({ key: 'arcade-pet-strip-open' }))?.props.label
  expect(await label()).toBe('Искра · Гуляет · угощений: 0 · 🪙 0')
  // Агент закончил ход — радуется минуту, потом одна перерисовка — снова гуляет
  await $.turn.start({ turnId: 't1', text: 'почини тесты' })
  await $.turn.complete({ turnId: 't1', answer: '', reason: 'answer' })
  await clock.advance(50)
  expect(await label()).toBe('Искра · Радуется: агент закончил · угощений: 0 · 🪙 0')
  await clock.advance(DONE_MS + 1_000)
  expect(await label()).toBe('Искра · Гуляет · угощений: 0 · 🪙 0')
  await ui.unmount()
})

// Ночь — с запуска: перевод часов на 10 часов вперёд прокрутил бы все таймеры мода за это время
test('питомец гуляет по главному экрану Desktop: ночью спит', HEAVY, async ($, on) => {
  const night = new Date(2026, 10, 20, 23, 30).getTime()
  const pet = { ...newPet('dragon', 'Искра', night - H), xp: 5, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
  await clock.set(night)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'arcade-pet-strip-open' }))?.props.label).toBe('Искра · Спит · угощений: 0 · 🪙 0')
  await ui.unmount()
})

test('питомец на главном: выключатель на экране питомца — полосы нет, «Питомец» в «Ещё» и уголком на «Сегодня»; включили — гуляет', HEAVY, async ($, on) => {
  const pet = { ...newPet('owl', 'Ухти', T0 - H), xp: 2, treats: 1 }
  const { clock, saved } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
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
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
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
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet), petWalk: false } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'arcade-pet-strip' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-menu-pet' })).toBeDefined()
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-walk' })).toMatchObject({ props: { label: 'Питомец гуляет по Arcade: нет' } })
  // Не гуляет — остальных переключателей прогулки нет, сон ночью — есть
  expect(await ui.find({ key: 'arcade-pet-screens' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-pet-follow' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-pet-size' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-pet-night' })).toBeDefined()
  // И маленького на других экранах нет
  await ui.press({ key: 'arcade-back' })
  await ui.press({ key: 'arcade-menu-settings' })
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-badge-settings' })).toBeUndefined()
  await ui.unmount()
})

// ━━━━━━━━━━ п. 45: маленький питомец на других экранах, прокрутка, размер, сон ━━━━━━━━━━

const REACTIONS = ['idle', 'treat', 'happy', 'done', 'wait', 'hungry', 'sad', 'sleep']

test('маленький питомец: картинка входа своя у каждого вида, одинаковая для одних вводных, в пределах размера', () => {
  for (const species of [...SPECIES, ''])
    for (const stage of ['egg', 'baby', 'adult'])
      for (const reaction of REACTIONS)
        for (const enter of [true, false]) {
          const one = { species, stage, wear: stage === 'adult' ? ['cap'] : [], reaction, enter }
          const svg = petBadgeSvg(one)
          expect(svg.startsWith('<svg') && svg.length <= 131_072).toBe(true)
          expect(petBadgeSvg({ ...one })).toBe(svg)
        }
  // Вход — разовая анимация, без него — просто сидит
  const fox = { species: 'fox', stage: 'baby', reaction: 'idle' }
  expect(petBadgeSvg({ ...fox, enter: true }) === petBadgeSvg({ ...fox, enter: false })).toBe(false)
  expect(petBadgeSvg({ ...fox, enter: true })).toContain('fill="freeze"')
  expect(petBadgeSvg({ ...fox, enter: false })).not.toContain('fill="freeze"')
  // У каждого вида свой вход
  expect(new Set(SPECIES.map((species) => petBadgeSvg({ species, stage: 'baby', enter: true }))).size).toBe(SPECIES.length)
  // Робот спускается на тросе
  expect(petBadgeSvg({ species: 'robot', stage: 'baby', enter: true })).toContain('stroke="#5b6b7a"')
  // Размер
  expect(petBadgeSvg({ ...fox, size: 36 })).toContain('width="36" height="36"')
})

test('маленький питомец в шапке Desktop: доски, агенты, настройки — есть; поиск, заметки, главный и экран питомца — нет; терминал — нет', HEAVY, async ($, on) => {
  const pet = { ...newPet('fox', 'Рыжик', T0 - H), xp: 3, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const badge = (menu: string) => ui.find({ key: `arcade-pet-badge-${menu}` })
  const small = async () => (await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.alt === 'Рыжик' && s.props.width <= 48)
  expect(await badge('main')).toBeUndefined()
  for (const menu of ['settings', 'agents', 'boards', 'calendar']) {
    await go(ui, `arcade-menu-${menu}`)
    await clock.advance(50)
    expect(await badge(menu)).toBeDefined()
    const pics = await small()
    expect(pics.length).toBe(1)
    const art = pics[0]
    expect(art.props).toMatchObject({ alt: 'Рыжик', width: 48, height: 48 })
    expect(art.props.isInteractive).toBeUndefined()
    expect(art.props.source.startsWith('<svg') && art.props.source.length <= 131_072).toBe(true)
    // Пришёл на экран — входит; перерисовка того же экрана — та же картинка, вход не начинается заново
    expect(art.props.source).toContain('fill="freeze"')
    await ui.press({ key: 'arcade-back' })
    await clock.advance(50)
  }
  await go(ui, 'arcade-menu-settings')
  const first = (await small())[0].props.source
  await clock.advance(1_000)
  expect((await small())[0].props.source).toBe(first)
  await ui.press({ key: 'arcade-back' })
  for (const menu of ['search', 'notes', 'pet']) {
    await go(ui, `arcade-menu-${menu}`)
    await clock.advance(50)
    expect(await badge(menu)).toBeUndefined()
    if (menu !== 'pet') expect((await small()).length).toBe(0)
    await ui.press({ key: 'arcade-back' })
    await clock.advance(50)
  }
  await ui.unmount()
  // В терминале — никогда
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await go(term, 'arcade-menu-settings')
  await clock.advance(50)
  expect(await term.find({ key: 'arcade-pet-badge-settings' })).toBeUndefined()
  await term.unmount()
})

test('настройки питомца на его экране: на других экранах, прокрутка, размер, сон — сохраняются и меняют подпись', HEAVY, async ($, on) => {
  const pet = { ...newPet('owl', 'Ухти', T0 - H), xp: 2, treats: 0 }
  const { clock, saved } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  const label = async (key: string) => (await ui.find({ key }))?.props.label
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  expect(await label('arcade-pet-screens')).toBe('На других экранах: да')
  expect(await label('arcade-pet-follow')).toBe('Спускается за мной при прокрутке: да')
  expect(await label('arcade-pet-size')).toBe('Размер: обычный')
  expect(await label('arcade-pet-night')).toBe('Спит ночью (23–7): да')
  // Размер — маленький: на других экранах 36, полоса на главном ниже
  await ui.press({ key: 'arcade-pet-size' })
  await clock.advance(50)
  expect(saved.get('petSize')).toBe('small')
  expect(await label('arcade-pet-size')).toBe('Размер: маленький')
  await ui.press({ key: 'arcade-back' })
  await clock.advance(50)
  const strip = (await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.isInteractive === true)
  expect(strip.length).toBe(1)
  expect(strip[0].props).toMatchObject({ alt: 'Ухти', width: 435, height: 48 })
  await go(ui, 'arcade-menu-settings')
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-badge-settings' })).toBeDefined()
  expect((await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.alt === 'Ухти').map((s: any) => [s.props.width, s.props.height])).toEqual([[36, 36]])
  // На других экранах — нет
  await go(ui, 'arcade-pet-screens')
  await clock.advance(50)
  expect(saved.get('petScreens')).toBe(false)
  expect(await label('arcade-pet-screens')).toBe('На других экранах: нет')
  await go(ui, 'arcade-menu-settings')
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-badge-settings' })).toBeUndefined()
  // Прокрутка и сон
  await go(ui, 'arcade-pet-follow')
  await clock.advance(50)
  expect(saved.get('petFollow')).toBe(false)
  expect(await label('arcade-pet-follow')).toBe('Спускается за мной при прокрутке: нет')
  await ui.press({ key: 'arcade-pet-night' })
  await clock.advance(50)
  expect(saved.get('petNight')).toBe(false)
  expect(await label('arcade-pet-night')).toBe('Спит ночью (23–7): нет')
  await ui.unmount()
})

test('питомец спускается за мной при прокрутке Desktop: у правого края на высоте прокрутки; мало пролистал или выключено — нет', HEAVY, async ($, on) => {
  const pet = { ...newPet('robot', 'Бип', T0 - H), xp: 2, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const at = (offset: number) => ({ ...PANE, surface: 'desktop', props: { ...PANE.props, scroll: { offset, bodyRows: 30 } } })
  // Главный: пролистал на 10 строк — питомец у правого края на 10-й строке
  const down = await $.ui.mount(at(10))
  const follow = await down.find({ key: 'arcade-pet-follow-main' })
  expect(follow).toMatchObject({ props: { position: 'absolute', top: 10, right: 1 } })
  expect(await down.find({ key: 'arcade-pet-follow-art-main' })).toBeDefined()
  expect((await down.findAll({ type: 'Svg' })).filter((s: any) => s.props.alt === 'Бип').map((s: any) => s.props.width)).toEqual([435, 48])
  // Другой экран — и в шапке, и у края
  await go(down, 'arcade-menu-settings')
  await clock.advance(50)
  expect(await down.find({ key: 'arcade-pet-follow-settings' })).toMatchObject({ props: { position: 'absolute', top: 10 } })
  expect(await down.find({ key: 'arcade-pet-badge-settings' })).toBeDefined()
  await down.unmount()
  // Чуть-чуть пролистал — не спускается
  const near = await $.ui.mount(at(2))
  expect(await near.find({ key: 'arcade-pet-follow-main' })).toBeUndefined()
  await near.unmount()
  // В терминале — нет
  const term = await $.ui.mount({ ...at(10), surface: 'terminal' })
  expect(await term.find({ key: 'arcade-pet-follow-main' })).toBeUndefined()
  await term.unmount()
})

test('питомец не спускается при прокрутке, когда выключено в хранилище', HEAVY, async ($, on) => {
  const pet = { ...newPet('robot', 'Бип', T0 - H), xp: 2, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet), petFollow: false } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop', props: { ...PANE.props, scroll: { offset: 12, bodyRows: 30 } } })
  expect(await ui.find({ key: 'arcade-pet-follow-main' })).toBeUndefined()
  await go(ui, 'arcade-menu-settings')
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-follow-settings' })).toBeUndefined()
  expect(await ui.find({ key: 'arcade-pet-badge-settings' })).toBeDefined()
  await ui.unmount()
})

test('питомец ночью не спит, когда сон выключен', HEAVY, async ($, on) => {
  const night = new Date(2026, 10, 20, 23, 30).getTime()
  const pet = { ...newPet('dragon', 'Искра', night - H), xp: 5, treats: 0 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet), petNight: false } })
  await clock.set(night)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ key: 'arcade-pet-strip-open' }))?.props.label).toBe('Искра · Гуляет · угощений: 0 · 🪙 0')
  await ui.unmount()
})

// ——— 0.59: облик по стилю работы, трюки за серии, уголок с вещами, реплики ———

test('питомец 0.59: чем кормили — облик взрослого: мастер, ревьюер, бегун; у яйца и малыша облика нет', () => {
  const pet = newPet('fox', 'Рыжик', T0)
  expect(pet.style).toEqual({ cards: 0, reviews: 0, queues: 0 })
  const at = T0 + 60_000
  const log = [
    entry(at, 'done', 'a'),
    entry(at + 1, 'done', 'b'),
    entry(at + 2, 'accept', 'a'),
    entry(at + 3, 'check', 'c', { ok: true }),
    entry(at + 4, 'check', 'd', { ok: false }), // красная проверка — не еда и не стиль
    entry(at + 5, 'done', 'a'), // та же карточка в тот же день — без счёта
  ]
  // Очереди доски до конца (2) и зелёная проверка — «очереди»
  const got = collect(pet, log, at + 10, 2)
  expect(got.style).toEqual({ cards: 2, reviews: 1, queues: 3 })
  // Ничего нового — та же запись
  expect(collect(got, log, at + 20)).toBe(got)
  const adult = (style: any) => ({ ...pet, xp: 30, style })
  expect(formOf(null)).toBe('')
  expect(formOf({ ...got, xp: 0 })).toBe('')
  expect(formOf({ ...got, xp: 29 })).toBe('')
  expect(formOf(adult({ cards: 0, reviews: 0, queues: 0 }))).toBe('')
  expect(formOf(adult({ cards: 5, reviews: 2, queues: 1 }))).toBe('maker')
  expect(formOf(adult({ cards: 2, reviews: 5, queues: 5 }))).toBe('reviewer')
  expect(formOf(adult({ cards: 2, reviews: 5, queues: 6 }))).toBe('runner')
  // Поровну — «мастер»
  expect(formOf(adult({ cards: 3, reviews: 3, queues: 3 }))).toBe('maker')
  expect(FORMS).toEqual(['maker', 'reviewer', 'runner'])
  // Из хранилища: стиль и время рекорда проверяются
  const back = restorePet({ ...got, style: { cards: -5, reviews: 'x', queues: 2.7 }, bestAt: T0 + 5 * DAY }, T0)
  expect(back?.style).toEqual({ cards: 0, reviews: 0, queues: 2 })
  expect(back?.bestAt).toBe(0)
  expect(restorePet({ ...got, style: null, bestAt: T0 - H }, T0)).toMatchObject({ style: { cards: 0, reviews: 0, queues: 0 }, bestAt: T0 - H })
})

test('питомец 0.59: трюки — за лучшую серию и навсегда; уголок — вещи за угощения, серию, очереди, ревью и рост', () => {
  const p = { ...newPet('owl', 'Ухти', T0), xp: 0 }
  expect(tricksOf(p, 0)).toEqual([])
  expect(tricksOf(p, 2)).toEqual(['twirl'])
  // Серия прервалась, лучшая осталась — трюки остаются
  expect(tricksOf({ ...p, best: 5 }, 1)).toEqual(['twirl', 'leap', 'dance'])
  expect(tricksOf({ ...p, best: 12 }, 0)).toEqual(TRICKS.map((x) => x.id))
  expect(TRICKS.map((x) => x.id)).toEqual(TRICK_SCENES)
  expect(cornerOf(null, 0)).toEqual([])
  expect(cornerOf(p, 0)).toEqual([])
  expect(cornerOf({ ...p, xp: 3 }, 0)).toEqual(['bed'])
  expect(cornerOf({ ...p, xp: 15 }, 3)).toEqual(['bed', 'ball', 'plant'])
  expect(cornerOf({ ...p, xp: 30, style: { cards: 0, reviews: 10, queues: 3 } }, 0)).toEqual(['bed', 'ball', 'rug', 'lamp', 'picture'])
  expect(cornerOf({ ...p, xp: 30, best: 3, style: { cards: 0, reviews: 10, queues: 3 } }, 0)).toEqual(CORNER.map((c) => c.id))
  expect(CORNER_ITEMS).toEqual(CORNER.map((c) => c.id))
})

test('питомец 0.59: реплика — что важнее: сессия ждёт 5 минут, очередь пройдена, три карточки за час, новый трюк, голод', () => {
  const pet = { ...newPet('robot', 'Бип', T0 - DAY), xp: 5, treats: 0, full: 80, fullAt: T0 }
  expect(petLine({ pet: null, now: T0 })).toBe(null)
  expect(petLine({ pet, now: T0 })).toBe(null)
  // Сессия ждёт: меньше 5 минут — рано; из нескольких — та, что ждёт дольше
  const w = (name: string, ago: number) => ({ name, since: T0 - ago })
  expect(petLine({ pet, now: T0, waiting: [w('api', LINE_WAIT_MS - 60_000)] })).toBe(null)
  expect(petLine({ pet, now: T0, waiting: [w('api', 6 * 60_000), w('web', 12 * 60_000), { name: 'x', since: 0 }] })).toEqual({ kind: 'wait', name: 'web', min: 12 })
  // Очередь доски пройдена — 15 минут
  expect(petLine({ pet, now: T0, queueAt: T0 - LINE_QUEUE_MS + 60_000 })).toEqual({ kind: 'queue' })
  expect(petLine({ pet, now: T0, queueAt: T0 - LINE_QUEUE_MS })).toBe(null)
  expect(petLine({ pet, now: T0, queueAt: T0 - 60_000, waiting: [w('api', LINE_WAIT_MS)] })?.kind).toBe('wait')
  // Три карточки за последний час
  const dones = [T0 - 10 * 60_000, T0 - 30 * 60_000, T0 - 59 * 60_000]
  expect(petLine({ pet, now: T0, dones })).toEqual({ kind: 'cards', n: 3 })
  expect(petLine({ pet, now: T0, dones: [...dones.slice(0, 2), T0 - H] })).toBe(null)
  expect(petLine({ pet, now: T0, dones, queueAt: T0 - 60_000 })?.kind).toBe('queue')
  // Новый трюк: лучшая серия только что дошла до порога — два часа говорит о нём
  const leap = { ...pet, best: 3, bestAt: T0 - H }
  expect(petLine({ pet: leap, now: T0 })).toEqual({ kind: 'trick', id: 'leap' })
  expect(petLine({ pet: { ...leap, bestAt: T0 - LINE_TRICK_MS }, now: T0 })).toBe(null)
  expect(petLine({ pet: { ...leap, best: 4 }, now: T0 })).toBe(null)
  expect(petLine({ pet: { ...leap, bestAt: 0 }, now: T0 })).toBe(null)
  expect(petLine({ pet: leap, now: T0, dones })?.kind).toBe('cards')
  // Голоден и есть угощения; без угощений или яйцом — молчит
  const hungry = { ...pet, treats: 2, full: 10 }
  expect(petLine({ pet: hungry, now: T0 })).toEqual({ kind: 'hungry' })
  expect(petLine({ pet: { ...hungry, treats: 0 }, now: T0 })).toBe(null)
  expect(petLine({ pet: { ...hungry, xp: 0 }, now: T0 })).toBe(null)
  expect(petLine({ pet: { ...hungry, best: 3, bestAt: T0 - H }, now: T0 })?.kind).toBe('trick')
})

test('питомец 0.59: трюки среди шалостей — только открытые; облик и уголок — SVG в пределах и одинаковые для одних вводных', () => {
  for (const r of [0, 0.3, 0.6, 0.999]) {
    expect(TRICK_SCENES.includes(pickScene(r, ''))).toBe(false)
    const s = pickScene(r, 'twirl', { tricks: ['twirl', 'leap'] })
    expect(s !== 'twirl' && (PET_SCENES.includes(s) || s === 'leap')).toBe(true)
  }
  const all = new Set([...Array(40)].map((_, i) => pickScene(i / 40, '', { tricks: ['twirl', 'leap'] })))
  expect([...all].sort()).toEqual([...PET_SCENES, 'twirl', 'leap'].sort())
  for (const species of SPECIES)
    for (const form of FORMS) {
      for (const scene of TRICK_SCENES) {
        const one = { species, stage: 'adult', wear: ['crown', 'scarf', 'glasses'], scene, width: 1400, form }
        const svg = petWalkSvg(one)
        expect(svg.startsWith('<svg') && svg.length <= 131_072).toBe(true)
        expect(petWalkSvg({ ...one })).toBe(svg)
      }
      // Облик — значок цвета облика на картинке и на маленьком питомце
      const big = petSvg({ species, stage: 'adult', form, wear: [], size: 160 })
      expect(big.includes(FORM_COLOR[form]) && big.length <= 131_072).toBe(true)
      expect(big === petSvg({ species, stage: 'adult', wear: [], size: 160 })).toBe(false)
      expect(petBadgeSvg({ species, stage: 'adult', form }).includes(FORM_COLOR[form])).toBe(true)
    }
  const room = { items: CORNER_ITEMS, species: 'dragon', stage: 'adult', form: 'runner', wear: ['crown'] }
  const corner = petCornerSvg(room)
  expect(corner.startsWith('<svg') && corner.length <= 131_072).toBe(true)
  expect(petCornerSvg({ ...room })).toBe(corner)
  expect(petCornerSvg({ items: [], species: 'owl', stage: 'egg' }).length < corner.length).toBe(true)
  // Кадр терминала взрослого с обликом — другой
  const grown = { ...newPet('owl', 'Ухти', T0), xp: 30 }
  expect(petCells({ ...grown, style: { cards: 0, reviews: 0, queues: 4 } }, 'idle', 0) === petCells(grown, 'idle', 0)).toBe(false)
})

test('питомец 0.59 в Desktop: облик, трюки и уголок на его экране; трюк — посмотреть здесь же', HEAVY, async ($, on) => {
  const pet = { ...newPet('fox', 'Рыжик', T0 - 10 * DAY), xp: 40, treats: 0, best: 3, style: { cards: 2, reviews: 12, queues: 1 } }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  // Облик — ревьюер: подпись, счёт и значок на картинке
  expect(await ui.find({ type: 'Text', text: 'Ревьюер — чаще всего ты принимаешь ревью' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Закрытых карточек: 2 · принятых ревью: 12 · шагов очередей доски: 1' })).toBeDefined()
  const big = (await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.isInteractive === true)
  expect(big.length).toBe(1)
  expect(big[0].props.source.includes(FORM_COLOR.reviewer)).toBe(true)
  // Трюки: серия 3 — пируэт и сальто открыты, танец — нет
  expect(await ui.find({ key: 'arcade-pet-trick-twirl' })).toMatchObject({ props: { label: 'Пируэт' } })
  expect(await ui.find({ key: 'arcade-pet-trick-leap' })).toMatchObject({ props: { label: 'Сальто' } })
  expect(await ui.find({ key: 'arcade-pet-trick-dance' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Танец — 5 дн. подряд с работой' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Открытые трюки питомец показывает, когда гуляет по главному экрану.' })).toBeDefined()
  await ui.press({ key: 'arcade-pet-trick-leap' })
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-trick-leap' })).toMatchObject({ props: { label: '▶ Сальто' } })
  expect(await ui.find({ key: 'arcade-pet-trick-show-leap' })).toBeDefined()
  const shown = (await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.alt === 'Сальто')
  expect(shown.length).toBe(1)
  expect(shown[0].props).toMatchObject({ width: 360, isInteractive: true })
  await ui.press({ key: 'arcade-pet-trick-leap' })
  await clock.advance(50)
  expect(await ui.find({ key: 'arcade-pet-trick-show-leap' })).toBeUndefined()
  // Уголок: картинка без анимации; коврик ещё закрыт, лежанка открыта
  const corner = (await ui.findAll({ type: 'Svg' })).filter((s: any) => s.props.alt === 'Уголок питомца')
  expect(corner.length).toBe(1)
  expect(corner[0].props).toMatchObject({ width: 320, height: 120 })
  expect(corner[0].props.isInteractive).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Коврик — после 3 шагов очередей доски' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Лежанка — после 3 угощений' })).toBeUndefined()
  await ui.unmount()
})

test('питомец 0.59 в терминале: трюки и уголок — строками; у малыша облика ещё нет', HEAVY, async ($, on) => {
  const pet = { ...newPet('owl', 'Ухти', T0 - DAY), xp: 16, treats: 0, best: 2 }
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  expect(await ui.find({ type: 'Text', text: 'Ревьюер — чаще всего ты принимаешь ревью' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Во взрослой форме у питомца будет облик — по тому, чем ты чаще его кормишь: карточками, ревью или очередями доски.' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '✓ Пируэт' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Сальто — 3 дн. подряд с работой' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'В уголке: Лежанка, Мячик' })).toBeDefined()
  expect((await ui.findAll({ type: 'Svg' })).length).toBe(0)
  await ui.press({ key: 'arcade-back' })
  await ui.unmount()
})

test('питомец 0.59 на главном Desktop: реплика под полосой — три карточки за час; час прошёл — замолкает сама', HEAVY, async ($, on) => {
  // Сыт: иначе после трёх карточек с угощениями заговорит голод
  const pet = { ...newPet('robot', 'Бип', T0 - DAY), xp: 5, treats: 0, full: 100, fullAt: T0 }
  const daylog = [entry(T0 - 50 * 60_000, 'done', 'a'), entry(T0 - 20 * 60_000, 'done', 'b'), entry(T0 - 5 * 60_000, 'done', 'c')]
  const { clock } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet), daylog } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect(await ui.find({ key: 'arcade-pet-line' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Карточек за час: 3 — молодец!' })).toMatchObject({ props: { color: 'success' } })
  // Первой карточке стал час — одна перерисовка, реплики нет
  await clock.advance(10 * 60_000 + 1_000)
  expect(await ui.find({ key: 'arcade-pet-line' })).toBeUndefined()
  await ui.unmount()
  // В терминале полоса — одной строкой, без реплики
  const term = await $.ui.mount({ ...PANE, surface: 'terminal' })
  expect(await term.find({ key: 'arcade-pet-strip-open' })).toBeDefined()
  expect(await term.find({ key: 'arcade-pet-line' })).toBeUndefined()
  await term.unmount()
})

test('питомец 0.59: серия выросла до трюка — запись о рекорде и реплика на экране питомца', HEAVY, async ($, on) => {
  const pet = { ...newPet('drop', 'Капля', T0 - 5 * DAY), xp: 8, treats: 0, best: 1, counted: T0 - 5 * DAY }
  const daylog = [entry(T0 - 2 * DAY, 'done', 'x'), entry(T0 - DAY, 'done', 'y'), entry(T0 - 60_000, 'done', 'z')]
  const { clock, saved } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet), daylog } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  expect(saved.get('pet')).toMatchObject({ best: 3 })
  const at = saved.get('pet').bestAt
  expect(at >= T0 && at <= T0 + 1_000).toBe(true)
  expect(await ui.find({ type: 'Text', text: 'Новый трюк: Сальто!' })).toMatchObject({ props: { color: 'success' } })
  expect(await ui.find({ key: 'arcade-pet-line' })).toBeDefined()
  await ui.unmount()
})

test('питомец 0.60: печенье дня — раз в день; угощение за каждые 5 ходов Claude, не больше 3 в день; серия — и по дням с ходами', () => {
  // Старое сохранение (до 0.60): печенья, ходов и рабочих дней нет — всё с нуля, ничего не пропало
  const old = { v: 1, species: 'owl', name: 'Ухти', born: T0 - 5 * DAY, xp: 7, treats: 4, full: 50, fullAt: T0, mood: 60, moodAt: T0, counted: T0, wear: ['scarf'], best: 2 }
  const pet = restorePet(old, T0)!
  expect(pet).toMatchObject({ xp: 7, treats: 4, wear: ['scarf'], best: 2, cookieDay: '', cookieAt: 0, turnDay: '', turnN: 0, workDays: [] })
  // Первое чтение за день — печенье; второе в тот же день — ничего; назавтра — снова
  const a = dailyCookie(pet, T0)
  expect(a).toMatchObject({ treats: 4 + DAILY_COOKIES, cookieDay: dayKey(T0), cookieAt: T0 })
  expect(dailyCookie(a, T0 + 5 * H)).toBe(a)
  expect(dailyCookie(a, T0 + DAY).treats).toBe(4 + 2 * DAILY_COOKIES)
  // Новому питомцу в день появления печенья нет: хватает первого угощения
  const born = newPet('owl', 'Ухти', T0)
  expect(dailyCookie(born, T0 + H)).toBe(born)
  // Ходы Claude: каждые 5 — угощение, не больше 3 в день
  let p: any = { ...pet, treats: 0 }
  const got: number[] = []
  for (let i = 1; i <= 22; i++) {
    p = turnFed(p, T0 + i * 60_000)
    got.push(p.treats)
  }
  expect([got[3], got[4], got[9], got[14], got[21]]).toEqual([0, 1, 2, TURN_TREATS_DAY, TURN_TREATS_DAY])
  expect(turnsToday(p, T0 + H)).toBe(22)
  expect(p.workDays).toEqual([dayKey(T0)])
  // Назавтра счёт с нуля, день — рабочий
  expect(turnsToday(p, T0 + DAY)).toBe(0)
  expect(turnFed(p, T0 + DAY)).toMatchObject({ turnN: 1, treats: TURN_TREATS_DAY, workDays: [dayKey(T0), dayKey(T0 + DAY)] })
  // Серия: дни только с ходами Claude — тоже работа
  expect(streakOf([entry(T0, 'done', 'k')], T0, [dayKey(T0 - DAY)])).toBe(2)
  expect(streakOf([], T0, [dayKey(T0 - 2 * DAY), dayKey(T0 - DAY), dayKey(T0)])).toBe(3)
  expect(streakOf([], T0, [dayKey(T0 - 2 * DAY)])).toBe(0)
  // Запись из хранилища: битые дни выброшены, повторы — один раз
  expect(restorePet({ ...old, workDays: ['2026-11-19', 'x', 5, '2026-11-19', '2026-11-20'], turnDay: 'вчера', turnN: -3, cookieDay: 7 }, T0)).toMatchObject({ workDays: ['2026-11-19', '2026-11-20'], turnDay: '', turnN: 0, cookieDay: '' })
  // Реплика о печенье — 10 минут, если важнее ничего нет
  const full = { ...a, full: 100, fullAt: T0 }
  expect(petLine({ pet: full, now: T0 + 60_000 })).toEqual({ kind: 'cookie' })
  expect(petLine({ pet: full, now: T0 + LINE_COOKIE_MS })).toBe(null)
  expect(petLine({ pet: full, now: T0 + 60_000, queueAt: T0 })?.kind).toBe('queue')
})

test('питомец 0.60 в Desktop: первый заход за день — печенье и реплика, второй — ничего; 5 ходов Claude — угощение', HEAVY, async ($, on) => {
  // Сохранение до 0.60: печенья дня в нём ещё нет
  const { cookieDay, ...pet } = { ...newPet('fox', 'Рыжик', T0 - 3 * DAY), xp: 6, treats: 0, full: 100, fullAt: T0 }
  const { clock, saved } = stubs(on, { env: WINDOWS, stored: { pet } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  expect(saved.get('pet')).toMatchObject({ treats: 2, cookieDay: dayKey(T0) })
  expect(await ui.find({ type: 'Text', text: 'Печенье дня — держи угощения!' })).toMatchObject({ props: { color: 'success' } })
  expect(await ui.find({ type: 'Text', text: 'Ходов Claude сегодня: 0 · угощений за них: 0 из 3' })).toBeDefined()
  // Оборванный ход не в счёт
  await $.turn.start({ turnId: 't0', text: 'почини тесты' })
  await $.turn.complete({ turnId: 't0', answer: '', reason: 'aborted' })
  await clock.advance(50)
  expect(saved.get('pet')).toMatchObject({ turnN: 0 })
  // Пять ходов Claude прямо в чате — угощение, день рабочий
  for (let i = 1; i <= 5; i++) {
    await $.turn.start({ turnId: `t${i}`, text: 'почини тесты' })
    await $.turn.complete({ turnId: `t${i}`, answer: '', reason: 'answer' })
    await clock.advance(50)
  }
  expect(saved.get('pet')).toMatchObject({ treats: 3, turnN: 5, workDays: [dayKey(T0)] })
  expect(await ui.find({ type: 'Text', text: 'Ходов Claude сегодня: 5 · угощений за них: 1 из 3' })).toBeDefined()
  // Реплика о печенье уходит сама
  await clock.advance(LINE_COOKIE_MS)
  expect(await ui.find({ type: 'Text', text: 'Печенье дня — держи угощения!' })).toBeUndefined()
  // Второй заход в тот же день — печенья нет
  await ui.press({ key: 'arcade-back' })
  await clock.advance(5 * 60_000)
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  expect(saved.get('pet')).toMatchObject({ treats: 3, cookieDay: dayKey(T0) })
  await ui.unmount()
})

test('питомец 0.61: задания — по дате, одни и те же; монетки — раз за задание; назавтра и через неделю — новые; старое сохранение — 0 монеток', () => {
  // Сохранение до 0.61: монеток, заданий и лавки нет — всё пустое, ничего не пропало
  const old = { v: 1, species: 'owl', name: 'Мурка', born: T0 - 9 * DAY, xp: 12, treats: 3, full: 80, fullAt: T0, mood: 70, moodAt: T0, counted: T0, wear: ['scarf'], best: 2, cookieDay: dayKey(T0), turnDay: '', turnN: 0, workDays: [] }
  const pet = restorePet(old, T0)!
  expect(pet).toMatchObject({ xp: 12, treats: 3, wear: ['scarf'], best: 2, coins: 0, owned: [], decor: [], questAt: 0, questGain: 0 })
  expect(pet.quest).toEqual({ day: '', ids: [], done: [], week: '', wid: '', wdone: false })
  // Первое чтение — задания дня и недели, монеток пока нет
  const a = questCheck(pet, [], T0)
  expect(a.coins).toBe(0)
  expect(a.quest).toMatchObject({ day: dayKey(T0), week: weekKey(T0), done: [], wdone: false })
  expect(weekKey(T0)).toBe('2026-11-16')
  expect(a.quest.ids.length).toBe(3)
  expect(a.quest.ids[0]).toBe('turns')
  // Карточка и ревью — только тем, кто уже закрывал карточки или принимал ревью; чат — только со входом
  expect(a.quest.ids.every((id: string) => ['turns', 'pat', 'note', 'digest'].includes(id))).toBe(true)
  for (let i = 0; i < 40; i++) {
    const day = dayKey(T0 + i * DAY)
    expect(dayQuests(pet, day)).toEqual(dayQuests({ ...pet }, day))
    expect(dayQuests(pet, day).every((id: string) => DAY_QUESTS.includes(id) && id !== 'card' && id !== 'review')).toBe(true)
    const w = weekQuest(pet, day)
    expect(WEEK_QUESTS.includes(w) && w !== 'chat' && w !== 'queue' && w !== 'reviews').toBe(true)
  }
  expect(new Set(Array.from({ length: 30 }, (_, i) => dayQuests({ ...pet, style: { cards: 3, reviews: 2, queues: 0 } }, dayKey(T0 + i * DAY))).flat()).has('card')).toBe(true)
  // Ничего не сделано — та же запись: писать в хранилище нечего
  expect(questCheck(a, [], T0 + H)).toBe(a)
  // 5 ходов Claude — +3 🪙 и реплика; ещё ходы — ничего сверху
  let p: any = a
  for (let i = 1; i <= 5; i++) p = turnFed(p, T0 + i * 60_000)
  const b = questCheck(p, [], T0 + 5 * 60_000)
  expect(b).toMatchObject({ coins: DAY_QUEST_COINS, questAt: T0 + 5 * 60_000, questGain: DAY_QUEST_COINS })
  expect(b.quest.done).toEqual(['turns'])
  expect(questCheck(b, [], T0 + H)).toBe(b)
  expect(questCheck(turnFed(b, T0 + H), [], T0 + H).coins).toBe(DAY_QUEST_COINS)
  const full = { ...b, full: 100, fullAt: T0, cookieAt: 0 }
  expect(petLine({ pet: full, now: T0 + 6 * 60_000 })).toEqual({ kind: 'quest', n: DAY_QUEST_COINS })
  expect(petLine({ pet: full, now: T0 + 5 * 60_000 + LINE_QUEST_MS })).toBe(null)
  // Назавтра — новые задания дня, монетки остаются; неделя та же — задание недели то же
  const c = questCheck(b, [], T0 + DAY)
  expect(c).toMatchObject({ coins: DAY_QUEST_COINS, quest: { day: dayKey(T0 + DAY), done: [], week: weekKey(T0), wid: b.quest.wid } })
  // В понедельник — новая неделя
  expect(questCheck(c, [], T0 + 3 * DAY).quest).toMatchObject({ week: '2026-11-23', wdone: false })
  // Карточка: закрыть одну — +3; перетащить ту же туда и обратно и закрыть другую — ничего сверху
  const q = { ...a, quest: { ...a.quest, ids: ['turns', 'card', 'pat'], wid: 'reviews' } }
  const log = [entry(T0 + 60_000, 'done', 'a')]
  const d = questCheck(q, log, T0 + 2 * 60_000)
  expect(d.coins).toBe(DAY_QUEST_COINS)
  expect(questCheck(d, [...log, entry(T0 + 3 * 60_000, 'done', 'a'), entry(T0 + 4 * 60_000, 'done', 'b')], T0 + 5 * 60_000)).toBe(d)
  // Неделя: 3 разных принятых ревью — +15; одно и то же ревью трижды — не в счёт
  const same = [1, 2, 3].map((i) => entry(T0 + i * 60_000, 'accept', 'r'))
  expect(questProgress('reviews', q, same, T0 + H)).toEqual({ n: 1, of: 3 })
  const three = ['r1', 'r2', 'r3'].map((id, i) => entry(T0 - DAY + i * 60_000, 'accept', id))
  expect(questCheck(q, three, T0 + H)).toMatchObject({ coins: WEEK_QUEST_COINS, quest: { wdone: true } })
  // Ревью прошлой недели — не в счёт
  expect(questProgress('reviews', q, three.map((x) => ({ ...x, at: x.at - 7 * DAY })), T0 + H).n).toBe(0)
  // Отметки блокнота, итогов, чата, игры — раз в день; чужая отметка — мимо
  const m = questMark(a, 'note', T0)
  expect(m.marks.note).toBe(dayKey(T0))
  expect(questMark(m, 'note', T0 + H)).toBe(m)
  expect(questMark(a, 'хм', T0)).toBe(a)
  expect(questProgress('note', m, [], T0)).toEqual({ n: 1, of: 1 })
  expect(questProgress('note', m, [], T0 + DAY)).toEqual({ n: 0, of: 1 })
  expect(questProgress('game', questMark(a, 'game', T0 - 2 * DAY), [], T0)).toEqual({ n: 1, of: 1 })
  // Битые задания и отметки в хранилище — выброшены
  expect(restorePet({ ...old, coins: -5, quest: { day: 'x', ids: ['turns', 'lines', 'pat', 'pat'], done: ['pat', 'lines'], wid: 'deploy', wdone: 'да' }, marks: { note: 7, chat: dayKey(T0) } }, T0)).toMatchObject({
    coins: 0,
    quest: { day: '', ids: ['turns', 'pat'], done: ['pat'], wid: '', wdone: false },
    marks: { note: '', chat: dayKey(T0) },
  })
})

test('питомец 0.61: лавка — печенье, когда угощения кончились; вещь покупается раз и надевается; день только в чате — не голодает', () => {
  const born = restorePet({ ...newPet('dragon', 'Бобик', T0 - 9 * DAY), xp: 20, treats: 0 }, T0)!
  expect(born).toMatchObject({ species: 'dragon', coins: 0, treats: 0 })
  const pet = { ...born, coins: 40 }
  expect(SHOP.every((x: any) => x.price > 0)).toBe(true)
  // Печенье — только без угощений и за монетки
  expect(canBuy(pet, 'cookie')).toBe(true)
  const fed = buy(pet, 'cookie')
  expect(fed).toMatchObject({ treats: 1, coins: 36 })
  expect(canBuy(fed, 'cookie')).toBe(false)
  expect(buy(fed, 'cookie')).toBe(fed)
  // Наряд: монетки списаны, надет сразу, второй раз не продаётся; снять — как обычный
  const hat = buy(pet, 'party')
  expect(hat).toMatchObject({ coins: 25, owned: ['party'], wear: ['party'] })
  expect(canBuy(hat, 'party')).toBe(false)
  expect(buy(hat, 'party')).toBe(hat)
  expect(toggleWear(hat, 'party', ['party']).wear).toEqual([])
  // Не хватает монеток — ничего
  expect(canBuy({ ...pet, coins: 29 }, 'house')).toBe(false)
  expect(buy({ ...pet, coins: 29 }, 'house').coins).toBe(29)
  expect(canBuy(pet, 'нет такого')).toBe(false)
  // Домик — встаёт у полосы, убрать и поставить; игрушки и трюки — шалости
  const home = buy(pet, 'house')
  expect(home).toMatchObject({ coins: 10, owned: ['house'], decor: ['house'] })
  expect(toggleDecor(home, 'house').decor).toEqual([])
  expect(toggleDecor(toggleDecor(home, 'house'), 'house').decor).toEqual(['house'])
  expect(toggleDecor(home, 'garden')).toBe(home)
  const toys = buy(buy(pet, 'kite'), 'bounce')
  expect(toys.coins).toBe(5)
  expect(shopScenes(toys)).toEqual(['kite', 'bounce'])
  expect(pickScene(0.999, '', { tricks: shopScenes(toys) })).toBe('bounce')
  // Записанное в хранилище: лишнее из купленного и стоящего у полосы выброшено
  expect(restorePet({ ...home, owned: ['house', 'house', 'cookie', 'x'], decor: ['house', 'garden'] }, T0)).toMatchObject({ owned: ['house'], decor: ['house'] })
  // Полоса: домик и садик, игрушки — SVG в пределах
  for (const scene of SHOP_SCENES) {
    const svg = petWalkSvg({ species: 'dragon', stage: 'adult', wear: ['tophat', 'cape'], scene, decor: ['house', 'garden'], width: 1400 })
    expect(svg.startsWith('<svg') && svg.length <= 131_072).toBe(true)
  }
  expect(petWalkSvg({ species: 'dragon', stage: 'adult', decor: ['house'] }) === petWalkSvg({ species: 'dragon', stage: 'adult' })).toBe(false)
  // День только в чате: печенье дня утром, угощения за ходы Claude — кормим, как дают; до утра сыт
  const morning = T0 - 4 * H // 09:00
  let p: any = { ...pet, full: 60, fullAt: morning, cookieDay: '', treats: 0 }
  p = dailyCookie(p, morning)
  let low = 100
  for (let m = 0; m <= 24 * 60; m += 10) {
    const now = morning + m * 60_000
    if (m > 0 && m <= 12 * 60 && m % 40 === 0) p = turnFed(p, now) // ход Claude раз в 40 минут до 21:00
    while (p.treats > 0) p = feed(p, now)
    low = Math.min(low, fullness(p, now))
    expect(petMood(p, { now, hour: 12 }) === 'hungry').toBe(false)
  }
  expect(low >= 25).toBe(true)
  // За ходы в тот же день — задание и монетки
  expect(questCheck({ ...p, coins: 0 }, [], morning + 12 * H).coins).toBe(DAY_QUEST_COINS)
})

test('питомец 0.61 в Desktop: задания и монетки на его экране; погладил — +3 🪙; купил наряд — надет и снимается', HEAVY, async ($, on) => {
  const pet = { ...newPet('fox', 'Рыжик', T0 - 10 * DAY), xp: 20, treats: 0, coins: 12, quest: { day: dayKey(T0), ids: ['turns', 'pat', 'note'], done: [], week: weekKey(T0), wid: 'streak', wdone: false } }
  const { clock, saved } = stubs(on, { env: WINDOWS, stored: { pet: cookied(pet) } })
  await clock.set(T0)
  await start($)
  await clock.advance(200)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.press({ key: 'arcade-menu-pet' })
  await clock.advance(50)
  expect(await ui.find({ type: 'Text', text: 'Монетки: 12 🪙' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '○ Claude закончил ходов: 5 · 0/5 · +3 🪙' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '○ Погладить питомца · +3 🪙' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '○ Рабочих дней подряд на этой неделе: 5 · 0/5 · +15 🪙' })).toBeDefined()
  // Дорогое — серым, на что хватает — кнопкой; печенье — пока угощений нет
  expect(await ui.find({ key: 'arcade-pet-buy-cookie' })).toMatchObject({ props: { label: 'Печенье — 4 🪙' } })
  expect(await ui.find({ key: 'arcade-pet-buy-party' })).toBeUndefined()
  expect(await ui.find({ type: 'Text', text: 'Домик — 30 🪙' })).toBeDefined()
  // Погладил — задание сделано: +3, реплика, строка зелёная
  await ui.press({ key: 'arcade-pet-pat' })
  await clock.advance(50)
  expect(saved.get('pet')).toMatchObject({ coins: 15, questGain: 3, quest: { done: ['pat'] } })
  expect(await ui.find({ type: 'Text', text: '✓ Погладить питомца · +3 🪙' })).toMatchObject({ props: { color: 'success' } })
  expect(await ui.find({ type: 'Text', text: 'Задание выполнено: +3 🪙' })).toBeDefined()
  // Гладить ещё раз — монеток не прибавится
  await clock.advance(5_000)
  await ui.press({ key: 'arcade-pet-pat' })
  await clock.advance(50)
  expect(saved.get('pet').coins).toBe(15)
  // Колпак за 15 — куплен, надет, монеток 0
  await ui.press({ key: 'arcade-pet-buy-party' })
  await clock.advance(50)
  expect(saved.get('pet')).toMatchObject({ coins: 0, owned: ['party'], wear: ['party'] })
  expect(await ui.find({ type: 'Text', text: 'Куплено: Колпак' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: '✓ Колпак' })).toBeDefined()
  expect(await ui.find({ key: 'arcade-pet-wear-party' })).toMatchObject({ props: { label: '✓ Колпак' } })
  expect(await ui.find({ key: 'arcade-pet-buy-cookie' })).toBeUndefined()
  // Снять в «Нарядах» и надеть обратно
  await ui.press({ key: 'arcade-pet-wear-party' })
  await clock.advance(50)
  expect(saved.get('pet').wear).toEqual([])
  await ui.press({ key: 'arcade-pet-wear-party' })
  await clock.advance(50)
  expect(saved.get('pet').wear).toEqual(['party'])
  // Реплика уходит сама
  await clock.advance(LINE_QUEST_MS)
  expect(await ui.find({ type: 'Text', text: 'Задание выполнено: +3 🪙' })).toBeUndefined()
  await ui.unmount()
})

// ━━━━━━━━━━ п. 48: кадры вместо плавности ━━━━━━━━━━

test('питомец 0.62.1: бесконечные петли — неподвижные кадры по 0,2 с от якоря; разовые анимации остаются плавными', () => {
  // Петля 0 → 1 → 0 за 0,8 с: четыре кадра от якоря k0, круг повторяет сам якорь
  expect(stepFrames('<svg x="1"><g><animate attributeName="opacity" values="0;1;0" dur="0.8s" repeatCount="indefinite"/></g></svg>')).toBe(
    '<svg x="1"><g><set id="k0" attributeName="visibility" to="visible" begin="0s;k0.end" dur="0.8s"/></g><g>' +
      '<animate attributeName="opacity" dur="indefinite" values="0" begin="k0.begin" end="k0.begin+0.2s"/>' +
      '<animate attributeName="opacity" dur="indefinite" values="0.5" begin="k0.begin+0.2s" end="k0.begin+0.4s"/>' +
      '<animate attributeName="opacity" dur="indefinite" values="1" begin="k0.begin+0.4s" end="k0.begin+0.6s"/>' +
      '<animate attributeName="opacity" dur="indefinite" values="0.5" begin="k0.begin+0.6s" end="k0.end"/></g></svg>',
  )
  // Разовая анимация не трогается
  const once = '<svg><animate attributeName="opacity" values="0;1" dur="1s" fill="freeze"/></svg>'
  expect(stepFrames(once)).toBe(once)
  // Во всех картинках питомца: ни одной бесконечной плавной петли, кадры — на сетке 0,2 с, плавное — не дольше 5 с
  const check = (svg: string) => {
    expect(svg.includes('repeatCount="indefinite"')).toBe(false)
    for (const [, t] of svg.matchAll(/begin="k\d+\.begin\+([\d.]+)s"/g)) expect(Math.abs(Number(t) * 5 - Math.round(Number(t) * 5)) < 1e-9).toBe(true)
    for (const [, body] of svg.matchAll(/<(?:animateTransform|animate)\b([^>]*)\/>/g)) {
      if (body.includes('dur="indefinite"')) continue
      const dur = Number(/dur="([\d.]+)s"/.exec(body)?.[1])
      const times = Number(/repeatCount="(\d+)"/.exec(body)?.[1] ?? 1)
      const begin = Number(/begin="([\d.]+)s"/.exec(body)?.[1] ?? 0)
      expect(begin + dur * times <= 5).toBe(true)
    }
  }
  for (const species of SPECIES) {
    for (const scene of [...PET_SCENES, ...TRICK_SCENES, ...SHOP_SCENES])
      for (const reaction of ['idle', 'happy', 'sleep'])
        for (const stage of ['egg', 'adult']) check(petWalkSvg({ species, stage, scene, reaction, width: 1400, height: 72, wear: ['cap'] }))
    for (const stage of ['egg', 'baby', 'adult']) {
      for (const mood of ['idle', 'happy', 'sleep', 'hungry', 'walk']) check(petSvg({ species, stage, mood, size: 160, pat: true }))
      for (const enter of [true, false]) check(petBadgeSvg({ species, stage, enter }))
    }
    check(petCornerSvg({ species, stage: 'adult', items: CORNER_ITEMS, width: 320 }))
  }
  // Сова влетает в шапку: 8 частых взмахов по 0,2 с, обычные — с 1,6 с; без входа — сразу
  const owl = petBadgeSvg({ species: 'owl', stage: 'adult', enter: true })
  expect(owl).toContain('dur="0.2s" repeatCount="8"')
  expect(owl).toContain('begin="1.6s;k1.end"')
  expect(petBadgeSvg({ species: 'owl', stage: 'adult', enter: false })).toContain('begin="0s;k1.end"')
})
