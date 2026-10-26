// Arcade: экран досок проектов.
import { keep, tr } from '../i18n.js'
import { addColumn, checkStats, cleanTitle, columnCards, isBoard, moveCard, notesOrder, removeColumn, removePage, renameColumn, updatePage } from '../notes.js'
import { MAX_MEMBERS, colId } from '../desks.js'
import { S, nb } from '../app/state.js'
import { startLogin } from '../app/profile.js'
import { friendsCall } from '../app/talk.js'
import { boardMembers, colName, createBoard, createCard, deskPerson, editBoard, forgetDesk, loadBoards, modError, sendBoard, shareBoard, syncBoard, unshareBoard } from '../app/work.js'

// Доска проектов: список досок и экран доски — колонки с карточками, перенос выбранной карточки кнопками,
// колонки, общий доступ с друзьями. Карточку открывает экран страницы блокнота. Названия досок, колонок и
// карточек, ники — человека, без перевода (keep)
export function boardsScreen($, e, kit) {
  const { Box, Button, Input, TILE_GAP, Text, desktop, dim, gap, hint, makeButton, noticeLines, open, section, tileWidth, tiles } = kit
  let items
  if (S.menu.startsWith('note:')) S.menu = `board:${S.menu.slice(5)}`
  const board = S.menu.startsWith('board:') ? S.notes.find((p) => p.id === S.menu.slice(6) && isBoard(p)) : null
  if (!board && S.menu !== 'boards') S.menu = 'boards'
  const share = board?.board.share ?? ''
  const base = share ? S.desks[share] : null
  if (S.dk.confirm && S.dk.confirm !== `delete-${board?.id}` && S.dk.confirm !== `off-${share}`) S.dk.confirm = ''
  const picked = S.dk.pick ? S.notes.find((p) => p.id === S.dk.pick && p.parent === board?.id) : null
  if (!picked) S.dk.pick = ''
  const leave = (target) => () => {
    S.dk.note = ''
    S.dk.bad = false
    S.dk.confirm = ''
    S.dk.pick = ''
    S.dk.focus = ''
    S.dk.picked.clear()
    nb.note = ''
    nb.bad = false
    nb.focus = ''
    open(target)()
  }
  const noteLine = S.dk.note ? [gap, S.dk.bad ? Text({ color: 'warning', children: [S.dk.note] }) : dim(S.dk.note)] : []
  const row = (children) => Box({ flexDirection: 'row', columnGap: 2, children })
  const wrapRow = (children) => Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  // В Desktop строки одной группы — с промежутком по высоте: поля и кнопки иначе слипаются
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', children: list })] : list)
  const strong = (text) => Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [text] } : { bold: true, children: [text] })
  const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
  const friends = S.fr.list?.friends ?? []
  const me = S.dk.me || S.ch.me
  const say = (text, bad = true) => {
    S.dk.note = text
    S.dk.bad = bad
    $.ui.invalidate('ui.render')
  }
  // Друзья галочками: кого позвать на доску
  const pickFriends = (list) =>
    wrapRow(
      list.map((p) =>
        keep(
          Button({
            key: `arcade-desk-pick-${p.id}`,
            label: `${S.dk.picked.has(p.id) ? '☑' : '☐'} @${p.handle}`,
            onPress: () => {
              if (S.dk.picked.has(p.id)) S.dk.picked.delete(p.id)
              else S.dk.picked.add(p.id)
              S.dk.note = ''
              S.dk.bad = false
              $.ui.invalidate('ui.render')
            },
          }),
        ),
      ),
    )
  if (!board) {
    const boards = notesOrder(S.notes).filter(isBoard)
    const focusId = (boards.find((b) => S.menuFrom === `board:${b.id}`) ?? boards[0])?.id
    // Плитка доски: название, под ним — сколько карточек и общая ли она
    const boardTile = (b) => {
      const s = b.board.share
      const owner = s ? (S.desks[s]?.owner ?? S.dk.list?.find((x) => x.id === s)?.owner ?? '') : ''
      const shared = !s ? '' : owner && owner !== me ? `${tr('общая, хозяин', S.lang)} ${deskPerson(owner, S.desks[s])}` : tr('общая', S.lang)
      const about = [`${tr('карточек', S.lang)}: ${S.notes.filter((p) => p.parent === b.id).length}`, shared].filter(Boolean).join(' · ')
      return [
        keep(
          Button({
            key: `arcade-desk-${b.id}`,
            label: b.title,
            ...(b.id === focusId ? { autoFocus: true } : {}),
            onPress: () => {
              leave(`board:${b.id}`)()
              if (s && S.desks[s]) syncBoard($, s, { names: true }).catch(modError)
              else if (s && S.acct.session) loadBoards($).catch(modError)
            },
          }),
        ),
        keep(dim(`  ${about}`)),
      ]
    }
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave('main') }),
      gap,
      dim('Доски с колонками: «Сделать», «В работе», «Готово» или свои. Карточка — страница блокнота с текстом и чек-листом.'),
      gap,
      Input({
        key: `arcade-board-new-${nb.field}`,
        label: 'Новая доска',
        placeholder: 'название: ремонт, релиз 1.0, переезд…',
        submitLabel: tr('Создать', S.lang),
        ...(boards.length ? {} : { autoFocus: true }),
        onSubmit: (value) => createBoard($, value),
      }),
      ...noteLine,
      section('Доски'),
      ...(boards.length ? [column(boards.flatMap(boardTile))] : [dim('Досок пока нет — впиши название новой выше.')]),
      gap,
      dim(
        S.acct.session
          ? S.dk.loading && !S.dk.list
            ? 'Спрашиваю сайт Arcade об общих досках…'
            : 'Общие доски друзей появляются здесь сами.'
          : 'Войди через GitHub — и сможешь вести доску вместе с друзьями.',
      ),
      dim('Claude тоже ведёт доски: попроси, например, «разложи задачи релиза по доске в Arcade».'),
      ...noticeLines,
      ...hint,
    ]
  } else {
    const id = board.id
    const field = `${nb.field}-${S.dk.field}`
    const isOwner = Boolean(base && me && base.owner === me)
    // Перенос выбранной карточки: фокус остаётся на нажатой кнопке — можно жать её снова
    const move = (where) => {
      S.dk.focus = `move-${where}`
      return editBoard($, (list, at) => moveCard(list, S.dk.pick, where, at))
    }
    const focusOn = (name) => (S.dk.focus === name ? { autoFocus: true } : {})
    // Карточка: первое нажатие выбирает её, второе — открывает
    const cardButton = (c) => {
      const mark = c.id === S.dk.pick
      const label = `${mark ? '▸ ' : ''}${c.title}`
      const props = {
        key: `arcade-card-${c.id}`,
        label,
        ...(S.dk.focus === `card-${c.id}` || (!S.dk.focus && S.menuFrom === `note:${c.id}`) ? { autoFocus: true } : {}),
        onPress: () => {
          if (mark) return leave(`note:${c.id}`)()
          S.dk.pick = c.id
          S.dk.focus = `card-${c.id}`
          S.dk.note = ''
          S.dk.bad = false
          $.ui.invalidate('ui.render')
        },
      }
      return keep(desktop ? makeButton({ ...props, children: [Text({ wrap: 'wrap', children: [label] })] }) : Button(props))
    }
    const columnBox = (c) => {
      const cards = columnCards(S.notes, board, c.id)
      const children = [
        keep(strong(`${colName(c)} · ${cards.length}`)),
        ...cards.flatMap((card) => {
          const { done, total } = checkStats(card.body)
          return [cardButton(card), ...(total ? [keep(dim(`  ☑ ${done}/${total}`))] : [])]
        }),
        ...(cards.length ? [] : [dim('пусто')]),
        // В Desktop колонка узкая: без подписи слева поле занимает всю её ширину, подсказка — в самом поле
        Input({
          key: `arcade-card-new-${c.id}-${nb.field}`,
          ...(desktop ? { placeholder: 'Новая карточка' } : { label: 'Новая карточка', placeholder: 'что сделать' }),
          submitLabel: tr('Добавить', S.lang),
          ...focusOn(`new-${c.id}`),
          onSubmit: (value) => createCard($, id, c.id, value),
        }),
      ]
      return desktop
        ? Box({ key: `col-${c.id}`, flexDirection: 'column', rowGap: 'xs', borderStyle: 'round', borderColor: 'subtle', padding: 'sm', width: tileWidth(28), children })
        : Box({ key: `col-${c.id}`, flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, children })
    }
    const cols = board.board.cols.map(columnBox)
    const shareLine = !share
      ? []
      : [keep(dim(isOwner ? tr('Общая доска — ты хозяин.', S.lang) : base?.owner ? `${tr('Общая доска, хозяин', S.lang)} ${deskPerson(base.owner, base)}.` : tr('Общая доска.', S.lang)))]
    const trouble = share && S.dk.trouble?.share === share ? [Text({ color: 'warning', children: [S.dk.trouble.text] })] : []
    const pickBar = picked
      ? [
          keep(dim(`${tr('Выбрана карточка', S.lang)}: ${picked.title}`)),
          wrapRow([
            Button({ key: 'arcade-board-left', label: '← Влево', ...focusOn('move-left'), onPress: () => move('left') }),
            Button({ key: 'arcade-board-up', label: '↑ Выше', ...focusOn('move-up'), onPress: () => move('up') }),
            Button({ key: 'arcade-board-down', label: '↓ Ниже', ...focusOn('move-down'), onPress: () => move('down') }),
            Button({ key: 'arcade-board-right', label: 'Вправо →', ...focusOn('move-right'), onPress: () => move('right') }),
            Button({ key: 'arcade-board-open', label: 'Открыть', onPress: leave(`note:${picked.id}`) }),
            Button({
              key: 'arcade-board-unpick',
              label: 'Снять выбор',
              onPress: () => {
                S.dk.focus = `card-${picked.id}`
                S.dk.pick = ''
                $.ui.invalidate('ui.render')
              },
            }),
          ]),
        ]
      : [dim('Нажми на карточку, чтобы выбрать её и переносить стрелками; ещё раз — открыть.')]
    // Общий доступ: войти, взять @ник, поделиться с друзьями; у общей — участники, позвать ещё, удалить или выйти.
    // Действия — плитками с описанием, как в настройках; друзья галочками — над плиткой «Поделиться» или «Позвать»
    let shareItems
    if (!S.acct.session)
      shareItems = [
        tiles(
          [
            Button({
              key: 'arcade-board-login',
              label: S.acct.starting ? 'Готовлю вход…' : 'Войти через GitHub',
              onPress: () => {
                S.acct.confirmDelete = false
                leave('account')()
                startLogin($)
              },
            }),
            dim('Войди через GitHub — и сможешь вести доску вместе с друзьями.'),
          ],
          40,
        ),
      ]
    else if (!share && !S.acct.handle)
      shareItems = [tiles([Button({ key: 'arcade-board-handle', label: 'Взять @ник', onPress: leave('account') }), dim('Звать друзей на доску можно, когда у тебя есть @ник.')], 40)]
    else if (!share && friends.length)
      shareItems = [
        dim('Отметь друзей и нажми «Поделиться» — доска станет общей: карточки, колонки и название у всех одни.'),
        pickFriends(friends),
        tiles(
          [
            Button({ key: 'arcade-board-share', label: S.dk.busy === 'share' ? 'Делюсь…' : 'Поделиться', onPress: () => shareBoard($, id) }),
            dim('  Отмеченные друзья увидят доску у себя и смогут её вести.'),
          ],
          40,
        ),
      ]
    else if (!share)
      shareItems = [
        tiles(
          [
            Button({
              key: 'arcade-board-friends',
              label: 'Друзья',
              onPress: () => {
                S.fr.note = ''
                S.fr.bad = false
                leave('friends')()
                friendsCall($, 'friends').catch(modError)
              },
            }),
            dim(S.fr.list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : S.fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.'),
          ],
          40,
        ),
      ]
    else if (!base || !me) shareItems = [dim('Сверяю доску с сайтом Arcade…')]
    else {
      const others = friends.filter((p) => !base.members.includes(p.id))
      const people = [base.owner, ...base.members.filter((m) => m !== base.owner)].filter(Boolean)
      const invite = isOwner && others.length && base.members.length < MAX_MEMBERS
      shareItems = [
        ...people.map((m) =>
          m === base.owner
            ? keep(Text({ children: [`${deskPerson(m, base)} · ${tr('хозяин доски', S.lang)}`] }))
            : isOwner
              ? row([keep(Text({ children: [deskPerson(m, base)] })), Button({ key: `arcade-desk-drop-${m}`, label: 'Убрать', onPress: () => boardMembers($, share, { remove: [m] }, 'Участник убран.') })])
              : keep(Text({ children: [deskPerson(m, base)] })),
        ),
        ...(invite ? [gap, dim('Позвать ещё:'), pickFriends(others)] : []),
        gap,
        tiles(
          [
            ...(invite
              ? [
                  Button({
                    key: 'arcade-board-invite',
                    label: S.dk.busy === 'add' ? 'Зову…' : 'Позвать',
                    onPress: () => (S.dk.picked.size ? boardMembers($, share, { add: [...S.dk.picked] }, 'Друзья позваны.') : say('Отметь хотя бы одного друга.')),
                  }),
                  dim('  Отмеченные друзья увидят доску у себя и смогут её вести.'),
                ]
              : []),
            Button({
              key: 'arcade-board-off',
              label:
                S.dk.confirm === `off-${share}`
                  ? isOwner
                    ? 'Нажми ещё раз — удалить с сайта'
                    : 'Нажми ещё раз — выйти с доски'
                  : isOwner
                    ? 'Удалить с сайта'
                    : 'Выйти с доски',
              onPress: () => unshareBoard($, share),
            }),
            dim(isOwner ? '  У тебя и у друзей доска останется — каждому своя копия.' : '  У тебя останется своя копия доски, у друзей — общая.'),
          ],
          40,
        ),
      ]
    }
    // Удалить доску можно, пока она не общая: общую сначала удаляют с сайта или выходят с неё. Плитка — рядом
    // с «Отдать Claude»
    const deleteItems =
      share && S.acct.session
        ? []
        : [
            Button({
              key: 'arcade-board-delete',
              label: S.dk.confirm === `delete-${id}` ? 'Нажми ещё раз — удалить навсегда' : 'Удалить доску',
              onPress: async () => {
                if (S.dk.confirm !== `delete-${id}`) {
                  S.dk.confirm = `delete-${id}`
                  return $.ui.invalidate('ui.render')
                }
                S.dk.confirm = ''
                if (S.notes.some((p) => p.id === nb.draft?.id && p.parent === id)) nb.draft = null
                if (!(await editBoard($, (list) => removePage(list, id), 'Доска удалена.'))) return
                if (share) await forgetDesk($, share)
                S.dk.pick = ''
                S.dk.focus = ''
                S.menuFrom = null
                S.menu = 'boards'
                $.ui.invalidate('ui.render')
              },
            }),
            dim('  Доска удалится вместе с колонками и карточками.'),
          ]
    items = [
      Button({
        key: 'arcade-back',
        label: '← Доски',
        onPress: () => {
          leave('boards')()
          if (S.acct.session) loadBoards($, true).catch(modError)
        },
      }),
      keep(section(board.title)),
      ...shareLine,
      ...trouble,
      ...pickBar,
      desktop ? Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: TILE_GAP, rowGap: 'md', children: cols }) : Box({ flexDirection: 'column', children: cols }),
      ...noteLine,
      section('Доска'),
      Input({
        key: `arcade-board-title-${field}`,
        label: 'Название',
        value: board.title,
        submitLabel: tr('Сохранить', S.lang),
        onSubmit: (value) => {
          const title = cleanTitle(value)
          if (!title) return say('Впиши название доски.')
          return editBoard($, (list, at) => (title === board.title ? list : updatePage(list, id, { title }, at)), 'Сохранено.')
        },
      }),
      gap,
      tiles(
        [
          Button({ key: 'arcade-board-send', label: 'Отдать Claude', onPress: () => sendBoard($, id) }),
          dim('  Claude получит доску с карточками и сможет добавлять, править и переносить их.'),
          ...deleteItems,
        ],
        40,
      ),
      section('Колонки'),
      // В Desktop у полей колонок нет подписи слева (название и так в поле): подписи разной длины сдвигали поля
      // и кнопки вразнобой. «Убрать колонку» — в той же строке, что и поле
      ...stack('board-cols', [
        ...board.board.cols.flatMap((c) => {
          const name = keep(
            Input({
              key: `arcade-col-name-${c.id}-${field}`,
              ...(desktop ? {} : { label: colName(c) }),
              value: colName(c),
              submitLabel: tr('Сохранить', S.lang),
              onSubmit: (value) => {
                if (cleanTitle(value) === colName(c)) return
                return editBoard(
                  $,
                  (list, at) => {
                    const done = renameColumn(list, id, c.id, value, at)
                    return done.error ? 'Впиши название колонки.' : done.notes
                  },
                  'Сохранено.',
                )
              },
            }),
          )
          const drop =
            board.board.cols.length > 1
              ? [
                  Button({
                    key: `arcade-col-drop-${c.id}`,
                    label: 'Убрать колонку',
                    onPress: () =>
                      editBoard(
                        $,
                        (list, at) => {
                          const done = removeColumn(list, id, c.id, at)
                          if (done.error === 'busy') return 'В колонке есть карточки — сначала перенеси их.'
                          if (done.error === 'last') return 'Последнюю колонку не убрать.'
                          return done.error ? list : done.notes
                        },
                        'Колонка убрана.',
                      ),
                  }),
                ]
              : []
          return desktop ? [Box({ key: `col-row-${c.id}`, flexDirection: 'row', alignItems: 'center', columnGap: 'sm', children: [name, ...drop] })] : [name, ...drop]
        }),
        Input({
          key: `arcade-col-new-${field}`,
          ...(desktop ? { placeholder: 'Новая колонка' } : { label: 'Новая колонка', placeholder: 'название: проверка, на паузе…' }),
          submitLabel: tr('Добавить', S.lang),
          ...focusOn('col-new'),
          onSubmit: (value) => {
            S.dk.focus = 'col-new'
            return editBoard($, (list, at) => {
              const done = addColumn(list, id, value, colId(), at)
              return done.error === 'many' ? 'Колонок — не больше 8.' : done.error ? 'Впиши название колонки.' : done.notes
            })
          },
        }),
      ]),
      section('Общий доступ'),
      ...stack('board-share', shareItems),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}
