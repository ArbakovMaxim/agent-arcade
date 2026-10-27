// Arcade: экран блокнота.
import { openUrlCommand } from '../browsers.js'
import { keep, tr } from '../i18n.js'
import { MAX_APP, MAX_URL, appendText, checkStats, cleanTitle, columnOf, isBoard, moveCard, noteLines, notesOrder, removePage, toggleLine, updatePage } from '../notes.js'
import { NOTE_LINES, S, nb } from '../app/state.js'
import { clip } from '../app/status.js'
import { CONNECTOR_HINT, NOTE_TOO_LONG, VOICE_HINT, boardsOpened, colName, connectorPrompt, copyPage, createPage, editNotes, giveClaude, openLink, sendNote } from '../app/work.js'

// Блокнот: список страниц с подстраницами и экран страницы — строки текста, отметки чек-листа, «Редактировать» (поле
// «Текст»), «Копировать», поля «Новый пункт» и «Название», «Отдать Claude», «Удалить». Названия и текст страниц — человека,
// без перевода (keep)
export function notesScreen($, e, kit) {
  const { Box, Button, Input, Markdown, Text, desktop, dim, gap, hint, noticeLines, open, section, tiles } = kit
  let items
  const page = S.menu.startsWith('note:') ? S.notes.find((p) => p.id === S.menu.slice(5)) : null
  if (!page && S.menu !== 'notes') S.menu = 'notes'
  if (nb.confirm && nb.confirm !== page?.id) nb.confirm = null
  // Уйти с экрана: набранное в поле «Текст» — сначала в страницу; не поместилось — остаёмся, заметка скажет почему
  const leave = (target) => async () => {
    if (!(await editNotes($, (list) => list))) return
    nb.note = ''
    nb.bad = false
    nb.confirm = null
    nb.focus = ''
    nb.editing = ''
    open(target)()
  }
  const noteLine = nb.note ? [gap, nb.bad ? Text({ color: 'warning', children: [nb.note] }) : dim(nb.note)] : []
  const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
  // Плитка страницы: название, под ним — сколько пунктов отмечено и первая строка текста
  const pageTile = (p, focus, sub = false) => {
    const { done, total } = checkStats(p.body)
    const first = noteLines(p.body).find((l) => l.kind !== 'blank')?.text.trim() ?? ''
    const about = [total ? `☑ ${done}/${total}` : '', p.link ? `↗ ${p.link.app}` : '', clip(first, 90)].filter(Boolean).join(' · ')
    return [
      keep(Button({ key: `arcade-note-page-${p.id}`, label: sub ? `↳ ${p.title}` : p.title, ...(focus ? { autoFocus: true } : {}), onPress: leave(`note:${p.id}`) })),
      about ? keep(dim(`  ${about}`)) : dim('  пустая страница'),
    ]
  }
  if (!page) {
    // Доски и их карточки — в «Доске проектов»
    const order = notesOrder(S.notes).filter((p) => !isBoard(p) && !isBoard(S.notes.find((b) => b.id === p.parent)))
    const focusId = (order.find((p) => S.menuFrom === `note:${p.id}`) ?? order[0])?.id
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: leave('main') }),
      gap,
      dim('Страницы и подстраницы: заголовки «# », пункты «- », чек-листы «- [ ] ». Хранятся на этом компьютере.'),
      gap,
      Input({
        key: `arcade-note-new-${nb.field}`,
        label: 'Новая страница',
        placeholder: 'название: план на неделю, идеи, покупки…',
        submitLabel: tr('Создать', S.lang),
        ...(order.length ? {} : { autoFocus: true }),
        onSubmit: (value) => createPage($, value),
      }),
      ...noteLine,
      section('Страницы'),
      ...(order.length ? [column(order.flatMap((p) => pageTile(p, p.id === focusId, Boolean(p.parent))))] : [dim('Страниц пока нет — впиши название новой выше.')]),
      gap,
      Button({
        key: 'arcade-note-boards',
        label: 'Доска проектов',
        onPress: async () => {
          await leave('boards')()
          boardsOpened($)
        },
      }),
      dim('  доски с колонками и карточками; общие — с друзьями'),
      gap,
      Input({
        key: `arcade-note-import-${nb.field}`,
        label: 'Забрать из Notion или другого приложения',
        placeholder: 'ссылка или название страницы',
        submitLabel: tr('Забрать', S.lang),
        onSubmit: (value) => {
          const what = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_URL)
          if (what) return giveClaude($, connectorPrompt('import', { what }), 'ask')
        },
      }),
      dim(CONNECTOR_HINT),
      gap,
      dim('Claude тоже ведёт блокнот: попроси, например, «запиши план в мой блокнот Arcade».'),
      ...noticeLines,
      ...hint,
    ]
  } else {
    const id = page.id
    const parent = page.parent ? S.notes.find((p) => p.id === page.parent) : null
    const children = S.notes.filter((p) => p.parent === id)
    const lines = noteLines(page.body)
    // Правка текста страницы: change(body) → новый текст, null — не помещается
    const editBody = (change, saved = '') =>
      editNotes(
        $,
        (list, at) => {
          const now = list.find((p) => p.id === id)
          if (!now) return list
          const body = change(now.body)
          return body === null ? NOTE_TOO_LONG : body === now.body ? list : updatePage(list, id, { body }, at)
        },
        saved,
      )
    // Отметка пункта: строку ищем заново — текст мог поменяться из поля «Текст» или у Claude
    const toggle = (l) => {
      nb.focus = `line-${l.index}`
      return editBody((body) => {
        const now = noteLines(body)
        const same = now[l.index]?.kind === 'check' && now[l.index].text === l.text ? now[l.index] : now.find((x) => x.kind === 'check' && x.text === l.text)
        if (!same) return body
        nb.focus = `line-${same.index}` // фокус — за пунктом, на какой строке он теперь
        return toggleLine(body, same.index, !same.done)
      })
    }
    const lineItem = (l) => {
      if (l.kind === 'check')
        return keep(
          Button({
            key: `arcade-note-line-${l.index}`,
            label: `${l.done ? '☑' : '☐'} ${l.text}`,
            plain: true,
            ...(l.done ? { dimColor: true } : {}),
            ...(nb.focus === `line-${l.index}` ? { autoFocus: true } : {}),
            onPress: () => toggle(l),
          }),
        )
      if (l.kind === 'h1') return keep(Text(desktop ? { size: 'heading', weight: 'semibold', wrap: 'wrap', children: [l.text] } : { bold: true, wrap: 'wrap', children: [l.text] }))
      if (l.kind === 'h2') return keep(Text(desktop ? { weight: 'semibold', wrap: 'wrap', children: [l.text] } : { bold: true, wrap: 'wrap', children: [l.text] }))
      if (l.kind === 'bullet') return keep(Text({ wrap: 'wrap', children: [`• ${l.text}`] }))
      if (l.kind === 'text') return keep(Text({ wrap: 'wrap', children: [l.text] }))
      return gap
    }
    // Desktop и VS Code: строки между пунктами чек-листа — одним Markdown, как ответ Claude: заголовки, списки, абзацы
    const textBlock = (run) => {
      const md = []
      run.forEach((l, i) => {
        const next = run[i + 1]?.kind
        if (l.kind === 'blank') md.push('')
        else if (l.kind === 'h1' || l.kind === 'h2') md.push(`${l.kind === 'h1' ? '#' : '##'} ${l.text}`)
        // После пункта списка — пустая строка, иначе следующий текст приклеится к пункту
        else if (l.kind === 'bullet') md.push(`- ${l.text}`, ...(next === 'text' ? [''] : []))
        // Строка за строкой — с переносом, а не одним абзацем
        else md.push(`${l.text.trim()}${next === 'text' ? '  ' : ''}`)
      })
      const text = md.join('\n').trim()
      if (!text) return [gap]
      return [...(run[0].kind === 'blank' ? [gap] : []), keep(Markdown({ text })), ...(run.at(-1).kind === 'blank' ? [gap] : [])]
    }
    const pageItems = (list) => {
      if (!Markdown) return list.map(lineItem)
      const out = []
      let run = []
      for (const l of [...list, null]) {
        if (l && l.kind !== 'check') {
          run.push(l)
          continue
        }
        if (run.length) out.push(...textBlock(run))
        run = []
        if (l) out.push(lineItem(l))
      }
      return out
    }
    // Просьба про другое приложение: набранное в поле «Текст» — сначала в страницу, Claude получит свежий текст
    const askApp = async (kind, app = page.link?.app ?? '') => {
      if (!(await editNotes($, (list) => list))) return
      const now = S.notes.find((p) => p.id === id)
      if (now) await giveClaude($, connectorPrompt(kind, { page: now, app }), 'ask')
    }
    // Голос: надиктованное (или набранное) в поле ввода Claude — в конец страницы, поле ввода — пустое
    const takePrompt = async () => {
      const { text } = await $.prompt.read().catch(() => ({ text: '' }))
      nb.focus = 'take'
      if (!String(text ?? '').trim()) {
        nb.note = 'Поле ввода Claude пустое — надиктуй или впиши туда текст и нажми ещё раз.'
        nb.bad = true
        $.ui.invalidate('ui.render')
        return
      }
      if (!(await editBody((body) => appendText(body, text), 'Текст из поля ввода Claude — в конце страницы.'))) return
      await $.prompt.fill({ text: '', mode: 'replace' }).catch(() => {})
    }
    const hasText = lines.some((l) => l.kind !== 'blank')
    // Карточка доски проектов: в какой она колонке и кнопки переноса — как на экране доски
    const cardPlace = isBoard(parent)
      ? [
          keep(dim(`${tr('Колонка', S.lang)}: ${colName(parent.board.cols.find((c) => c.id === columnOf(page, parent.board.cols)) ?? parent.board.cols[0])}`)),
          Box({
            flexDirection: 'row',
            flexWrap: 'wrap',
            columnGap: 2,
            children: [
              ['left', '← Влево'],
              ['up', '↑ Выше'],
              ['down', '↓ Ниже'],
              ['right', 'Вправо →'],
            ].map(([where, label]) =>
              Button({
                key: `arcade-note-move-${where}`,
                label,
                ...(nb.focus === `move-${where}` ? { autoFocus: true } : {}),
                onPress: () => {
                  nb.focus = `move-${where}`
                  return editNotes($, (list, at) => moveCard(list, id, where, at))
                },
              }),
            ),
          }),
        ]
      : []
    // Панель Desktop не даёт выделить текст вне полей ввода: без правки текст виден и копируется кнопкой, поле «Текст» —
    // по «Редактировать», Enter в нём сохраняет и закрывает правку
    const editing = nb.editing === id
    const viewItems = [
      ...(hasText ? pageItems(lines.slice(0, NOTE_LINES)) : [dim('Страница пустая — нажми «Редактировать» или впиши пункт ниже.')]),
      ...(lines.length > NOTE_LINES ? [dim('Дальше — по «Редактировать».')] : []),
      gap,
      Box({
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 2,
        children: [
          Button({
            key: 'arcade-note-edit',
            label: 'Редактировать',
            ...(nb.focus === 'edit' ? { autoFocus: true } : {}),
            onPress: () => {
              nb.editing = id
              nb.focus = 'text'
              $.ui.invalidate('ui.render')
            },
          }),
          ...(hasText
            ? [
                Button({
                  key: 'arcade-note-copy',
                  label: 'Копировать',
                  ...(nb.focus === 'copy' ? { autoFocus: true } : {}),
                  onPress: (press) => {
                    nb.focus = 'copy'
                    return copyPage($, press?.surface ?? e.surface, page.body)
                  },
                }),
              ]
            : []),
        ],
      }),
      gap,
      Input({
        key: `arcade-note-add-${nb.field}`,
        label: 'Новый пункт',
        placeholder: 'пункт чек-листа',
        submitLabel: tr('Добавить', S.lang),
        ...(nb.focus === 'add' ? { autoFocus: true } : {}),
        onSubmit: (value) => {
          // Каждая строка — пункт чек-листа; «- » и «- [ ] » в начале не удваиваем
          const add = String(value ?? '')
            .split(/\r?\n/)
            .map((x) => x.trim().replace(/^[-*] (\[[ xX]\] ?)?/, '').trim())
            .filter(Boolean)
            .map((x) => `- [ ] ${x}`)
            .join('\n')
          if (!add) return
          nb.focus = 'add'
          return editBody((body) => appendText(body, add))
        },
      }),
      gap,
    ]
    const editItems = [
      gap,
      Input({
        key: `arcade-note-text-${nb.field}`,
        label: 'Текст',
        rows: 12,
        value: page.body,
        placeholder: '# Заголовок, - пункт, - [ ] дело',
        submitLabel: tr('Сохранить', S.lang),
        ...(nb.focus === 'text' ? { autoFocus: true } : {}),
        // Набранное — в черновик, без перерисовки: значение поля не трогаем, пока человек пишет
        onInput: (value) => {
          nb.draft = { id, text: String(value ?? '') }
        },
        onSubmit: async (value) => {
          nb.draft = { id, text: String(value ?? '') }
          nb.focus = 'text'
          if (!(await editNotes($, (list) => list, 'Сохранено.'))) return
          nb.editing = ''
          nb.focus = 'edit'
          $.ui.invalidate('ui.render')
        },
      }),
      dim('Enter — сохранить; новая строка — как в поле ввода Claude.'),
      Button({
        key: 'arcade-note-cancel',
        label: 'Отмена',
        onPress: () => {
          if (nb.draft?.id === id) nb.draft = null
          nb.editing = ''
          nb.field++
          nb.focus = 'edit'
          $.ui.invalidate('ui.render')
        },
      }),
      gap,
    ]
    items = [
      parent ? keep(Button({ key: 'arcade-back', label: `← ${parent.title}`, onPress: leave(isBoard(parent) ? `board:${parent.id}` : `note:${parent.id}`) })) : Button({ key: 'arcade-back', label: '← Назад', onPress: leave('notes') }),
      keep(section(page.title)),
      ...cardPlace,
      // Правка — поле «Текст» на месте текста; без правки — текст, чек-лист, «Редактировать», «Копировать» и новый пункт
      ...(editing ? editItems : viewItems),
      Button({ key: 'arcade-note-take', label: 'Взять из поля ввода Claude', ...(nb.focus === 'take' ? { autoFocus: true } : {}), onPress: takePrompt }),
      dim('  Перенесёт набранное или надиктованное в поле ввода Claude в конец страницы.'),
      ...(VOICE_HINT[S.platform] ? [dim(VOICE_HINT[S.platform])] : []),
      ...(parent
        ? []
        : [
            section('Подстраницы'),
            ...(children.length ? [column(children.flatMap((c) => pageTile(c, S.menuFrom === `note:${c.id}`)))] : []),
            Input({
              key: `arcade-note-sub-${nb.field}`,
              label: 'Новая подстраница',
              placeholder: 'название',
              submitLabel: tr('Создать', S.lang),
              onSubmit: (value) => createPage($, value, id),
            }),
          ]),
      gap,
      Input({
        key: `arcade-note-title-${nb.field}`,
        label: 'Название',
        value: page.title,
        submitLabel: tr('Сохранить', S.lang),
        onSubmit: (value) => {
          const title = cleanTitle(value)
          if (!title) {
            nb.note = 'Впиши название страницы.'
            nb.bad = true
            $.ui.invalidate('ui.render')
            return
          }
          return editNotes($, (list, at) => (title === page.title ? list : updatePage(list, id, { title }, at)), 'Сохранено.')
        },
      }),
      gap,
      Button({ key: 'arcade-note-send', label: 'Отдать Claude', onPress: () => sendNote($, id) }),
      dim('  Claude получит страницу и сможет отмечать пункты и дописывать её.'),
      section('Notion и другие приложения'),
      ...(page.link
        ? [
            keep(dim(`  ${tr('Связана с', S.lang)} ${page.link.app}: ${page.link.url}`)),
            Button({ key: 'arcade-note-push', label: 'Обновить в приложении', onPress: () => askApp('update') }),
            Button({ key: 'arcade-note-pull', label: 'Забрать из приложения', onPress: () => askApp('pull') }),
            ...(openUrlCommand(S.platform, page.link.url) ? [Button({ key: 'arcade-note-open', label: 'Открыть в браузере', onPress: () => openLink($, page.link.url) })] : []),
            Button({
              key: 'arcade-note-unlink',
              label: 'Отвязать',
              onPress: () => editNotes($, (list, at) => updatePage(list, id, { link: undefined }, at), 'Страница отвязана.'),
            }),
          ]
        : [
            Button({ key: 'arcade-note-notion', label: 'Отправить в Notion', onPress: () => askApp('push', 'Notion') }),
            Input({
              key: `arcade-note-app-${nb.field}`,
              label: 'В другое приложение',
              placeholder: 'Google Docs, Confluence, Obsidian…',
              submitLabel: tr('Отправить', S.lang),
              onSubmit: (value) => {
                const app = cleanTitle(value).slice(0, MAX_APP)
                if (app) return askApp('push', app)
              },
            }),
          ]),
      dim(CONNECTOR_HINT),
      ...(typeof page.prev === 'string'
        ? [
            Button({
              key: 'arcade-note-undo',
              label: 'Вернуть текст до правки Claude',
              onPress: () =>
                editNotes(
                  $,
                  (list, at) => {
                    const now = list.find((p) => p.id === id)
                    return typeof now?.prev === 'string' ? updatePage(list, id, { body: now.prev, prev: undefined }, at) : list
                  },
                  'Прежний текст вернулся.',
                ),
            }),
          ]
        : []),
      gap,
      Button({
        key: 'arcade-note-delete',
        label: nb.confirm === id ? 'Нажми ещё раз — удалить навсегда' : children.length ? 'Удалить страницу и подстраницы' : 'Удалить страницу',
        onPress: async () => {
          if (nb.confirm !== id) {
            nb.confirm = id
            $.ui.invalidate('ui.render')
            return
          }
          nb.confirm = null
          if (nb.draft?.id === id) nb.draft = null
          if (nb.editing === id) nb.editing = ''
          if (!(await editNotes($, (list) => removePage(list, id), 'Страница удалена.'))) return
          nb.focus = ''
          S.menuFrom = null
          S.menu = parent ? (isBoard(parent) ? `board:${parent.id}` : `note:${parent.id}`) : 'notes'
          $.ui.invalidate('ui.render')
        },
      }),
      ...noteLine,
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}
