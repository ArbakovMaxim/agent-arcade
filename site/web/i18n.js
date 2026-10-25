// Язык интерфейса окна: русский (на нём написан код) или английский.
// Язык — из адреса (lang=en присылает мод), иначе сохранённый выбор, иначе язык браузера.
// Перевод — по словарю и шаблонам; что не переведено, остаётся по-русски. Описания игр: русское, английское (about_en)
// или перевод с английского (about_i18n — его кладёт в каталог сборка из locales/*.json).
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
    'приключенческий роман': 'adventure novel',
    'ещё не читали': 'not read yet',
    'Все': 'All',
    'градостроитель': 'city builder',
    'мышь — строить · инструменты — на панели слева': 'mouse — build · tools — on the left panel',
    'мышь — выбирать и отдавать приказы · стрелки — камера · колёсико — масштаб': 'mouse — select and give orders · arrows — camera · wheel — zoom',
    'мышь — прицел · огонь — левая кнопка · ходьба — WASD · прыжок — пробел · присесть — C · оружие — колёсико или 1–9 · счёт — Tab · меню — Esc': 'mouse — aim · fire — left button · move — WASD · jump — Space · crouch — C · weapon — wheel or 1–9 · score — Tab · menu — Esc',
    'Квесты': 'Adventures',
    'квест': 'adventure',
    'мышь — ходить, смотреть, брать · F5 — меню и сохранение': 'mouse — walk, look, take · F5 — menu and saving',
    // аудиокниги
    'Аудиокниги': 'Audiobooks',
    'Мои аудиокниги': 'My audiobooks',
    // открытая библиотека: разделы, поиск, списки; читалка и проигрыватель книг оттуда
    'Мои книги': 'My books',
    'Популярное': 'Popular',
    'Проза': 'Fiction',
    'Стихи': 'Poetry',
    'Пьесы': 'Drama',
    'Приключения': 'Adventure',
    'Детективы': 'Detective stories',
    'О любви': 'Love stories',
    'Фантастика': 'Science fiction',
    'Сказки': 'Fairy tales',
    'Детям': 'For children',
    'Рассказы': 'Short stories',
    'Ужасы': 'Horror',
    'Юмор': 'Humor',
    'История': 'History',
    'Биографии': 'Biographies',
    'Философия': 'Philosophy',
    'Религия': 'Religion',
    'Наука': 'Science',
    'Путешествия': 'Travel',
    'Викитека': 'Wikisource',
    'Язык книг': 'Book language',
    'Название или автор': 'Title or author',
    'Найти книгу': 'Find a book',
    'Найти': 'Find',
    'Поиск': 'Search',
    'Загружаю…': 'Loading…',
    'Загружаю список…': 'Loading the list…',
    'Ищу…': 'Searching…',
    'Ещё': 'More',
    'Ещё раз': 'Try again',
    'нет связи': 'no connection',
    'Ничего не нашлось. Попробуй другое название или автора.': 'Nothing found. Try another title or author.',
    'В этом разделе на этом языке пока пусто. Попробуй поиск или другой язык книг.': 'This section is empty in this language for now. Try the search or another book language.',
    'Ничего не нашлось. Попробуй другое название или автора — у LibriVox они часто записаны латиницей.': 'Nothing found. Try another title or author — LibriVox usually spells them in Latin letters.',
    'Здесь пока пусто: открой книгу из раздела или найди её — она останется в этом браузере. Свой файл EPUB, FB2 или TXT — кнопка «Открыть свой файл».': 'Nothing here yet: open a book from a section or find one — it stays in this browser. For your own EPUB, FB2 or TXT file, use the “Open your own file” button.',
    'Здесь пока пусто: скачай аудиокнигу из раздела или открой свои файлы — они останутся в этом браузере.': 'Nothing here yet: download an audiobook from a section or open your own files — they stay in this browser.',
    'Книги — из Project Gutenberg и Викитеки, общественное достояние. Открытая книга остаётся в «Моих книгах» этого браузера; свой EPUB, FB2 или TXT — тоже, на сервер он не уходит.': 'Books come from Project Gutenberg and Wikisource and are in the public domain. A book you open stays in “My books” in this browser; so does your own EPUB, FB2 or TXT, and it never goes to the server.',
    'Аудиокниги — из LibriVox, общественное достояние: слушай сразу или скачай в этот браузер. Свои MP3, M4A, M4B и OGG тоже остаются только здесь.': 'Audiobooks come from LibriVox and are in the public domain: listen right away or download them to this browser. Your own MP3, M4A, M4B and OGG files also stay only here.',
    '↑ ↓ — выбрать книгу · ← → — вкладка · Enter — открыть': '↑ ↓ — choose a book · ← → — tab · Enter — open',
    'Пока агент работает — сыграй': 'Play while the agent works',
    'Скачиваю книгу…': 'Downloading the book…',
    'Такой книги нет.': 'There is no such book.',
    '← К книгам': '← Back to books',
    'Этой книги в Project Gutenberg нет.': 'Project Gutenberg does not have this book.',
    'Такой страницы в Викитеке нет.': 'Wikisource has no such page.',
    'В Викитеке у этой книги только список изданий — открой другое из поиска.': 'Wikisource only has a list of editions for this book — open another one from the search.',
    'в книге не нашлось ни одной главы с текстом': 'the book has no chapter with text',
    'Не удалось загрузить проигрыватель.': 'Could not load the player.',
    'Загружаю главы…': 'Loading the chapters…',
    'В этой записи нет глав в MP3.': 'This recording has no MP3 chapters.',
    '← К аудиокнигам': '← Back to audiobooks',
    'Скачать в этот браузер': 'Download to this browser',
    'Скачано: книга играет и без интернета — она в «Моих аудиокнигах»': 'Downloaded: the book plays without the internet too — it is in “My audiobooks”',
    // названия своих игр и подборок (названия чужих игр и книг не переводятся)
    'Классические квесты': 'Classic adventures',
    'FreeDM — сетевой deathmatch': 'FreeDM — network deathmatch',
    'BlasphDM — сетевой deathmatch': 'BlasphDM — network deathmatch',
    'Аудиокниги по языкам, внутри — по жанрам; и свои файлы': 'Audiobooks by language and genre; and your own files',
    'свои файлы': 'your files',
    'аудиокнига': 'audiobook',
    'читает': 'read by',
    'разные чтецы': 'various readers',
    '−30 с': '−30 s',
    '+30 с': '+30 s',
    '▶ Слушать': '▶ Listen',
    '⏸ Пауза': '⏸ Pause',
    'Скорость': 'Speed',
    'Книга дослушана': 'The book is finished',
    'Слушать': 'Listen',
    'Удалить': 'Delete',
    'Открыть свои файлы': 'Open your files',
    'Своих аудиокниг пока нет': 'No audiobooks of your own yet',
    'файл': 'file',
    'файлов': 'files',
    'ещё не слушали': 'not listened yet',
    'свои файлы — только в этом браузере': 'your files — in this browser only',
    '← Мои аудиокниги': '← My audiobooks',
    'пробел — пауза · ← → — на 10 секунд': 'Space — pause · ← → — 10 seconds',
    'Свои MP3, M4A, M4B, OGG или Opus — файлы хранятся только в этом браузере.': 'Your own MP3, M4A, M4B, OGG or Opus — the files stay in this browser only.',
    'Свои MP3, M4A, M4B, OGG или Opus: можно выбрать сразу все файлы глав — они встанут по порядку имён. Файлы хранятся только в этом браузере и никуда не отправляются.': 'Your own MP3, M4A, M4B, OGG or Opus: pick all chapter files at once — they line up by file name. The files stay in this browser and are never uploaded.',
    'Файлы этой книги хранятся только в этом браузере и никуда не отправляются': 'The files of this book stay in this browser and are never uploaded',
    'Это не аудиофайлы: подойдут MP3, M4A, M4B, OGG, Opus': 'These are not audio files: MP3, M4A, M4B, OGG or Opus will do',
    'Этой аудиокниги в браузере больше нет — открой свои файлы ещё раз': 'This audiobook is no longer in the browser — open your files again',
    'Браузер не смог открыть этот файл — попробуй MP3': 'The browser could not open this file — try MP3',
    'Не получилось загрузить главу — проверь интернет и нажми «Слушать» ещё раз': 'Could not load the chapter — check the internet and press Listen again',
    'Нажми «Слушать» ещё раз — браузер не дал начать без нажатия': 'Press Listen again — the browser needs a click to start',
    // шахматы по сети и го
    'Го': 'Go',
    'С другом': 'With a friend',
    'Партия': 'Game',
    'Доска': 'Board',
    'Контроль времени — каждому': 'Time control — for each player',
    'Найти игрока': 'Find a player',
    'Соперник': 'Opponent',
    'Соперник сдался — победа!': 'Your opponent resigned — you win!',
    'Партия окончена: время вышло': 'Game over: time ran out',
    'Партия окончена: сдались': 'Game over: resignation',
    'Мат': 'Checkmate',
    'чёрные (ходят первыми)': 'black (moves first)',
    'Пас': 'Pass',
    'Взято камней': 'Captured stones',
    'последний ход — пас': 'last move — pass',
    'Чёрные': 'Black',
    'с коми': 'komi',
    'клик по пересечению · «Пас» — кнопкой': 'click an intersection · Pass — with the button',
    // шахматы с компьютером
    'с компьютером': 'vs computer',
    'Сила компьютера': 'Computer strength',
    'Цвет': 'Colour',
    'Таймер на партию': 'Game timer',
    'без таймера': 'no timer',
    'свой': 'custom',
    'мин': 'min',
    'Начать партию': 'Start game',
    'случайно': 'random',
    '← Шахматы по сети и с другом': '← Chess online and with a friend',
    'ошибается, как новичок': 'makes beginner mistakes',
    'играет как любитель': 'plays like a club player',
    'сильный соперник': 'a strong opponent',
    'играет сильнее почти любого человека': 'stronger than almost any human',
    'ходов пока нет': 'no moves yet',
    'Показать все': 'Show all',
    'Скрыть': 'Hide',
    'Ты': 'You',
    'Вернуть ход': 'Take back',
    'Подсказка': 'Hint',
    'Сдаться': 'Resign',
    'Перевернуть доску': 'Flip board',
    'Скопировать партию (PGN)': 'Copy game (PGN)',
    'Партия скопирована в PGN': 'Game copied as PGN',
    'Время вышло — поражение': 'Time is up — you lose',
    'У компьютера вышло время — победа!': 'The computer ran out of time — you win!',
    'Мат — поражение': 'Checkmate — you lose',
    'Мат — победа!': 'Checkmate — you win!',
    'Ты сдался — поражение': 'You resigned — you lose',
    'Аркады': 'Arcade games',
    'Flappy Arcade — своя игра Arcade': 'Flappy Arcade — an original Arcade game',
    'Нажми пробел, ↑ или кликни — взлететь': 'Press Space, ↑ or click to take off',
    'взмах — пробел, ↑, W или клик': 'flap — Space, ↑, W or click',
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
    'Этот браузер не даёт игре захватить мышь — поворачивай стрелками. С мышью игра идёт в обычном окне браузера.': "This browser doesn't let the game capture the mouse — turn with the arrow keys. With the mouse, the game runs in a regular browser window.",
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
    // просмотр подборки YouTube
    'Открыть на YouTube': 'Open on YouTube',
    'В адресе нет видео. Подборку делает мод Arcade: /arcade → YouTube.': 'There are no videos in the address. The Arcade mod makes the picks: /arcade → YouTube.',
    'Видео удалено или скрыто.': 'The video has been removed or hidden.',
    'Автор не разрешил смотреть это видео на других сайтах — открой его на YouTube.': "The author doesn't allow watching this video on other sites — open it on YouTube.",
    'Видео здесь не играет — открой его на YouTube.': "The video doesn't play here — open it on YouTube.",
    'Условия использования': 'Terms of Use',
    'Конфиденциальность': 'Privacy Policy',
    // каналы Twitch из мода
    'Открыть на Twitch': 'Open on Twitch',
    'В адресе нет каналов. Каналы выбирает мод Arcade: /arcade → Twitch.': 'There are no channels in the address. The Arcade mod picks the channels: /arcade → Twitch.',
    'В эфире': 'Live',
    'Не в эфире': 'Offline',
    'Такого канала нет на Twitch': 'There is no such channel on Twitch',
    // статьи и подкасты из мода
    'Статьи': 'Articles',
    'Подкасты': 'Podcasts',
    'Открываю статью…': 'Opening the article…',
    'В адресе нет статьи. Подборку делает мод Arcade: /arcade → Статьи.': 'There is no article in the address. The Arcade mod makes the picks: /arcade → Articles.',
    'Не получилось проверить ссылку — сайт Arcade не ответил. Попробуй ещё раз.': "Could not check the link — the Arcade site didn't respond. Try again.",
    'Эта ссылка не из лент Arcade — не открываю её.': "This link isn't from the Arcade feeds — not opening it.",
    'В адресе нет выпуска. Подборку делает мод Arcade: /arcade → Подкасты.': 'There is no episode in the address. The Arcade mod makes the picks: /arcade → Podcasts.',
    'Не получилось проверить подкаст — сайт Arcade не ответил. Попробуй ещё раз.': "Could not check the podcast — the Arcade site didn't respond. Try again.",
    'Этого подкаста нет в лентах Arcade — не включаю выпуск.': "This podcast isn't in the Arcade feeds — not playing the episode.",
    'Страница выпуска': 'Episode page',
    'Страница подкаста': 'Podcast page',
    'Выпуск дослушан': 'The episode is finished',
    'Не получилось загрузить выпуск — проверь интернет и нажми «Слушать» ещё раз': 'Could not load the episode — check the internet and press Listen again',
    // чаты с друзьями; {0} и {1} — @ники и названия групп, их страница подставляет сама
    'Чаты': 'Chats',
    '← Чаты': '← Chats',
    'Новый чат': 'New chat',
    'Чаты открываются из Arcade: /arcade → Чаты — мод откроет эту страницу уже со входом.': 'Chats open from Arcade: /arcade → Chats — the mod opens this page already signed in.',
    'Вход на этой странице устарел. Открой чаты снова из Arcade: /arcade → Чаты.': 'The sign-in on this page has expired. Open the chats again from Arcade: /arcade → Chats.',
    'Новые сообщения приходят сразу': 'New messages arrive right away',
    'Новые сообщения — раз в 10 секунд': 'New messages — every 10 seconds',
    'Чатов пока нет. Нажми «Новый чат» и выбери друга.': 'No chats yet. Press “New chat” and pick a friend.',
    'Выбери чат слева или начни новый.': 'Pick a chat on the left or start a new one.',
    'Здесь пока пусто — напиши первым.': "It's empty here so far — write first.",
    'Раньше': 'Earlier',
    'Сегодня': 'Today',
    'Вчера': 'Yesterday',
    'Сообщение': 'Message',
    'Отправить': 'Send',
    'Переписка не шифруется — не пиши сюда пароли и ключи.': 'Messages are not encrypted — never write passwords or keys here.',
    'Группа': 'Group',
    'участники: {0}': 'members: {0}',
    'участники: {0}, в сети: {1}': 'members: {0}, online: {1}',
    'в сети': 'online',
    'Доставлено': 'Delivered',
    'Участники': 'Members',
    'удалённый аккаунт': 'deleted account',
    '{0} создал(а) группу «{1}»': '{0} created the group “{1}”',
    '{0} добавил(а) {1}': '{0} added {1}',
    '{0} убрал(а) {1}': '{0} removed {1}',
    '{0} вышел(а) из группы': '{0} left the group',
    '{0} назвал(а) группу «{1}»': '{0} renamed the group to “{1}”',
    '{0} сменил(а) картинку группы': '{0} changed the group picture',
    '{0} убрал(а) картинку группы': '{0} removed the group picture',
    'Картинка группы': 'Group picture',
    'Без картинки': 'No picture',
    'Загружаю друзей…': 'Loading friends…',
    'Друзей пока нет — добавь их в Arcade: /arcade → Друзья.': 'No friends yet — add them in Arcade: /arcade → Friends.',
    'Позвать в группу: {0}': 'Invite to the group: {0}',
    'Написать': 'Write',
    'Название группы': 'Group name',
    'Группа: отметь друзей, назови её и нажми «Создать группу».': 'Group: tick friends, name it and press “Create group”.',
    'Создать группу': 'Create group',
    'Группа со всеми друзьями': 'Group with all friends',
    'Все друзья': 'All friends',
    'Закрыть': 'Close',
    'Отметь хотя бы одного друга.': 'Tick at least one friend.',
    'Переименовать': 'Rename',
    'управляет группой': 'runs the group',
    'Убрать': 'Remove',
    'Добавить друзей': 'Add friends',
    'Добавить': 'Add',
    'Выйти из группы': 'Leave the group',
    'Точно выйти? Нажми ещё раз': 'Really leave? Press again',
    'Слишком часто — подожди минуту.': 'Too often — wait a minute.',
    'Писать можно только друзьям.': 'You can only write to friends.',
    'Этого чата больше нет.': 'This chat no longer exists.',
    'Сообщение длиннее 2000 знаков.': 'The message is longer than 2000 characters.',
    'Назови группу.': 'Name the group.',
    'Сначала возьми свой @ник в Arcade: /arcade → Друзья.': 'First take your @handle in Arcade: /arcade → Friends.',
    'В группе может быть не больше 50 человек.': 'A group can have at most 50 people.',
    'Это может только тот, кто управляет группой.': 'Only the person who runs the group can do this.',
    'Чаты на сайте сейчас выключены.': 'Chats on the site are turned off right now.',
    'Сайт Arcade не ответил — попробуй ещё раз.': "The Arcade site didn't respond — try again.",
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
  [/^(\d+) мин$/, (m) => `${m[1]} min`],
  [/^сила (\d+)$/, (m) => `level ${m[1]}`],
  [/^ждут: (\d+)$/, (m) => `waiting: ${m[1]}`],
  [/^зрители: (.+)$/, (m) => `viewers: ${m[1]}`],
  [/^прослушано (\d+)%$/, (m) => `listened ${m[1]}%`],
  // открытая библиотека
  [/^Список не загрузился: (.+)$/, (m) => `The list did not load: ${tEn(m[1])}`],
  [/^Собираю книгу: глава (\d+) из (\d+)$/, (m) => `Putting the book together: chapter ${m[1]} of ${m[2]}`],
  [/^Не получилось открыть книгу: (.+)$/, (m) => `Could not open the book: ${tEn(m[1])}`],
  [/^Не получилось открыть аудиокнигу: (.+)$/, (m) => `Could not open the audiobook: ${tEn(m[1])}`],
  [/^Скачать в этот браузер · (.+)$/, (m) => `Download to this browser · ${tEn(m[1])}`],
  [/^Скачиваю главу (\d+) из (\d+)$/, (m) => `Downloading chapter ${m[1]} of ${m[2]}`],
  [/^Не получилось скачать: (.+)$/, (m) => `Could not download: ${tEn(m[1])}`],
  [/^Компьютер · сила (\d+)$/, (m) => `Computer · level ${m[1]}`],
  // Flappy Arcade
  [/^Удар! Счёт: (\d+) · рекорд: (\d+) — ещё раз: пробел$/, (m) => `Crash! Score: ${m[1]} · best: ${m[2]} — Space to try again`],
  [/^Счёт: (\d+) · рекорд: (\d+)$/, (m) => `Score: ${m[1]} · best: ${m[2]}`],
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
  // Описание игры из каталога: по-русски, по-английски или перевод с английского; перевода нет — английское
  function about(game) {
    if (!game) return ''
    if (lang === 'ru' || !game.about_en) return game.about || ''
    return (lang !== 'en' && game.about_i18n && game.about_i18n[lang]) || game.about_en
  }
  // Название игры: русские названия своих игр («Шахматы», «Мои аудиокниги») — по словарю; книги и аудиокниги — как есть
  function title(game) {
    if (!game || typeof game.title !== 'string') return ''
    return /[А-Яа-яЁё]/.test(game.title) && !['book', 'audio'].includes(game.kind) ? t(game.title) : game.title
  }

  window.ArcadeI18n = { lang, t, set, about, title, LANGS, NAMES }
  window.T = t
})()
