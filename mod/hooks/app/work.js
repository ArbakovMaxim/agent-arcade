// Arcade: блокнот и доски проектов.
import { openUrlCommand } from '../browsers.js'
import { tr } from '../i18n.js'
import { COL_NAMES, MAX_BODY, addPage, checkStats, cleanBody, columnCards, fits, isBoard, updatePage } from '../notes.js'
import { MAX_MEMBERS, adoptBoard, applySync, cardId, detachBoard, freshBase, parseBoard, parseBoardDone, parseBoards, planSync } from '../desks.js'
import { LAUNCH_TIMEOUT_MS, S, nb } from './state.js'
import { log } from './status.js'
import { accountNote } from './profile.js'
import { chatFetch, friendsCall } from './talk.js'

// --- Блокнот ------------------------------------------------------------------------------------------------------
const NOTES_FULL = 'Блокнот полон — удали ненужные страницы.'
export const NOTE_TOO_LONG = 'Текст страницы длиннее 20 000 знаков — сократи его.'
export const CONNECTOR_HINT = '  Через коннекторы Claude: ключи и пароли Arcade не нужны. Нет коннектора — Claude подскажет, как подключить.'
// Голосовой ввод — диктовкой системы: она пишет в любое поле, где курсор, и в поля Arcade тоже
export const VOICE_HINT = {
  windows: '  Голосом: Win+H — диктовка Windows пишет туда, где курсор.',
  mac: '  Голосом: дважды Fn — диктовка macOS пишет туда, где курсор.',
}

async function saveNotes($) {
  await $.store.set('notes', S.notes).catch((err) => {
    nb.note = 'Не получилось сохранить блокнот.'
    nb.bad = true
    log(`ошибка мода: ${err?.message ?? err}`)
  })
}

// Блокнот поменялся: поля страницы рисуются заново с новым текстом
export async function notesChanged($, list) {
  S.notes = list
  nb.draft = null
  nb.field++
  $.ui.invalidate('ui.render')
  await saveNotes($)
  pushBoards($)
}

// Набранное в поле «Текст» — в страницу (в списке list). Не помещается — null
export function withDraft(list, at) {
  const draft = nb.draft
  const page = draft && list.find((p) => p.id === draft.id)
  if (!page || draft.text === page.body) return list
  if (draft.text.length > MAX_BODY) return null
  return updatePage(list, page.id, { body: cleanBody(draft.text) }, at)
}

// Правка с экрана, вместе с набранным в поле «Текст»: change(list, at) → новый список или текст беды
export async function editNotes($, change, saved = '') {
  const at = await $.clock.now()
  const base = withDraft(S.notes, at)
  const next = base && change(base, at)
  const problem = !base ? NOTE_TOO_LONG : typeof next === 'string' ? next : fits(next) ? '' : NOTES_FULL
  nb.note = problem || saved
  nb.bad = Boolean(problem)
  if (problem) {
    $.ui.invalidate('ui.render')
    return false
  }
  if (next !== S.notes) await notesChanged($, next)
  else $.ui.invalidate('ui.render')
  return true
}

// Новая страница (или подстраница parent) — и сразу открыть её
export async function createPage($, title, parent = null) {
  let page = null
  const done = await editNotes($, (list, at) => {
    const made = addPage(list, { title, parent }, at)
    if (made.error) return made.error === 'empty' ? 'Впиши название страницы.' : NOTES_FULL
    page = made.page
    return made.notes
  })
  if (!done || !page) return
  nb.focus = 'add'
  S.menuFrom = S.menu
  S.menu = `note:${page.id}`
  $.ui.invalidate('ui.render')
}

// Заметки после передачи Claude: страница блокнота или просьба про другое приложение
const GIVEN = {
  page: ['Страница ушла Claude.', 'Claude занят — страница ждёт в поле ввода: отправь её, когда он освободится.', 'Не получилось отдать страницу — попробуй ещё раз, когда Claude освободится.'],
  ask: ['Просьба ушла Claude.', 'Claude занят — просьба ждёт в поле ввода: отправь её, когда он освободится.', 'Не получилось передать просьбу — попробуй ещё раз, когда Claude освободится.'],
  board: ['Доска ушла Claude.', 'Claude занят — доска ждёт в поле ввода: отправь её, когда он освободится.', 'Не получилось отдать доску — попробуй ещё раз, когда Claude освободится.'],
}

