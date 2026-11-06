// Arcade: экран «Агенты» — сессии Claude Code с Arcade на этом компьютере: что делает каждая, какую карточку, где очередь,
// чего ждёт. На вопрос Claude (AskUserQuestion) здесь можно ответить; разрешение на инструмент — только в самой сессии.
// Ненужную сейчас сессию можно скрыть крестиком и вернуть из «Скрытых». У каждой — что поменялось в её папке по git
import { fill } from '../chats.js'
import { keep, tr } from '../i18n.js'
import { S } from '../app/state.js'
import { STATUS_LABEL, agentsList, agoText, hideAgent } from '../app/agents.js'
import { allPicked, askOf, isSent, pickOption, picksOf, sendAnswer } from '../app/asks.js'
import { pctText, usdText } from '../app/usage.js'
import { changesOf, overlapsOf, reviewChanges } from '../app/changes.js'

// Цвет состояния: ждёт разрешения — бедой, закончил ход — успехом, работает — подсказкой, свободна — серым
const STATUS_COLOR = { permission: 'error', done: 'success', working: 'suggestion', idle: '' }
// Те же цвета для рамки и подложки карточки в Desktop
const STATUS_HEX = { permission: '#e5484d', done: '#30a46c', working: '#3e63dd', idle: '#8b8d98' }

