// Arcade: экран «Агенты» — сессии Claude Code с Arcade на этом компьютере: что делает каждая, какую карточку, где очередь,
// чего ждёт. На вопрос Claude (AskUserQuestion) здесь можно ответить; разрешение на инструмент — только в самой сессии
import { fill } from '../chats.js'
import { keep, tr } from '../i18n.js'
import { S } from '../app/state.js'
import { STATUS_LABEL, agentsList, agoText } from '../app/agents.js'
import { allPicked, askOf, isSent, pickOption, picksOf, sendAnswer } from '../app/asks.js'

// Цвет состояния: ждёт разрешения — бедой, закончил ход — успехом, работает — подсказкой, свободна — серым
const STATUS_COLOR = { permission: 'error', done: 'success', working: 'suggestion', idle: '' }
// Те же цвета для рамки и подложки карточки в Desktop
const STATUS_HEX = { permission: '#e5484d', done: '#30a46c', working: '#3e63dd', idle: '#8b8d98' }

// Сессии — в Desktop карточками, как события календаря, в терминале и VS Code — строками. Имена папок и названия
// карточек — человека, без перевода (keep)
export function agentsScreen($, e, kit) {
  const { Box, Button, Text, desktop, dim, gap, hint, noticeLines, now, open } = kit
  const list = agentsList(now)
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  const nameOf = (r) => (r.me ? `${r.name} · ${tr('эта сессия', S.lang)}` : r.name)
  const labelOf = (r) => (askOf(r)?.kind === 'question' ? 'ждёт ответа' : STATUS_LABEL[r.status] ?? STATUS_LABEL.idle)
  const stateOf = (r) => `${tr(labelOf(r), S.lang)} · ${tr(agoText(now - r.since), S.lang)}`
  const cardOf = (r) => (r.card ? (r.card.boardTitle ? fill(tr('«{0}» на доске «{1}»', S.lang), [r.card.title, r.card.boardTitle]) : `«${r.card.title}»`) : '')
  const queueOf = (r) => (r.queue?.of ? fill(tr('Очередь: карточка {0} из {1}', S.lang), [r.queue.n, r.queue.of]) : '')
  const status = (r) => {
    const color = STATUS_COLOR[r.status]
    return keep(Text({ ...(color ? { color } : { dimColor: true }), children: [stateOf(r)] }))
  }
  const wrapRow = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  // Чего ждёт сессия. Запрос разрешения — только показать: разрешают в самой сессии. Вопрос — варианты кнопками: один
  // вопрос с одним ответом уходит сразу, иначе — отметить варианты и «Ответить». Вопрос и варианты — Claude, без перевода
  const askLines = (r) => {
    const ask = askOf(r)
    if (!ask) return []
    const id = r.sid || 'me'
    if (ask.kind === 'permission') {
      const what = ask.what ? `${ask.tool}: ${ask.what}` : ask.tool
      return [...(what ? [keep(dim(what))] : []), dim('Разрешение даётся только в самой сессии.')]
    }
    if (isSent(r, ask)) return [dim('Ответ отправлен — сессия получит его через секунду.')]
    const picks = picksOf(r, ask)
    const one = ask.questions.length === 1 && !ask.questions[0].multi
    return [
      ...ask.questions.flatMap((q, qi) => [
        ...(q.header ? [keep(dim(q.header))] : []),
        keep(Text({ ...(desktop ? { wrap: 'wrap' } : {}), children: [q.question] })),
        wrapRow(
          `agents-q-${id}-${qi}`,
          q.options.map((label, oi) =>
            keep(Button({ key: `agents-q-${id}-${qi}-${oi}`, label: `${picks[qi].includes(label) ? '✓ ' : ''}${label}`, onPress: () => pickOption($, r, ask, qi, label) })),
          ),
        ),
      ]),
      ...(!one && allPicked(r, ask) ? [Button({ key: `agents-send-${id}`, label: 'Ответить', onPress: () => sendAnswer($, r, ask, picksOf(r, ask)) })] : []),
    ]
  }
  const card = (r) => {
    const hex = STATUS_HEX[r.status] ?? STATUS_HEX.idle
    const lines = [cardOf(r), queueOf(r)].filter(Boolean)
    return Box({
      key: `agents-card-${r.sid || 'me'}`,
      flexDirection: 'column',
      alignItems: 'flex-start',
      rowGap: 'xs',
      borderStyle: 'round',
      borderColor: `${hex}80`,
      backgroundColor: `${hex}14`,
      paddingX: 'sm',
      paddingY: 'xs',
      children: [keep(strong(nameOf(r))), status(r), ...lines.map((x) => keep(dim(x))), ...askLines(r)],
    })
  }
  const line = (r) => {
    const color = STATUS_COLOR[r.status]
    const rest = [cardOf(r), queueOf(r)].filter(Boolean).join(' · ')
    return Box({
      key: `agents-line-${r.sid || 'me'}`,
      flexDirection: 'column',
      children: [
        keep(Text({ children: [Text({ bold: true, children: [nameOf(r)] }), ' — ', Text({ ...(color ? { color } : { dimColor: true }), children: [stateOf(r)] })] })),
        ...(rest ? [keep(dim(`  ${rest}`))] : []),
        ...(askOf(r) ? [Box({ key: `agents-ask-${r.sid || 'me'}`, flexDirection: 'column', paddingLeft: 2, children: askLines(r) })] : []),
      ],
    })
  }
  const off = !S.ag?.on ? [gap, dim('Другие сессии здесь не видны: у этой сессии нет домашней папки.')] : []
  const others = list.length > 1 ? [] : [gap, dim('Других сессий с Arcade сейчас нет. Открой ещё одну сессию Claude Code — она появится здесь.')]
  const rows = desktop ? [Box({ key: 'agents-list', flexDirection: 'column', rowGap: 'sm', children: list.map(card) })] : list.map(line)
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    dim('Сессии Claude Code с Arcade на этом компьютере — по папке. Закрытая сессия пропадает отсюда меньше чем за минуту. Всё это видно только на этом компьютере.'),
    gap,
    ...rows,
    ...off,
    ...others,
    gap,
    dim('Очередь доски можно запустить в нескольких сессиях: нажми «Очередь для Claude» на той же доске в каждой — свободная сессия возьмёт следующую карточку.'),
    ...noticeLines,
    ...hint,
  ]
}
