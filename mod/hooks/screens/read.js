// Arcade: экраны статей, подкастов и книг.
import { keep, tr } from '../i18n.js'
import { videoBlurb } from '../youtube.js'
import { itemStats } from '../rss.js'
import { BOOK_LANGS, BOOK_SECTIONS, BOOK_SOURCES, MIN_BOOK_QUERY, bookQuery } from '../books.js'
import { LAUNCH_TIMEOUT_MS, S } from '../app/state.js'
import { iconSvg } from '../app/icons.js'
import { windowNotice } from '../app/status.js'
import { builtinBrowser, launchNotice, whereText, windowCommand, windowUrl } from '../app/window.js'
import { desktopWindow } from '../app/desktop.js'
import { loadTopics, topicKey, topicOf } from '../app/watch.js'
import { loadBooks, loadReads, setBookLang } from '../app/read.js'

// Статьи и подкасты: темы — те же, что у YouTube, подборка — своя. Названия, которые придумала модель, — уже на
// языке интерфейса (keep)
export function readsScreen($, e, kit) {
  const { Box, Button, Text, back, desktop, dim, gap, hint, noticeLines, open, ownTopics, tiles } = kit
  const kind = S.menu
  const articles = kind === 'articles'
  const short = articles ? 'ar' : 'pc'
  const focus = S.menuFrom?.startsWith(`${kind}:`) ? topicKey(S.menuFrom.slice(kind.length + 1)) : 0
  const topicTiles = (S.yt.topics ?? []).flatMap((t, i) => {
    const button = Button({
      key: `arcade-${short}-topic-${i}`,
      label: t.title,
      ...(i === focus ? { autoFocus: true } : {}),
      onPress: () => {
        open(`${kind}:${i}`)()
        const state = S.reads[kind]
        if (state.topic !== i || (!state.items.length && !state.loading)) loadReads($, kind, i)
      },
    })
    return [t.fixed ? button : keep(button), dim(t.direction === 'news' ? '  новости и обзоры обновлений' : '  по теме работы агента')]
  })
  return [
    back,
    gap,
    dim(
      articles
        ? 'Темы — по тому, над чем сейчас работает агент; статьи — свежие, из проверенных блогов и изданий на английском.'
        : 'Темы — по тому, над чем сейчас работает агент; выпуски — свежие, из проверенных подкастов на английском.',
    ),
    gap,
    ...(S.yt.loading === 'topics' || !S.yt.topics
      ? [Text({ children: ['Подбираю темы…'] })]
      : [
          desktop ? tiles(topicTiles, 44) : Box({ flexDirection: 'column', children: topicTiles }),
          gap,
          Button({ key: `arcade-${short}-retopic`, label: 'Другие темы', onPress: () => loadTopics($) }),
        ]),
    ...ownTopics(
      kind,
      short,
      focus,
      articles ? 'Напиши, о чём хочешь почитать, — Arcade найдёт свежие статьи по теме.' : 'Напиши, о чём хочешь послушать, — Arcade найдёт свежие выпуски по теме.',
    ),
    ...noticeLines,
    ...hint,
  ]
}

