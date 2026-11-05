// Arcade: экран «Лимиты» — окна лимитов Claude (5 часов, неделя, лимит расходов), контекст и расходы этой и других
// сессий, очередь доски после сброса лимита. Цифры — самого Claude Code ($.session.usage): Arcade своих
// не считает. Окна — у учётной записи, общие для всех её сессий: на экране — самый свежий замер из всех сессий
import { fill } from '../chats.js'
import { keep, tr } from '../i18n.js'
import { isBoard } from '../notes.js'
import { S } from '../app/state.js'
import { agentsList, agoText, othersNow } from '../app/agents.js'
import { clockText, freshLimits, limitName, pctText, resetText, usdText } from '../app/usage.js'
import { armBoard, cancelWait, missedClear, waitFor } from '../app/queue.js'

// Цвет окна: до 80% — спокойный, с 80% — предупреждение, кончилось — беда
const levelOf = (pct) => (pct >= 100 ? 'error' : pct >= 80 ? 'warning' : 'suggestion')
const LEVEL_HEX = { error: '#e5484d', warning: '#f5a524', suggestion: '#3e63dd' }
const BAR_CELLS = 20

// Полоска заполнения: в Desktop — картинкой, в терминале и VS Code — клетками
const barSvg = (pct, hex) => {
  const w = Math.round(Math.min(100, Math.max(0, pct)) * 2)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 8"><rect width="200" height="8" rx="4" fill="#8b8d98" fill-opacity="0.25"/>${w ? `<rect width="${w}" height="8" rx="4" fill="${hex}"/>` : ''}</svg>`
}
const barCells = (pct) => {
  const n = Math.round((Math.min(100, Math.max(0, pct)) / 100) * BAR_CELLS)
  return `${'█'.repeat(n)}${'░'.repeat(BAR_CELLS - n)}`
}

