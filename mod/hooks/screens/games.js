// Arcade: экраны игр — поиск, избранное, свои игры, группы и полки.
import { keep, tr } from '../i18n.js'
import { liveStatus } from '../twitch.js'
import { FIND_LIMIT, MIN_QUERY, find } from '../find.js'
import { FIELD, LAUNCH_TIMEOUT_MS, S, finder } from '../app/state.js'
import { addMine, consoles, favoriteGames, favoritesScope, gameById, games, genreLabel, groupConsoles, groupsList, mineFile, shelfGames, shelfView, shelvesList, tabOf } from '../app/library.js'
import { plural, windowNotice } from '../app/status.js'
import { MOUSE_NOTE, builtinBrowser, launchNotice, mouseGame, opensWindow, whereText, windowCommand } from '../app/window.js'
import { desktopWindow } from '../app/desktop.js'

// Поиск: игры — разделами по жанрам, за ними каналы Twitch. От двух букв, без регистра и диакритики: ищется в
// названии (и в его переводе), жанре и разделе. Книги ищутся в «Книгах»: их список — на сайте
export function searchScreen($, e, kit) {
  const { Box, Button, Input, back, byGenre, desktop, dim, gap, hint, noticeLines, section, tiles, watchLive } = kit
  if (!finder.shown) {
    finder.seed = finder.query
    finder.field++
    finder.shown = true
  }
  const query = finder.query.trim()
  const ready = query.length >= MIN_QUERY
  const pool = games().filter((g) => !g.mine && g.console && g.id !== FIELD.id)
  const found = ready
    ? find(pool, query, (g) => {
        const tab = tabOf(g)
        return [g.title, tr(g.title, S.lang), g.genre && genreLabel(g.genre), g.genre, tab && tab.title, tab && tr(tab.title, S.lang)]
      })
    : []
  const channels = [...S.tw.channels, ...S.tw.catalog.filter((c) => !S.tw.channels.some((x) => x.login === c.login))]
  const live = ready ? find(channels, query, (c) => [S.tw.info[c.login]?.name ?? c.name, c.login]) : []
  const shown = found.slice(0, FIND_LIMIT)
  // Канал: имя — кнопкой, ниже — в эфире ли он. Имена — как на Twitch, без перевода
  const liveTiles = live.flatMap((c) => {
    const info = S.tw.info[c.login] ?? (S.tw.catalog.includes(c) ? c : null)
    const status = tr(liveStatus(info, S.tw.missing.has(c.login), S.lang) || 'канал Twitch', S.lang)
    return [keep(Button({ key: `arcade-tw-find-${c.login}`, label: info?.name ?? c.name, onPress: () => watchLive(c.login) })), keep(dim(`  ${status}`))]
  })
  const set = (value) => {
    finder.query = value
    $.ui.invalidate('ui.render')
  }
  return [
    back,
    gap,
    Input({ key: `arcade-search-${finder.field}`, label: 'Найти', placeholder: 'название или жанр', value: finder.seed, autoFocus: true, onInput: set, onSubmit: set }),
    dim(
      !ready
        ? 'От двух букв: название или жанр. Ищу в играх и каналах Twitch.'
        : found.length || live.length
          ? `найдено: ${found.length + live.length}`
          : 'Ничего не нашлось — попробуй другое слово.',
    ),
    ...byGenre(shown, null),
    ...(found.length > shown.length ? [gap, dim(`Показаны первые ${FIND_LIMIT} — уточни запрос.`)] : []),
    ...(liveTiles.length ? [section('Twitch'), desktop ? tiles(liveTiles, 44) : Box({ flexDirection: 'column', children: liveTiles })] : []),
    ...noticeLines,
    ...hint,
  ]
}

// Избранное: всё отмеченное ☆ или только в группе («Игры») и на полке книг. Сначала — отмеченное последним
export function favoritesScreen($, e, kit) {
  const { Button, back, byGenre, dim, gap, hint, noticeLines, open } = kit
  const scopeId = S.menu.slice(10)
  const scope = favoritesScope(scopeId)
  const list = favoriteGames()
    .filter((g) => !scope || scope.has(g))
    .reverse()
  const focusId = list.some((g) => g.id === S.lastGame) ? S.lastGame : list[0]?.id
  return [
    scope ? Button({ key: 'arcade-back', label: '← Назад', onPress: open(scopeId) }) : back,
    gap,
    ...(list.length ? byGenre(list, focusId) : [dim('Пока пусто. Отмечай звёздочкой ☆ игры — они соберутся здесь.')]),
    ...noticeLines,
    ...hint,
  ]
}

// Свои игры: файлы человека. Arcade их не раздаёт — копия лежит только у него, в ~/.claude/arcade
export function mineScreen($, e, kit) {
  const { Box, Button, Input, Text, back, dim, gameButton, gap, hint, noticeLines } = kit
  const remove = (m) =>
    Button({
      key: `arcade-mine-remove-${m.id}`,
      label: 'Удалить',
      onPress: async () => {
        S.mine = S.mine.filter((x) => x.id !== m.id)
        await $.store.set('mine', S.mine)
        await $.fs.write(mineFile(m.sha256), '').catch(() => {}) // удалять файлы мод не умеет — стираем содержимое
        S.libraryNotice = `Удалено: ${m.title}.`
        $.ui.invalidate('ui.render')
      },
    })
  return [
    back,
    gap,
    ...(S.mine.length
      ? S.mine.flatMap((m, i) => {
          const g = gameById(m.id)
          return [Box({ flexDirection: 'row', columnGap: 2, children: [gameButton(g, i === 0), remove(m)] }), dim(`  ${g.note}`)]
        })
      : [Text({ children: ['Пока пусто. Добавь файл игры для Денди (.nes) или Sega Mega Drive (.md, .bin).'] })]),
    gap,
    Input({
      key: 'arcade-mine-path',
      label: 'Добавить файл',
      placeholder: 'путь к .nes, .md или .bin',
      onSubmit: async (value) => {
        S.libraryNotice = await addMine($, value)
        $.ui.invalidate('ui.render')
      },
    }),
    dim('  или командой /arcade-add путь — в терминал файл можно просто перетащить после команды'),
    dim('  Файл остаётся у тебя: мод хранит копию в ~/.claude/arcade и никуда её не отправляет.'),
    dim('  Подключай только файлы, на которые у тебя есть права.'),
    ...noticeLines,
    ...hint,
  ]
}