// Текст — Claude: сразу, если он свободен, иначе — в поле ввода, к тому, что там уже набрано
export async function giveClaude($, text, what) {
  const [sentNote, busyNote, failNote] = GIVEN[what]
  if (S.status === 'idle' || S.status === 'done') {
    const sent = await $.prompt.submit({ text }).catch((err) => ({ drop: String(err?.message ?? err) }))
    if (!sent.drop) {
      nb.note = sentNote
      nb.bad = false
      $.ui.invalidate('ui.render')
      return
    }
    log(`ошибка мода: ${sent.drop.slice(0, 200)}`)
  }
  const { text: draft } = await $.prompt.read().catch(() => ({ text: '' }))
  const filled = await $.prompt.fill({ text: draft.trim() ? `\n${text}` : text, mode: 'append' }).catch(() => ({}))
  nb.note = filled.isFilled ? busyNote : failNote
  nb.bad = !filled.isFilled
  $.ui.invalidate('ui.render')
}

// Страницу — Claude
export async function sendNote($, id) {
  if (!(await editNotes($, (list) => list))) return
  const page = S.notes.find((p) => p.id === id)
  if (!page) return
  const text = [`${tr('Страница из моего блокнота Arcade', S.lang)} (id ${page.id}):`, '', `# ${page.title}`, page.body, '', tr('Отмечай сделанные пункты и дописывай итоги на этой странице инструментом mcp__arcade__notes.', S.lang)].join('\n')
  await giveClaude($, text, 'page')
}

// Просьба к Claude про другое приложение: перенести страницу туда (push), обновить её там (update), забрать текст
// оттуда (pull) или завести страницу блокнота из чужой (import). Сам Arcade ни с чем не говорит: всё делают
// коннекторы Claude (Notion, Google Docs…), ключи и пароли Arcade не нужны. Нет коннектора — Claude объяснит, как
// его подключить. Фразы — на языке интерфейса, данные (название, адрес, текст) — как есть
export function connectorPrompt(kind, { page = null, app = '', what = '' }) {
  const t = (text) => tr(text, S.lang)
  const intro = {
    push: 'Перенеси страницу из моего блокнота Arcade в другое приложение.',
    update: 'Обнови страницу в другом приложении текстом из моего блокнота Arcade.',
    pull: 'Забери текст страницы из другого приложения в мой блокнот Arcade.',
    import: 'Забери страницу из другого приложения в мой блокнот Arcade.',
  }[kind]
  const todo = {
    push: 'Создай там новую страницу с этим названием и текстом инструментами коннектора этого приложения. Потом свяжи её со страницей блокнота: mcp__arcade__notes, action link, с названием приложения и адресом новой страницы.',
    update: 'Замени текст той страницы на этот инструментами коннектора этого приложения.',
    pull: 'Прочитай ту страницу инструментами коннектора этого приложения и замени её текстом текст страницы блокнота: mcp__arcade__notes, action replace. Прежний текст останется в Arcade для отмены.',
    import: 'Найди и прочитай её инструментами коннектора (Notion, Google Docs и других). Потом создай страницу блокнота: mcp__arcade__notes, action create, с её названием и текстом, а в app и url — приложение и адрес той страницы, чтобы они остались связаны.',
  }[kind]
  const data = kind === 'import' ? [`${t('Что забрать')}: ${what}`] : [`${t('Приложение')}: ${app}`, ...(kind === 'push' ? [] : [`${t('Адрес')}: ${page.link?.url ?? ''}`]), `${t('Страница блокнота')}: ${page.id}`]
  const content = kind === 'push' || kind === 'update' ? ['', `# ${page.title}`, page.body] : []
  return [t(intro), ...data, ...content, '', t(todo), t('Нет инструментов этого приложения — ничего не делай, только объясни, как подключить его коннектор в Claude.')].join('\n')
}

// Страница из другого приложения — в браузере по умолчанию (там человек вошёл в Notion); только https
export async function openLink($, url) {
  const command = openUrlCommand(S.platform, url)
  let opened = false
  if (command) {
    try {
      opened = (await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS }))?.exitCode === 0
    } catch {
      // не открылся — адрес и так написан на экране
    }
  }
  nb.note = opened ? 'Страница открыта в браузере.' : 'Браузер не открылся — адрес страницы написан выше.'
  nb.bad = !opened
  $.ui.invalidate('ui.render')
}

