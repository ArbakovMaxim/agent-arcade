// Язык интерфейса окна: русский (на нём написан код) или английский.
// Язык — из адреса (lang=en присылает мод), иначе сохранённый выбор, иначе язык браузера.
// Перевод — по словарю и шаблонам; что не переведено, остаётся по-русски. Описания игр из каталога пока русские.
;(function () {
  'use strict'

  // Языки окна: русский — исходный, английский — свой перевод, остальные — поверх английского (locales/*.json,
  // их вставляет сборка в LOCALES ниже). Своего языка у браузера нет — английский
  const LANGS = ['en', 'ru', 'uk', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'tr', 'ja', 'zh', 'ko']
  const NAMES = { en: 'English', ru: 'Русский', uk: 'Українська', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', it: 'Italiano', pl: 'Polski', tr: 'Türkçe', ja: '日本語', zh: '中文', ko: '한국어' }
  const LOCALES = {} /* LOCALES */
  function pick() {
    const fromUrl = new URLSearchParams(location.search).get('lang')
    if (LANGS.includes(fromUrl)) {
      try {
        localStorage.setItem('arcade:lang', fromUrl)
      } catch {
        // без хранилища — язык только на эту страницу
      }
      return fromUrl
    }
    let saved = null
    try {
      saved = localStorage.getItem('arcade:lang')
    } catch {
      // без хранилища
    }
    if (LANGS.includes(saved)) return saved
    const browser = ((typeof navigator !== 'undefined' && navigator.language) || '').toLowerCase()
    const code = browser.slice(0, 2)
    if (code === 'be') return 'ru'
    return LANGS.includes(code) ? code : 'en'
  }

  const EXACT = {
    'Открыть свой файл': 'Open your own file',
    'скоро': 'soon',
    'Здесь пока нет игр.': 'No games here yet.',
    'Мои игры — только в этом браузере': 'My games — only in this browser',
    'Сетевой deathmatch': 'Network deathmatch',
    'Настольные': 'Board games',
    'Шутеры': 'Shooters',
    // жанры книг
    'роман': 'novel',
    'фантастика': 'science fiction',
    'сказки': 'fairy tales',
    'детектив': 'detective',
    'ужасы': 'horror',
    'приключения': 'adventure',
    'повесть': 'novella',
    'эпос': 'epic',
    'басни': 'fables',
    'поэзия': 'poetry',
    'поэма': 'poem',
    'пьеса': 'play',
    'философия': 'philosophy',
    'эссе': 'essay',
    'мемуары': 'memoir',
    'рассказы': 'short stories',
    'ещё не читали': 'not read yet',
    'Книги': 'Books',
    'Оглавление': 'Contents',
    'колёсико или пробел — дальше · оглавление и шрифт — вверху': 'scroll or Space — next · contents and font size — at the top',
    'колёсико или пробел — дальше': 'scroll or Space — next',
    'Своя книга — только в этом браузере': 'Your own book — only in this browser',
    'Своя книга — EPUB, FB2 или TXT — откроется только на этом устройстве и не отправится на сервер. Закладка ставится сама.': 'Your own book — EPUB, FB2 or TXT — opens only on this device and is never sent to the server. The bookmark is set automatically.',
    'Книга должна быть в EPUB, FB2 или TXT.': 'A book must be EPUB, FB2 or TXT.',
    'Файл больше 50 МБ — для книги это слишком много.': 'The file is larger than 50 MB — too much for a book.',
    '☕ Поддержать': '☕ Support',
    'Добровольно, на развитие Arcade': 'Voluntary, for Arcade’s development',
    'Игры': 'Games',
    'Гонки': 'Racing',
    'Стратегии': 'Strategy',
    'Браузерные': 'Browser games',

    'Шахматы': 'Chess',
    'Русские шашки': 'Russian draughts',
    'Реверси': 'Reversi',
    'клик по своей фигуре, потом по клетке': 'click your piece, then a square',
    'чёрные': 'black', 'белые': 'white', 'счёт': 'score', 'шах': 'check',
    'Найти соперника': 'Find an opponent',
    'С компьютером': 'Against the computer',
    'Компьютер думает…': 'The computer is thinking…',
    'Начать заново': 'Start over',
    'Пригласить друга': 'Invite a friend',
    'Мои партии': 'My games',
    'партия': 'game',
    'Ищу соперника…': 'Looking for an opponent…',
    'Ждём соперника — как только кто-то зайдёт, начнёте': 'Waiting for an opponent — you start as soon as someone joins',
    'Соперник нашёлся!': 'Opponent found!',
    'Подключаюсь к партии…': 'Connecting to the game…',
    'Связь с партией прервалась — открой ссылку ещё раз, ходы сохранены': 'Connection lost — open the link again, the moves are saved',
    'Ничья': 'Draw', 'Победа!': 'You won!', 'Поражение': 'You lost',
    'Новая партия': 'New game',
    'Ждём соперника — отправь ему ссылку на эту партию': 'Waiting for an opponent — send them the link to this game',
    'Ты смотришь партию: в ней уже двое': 'You are watching: this game already has two players',
    'Твой ход': 'Your move',
    'Ход соперника — можно вернуться к агенту, партия сохранится': 'Opponent’s move — you can go back to your agent, the game is saved',
    'Пропустить ход': 'Pass',
    'Скопировать ссылку на партию': 'Copy the link to this game',
    'Ссылка на партию': 'Link to this game',
    'Кооператив': 'Co-op',
    'Ждём напарника': 'Waiting for a partner',
    'Как только кто-то зайдёт, начнёте вместе. Позови друга — пусть откроет эту же игру и нажмёт «По сети».': 'As soon as someone joins, you start together. Invite a friend — they open the same game and press “Online”.',
    'По сети': 'Online',
    'Подключаюсь к лобби…': 'Connecting to the lobby…',
    'Ждём второго игрока': 'Waiting for a second player',
    'Как только кто-то зайдёт, начнётся раунд. А пока можно сыграть в Freedoom одному — кнопка «Библиотека».': 'A round starts as soon as someone joins. Meanwhile you can play Freedoom alone — use the “Library” button.',
    'Идёт раунд': 'A round is on',
    'В нём уже четыре игрока. Подожди здесь — следующий начнётся через несколько минут.': 'It already has four players. Wait here — the next one starts in a few minutes.',
    'Раунд начинается': 'The round is starting',
    'Нет связи с лобби': 'No connection to the lobby',
    'Открой окно ещё раз через минуту.': 'Open the window again in a minute.',
    'Ты хозяин раунда': 'You host this round',
    'Подключаюсь к раунду': 'Joining the round',
    'Загружаю движок и карты…': 'Loading the engine and maps…',
    'Свой файл .wad — например, купленный doom.wad — откроется только на этом устройстве и не отправится на сервер.': 'Your own .wad file — for example, a doom.wad you bought — opens only on this device and is never sent to the server.',
    'Для Doom нужен файл .wad — или .zip, где он лежит.': 'Doom needs a .wad file — or a .zip that contains one.',
    'Это не файл Doom: в начале нет метки IWAD или PWAD.': 'This is not a Doom file: it does not start with IWAD or PWAD.',
    'свой файл': 'own file',
    'Удалить из этого браузера': 'Remove from this browser',
    '↑ ↓ — выбрать игру · ← → — приставка · Enter — играть': '↑ ↓ — pick a game · ← → — console · Enter — play',
    'Не удалось открыть файл.': 'Could not open the file.',
    'Свой файл .nes откроется только на этом устройстве и не отправится на сервер.': 'Your .nes file opens only on this device and is never sent to the server.',
    'Свой файл .md или .bin откроется только на этом устройстве и не отправится на сервер.': 'Your .md or .bin file opens only on this device and is never sent to the server.',
    'Свой файл .sms откроется только на этом устройстве и не отправится на сервер.': 'Your .sms file opens only on this device and is never sent to the server.',
    'Свой диск .chd, .pbp, .iso или .zip с .cue и .bin откроется только на этом устройстве. BIOS Sony не нужен.': 'Your .chd, .pbp, .iso disc or a .zip with .cue and .bin opens only on this device. No Sony BIOS needed.',
    'Игра не найдена': 'Game not found',
    'Загружаю игру…': 'Loading the game…',
    'Не удалось загрузить игру': 'Could not load the game',
    'Не удалось открыть ROM': 'Could not open the ROM',
    'Звук: вкл': 'Sound: on',
    'Звук: выкл': 'Sound: off',
    'Пауза': 'Paused',
    'Кликни или нажми любую клавишу, чтобы продолжить': 'Click or press any key to continue',
    'Продолжаем с места остановки — кликни или нажми любую клавишу': 'Picking up where you left off — click or press any key',
    'Кликни или нажми любую клавишу, чтобы начать': 'Click or press any key to start',
    'Не удалось прочитать файл.': 'Could not read the file.',
    'Это не ROM для NES: в файле нет заголовка iNES.': 'This is not a NES ROM: the file has no iNES header.',
    'ROM больше 16 МБ — такой файл не поддерживается.': 'The ROM is larger than 16 MB — such files are not supported.',
    'Свой ROM': 'Own ROM',
    'локальный ROM': 'local ROM',
    'Вернись в библиотеку и выбери игру.': 'Go back to the library and pick a game.',
    'Не получилось': 'Something went wrong',
    'Эта приставка пока не поддерживает свои файлы.': 'This console does not support your own files yet.',
    'свой файл — хранится только в этом браузере': 'your own file — kept only in this browser',
    'Нет связи с Arcade': 'No connection to Arcade',
    'свою игру': 'your game',
    'В этом браузере её нет. Вернись в библиотеку и открой файл заново.': 'It is not in this browser. Go back to the library and open the file again.',
    'Моя игра': 'My game',
    'Файл не выбран.': 'No file selected.',
    'меньше минуты': 'less than a minute',
    'ещё не играли': 'not played yet',
    '← Библиотека': '← Library',
    'лицензия': 'license',
    'исходники': 'source',
    'Сначала': 'Restart',
    // Каталог: приставки, жанры, пустые вкладки
    'Денди': 'NES',
    'платформер': 'platformer',
    'аркада': 'arcade',
    'шутер': 'shooter',
    'головоломка': 'puzzle',
    'приключение': 'adventure',
    'стратегия': 'strategy',
    'экшен': 'action',
    'песочница': 'sandbox',
    'найди пару': 'memory',
    'без спешки': 'relaxed',
    'гонки': 'racing',
    'файтинг': 'fighting',
    'спорт': 'sports',
    'музыка': 'music',
    'арканоид': 'brick breaker',
    'шуточный симулятор': 'comedy sim',
  }

  const dur = (t) => t.replace(/(\d+) ч/g, '$1 h').replace(/(\d+) мин/g, '$1 min').replace(/(\d+) с(?![а-я])/g, '$1 s')
  const KEY_WORDS = [
    ['воздушные тормоза — A и D (или Q и E)', 'air brakes — A and D (or Q and E)'], ['газ', 'throttle'], ['тормоз', 'brake'], ['руль', 'steer'], ['— пробел', '— Space'],
    ['открыть или нажать', 'open or press'], ['открыть', 'open'], ['счёт', 'score'], ['и стрелки', 'and arrows'], ['шаг вбок', 'strafe'], ['оружие', 'weapon'], ['карта', 'map'], ['меню', 'menu'], ['бег', 'run'],
    ['движение', 'move'], ['стрелки', 'arrows'], ['или', 'or'], ['прицел', 'aim'], ['огонь', 'fire'], ['пауза', 'pause'], ['и Start', 'and Start'],
  ]
  const keys = (t) => KEY_WORDS.reduce((s, [ru, en]) => s.split(ru).join(en), t)
  const RULES = [
    [/^Всего сыграно: (.+)$/, (m) => `Played in total: ${tEn(m[1])}`],
  [/^прочитано (\d+)%$/, (m) => `read ${m[1]}%`],
    [/^сыграно (.+)$/, (m) => `played ${tEn(m[1])}`],
    [/^(\d+) мин$/, (m) => `${m[1]} min`],
    [/^(\d+) ч (\d+) мин$/, (m) => `${m[1]} h ${m[2]} min`],
    [/^(\d+) (раз|раза)$/, (m) => `${m[1]} ${m[1] === '1' ? 'time' : 'times'}`],
    [/^([\d.]+) МБ$/, (m) => `${m[1]} MB`],
    [/^движение|^прицел|^Стрелки/, (m) => keys(m.input.replace('Стрелки', 'Arrows'))],
    [/^сервер ответил (\d+)$/, (m) => `the server answered ${m[1]}`],
    [/^Победили (.+)$/, (m) => `${tEn(m[1])} won`],
    [/^В лобби (\d+) — раунд вот-вот начнётся$/, (m) => `${m[1]} in the lobby — the round is about to start`],
    [/^Игроков: (\d+)\. Старт через (\d+) с$/, (m) => `Players: ${m[1]}. Starting in ${m[2]} s`],
    [/^(.+)\. Проверь интернет и открой окно ещё раз\.$/, (m) => `${tEn(m[1])}. Check your connection and open the window again.`],
    [/^файл повреждён: хеш не совпал$/, () => 'the file is damaged: the hash does not match'],
    [/^В этой сборке нет игры «(.+)»\.$/, (m) => `There is no game “${m[1]}” in this build.`],
    [/^(.+)\.$/, (m) => (m[1] === 'эмулятор не распознал файл' ? 'the emulator did not recognize the file.' : m.input)],
    [/^Выбери файл «(.+)»$/, (m) => `Choose the file “${tEn(m[1])}”`],
    [/^Кликни сюда или нажми любую клавишу\. .+$/, () => 'Click here or press any key. It is needed only once: the browser keeps the file, it never goes to the server.'],
    [/^(.+) Кликни, чтобы выбрать другой файл\.$/, (m) => `${tEn(m[1])} Click to choose another file.`],
    [/^Не удалось получить список игр: (.+)$/, (m) => `Could not get the list of games: ${m[1]}`],
    [/^Файл больше 16 МБ — .+$/, () => 'The file is larger than 16 MB — that is not a game for this console.'],
    [/^Это архив\. Распакуй его и выбери сам файл игры: (.+)$/, (m) => `This is an archive. Unpack it and choose the game file itself: ${m[1]}`],
    [/^Это не игра для (.+?): (.+)$/, (m) => `This is not a ${m[1] === 'Денди' ? 'NES' : m[1]} game: ${m[2].replace('в файле нет заголовка iNES.', 'the file has no iNES header.').replace('в заголовке нет метки SEGA.', 'the header has no SEGA mark.').replace(/нет метки TMR SEGA и расширение не (\.\w+)\./, 'no TMR SEGA mark and the extension is not $1.')}`],
    [/^Это другой файл: .+$/, () => 'This is a different file: it does not match the one added in the mod.'],
    [/^Для PlayStation нужен образ диска: .+$/, () => 'PlayStation needs a disc image: .chd, .pbp, .iso or a .zip with .cue and .bin inside.'],
    // «Свободных игр для X пока нет. Открой свой файл .ext (или диск) — кнопка «Открыть свой файл» сверху. BIOS Sony не нужен.»
  [/^Свободных игр для (.+) пока нет\. (.+)$/, (m) => `No free ${m[1]} games yet. ${m[2]
    .replace(/Открой свой (файл|диск) ?(\S+)? — кнопка «Открыть свой файл» сверху\./, (_, kind, ext) => `Open your own ${kind === 'диск' ? 'disc' : 'file'}${ext ? ` ${ext}` : ''} with the “Open your own file” button above.`)
    .replace('BIOS Sony не нужен.', 'No Sony BIOS needed.')}`],
    [/графика/, (m) => m.input.split('графика').join('graphics').split('порт — ').join('port by ')],
  ]

  // Остальные языки: английская строка → перевод (точный, по шаблону с {0}, формы числа — Intl.PluralRules)
  let compiled = null
  function templates() {
    if (compiled) return compiled
    compiled = Object.entries((LOCALES[lang] && LOCALES[lang].templates) || {})
      .filter(([, out]) => typeof out === 'string' && out)
      .map(([key, out]) => ({
        re: new RegExp(`^${key.split(/(\{\d+\})/).map((p) => (/^\{\d+\}$/.test(p) ? '(.+?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('')}$`),
        out,
        order: [...key.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])),
        weight: key.replace(/\{\d+\}/g, '').length,
      }))
      .sort((a, b) => b.weight - a.weight)
    return compiled
  }
  function plural(n, forms) {
    const map = Object.fromEntries(forms.split(';').map((p) => [p.slice(0, p.indexOf('=')).trim(), p.slice(p.indexOf('=') + 1)]))
    return (map[new Intl.PluralRules(lang).select(Number(String(n).replace(/\D/g, '')) || 0)] ?? map.other ?? '').replace(/#/g, n)
  }
  function fromEnglish(en) {
    const L = LOCALES[lang]
    if (!L || typeof en !== 'string' || !en.trim()) return en
    const lead = en.match(/^\s*/)[0]
    const trail = en.match(/\s*$/)[0]
    const core = en.trim()
    if (L.exact && L.exact[core]) return lead + L.exact[core] + trail
    for (const tp of templates()) {
      const m = core.match(tp.re)
      if (!m) continue
      const values = {}
      tp.order.forEach((idx, k) => {
        values[idx] = m[k + 1]
      })
      return lead + tp.out.replace(/\{(\d+)(?:#([^}]*))?\}/g, (_, idx, forms) => (forms ? plural(values[idx], forms) : fromEnglish(values[idx]))) + trail
    }
    let out = core
    for (const [a, b] of L.words || []) out = out.split(a).join(b)
    return lead + out + trail
  }

  function t(text) {
    if (lang === 'ru' || typeof text !== 'string') return text
    const en = tEn(text)
    return lang === 'en' ? en : fromEnglish(en)
  }
  function tEn(text) {
    if (!/[А-Яа-яЁё]/.test(text)) return text
    if (EXACT[text] !== undefined) return EXACT[text]
    for (const [re, make] of RULES) {
      const m = text.match(re)
      if (m) {
        const out = make(m)
        if (out !== text) return out
      }
    }
    return text
  }

  // Переключить язык: запоминаем и открываем страницу заново
  function set(next) {
    try {
      localStorage.setItem('arcade:lang', next)
    } catch {}
    const params = new URLSearchParams(location.search)
    params.delete('lang')
    const search = params.toString()
    location.search = search ? `?${search}` : '?'
  }

  const lang = pick()
  window.ArcadeI18n = { lang, t, set, LANGS, NAMES }
  window.T = t
})()