// Вкладка группы («Игры»): полки с играми
export function groupScreen($, e, kit) {
  const { Button, back, desktop, dim, gap, hint, noticeLines, open, tiles } = kit
  const group = groupsList().find((x) => x.id === S.menu)
  const shelvesHere = shelvesList().filter((s) => shelfGames(s.id).some((g) => groupConsoles(group.id).includes(g.console)))
  const favHere = favoriteGames().filter((g) => groupConsoles(group.id).includes(g.console)).length
  const shelfItems = [
    Button({ key: `arcade-menu-favorites-${group.id}`, label: '★ Избранное', ...(S.menuFrom === `favorites:${group.id}` ? { autoFocus: true } : {}), onPress: open(`favorites:${group.id}`) }),
    dim(favHere ? `  отмечено: ${favHere}` : '  отмечай ☆ — соберётся здесь'),
    ...shelvesHere.flatMap((s, i) => {
    const n = shelfGames(s.id).length
    return [
      Button({ key: `arcade-menu-shelf-${s.id}`, label: s.title, ...((S.menuFrom ? S.menuFrom === `shelf:${s.id}` : i === 0) ? { autoFocus: true } : {}), onPress: open(`shelf:${s.id}`) }),
      dim(`  ${n} ${plural(n, 'игра', 'игры', 'игр')}`),
    ]
  }),
  ]
  // В Desktop полки — плитками с иконкой жанра, как разделы главного меню
  return [
    back,
    gap,
    ...(desktop ? [tiles(shelfItems)] : shelfItems),
    ...noticeLines,
    ...hint,
  ]
}

export function shelfScreen($, e, kit) {
  const { Button, Text, back, dim, gameRows, gap, hint, noticeLines, open } = kit
  const shelf = shelfView(S.menu)
  const c = shelf ?? consoles().find((x) => x.id === S.menu) ?? consoles()[0]
  const list = shelf ? shelf.list : games().filter((g) => g.console === c.id && !g.mine)
  const focusId = list.some((g) => g.id === S.lastGame) ? S.lastGame : list[0]?.id
  const builtin = builtinBrowser(e.surface, list.some((g) => mouseGame(g.id)))
  const own = c.id === 'nes' || (list.length > 0 && list.every((g) => g.engine)) // Денди и свои игры (Flappy Arcade) — в панели
  return [
    shelf ? Button({ key: 'arcade-back', label: '← Назад', onPress: open(shelf.group) }) : back,
    gap,
    ...(list.length
      ? gameRows(list, focusId)
      : [Text({ children: [c.empty ?? c.soon ?? 'Здесь пока нет игр.'] })]),
    // Всё, кроме Денди и своих игр (Flappy Arcade), идёт только в окне браузера: там и свои файлы — кнопкой «Открыть свой файл»
    ...(!own
      ? S.platform || e.surface === 'desktop'
        ? [
            gap,
            Button({
              key: `arcade-open-tab-${shelf ? shelf.id.replace('shelf:', 'shelf-') : c.id}`,
              label: `Открыть ${c.title} в окне`,
              ...(!list.length ? { autoFocus: true } : {}),
              onPress: async () => {
                if (builtin) return desktopWindow($, `tab:${shelf ? shelf.tab : c.id}`, `Окно Arcade открыто на вкладке ${c.title}.`)
                const command = windowCommand(`tab:${shelf ? shelf.tab : c.id}`)
                try {
                  const result = await $.process.run(command.argv, { env: command.env, timeoutMs: LAUNCH_TIMEOUT_MS })
                  windowNotice($, result?.exitCode === 0 ? `Окно Arcade открыто на вкладке ${c.title}.` : launchNotice(result, null))
                  if (result?.exitCode === 0) S.windowOpenedAt = await $.clock.now()
                } catch (err) {
                  S.libraryNotice = `Не получилось открыть окно: ${err?.message ?? err}`
                }
                $.ui.invalidate('ui.render')
              },
            }),
          ]
        : [gap, dim(`${c.title} идёт в окне браузера, а здесь его открыть нельзя.`)]
      : []),
    ...(list.length
      ? [gap, dim(`Игры открываются ${builtin && !own ? 'во встроенном браузере Claude' : opensWindow(e.surface) || (e.surface === 'desktop' && !own) ? whereText() : 'здесь, в панели'}.`)]
      : []),
    // Шутеры в Desktop идут окном и при выбранном встроенном браузере — объясняем почему
    ...(list.length && !builtin && builtinBrowser(e.surface)
      ? [dim(MOUSE_NOTE)]
      : []),
    ...noticeLines,
    ...hint,
  ]
}
