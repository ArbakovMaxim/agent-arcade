// Arcade: экраны YouTube, Twitch и TikTok.
import { keep, tr } from '../i18n.js'
import { clean, videoBlurb, videoMeta, videoStats } from '../youtube.js'
import { TOPIC_TITLES, liveFirst, liveStatus } from '../twitch.js'
import { LAUNCH_TIMEOUT_MS, S } from '../app/state.js'
import { iconSvg } from '../app/icons.js'
import { windowNotice } from '../app/status.js'
import { builtinBrowser, launchNotice, whereText, windowCommand } from '../app/window.js'
import { desktopWindow } from '../app/desktop.js'
import { addChannel, loadTopics, loadTwitch, loadVideos, openTiktok, removeChannel, topicKey, topicOf, twitchNote } from '../app/watch.js'

// Темы: три по работе агента и новинки. Названия, которые придумала модель, — уже на языке интерфейса (keep)
export function youtubeScreen($, e, kit) {
  const { Box, Button, Text, back, desktop, dim, gap, hint, noticeLines, open, ownTopics, tiles } = kit
  const focus = S.menuFrom?.startsWith('youtube:') ? topicKey(S.menuFrom.slice(8)) : 0
  const topicTiles = (S.yt.topics ?? []).flatMap((t, i) => {
    const button = Button({
      key: `arcade-yt-topic-${i}`,
      label: t.title,
      ...(i === focus ? { autoFocus: true } : {}),
      onPress: () => {
        open(`youtube:${i}`)()
        if (S.yt.topic !== i || (!S.yt.videos.length && !S.yt.loading)) loadVideos($, i)
      },
    })
    return [t.fixed ? button : keep(button), dim(t.direction === 'news' ? '  презентации и обзоры обновлений' : '  по теме работы агента')]
  })
  return [
    back,
    gap,
    dim('Темы — по тому, над чем сейчас работает агент; видео — свежие, с проверенных каналов.'),
    gap,
    ...(S.yt.loading === 'topics' || !S.yt.topics
      ? [Text({ children: ['Подбираю темы…'] })]
      : [
          // Названия тем — до 40 знаков: плитки шире обычных, чтобы название чаще влезало в одну строку
          desktop ? tiles(topicTiles, 44) : Box({ flexDirection: 'column', children: topicTiles }),
          gap,
          Button({ key: 'arcade-yt-retopic', label: 'Другие темы', onPress: () => loadTopics($) }),
        ]),
    ...ownTopics('youtube', 'yt', focus, 'Напиши, что хочешь посмотреть, — Arcade найдёт свежие видео по теме.'),
    ...noticeLines,
    ...hint,
  ]
}