// --- Доска проектов -------------------------------------------------------------------------------------------------
// Доска — страница блокнота с колонками (board), карточки — её подстраницы с колонкой и местом: хранилище, редактор
// карточки и инструмент Claude — общие с блокнотом. Общая доска живёт и на сайте Arcade: правки уходят туда вскоре после
// правки (pushBoards), чужие приходят сверкой открытой доски по таймеру; сверка — в hooks/desks.js
export const BOARD_POLL_MS = 6_000 // сверка открытой общей доски
export const BOARDS_POLL_MS = 30_000 // список общих досок на экране «Доска проектов»
const PUSH_DELAY_MS = 1_500 // правки копятся столько, прежде чем уйти на сайт
const BOARD_SYNCS = 5 // сверок подряд, пока у доски остаются правки
export const modError = (err) => log(`ошибка мода: ${err?.message ?? err}`)
// Название колонки: своё — как вписали, стандартное — на языке интерфейса
export const colName = (c) => c.name || tr(COL_NAMES[c.id] ?? c.id, S.lang)

// Почему с общей доской не вышло; made — при создании новой
function boardNote(error, made = false) {
  if (error === 'name') return 'Впиши название доски.'
  if (error === 'friend') return 'Звать на доску можно только друзей.'
  if (error === 'owner') return 'Это может только хозяин доски.'
  if (error === 'gone') return 'Доски больше нет на сайте или тебя на ней нет — у тебя осталась своя копия.'
  if (error === 'full') return 'На доске уже 20 человек — больше не позвать.'
  if (error === 'many') return 'Своих общих досок — не больше 3. Больше — скоро по подписке.'
  if (error === 'nohandle') return 'Сначала возьми свой @ник.'
  if (error === 'often' || error === 'limit') return made ? 'Досок сегодня создано слишком много — попробуй завтра.' : 'Слишком часто — подожди минуту.'
  if (error === 'big') return 'Доска не приняла правки — их слишком много за раз.'
  if (error === 'off') return 'Общие доски на сайте сейчас выключены.'
  return accountNote(error)
}

export function saveDesks($) {
  $.store.set('desks', S.desks).catch(modError)
}

// Доска на экране: открытая доска или доска открытой карточки
export function shownBoard() {
  const id = S.menu.startsWith('board:') ? S.menu.slice(6) : S.menu.startsWith('note:') ? S.menu.slice(5) : ''
  const page = id ? S.notes.find((p) => p.id === id) : null
  if (!page) return null
  if (isBoard(page)) return page
  const parent = page.parent ? S.notes.find((p) => p.id === page.parent) : null
  return isBoard(parent) ? parent : null
}

// Блокнот поменялся сверкой с сайтом: поле открытой карточки рисуется заново, только если её поменял сайт, а человек в
// ней ничего не набрал; открытую карточку удалили — назад к доске. changed — id карточек, которые поменял сайт
async function boardChanged($, list, changed = []) {
  const shown = shownBoard()
  const before = shown && S.notes.find((p) => p.id === shown.id)
  S.notes = list
  const open = S.menu.startsWith('note:') ? S.menu.slice(5) : ''
  if (open && !S.notes.some((p) => p.id === open)) {
    nb.draft = null
    S.menuFrom = null
    S.menu = shown && S.notes.some((p) => p.id === shown.id) ? `board:${shown.id}` : 'notes'
    S.dk.note = 'Открытую карточку удалили на общей доске.'
    S.dk.bad = true
    nb.field++
  } else if (open && changed.includes(open) && nb.draft?.id !== open) nb.field++
  const after = shown && S.notes.find((p) => p.id === shown.id)
  if (before !== after) S.dk.field++
  if (S.dk.pick && !S.notes.some((p) => p.id === S.dk.pick)) S.dk.pick = ''
  $.ui.invalidate('ui.render')
  return saveNotes($)
}

