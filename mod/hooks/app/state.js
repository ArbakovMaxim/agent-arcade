// Arcade: состояние мода и его постоянные.
// Всё изменяемое — поля объекта S: импортированную переменную менять нельзя, поле объекта — можно.
// Поля одного раздела заводятся в его модуле.
import { bundledCatalog } from '../catalog.js'
import { NOTES_TOOL } from '../notes.js'

export const S = {}
export const PANE = 'arcade'
export const INPUT = 'arcade-input' // ключ элемента Client, который ловит клавиши над экраном игры (hooks/input.js)
export const ASK_AFTER_MS = 10_000 // через сколько работы агента показать вопрос «сыграть?»; для быстрой проверки поставь 5_000
export const NOTIFY_AFTER_MS = 20_000 // «агент закончил» системным уведомлением — только если ход шёл дольше этого
export const DEBUG = false // тост в начале каждого хода: видно, что мод загрузился

export const PANE_COLUMNS = 104 // сколько колонок просить у Claude Code для панели сбоку от транскрипта
export const PANE_ROWS = 40 // сколько строк просить, когда панель стоит над полем ввода
export const UI_ROWS = 4 // строки панели вокруг экрана Денди: заголовок, подсказка, кнопки
export const TICK_MS = 33 // шаг игрового цикла: 2 кадра Денди за шаг ≈ 60 кадров в секунду, на экран — 30 раз в секунду
export const PIXEL_DENIES = 15 // столько отказов подряд (≈0,5 с) — и в режиме «авто» мод решает, что терминал не показывает картинки
export const MAX_SYMBOL_COLUMNS = 128 // символами больше 128 колонок деталей не прибавит: квадранты уже дают 256 точек в ширину
export const MAX_IMAGE_COLUMNS = 255 // предел Image; картинка масштабируется под размер

// Графика экрана Денди: настоящие пиксели (Image) там, где терминал умеет картинки, иначе символы-квадранты
export const GRAPHICS = ['auto', 'pixels', 'symbols']
export const GRAPHICS_LABEL = { auto: 'авто', pixels: 'пиксели', symbols: 'символы' }

// Поле для проверки ввода: «@» ходит клавишами движения
export const COLS = 24
export const ROWS = 8
export const DEFAULT_COLOR = 0x01000000
export const FLOOR_COLOR = 0x555555
export const PLAYER_COLOR = 0x2e7d32

export const NOTIFY_WINDOW_MS = 30 * 60_000 // уведомлять, если окно игры открывали за последние полчаса
export const LAUNCH_TIMEOUT_MS = 20_000 // сколько ждать PowerShell, который ищет браузеры или открывает окно
export const CUT_TOOL_MS = 10_000 // сколько ждать конца инструмента агента, прежде чем оборвать его ради игры (Desktop)

export const ROM_CACHE_LIMIT = 8 // сколько скачанных игр держать в хранилище мода (у него предел 4 МиБ на всё)
export const REMOTE_MAX_WIDTH = 768 // в Desktop и VS Code экран Денди не шире ×3
export const WIDE_COLUMNS = 400 // «во всю ширину»: просим столько колонок — Claude Code даст, сколько позволит раскладка
export const REMOTE_MAX_WIDTH_WIDE = 1536 // во всю ширину экран Денди до ×6 — если хватает и ширины, и высоты
export const HOLD_TICKS_FIRST = 8 // поле ввода VS Code: кнопка держится ≈260 мс после нажатия…
export const HOLD_TICKS_REPEAT = 4 // …и ≈130 мс после каждого повтора, пока идёт автоповтор

// Меню: главное — приставки; приставка — её игры; настройки — где открывать, графика, проверка клавиш.
// Приставки и игры приходят из каталога сайта; проверка клавиш — своя, только для панели.
export const FIELD = { id: 'field', console: null, title: 'Проверка клавиш', note: 'поле: видно, что нажато и что мод считает зажатым' }

