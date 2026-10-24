// Arcade: панель — библиотека игр или сама игра. Шапка и общий набор кнопок здесь, разделы библиотеки — в соседних
// файлах, игра — в game.js. Клавиши над экраном игры ловит Client (hooks/input.js) после клика по экрану, в любой раскладке.
import { bundledRom, siteUrl, verifyRom } from '../catalog.js'
import { LANG_NAMES, isKept, keep, tr } from '../i18n.js'
import { AVATAR_COUNT, avatarName, avatarSvg, validPic } from '../avatars.js'
import { isBoard } from '../notes.js'
import { LOGO_SVG } from '../logo.js'
import { FIELD, HIDEABLE, LAUNCH_TIMEOUT_MS, PANE_COLUMNS, ROM_CACHE_LIMIT, S, SECTION_ICONS, SECTION_NOTES, SECTION_SWITCH, finder, unfolded } from '../app/state.js'
import { gameById, genreLabel, groupsList, libraryTitle, mineFile, tabOf } from '../app/library.js'
import { FLAGS, OFF_COLOR, coverSvg, flagSvg, iconSvg } from '../app/icons.js'
import { clip, consoleTitle, statusText, windowNotice } from '../app/status.js'
import { launch } from '../app/play.js'
import { builtinBrowser, launchNotice, mouseGame, opensWindow, windowCommand, windowMode } from '../app/window.js'
import { desktopWindow } from '../app/desktop.js'
import { addTopic, forgetTopics, loadVideos } from '../app/watch.js'
import { loadReads } from '../app/read.js'
import { toggleFavorite, toggleHidden } from '../app/profile.js'
import { answerInvite } from '../app/talk.js'
import { gameScreen } from './game.js'
import { mainScreen, welcomeScreen } from './main.js'
import { favoritesScreen, groupScreen, mineScreen, searchScreen, shelfScreen } from './games.js'
import { langScreen, settingsScreen } from './settings.js'
import { accountScreen, reportScreen, reportsScreen } from './profile.js'
import { friendsScreen, inviteScreen } from './friends.js'
import { chatsScreen } from './chats.js'
import { tiktokScreen, twitchScreen, youtubeScreen, youtubeTopicScreen } from './watch.js'
import { booksScreen, readsScreen, readsTopicScreen } from './read.js'
import { notesScreen } from './notes.js'
import { boardsScreen } from './boards.js'

