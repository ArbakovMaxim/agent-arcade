// Arcade: экран «Промпты» — шаблоны промптов в один клик.
import { keep, tr } from '../i18n.js'
import { PROMPTS_COL, cleanTitle, columnCards, isPrompts, moveCard, notesOrder, removePage, updatePage } from '../notes.js'
import { MAX_MEMBERS } from '../desks.js'
import { S, nb, pr } from '../app/state.js'
import { clip } from '../app/status.js'
import { startLogin } from '../app/profile.js'
import { friendsCall } from '../app/talk.js'
import { addPrompt, boardMembers, createPromptSet, deskPerson, editPrompts, forgetDesk, loadBoards, modError, promptNote, promptToField, sendPrompt, shareBoard, syncBoard, unshareBoard } from '../app/work.js'

// «Промпты»: наборы шаблонов (доски с одной колонкой, notes.isPrompts), под каждым — его шаблоны кнопками: нажать —
// шаблон уходит Claude, как «Отдать Claude», «В поле ввода» — вставить без отправки, ✎ — открыть шаблон на правку.
// Настройки набора — название, общий доступ с друзьями (как у общей доски) и удаление. Названия и текст шаблонов,
// названия наборов и ники — человека, без перевода (keep)
export function promptsScreen($, e, kit) {
  const { Box, Button, Input, Text, desktop, dim, gap, hint, noticeLines, open, section, tiles } = kit
  // Набор или шаблон открыли страницей блокнота (board:… или note:…) — экран забирает их к себе
  if (S.menu !== 'prompts') {
    const id = S.menu.startsWith('board:') ? S.menu.slice(6) : S.menu.slice(5)
    const page = S.notes.find((p) => p.id === id)
    if (isPrompts(page)) pr.set = id
    else if (page) pr.edit = id
    S.menu = 'prompts'
  }
  const editing = pr.edit ? S.notes.find((p) => p.id === pr.edit) : null
  const parentSet = editing ? S.notes.find((p) => p.id === editing.parent) : null
  if (!editing || !isPrompts(parentSet)) pr.edit = ''
  const setPage = !pr.edit && pr.set ? S.notes.find((p) => p.id === pr.set && isPrompts(p)) : null
  if (!setPage) pr.set = ''
  const share = (pr.edit ? parentSet : setPage)?.board.share ?? ''
  if (pr.confirm && pr.confirm !== `card:${pr.edit}` && pr.confirm !== `set:${pr.set}`) pr.confirm = ''
  if (S.dk.confirm && S.dk.confirm !== `off-${share}`) S.dk.confirm = ''
  const me = S.dk.me || S.ch.me
  const friends = S.fr.list?.friends ?? []
  const refresh = () => $.ui.invalidate('ui.render')
  const focusOn = (name) => (pr.focus === name ? { autoFocus: true } : {})
  const say = (text, bad = true) => {
    pr.note = text
    pr.bad = bad
    refresh()
  }
  // Уйти с экрана: набранное в поле «Текст» шаблона — сначала в шаблон; не поместилось — остаёмся
  const leave = (target) => async () => {
    if (pr.edit && nb.draft?.id === pr.edit && !(await editPrompts($, (list) => list))) return
    if (nb.draft?.id === pr.edit) nb.draft = null
    pr.note = ''
    pr.bad = false
    pr.confirm = ''
    pr.edit = ''
    pr.set = ''
    pr.focus = ''
    S.dk.note = ''
    S.dk.bad = false
    S.dk.confirm = ''
    S.dk.picked.clear()
    open(target)()
  }
  // К списку наборов — из шаблона или настроек набора; focus — кнопка, на которой окажется фокус
  const toList = (focus) => {
    pr.edit = ''
    pr.set = ''
    pr.confirm = ''
    pr.focus = focus
    pr.field++
    S.dk.confirm = ''
    S.dk.picked.clear()
    refresh()
  }
  const noteText = (text, bad) => (bad ? Text({ color: 'warning', children: [text] }) : dim(text))
  const noteLine = [
    ...(pr.note ? [noteText(pr.note, pr.bad)] : []),
    ...(S.dk.note ? [noteText(promptNote(S.dk.note), S.dk.bad)] : []),
    ...(share && S.dk.trouble?.share === share ? [Text({ color: 'warning', children: [promptNote(S.dk.trouble.text)] })] : []),
  ]
  const notes = noteLine.length ? [gap, ...noteLine] : []
  const row = (key, children) => Box({ key, flexDirection: 'row', flexWrap: 'wrap', columnGap: 2, rowGap: desktop ? 'sm' : 0, children })
  // В Desktop строки одной группы — с промежутком по высоте: поля и кнопки иначе слипаются
  const stack = (key, list) => (desktop ? [Box({ key, flexDirection: 'column', rowGap: 'sm', children: list })] : list)
  // Общий ли набор и чей: строка под названием
  const shareAbout = (set) => {
    const s = set.board.share
    if (!s) return ''
    const owner = S.desks[s]?.owner ?? S.dk.list?.find((x) => x.id === s)?.owner ?? ''
    return owner && owner !== me ? `${tr('общий, хозяин', S.lang)} ${deskPerson(owner, S.desks[s])}` : tr('общий', S.lang)
  }
  // Первая строка текста шаблона — под его кнопкой
  const preview = (card) => {
    const first = card.body.split('\n').map((l) => l.trim()).find(Boolean) ?? ''
    return first ? keep(dim(`  ${clip(first, 90)}`)) : dim('  текста пока нет')
  }
  let items
  if (pr.edit) {
    const card = editing
    const id = card.id
    const typed = (value) => ({ id, text: String(value ?? ''), from: nb.draft?.id === id ? nb.draft.from : card.body })
    const move = (where) => {
      pr.focus = where
      return editPrompts($, (list, at) => moveCard(list, id, where, at))
    }
    items = [
      Button({
        key: 'arcade-back',
        label: '← Промпты',
        onPress: async () => {
          if (nb.draft?.id === id && !(await editPrompts($, (list) => list))) return
          if (nb.draft?.id === id) nb.draft = null
          toList(`send-${id}`)
        },
      }),
      keep(section(card.title)),
      keep(dim(`${tr('Набор', S.lang)}: ${parentSet.title}${share ? ` · ${shareAbout(parentSet)}` : ''}`)),
      ...notes,
      gap,
      ...stack('prompt-edit', [
        Input({
          key: `arcade-prompt-title-${pr.field}`,
          label: 'Название',
          value: card.title,
          submitLabel: tr('Сохранить', S.lang),
          onSubmit: (value) => {
            const title = cleanTitle(value)
            if (!title) return say('Впиши название шаблона.')
            return editPrompts($, (list, at) => (title === card.title ? list : updatePage(list, id, { title }, at)), 'Сохранено.')
          },
        }),
        // Набранное — в черновик, без перерисовки, как в поле «Текст» страницы блокнота: при записи правка из другой
        // сессии или от друзей сольётся с набранным
        Input({
          key: `arcade-prompt-text-${pr.field}`,
          label: 'Текст',
          rows: 12,
          value: card.body,
          placeholder: 'что написать Claude: «Сделай ревью изменений: ошибки, тесты, имена»',
          submitLabel: tr('Сохранить', S.lang),
          ...focusOn('text'),
          onInput: (value) => {
            nb.draft = typed(value)
          },
          onSubmit: (value) => {
            nb.draft = typed(value)
            pr.focus = 'text'
            return editPrompts($, (list) => list, 'Сохранено.')
          },
        }),
      ]),
      dim('Enter — сохранить; новая строка — как в поле ввода Claude.'),
      gap,
      tiles(
        [
          Button({
            key: 'arcade-prompt-send',
            label: 'Отправить Claude',
            ...focusOn('send'),
            onPress: () => {
              pr.focus = 'send'
              return sendPrompt($, id)
            },
          }),
          dim('  Сразу, если Claude свободен; занят — шаблон ждёт в поле ввода.'),
          Button({
            key: 'arcade-prompt-field',
            label: 'В поле ввода',
            ...focusOn('field'),
            onPress: () => {
              pr.focus = 'field'
              return promptToField($, id)
            },
          }),
          dim('  Вставит шаблон к набранному в поле ввода, без отправки.'),
        ],
        40,
      ),
      row('prompt-move', [
        Button({ key: 'arcade-prompt-up', label: '↑ Выше', ...focusOn('up'), onPress: () => move('up') }),
        Button({ key: 'arcade-prompt-down', label: '↓ Ниже', ...focusOn('down'), onPress: () => move('down') }),
      ]),
      gap,
      tiles(
        [
          Button({
            key: 'arcade-prompt-delete',
            label: pr.confirm === `card:${id}` ? 'Нажми ещё раз — удалить шаблон' : 'Удалить шаблон',
            onPress: async () => {
              if (pr.confirm !== `card:${id}`) {
                pr.confirm = `card:${id}`
                return refresh()
              }
              pr.confirm = ''
              if (nb.draft?.id === id) nb.draft = null
              if (!(await editPrompts($, (list) => removePage(list, id), 'Шаблон удалён.'))) return
              toList(`new-${parentSet.id}`)
            },
          }),
          dim(share ? '  Шаблон удалится у всех в наборе.' : '  Шаблон удалится насовсем.'),
        ],
        40,
      ),
      ...noticeLines,
      ...hint,
    ]
  } else if (pr.set) {
    const set = setPage
    const id = set.id
    const base = share ? S.desks[share] : null
    const isOwner = Boolean(base && me && base.owner === me)
    const pickFriends = (list) =>
      row(
        'prompt-pick',
        list.map((p) =>
          keep(
            Button({
              key: `arcade-prompt-pick-${p.id}`,
              label: `${S.dk.picked.has(p.id) ? '☑' : '☐'} @${p.handle}`,
              onPress: () => {
                if (S.dk.picked.has(p.id)) S.dk.picked.delete(p.id)
                else S.dk.picked.add(p.id)
                S.dk.note = ''
                S.dk.bad = false
                refresh()
              },
            }),
          ),
        ),
      )
    // Общий доступ — как у общей доски: войти, взять @ник, поделиться с друзьями; у общего — участники, позвать ещё,
    // удалить с сайта или выйти
    let shareItems
    if (!S.acct.session)
      shareItems = [
        tiles(
          [
            Button({
              key: 'arcade-prompt-login',
              label: S.acct.starting ? 'Готовлю вход…' : 'Войти через GitHub',
              onPress: async () => {
                S.acct.confirmDelete = false
                await leave('account')()
                startLogin($)
              },
            }),
            dim('Войди через GitHub — и сможешь вести набор вместе с друзьями.'),
          ],
          40,
        ),
      ]
    else if (!share && !S.acct.handle) shareItems = [tiles([Button({ key: 'arcade-prompt-handle', label: 'Взять @ник', onPress: leave('account') }), dim('Звать друзей в набор можно, когда у тебя есть @ник.')], 40)]
    else if (!share && friends.length)
      shareItems = [
        dim('Отметь друзей и нажми «Поделиться» — набор станет общим: шаблоны и название у всех одни.'),
        pickFriends(friends),
        tiles([Button({ key: 'arcade-prompt-share', label: S.dk.busy === 'share' ? 'Делюсь…' : 'Поделиться', onPress: () => shareBoard($, id) }), dim('  Отмеченные друзья увидят набор у себя и смогут его вести.')], 40),
      ]
    else if (!share)
      shareItems = [
        tiles(
          [
            Button({
              key: 'arcade-prompt-friends',
              label: 'Друзья',
              onPress: async () => {
                S.fr.note = ''
                S.fr.bad = false
                await leave('friends')()
                friendsCall($, 'friends').catch(modError)
              },
            }),
            dim(S.fr.list ? 'Друзей пока нет — добавь кого-нибудь по @нику.' : S.fr.loading ? 'Загружаю друзей…' : 'Список друзей не загрузился.'),
          ],
          40,
        ),
      ]
    else if (!base || !me) shareItems = [dim('Сверяю набор с сайтом Arcade…')]
    else {
      const others = friends.filter((p) => !base.members.includes(p.id))
      const people = [base.owner, ...base.members.filter((m) => m !== base.owner)].filter(Boolean)
      const invite = isOwner && others.length && base.members.length < MAX_MEMBERS
      shareItems = [
        ...people.map((m) =>
          m === base.owner
            ? keep(Text({ children: [`${deskPerson(m, base)} · ${tr('хозяин набора', S.lang)}`] }))
            : isOwner
              ? row(`prompt-member-${m}`, [keep(Text({ children: [deskPerson(m, base)] })), Button({ key: `arcade-prompt-drop-${m}`, label: 'Убрать', onPress: () => boardMembers($, share, { remove: [m] }, 'Участник убран.') })])
              : keep(Text({ children: [deskPerson(m, base)] })),
        ),
        ...(invite ? [gap, dim('Позвать ещё:'), pickFriends(others)] : []),
        gap,
        tiles(
          [
            ...(invite
              ? [
                  Button({
                    key: 'arcade-prompt-invite',
                    label: S.dk.busy === 'add' ? 'Зову…' : 'Позвать',
                    onPress: () => {
                      if (S.dk.picked.size) return boardMembers($, share, { add: [...S.dk.picked] }, 'Друзья позваны.')
                      S.dk.note = 'Отметь хотя бы одного друга.'
                      S.dk.bad = true
                      refresh()
                    },
                  }),
                  dim('  Отмеченные друзья увидят набор у себя и смогут его вести.'),
                ]
              : []),
            Button({
              key: 'arcade-prompt-off',
              label:
                S.dk.confirm === `off-${share}`
                  ? isOwner
                    ? 'Нажми ещё раз — удалить с сайта'
                    : 'Нажми ещё раз — выйти из набора'
                  : isOwner
                    ? 'Удалить с сайта'
                    : 'Выйти из набора',
              onPress: () => unshareBoard($, share),
            }),
            dim(isOwner ? '  У тебя и у друзей набор останется — каждому своя копия.' : '  У тебя останется своя копия набора, у друзей — общий.'),
          ],
          40,
        ),
      ]
    }
    const shareLine = !share
      ? []
      : [keep(dim(isOwner ? tr('Общий набор — ты хозяин.', S.lang) : base?.owner ? `${tr('Общий набор, хозяин', S.lang)} ${deskPerson(base.owner, base)}.` : tr('Общий набор.', S.lang)))]
    // Удалить набор можно, пока он не общий: общий сначала удаляют с сайта или выходят из него
    const deleteItems =
      share && S.acct.session
        ? []
        : [
            gap,
            tiles(
              [
                Button({
                  key: 'arcade-prompt-set-delete',
                  label: pr.confirm === `set:${id}` ? 'Нажми ещё раз — удалить навсегда' : 'Удалить набор',
                  onPress: async () => {
                    if (pr.confirm !== `set:${id}`) {
                      pr.confirm = `set:${id}`
                      return refresh()
                    }
                    pr.confirm = ''
                    if (S.notes.some((p) => p.id === nb.draft?.id && p.parent === id)) nb.draft = null
                    if (!(await editPrompts($, (list) => removePage(list, id), 'Набор удалён.'))) return
                    if (share) await forgetDesk($, share)
                    toList('')
                  },
                }),
                dim('  Набор удалится вместе с шаблонами.'),
              ],
              40,
            ),
          ]
    items = [
      Button({ key: 'arcade-back', label: '← Промпты', onPress: () => toList(`set-${id}`) }),
      keep(section(set.title)),
      ...shareLine,
      ...notes,
      gap,
      Input({
        key: `arcade-prompt-set-title-${pr.field}`,
        label: 'Название',
        value: set.title,
        submitLabel: tr('Сохранить', S.lang),
        onSubmit: (value) => {
          const title = cleanTitle(value)
          if (!title) return say('Впиши название набора.')
          return editPrompts($, (list, at) => (title === set.title ? list : updatePage(list, id, { title }, at)), 'Сохранено.')
        },
      }),
      section('Общий доступ'),
      ...stack('prompt-share', shareItems),
      ...deleteItems,
      ...noticeLines,
      ...hint,
    ]
  } else {
    const sets = notesOrder(S.notes).filter(isPrompts)
    // Шаблон: название кнопкой — уходит Claude; рядом «В поле ввода» и ✎, ниже — первая строка текста
    const template = (card) =>
      Box({
        key: `prompt-${card.id}`,
        flexDirection: 'column',
        children: [
          row(`prompt-row-${card.id}`, [
            keep(
              Button({
                key: `arcade-prompt-${card.id}`,
                label: card.title,
                ...focusOn(`send-${card.id}`),
                onPress: () => {
                  pr.focus = `send-${card.id}`
                  return sendPrompt($, card.id)
                },
              }),
            ),
            Button({
              key: `arcade-prompt-field-${card.id}`,
              label: 'В поле ввода',
              plain: true,
              ...focusOn(`field-${card.id}`),
              onPress: () => {
                pr.focus = `field-${card.id}`
                return promptToField($, card.id)
              },
            }),
            Button({
              key: `arcade-prompt-edit-${card.id}`,
              label: '✎',
              plain: true,
              onPress: () => {
                pr.edit = card.id
                pr.confirm = ''
                pr.focus = 'text'
                pr.note = ''
                pr.bad = false
                pr.field++
                refresh()
              },
            }),
          ]),
          preview(card),
        ],
      })
    const newTemplate = (set, first) =>
      Input({
        key: `arcade-prompt-new-${set?.id ?? 'first'}-${pr.field}`,
        label: 'Новый шаблон',
        placeholder: 'название: ревью PR, тесты, коммит…',
        submitLabel: tr('Добавить', S.lang),
        ...(first || pr.focus === `new-${set?.id}` ? { autoFocus: true } : {}),
        onSubmit: (value) => (set ? addPrompt($, set.id, value) : createPromptSet($, tr('Мои промпты', S.lang), value)),
      })
    const setItems = (set) => {
      const cards = columnCards(S.notes, set, PROMPTS_COL)
      const about = [`${tr('шаблонов', S.lang)}: ${cards.length}`, shareAbout(set)].filter(Boolean).join(' · ')
      return [
        keep(section(set.title)),
        keep(dim(about)),
        ...stack(`prompt-set-${set.id}`, [
          ...cards.map(template),
          newTemplate(set, false),
          Button({
            key: `arcade-prompt-set-${set.id}`,
            label: 'Настройки набора',
            ...focusOn(`set-${set.id}`),
            onPress: () => {
              pr.set = set.id
              pr.confirm = ''
              pr.note = ''
              pr.bad = false
              pr.focus = ''
              S.dk.note = ''
              S.dk.bad = false
              pr.field++
              refresh()
              const s = set.board.share
              if (s && S.desks[s]) syncBoard($, s, { names: true }).catch(modError)
              else if (s && S.acct.session) loadBoards($).catch(modError)
            },
          }),
        ]),
      ]
    }
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave('main') }),
      gap,
      dim('Нажми на шаблон — и он уйдёт Claude, как «Отдать Claude». Claude занят — шаблон ждёт в поле ввода.'),
      ...notes,
      ...(sets.length ? sets.flatMap(setItems) : [gap, dim('Шаблонов пока нет — впиши название первого.'), newTemplate(null, true)]),
      gap,
      Input({
        key: `arcade-prompt-set-new-${pr.field}`,
        label: 'Новый набор',
        placeholder: 'название: ревью, релиз, для команды…',
        submitLabel: tr('Создать', S.lang),
        onSubmit: (value) => createPromptSet($, value),
      }),
      gap,
      dim('Шаблоны — кнопки этой панели, не команды Claude Code: слэш-команды и скиллы работают как раньше.'),
      dim('Claude тоже сохраняет шаблоны: скажи, например, «сохрани это как промпт в Arcade».'),
      dim(S.acct.session ? 'Общие наборы друзей появляются здесь сами.' : 'Войди через GitHub — и сможешь вести набор вместе с друзьями.'),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}