// Действия и клавиши по умолчанию для частых раскладок: EN (QWERTY, QWERTZ), FR (AZERTY), RU, BY, UA, и стрелки.
// Одна физическая клавиша в разных раскладках даёт разные буквы — все они ведут к одному действию.
export const ACTIONS = [
  { id: 'up', label: 'вверх', dx: 0, dy: -1, nes: 'UP' },
  { id: 'left', label: 'влево', dx: -1, dy: 0, nes: 'LEFT' },
  { id: 'down', label: 'вниз', dx: 0, dy: 1, nes: 'DOWN' },
  { id: 'right', label: 'вправо', dx: 1, dy: 0, nes: 'RIGHT' },
  { id: 'a', label: 'A', nes: 'A' },
  { id: 'b', label: 'B', nes: 'B' },
  { id: 'start', label: 'Start', nes: 'START' },
  { id: 'select', label: 'Select', nes: 'SELECT' },
]
const DEFAULT_KEYS = {
  up: ['w', 'ц', 'z', 'up'],
  left: ['a', 'ф', 'q', 'left'],
  down: ['s', 'ы', 'і', 'down'],
  right: ['d', 'в', 'right'],
  a: ['k', 'л'],
  b: ['j', 'о'],
  start: ['n', 'т'],
  select: ['m', 'ь'],
}
export const ARROWS = ['up', 'down', 'left', 'right']
// Японский, китайский и корейский: такие символы значат, что включён метод ввода, а не другая раскладка
export const IME_CHARS = /[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/

// Состояние живёт в модуле и сбрасывается при перезагрузке кода; клавиши и последняя игра хранятся в $.store
S.status = 'idle' // idle | working | permission | done
S.turnStartedAt = 0
S.windowOpenedAt = 0 // когда в последний раз открылось окно игры в браузере: оттуда Claude Code не видно
S.mine = [] // свои игры: { id, console, title, sha256 }; сами файлы — копии в папке данных
S.dataDir = null // ~/.claude/arcade/roms — переживает обновления плагина; null, пока не узнали домашнюю папку
S.sep = '/'
S.osNotify = true // системные уведомления «агент закончил» и «ждёт разрешения», пока играешь в окне
S.asked = false // в этом ходе на вопрос уже ответили
S.askVisible = false
S.paneOpen = false
S.netWaiting = [] // кто ждёт в сети: [{ id, title, count }] — из /api/lobbies сайта, раз в минуту
S.lang = 'ru' // язык интерфейса: ru или en — настройка, иначе по окружению
S.wide = false // панель игры во всю ширину: разговор с агентом сжимается в узкую полосу
export const unfolded = new Set() // плитки Desktop, где по «ещё» показано описание целиком: ключи карточек
S.agentAlert = null // пока открыта игра: 'done' — агент закончил, 'permission' — ждёт разрешения; плашка поверх игры
// Что делать с игрой в панели, когда агент закончил или ждёт разрешения — отдельно для каждого сигнала
export const SIGNAL_MODES = ['notify', 'pause', 'close']
export const SIGNAL_LABELS = { notify: 'плашка, игра идёт', pause: 'пауза и плашка', close: 'сразу к агенту' }
S.onDone = 'notify'
S.onPermission = 'pause' // агент стоит и ждёт человека — это срочнее
S.paused = false // игра на паузе из-за сигнала агента: снимается «Играть дальше» или любой клавишей игры
S.view = 'library' // library или id игры (field — проверка клавиш)
S.menu = 'main' // что открыто в библиотеке: main, id приставки или settings
S.langReturn = 'main' // куда вернуться из выбора языка: главное меню или настройки
S.menuFrom = null // откуда вернулись в главное меню — туда ставим фокус
S.lastGame = 'thwaite'
S.played = false // во что-то уже играли (или читали, слушали) — тогда первой плиткой главного меню идёт «Продолжить»
// Разделы главного меню, которые можно свернуть, и какие свёрнуты; какие убраны из меню совсем; избранное — id игр,
// книг и аудиокниг по порядку добавления. Всё это общее для всех компьютеров (SYNC_KEYS)
export const SECTIONS = ['play', 'read', 'watch', 'talk', 'work', 'more']
// Убрать можно любой, кроме «Ещё»: в нём сами настройки, где раздел возвращают
export const HIDEABLE = ['play', 'read', 'watch', 'talk', 'work']
// Плитки разделов в настройках: подпись — показан раздел или убран (целиком, чтобы словарь перевёл), описание и
// иконка — как у главной плитки раздела
export const SECTION_SWITCH = {
  play: ['Играть: показан', 'Играть: скрыт'],
  read: ['Читать и слушать: показан', 'Читать и слушать: скрыт'],
  watch: ['Смотреть: показан', 'Смотреть: скрыт'],
  talk: ['Общение: показан', 'Общение: скрыт'],
  work: ['Работа: показан', 'Работа: скрыт'],
}
export const SECTION_NOTES = {
  play: 'приставки, игры в браузере и твои ROM',
  read: 'книги, аудиокниги, статьи и подкасты',
  watch: 'YouTube, Twitch и TikTok',
  talk: 'друзья, чаты и аккаунт',
  work: 'блокнот и доска проектов',
}
export const SECTION_ICONS = { play: 'games', read: 'books', watch: 'youtube', talk: 'friends', work: 'boards' }
export const FAV_LIMIT = 100
S.collapsed = []
S.hidden = []
// Первый запуск: вместо главного меню — приветствие с выбором разделов, пока его не закрыли «Готово». На этом компьютере,
// в $.store — welcomed
S.welcomed = true
S.favorites = []
// Поиск: query — что вписано. Поле рисуется заново (field — его номер) с тем, что было вписано (seed), когда экран
// поиска открывают снова: само поле, пока его нет на экране, вписанное не помнит. shown — экран поиска сейчас на виду
export const finder = { query: '', seed: '', field: 0, shown: false }
S.player = { x: 2, y: 3 }
S.pressed = []
S.events = []
S.keymap = restoreKeymap(undefined)
S.mode = 'play' // play | assign
S.assignStep = 0
S.notice = ''
S.lastCounts = {} // сколько раз каждая клавиша была нажата по прошлому сообщению экрана игры
S.heldKeys = [] // клавиши, которые экран игры сейчас считает зажатыми
S.nes = null // эмулятор Денди, создаётся при запуске игры в панели
S.nesGame = null // какая игра загружена в эмулятор
S.frame = null // последний кадр Денди
S.down = new Set() // кнопки Денди, зажатые в эмуляторе
S.taps = new Set() // кнопки Денди, нажатые заново с прошлого шага
S.screen = null // размер экрана Денди при последней отрисовке панели в терминале
S.graphics = 'auto' // выбор человека, хранится в $.store
S.pixelsFailed = false // в этой сессии терминал отказался показывать картинки
S.denies = 0 // отказов показать кадр подряд
S.profileRoot = '' // папка для отдельного профиля браузера с игрой: %LOCALAPPDATA%\claude-arcade
S.detection = null // что нашёл поиск браузеров: { browsers, defaultId, screen }; null — ещё ищем
S.opener = null // где открывать игры: 'window' или 'pane'; null — по умолчанию (на Windows — окно)
S.browserChoice = 'default' // каким браузером: 'default' или id найденного
S.desktopOpener = 'builtin' // в Desktop: 'builtin' — встроенный браузер приложения, 'window' — окно браузера, как в терминале
S.keepMenu = false // в Desktop: встроенный браузер открылся — false: панель Arcade закрываем, true: оставляем, браузер встаёт под ней
S.backOnDone = false // в Desktop: агент закончил, пока смотришь во встроенном браузере — true: вкладку Arcade закрываем
S.hideOnline = false // не показывать друзьям, что человек в сети: сам он друзей в сети всё равно видит
// Вкладка встроенного браузера, где Arcade открыл видео, трансляцию, TikTok, статью или выпуск: { tabId, turn } или null;
// turn — ход Claude, который открыл её по просьбе Arcade: его конец вкладку не закрывает
S.watchTab = null
// Просьба Arcade, которую Claude сейчас выполняет, велит потом вернуться к работе: конец этого хода — конец работы агента
S.askResumes = false
S.libraryNotice = '' // что случилось при последнем запуске окна
S.opening = false // игру во встроенном браузере Desktop по просьбе Arcade открывает Claude
S.agentTurn = null // ход агента (главного цикла), который идёт сейчас: его id для $.turn.abort
S.toolsRunning = 0 // сколько инструментов агента работает сейчас
S.pendingOpen = null // адрес игры, которую откроем, когда закончится текущий инструмент агента или сжатие контекста
S.interrupting = false // ход оборвал Arcade: его конец — не «агент закончил»
S.asking = null // адрес, который Arcade попросил Claude открыть, а тот ещё не открыл: второй раз не прерываем
S.compacting = false // Claude сжимает контекст: прерывать ход бесполезно — ждём конца сжатия
S.catalog = bundledCatalog() // каталог: с сайта, из сохранённой копии или запас из самого мода
S.platform = null // windows | mac | linux; null — пока не знаем, окно браузера не предлагаем
S.remoteSurface = null // панель с игрой нарисована в Desktop или VS Code — кадры идут перерисовкой, а не blit
S.holdTicks = {} // поле ввода VS Code: кнопка Денди → сколько шагов ещё держать
S.bandLength = 0 // VS Code: длина текста в строке 🎮 — новые буквы считаются нажатиями, стирание нет
S.bandToken = '' // VS Code: «пустое» значение строки 🎮; чередуется '' и невидимый символ, чтобы VS Code заметил сброс
S.bandResetWanted = false // VS Code: после нажатия стереть набранное при следующей отрисовке
S.bandId = null // VS Code: requestId полосы над вводом — чтобы попробовать поставить фокус в поле при старте игры
S.bandFocusWanted = false // VS Code: игра только что открылась — попробовать один раз
// YouTube: темы (null — ещё не подобраны), подборка открытой темы, что сейчас грузится ('topics' | 'videos' | ''),
// заметка к подборке; request — номер последней загрузки: ответ старой загрузки, пришедший позже новой, не нужен
S.yt = { topics: null, topicsAt: 0, topicsLang: '', topic: -1, videos: [], seen: new Set(), loading: '', note: '', request: 0 }
export const feedCache = new Map() // id канала → { at, entries }: ленты перечитываем не чаще FEED_TTL_MS
// Статьи и подкасты: темы — общие с YouTube (yt.topics), у каждого раздела своя подборка открытой темы
export const emptyReads = (request = 0) => ({ topic: -1, items: [], seen: new Set(), loading: false, note: '', request })
S.reads = { articles: emptyReads(), podcasts: emptyReads() }
// Книги и аудиокниги (hooks/books.js): язык книг — общий, у книг (book) и аудиокниг (audio) — свой раздел или поиск,
// список, страница и беда загрузки; request — номер последней загрузки, как у статей
export const emptyBooks = (request = 0) => ({ section: '', q: '', items: [], page: 1, more: false, loading: false, error: '', request })
S.bk = { lang: 'en', book: emptyBooks(), audio: emptyBooks() }
export const rssCache = new Map() // «articles:id ленты» → { at, items }: ленты перечитываем не чаще FEED_TTL_MS
// Свои темы человека: последние, из $.store. Заметка под полем «Своя тема» — у раздела, где тему ввели; номер последнего
// разбора — ответ модели на старый ввод не нужен
S.myTopics = []
// Блокнот (hooks/notes.js): страницы из $.store. note — заметка под полями (bad — о беде), confirm — какую страницу
// удалить по второму нажатию, draft — набранное в поле «Текст» и ещё не сохранённое ({ id, text }), field — номер полей:
// поля рисуются заново с новым текстом, когда страница поменялась не из них; focus — какое поле страницы в фокусе
S.notes = []
export const nb = { note: '', bad: false, confirm: null, draft: null, field: 0, focus: '' }
export const NOTES_TOOL_NAME = `mcp__arcade__${NOTES_TOOL.name}`
export const NOTE_LINES = 400 // строк страницы на экране; дальше — в поле «Текст»
// Доска проектов: основы общих досок (desks.js), список общих досок с сайта и состояние экрана. trouble — беда сверки
// одной доски { share, text }; picked — отмеченные друзья; syncing и again — какие доски сверяются и каким нужна ещё сверка
S.desks = {}
export const NO_DESKS = { list: null, me: '', names: {}, loading: false, busy: '', note: '', bad: false, trouble: null, pick: '', confirm: '', focus: '', field: 0 }
S.dk = { ...NO_DESKS, picked: new Set(), syncing: new Set(), again: new Set() }
S.pushTimer = null
S.ownNote = { kind: '', text: '' }
S.ownRequest = 0
export const searchCache = new Map() // «youtube:запрос» → { at, found }: поиск сайта по своей теме — не чаще SEARCH_TTL_MS
// Twitch: свои каналы (из $.store), что сайт знает о каналах (логин → { name, avatar, live }), каких каналов нет на
// Twitch, каталог Arcade; at — когда спрашивали сайт, error — что ответил сайт, note — заметка под полем «Добавить
// канал»; request — номер последнего вопроса: ответ старого вопроса, пришедший позже нового, не нужен
S.tw = { channels: [], info: {}, missing: new Set(), catalog: [], at: 0, loading: false, error: '', note: '', request: 0 }
// Аккаунт: вход через GitHub (session — { token, user } из $.store или null), вход по коду, который идёт сейчас (flow —
// { device, code, url, interval, until } или null), starting — просим код у сайта, заметка в меню аккаунта, идёт ли
// синхронизация (again — за время неё настройку поменяли ещё раз) и когда она последний раз удалась; confirmDelete —
// «Удалить аккаунт» нажали один раз; request — номер последнего входа: ответ старого входа не нужен. handle — @ник,
// ticket — его подпись для сетевых игр (оба с сайта, только в памяти), naming — сайт проверяет новый ник, handleNote —
// почему ник не взялся, claims — сколько раз ник сменили: ответ синхронизации, спрошенной до смены, ник не трогает;
// friends и requests — сколько друзей и заявок человеку (для плитки «Друзья»), unread — непрочитанных в чатах;
// role — 'admin' у админа: ему видны отчёты об ошибках; pic — номер своей аватарки или null, picking — сайт сохраняет
// новую, picNote — почему не сохранилась, picks — сколько раз её меняли: синхронизация, спрошенная до смены, её не трогает
S.acct = { session: null, flow: null, starting: false, note: '', syncing: false, again: false, syncedAt: 0, confirmDelete: false, request: 0, handle: '', ticket: '', naming: false, handleNote: '', claims: 0, friends: 0, requests: 0, unread: 0, role: '', pic: null, picking: false, picNote: '', picks: 0 }
// Друзья: list — { friends, incoming, outgoing } с сайта или null, пока не спрашивали; loading — спрашиваем список,
// busy — какое действие ждёт ответа сайта, note — заметка под полем «Добавить друга» (bad — что-то не вышло);
// request — номер последнего вопроса: ответ старого вопроса не нужен
export const NO_FRIENDS = { list: null, loading: false, busy: '', note: '', bad: false }
S.fr = { ...NO_FRIENDS, request: 0 }
// «В сети» и приглашения в игру (с отметки мода на сайте): online — номера друзей в сети, invites — кто зовёт
// { from, handle, game, room?, at } (только игры, которые мод знает), at — когда отмечались, pulsing — отметка ждёт
// ответа сайта, told — о каких приглашениях уже сказали тостом (from:at). Звать: to — кого ({ id, handle }), busy —
// игра, приглашение в которую ждёт ответа сайта, note — заметка на экране друзей (bad — не вышло)
// soon — отметиться при первой возможности (открыли «Друзей», сменили «показывать, что в сети»), gone — на какие
// приглашения уже ответили (from:at): отметка, ушедшая до ответа, их не вернёт
export const noOnline = () => ({ online: new Set(), invites: [], at: 0, pulsing: false, soon: false, told: new Set(), gone: new Set(), to: null, busy: '', note: '', bad: false })
S.ol = noOnline()
// Чаты: list — чаты с сайта (новые сверху) или null, пока не спрашивали; names — ники по номерам аккаунтов, pics —
// номера их аватарок, online — номера друзей в сети (со списком чатов); me — свой номер; loading — спрашиваем список. Открытый чат: talk — его id, about — он сам с сайта (участники, хозяин группы),
// messages — переписка по порядку номеров, first — с какого номера она видна человеку, shown — сколько последних
// сообщений показать, opening — загружаем открытый чат, older — грузим более ранние, polling — спрашиваем новые.
// busy — какое действие ждёт ответа сайта,
// note — заметка (bad — что-то не вышло), picked — кого отметили для новой группы, groupName — что вписано в название,
// field — номер поля «Сообщение» (после отправки — новое, пустое), confirmLeave — «Выйти из группы» нажали один раз.
// request — номер последнего вопроса: ответ старого не нужен
export const CHAT_SHOWN = 30 // сколько последних сообщений чата показывать сразу; «Раньше» — ещё столько же
export const NO_CHATS = { list: null, names: {}, pics: {}, online: [], me: '', loading: false, talk: '', about: null, messages: [], first: 0, shown: CHAT_SHOWN, opening: false, older: false, polling: false, busy: '', note: '', bad: false, groupName: '', field: 0, confirmLeave: false }
S.ch = { ...NO_CHATS, picked: new Set(), request: 0 }
S.chatLink = '' // код ссылки на страницу чатов: его страница один раз обменяет на свой билет
// Отчёт об ошибке: field — номер поля (после отправки — новое, пустое), sending — отчёт ждёт ответа сайта, note —
// заметка под полем (bad — не вышло). Список у админа: list — открытые отчёты с сайта (новые сверху) или null, пока не
// спрашивали; open — сколько открытых всего, loading — спрашиваем список, busy — номер закрываемого отчёта,
// listNote — заметка (listBad — не вышло); request — номер последнего вопроса про список: ответ старого не нужен
export const NO_REPORTS = { list: null, open: 0, loading: false, busy: 0, listNote: '', listBad: false }
S.rp = { field: 0, sending: false, note: '', bad: false, ...NO_REPORTS, request: 0 }
S.modVersion = null // версия мода из его plugin.json: читается один раз; не прочли — ''
S.stamps = {} // когда человек менял синхронизируемые настройки: ключ → время; в $.store — syncAt
// Какие из SYNC_KEYS сохранены на этом компьютере: чего человек здесь не менял, то берём с сайта, а не отправляем туда
export const savedKeys = new Set()
S.syncTimer = null

// Берёт сохранённые клавиши; для действий, которых в сохранении нет, — клавиши по умолчанию
export function restoreKeymap(saved) {
  return Object.fromEntries(
    ACTIONS.map((a) => [a.id, Array.isArray(saved?.[a.id]) ? saved[a.id] : [...DEFAULT_KEYS[a.id]]]),
  )
}