// Сессии — в Desktop карточками, как события календаря, в терминале и VS Code — строками. Имена папок и названия
// карточек — человека, без перевода (keep)
export function agentsScreen($, e, kit) {
  const { Box, Button, Text, desktop, dim, gap, hint, noticeLines, now, open } = kit
  const all = agentsList(now)
  const hidden = new Set(S.agHidden)
  const list = all.filter((r) => r.me || !hidden.has(r.sid))
  const away = all.filter((r) => !r.me && hidden.has(r.sid))
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  const nameOf = (r) => (r.me ? `${r.name} · ${tr('эта сессия', S.lang)}` : r.name)
  const labelOf = (r) => (askOf(r)?.kind === 'question' ? 'ждёт ответа' : STATUS_LABEL[r.status] ?? STATUS_LABEL.idle)
  const stateOf = (r) => `${tr(labelOf(r), S.lang)} · ${tr(agoText(now - r.since), S.lang)}`
  const cardOf = (r) => (r.card ? (r.card.boardTitle ? fill(tr('«{0}» на доске «{1}»', S.lang), [r.card.title, r.card.boardTitle]) : `«${r.card.title}»`) : '')
  const queueOf = (r) => (r.queue?.of ? fill(tr('Очередь: карточка {0} из {1}', S.lang), [r.queue.n, r.queue.of]) : '')
  // Контекст и расходы — по последнему ответу Claude в той сессии (цифры Claude Code)
  const usageOf = (r) => [r.usage?.ctx != null ? fill(tr('Контекст: {0}', S.lang), [pctText(r.usage.ctx)]) : '', r.usage?.usd != null ? usdText(r.usage.usd) : ''].filter(Boolean).join(' · ')
  const status = (r) => {
    const color = STATUS_COLOR[r.status]
    return keep(Text({ ...(color ? { color } : { dimColor: true }), children: [stateOf(r)] }))
  }
  const wrapRow = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  // Крестик у другой сессии — скрыть: её нет в списке и нет всплывашек о ней, пока её не вернут из «Скрытых»
  const hideButton = (r) => (r.me ? [] : [keep(Button({ key: `agents-hide-${r.sid}`, label: '×', plain: true, dimColor: true, onPress: () => hideAgent($, r.sid, true) }))])
  const asks = (r) => askLines($, kit, r)
  const changes = (r) => changesLines($, kit, r, all)
  const card = (r) => {
    const hex = STATUS_HEX[r.status] ?? STATUS_HEX.idle
    const lines = [cardOf(r), queueOf(r), usageOf(r)].filter(Boolean)
    return Box({
      key: `agents-card-${r.sid || 'me'}`,
      flexDirection: 'row',
      alignItems: 'flex-start',
      columnGap: 'sm',
      borderStyle: 'round',
      borderColor: `${hex}80`,
      backgroundColor: `${hex}14`,
      paddingX: 'sm',
      paddingY: 'xs',
      children: [
        Box({ flexDirection: 'column', alignItems: 'flex-start', rowGap: 'xs', flexGrow: 1, flexShrink: 1, minWidth: 0, children: [keep(strong(nameOf(r))), status(r), ...lines.map((x) => keep(dim(x))), ...changes(r), ...asks(r)] }),
        ...hideButton(r),
      ],
    })
  }
  const line = (r) => {
    const color = STATUS_COLOR[r.status]
    const rest = [cardOf(r), queueOf(r), usageOf(r)].filter(Boolean).join(' · ')
    const head = keep(Text({ children: [Text({ bold: true, children: [nameOf(r)] }), ' — ', Text({ ...(color ? { color } : { dimColor: true }), children: [stateOf(r)] })] }))
    return Box({
      key: `agents-line-${r.sid || 'me'}`,
      flexDirection: 'column',
      children: [
        r.me ? head : Box({ flexDirection: 'row', columnGap: 2, children: [head, ...hideButton(r)] }),
        ...(rest ? [keep(dim(`  ${rest}`))] : []),
        ...(changesOf(r) ? [Box({ key: `agents-chg-${r.sid || 'me'}`, flexDirection: 'column', paddingLeft: 2, children: changes(r) })] : []),
        ...(askOf(r) ? [Box({ key: `agents-ask-${r.sid || 'me'}`, flexDirection: 'column', paddingLeft: 2, children: asks(r) })] : []),
      ],
    })
  }
  const off = !S.ag?.on ? [gap, dim('Другие сессии здесь не видны: у этой сессии нет домашней папки.')] : []
  const others = all.length > 1 ? [] : [gap, dim('Других сессий с Arcade сейчас нет. Открой ещё одну сессию Claude Code — она появится здесь.')]
  const rows = desktop ? [Box({ key: 'agents-list', flexDirection: 'column', rowGap: 'sm', children: list.map(card) })] : list.map(line)
  // Скрытые — кнопками: нажатая возвращает сессию в список; та, что ждёт разрешения или ответа, так и подписана
  const awayLabel = (r) => (r.status === 'permission' ? `${r.name} · ${tr(labelOf(r), S.lang)}` : r.name)
  const awayRows = away.length
    ? [gap, dim('Скрытые сессии — нажми, чтобы вернуть:'), wrapRow('agents-hidden', away.map((r) => keep(Button({ key: `agents-show-${r.sid}`, label: awayLabel(r), onPress: () => hideAgent($, r.sid, false) }))))]
    : []
  return [
    Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') }),
    gap,
    dim('Сессии Claude Code с Arcade на этом компьютере — по папке. Закрытая сессия пропадает отсюда меньше чем за минуту. Всё это видно только на этом компьютере.'),
    gap,
    ...rows,
    ...(S.chg.note ? [gap, Text({ ...(S.chg.bad ? { color: 'warning' } : { dimColor: true }), children: [S.chg.note] })] : []),
    ...awayRows,
    ...off,
    ...others,
    gap,
    dim('Очередь доски можно запустить в нескольких сессиях: нажми «Очередь для Claude» на той же доске в каждой — свободная сессия возьмёт следующую карточку.'),
    ...noticeLines,
    ...hint,
  ]
}