export async function drawPane($, e) {
  const { Box, Text, Raster, Image, Button: makeButton, Client, Svg, Input } = $.ui.resolve(e)
  // Готовая кнопка заморожена и свой onPress не отдаёт, а плитка Desktop пересобирает её с переносом названия:
  // пропсы каждой кнопки запоминаются здесь
  const buttonProps = new WeakMap()
  const Button = (props) => {
    const button = makeButton(props)
    buttonProps.set(button, props)
    return button
  }
  const now = await $.clock.now()
  const terminal = e.surface === 'terminal'
  const game = gameById(S.view)
  S.remoteSurface = terminal ? null : e.surface
  // Поле поиска рисуется заново, когда на экран поиска приходят с другого: запрос остаётся, а пока человек печатает,
  // поле то же — набранное не сбивается
  if (game || S.menu !== 'search') finder.shown = false

  // Шапка: логотип (Desktop и VS Code), название, состояние агента цветом: работает — жёлтый, ждёт разрешения —
  // красный, закончил — зелёный, свободен — серый. Цвета — ключи темы: читаются и на светлой, и на тёмной
  const statusColor = S.status === 'permission' ? 'error' : S.status === 'working' ? 'warning' : S.status === 'done' ? 'success' : 'inactive'
  const headerOf = (extra = []) => Box({
    flexDirection: 'row',
    columnGap: 2,
    alignItems: 'center',
    children: [
      // логотип — только в главном меню библиотеки в Desktop: над экраном игры он не нужен
      ...(!game && S.menu === 'main' && e.surface === 'desktop' ? [Svg({ source: LOGO_SVG, alt: 'Arcade', width: 40, height: 40 })] : []),
      e.surface === 'desktop' && !game
        ? Text({ size: 'title', weight: 'bold', children: [libraryTitle()] })
        : Text({ bold: true, children: [game ? `Arcade · ${game.title}` : libraryTitle()] }),
      // В Desktop — «таблетка» в рамке цвета состояния; в терминале и VS Code — как было
      Box({
        flexDirection: 'row',
        columnGap: 1,
        ...(e.surface === 'desktop' ? { borderStyle: 'round', borderColor: statusColor, paddingX: 'sm' } : {}),
        children: [
          Text({ color: statusColor, children: ['●'] }),
          Text({ color: statusColor, children: [statusText(now)] }),
        ],
      }),
      ...extra,
    ],
  })
  const header = headerOf()
  // Журнал агента — с подписью и только когда в нём что-то есть: одинокое «пока ничего» внизу меню выглядело обломком
  const eventLines = S.events.length
    ? [Text({ bold: true, dimColor: true, children: ['Журнал агента'] }), ...S.events.slice(0, 3).map((text) => Text({ dimColor: true, children: [text] }))]
    : []

  if (!game) {
    // ROM для игры в панели: встроенный, из кеша мода или скачанный с сайта — всегда сверяется с хешем каталога
    const obtainRom = async (g) => {
      const sha = g.rom.sha256
      if (g.rom.mine) {
        const text = await $.fs.read(mineFile(sha)).catch(() => '')
        if (await verifyRom(text, sha)) return text.trim()
        S.libraryNotice = `Файл игры «${g.title}» не найден — добавь его снова: /arcade-add путь к файлу`
        return null
      }
      const bundled = bundledRom(sha)
      if (bundled) return bundled
      const cached = await $.store.get(`rom:${sha}`)
      if (await verifyRom(cached, sha)) return cached
      S.libraryNotice = `Скачиваю ${g.title}…`
      $.ui.invalidate('ui.render')
      try {
        const response = await $.http.fetch(siteUrl(g.rom.base64))
        const text = response.ok ? response.text.trim() : ''
        if (!(await verifyRom(text, sha))) throw new Error(response.ok ? 'файл повреждён' : `сайт ответил ${response.status}`)
        const index = await $.store.get('roms')
        const keep = [...(Array.isArray(index) ? index : []).filter((x) => x !== sha), sha]
        for (const old of keep.slice(0, -ROM_CACHE_LIMIT)) await $.store.delete(`rom:${old}`)
        await $.store.set(`rom:${sha}`, text)
        await $.store.set('roms', keep.slice(-ROM_CACHE_LIMIT))
        S.libraryNotice = ''
        return text
      } catch (err) {
        S.libraryNotice = `Не получилось скачать ${g.title}: ${err?.message ?? err}`
        return null
      }
    }
    // Игра открывается в окне браузера или здесь, в панели
    const playGame = async (g) => {
      // Всё, кроме Денди и своих игр, идёт только в окне браузера (EmulatorJS на сайте): в панели показать нечем
      const sega = Boolean(g.console) && g.console !== 'nes' && !g.engine // у «Проверки клавиш» приставки нет, а своя игра (Flappy Arcade) — в панели
      if (sega && builtinBrowser(e.surface, mouseGame(g.id))) {
        S.lastGame = g.id
        S.played = true
        await desktopWindow($, g.id, `${g.title} открыт во встроенном браузере Claude.`)
        await $.store.set('lastGame', g.id)
        return
      }
      if (sega && !S.platform) {
        S.libraryNotice = `Игры ${consoleTitle(g.console)} идут в окне браузера, а здесь его открыть нельзя.`
        $.ui.invalidate('ui.render')
        return
      }
      S.lastGame = g.id
      S.played = true
      if ((opensWindow(e.surface) || sega) && g.web) {
        S.libraryNotice = 'Открываю окно…'
        $.ui.invalidate('ui.render')
        const command = windowCommand(g.id)
        try {
          const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
          windowNotice($, launchNotice(result, g.id))
          if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
        } catch (err) {
          S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
        }
      } else if (g.rom) {
        const rom = await obtainRom(g)
        if (rom) launch(g.id, rom)
      } else {
        launch(g.id)
      }
      $.ui.invalidate('ui.render')
      await $.store.set('lastGame', g.id)
    }
    const gameButton = (g, focus) =>
      Button({
        key: `arcade-game-${g.id}`,
        label: g.title,
        ...(focus ? { autoFocus: true } : {}),
        onPress: () => playGame(g),
      })
    const open = (id) => () => {
      S.menuFrom = S.menu
      S.menu = id
      S.libraryNotice = ''
      $.ui.invalidate('ui.render')
    }
    const back = Button({ key: 'arcade-back', label: '← Назад', onPress: open('main') })
    const dim = (text) => Text({ dimColor: true, children: [text] })
    const gap = Text({ children: [' '] })
    // Разделы и плитки главного меню: кнопка с подписью — в рамке; плитки рядами, в узкой панели — колонкой
    const desktop = e.surface === 'desktop'
    // Окно Arcade, сетевые игры и приглашения в них — где есть окно браузера или встроенный браузер Desktop
    const windowed = windowMode() || desktop
    // В Desktop заголовок раздела — крупно, с отступом сверху от раздела выше и снизу от своих плиток
    const section = (title) => (desktop ? Box({ marginTop: 'lg', marginBottom: 'sm', children: [Text({ size: 'heading', weight: 'semibold', children: [title] })] }) : Text({ bold: true, dimColor: true, children: [title] }))
    // Разделы главного меню — в настройках и на приветствии: убранного раздела в меню нет совсем, ни заголовка, ни плиток
    const sectionSwitches = (focus = () => ({})) =>
      HIDEABLE.flatMap((id) => [
        Button({
          key: `arcade-show-${id}`,
          label: SECTION_SWITCH[id][S.hidden.includes(id) ? 1 : 0],
          ...focus(`arcade-show-${id}`),
          onPress: () => toggleHidden($, id),
        }),
        dim(`  ${SECTION_NOTES[id]}`),
      ])
    // Картинки (аватарки, плитки) — везде, кроме терминала: там то же самое текстом
    const pictures = !terminal
    // Выбор одной из AVATAR_COUNT картинок: своя аватарка в «Аккаунте», картинка группы у её хозяина. Каждая — плитка
    // одного размера в рамке: картинка и под ней название кнопкой, длинное — в две строки; выбранная — главной кнопкой
    // и рамкой цвета выбора. Последняя — без картинки: на ней буква, как будет без аватарки (noneSvg). В терминале —
    // одни названия
    const PIC_TILE = 16 // ширина плитки в клетках: самое длинное слово названия («космонавт») встаёт целиком
    const picTile = (key, source, alt, button, selected) =>
      Box({
        key: `card-${key}`,
        flexDirection: 'column',
        alignItems: 'center',
        rowGap: 'xs',
        borderStyle: 'round',
        borderColor: selected ? 'suggestion' : 'subtle',
        padding: 'sm',
        width: PIC_TILE,
        minHeight: 6,
        overflow: 'hidden',
        hover: { borderColor: 'suggestion', backgroundColor: '#8080801a' },
        children: [keep(Svg({ source, alt, width: 40, height: 40 })), button],
      })
    const picGrid = (prefix, current, onPick, noneLabel, noneSvg) => {
      const choice = (key, label, selected, onPress) =>
        Button({ key, label, ...(selected ? { variant: 'primary' } : {}), ...(pictures ? { children: [Text({ wrap: 'wrap', children: [label] })] } : {}), onPress })
      const none = choice(`${prefix}-none`, noneLabel, !validPic(current), () => onPick(null))
      return Box({
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: pictures ? 'sm' : 2,
        rowGap: pictures ? 'sm' : 0,
        children: [
          ...Array.from({ length: AVATAR_COUNT }, (_, n) => {
            const name = avatarName(n, S.lang)
            const button = keep(choice(`${prefix}-${n}`, name, n === current, () => onPick(n)))
            return pictures ? picTile(`${prefix}-${n}`, avatarSvg(n), name, button, n === current) : button
          }),
          pictures ? picTile(`${prefix}-none`, noneSvg, noneLabel, none, !validPic(current)) : none,
        ],
      })
    }
    // Своя тема в темах YouTube, статей и подкастов: поле ввода с подсказкой или заметкой, «Мои темы» плитками и
    // «Забыть мои темы». Названия своих тем — на языке интерфейса или как их написал человек (keep)
    const ownTopics = (kind, short, focus, hintText) => {
      const myTiles = S.myTopics.flatMap((t) => {
        const key = `u${t.id}`
        const button = Button({
          key: `arcade-${short}-own-${t.id}`,
          label: t.title,
          ...(key === focus ? { autoFocus: true } : {}),
          onPress: () => {
            open(`${kind}:${key}`)()
            if (kind === 'youtube') {
              if (S.yt.topic !== key || (!S.yt.videos.length && !S.yt.loading)) loadVideos($, key)
            } else if (S.reads[kind].topic !== key || (!S.reads[kind].items.length && !S.reads[kind].loading)) loadReads($, kind, key)
          },
        })
        return [keep(button), dim('  своя тема')]
      })
      return [
        gap,
        Input({ key: `arcade-${short}-own`, label: 'Своя тема', placeholder: 'о чём угодно: история Рима, хлеб на закваске…', onSubmit: (value) => addTopic($, kind, value) }),
        dim(S.ownNote.kind === kind && S.ownNote.text ? S.ownNote.text : hintText),
        ...(myTiles.length
          ? [
              section('Мои темы'),
              desktop ? tiles(myTiles, 44) : Box({ flexDirection: 'column', children: myTiles }),
              gap,
              Button({ key: `arcade-${short}-forget`, label: 'Забыть мои темы', onPress: () => forgetTopics($) }),
            ]
          : []),
      ]
    }
    // Иконка карточки — по ключу кнопки: arcade-menu-nes → nes, arcade-game-… и «Продолжить» → обложка игры.
    // alt — подпись кнопки: картинку с пустым alt Desktop не рисует
    const iconFor = (button) => {
      const key = String(button?.key ?? button?.props?.key ?? '')
      const label = String(button?.props?.label ?? button?.label ?? '')
      const game = key.startsWith('arcade-game-') ? gameById(key.slice(12)) : key === 'arcade-continue' && S.played ? gameById(S.lastGame) : null
      if (game) return Svg({ source: coverSvg(game), alt: game.title, width: 44, height: 44 })
      // Плитка языка (arcade-lang-de) — флажком, подпись — название языка на нём самом
      const flag = /^arcade-lang-([a-z]{2})$/.exec(key)?.[1]
      if (FLAGS[flag]) return Svg({ source: flagSvg(flag), alt: LANG_NAMES[flag], width: 36, height: 36 })
      // Раздел главного меню в настройках (arcade-show-play) — иконкой его главной плитки, убранный — серой
      const shown = /^arcade-show-([a-z]+)$/.exec(key)?.[1]
      if (SECTION_ICONS[shown]) return Svg({ source: iconSvg(SECTION_ICONS[shown], S.hidden.includes(shown) ? OFF_COLOR : undefined), alt: label, width: 36, height: 36 })
      // arcade-menu-shelf-racing → racing, arcade-lang-main → lang, arcade-support → support. Язык книг — глобусом,
      // «Мои книги» — папкой, разделы книг (arcade-bk-sec-…) и аудиокниг (arcade-ab-…) — иконкой своего раздела.
      // Темы YouTube (arcade-yt-topic-…), статей (ar-) и подкастов (pc-) — иконкой раздела; их названия придумала
      // модель, в alt не ставим
      const kind = key
        .replace(/^arcade-(menu-(shelf-)?)?/, '')
        .replace(/^favorites-.+$/, 'favorites')
        .replace(/^(bk|ab)-lang(-.+)?$/, 'lang')
        .replace(/^(bk|ab)-mine$/, 'mine')
        .replace(/^bk-.+$/, 'books')
        .replace(/^ab-.+$/, 'audiobooks')
        .replace(/^lang-main$/, 'lang')
        .replace(/^open-library$/, 'library')
        .replace(/^yt-.+$/, 'youtube')
        .replace(/^ar-.+$/, 'articles')
        .replace(/^pc-.+$/, 'podcasts')
        .replace(/^tw-.+$/, 'twitch')
        .replace(/^tt-.+$/, 'tiktok')
        // Доска проектов — иконкой доски
        .replace(/^desk-.+$/, 'boards')
        // Страница блокнота — иконкой блокнота
        .replace(/^note-.+$/, 'notes')
      const alts = { youtube: 'YouTube', articles: 'Статьи', podcasts: 'Подкасты', twitch: 'Twitch' }
      return Svg({ source: iconSvg(kind), alt: alts[kind] ?? (label || kind), width: 36, height: 36 })
    }
    // Карточка: ровная ширина в клетках — плитки встают сеткой; рамка и подсветка — цветами темы, светлой и тёмной.
    // Иконка и текст прижаты к верху, лишнее обрезается рамкой, а не ложится на соседнюю плитку.
    // Блок с ключом — сам зона наведения
    const card = (children, key, width) =>
      Box({
        key: `card-${key}`,
        flexDirection: 'row',
        alignItems: 'flex-start',
        columnGap: 'sm',
        borderStyle: 'round',
        borderColor: 'subtle',
        padding: 'sm',
        width,
        overflow: 'hidden',
        hover: { borderColor: 'suggestion', backgroundColor: '#8080801a' },
        children,
      })
    // Ширина плитки — от ширины панели: в ряд встаёт столько плиток не уже min, сколько влезает, и они делят ряд поровну.
    // Запас в 4 клетки — на поля панели и полосу прокрутки
    const TILE_GAP = 2
    const tileWidth = (min) => {
      const room = Math.max(min, (e.viewport?.columns ?? PANE_COLUMNS) - 4)
      const perRow = Math.max(1, Math.floor((room + TILE_GAP) / (min + TILE_GAP)))
      return Math.floor((room - (perRow - 1) * TILE_GAP) / perRow)
    }
    const tiles = (list, min = 32) => {
      if (desktop) {
        const width = tileWidth(min)
        // Описание — около трёх строк мелкого шрифта; длиннее — обрезано, целиком по «ещё»
        const room = Math.max(60, Math.round((width - 8) * 3.6))
        const words = (t) => [...(t.children ?? t.props?.children ?? [])].join('')
        const out = []
        for (let i = 0; i < list.length; i++) {
          const x = list[i]
          if (!x || (x.type === 'Text' && words(x) === ' ')) continue
          const note = list[i + 1]
          if (x.type === 'Button') {
            const hasNote = note && note.type === 'Text' && note.props?.dimColor
            const cardKey = String(x.key ?? x.props?.key ?? i)
            // Название переносится на вторую строку, а не раздвигает плитку; подпись кнопки остаётся её именем
            const made = buttonProps.get(x)
            const title = made?.label ? makeButton({ ...made, children: [Text({ wrap: 'wrap', children: [made.label] })] }) : x
            if (title !== x && isKept(x)) keep(title)
            const body = [title]
            if (hasNote) {
              // Описание переводится здесь, до обрезки: словарь узнаёт фразу только целиком
              const raw = words(note).trim()
              const text = isKept(note) ? raw : tr(raw, S.lang)
              const long = text.length > room
              const shown = long && !unfolded.has(cardKey) ? clip(text, room) : text
              body.push(keep(Text({ size: 'footnote', dimColor: true, wrap: 'wrap', children: [shown] })))
              if (long)
                body.push(
                  Button({
                    key: `arcade-more-${cardKey}`,
                    label: unfolded.has(cardKey) ? 'свернуть' : 'ещё',
                    plain: true,
                    dimColor: true,
                    onPress: () => {
                      if (unfolded.has(cardKey)) unfolded.delete(cardKey)
                      else unfolded.add(cardKey)
                      $.ui.invalidate('ui.render')
                    },
                  }),
                )
              i++
            }
            // У игры и книги — звёздочка избранного в углу карточки
            const starred = cardKey.startsWith('arcade-game-') ? gameById(cardKey.slice(12)) : null
            const corner = starred && starred.id !== FIELD.id ? [favButton(starred)] : []
            out.push(card([iconFor(x), Box({ flexDirection: 'column', rowGap: 'xs', flexGrow: 1, flexShrink: 1, minWidth: 0, children: body }), ...corner], cardKey, width))
          } else out.push(x)
        }
        return Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: TILE_GAP, rowGap: 'md', children: out })
      }
      const out = []
      for (let i = 0; i < list.length; i++) {
        const x = list[i]
        if (!x || (x.type === 'Text' && x.props?.children?.[0] === ' ')) continue
        const note = list[i + 1]
        if (x.type === 'Button' && note && note.type === 'Text' && note.props?.dimColor) {
          out.push(Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, minWidth: 24, children: [x, note] }))
          i++
        } else out.push(Box({ flexDirection: 'column', borderStyle: 'round', borderDimColor: true, paddingX: 1, minWidth: 24, children: [x] }))
      }
      return Box({ flexDirection: 'row', flexWrap: 'wrap', columnGap: 1, children: out })
    }
    const noticeLines = S.libraryNotice ? [gap, Text({ color: 'warning', children: [S.libraryNotice] })] : []
    // Друг зовёт сыграть: «Принять» открывает игру, «Не сейчас» убирает приглашение. Без окна браузера — подсказка
    const inviteRows = (invite, focus) => [
      Text({ bold: true, children: [`@${invite.handle} зовёт сыграть: ${gameById(invite.game)?.title ?? invite.game}`] }),
      Box({
        flexDirection: 'row',
        columnGap: 2,
        children: [
          ...(windowed
            ? [Button({ key: `arcade-inv-accept-${invite.from}`, label: 'Принять', ...(focus ? { autoFocus: true } : {}), onPress: () => answerInvite($, e.surface, invite, true) })]
            : [dim('Сетевые игры открываются в окне браузера — выбери его в настройках.')]),
          Button({ key: `arcade-inv-later-${invite.from}`, label: 'Не сейчас', onPress: () => answerInvite($, e.surface, invite, false) }),
        ],
      }),
    ]
    const hint = [gap, dim('↑ ↓ или Tab — выбрать, Enter — открыть. Можно кликнуть мышью.')]
    // Звёздочка избранного у игры или книги: ☆ — отметить, ★ — уже в избранном, нажать — снять
    const favButton = (g) => {
      const marked = S.favorites.includes(g.id)
      return keep(Button({ key: `arcade-fav-${g.id}`, label: marked ? '★' : '☆', plain: true, ...(marked ? {} : { dimColor: true }), onPress: () => toggleFavorite($, g.id) }))
    }
    // Игры или книги списком: в Desktop — плитками со звёздочкой, в терминале — строкой «название ☆», описание ниже
    const gameRows = (list, focusId) =>
      desktop
        ? [tiles(list.flatMap((g) => [gameButton(g, g.id === focusId), dim(`  ${g.note}`)]))]
        : list.flatMap((g) => [Box({ flexDirection: 'row', columnGap: 2, children: [gameButton(g, g.id === focusId), favButton(g)] }), dim(`  ${g.note}`)])
    // Найденное и избранное — разделами «Игры · Платформер», «Книги · Роман»; разделы — в порядке первой записи
    const byGenre = (list, focusId) => {
      const parts = new Map()
      for (const g of list) {
        const id = `${tabOf(g)?.id ?? ''}|${g.genre ?? ''}`
        if (!parts.has(id)) parts.set(id, { first: g, list: [] })
        parts.get(id).list.push(g)
      }
      return [...parts.values()].flatMap(({ first, list: part }) => {
        const tab = tabOf(first)
        const title = [tab && tr(tab.title, S.lang), first.genre && genreLabel(first.genre)].filter(Boolean).join(' · ')
        return [keep(section(title)), ...gameRows(part, focusId)]
      })
    }
    // Трансляция Twitch: во встроенном браузере Claude, в окне браузера или ссылкой, если окно открыть нечем
    const watchLive = async (login) => {
      const id = `live:${login}`
      if (builtinBrowser(e.surface)) return desktopWindow($, id, 'Трансляция открыта во встроенном браузере Claude.')
      if (!S.platform) {
        S.libraryNotice = `Трансляция: https://www.twitch.tv/${login}`
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

    // Что из шапки и набора выше нужно экранам библиотеки
    const kit = {
      Box, Button, Input, Svg, TILE_GAP, Text, back, byGenre, desktop, dim, eventLines, gameButton, gameRows, gap, hint, inviteRows, makeButton, noticeLines,
      now, open, ownTopics, picGrid, pictures, playGame, section, sectionSwitches, tileWidth, tiles, watchLive, windowed,
    }

    let items
    let headerExtra = []
    if (S.menu === 'lang') items = langScreen($, e, kit)
    else if (S.menu === 'account') items = accountScreen($, e, kit)
    else if (S.menu === 'report') items = reportScreen($, e, kit)
    else if (S.menu === 'reports') items = reportsScreen($, e, kit)
    else if (S.menu === 'friends:invite' && S.ol.to && S.acct.handle) items = inviteScreen($, e, kit)
    else if (S.menu === 'friends' || S.menu === 'friends:remove' || S.menu === 'friends:invite') items = friendsScreen($, e, kit)
    else if (S.menu === 'chats' || S.menu.startsWith('chats:')) items = chatsScreen($, e, kit)
    else if (S.menu === 'settings') items = settingsScreen($, e, kit)
    else if (S.menu === 'youtube') items = youtubeScreen($, e, kit)
    else if (S.menu.startsWith('youtube:')) items = youtubeTopicScreen($, e, kit)
    else if (S.menu === 'boards' || S.menu.startsWith('board:') || (S.menu.startsWith('note:') && isBoard(S.notes.find((p) => p.id === S.menu.slice(5))))) items = boardsScreen($, e, kit)
    else if (S.menu === 'notes' || S.menu.startsWith('note:')) items = notesScreen($, e, kit)
    else if (S.menu === 'tiktok') items = tiktokScreen($, e, kit)
    else if (S.menu === 'twitch' || S.menu.startsWith('twitch:')) items = twitchScreen($, e, kit)
    else if (S.menu === 'articles' || S.menu === 'podcasts') items = readsScreen($, e, kit)
    else if (S.menu.startsWith('articles:') || S.menu.startsWith('podcasts:')) items = readsTopicScreen($, e, kit)
    else if (S.menu === 'search') items = searchScreen($, e, kit)
    else if (S.menu === 'favorites' || S.menu.startsWith('favorites:')) items = favoritesScreen($, e, kit)
    else if (S.menu === 'mine') items = mineScreen($, e, kit)
    else if (groupsList().some((x) => x.id === S.menu)) items = groupScreen($, e, kit)
    else if (/^(books|audiobooks)(:(lang|list))?$/.test(S.menu)) items = booksScreen($, e, kit)
    else if (S.menu === 'main' && !S.welcomed) items = welcomeScreen($, e, kit)
    else if (S.menu !== 'main') items = shelfScreen($, e, kit)
    else ({ items, headerExtra } = mainScreen($, e, kit))
    return Box({ flexDirection: 'column', children: [headerExtra.length ? headerOf(headerExtra) : header, gap, ...items] })
  }
  return gameScreen($, e, { Box, Button, Client, Image, Raster, Svg, Text, eventLines, game, header, terminal })
}