// Сверка общей доски share с сайтом: свои правки — туда, чужие — сюда. Пока одна сверка идёт, вторая ждёт (again);
// после сверки остались правки — ещё одна, но не больше BOARD_SYNCS подряд. names — спросить ники участников
export async function syncBoard($, share, { names = false } = {}, round = 0) {
  if (S.dk.syncing.has(share)) {
    S.dk.again.add(share)
    return
  }
  const base = S.desks[share]
  if (!base || !S.acct.session) return
  S.dk.syncing.add(share)
  S.dk.again.delete(share)
  let more = false
  try {
    const { ops, sent } = planSync(S.notes, base)
    const answer = await chatFetch($, 'boardsync', parseBoard, { body: { board: share, since: base.rev, ops, ...(names || base.rev === 0 ? { names: true } : {}) } })
    if (!answer || S.desks[share] !== base) return
    if (answer.error === 'gone') return await loseBoard($, share, boardNote('gone'), true)
    if (answer.error) {
      S.dk.trouble = { share, text: boardNote(answer.error) }
      if (shownBoard()?.board.share === share) $.ui.invalidate('ui.render')
      return
    }
    const at = await $.clock.now()
    if (S.desks[share] !== base) return
    const done = applySync(S.notes, base, answer, sent, at)
    if (!done) {
      delete S.desks[share]
      saveDesks($)
      return
    }
    const before = JSON.stringify([base.owner, base.members, base.names, S.dk.trouble, S.dk.note])
    S.desks[share] = done.base
    if (S.dk.trouble?.share === share) S.dk.trouble = null
    if (done.refused.length) {
      S.dk.note = 'Доска на сайте полна — часть карточек осталась только у тебя.'
      S.dk.bad = true
    }
    if (done.missed) {
      S.dk.note = 'Блокнот полон — не все карточки доски поместились.'
      S.dk.bad = true
    }
    const shown = shownBoard()?.board.share === share
    if (done.notes !== S.notes) await boardChanged($, done.notes, done.changed)
    else if (shown && before !== JSON.stringify([done.base.owner, done.base.members, done.base.names, S.dk.trouble, S.dk.note])) $.ui.invalidate('ui.render')
    saveDesks($)
    more = !done.missed && planSync(S.notes, done.base).ops.length > 0
  } finally {
    S.dk.syncing.delete(share)
    if ((more || S.dk.again.has(share)) && round + 1 < BOARD_SYNCS) syncBoard($, share, {}, round + 1).catch(modError)
  }
}

// Общей доски у человека больше нет (удалили, убрали его или вышел сам): в блокноте она остаётся своей
async function loseBoard($, share, note, bad = false) {
  delete S.desks[share]
  if (S.dk.list) S.dk.list = S.dk.list.filter((b) => b.id !== share)
  if (S.dk.trouble?.share === share) S.dk.trouble = null
  const at = await $.clock.now()
  const page = S.notes.find((p) => isBoard(p) && p.board.share === share)
  S.dk.note = note
  S.dk.bad = bad
  S.dk.confirm = ''
  saveDesks($)
  if (page) await boardChanged($, detachBoard(S.notes, page.id, at))
  else $.ui.invalidate('ui.render')
}

// Правки общих досок — на сайт вскоре после правки: несколько подряд уходят одной сверкой
export function pushBoards($) {
  if (!S.acct.session || !Object.keys(S.desks).length) return
  S.pushTimer?.cancel()
  S.pushTimer = $.clock.after(PUSH_DELAY_MS, () => {
    S.pushTimer = null
    for (const share of Object.keys(S.desks)) if (S.desks[share] && planSync(S.notes, S.desks[share]).ops.length) syncBoard($, share).catch(modError)
  })
}