// Что поменялось в папке сессии по git: строка «ветка · изменено файлов · не закоммичено» — нажатием раскрывает файлы
// с числом строк; ниже — какие файлы правит и другая сессия. У своей — «Дать Claude: проверить изменения». Не git —
// ничего. Имена веток и файлов — человека, без перевода (keep)
export function changesLines($, kit, r, all) {
  const { Box, Button, Text, dim } = kit
  const c = changesOf(r)
  if (!c) return []
  const t = (text) => tr(text, S.lang)
  const id = r.sid || 'me'
  const head = [c.branch ? fill(t('ветка {0}'), [c.branch]) : t('без ветки')]
  head.push(...(c.n ? [fill(t('изменено файлов: {0}'), [c.n]), t('не закоммичено')] : [t('изменений нет')]))
  if (c.ahead) head.push(fill(t('не отправлено коммитов: {0}'), [c.ahead]))
  if (!c.n) return [keep(dim(head.join(' · ')))]
  const open = S.chg.open.has(id)
  const toggle = () => {
    if (open) S.chg.open.delete(id)
    else S.chg.open.add(id)
    $.ui.invalidate('ui.render')
  }
  const out = [keep(Button({ key: `agents-changes-${id}`, label: `${open ? '▾' : '▸'} ${head.join(' · ')}`, plain: true, onPress: toggle }))]
  if (open) {
    const fileText = (x) => {
      if (x.state === 'new') return `${x.path} · ${t('новый файл')}`
      if (x.state === 'bin') return `${x.path} · ${t('двоичный файл')}`
      return x.add == null ? x.path : `${x.path}  +${x.add} −${x.del ?? 0}`
    }
    out.push(...c.files.map((x) => keep(dim(`  ${fileText(x)}`))))
    if (c.n > c.files.length) out.push(keep(dim(`  ${fill(t('и ещё файлов: {0}'), [c.n - c.files.length])}`)))
  }
  // Пересечения с другими сессиями — предупреждением: одни и те же файлы правят двое
  const warn = (text) => keep(Text({ color: 'warning', children: [text] }))
  const names = (who) => who.map((w) => w.name).join('», «')
  const ov = overlapsOf(r, all)
  const sameMe = ov.same.filter((w) => w.me)
  const sameOthers = ov.same.filter((w) => !w.me)
  if (sameOthers.length) out.push(warn(fill(t('Та же папка, что у сессии «{0}»: изменения общие — чьи они, не различить.'), [names(sameOthers)])))
  if (sameMe.length) out.push(warn(t('Та же папка, что у этой сессии: изменения общие — чьи они, не различить.')))
  for (const x of ov.files.slice(0, 3)) {
    const others = x.who.filter((w) => !w.me)
    if (others.length) out.push(warn(fill(t('{0} правит и сессия «{1}»'), [x.path, names(others)])))
    if (x.who.some((w) => w.me)) out.push(warn(fill(t('{0} правит и эта сессия'), [x.path])))
  }
  if (ov.files.length > 3) out.push(warn(fill(t('и ещё общих файлов: {0}'), [ov.files.length - 3])))
  if (r.me) out.push(Button({ key: 'agents-review', label: 'Дать Claude: проверить изменения', onPress: () => reviewChanges($) }))
  return out
}

// Чего ждёт сессия. Запрос разрешения — только показать: разрешают в самой сессии. Вопрос — варианты кнопками: один
// вопрос с одним ответом уходит сразу, иначе — отметить варианты и «Ответить». Вопрос и варианты — Claude, без перевода.
// prefix — начало ключей: у «Агентов» и «Сегодня» свои
export function askLines($, kit, r, prefix = 'agents') {
  const { Box, Button, Text, desktop, dim } = kit
  const wrapRow = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
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
        `${prefix}-q-${id}-${qi}`,
        q.options.map((label, oi) =>
          keep(Button({ key: `${prefix}-q-${id}-${qi}-${oi}`, label: `${picks[qi].includes(label) ? '✓ ' : ''}${label}`, onPress: () => pickOption($, r, ask, qi, label) })),
        ),
      ),
    ]),
    ...(!one && allPicked(r, ask) ? [Button({ key: `${prefix}-send-${id}`, label: 'Ответить', onPress: () => sendAnswer($, r, ask, picksOf(r, ask)) })] : []),
  ]
}