export function usageScreen($, e, kit) {
  const { Box, Button, Svg, Text, desktop, dim, gap, hint, noticeLines, now, open, section } = kit
  const t = (text) => tr(text, S.lang)
  const strong = (text) => Text(desktop ? { weight: 'semibold', children: [text] } : { bold: true, children: [text] })
  const wrapRow = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  const me = S.us.me
  const others = othersNow()
  const fresh = freshLimits(others)

  // ——— Окна лимитов ———
  const windowRow = (w) => {
    const level = levelOf(w.pct)
    const when = resetText(w.reset, now)
    if (desktop) {
      return Box({
        key: `usage-win-${w.kind}`,
        flexDirection: 'column',
        rowGap: 'xs',
        children: [
          Box({ flexDirection: 'row', columnGap: 'sm', children: [strong(limitName(w.kind)), keep(Text({ color: level, children: [pctText(w.pct)] }))] }),
          keep(Svg({ source: barSvg(w.pct, LEVEL_HEX[level]), alt: pctText(w.pct), width: 200, height: 8 })),
          ...(when ? [keep(dim(when))] : []),
        ],
      })
    }
    return keep(
      Text({
        key: `usage-win-${w.kind}`,
        children: [Text({ bold: true, children: [limitName(w.kind)] }), '  ', Text({ color: level, children: [`${barCells(w.pct)} ${pctText(w.pct)}`] }), ...(when ? [Text({ dimColor: true, children: [` · ${when}`] })] : [])],
      }),
    )
  }
  // Окна — и из замера другой сессии, если эта их не знает. Окон нет: до первого ответа Claude их не знает никто; после
  // ответа — значит, ключ API или шлюз
  let windows
  if (fresh) {
    windows = [
      desktop ? Box({ key: 'usage-wins', flexDirection: 'column', rowGap: 'md', children: fresh.limits.map(windowRow) }) : Box({ key: 'usage-wins', flexDirection: 'column', children: fresh.limits.map(windowRow) }),
      keep(dim(fill(t('Замер — {0} назад.'), [t(agoText(now - fresh.at))]))),
    ]
  } else if (!S.us.api) windows = [dim('Этот Claude Code лимитов не сообщает — нужен Claude Code новее.')]
  else if (me && (me.ctx != null || me.tokens != null)) windows =[dim('Окон лимитов нет: так бывает с ключом API или шлюзом. Окна 5 часов и недели — у подписок Claude (Pro, Max, Team, Enterprise). Расходы — ниже.')]
  else windows = [dim('Появится после первого ответа Claude.')]

  // ——— Эта сессия ———
  const mine = []
  if (S.us.api && me) {
    if (me.ctx != null) {
      const of = me.tokens != null && me.window ? ` (${fill(t('{0} из {1} токенов'), [me.tokens.toLocaleString('en-US'), me.window.toLocaleString('en-US')])})` : ''
      const [pre, post = ''] = t('Контекст: {0}').split('{0}')
      mine.push(keep(Text({ children: [pre, Text({ color: levelOf(me.ctx), children: [pctText(me.ctx)] }), post, of] })))
    }
    if (me.usd != null) mine.push(keep(Text({ children: [fill(t('Расходы с начала сессии: {0}'), [usdText(me.usd)])] })))
  }
  if (S.us.api && !mine.length) mine.push(dim('Появится после первого ответа Claude.'))

  // ——— Другие сессии ———
  const hidden = new Set(S.agHidden ?? [])
  const rest = agentsList(now).filter((r) => !r.me && !hidden.has(r.sid))
  const usageOf = (r) =>
    [r.usage?.ctx != null ? fill(t('Контекст: {0}'), [pctText(r.usage.ctx)]) : '', r.usage?.usd != null ? usdText(r.usage.usd) : ''].filter(Boolean).join(' · ') || t('замеров ещё нет')
  const otherRows = rest.length
    ? [section('Другие сессии'), ...rest.map((r) => keep(Text({ key: `usage-other-${r.sid}`, children: [Text({ bold: true, children: [r.name] }), Text({ dimColor: true, children: [` — ${usageOf(r)}`] })] })))]
    : []

  // ——— Очередь после сброса лимита ———
  const titleOf = (id, fallback) => S.notes.find((p) => p.id === id)?.title ?? fallback ?? ''
  const queueRows = []
  const w = S.qr.wait
  if (w) {
    queueRows.push(
      keep(Text({ color: 'suggestion', children: [fill(t('Очередь «{0}» продолжится в {1}.'), [titleOf(w.board, w.title), clockText(w.at, now)])] })),
      Button({ key: 'usage-wait-cancel', label: 'Не продолжать', onPress: () => cancelWait($) }),
    )
  } else if (S.qr.offer && now < S.qr.offer.at) {
    const o = S.qr.offer
    queueRows.push(
      keep(dim(fill(t('Очередь «{0}» остановилась: кончился лимит Claude.'), [titleOf(o.board, o.title)]))),
      Button({ key: 'usage-offer', label: fill(t('Продолжить очередь после сброса в {0}'), [clockText(o.at, now)]), onPress: () => waitFor($, o) }),
    )
  }
  for (const m of S.qr.missed) {
    queueRows.push(
      Box({
        key: `usage-missed-${m.board}`,
        flexDirection: 'row',
        columnGap: 2,
        children: [keep(Text({ color: 'warning', children: [m.text] })), Button({ key: `usage-missed-off-${m.board}`, label: '×', plain: true, dimColor: true, onPress: () => missedClear($, m.board) })],
      }),
    )
  }
  const boards = S.notes.filter((p) => isBoard(p))
  const armRows = boards.length
    ? [
        dim('Продолжать очередь после сброса самой, без кнопки, — на досках (нажми, чтобы отметить):'),
        wrapRow(
          'usage-armed',
          boards.map((b) => {
            const on = S.qr.armed.includes(b.id)
            return keep(Button({ key: `usage-arm-${b.id}`, label: `${on ? '✓ ' : ''}${b.title}`, onPress: () => armBoard($, b.id, !on) }))
          }),
        ),
      ]
    : [dim('Досок пока нет — очередь для Claude запускается на доске.')]

  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    dim('Цифры — самого Claude Code: Arcade своих не считает. Окна лимитов — у учётной записи, общие для всех её сессий.'),
    section('Окна лимитов'),
    ...windows,
    ...(S.us.api ? [section('Эта сессия'), ...mine] : []),
    ...otherRows,
    section('Очередь после сброса лимита'),
    dim('Кончился лимит посреди очереди доски — она встанет и может продолжиться после сброса, с той же карточки. Только пока Claude Code открыт и компьютер не спит.'),
    ...(queueRows.length ? [gap, ...queueRows] : []),
    gap,
    ...armRows,
    ...noticeLines,
    ...hint,
  ]
}