// Общие доски с сайта: новые — в блокнот, доски, которых на сайте у человека больше нет, — своими. quiet — по
// таймеру: заметку не трогаем и перерисовываем, только если что-то поменялось
export async function loadBoards($, quiet = false) {
  if (!S.acct.session || S.dk.loading) return
  S.dk.loading = true
  if (!quiet) $.ui.invalidate('ui.render')
  // Доски, которые были общими до вопроса: общую, которой поделились, пока ждали ответа, не трогаем
  const known = new Set([...Object.keys(S.desks), ...S.notes.filter((p) => isBoard(p) && p.board.share).map((p) => p.board.share)])
  const answer = await chatFetch($, 'boards', parseBoards)
  S.dk.loading = false
  if (!answer) return
  if (answer.error) {
    if (quiet) return
    S.dk.note = boardNote(answer.error)
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  const before = JSON.stringify([S.dk.list, S.dk.names])
  S.dk.me = answer.me
  S.dk.names = { ...S.dk.names, ...answer.names }
  S.dk.list = answer.boards
  const at = await $.clock.now()
  let list = S.notes
  let full = false
  let lost = false
  for (const b of answer.boards) {
    if (S.desks[b.id] || S.dk.busy === 'share') continue
    const page = list.find((p) => isBoard(p) && p.board.share === b.id)
    if (page) {
      S.desks[b.id] = freshBase(list, page, b.owner)
      continue
    }
    const made = adoptBoard(list, b, at)
    if (made.error) {
      full = true
      continue
    }
    list = made.notes
    S.desks[b.id] = made.base
  }
  // Список целиком (не обрезан): общих досок, которых в нём нет, у человека на сайте больше нет
  if (answer.boards.length < 200) {
    const listed = new Set(answer.boards.map((b) => b.id))
    for (const share of known) {
      if (listed.has(share)) continue
      delete S.desks[share]
      const page = list.find((p) => isBoard(p) && p.board.share === share)
      if (page) list = detachBoard(list, page.id, at)
      lost = true
    }
  }
  if (full) {
    S.dk.note = 'Блокнот полон — не все общие доски поместились.'
    S.dk.bad = true
  } else if (lost) {
    S.dk.note = boardNote('gone')
    S.dk.bad = false
  }
  if (S.dk.trouble && !S.desks[S.dk.trouble.share]) S.dk.trouble = null
  if (list !== S.notes) await boardChanged($, list)
  else if (!quiet || full || lost || JSON.stringify([S.dk.list, S.dk.names]) !== before) $.ui.invalidate('ui.render')
  saveDesks($)
  // Доски, которые поменялись на сайте или ждут своих правок, — сверить
  const stale = answer.boards.filter((b) => S.desks[b.id] && (S.desks[b.id].rev === 0 || S.desks[b.id].rev !== b.rev || planSync(S.notes, S.desks[b.id]).ops.length))
  for (const b of stale.slice(0, BOARD_SYNCS)) syncBoard($, b.id, { names: true }).catch(modError)
}

// Экран «Доска проектов» открыли: общие доски и друзья (звать на доску) — с сайта
export function boardsOpened($) {
  S.dk.note = ''
  S.dk.bad = false
  if (!S.acct.session) return
  loadBoards($).catch(modError)
  if (S.acct.handle && !S.fr.list && !S.fr.loading) friendsCall($, 'friends').catch(modError)
}

// Поделиться доской pageId с отмеченными друзьями: доска появляется на сайте, карточки уходят туда первой сверкой
export async function shareBoard($, pageId) {
  const page = S.notes.find((p) => p.id === pageId)
  if (!isBoard(page) || page.board.share || S.dk.busy) return
  if (!S.dk.picked.size) {
    S.dk.note = 'Отметь хотя бы одного друга.'
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  if (S.dk.picked.size > MAX_MEMBERS - 1) {
    S.dk.note = boardNote('full')
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  S.dk.busy = 'share'
  S.dk.note = ''
  S.dk.bad = false
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'boardnew', parseBoard, { body: { name: page.title, cols: page.board.cols, members: [...S.dk.picked] } })
  S.dk.busy = ''
  if (!answer) return $.ui.invalidate('ui.render')
  if (answer.error) {
    S.dk.note = boardNote(answer.error, true)
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  const at = await $.clock.now()
  const top = S.notes.find((p) => p.id === pageId)
  if (!isBoard(top) || top.board.share) return $.ui.invalidate('ui.render')
  const share = answer.board.id
  const list = updatePage(S.notes, pageId, { board: { ...top.board, share } }, at)
  // Карточек на сайте ещё нет: основа без них — первая сверка отдаст их все
  S.desks[share] = { ...freshBase(list, top, answer.board.owner), name: answer.board.name, cols: answer.board.cols, rev: answer.board.rev, cards: {}, members: answer.board.members, names: answer.names }
  S.dk.me ||= answer.board.owner
  S.dk.names = { ...S.dk.names, ...answer.names }
  S.dk.list = [{ id: share, name: answer.board.name, owner: answer.board.owner, rev: answer.board.rev, at }, ...(S.dk.list ?? [])]
  S.dk.picked.clear()
  S.dk.note = 'Доска общая — друзья увидят её в своей «Доске проектов».'
  S.dk.bad = false
  saveDesks($)
  await boardChanged($, list)
  await syncBoard($, share, { names: true })
}

// Участники общей доски: позвать (add), убрать (remove) или выйти самому (leave); done — заметка, когда вышло
export async function boardMembers($, share, body, done) {
  const base = S.desks[share]
  if (S.dk.busy || !base) return
  S.dk.busy = body.leave ? 'leave' : body.add ? 'add' : 'remove'
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'boardmembers', parseBoardDone, { body: { board: share, ...body } })
  S.dk.busy = ''
  if (!answer) return $.ui.invalidate('ui.render')
  if (answer.error === 'gone') return loseBoard($, share, boardNote('gone'), true)
  if (answer.error) {
    S.dk.note = boardNote(answer.error)
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  if (answer.left) return loseBoard($, share, 'Ты больше не на этой доске — у тебя осталась своя копия.')
  if (S.desks[share] !== base) return $.ui.invalidate('ui.render')
  Object.assign(base, { owner: answer.board.owner, members: answer.board.members, names: { ...base.names, ...answer.names } })
  S.dk.picked.clear()
  S.dk.note = done
  S.dk.bad = false
  saveDesks($)
  $.ui.invalidate('ui.render')
}

// Хозяин удаляет общую доску с сайта, участник — выходит с неё; оба раза — после второго нажатия
export async function unshareBoard($, share) {
  const base = S.desks[share]
  if (!base || S.dk.busy) return
  if (S.dk.confirm !== `off-${share}`) {
    S.dk.confirm = `off-${share}`
    return $.ui.invalidate('ui.render')
  }
  S.dk.confirm = ''
  if (base.owner !== (S.dk.me || S.ch.me)) return boardMembers($, share, { leave: true }, '')
  S.dk.busy = 'delete'
  $.ui.invalidate('ui.render')
  const answer = await chatFetch($, 'boarddelete', parseBoardDone, { body: { board: share } })
  S.dk.busy = ''
  if (!answer) return $.ui.invalidate('ui.render')
  if (answer.error && answer.error !== 'gone') {
    S.dk.note = boardNote(answer.error)
    S.dk.bad = true
    return $.ui.invalidate('ui.render')
  }
  await loseBoard($, share, 'Доска удалена с сайта — у тебя и у друзей остались свои копии.')
}

// Правка доски с экрана: как в блокноте (editNotes), заметка — под доской
export async function editBoard($, change, saved = '') {
  const done = await editNotes($, change, saved)
  S.dk.note = nb.note
  S.dk.bad = nb.bad
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
  return done
}

// Новая доска — и сразу открыть её, курсор — в поле новой карточки первой колонки
export async function createBoard($, title) {
  let page = null
  const done = await editBoard($, (list, at) => {
    const made = addPage(list, { title, board: {} }, at)
    if (made.error) return made.error === 'empty' ? 'Впиши название доски.' : NOTES_FULL
    page = made.page
    return made.notes
  })
  if (!done || !page) return
  S.dk.focus = `new-${page.board.cols[0].id}`
  S.menuFrom = S.menu
  S.menu = `board:${page.id}`
  $.ui.invalidate('ui.render')
}

// Новая карточка — вниз колонки col
export async function createCard($, boardId, col, title) {
  S.dk.focus = `new-${col}`
  await editBoard($, (list, at) => {
    const made = addPage(list, { title, parent: boardId, id: cardId(), col }, at)
    if (made.error) return made.error === 'empty' ? 'Впиши название карточки.' : made.error === 'parent' ? list : NOTES_FULL
    return made.notes
  })
}

// Участник доски: @ник — из доски, списка досок, чатов или друзей
export function deskPerson(id, base) {
  const handle = base?.names[id] ?? S.dk.names[id] ?? S.ch.names[id] ?? S.fr.list?.friends.find((p) => p.id === id)?.handle
  if (handle) return `@${handle}`
  if (id && id === (S.dk.me || S.ch.me) && S.acct.handle) return `@${S.acct.handle}`
  return tr('удалённый аккаунт', S.lang)
}

// Доску — Claude: колонки и карточки с id, чтобы он правил и переносил их инструментом блокнота
export async function sendBoard($, id) {
  if (!(await editBoard($, (list) => list))) return
  const board = S.notes.find((p) => p.id === id && isBoard(p))
  if (!board) return
  const t = (text) => tr(text, S.lang)
  const lines = [`${t('Доска проектов из моего блокнота Arcade')} (id ${board.id}):`, '', `# ${board.title}`]
  for (const c of board.board.cols) {
    lines.push('', `## ${colName(c)} (${t('колонка')} ${c.id})`)
    for (const card of columnCards(S.notes, board, c.id)) {
      const { done, total } = checkStats(card.body)
      lines.push(`- ${card.title} (id ${card.id})${total ? ` ☑ ${done}/${total}` : ''}`)
    }
  }
  lines.push('', t('Добавляй, правь и переноси карточки этой доски инструментом mcp__arcade__notes.'))
  await giveClaude($, lines.join('\n'), 'board')
  S.dk.note = nb.note
  S.dk.bad = nb.bad
  nb.note = ''
  nb.bad = false
  $.ui.invalidate('ui.render')
}
