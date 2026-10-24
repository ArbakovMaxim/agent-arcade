// Arcade: главное меню библиотеки и приветствие первого запуска.
import { openUrlCommand } from '../browsers.js'
import { LANG_NAMES, keep, tr } from '../i18n.js'
import { LAUNCH_TIMEOUT_MS, S, nb } from '../app/state.js'
import { consoleNote, consoles, favoriteGames, gameById, menuTabs, supportUrl } from '../app/library.js'
import { plural, waitingText, windowNotice } from '../app/status.js'
import { builtinBrowser, launchNotice, netWhere, openNet, settingsNote, windowCommand } from '../app/window.js'
import { desktopWindow } from '../app/desktop.js'
import { TOPICS_TTL_MS, loadTopics, loadTwitch } from '../app/watch.js'
import { finishWelcome, loadReports, syncAccount, toggleSection } from '../app/profile.js'
import { friendsCall, loadChats, pulseSoon } from '../app/talk.js'
import { boardsOpened } from '../app/work.js'

// Первый запуск: что есть в Arcade и какие разделы показывать. Показаны все — лишнее человек убирает нажатием,
// вернуть можно в настройках. Язык угадан по окружению — сменить его можно здесь же. Вернулись с выбора языка
// (выбрали язык — menuFrom 'main', «Назад» — 'lang') — фокус на языке, иначе на «Готово»
export function welcomeScreen($, e, kit) {
  const { Button, Text, desktop, dim, gap, hint, noticeLines, open, section, sectionSwitches, tiles } = kit
  const welcomeFocus = S.menuFrom === 'main' || S.menuFrom === 'lang' ? 'arcade-lang-main' : 'arcade-welcome-done'
  const focus = (key) => (key === welcomeFocus ? { autoFocus: true } : {})
  return [
    Text(desktop ? { size: 'heading', weight: 'semibold', children: ['Добро пожаловать в Arcade!'] } : { bold: true, children: ['Добро пожаловать в Arcade!'] }),
    Text({ wrap: 'wrap', children: ['Пока Claude работает, здесь можно играть, читать и слушать, смотреть видео, общаться с друзьями и вести заметки.'] }),
    dim('Выбери, что показывать в главном меню: нажатие убирает раздел или возвращает его.'),
    ...(desktop ? [] : [gap]),
    section('Разделы главного меню'),
    tiles(sectionSwitches(), 40),
    ...(desktop ? [] : [gap]),
    section('Язык'),
    tiles(
      [
        Button({
          key: 'arcade-lang-main',
          label: `🌐 ${LANG_NAMES[S.lang] ?? S.lang}`,
          ...focus('arcade-lang-main'),
          onPress: () => {
            S.langReturn = 'main'
            open('lang')()
          },
        }),
        dim('  язык интерфейса — 13 на выбор'),
      ],
      40,
    ),
    gap,
    Button({ key: 'arcade-welcome-done', label: 'Готово', ...(desktop ? { variant: 'primary' } : {}), ...focus('arcade-welcome-done'), onPress: () => finishWelcome($) }),
    dim('Передумаешь — разделы меняются в «Ещё → Настройки».'),
    ...noticeLines,
    ...hint,
  ]
}

