// Arcade: экран «Сегодня» — всё, что ждёт человека, на одном экране: сессии, которые ждут разрешения или ответа (на
// вопрос с вариантами — ответить прямо здесь), события календаря на сегодня, сроки карточек на сегодня и просроченные,
// мои карточки на общих досках, непрочитанные чаты и строка лимитов. Ничего своего не хранит: всё — из того, что Arcade
// уже знает (отметки сессий, блокнот, календарь, чаты, замеры лимитов). Пустые блоки скрыты
import { fill } from '../chats.js'
import { keep, tr } from '../i18n.js'
import { between, cardDues, dayKey, startOf } from '../calendar.js'
import { columnOf, isBoard } from '../notes.js'
import { S, cal } from '../app/state.js'
import { STATUS_LABEL, agentsList, agoText, othersNow } from '../app/agents.js'
import { askOf } from '../app/asks.js'
import { dayText } from '../app/calendar.js'
import { chatTitle, openChat } from '../app/talk.js'
import { cardTaker } from '../app/work.js'
import { clockText, freshLimits, limitName, pctText } from '../app/usage.js'
import { askLines } from './agents.js'

const SHOW_MAX = 8 // строк в блоке, не больше: остальное — «и ещё N» и плитка самого раздела

export function todayScreen($, e, kit) {
  const { Box, Button, Text, desktop, dim, gap, hint, noticeLines, now, open, section } = kit
  const t = (text) => tr(text, S.lang)
  const today = dayKey(now)
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', alignItems: 'flex-start', children: list })] : list)
  // Больше SHOW_MAX — первые и «и ещё N» кнопкой в сам раздел
  const capped = (key, list, more) => (list.length > SHOW_MAX ? [...list.slice(0, SHOW_MAX), Button({ key: `${key}-more`, label: fill(t('и ещё {0}'), [list.length - SHOW_MAX]), plain: true, onPress: more })] : list)
  const blocks = []

  // ——— 1. Ждут тебя: сессии, которые ждут разрешения или ответа ———
  const hidden = new Set(S.agHidden ?? [])
  const waiting = agentsList(now).filter((r) => (r.me || !hidden.has(r.sid)) && (r.status === 'permission' || askOf(r)))
  if (waiting.length) {
    const nameOf = (r) => (r.me ? `${r.name} · ${t('эта сессия')}` : r.name)
    const stateOf = (r) => `${t(askOf(r)?.kind === 'question' ? 'ждёт ответа' : STATUS_LABEL.permission)} · ${t(agoText(now - r.since))}`
    const cardOf = (r) => (r.card ? (r.card.boardTitle ? fill(t('«{0}» на доске «{1}»'), [r.card.title, r.card.boardTitle]) : `«${r.card.title}»`) : '')
    const one = (r) => {
      const id = r.sid || 'me'
      const what = cardOf(r)
      const body = [keep(strong(nameOf(r))), keep(Text({ color: 'error', children: [stateOf(r)] })), ...(what ? [keep(dim(what))] : []), ...askLines($, kit, r, 'today')]
      return desktop
        ? Box({ key: `today-ask-${id}`, flexDirection: 'column', alignItems: 'flex-start', rowGap: 'xs', borderStyle: 'round', borderColor: '#e5484d80', backgroundColor: '#e5484d14', paddingX: 'sm', paddingY: 'xs', children: body })
        : Box({ key: `today-ask-${id}`, flexDirection: 'column', children: body })
    }
    blocks.push(section('Ждут тебя'), ...stack('today-asks', waiting.map(one)))
  }

  // ——— 2. В календаре: события на сегодня; прошедшие — бледнее ———
  const events = between(S.calendar, today, 1)
  if (events.length) {
    const toEvent = (x) => () => {
      Object.assign(cal, { note: '', bad: false, confirm: false, focus: '', back: '', day: '', month: '' })
      open(`calendar:${x.id}`)()
    }
    const rows = events.map((x) => {
      const past = x.time && startOf(x) < now
      const label = `${x.time || t('весь день')} · ${x.title}`
      return keep(Button({ key: `today-ev-${x.id}`, label, plain: true, ...(past ? { dimColor: true } : {}), onPress: toEvent(x) }))
    })
    blocks.push(section('В календаре'), ...stack('today-events', capped('today-events', rows, open('calendar'))))
  }

  // ——— 3. Сроки: карточки со сроком сегодня и просроченные, что не в последней колонке ———
  const dues = cardDues(S.notes).filter((x) => !x.done && x.day <= today)
  const shownCards = new Set(dues.map((x) => x.card))
  if (dues.length) {
    const rows = dues.map((x) => {
      const late = x.day < today
      const when = late ? fill(t('просрочено, срок {0}'), [dayText(x.day, today)]) : t('сегодня')
      return keep(
        Button({
          key: `today-due-${x.card}`,
          label: `${x.title} — ${x.board}`,
          plain: true,
          onPress: open(`note:${x.card}`),
          children: [Text({ children: [`${x.title} — ${x.board} · `, Text({ color: late ? 'error' : 'warning', children: [when] })] })],
        }),
      )
    })
    blocks.push(section('Сроки'), ...stack('today-dues', capped('today-dues', rows, open('calendar'))))
  }

  // ——— 4. Мои карточки: взятые мной на общих досках и не сделанные ———
  const mine = []
  for (const board of S.notes) {
    if (!isBoard(board) || !board.board.share) continue
    const last = board.board.cols.at(-1).id
    for (const card of S.notes) {
      if (card.parent !== board.id || shownCards.has(card.id) || columnOf(card, board.board.cols) === last) continue
      const { me, taken } = cardTaker(card)
      if (me && taken === me) mine.push({ card, board })
    }
  }
  if (mine.length) {
    const rows = mine.map(({ card, board }) => keep(Button({ key: `today-mine-${card.id}`, label: `${card.title} — ${board.title}`, plain: true, onPress: open(`note:${card.id}`) })))
    blocks.push(section('Мои карточки'), ...stack('today-mine', capped('today-mine', rows, open('boards'))))
  }

  // ——— 5. Чаты: непрочитанные, если человек вошёл ———
  if (S.acct.session && S.acct.unread > 0) {
    const chats = (S.ch.list ?? []).filter((c) => c.unread > 0)
    const rows = chats.length
      ? chats.map((c) => keep(Button({ key: `today-chat-${c.id}`, label: `${chatTitle(c)} · ${c.unread}`, plain: true, onPress: () => openChat($, c.id) })))
      : [keep(Button({ key: 'today-chats', label: fill(t('Непрочитанных сообщений: {0}'), [S.acct.unread]), plain: true, onPress: open('chats') }))]
    blocks.push(section('Чаты'), ...stack('today-chats', capped('today-chats', rows, open('chats'))))
  }

  // ——— 6. Лимиты: одна строка из самого свежего замера ———
  const fresh = freshLimits(othersNow())
  if (fresh) {
    const parts = fresh.limits.map((w) => `${limitName(w.kind)}: ${pctText(w.pct)}${w.reset && w.reset > now ? `, ${fill(t('сброс в {0}'), [clockText(w.reset, now)])}` : ''}`)
    const hot = fresh.limits.some((w) => w.pct >= 80)
    blocks.push(
      section('Лимиты'),
      keep(Button({ key: 'today-usage', label: parts.join(' · '), plain: true, ...(hot ? { children: [Text({ color: 'warning', children: [parts.join(' · ')] })] } : {}), onPress: open('usage') })),
    )
  }

  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    ...(blocks.length ? blocks : [dim('На сегодня всё.')]),
    ...noticeLines,
    ...hint,
  ]
}