export function readsTopicScreen($, e, kit) {
  const { Box, Button, Svg, Text, desktop, dim, gap, hint, noticeLines, now, open } = kit
  const kind = S.menu.split(':')[0]
  const articles = kind === 'articles'
  const short = articles ? 'ar' : 'pc'
  const topicId = topicKey(S.menu.slice(kind.length + 1))
  const topic = topicOf(topicId)
  const state = S.reads[kind]
  const builtin = builtinBrowser(e.surface)
  const openItem = async (k) => {
    const id = `${articles ? 'article' : 'episode'}:${k}`
    if (builtin) return desktopWindow($, id, articles ? 'Статья открыта во встроенном браузере Claude.' : 'Выпуск открыт во встроенном браузере Claude.')
    if (!S.platform) {
      const x = S.reads[kind].items[k]
      S.libraryNotice = articles ? `Статья: ${x.link}` : `Выпуск: ${x.link || x.audio}`
      $.ui.invalidate('ui.render')
      return
    }
    S.libraryNotice = 'Открываю окно…'
    $.ui.invalidate('ui.render')
    const command = windowCommand(id)
    try {
      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
      windowNotice($, launchNotice(result, id))
      if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
    } catch (err) {
      S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
    }
    $.ui.invalidate('ui.render')
  }
  // Записи — названия, источники и описания как есть, без перевода (keep). В Desktop — карточка во всю строку:
  // название, источник с датой (у выпуска — и длительностью), начало описания
  const entry = (x, k) => {
    const label = x.title.length > 100 ? `${x.title.slice(0, 99)}…` : x.title
    const button = Button({ key: `arcade-${short}-item-${k}`, label, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => openItem(k) })
    const stats = itemStats(x, S.lang, now)
    if (!desktop) return keep(Box({ flexDirection: 'column', children: [button, Text({ dimColor: true, children: [`  ${[x.channel, stats].filter(Boolean).join(' · ')}`] })] }))
    const about = videoBlurb(x)
    return keep(
      Box({
        key: `card-${short}-item-${k}`,
        flexDirection: 'row',
        alignItems: 'flex-start',
        columnGap: 'md',
        borderStyle: 'round',
        borderColor: 'subtle',
        padding: 'md',
        hover: { borderColor: 'suggestion', backgroundColor: '#8080801a' },
        children: [
          Svg({ source: iconSvg(kind), alt: x.channel, width: 48, height: 48 }),
          Box({
            flexDirection: 'column',
            rowGap: 'xs',
            flexShrink: 1,
            flexGrow: 1,
            children: [
              button,
              Text({ size: 'footnote', children: [Text({ weight: 'semibold', children: [x.channel] }), ...(stats ? [Text({ dimColor: true, children: [` · ${stats}`] })] : [])] }),
              ...(about ? [Text({ size: 'footnote', dimColor: true, wrap: 'wrap', children: [about] })] : []),
            ],
          }),
        ],
      }),
    )
  }
  return [
    Button({ key: 'arcade-back', label: '← Назад', ...(state.loading ? { autoFocus: true } : {}), onPress: open(kind) }),
    gap,
    ...(topic ? [topic.fixed ? Text({ bold: true, children: [topic.title] }) : keep(Text({ bold: true, children: [topic.title] }))] : []),
    gap,
    ...(state.loading
      ? [Text({ children: [articles ? 'Подбираю статьи…' : 'Подбираю выпуски…'] })]
      : state.items.length
        ? [Box({ flexDirection: 'column', rowGap: desktop ? 'sm' : 0, children: state.items.map(entry) })]
        : []),
    ...(state.note ? [gap, dim(state.note)] : []),
    ...(topic && !state.loading
      ? [gap, Button({ key: `arcade-${short}-more`, label: 'Другая подборка', ...(state.items.length ? {} : { autoFocus: true }), onPress: () => loadReads($, kind, topicId, true) })]
      : []),
    ...(state.items.length && (builtin || S.platform)
      ? [gap, dim(articles ? `Статьи открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.` : `Выпуски открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)]
      : []),
    ...noticeLines,
    ...hint,
  ]
}

// Книги и аудиокниги: Arcade их не хранит — список приходит с сайта (Project Gutenberg, Викитека, LibriVox) на
// языке книг, который выбирает человек. Разделы одни на все языки, поиск — по названию или автору. Книга
// открывается в окне Arcade: там читалка или проигрыватель, там же её можно скачать к себе («Мои книги»)
export function booksScreen($, e, kit) {
  const { Box, Button, Input, Text, back, desktop, dim, gap, hint, noticeLines, open, section, tiles } = kit
  let items
  const [page, screen] = S.menu.split(':')
  const kind = page === 'books' ? 'book' : 'audio'
  const short = kind === 'book' ? 'bk' : 'ab'
  const state = S.bk[kind]
  const builtin = builtinBrowser(e.surface)
  const openWindow = async (id, opened) => {
    if (builtin) return desktopWindow($, id, opened)
    if (!S.platform) {
      S.libraryNotice = `Открой в браузере: ${windowUrl(id)}`
      $.ui.invalidate('ui.render')
      return
    }
    S.libraryNotice = 'Открываю окно…'
    $.ui.invalidate('ui.render')
    const command = windowCommand(id)
    try {
      const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
      windowNotice($, launchNotice(result, id))
      if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
    } catch (err) {
      S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
    }
    $.ui.invalidate('ui.render')
  }
  // В список раздела или поиска; тот же раздел уже загружен — показываем его, не загружая заново
  const toList = (what) => () => {
    open(`${page}:list`)()
    if (what.q || what.section !== state.section || state.q || (!state.items.length && !state.loading)) loadBooks($, kind, what)
  }
  if (screen === 'lang') {
    // Название языка — на нём самом (keep), выбранный — с галочкой
    items = [
      Button({ key: 'arcade-back', label: '← Назад', onPress: open(page) }),
      gap,
      dim('Книги и аудиокниги будут на этом языке. Язык интерфейса не меняется.'),
      gap,
      tiles(
        Object.entries(BOOK_LANGS).map(([code, name]) =>
          keep(
            Button({
              key: `arcade-${short}-lang-${code}`,
              label: `${name}${code === S.bk.lang ? ' ✓' : ''}`,
              ...(code === S.bk.lang ? { autoFocus: true } : {}),
              onPress: async () => {
                open(page)()
                if (code !== S.bk.lang) await setBookLang($, code)
              },
            }),
          ),
        ),
        22,
      ),
      ...hint,
    ]
  } else if (screen === 'list') {
    const opened = kind === 'book' ? 'Книга открыта во встроенном браузере Claude.' : 'Аудиокнига открыта во встроенном браузере Claude.'
    // Названия и авторы — как у источника, без перевода (keep); источник переводим («Викитека» → «Wikisource»)
    const entries = state.items.flatMap((x, k) => [
      keep(
        Button({
          key: `arcade-${short}-item-${k}`,
          label: x.title.length > 100 ? `${x.title.slice(0, 99)}…` : x.title,
          ...(k === 0 ? { autoFocus: true } : {}),
          onPress: () => openWindow(`${kind}:${x.ref}`, opened),
        }),
      ),
      keep(dim(`  ${[x.author, tr(BOOK_SOURCES[x.source] ?? x.source, S.lang)].filter(Boolean).join(' · ')}`)),
    ])
    const retry = () => (S.bk[kind].items.length ? loadBooks($, kind, { more: true }) : loadBooks($, kind, { section: state.section, q: state.q }))
    items = [
      Button({ key: 'arcade-back', label: '← Назад', ...(entries.length ? {} : { autoFocus: true }), onPress: open(page) }),
      gap,
      state.q ? keep(Text({ bold: true, children: [`${tr('Поиск', S.lang)}: ${state.q}`] })) : Text({ bold: true, children: [BOOK_SECTIONS[state.section] ?? BOOK_SECTIONS.popular] }),
      keep(dim(`${tr(kind === 'book' ? 'Книги' : 'Аудиокниги', S.lang)} · ${BOOK_LANGS[S.bk.lang]}`)),
      gap,
      ...(entries.length ? [desktop ? tiles(entries, 44) : Box({ flexDirection: 'column', children: entries })] : []),
      ...(state.loading && !entries.length ? [Text({ children: ['Загружаю список…'] })] : []),
      ...(!state.loading && !state.error && !entries.length ? [Text({ children: ['Ничего не нашлось — попробуй другое слово или язык.'] })] : []),
      ...(state.error
        ? [
            gap,
            Text({ color: 'warning', children: [`Список не загрузился: ${state.error}`] }),
            Button({ key: `arcade-${short}-retry`, label: 'Ещё раз', onPress: retry }),
          ]
        : state.more
          ? [gap, Button({ key: `arcade-${short}-more`, label: state.loading ? 'Загружаю…' : 'Ещё', onPress: () => !S.bk[kind].loading && loadBooks($, kind, { more: true }) })]
          : []),
      ...(entries.length && (builtin || S.platform)
        ? [gap, dim(`${kind === 'book' ? 'Книги' : 'Аудиокниги'} открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)]
        : []),
      ...noticeLines,
      ...hint,
    ]
  } else {
    // Вернулись из списка раздела — фокус на этом разделе, из поиска — на поле, из языков — на языке
    const fromList = S.menuFrom === `${page}:list`
    const focusSection = S.menuFrom === `${page}:lang` || (fromList && state.q) ? null : fromList ? state.section || 'popular' : 'popular'
    const search = (value) => {
      const q = bookQuery(value)
      if (q.length < MIN_BOOK_QUERY) {
        S.libraryNotice = 'Напиши хотя бы две буквы.'
        $.ui.invalidate('ui.render')
        return
      }
      toList({ q })()
    }
    items = [
      back,
      gap,
      tiles([
        Button({ key: `arcade-${short}-lang`, label: `Язык книг: ${BOOK_LANGS[S.bk.lang]}`, ...(S.menuFrom === `${page}:lang` ? { autoFocus: true } : {}), onPress: open(`${page}:lang`) }),
        dim('  разделы и поиск — на этом языке'),
        Button({
          key: `arcade-${short}-mine`,
          label: kind === 'book' ? 'Мои книги' : 'Мои аудиокниги',
          onPress: () => openWindow(`mine:${kind}`, kind === 'book' ? '«Мои книги» открыты во встроенном браузере Claude.' : '«Мои аудиокниги» открыты во встроенном браузере Claude.'),
        }),
        dim(kind === 'book' ? '  скачанные в окне Arcade — читать без интернета' : '  скачанные в окне Arcade — слушать без интернета'),
      ]),
      gap,
      Input({ key: `arcade-${short}-find`, label: 'Найти', placeholder: 'название или автор', ...(fromList && state.q ? { autoFocus: true } : {}), onSubmit: search }),
      section('Разделы'),
      tiles(
        Object.entries(BOOK_SECTIONS).map(([id, label]) =>
          Button({ key: `arcade-${short}-sec-${id}`, label, ...(id === focusSection ? { autoFocus: true } : {}), onPress: toList({ section: id }) }),
        ),
        20,
      ),
      gap,
      dim(
        kind === 'book'
          ? 'Книги — из Project Gutenberg и Викитеки, свободные от авторских прав. Arcade их не хранит: книга открывается в окне, скачать её к себе можно там же.'
          : 'Аудиокниги — из LibriVox: их читают вслух добровольцы, записи свободны. Arcade их не хранит: слушать можно сразу в окне, скачать — там же.',
      ),
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}