// Последнее, во что играли (или что читали и слушали), — одной кнопкой: при открытии меню фокус на ней
export function mainScreen($, e, kit) {
  const { Box, Button, Text, desktop, dim, eventLines, gap, hint, inviteRows, noticeLines, now, open, playGame, tiles, windowed } = kit
  let items
  let headerExtra = []
  const resume = S.played ? gameById(S.lastGame) : null
  const tabItems = (list) =>
    list.flatMap((c) => [
      Button({
        key: `arcade-menu-${c.id}`,
        label: c.title,
        ...((S.menuFrom ?? (resume ? null : consoles()[0]?.id)) === c.id ? { autoFocus: true } : {}),
        onPress: open(c.id),
      }),
      dim(`  ${consoleNote(c)}`),
    ])
  // Книги и аудиокниги — свои экраны, не вкладки каталога. Старый каталог сайта (до 0.31) держал их в группах
  // reading и listening — в «Играть» их не показываем
  const reading = menuTabs().filter((c) => ['reading', 'books', 'listening', 'audiobooks'].includes(c.id))
  const bookTile = (id, label, note) => [Button({ key: `arcade-menu-${id}`, label, ...(S.menuFrom === id || S.menuFrom?.startsWith(`${id}:`) ? { autoFocus: true } : {}), onPress: open(id) }), dim(note)]
  // YouTube, статьи и подкасты: общие темы подбираем заново, если их нет, сменился язык или они устарели
  const openTopics = (id) => () => {
    open(id)()
    if (!S.yt.topics || S.yt.topicsLang !== S.lang || now - S.yt.topicsAt > TOPICS_TTL_MS) loadTopics($)
  }
  const topicTile = (id, label, note) => [Button({ key: `arcade-menu-${id}`, label, ...(S.menuFrom === id ? { autoFocus: true } : {}), onPress: openTopics(id) }), dim(note)]
  // Аккаунт, друзья и чаты открываются и плитками «Общения», и из шапки
  const toAccount = () => {
    S.acct.confirmDelete = false
    open('account')()
    syncAccount($)
  }
  const toFriends = () => {
    S.fr.note = ''
    S.fr.bad = false
    open('friends')()
    if (!S.acct.session) return
    if (!S.acct.syncedAt) syncAccount($)
    friendsCall($, 'friends')
    // кто из друзей в сети — сразу, не дожидаясь отметки по таймеру
    pulseSoon($)
  }
  // Непрочитанные — с сайта при синхронизации и по таймеру
  const toChats = async () => {
    S.ch.note = ''
    S.ch.bad = false
    open('chats')()
    if (!S.acct.session) return
    if (!S.acct.syncedAt) await syncAccount($)
    if (S.acct.handle) await loadChats($)
  }
  // Шапка главного меню: свой @ник — в аккаунт; непрочитанные чаты и заявки в друзья — числом, если они есть
  if (S.acct.session)
    headerExtra = [
      keep(Button({ key: 'arcade-head-account', label: S.acct.handle ? `@${S.acct.handle}` : S.acct.session.user.login, plain: true, dimColor: true, onPress: toAccount })),
      ...(S.acct.unread ? [keep(Button({ key: 'arcade-head-chats', label: `💬 ${S.acct.unread}`, plain: true, onPress: toChats }))] : []),
      ...(S.acct.requests ? [keep(Button({ key: 'arcade-head-friends', label: `👥 ${S.acct.requests}`, plain: true, onPress: toFriends }))] : []),
    ]
  // Раздел главного меню сворачивается: заголовок — кнопка ▾ / ▸, у свёрнутого — сколько в нём плиток. Что
  // свёрнуто — в настройках, со входом — на всех компьютерах. Убранного в настройках раздела нет совсем
  const foldable = (id, title, list, badge = '') => {
    if (S.hidden.includes(id)) return []
    const shut = S.collapsed.includes(id)
    const count = list.filter((x) => x?.type === 'Button').length
    const label = `${shut ? '▸' : '▾'} ${tr(title, S.lang)}${shut ? ` · ${count}${badge}` : ''}`
    const head = keep(
      Button({
        key: `arcade-fold-${id}`,
        label,
        plain: true,
        children: [Text(desktop ? { size: 'heading', weight: 'semibold', children: [label] } : { bold: true, ...(shut ? { dimColor: true } : {}), children: [label] })],
        onPress: () => toggleSection($, id),
      }),
    )
    return [desktop ? Box({ marginTop: 'lg', marginBottom: 'sm', children: [head] }) : head, ...(shut ? [] : [tiles(list)])]
  }
  const windowTiles = windowed
    ? [
        Button({
          key: 'arcade-open-library',
          label: 'Окно Arcade',
          onPress: async () => {
            if (builtinBrowser(e.surface)) return desktopWindow($, null, 'Arcade открыт во встроенном браузере Claude.')
            S.libraryNotice = 'Открываю окно…'
            $.ui.invalidate('ui.render')
            const command = windowCommand(null)
            try {
              const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
              windowNotice($, launchNotice(result, null))
              if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
            } catch (err) {
              S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
            }
            $.ui.invalidate('ui.render')
          },
        }),
        dim('  все игры и статистика в окне браузера'),
      ]
    : []
  // Кто-то ждёт в сети — можно сразу к нему
  const joinTiles =
    windowed && S.netWaiting.length
      ? [
          Button({
            key: 'arcade-net-join',
            label: `Присоединиться: ${S.netWaiting[0].title}`,
            onPress: () => openNet($, e.surface, netWhere(S.netWaiting[0].id)),
          }),
          dim(`  в сети ждут: ${waitingText()}`),
        ]
      : []
  const favCount = favoriteGames().length
  // Друг зовёт сыграть — первым делом; остальные приглашения — в «Друзьях»
  const inviteBanner =
    S.acct.session && S.ol.invites.length
      ? [...inviteRows(S.ol.invites[0], false), ...(S.ol.invites.length > 1 ? [dim(`ещё приглашений: ${S.ol.invites.length - 1} — в «Друзьях»`)] : []), gap]
      : []
  items = [
    ...inviteBanner,
    // Сверху, без заголовка: продолжить последнее, найти, избранное
    tiles([
      ...(resume
        ? [
            Button({ key: 'arcade-continue', label: '▶ Продолжить', ...(S.menuFrom ? {} : { autoFocus: true }), onPress: () => playGame(resume) }),
            dim(`  ${resume.title}`),
          ]
        : []),
      Button({
        key: 'arcade-menu-search',
        label: '🔍 Найти',
        ...(S.menuFrom === 'search' ? { autoFocus: true } : {}),
        onPress: () => {
          open('search')()
          // каналы Twitch для поиска — из каталога сайта
          if (!S.tw.at) loadTwitch($)
        },
      }),
      dim('  игры и каналы Twitch'),
      Button({ key: 'arcade-menu-favorites', label: '★ Избранное', ...(S.menuFrom === 'favorites' ? { autoFocus: true } : {}), onPress: open('favorites') }),
      dim(favCount ? `  отмечено: ${favCount}` : '  отмечай ☆ игры — они соберутся здесь'),
    ]),
    ...foldable('play', 'Играть', [
      ...tabItems(menuTabs().filter((c) => !reading.includes(c))),
      ...joinTiles,
      Button({
        key: 'arcade-menu-mine',
        label: 'Мои игры',
        ...(S.menuFrom === 'mine' ? { autoFocus: true } : {}),
        onPress: open('mine'),
      }),
      dim(`  ${S.mine.length ? `${S.mine.length} ${plural(S.mine.length, 'игра', 'игры', 'игр')}` : 'добавь свой файл ROM'}`),
    ]),
    // Книги и аудиокниги с открытых библиотек, за ними — свежие статьи и подкасты по теме работы агента
    ...foldable('read', 'Читать и слушать', [
      ...bookTile('books', 'Книги', '  классика на любом языке: разделы и поиск'),
      ...bookTile('audiobooks', 'Аудиокниги', '  LibriVox: слушать сразу или скачать'),
      ...topicTile('articles', 'Статьи', '  свежие статьи по теме работы агента'),
      ...topicTile('podcasts', 'Подкасты', '  свежие выпуски подкастов по теме работы агента'),
    ]),
    ...foldable('watch', 'Смотреть', [
      ...topicTile('youtube', 'YouTube', '  свежие видео по теме работы агента'),
      Button({
        key: 'arcade-menu-twitch',
        label: 'Twitch',
        ...(S.menuFrom === 'twitch' ? { autoFocus: true } : {}),
        onPress: () => {
          S.tw.note = ''
          open('twitch')()
          loadTwitch($)
        },
      }),
      dim('  свои каналы и эфиры о программировании, технике и ретро-играх'),
      ...topicTile('tiktok', 'TikTok', '  лента и поиск по теме работы агента; вход — твой'),
    ]),
    // Друзья, чаты и аккаунт; у свёрнутого раздела видно, что кто-то написал или зовёт в друзья
    ...foldable(
      'talk',
      'Общение',
      [
        // Друзья — плитка видна всем; без входа и без ника экран скажет, что сделать сначала
        Button({
          key: 'arcade-menu-friends',
          label: 'Друзья',
          ...(String(S.menuFrom ?? '').startsWith('friends') ? { autoFocus: true } : {}),
          onPress: toFriends,
        }),
        // Ника нет, а сайт ещё не спрашивали — может, он есть: пока без «возьми ник»
        dim(
          !S.acct.session
            ? '  по @нику: заявки и список друзей; нужен вход через GitHub'
            : !S.acct.handle
              ? S.acct.syncedAt
                ? '  сначала возьми свой @ник'
                : '  по @нику: заявки и список друзей'
              : S.acct.requests
                ? `  заявок тебе: ${S.acct.requests} · друзей: ${S.acct.friends}`
                : S.acct.friends && S.ol.online.size
                  ? `  друзей: ${S.acct.friends} · в сети: ${S.ol.online.size}`
                  : S.acct.friends
                    ? `  друзей: ${S.acct.friends}`
                    : '  позови друзей по их @нику',
        ),
        // Чаты — плитка видна всем, как «Друзья»
        Button({
          key: 'arcade-menu-chats',
          label: 'Чаты',
          ...(String(S.menuFrom ?? '').startsWith('chats') ? { autoFocus: true } : {}),
          onPress: toChats,
        }),
        dim(
          !S.acct.session
            ? '  с друзьями: один на один и группы; нужен вход через GitHub'
            : !S.acct.handle && S.acct.syncedAt
              ? '  сначала возьми свой @ник'
              : S.acct.unread
                ? `  непрочитанных: ${S.acct.unread}`
                : '  с друзьями: один на один и группы',
        ),
        // Вход — по желанию: настройки одни на всех компьютерах человека
        Button({
          key: 'arcade-menu-account',
          label: S.acct.session ? 'Аккаунт' : 'Войти через GitHub',
          ...(S.menuFrom === 'account' ? { autoFocus: true } : {}),
          onPress: toAccount,
        }),
        S.acct.session ? keep(dim(`  ${S.acct.handle ? `@${S.acct.handle} · ` : ''}GitHub: @${S.acct.session.user.login}`)) : dim('  по желанию: одни настройки на всех компьютерах и свой @ник'),
      ],
      `${S.acct.unread ? ` · 💬 ${S.acct.unread}` : ''}${S.acct.requests ? ` · 👥 ${S.acct.requests}` : ''}${S.ol.online.size ? ` · 🟢 ${S.ol.online.size}` : ''}`,
    ),
    // Работа: блокнот и доска проектов, которые ведут и человек, и Claude
    ...foldable('work', 'Работа', [
      Button({
        key: 'arcade-menu-notes',
        label: 'Блокнот',
        ...(S.menuFrom === 'notes' ? { autoFocus: true } : {}),
        onPress: () => {
          nb.note = ''
          nb.bad = false
          open('notes')()
        },
      }),
      dim('  страницы и чек-листы; Claude может дополнять'),
      Button({
        key: 'arcade-menu-boards',
        label: 'Доска проектов',
        ...(S.menuFrom === 'boards' ? { autoFocus: true } : {}),
        onPress: () => {
          open('boards')()
          boardsOpened($)
        },
      }),
      dim('  колонки и карточки; общие — с друзьями'),
    ]),
    ...foldable('more', 'Ещё', [
      ...windowTiles,
      Button({
        key: 'arcade-menu-settings',
        label: 'Настройки',
        ...(S.menuFrom === 'settings' ? { autoFocus: true } : {}),
        onPress: open('settings'),
      }),
      dim(`  ${settingsNote(e.surface)}`),
      // Язык — прямо в главном меню: название языка на нём самом, чтобы найти его, не понимая текущего
      Button({
        key: 'arcade-lang-main',
        label: `🌐 ${LANG_NAMES[S.lang] ?? S.lang}`,
        onPress: () => {
          S.langReturn = 'main'
          open('lang')()
        },
      }),
      dim('  язык интерфейса — 13 на выбор'),
      Button({
        key: 'arcade-menu-report',
        label: '🐞 Сообщить об ошибке',
        ...(S.menuFrom === 'report' ? { autoFocus: true } : {}),
        onPress: () => {
          S.rp.note = ''
          open('report')()
        },
      }),
      dim('  что сломалось — прямо автору Arcade'),
      // Список отчётов — только админу: остальные этой плитки не видят, а сайт им список и не отдаст
      ...(S.acct.role === 'admin'
        ? [
            Button({
              key: 'arcade-menu-reports',
              label: '📋 Отчёты об ошибках',
              ...(S.menuFrom === 'reports' ? { autoFocus: true } : {}),
              onPress: () => {
                open('reports')()
                loadReports($)
              },
            }),
            dim('  видишь только ты: ты админ Arcade'),
          ]
        : []),
      // Добровольно, без напоминаний: одна строка внизу меню, ссылка открывается в обычном браузере
      Button({
        key: 'arcade-support',
        label: '☕ Поддержать проект',
        onPress: async () => {
          const url = supportUrl()
          const command = openUrlCommand(S.platform, url)
          if (!command) {
            S.libraryNotice = `Страница поддержки: ${url}`
            $.ui.invalidate('ui.render')
            return
          }
          try {
            const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
            windowNotice($, result?.exitCode === 0 ? 'Открываю страницу поддержки в браузере. Спасибо!' : `Страница поддержки: ${url}`)
          } catch {
            S.libraryNotice = `Страница поддержки: ${url}`
          }
          $.ui.invalidate('ui.render')
        },
      }),
      dim(`  добровольно, на развитие Arcade — ${supportUrl().replace(/^https:\/\//, '')}`),
    ]),
    ...noticeLines,
    ...hint,
    ...(eventLines.length ? [gap, ...eventLines] : []),
  ]
  return { items, headerExtra }
}