export function youtubeTopicScreen($, e, kit) {
  const { Box, Button, Svg, Text, desktop, dim, gap, hint, noticeLines, now, open } = kit
  const topicId = topicKey(S.menu.slice(8))
  const topic = topicOf(topicId)
  const builtin = builtinBrowser(e.surface)
  const playVideo = async (k) => {
    const id = `video:${k}`
    if (builtin) return desktopWindow($, id, 'Видео открыто во встроенном браузере Claude.')
    if (!S.platform) {
      S.libraryNotice = `Видео: https://www.youtube.com/watch?v=${S.yt.videos[k].id}`
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
  // Видео — названия, каналы и описания как есть, без перевода (keep). В Desktop — крупная карточка во всю строку:
  // название, канал с датой и просмотрами, начало описания
  const videoItem = (v, k) => {
    const label = v.title.length > 100 ? `${v.title.slice(0, 99)}…` : v.title
    const button = Button({ key: `arcade-yt-video-${k}`, label, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => playVideo(k) })
    if (!desktop) return keep(Box({ flexDirection: 'column', children: [button, Text({ dimColor: true, children: [`  ${videoMeta(v, S.lang, now)}`] })] }))
    const stats = videoStats(v, S.lang, now)
    const about = videoBlurb(v)
    return keep(
      Box({
        key: `card-yt-video-${k}`,
        flexDirection: 'row',
        alignItems: 'flex-start',
        columnGap: 'md',
        borderStyle: 'round',
        borderColor: 'subtle',
        padding: 'md',
        hover: { borderColor: 'suggestion', backgroundColor: '#8080801a' },
        children: [
          Svg({ source: iconSvg('youtube'), alt: 'YouTube', width: 48, height: 48 }),
          Box({
            flexDirection: 'column',
            rowGap: 'xs',
            flexShrink: 1,
            flexGrow: 1,
            children: [
              button,
              Text({ size: 'footnote', children: [Text({ weight: 'semibold', children: [v.channel] }), ...(stats ? [Text({ dimColor: true, children: [` · ${stats}`] })] : [])] }),
              ...(about ? [Text({ size: 'footnote', dimColor: true, wrap: 'wrap', children: [about] })] : []),
            ],
          }),
        ],
      }),
    )
  }
  return [
    Button({ key: 'arcade-back', label: '← Назад', ...(S.yt.loading ? { autoFocus: true } : {}), onPress: open('youtube') }),
    gap,
    ...(topic ? [topic.fixed ? Text({ bold: true, children: [topic.title] }) : keep(Text({ bold: true, children: [topic.title] }))] : []),
    gap,
    ...(S.yt.loading === 'videos'
      ? [Text({ children: ['Подбираю видео…'] })]
      : S.yt.videos.length
        ? [Box({ flexDirection: 'column', rowGap: desktop ? 'sm' : 0, children: S.yt.videos.map(videoItem) })]
        : []),
    ...(S.yt.note ? [gap, dim(S.yt.note)] : []),
    ...(topic && !S.yt.loading ? [gap, Button({ key: 'arcade-yt-more', label: 'Другая подборка', ...(S.yt.videos.length ? {} : { autoFocus: true }), onPress: () => loadVideos($, topicId, true) })] : []),
    ...(S.yt.videos.length && (builtin || S.platform) ? [gap, dim(`Видео открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)] : []),
    ...noticeLines,
    ...hint,
  ]
}

// TikTok: лента «Для тебя» и поиск TikTok по темам работы агента, своим темам или любому запросу. Смотрят на
// сайте TikTok, вход — человека. Названия тем, которые придумала модель, — уже на языке интерфейса (keep)
export function tiktokScreen($, e, kit) {
  const { Box, Button, Input, Text, back, desktop, dim, gap, hint, noticeLines, section, tiles } = kit
  const builtin = builtinBrowser(e.surface)
  const search = (query) => openTiktok($, e.surface, query)
  const topicTiles = (S.yt.topics ?? []).flatMap((t, i) => {
    const button = Button({ key: `arcade-tt-topic-${i}`, label: t.title, onPress: () => search(t.fixed ? tr(t.title, S.lang) : t.title) })
    return [t.fixed ? button : keep(button), dim(t.direction === 'news' ? '  презентации и обзоры обновлений' : '  по теме работы агента')]
  })
  const ownTiles = S.myTopics.flatMap((t) => [keep(Button({ key: `arcade-tt-own-${t.id}`, label: t.title, onPress: () => search(t.title) })), dim('  своя тема')])
  const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
  return [
    back,
    gap,
    Button({ key: 'arcade-tt-feed', label: 'Лента «Для тебя»', autoFocus: true, onPress: () => search('') }),
    dim('  Войди в TikTok сам — проще всего QR-кодом из приложения на телефоне. Arcade твой вход не видит.'),
    section('Поиск по теме'),
    ...(S.yt.loading === 'topics' || !S.yt.topics ? [Text({ children: ['Подбираю темы…'] })] : [column(topicTiles)]),
    ...(ownTiles.length ? [section('Мои темы'), column(ownTiles)] : []),
    gap,
    Input({
      key: 'arcade-tt-search',
      label: 'Найти в TikTok',
      placeholder: 'что угодно: рецепты, Rust, котики…',
      onSubmit: (value) => {
        const query = clean(value, 100)
        if (query) search(query)
      },
    }),
    ...(builtin || S.platform ? [gap, dim(builtin ? 'TikTok открывается во встроенном браузере Claude.' : 'TikTok открывается в браузере по умолчанию.')] : []),
    ...noticeLines,
    ...hint,
  ]
}

// Twitch: свои каналы, кто из каталога в эфире, весь каталог по направлениям, «Убрать канал». Имена каналов,
// названия эфиров и игр — как на Twitch, без перевода (keep); подпись «в эфире…» переводим здесь
export function twitchScreen($, e, kit) {
  const { Box, Button, Input, Text, back, desktop, dim, gap, hint, noticeLines, open, section, tiles, watchLive } = kit
  let items
  const builtin = builtinBrowser(e.surface)
  const watch = watchLive
  // Плитка канала: имя — кнопкой, под ним — эфир (игра, зрители) и его название
  const channelTile = (key, c, info, missing, focus) => {
    const status = tr(liveStatus(info, missing, S.lang), S.lang)
    const note = [status, info?.live?.title].filter(Boolean).join(' — ')
    return [keep(Button({ key, label: info?.name ?? c.name, ...(focus ? { autoFocus: true } : {}), onPress: () => watch(c.login) })), keep(dim(`  ${note}`))]
  }
  const column = (list) => (desktop ? tiles(list, 44) : Box({ flexDirection: 'column', children: list }))
  const where = builtin || S.platform ? [gap, dim(`Трансляции открываются ${builtin ? 'во встроенном браузере Claude' : whereText()}.`)] : []
  const trouble = S.tw.error ? [gap, dim(twitchNote(S.tw.error))] : []
  const waiting = S.tw.loading && !S.tw.at ? [Text({ children: ['Спрашиваю Twitch, кто в эфире…'] })] : []
  const toList = Button({ key: 'arcade-back', label: '← Назад', onPress: open('twitch') })
  if (S.menu === 'twitch:catalog') {
    // Весь каталог: по направлениям, в каждом — сначала эфиры
    const groups = Object.keys(TOPIC_TITLES)
      .map((t) => [t, S.tw.catalog.filter((c) => c.topics[0] === t)])
      .filter(([, list]) => list.length)
    items = [
      toList,
      gap,
      dim('Каталог Arcade: эфиры о программировании, технике, науке и ретро-играх, по-английски. Каналы 18+ не показываем.'),
      ...waiting,
      ...groups.flatMap(([t, list], g) => [section(TOPIC_TITLES[t]), column(list.flatMap((c, k) => channelTile(`arcade-tw-cat-${c.login}`, c, c, false, g === 0 && k === 0)))]),
      ...trouble,
      ...where,
      ...noticeLines,
      ...hint,
    ]
  } else if (S.menu === 'twitch:remove') {
    items = [
      toList,
      gap,
      dim('Какой канал убрать из «Моих каналов»?'),
      gap,
      ...S.tw.channels.map((c, k) => keep(Button({ key: `arcade-tw-remove-${c.login}`, label: S.tw.info[c.login]?.name ?? c.name, ...(k === 0 ? { autoFocus: true } : {}), onPress: () => removeChannel($, c.login) }))),
      ...(S.tw.note ? [gap, dim(S.tw.note)] : []),
      ...hint,
    ]
  } else {
    const from = S.menuFrom?.startsWith('twitch:') ? S.menuFrom : ''
    const myTiles = liveFirst(S.tw.channels, S.tw.info).flatMap((c, k) => channelTile(`arcade-tw-my-${c.login}`, c, S.tw.info[c.login], S.tw.missing.has(c.login), !from && k === 0))
    const onAir = S.tw.catalog.filter((c) => c.live).slice(0, 8)
    const airTiles = onAir.flatMap((c, k) => channelTile(`arcade-tw-cat-${c.login}`, c, c, false, !from && !myTiles.length && k === 0))
    items = [
      back,
      gap,
      dim('Свои каналы и каталог Arcade. Регистрация не нужна: свои каналы хранятся только у тебя.'),
      section('Мои каналы'),
      ...(myTiles.length ? [column(myTiles)] : [dim('Своих каналов пока нет — добавь любой канал Twitch по имени или ссылке.')]),
      gap,
      Input({ key: 'arcade-twitch-add', label: 'Добавить канал', placeholder: 'имя канала или ссылка twitch.tv/…', onSubmit: (value) => addChannel($, value) }),
      dim(S.tw.note || 'Например, tsoding или https://www.twitch.tv/tsoding'),
      ...(S.tw.channels.length ? [gap, Button({ key: 'arcade-tw-remove', label: 'Убрать канал', ...(from === 'twitch:remove' ? { autoFocus: true } : {}), onPress: open('twitch:remove') })] : []),
      section('Сейчас в эфире'),
      ...(waiting.length ? waiting : airTiles.length ? [column(airTiles)] : S.tw.error ? [] : [dim('Из каталога сейчас никто не в эфире.')]),
      gap,
      Button({ key: 'arcade-tw-catalog', label: 'Весь каталог', ...(from === 'twitch:catalog' ? { autoFocus: true } : {}), onPress: open('twitch:catalog') }),
      Button({ key: 'arcade-tw-refresh', label: S.tw.loading ? 'Обновляю…' : 'Обновить', onPress: () => loadTwitch($, true) }),
      ...trouble,
      ...where,
      ...noticeLines,
      ...hint,
    ]
  }
  return items
}
