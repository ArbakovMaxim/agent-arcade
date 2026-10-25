// Язык интерфейса мода: русский (на нём написан код) или английский.
// Перевод делается по готовому дереву интерфейса: точные строки — по словарю, строки с подстановками — по шаблонам.
// Что не переведено, остаётся по-русски — интерфейс от этого не ломается.

import { LOCALES } from './locales/index.js'

// Языки интерфейса: русский — исходный (строки в коде), английский — свой перевод, остальные — переводы
// поверх английского из locales/<язык>.js. Подписи — на самом языке, чтобы найти свой, не понимая текущего
export const LANGS = ['en', 'ru', 'uk', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'tr', 'ja', 'zh', 'ko']
export const LANG_NAMES = { en: 'English', ru: 'Русский', uk: 'Українська', es: 'Español', fr: 'Français', de: 'Deutsch', pt: 'Português', it: 'Italiano', pl: 'Polski', tr: 'Türkçe', ja: '日本語', zh: '中文', ko: '한국어' }

// Язык по окружению: LC_ALL, LC_MESSAGES, LANG. Своего языка нет (или C/POSIX) — английский
export function detectLang(...values) {
  for (const v of values) {
    if (typeof v !== 'string' || !v.trim() || /^(c|posix)([._].*)?$/i.test(v.trim())) continue
    const code = v.trim().toLowerCase().slice(0, 2)
    if (code === 'be') return 'ru'
    return LANGS.includes(code) ? code : 'en'
  }
  return 'en'
}

const EXACT = {
  // Шапка и статус агента
  'Агент свободен': 'Agent is idle',
  'Агент ждёт разрешения — Esc, чтобы ответить': 'Agent is waiting for permission — Esc to answer',
  'Агент закончил — Esc, чтобы вернуться': 'Agent finished — Esc to go back',
  'Агент закончил — можно возвращаться': 'Agent finished — you can go back',
  'Агент ждёт разрешения': 'Agent is waiting for permission',
  ' Агент закончил ': ' Agent finished ',
  ' Агент закончил · пауза ': ' Agent finished · paused ',
  ' Агент ждёт разрешения ': ' Agent is waiting for permission ',
  ' Агент ждёт разрешения · пауза ': ' Agent is waiting for permission · paused ',
  'К агенту': 'Back to agent',
  'Играть дальше': 'Keep playing',
  // Меню
  'Arcade · настройки': 'Arcade · settings',
  'Arcade · мои игры': 'Arcade · my games',
  'Денди': 'NES',
  'скоро': 'soon',
  'Здесь пока нет игр.': 'No games here yet.',
  '← Назад': '← Back',
  'Настройки': 'Settings',
  'Мои игры': 'My games',
  'Библиотека': 'Library',
  'Окно Arcade': 'Arcade window',
  'все игры и статистика в окне браузера': 'all games and stats in a browser window',
  'добавь свой файл ROM': 'add your own ROM file',
  '↑ ↓ или Tab — выбрать, Enter — открыть. Можно кликнуть мышью.': '↑ ↓ or Tab — select, Enter — open. You can click with the mouse too.',
  'Открываю окно…': 'Opening the window…',
  // Desktop: встроенный браузер приложения
  'Открываю встроенный браузер…': 'Opening the built-in browser…',
  'Arcade прервал Claude: он откроет игру во встроенном браузере и вернётся к работе.': 'Arcade interrupted Claude: it will open the game in the built-in browser and get back to work.',
  'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть игру во встроенном браузере.': 'Claude is finishing its current step — Arcade will interrupt it when the step ends or after 10 seconds to open the game in the built-in browser.',
  'Потом вернись к работе, которую делал до этого.': 'Then get back to the work you were doing before.',
  'Твой последний инструмент оборван на полпути: проверь, что он успел сделать, прежде чем продолжать.': 'Your last tool was cut off midway: check what it managed to do before continuing.',
  'Arcade попросил Claude открыть ссылку во встроенном браузере.': 'Arcade asked Claude to open the link in the built-in browser.',
  'Ссылка — в поле ввода: нажми Enter, и Claude откроет её во встроенном браузере.': 'The link is in the prompt box: press Enter, and Claude will open it in the built-in browser.',
  'Не получилось открыть встроенный браузер: сначала ответь на вопрос Claude Code.': "Could not open the built-in browser: answer Claude Code's question first.",
  'Claude сжимает контекст — когда закончит, Arcade попросит его открыть игру во встроенном браузере.': "Claude is compacting its context — when it's done, Arcade will ask it to open the game in the built-in browser.",
  'Claude уже открывает эту игру во встроенном браузере — подожди немного.': 'Claude is already opening this game in the built-in browser — give it a moment.',
  // YouTube: темы по работе агента и свежие видео
  'Смотреть': 'Watch',
  'свежие видео по теме работы агента': "fresh videos on what the agent is working on",
  'по теме работы агента': "on what the agent is working on",
  'презентации и обзоры обновлений': 'launches and update reviews',
  'Темы — по тому, над чем сейчас работает агент; видео — свежие, с проверенных каналов.': 'Topics follow what the agent is working on now; videos are fresh, from hand-picked channels.',
  'Подбираю темы…': 'Picking topics…',
  'Подбираю видео…': 'Picking videos…',
  'Другие темы': 'Other topics',
  'Другая подборка': 'Different picks',
  'ИИ-агенты и программирование': 'AI agents and coding',
  'Веб-разработка': 'Web development',
  'Инструменты разработчика': 'Developer tools',
  'Новинки и презентации': 'Launches and keynotes',
  'Видео открыто во встроенном браузере Claude.': "The video is open in Claude's built-in browser.",
  'Arcade прервал Claude: он откроет видео во встроенном браузере и вернётся к работе.': 'Arcade interrupted Claude: it will open the video in the built-in browser and get back to work.',
  'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть видео во встроенном браузере.': 'Claude is finishing its current step — Arcade will interrupt it when the step ends or after 10 seconds to open the video in the built-in browser.',
  'Claude сжимает контекст — когда закончит, Arcade попросит его открыть видео во встроенном браузере.': "Claude is compacting its context — when it's done, Arcade will ask it to open the video in the built-in browser.",
  'Claude уже открывает это видео во встроенном браузере — подожди немного.': 'Claude is already opening this video in the built-in browser — give it a moment.',
  'Не получилось загрузить видео: YouTube не ответил. Попробуй чуть позже.': "Could not load videos: YouTube didn't respond. Try again a bit later.",
  // Статьи и подкасты: те же темы, записи из английских лент
  'Статьи': 'Articles',
  'Подкасты': 'Podcasts',
  'свежие статьи по теме работы агента': 'fresh articles on what the agent is working on',
  'свежие выпуски подкастов по теме работы агента': 'fresh podcast episodes on what the agent is working on',
  'новости и обзоры обновлений': 'news and update reviews',
  'Темы — по тому, над чем сейчас работает агент; статьи — свежие, из проверенных блогов и изданий на английском.': 'Topics follow what the agent is working on now; articles are fresh, from hand-picked English-language blogs and publications.',
  'Темы — по тому, над чем сейчас работает агент; выпуски — свежие, из проверенных подкастов на английском.': 'Topics follow what the agent is working on now; episodes are fresh, from hand-picked English-language podcasts.',
  'Подбираю статьи…': 'Picking articles…',
  'Подбираю выпуски…': 'Picking episodes…',
  'Статья открыта во встроенном браузере Claude.': "The article is open in Claude's built-in browser.",
  'Выпуск открыт во встроенном браузере Claude.': "The episode is open in Claude's built-in browser.",
  'Не получилось загрузить статьи: ленты не ответили. Попробуй чуть позже.': "Could not load articles: the feeds didn't respond. Try again a bit later.",
  'Не получилось загрузить выпуски: ленты не ответили. Попробуй чуть позже.': "Could not load episodes: the feeds didn't respond. Try again a bit later.",
  // Своя тема: человек пишет, о чём хочет смотреть, читать или слушать
  'Своя тема': 'Your own topic',
  'о чём угодно: история Рима, хлеб на закваске…': 'anything: Roman history, sourdough bread…',
  'Напиши, что хочешь посмотреть, — Arcade найдёт свежие видео по теме.': 'Type what you want to watch — Arcade will find fresh videos on it.',
  'Напиши, о чём хочешь почитать, — Arcade найдёт свежие статьи по теме.': 'Type what you want to read about — Arcade will find fresh articles on it.',
  'Напиши, о чём хочешь послушать, — Arcade найдёт свежие выпуски по теме.': 'Type what you want to listen to — Arcade will find fresh episodes on it.',
  'Мои темы': 'My topics',
  '  своя тема': '  your topic',
  'Забыть мои темы': 'Forget my topics',
  'Разбираю тему…': 'Working out the topic…',
  'Напиши тему словами — например, «история Рима» или «хлеб на закваске».': 'Type the topic in words — for example, “Roman history” or “sourdough bread”.',
  'Не получилось разобрать тему. Попробуй написать её по-английски.': "Couldn't make out the topic. Try typing it in English.",
  'Такую тему Arcade не ищет: политика и темы для взрослых — мимо. Попробуй другую.': "Arcade doesn't search for topics like this: politics and adult topics are out. Try another one.",
  'По этой теме ничего не нашлось — попробуй сказать иначе.': 'Nothing turned up on this topic — try putting it another way.',
  'Поиск по своей теме на сегодня исчерпан — попробуй завтра.': "Today's searches for your own topics are used up — try again tomorrow.",
  'Поиск по своей теме не ответил. Попробуй чуть позже.': "The search for your topic didn't respond. Try again a bit later.",
  'Подкасты по теме нашлись, но их ленты не ответили. Попробуй чуть позже.': "Podcasts on the topic turned up, but their feeds didn't respond. Try again a bit later.",
  // Статья или выпуск во встроенном браузере — «ссылка»
  'Arcade прервал Claude: он откроет ссылку во встроенном браузере и вернётся к работе.': 'Arcade interrupted Claude: it will open the link in the built-in browser and get back to work.',
  'Claude доделывает текущий шаг — Arcade прервёт его, когда шаг кончится или через 10 секунд, чтобы открыть ссылку во встроенном браузере.': 'Claude is finishing its current step — Arcade will interrupt it when the step ends or after 10 seconds to open the link in the built-in browser.',
  'Claude сжимает контекст — когда закончит, Arcade попросит его открыть ссылку во встроенном браузере.': "Claude is compacting its context — when it's done, Arcade will ask it to open the link in the built-in browser.",
  'Claude уже открывает эту ссылку во встроенном браузере — подожди немного.': 'Claude is already opening this link in the built-in browser — give it a moment.',
  // Twitch: свои каналы и каталог Arcade
  'свои каналы и эфиры о программировании, технике и ретро-играх': 'your channels and streams about coding, tech and retro games',
  'Свои каналы и каталог Arcade. Регистрация не нужна: свои каналы хранятся только у тебя.': 'Your channels and the Arcade catalog. No sign-up needed: your channels are kept only on your computer.',
  'Мои каналы': 'My channels',
  'Своих каналов пока нет — добавь любой канал Twitch по имени или ссылке.': 'You have no channels yet — add any Twitch channel by name or link.',
  'Добавить канал': 'Add a channel',
  'имя канала или ссылка twitch.tv/…': 'channel name or a twitch.tv/… link',
  'Например, tsoding или https://www.twitch.tv/tsoding': 'For example, tsoding or https://www.twitch.tv/tsoding',
  'Убрать канал': 'Remove a channel',
  'Сейчас в эфире': 'Live now',
  'Спрашиваю Twitch, кто в эфире…': 'Asking Twitch who is live…',
  'Из каталога сейчас никто не в эфире.': 'No one from the catalog is live right now.',
  'Весь каталог': 'Full catalog',
  'Обновить': 'Refresh',
  'Обновляю…': 'Refreshing…',
  'Каталог Arcade: эфиры о программировании, технике, науке и ретро-играх, по-английски. Каналы 18+ не показываем.': 'The Arcade catalog: English-language streams about coding, tech, science and retro games. 18+ channels are not shown.',
  'Какой канал убрать из «Моих каналов»?': 'Which channel should go from My channels?',
  'Трансляция открыта во встроенном браузере Claude.': "The stream is open in Claude's built-in browser.",
  'не в эфире': 'offline',
  'такого канала нет на Twitch': 'no such channel on Twitch',
  'Twitch не принял ключи сайта Arcade — эфиры пока не показать.': "Twitch didn't accept the Arcade site's keys — streams can't be shown for now.",
  'Twitch на сайте Arcade ещё не настроен — эфиры пока не показать.': "Twitch isn't set up on the Arcade site yet — streams can't be shown for now.",
  'Вопросы к Twitch на сегодня исчерпаны — попробуй завтра.': "Today's Twitch requests are used up — try again tomorrow.",
  'Сайт Arcade не ответил про эфиры Twitch. Попробуй чуть позже.': "The Arcade site didn't answer about Twitch streams. Try again a bit later.",
  'Напиши имя канала Twitch или ссылку на него — например, twitch.tv/tsoding.': 'Type a Twitch channel name or a link to it — for example, twitch.tv/tsoding.',
  'Своих каналов уже 20 — сначала убери какой-нибудь.': 'You already have 20 channels — remove one first.',
  'Ищу канал на Twitch…': 'Looking for the channel on Twitch…',
  'Такого канала нет на Twitch — проверь имя.': 'There is no such channel on Twitch — check the name.',
  // TikTok: лента и поиск на сайте TikTok
  '  лента и поиск по теме работы агента; вход — твой': "  feed and search on the agent's work topic; you sign in yourself",
  'Лента «Для тебя»': 'For You feed',
  '  Войди в TikTok сам — проще всего QR-кодом из приложения на телефоне. Arcade твой вход не видит.':
    "  Sign in to TikTok yourself — the easiest way is the QR code from the phone app. Arcade doesn't see your sign-in.",
  'Поиск по теме': 'Search by topic',
  'Найти в TikTok': 'Search TikTok',
  'что угодно: рецепты, Rust, котики…': 'anything: recipes, Rust, cats…',
  'TikTok открывается во встроенном браузере Claude.': "TikTok opens in Claude's built-in browser.",
  'TikTok открывается в браузере по умолчанию.': 'TikTok opens in the default browser.',
  // Блокнот
  'Работа': 'Work',
  'Блокнот': 'Notebook',
  'страницы и чек-листы; Claude может дополнять': 'pages and checklists; Claude can add to them',
  'Arcade · блокнот': 'Arcade · notebook',
  'Страницы и подстраницы: заголовки «# », пункты «- », чек-листы «- [ ] ». Хранятся на этом компьютере.': 'Pages and subpages: headings "# ", items "- ", checklists "- [ ] ". Kept on this computer.',
  'Новая страница': 'New page',
  'название: план на неделю, идеи, покупки…': 'title: weekly plan, ideas, shopping…',
  'Создать': 'Create',
  'Страницы': 'Pages',
  'Страниц пока нет — впиши название новой выше.': 'No pages yet — type a title for a new one above.',
  'Claude тоже ведёт блокнот: попроси, например, «запиши план в мой блокнот Arcade».': 'Claude keeps the notebook too: ask, for example, "write the plan into my Arcade notebook".',
  'пустая страница': 'empty page',
  'Страница пустая — впиши текст или пункт ниже.': 'The page is empty — type text or an item below.',
  'Дальше — в поле «Текст» ниже.': 'The rest is in the Text field below.',
  'Новый пункт': 'New item',
  'пункт чек-листа': 'checklist item',
  'Добавить': 'Add',
  'Текст': 'Text',
  '# Заголовок, - пункт, - [ ] дело': '# Heading, - item, - [ ] to-do',
  'Сохранить': 'Save',
  'Enter — сохранить; новая строка — как в поле ввода Claude.': "Enter — save; a new line — as in Claude's prompt box.",
  'Подстраницы': 'Subpages',
  'Новая подстраница': 'New subpage',
  'название': 'title',
  'Название': 'Title',
  'Отдать Claude': 'Give to Claude',
  'Claude получит страницу и сможет отмечать пункты и дописывать её.': 'Claude gets the page and can tick items and add to it.',
  'Нажми ещё раз — удалить навсегда': 'Press again — delete for good',
  'Удалить страницу и подстраницы': 'Delete the page and subpages',
  'Удалить страницу': 'Delete the page',
  'Сохранено.': 'Saved.',
  'Страница удалена.': 'Page deleted.',
  'Впиши название страницы.': 'Type a page title.',
  'Блокнот полон — удали ненужные страницы.': 'The notebook is full — delete pages you no longer need.',
  'Текст страницы длиннее 20 000 знаков — сократи его.': 'The page text is over 20,000 characters — shorten it.',
  'Не получилось сохранить блокнот.': 'Could not save the notebook.',
  'Страница ушла Claude.': 'The page went to Claude.',
  'Claude занят — страница ждёт в поле ввода: отправь её, когда он освободится.': 'Claude is busy — the page is waiting in the prompt box: send it when Claude is free.',
  'Не получилось отдать страницу — попробуй ещё раз, когда Claude освободится.': 'Could not give the page to Claude — try again when Claude is free.',
  'Страница из моего блокнота Arcade': 'A page from my Arcade notebook',
  'Отмечай сделанные пункты и дописывай итоги на этой странице инструментом mcp__arcade__notes.': 'Tick done items and add results to this page with the mcp__arcade__notes tool.',
  'Просьба ушла Claude.': 'The request went to Claude.',
  'Claude занят — просьба ждёт в поле ввода: отправь её, когда он освободится.': 'Claude is busy — the request is waiting in the prompt box: send it when Claude is free.',
  'Не получилось передать просьбу — попробуй ещё раз, когда Claude освободится.': 'Could not pass the request to Claude — try again when Claude is free.',
  'Перенеси страницу из моего блокнота Arcade в другое приложение.': 'Move a page from my Arcade notebook to another app.',
  'Обнови страницу в другом приложении текстом из моего блокнота Arcade.': 'Update a page in another app with the text from my Arcade notebook.',
  'Забери текст страницы из другого приложения в мой блокнот Arcade.': 'Bring the text of a page from another app into my Arcade notebook.',
  'Забери страницу из другого приложения в мой блокнот Arcade.': 'Bring a page from another app into my Arcade notebook.',
  'Создай там новую страницу с этим названием и текстом инструментами коннектора этого приложения. Потом свяжи её со страницей блокнота: mcp__arcade__notes, action link, с названием приложения и адресом новой страницы.': "Create a new page there with this title and text using that app's connector tools. Then link it to the notebook page: mcp__arcade__notes, action link, with the app name and the address of the new page.",
  'Замени текст той страницы на этот инструментами коннектора этого приложения.': "Replace the text of that page with this one using that app's connector tools.",
  'Прочитай ту страницу инструментами коннектора этого приложения и замени её текстом текст страницы блокнота: mcp__arcade__notes, action replace. Прежний текст останется в Arcade для отмены.': "Read that page with that app's connector tools and put its text in place of the notebook page text: mcp__arcade__notes, action replace. The previous text stays in Arcade for undo.",
  'Найди и прочитай её инструментами коннектора (Notion, Google Docs и других). Потом создай страницу блокнота: mcp__arcade__notes, action create, с её названием и текстом, а в app и url — приложение и адрес той страницы, чтобы они остались связаны.': 'Find and read it with connector tools (Notion, Google Docs and others). Then create a notebook page: mcp__arcade__notes, action create, with its title and text, and with app and url set to the app and address of that page so they stay linked.',
  'Нет инструментов этого приложения — ничего не делай, только объясни, как подключить его коннектор в Claude.': 'If you have no tools for that app, do nothing else — just explain how to connect its connector in Claude.',
  'Что забрать': 'What to bring',
  'Приложение': 'App',
  'Адрес': 'Address',
  'Страница блокнота': 'Notebook page',
  'Страница открыта в браузере.': 'The page is open in the browser.',
  'Браузер не открылся — адрес страницы написан выше.': 'The browser did not open — the page address is above.',
  'Забрать из Notion или другого приложения': 'Import from Notion or another app',
  'ссылка или название страницы': 'link or page title',
  'Забрать': 'Import',
  '  Через коннекторы Claude: ключи и пароли Arcade не нужны. Нет коннектора — Claude подскажет, как подключить.': "  Through Claude's connectors: Arcade needs no keys or passwords. No connector — Claude will tell you how to connect one.",
  'Взять из поля ввода Claude': "Take from Claude's prompt box",
  '  Перенесёт набранное или надиктованное в поле ввода Claude в конец страницы.': "  Moves what you typed or dictated in Claude's prompt box to the end of the page.",
  '  Голосом: Win+H — диктовка Windows пишет туда, где курсор.': '  By voice: Win+H — Windows dictation types where the cursor is.',
  '  Голосом: дважды Fn — диктовка macOS пишет туда, где курсор.': '  By voice: press Fn twice — macOS dictation types where the cursor is.',
  'Notion и другие приложения': 'Notion and other apps',
  'Связана с': 'Linked to',
  'Обновить в приложении': 'Update in the app',
  'Забрать из приложения': 'Import from the app',
  'Открыть в браузере': 'Open in browser',
  'Отвязать': 'Unlink',
  'Страница отвязана.': 'The page is unlinked.',
  'Отправить в Notion': 'Send to Notion',
  'В другое приложение': 'To another app',
  'Вернуть текст до правки Claude': "Restore the text from before Claude's edit",
  'Прежний текст вернулся.': 'The previous text is back.',
  'Поле ввода Claude пустое — надиктуй или впиши туда текст и нажми ещё раз.': "Claude's prompt box is empty — dictate or type text there and press again.",
  'Текст из поля ввода Claude — в конце страницы.': "The text from Claude's prompt box is at the end of the page.",
  'Доска проектов': 'Project board',
  '  колонки и карточки; общие — с друзьями': '  columns and cards; shared ones — with friends',
  '  доски с колонками и карточками; общие — с друзьями': '  boards with columns and cards; shared ones — with friends',
  'Arcade · доска проектов': 'Arcade · project board',
  'Сделать': 'To do',
  'В работе': 'Doing',
  'Готово': 'Done',
  'Доска ушла Claude.': 'The board went to Claude.',
  'Claude занят — доска ждёт в поле ввода: отправь её, когда он освободится.': 'Claude is busy — the board is waiting in the prompt box: send it when Claude is free.',
  'Не получилось отдать доску — попробуй ещё раз, когда Claude освободится.': 'Could not pass the board to Claude — try again when Claude is free.',
  'Впиши название доски.': 'Type a board name.',
  'Звать на доску можно только друзей.': 'Only friends can be invited to a board.',
  'Это может только хозяин доски.': 'Only the board owner can do this.',
  'Доски больше нет на сайте или тебя на ней нет — у тебя осталась своя копия.': "The board is no longer on the site or you're no longer on it — you kept your own copy.",
  'На доске уже 20 человек — больше не позвать.': 'The board already has 20 people — no room for more.',
  'Своих общих досок — не больше 3. Больше — скоро по подписке.': 'Up to 3 shared boards of your own. More is coming soon with a subscription.',
  'Досок сегодня создано слишком много — попробуй завтра.': 'Too many boards created today — try tomorrow.',
  'Доска не приняла правки — их слишком много за раз.': "The board didn't take the edits — too many at once.",
  'Общие доски на сайте сейчас выключены.': 'Shared boards are turned off on the site right now.',
  'Открытую карточку удалили на общей доске.': 'The open card was deleted on the shared board.',
  'Доска на сайте полна — часть карточек осталась только у тебя.': 'The board on the site is full — some cards stayed only with you.',
  'Блокнот полон — не все карточки доски поместились.': "The notebook is full — not all of the board's cards fit.",
  'Блокнот полон — не все общие доски поместились.': 'The notebook is full — not all shared boards fit.',
  'Доска общая — друзья увидят её в своей «Доске проектов».': 'The board is shared — friends will see it in their «Project board».',
  'Ты больше не на этой доске — у тебя осталась своя копия.': "You're no longer on this board — you kept your own copy.",
  'Доска удалена с сайта — у тебя и у друзей остались свои копии.': 'The board is deleted from the site — you and your friends each kept a copy.',
  'Впиши название карточки.': 'Type a card name.',
  'Доска проектов из моего блокнота Arcade': 'A project board from my Arcade notebook',
  'колонка': 'column',
  'Добавляй, правь и переноси карточки этой доски инструментом mcp__arcade__notes.': "Add, edit and move this board's cards with the mcp__arcade__notes tool.",
  'общая': 'shared',
  'общая, хозяин': 'shared, owner',
  'карточек': 'cards',
  'Доски с колонками: «Сделать», «В работе», «Готово» или свои. Карточка — страница блокнота с текстом и чек-листом.': 'Boards with columns: «To do», «Doing», «Done» or your own. A card is a notebook page with text and a checklist.',
  'Новая доска': 'New board',
  'название: ремонт, релиз 1.0, переезд…': 'name: renovation, release 1.0, moving…',
  'Доски': 'Boards',
  'Досок пока нет — впиши название новой выше.': 'No boards yet — type a name for a new one above.',
  'Спрашиваю сайт Arcade об общих досках…': 'Asking the Arcade site about shared boards…',
  'Общие доски друзей появляются здесь сами.': "Friends' shared boards show up here by themselves.",
  'Войди через GitHub — и сможешь вести доску вместе с друзьями.': 'Sign in with GitHub — and you can run a board together with friends.',
  'Claude тоже ведёт доски: попроси, например, «разложи задачи релиза по доске в Arcade».': 'Claude runs boards too: ask, for example, «lay out the release tasks on a board in Arcade».',
  'пусто': 'empty',
  'Новая карточка': 'New card',
  'что сделать': 'what to do',
  'Общая доска — ты хозяин.': "Shared board — you're the owner.",
  'Общая доска.': 'Shared board.',
  'Общая доска, хозяин': 'Shared board, owner',
  'Выбрана карточка': 'Card picked',
  'Колонка': 'Column',
  '← Влево': '← Left',
  '↑ Выше': '↑ Up',
  '↓ Ниже': '↓ Down',
  'Вправо →': 'Right →',
  'Открыть': 'Open',
  'Снять выбор': 'Unpick',
  'Нажми на карточку, чтобы выбрать её и переносить стрелками; ещё раз — открыть.': 'Press a card to pick it and move it with the arrows; press again to open it.',
  'Звать друзей на доску можно, когда у тебя есть @ник.': 'You can invite friends to a board once you have a @handle.',
  'Отметь друзей и нажми «Поделиться» — доска станет общей: карточки, колонки и название у всех одни.': 'Tick friends and press «Share» — the board becomes shared: everyone has the same cards, columns and name.',
  'Делюсь…': 'Sharing…',
  'Поделиться': 'Share',
  'Сверяю доску с сайтом Arcade…': 'Syncing the board with the Arcade site…',
  'хозяин доски': 'board owner',
  'Позвать ещё:': 'Invite more:',
  'Зову…': 'Inviting…',
  'Позвать': 'Invite',
  'Друзья позваны.': 'Friends invited.',
  'Нажми ещё раз — удалить с сайта': 'Press again — delete from the site',
  'Нажми ещё раз — выйти с доски': 'Press again — leave the board',
  'Удалить с сайта': 'Delete from the site',
  'Выйти с доски': 'Leave the board',
  '  У тебя и у друзей доска останется — каждому своя копия.': '  You and your friends keep the board — each a copy of your own.',
  '  У тебя останется своя копия доски, у друзей — общая.': '  You keep your own copy of the board, friends keep the shared one.',
  'Удалить доску': 'Delete the board',
  'Доска удалена.': 'The board is deleted.',
  '  Доска удалится вместе с колонками и карточками.': '  The board is deleted with its columns and cards.',
  '  Отмеченные друзья увидят доску у себя и смогут её вести.': '  Ticked friends get the board too and can work on it with you.',
  '← Доски': '← Boards',
  'Доска': 'Board',
  '  Claude получит доску с карточками и сможет добавлять, править и переносить их.': '  Claude gets the board with its cards and can add, edit and move them.',
  'Колонки': 'Columns',
  'Впиши название колонки.': 'Type a column name.',
  'Убрать колонку': 'Remove the column',
  'В колонке есть карточки — сначала перенеси их.': 'The column has cards — move them first.',
  'Последнюю колонку не убрать.': "The last column can't be removed.",
  'Колонка убрана.': 'The column is removed.',
  'Новая колонка': 'New column',
  'название: проверка, на паузе…': 'name: review, on hold…',
  'Колонок — не больше 8.': 'Up to 8 columns.',
  'Общий доступ': 'Sharing',
  'TikTok открыт в браузере по умолчанию.': 'TikTok is open in the default browser.',
  'Открываю браузер…': 'Opening the browser…',
  // Аккаунт: вход через GitHub и общие настройки
  'Arcade · аккаунт': 'Arcade · account',
  'Аккаунт': 'Account',
  'Войти через GitHub': 'Sign in with GitHub',
  '  по желанию: одни настройки на всех компьютерах и свой @ник': '  optional: the same settings on all your computers and your own @handle',
  'Общие для всех компьютеров: язык, клавиши, уведомления, размер панели, что делать с игрой по сигналу агента, свои темы, каналы Twitch и рекорд Flappy Arcade.':
    'Shared across all computers: language, keys, notifications, panel size, what to do with the game when the agent signals, your topics, Twitch channels and your Flappy Arcade best.',
  'Синхронизирую…': 'Syncing…',
  'Настройки синхронизированы.': 'Settings are in sync.',
  'Настройки ещё не синхронизированы.': "Settings haven't been synced yet.",
  'Синхронизировать сейчас': 'Sync now',
  'Синхронизация и вход': 'Sync and sign-in',
  'Выйти': 'Sign out',
  '  на этом компьютере; настройки останутся здесь как есть': '  on this computer; settings stay here as they are',
  'Удалить аккаунт': 'Delete account',
  'Точно удалить? Нажми ещё раз': 'Delete for sure? Press again',
  '  сайт Arcade забудет тебя и твои настройки; здесь всё останется': '  the Arcade site will forget you and your settings; everything here stays',
  'Введи этот код на странице GitHub:': 'Enter this code on the GitHub page:',
  'Открыть страницу GitHub': 'Open the GitHub page',
  '  страница откроется в обычном браузере; после кода GitHub спросит, пустить ли Agent Arcade':
    '  the page opens in your regular browser; after the code GitHub will ask whether to let Agent Arcade in',
  'Жду, когда ты подтвердишь вход на GitHub…': 'Waiting for you to confirm the sign-in on GitHub…',
  'Отмена': 'Cancel',
  'Вход нужен, чтобы настройки были одни на всех твоих компьютерах и чтобы взять свой @ник для сетевых игр. Без входа всё работает.':
    'Signing in keeps your settings the same on all your computers and lets you take your own @handle for online games. Everything works without it.',
  'Arcade узнаёт только имя и картинку профиля GitHub — ни почты, ни доступа к репозиториям.':
    'Arcade only learns your GitHub profile name and picture — no email, no access to repositories.',
  'Страница входа открылась в браузере: подтверди вход на GitHub, потом нажми «Войти» на странице Arcade.':
    'The sign-in page opened in the browser: confirm the sign-in on GitHub, then click “Sign in” on the Arcade page.',
  'Код на странице должен быть таким же:': 'The code on the page should be the same:',
  'Открыть страницу ещё раз': 'Open the page again',
  '  если браузер не открылся или вкладку закрыли': "  if the browser didn't open or the tab was closed",
  'Войти по коду': 'Sign in with a code',
  '  если через браузер войти не выходит': "  if signing in through the browser doesn't work",
  'Жду, когда ты войдёшь в браузере…': 'Waiting for you to sign in in the browser…',
  'Готовлю вход…': 'Getting sign-in ready…',
  'Вход на сайте Arcade ещё не настроен.': "Sign-in isn't set up on the Arcade site yet.",
  'GitHub не принял приложение Arcade — вход пока не работает.': "GitHub didn't accept the Arcade app — sign-in doesn't work for now.",
  'Попыток входа с этого адреса на сегодня слишком много — попробуй завтра.': 'Too many sign-in attempts from this address today — try again tomorrow.',
  'Настройки не поместились на сайте Arcade.': "Settings didn't fit on the Arcade site.",
  'Сайт Arcade не ответил. Попробуй чуть позже.': "The Arcade site didn't answer. Try again a bit later.",
  'Вход на этом компьютере больше не действует — войди через GitHub заново.': 'The sign-in on this computer is no longer valid — sign in with GitHub again.',
  'Вход отменён на GitHub.': 'Sign-in was cancelled on GitHub.',
  'Код истёк — попробуй ещё раз.': 'The code expired — try again.',
  'Вход отменён.': 'Sign-in was cancelled.',
  'Время на вход вышло — попробуй ещё раз.': 'Time to sign in ran out — try again.',
  'Вход через сайт сейчас не работает — войди по коду.': "Signing in through the site doesn't work right now — sign in with a code.",
  'Выход выполнен: на этом компьютере настройки больше не синхронизируются.': 'Signed out: settings on this computer are no longer synced.',
  'Удаляю аккаунт…': 'Deleting the account…',
  'Аккаунт удалён: сайт Arcade забыл тебя и твои настройки. Здесь настройки остались.':
    'Account deleted: the Arcade site forgot you and your settings. Your settings here stay.',
  'Открываю GitHub в браузере — введи там код.': 'Opening GitHub in the browser — enter the code there.',
  'Открываю вход в браузере.': 'Opening sign-in in the browser.',
  'Браузер не открылся — открой адрес выше сам.': "The browser didn't open — open the address above yourself.",
  // @ник в меню аккаунта
  'Ника пока нет.': 'No handle yet.',
  'Ник видят соперники в сетевых партиях настольных игр. Сменить его можно когда угодно.':
    'Opponents see your handle in online board games. You can change it any time.',
  'Сменить ник': 'Change handle',
  'Свой ник': 'Your own handle',
  'латинские буквы, цифры и _, от 4 до 32 знаков': 'Latin letters, digits and _, 4 to 32 characters',
  'Проверяю ник…': 'Checking the handle…',
  'Ник — от 4 до 32 знаков: латинские буквы, цифры и _, первый — буква.':
    'A handle is 4 to 32 characters: Latin letters, digits and _, starting with a letter.',
  'Такой ник взять нельзя — выбери другой.': "This handle can't be taken — choose another one.",
  'Ник сегодня меняли слишком часто — попробуй завтра.': 'The handle was changed too often today — try again tomorrow.',
  // Друзья
  'Arcade · друзья': 'Arcade · friends',
  'Друзья': 'Friends',
  'по @нику: заявки и список друзей; нужен вход через GitHub': 'by @handle: requests and a friends list; needs a GitHub sign-in',
  'сначала возьми свой @ник': 'take your own @handle first',
  'по @нику: заявки и список друзей': 'by @handle: requests and a friends list',
  'позови друзей по их @нику': 'add friends by their @handle',
  'Друзья в Arcade — по @нику: отправь заявку, друг примет её у себя, и вы появитесь в списках друг у друга.': "Friends in Arcade go by @handle: send a request, your friend accepts it on their side, and you appear in each other's lists.",
  'Чтобы список друзей был доступен, войди через GitHub.': 'Sign in with GitHub to have a friends list.',
  'Спрашиваю сайт Arcade…': 'Asking the Arcade site…',
  'Друзья находят друг друга по @нику — сначала возьми свой.': 'Friends find each other by @handle — take yours first.',
  'Ник видят друзья и соперники в сетевых партиях. Сменить его можно когда угодно — друзья останутся.': 'Friends and opponents in online games see your handle. You can change it any time — your friends stay.',
  'Взять @ник': 'Take a @handle',
  'Кого удалить из друзей? Уведомления не будет; у друга ты тоже пропадёшь из списка.': 'Who should be removed from your friends? They get no notification; you also disappear from their list.',
  'Друзья добавляют тебя по нему, а ты их — по их @нику.': 'Friends add you by it, and you add them by their @handle.',
  'Добавить друга': 'Add a friend',
  '@ник друга, точно как есть': "your friend's @handle, exactly",
  'Отправляю заявку…': 'Sending the request…',
  'Подсказок по буквам нет: заявка дойдёт, только если ник написан точно.': 'There are no suggestions as you type: a request only arrives if the handle is spelled exactly.',
  'Заявки тебе': 'Requests for you',
  'Принять': 'Accept',
  'Отклонить': 'Decline',
  'Друзей пока нет — добавь кого-нибудь по @нику.': 'No friends yet — add someone by their @handle.',
  'Загружаю друзей…': 'Loading friends…',
  'Список друзей не загрузился.': "The friends list didn't load.",
  'Удалить друга': 'Remove a friend',
  'Твои заявки': 'Your requests',
  'ждёт ответа': 'awaiting a reply',
  'Отменить': 'Cancel',
  'Это твой ник.': "That's your own handle.",
  'Этой заявки уже нет.': 'This request is gone.',
  'Сначала возьми свой @ник.': 'Take your own @handle first.',
  'Друзей и твоих заявок уже слишком много — удали кого-нибудь.': 'You already have too many friends and requests — remove someone.',
  'Заявок сегодня слишком много — попробуй завтра.': 'Too many requests today — try again tomorrow.',
  // В сети и приглашения в игру
  'в сети': 'online',
  'Зовут сыграть': 'Invitations to play',
  '  своя комната на двоих': '  a room of your own for two',
  '  общее лобби deathmatch': '  the shared deathmatch lobby',
  '  кооператив: лобби игры': '  co-op: the game lobby',
  'Сетевые игры открываются в окне браузера — выбери его в настройках.': 'Online games open in a browser window — choose it in the settings.',
  'Показывать друзьям, что я в сети: да': 'Show friends that I am online: on',
  'Показывать друзьям, что я в сети: нет': 'Show friends that I am online: off',
  // Чаты
  'Arcade · чаты': 'Arcade · chats',
  'Чаты': 'Chats',
  'с друзьями: один на один и группы; нужен вход через GitHub': 'with friends: one-on-one and groups; needs a GitHub sign-in',
  'с друзьями: один на один и группы': 'with friends: one-on-one and groups',
  'Чаты в Arcade — с друзьями: переписка один на один, группы и общий чат со всеми друзьями.':
    'Chats in Arcade are with friends: one-on-one conversations, groups and a shared chat with all your friends.',
  'Чтобы писать друзьям, войди через GitHub.': 'Sign in with GitHub to write to your friends.',
  'Писать друзьям можно, когда у тебя есть @ник — сначала возьми свой.': 'You can write to friends once you have a @handle — take yours first.',
  '← Чаты': '← Chats',
  'Открыть на странице': 'Open as a page',
  'Открываю…': 'Opening…',
  'Чаты открыты во встроенном браузере Claude.': "Chats are open in Claude's built-in browser.",
  'Окно браузера пока не открыть — попробуй через пару секунд.': "The browser window can't be opened yet — try again in a couple of seconds.",
  'Новый чат': 'New chat',
  'Написать': 'Write',
  'Группа': 'Group',
  'Группа: отметь друзей, назови её и нажми «Создать группу».': 'Group: tick friends, name it and press “Create group”.',
  'Название группы': 'Group name',
  'например: шахматный клуб': 'e.g. chess club',
  'Создать группу': 'Create group',
  'Создаю…': 'Creating…',
  'Группа со всеми друзьями': 'Group with all friends',
  'Все друзья': 'All friends',
  'Открываю чат…': 'Opening the chat…',
  'Участники': 'Members',
  'Раньше': 'Earlier',
  'Загружаю…': 'Loading…',
  'Загружаю переписку…': 'Loading the conversation…',
  'Здесь пока пусто — напиши первым.': "It's empty here so far — write first.",
  'Сообщение': 'Message',
  'Отправить': 'Send',
  'Отправляю…': 'Sending…',
  'Переименовать': 'Rename',
  'управляет группой': 'runs the group',
  'Убрать': 'Remove',
  'Добавить друзей': 'Add friends',
  'Выйти из группы': 'Leave the group',
  'Точно выйти? Нажми ещё раз': 'Really leave? Press again',
  'Сохраняю…': 'Saving…',
  'Участник убран.': 'Member removed.',
  'Участник добавлен.': 'Member added.',
  'Название группы изменено.': 'Group renamed.',
  'Ты больше не в этой группе.': "You're no longer in this group.",
  'ты': 'you',
  'удалённый аккаунт': 'deleted account',
  'Чатов пока нет. Нажми «Новый чат» и выбери друга.': 'No chats yet. Press “New chat” and pick a friend.',
  'Загружаю чаты…': 'Loading chats…',
  'Список чатов не загрузился.': "The chat list didn't load.",
  'Выбери чат слева или начни новый.': 'Pick a chat on the left or start a new one.',
  'Переписка хранится на сайте Arcade и не шифруется — не пиши туда пароли и ключи.':
    'Messages are stored on the Arcade site and are not encrypted — never write passwords or keys there.',
  'Переписка не шифруется — не пиши сюда пароли и ключи.': 'Messages are not encrypted — never write passwords or keys here.',
  'Слишком часто — подожди минуту.': 'Too often — wait a minute.',
  'Групп сегодня создано слишком много — попробуй завтра.': 'Too many groups were created today — try again tomorrow.',
  'Писать можно только друзьям.': 'You can only write to friends.',
  'Этого чата больше нет.': 'This chat is gone.',
  'Сообщение длиннее 2000 знаков.': 'The message is longer than 2000 characters.',
  'Назови группу.': 'Name the group.',
  'Отметь хотя бы одного друга.': 'Tick at least one friend.',
  'В группе может быть не больше 50 человек.': 'A group can have at most 50 people.',
  'Это может только тот, кто управляет группой.': 'Only the person who runs the group can do this.',
  'Чаты на сайте сейчас выключены.': 'Chats are switched off on the site right now.',
  // Служебные сообщения группы: {0}, {1} — ники или название, подставляются после перевода
  '{0} создал(а) группу «{1}»': '{0} created the group “{1}”',
  '{0} добавил(а) {1}': '{0} added {1}',
  '{0} убрал(а) {1}': '{0} removed {1}',
  '{0} вышел(а) из группы': '{0} left the group',
  '{0} назвал(а) группу «{1}»': '{0} renamed the group to “{1}”',
  '{0} сменил(а) картинку группы': '{0} changed the group picture',
  '{0} убрал(а) картинку группы': '{0} removed the group picture',
  // Чат как в Telegram: дни в переписке, аватарки и картинка группы
  'Сегодня': 'Today',
  'Вчера': 'Yesterday',
  'Аватарка': 'Avatar',
  'Её видят друзья в чатах. Без неё — первая буква ника.': 'Friends see it in chats. Without one, the first letter of your handle is shown.',
  'Без аватарки': 'No avatar',
  'Сохраняю аватарку…': 'Saving the avatar…',
  'Аватарку меняли слишком часто — подожди минуту.': 'The avatar was changed too often — wait a minute.',
  'Картинка группы': 'Group picture',
  'Без картинки': 'No picture',
  'Картинка группы изменена.': 'Group picture changed.',
  // Направления каталога Twitch (часть — общие с темами YouTube)
  'Искусственный интеллект': 'Artificial intelligence',
  'Бэкенд и базы данных': 'Backend and databases',
  'DevOps и облака': 'DevOps and cloud',
  'Языки программирования': 'Programming languages',
  'Архитектура программ': 'Software architecture',
  'Безопасность': 'Security',
  'Разработка игр': 'Game development',
  'Информатика и алгоритмы': 'Computer science and algorithms',
  'Мобильная разработка': 'Mobile development',
  'Данные и аналитика': 'Data and analytics',
  'Железо и электроника': 'Hardware and electronics',
  'Открытый код': 'Open source',
  'Тестирование': 'Testing',
  'Дизайн': 'Design',
  'Карьера': 'Career',
  'Стартапы': 'Startups',
  'Наука': 'Science',
  'Космос': 'Space',
  'Математика': 'Math',
  'История технологий': 'History of technology',
  'Ретро-игры и ретро-компьютеры': 'Retro games and retro computers',
  'Журнал агента': 'Agent log',
  '▶ Продолжить': '▶ Continue',
  // Настройки
  'Разделы главного меню': 'Main menu sections',
  'Где открывать': 'Where to open',
  'Панель и язык': 'Pane and language',
  'Уведомления': 'Notifications',
  'Клавиши': 'Keys',
  'Играть: показан': 'Play: shown',
  'Играть: скрыт': 'Play: hidden',
  'Читать и слушать: показан': 'Read & listen: shown',
  'Читать и слушать: скрыт': 'Read & listen: hidden',
  'Смотреть: показан': 'Watch: shown',
  'Смотреть: скрыт': 'Watch: hidden',
  'Общение: показан': 'Social: shown',
  'Общение: скрыт': 'Social: hidden',
  'Работа: показан': 'Work: shown',
  'Работа: скрыт': 'Work: hidden',
  'приставки, игры в браузере и твои ROM': 'consoles, browser games and your ROMs',
  'книги, аудиокниги, статьи и подкасты': 'books, audiobooks, articles and podcasts',
  'YouTube, Twitch и TikTok': 'YouTube, Twitch and TikTok',
  'друзья, чаты и аккаунт': 'friends, chats and account',
  'блокнот и доска проектов': 'notebook and project board',
  'Убранного раздела нет в главном меню совсем; «Ещё» с настройками остаётся всегда.': 'A hidden section is gone from the main menu entirely; “More” with the settings always stays.',
  // Приветствие при первом запуске
  'Добро пожаловать в Arcade!': 'Welcome to Arcade!',
  'Пока Claude работает, здесь можно играть, читать и слушать, смотреть видео, общаться с друзьями и вести заметки.': 'While Claude works, you can play here, read and listen, watch videos, chat with friends and keep notes.',
  'Выбери, что показывать в главном меню: нажатие убирает раздел или возвращает его.': 'Choose what to show in the main menu: pressing a section hides it or brings it back.',
  'Язык': 'Language',
  'Передумаешь — разделы меняются в «Ещё → Настройки».': 'Changed your mind? Sections can be changed in “More → Settings”.',
  'Открывать: здесь, в панели': 'Open in: here, in the pane',
  'Открывать: окно браузера по умолчанию': 'Open in: default browser window',
  'Открывать: встроенный браузер Claude': "Open in: Claude's built-in browser",
  'открывать: встроенный браузер Claude': "open in: Claude's built-in browser",
  'рядом с разговором; в авто-режиме игру открывает Claude — он прервётся и вернётся к работе': 'next to the chat; in auto mode Claude opens the game — it stops for a moment and gets back to work',
  'Встроенный браузер Claude не даёт игре захватить мышь, поэтому шутеры открываются окном браузера.': "Claude's built-in browser doesn't let games capture the mouse, so shooters open in a browser window.",
  'Когда открывается браузер: закрывать меню': 'When the browser opens: close the menu',
  'Когда открывается браузер: оставлять меню': 'When the browser opens: keep the menu',
  'закрывать — браузер во всю высоту; оставлять — браузер встаёт под меню Arcade': 'close — the browser gets the full height; keep — the browser sits below the Arcade menu',
  'Агент закончил, пока смотришь: закрыть вкладку': 'Agent finished while you watch: close the tab',
  'Агент закончил, пока смотришь: только сообщить': 'Agent finished while you watch: just let me know',
  '  видео, TikTok, Twitch, статьи и подкасты; закрыть — вкладка закрывается, и перед тобой снова разговор с Claude':
    '  videos, TikTok, Twitch, articles and podcasts; close — the tab closes and the chat with Claude is in front of you again',
  'Агент закончил — вкладку закрыл, перед тобой снова разговор': 'Agent finished — tab closed, the chat is in front of you again',
  'символы или пиксели — зависит от терминала': 'characters or pixels — depends on the terminal',
  'окно встаёт справа от терминала; пауза, пока оно не в фокусе; прогресс сохраняется': 'the window opens to the right of the terminal; paused while unfocused; progress is saved',
  'игра откроется в браузере; пауза, пока окно не в фокусе; прогресс сохраняется': 'the game opens in the browser; paused while unfocused; progress is saved',
  'пиксели — в терминалах с картинками (kitty, Ghostty, Rio), символы — везде': 'pixels — in terminals with images (kitty, Ghostty, Rio), characters — everywhere',
  'Размер панели: во всю ширину': 'Pane size: full width',
  'Размер панели: обычный': 'Pane size: normal',
  'во всю ширину разговор с агентом сжимается в узкую полосу; поправить ширину можно мышью': 'at full width the agent chat shrinks to a narrow strip; you can adjust the width with the mouse',
  'для игры в панели Claude; в окне браузера — системное уведомление': 'for games in the Claude pane; in a browser window you get a system notification',
  'Уведомления, пока играешь в окне: да': 'Notifications while playing in a window: on',
  'Уведомления, пока играешь в окне: нет': 'Notifications while playing in a window: off',
  'системное уведомление со звуком, когда агент закончил или ждёт разрешения': 'a system notification with sound when the agent finishes or asks for permission',
  'Уведомления о сообщениях: да': 'Message notifications: on',
  'Уведомления о сообщениях: нет': 'Message notifications: off',
  'всплывают внизу слева поверх всех окон; клик открывает чат': 'pop up in the bottom left on top of all windows; a click opens the chat',
  'системное уведомление, когда друг пишет в чат': 'a system notification when a friend writes in a chat',
  'Проверка клавиш': 'Key test',
  'поле: видно, что нажато и что мод считает зажатым': 'a field that shows what is pressed and what the mod thinks is held',
  'Назначить клавиши заново': 'Reassign keys',
  'мод попросит нажать клавиши по очереди: вверх, вниз, влево, вправо, A, B, Start, Select': 'the mod will ask you to press keys one by one: up, down, left, right, A, B, Start, Select',
  'Назначаем управление заново.': 'Reassigning the controls.',
  'Управление сохранено.': 'Controls saved.',
  'Похоже, включён метод ввода (японский, китайский или корейский). Выключи его на время игры.': 'An input method (Japanese, Chinese or Korean) seems to be on. Turn it off while playing.',
  // Мои игры
  'Удалить': 'Delete',
  'Пока пусто. Добавь файл игры для Денди (.nes) или Sega Mega Drive (.md, .bin).': 'Nothing here yet. Add a game file for the NES (.nes) or Sega Mega Drive (.md, .bin).',
  'Добавить файл': 'Add a file',
  'путь к .nes, .md или .bin': 'path to a .nes, .md or .bin file',
  'или командой /arcade-add путь — в терминал файл можно просто перетащить после команды': 'or with /arcade-add path — in a terminal you can just drag the file in after the command',
  'Файл остаётся у тебя: мод хранит копию в ~/.claude/arcade и никуда её не отправляет.': 'The file stays with you: the mod keeps a copy in ~/.claude/arcade and never sends it anywhere.',
  'Подключай только файлы, на которые у тебя есть права.': 'Only add files you have the rights to.',
  'Не нашёл домашнюю папку, некуда сохранить копию игры.': 'Could not find the home folder to keep a copy of the game.',
  // Вопрос над полем ввода
  'Здесь': 'Here',
  'Играть': 'Play',
  'В окне': 'In a window',
  'Не сейчас': 'Not now',
  // Игра
  'Кликни по экрану — играть · Esc — к агенту · Backspace — библиотека': 'Click the screen to play · Esc — back to the agent · Backspace — library',
  'Клавиатура — в строке 🎮 над строкой ввода Claude · кнопки — мышью': 'Keyboard — in the 🎮 line above the Claude prompt · buttons — with the mouse',
  'W A S D — движение · K — A · J — B · Enter или N — Start · M — Select · русская раскладка тоже подходит': 'W A S D — move · K — A · J — B · Enter or N — Start · M — Select · the Russian layout works too',
  'кликни — и игра слушает клавиатуру: W A S D, K J, Enter': 'click here and the game listens to your keyboard: W A S D, K J, Enter',
  'Проверка клавиш работает только в терминале.': 'The key test works only in a terminal.',
  'Назначить заново: «Настройки» → «Назначить клавиши заново»': 'To reassign: Settings → Reassign keys',
  'Этот терминал не показывает картинки — рисую символами. Как получить пиксели — в README.': 'This terminal does not show images, so the game is drawn with characters. How to get pixels — see the README.',
  'Открыть Arcade': 'Open Arcade',
  'Arcade · язык': 'Arcade · language',
  'Нажми любую кнопку — взлететь': 'Press any button to take off',
  'Читать и слушать': 'Read & listen',
  'Ещё': 'More',
  // Главное меню 0.25: разделы, поиск, избранное
  'Общение': 'Social',
  '🔍 Найти': '🔍 Search',
  'игры и каналы Twitch': 'games and Twitch channels',
  '★ Избранное': '★ Favorites',
  'отмечай ☆ игры — они соберутся здесь': 'mark games with ☆ — they gather here',
  'отмечай ☆ — соберётся здесь': 'mark with ☆ — it gathers here',
  'поиск': 'search',
  'избранное': 'favorites',
  'Найти': 'Search',
  'название или жанр': 'title or genre',
  'От двух букв: название или жанр. Ищу в играх и каналах Twitch.': 'Two letters or more: a title or genre. I search games and Twitch channels.',
  'Ничего не нашлось — попробуй другое слово.': 'Nothing found — try another word.',
  'канал Twitch': 'Twitch channel',
  'Пока пусто. Отмечай звёздочкой ☆ игры — они соберутся здесь.': 'Nothing here yet. Mark games with the ☆ star — they gather here.',
  // Отчёты об ошибках 0.25: отправить — всем, список — только админу
  'Arcade · отчёт об ошибке': 'Arcade · bug report',
  'Arcade · отчёты об ошибках': 'Arcade · bug reports',
  '🐞 Сообщить об ошибке': '🐞 Report a bug',
  'что сломалось — прямо автору Arcade': 'what broke — straight to the author of Arcade',
  '📋 Отчёты об ошибках': '📋 Bug reports',
  'видишь только ты: ты админ Arcade': "only you see this: you're an Arcade admin",
  'Что сломалось? Опиши, что ты делал и что пошло не так.': 'What broke? Describe what you were doing and what went wrong.',
  'Отчёты читает только автор Arcade. Не пиши пароли, ключи и личные данные.': "Only the author of Arcade reads reports. Don't include passwords, keys or personal data.",
  'Отчёт': 'Report',
  'например: шашки зависают после хода дамкой': 'for example: checkers freezes after a king moves',
  'Отправляю отчёт…': 'Sending the report…',
  'К отчёту приложится версия Arcade, где он открыт, язык интерфейса и система — больше ничего.': "The report includes the Arcade version, where it's open, the interface language and the OS — nothing else.",
  'Со входом через GitHub отчёт подписан твоим аккаунтом.': "You're signed in with GitHub, so the report is signed with your account.",
  'Без входа отчёт уйдёт без подписи.': "You're not signed in, so the report goes unsigned.",
  'Напиши, что сломалось.': 'Describe what broke.',
  'Отчёт длиннее 2000 знаков — сократи его.': 'The report is longer than 2000 characters — shorten it.',
  'Отчётов от тебя сегодня уже много — попробуй завтра.': "You've sent a lot of reports today — try again tomorrow.",
  'Сегодня отчётов пришло слишком много — попробуй завтра.': 'Too many reports came in today — try again tomorrow.',
  'Отчёты на сайте сейчас выключены.': 'Reports are turned off on the site right now.',
  'Список отчётов — только у автора Arcade.': 'Only the author of Arcade can see the list of reports.',
  'Этот отчёт уже закрыт.': 'This report is already closed.',
  'Отчёт не ушёл — отправь его ещё раз: теперь он уйдёт без подписи.': "The report wasn't sent — send it again: now it will go unsigned.",
  'Спасибо! Отчёт отправлен.': 'Thanks! The report has been sent.',
  'Закрытый отчёт сайт удаляет. Здесь — последние 50, новые сверху.': 'The site deletes a report once it is closed. Here: the latest 50, newest first.',
  'Открытых отчётов нет.': 'No open reports.',
  'Загружаю отчёты…': 'Loading reports…',
  'Список отчётов не загрузился.': "The list of reports didn't load.",
  'Закрыть': 'Close',
  'Закрываю…': 'Closing…',
  'без подписи': 'unsigned',
  'Отчёт закрыт.': 'Report closed.',
  // Плитка Desktop: длинное описание — целиком по кнопке
  'ещё': 'more',
  'свернуть': 'less',
  // Группы и полки каталога: названия приходят с сайта по-русски
  'Игры': 'Games',
  'Книги': 'Books',
  'Аркады': 'Arcade games',
  'Шутеры': 'Shooters',
  'Гонки': 'Racing',
  'Стратегии': 'Strategy',
  'Квесты': 'Adventures',
  'Настольные': 'Board games',
  'Браузерные': 'Browser games',
  'Аудиокниги': 'Audiobooks',
  'Мои аудиокниги': 'My audiobooks',
  // Книги и аудиокниги 0.31: с открытых библиотек, язык книг выбирает человек
  'Мои книги': 'My books',
  'классика на любом языке: разделы и поиск': 'classics in any language: sections and search',
  'LibriVox: слушать сразу или скачать': 'LibriVox: listen right away or download',
  'Книги и аудиокниги будут на этом языке. Язык интерфейса не меняется.': "Books and audiobooks will be in this language. The interface language doesn't change.",
  'разделы и поиск — на этом языке': 'sections and search — in this language',
  'скачанные в окне Arcade — читать без интернета': 'downloaded in the Arcade window — read offline',
  'скачанные в окне Arcade — слушать без интернета': 'downloaded in the Arcade window — listen offline',
  'название или автор': 'title or author',
  'Разделы': 'Sections',
  'Поиск': 'Search',
  'Напиши хотя бы две буквы.': 'Type at least two letters.',
  'Загружаю список…': 'Loading the list…',
  'Ничего не нашлось — попробуй другое слово или язык.': 'Nothing found — try another word or language.',
  'Ещё раз': 'Try again',
  'Викитека': 'Wikisource',
  'нет связи': 'no connection',
  'не тот ответ': 'unexpected response',
  'Книги — из Project Gutenberg и Викитеки, свободные от авторских прав. Arcade их не хранит: книга открывается в окне, скачать её к себе можно там же.':
    "Books come from Project Gutenberg and Wikisource and are free of copyright. Arcade doesn't store them: a book opens in the window, and you can download it there too.",
  'Аудиокниги — из LibriVox: их читают вслух добровольцы, записи свободны. Arcade их не хранит: слушать можно сразу в окне, скачать — там же.':
    "Audiobooks come from LibriVox: volunteers read them aloud, and the recordings are free. Arcade doesn't store them: listen right away in the window, or download them there.",
  'Книга открыта во встроенном браузере Claude.': "The book is open in Claude's built-in browser.",
  'Аудиокнига открыта во встроенном браузере Claude.': "The audiobook is open in Claude's built-in browser.",
  '«Мои книги» открыты во встроенном браузере Claude.': "My books are open in Claude's built-in browser.",
  '«Мои аудиокниги» открыты во встроенном браузере Claude.': "My audiobooks are open in Claude's built-in browser.",
  // Разделы книг (Наука — выше)
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
  'Путешествия': 'Travel',
  'свои файлы': 'your files',
  // Названия игр каталога, которые приходят с сайта только по-русски
  'Шахматы': 'Chess',
  'Русские шашки': 'Russian checkers',
  'Реверси': 'Reversi',
  'Го': 'Go',
  'Классические квесты': 'Classic adventures',
  'FreeDM — сетевой deathmatch': 'FreeDM — network deathmatch',
  'BlasphDM — сетевой deathmatch': 'BlasphDM — network deathmatch',
  'язык интерфейса — 13 на выбор': 'interface language — 13 to choose from',
  '☕ Поддержать проект': '☕ Support the project',
  'Открываю страницу поддержки в браузере. Спасибо!': 'Opening the support page in your browser. Thank you!',
  // Жанры каталога
  'аркада': 'arcade',
  'найди пару': 'memory',
  'без спешки': 'relaxed',
  'платформер': 'platformer',
  'экшен': 'action',
  'приключение': 'adventure',
  'головоломка': 'puzzle',
  'гонки': 'racing',
  'шутер': 'shooter',
  'шуточный симулятор': 'comedy sim',
  'файтинг': 'fighting',
  'арканоид': 'brick breaker',
  'стратегия': 'strategy',
  'песочница': 'sandbox',
  'квест': 'adventure',
  'градостроитель': 'city builder',
  'Arcade: добавить свою игру — файл ROM Денди или Sega': 'Arcade: add your own game — a NES or Sega ROM file',
  'путь к файлу .nes, .md или .bin': 'path to a .nes, .md or .bin file',
}

const SIGNAL = { 'плашка, игра идёт': 'banner, game keeps running', 'пауза и плашка': 'pause and banner', 'сразу к агенту': 'straight back to the agent' }
const GRAPHICS = { авто: 'auto', пиксели: 'pixels', символы: 'characters' }
const WORDS = { вверх: 'up', вниз: 'down', влево: 'left', вправо: 'right', движение: 'move', прицел: 'aim', огонь: 'fire', 'или стрелки': 'or arrows' }

const dur = (t) => t.replace(/(\d+) ч/g, '$1 h').replace(/(\d+) мин/g, '$1 min').replace(/(\d+) с(?![а-я])/g, '$1 s')
const games = (n) => `${n} ${Number(n) === 1 ? 'game' : 'games'}`
// Кто ждёт: варианты настольных — «7 мин», «без таймера», «9×9»
const waiting = (t) => t.replace(/без таймера/g, 'no timer').replace(/(\d+) мин(?![а-яё])/g, '$1 min').replace(/Шахматы/g, 'Chess').replace(/Шашки/g, 'Checkers').replace(/Реверси/g, 'Reversi').replace(/Го:/g, 'Go:')
const words = (t) => Object.entries(WORDS).reduce((s, [ru, en]) => s.split(ru).join(en), t)
const where = (t) =>
  t
    .replace('браузере по умолчанию', 'the default browser')
    .replace('окне браузера по умолчанию', 'the default browser window')
    .replace(/^обычном окне (.+)$/, 'a regular $1 window')
    .replace(/^окне (.+)$/, 'a $1 window')
const reason = (t) =>
  t
    .replace(/^файл не найден: (.+)$/, 'file not found: $1')
    .replace(/^это не файл$/, 'this is not a file')
    .replace(/^это архив\. Распакуй его и укажи путь к самому файлу игры: (.+)$/, (_, list) => `this is an archive. Unpack it and give the path to the game file itself: ${list.replace(' или ', ' or ')}`)
    .replace(/^файл больше 4 МБ\..*$/, 'the file is larger than 4 MB. NES and Sega games are added here; PlayStation discs are added in the Arcade window: PlayStation → “Open PlayStation in a window”')
    .replace(/^это не похоже на игру.*$/, 'this does not look like a NES, Sega Mega Drive or Master System game')
    .replace(/^это игра для Game Gear.*$/, 'this is a Game Gear game — Game Gear is not supported in Arcade')
    .replace(/^это файл Doom \(WAD\)\..*$/, 'this is a Doom file (WAD). Add those in the Arcade window: Games → Shooters → “Open your own file”')
    .replace(/^картридж с маппером (\d+) наш эмулятор Денди пока не поддерживает$/, 'our NES emulator does not support mapper $1 yet')

const RULES = [
  [/^Агент работает (.+) — сыграть\? В сети ждут: (.+)$/, (m) => `Agent has been working for ${dur(m[1])} — play? Waiting online: ${waiting(m[2])}`],
  [/^Агент работает (.+) — сыграть\?$/, (m) => `Agent has been working for ${dur(m[1])} — play?`],
  [/^Присоединиться: (.+)$/, (m) => `Join: ${m[1]}`],
  [/^Язык: (.+)$/, (m) => `Language: ${m[1]}`],
  [/^Твой ник: @(.+)$/, (m) => `Your handle: @${m[1]}`],
  [/^Взять @(.+)$/, (m) => `Take @${m[1]}`],
  [/^@(.+) уже занят — выбери другой\.$/, (m) => `@${m[1]} is taken — choose another one.`],
  [/^заявок тебе: (\d+) · друзей: (\d+)$/, (m) => `requests for you: ${m[1]} · friends: ${m[2]}`],
  [/^друзей: (\d+)$/, (m) => `friends: ${m[1]}`],
  [/^@(.+) не найден — проверь ник\.$/, (m) => `@${m[1]} not found — check the handle.`],
  [/^У @(.+) слишком много заявок — попробуй позже\.$/, (m) => `@${m[1]} has too many requests — try again later.`],
  [/^Заявка отправлена: @(.+) увидит её у себя в «Друзьях»\.$/, (m) => `Request sent: @${m[1]} will see it in their “Friends”.`],
  [/^Теперь вы с @(.+) друзья\.$/, (m) => `You and @${m[1]} are friends now.`],
  [/^Заявка от @(.+) отклонена\.$/, (m) => `Request from @${m[1]} declined.`],
  [/^Заявка для @(.+) отменена\.$/, (m) => `Request to @${m[1]} cancelled.`],
  [/^@(.+) больше не в друзьях\.$/, (m) => `@${m[1]} is no longer your friend.`],
  [/^друзей: (\d+) · в сети: (\d+)$/, (m) => `friends: ${m[1]} · online: ${m[2]}`],
  [/^@(.+) зовёт сыграть: (.+)$/, (m) => `@${m[1]} invites you to play: ${tr(m[2], 'en')}`],
  [/^Приглашение для @(.+) отправлено: (.+)\. Оно действует (\d+) минут\.$/, (m) => `Invitation sent to @${m[1]}: ${tr(m[2], 'en')}. It is valid for ${m[3]} minutes.`],
  [/^Во что позвать @(.+)\?$/, (m) => `What to play with @${m[1]}?`],
  [/^Друг увидит приглашение в Arcade, когда меню открыто, — оно действует (\d+) минут\. Игра откроется и у тебя\.$/, (m) =>
    `Your friend will see the invitation in Arcade while the menu is open — it is valid for ${m[1]} minutes. The game will open for you too.`],
  [/^ещё приглашений: (\d+) — в «Друзьях»$/, (m) => `more invitations: ${m[1]} — in “Friends”`],
  [/^непрочитанных: (\d+)$/, (m) => `unread: ${m[1]}`],
  [/^участники: (\d+)$/, (m) => `members: ${m[1]}`],
  [/^участники: (\d+), в сети: (\d+)$/, (m) => `members: ${m[1]}, online: ${m[2]}`],
  [/^Чаты открыты в (.+)\.$/, (m) => `Chats are open in ${where(m[1])}.`],
  [/^в сети ждут: (.+)$/, (m) => `waiting online: ${waiting(m[1])}`],
  [/^отмечено: (\d+)$/, (m) => `marked: ${m[1]}`],
  [/^найдено: (\d+)$/, (m) => `found: ${m[1]}`],
  [/^Показаны первые (\d+) — уточни запрос\.$/, (m) => `Showing the first ${m[1]} — narrow the search.`],
  [/^В избранном уже (\d+) — сними звёздочку с чего-нибудь\.$/, (m) => `Favorites already has ${m[1]} — unstar something first.`],
  [/^Открытых отчётов: (\d+)$/, (m) => `Open reports: ${m[1]}`],
  [/^★ (.+)$/, (m) => `★ ${tr(m[1], 'en')}`], // избранное группы или полки: «★ Игры»
  // Flappy Arcade
  [/^Удар! Счёт: (\d+) · рекорд: (\d+) — любая кнопка, ещё раз$/, (m) => `Crash! Score: ${m[1]} · best: ${m[2]} — any button to try again`],
  [/^Счёт: (\d+) · рекорд: (\d+)$/, (m) => `Score: ${m[1]} · best: ${m[2]}`],
  [/^взмах — любая кнопка: (.+) или (.+)$/, (m) => `flap — any button: ${m[1]} or ${m[2]}`],
  [/^Arcade · (.+)$/, (m) => `Arcade · ${tr(m[1], 'en')}`], // заголовок списка: «Arcade · Книги»
  [/^добровольно, на развитие Arcade — (.+)$/, (m) => `voluntary, for Arcade’s development — ${m[1]}`],
  [/^Страница поддержки: (.+)$/, (m) => `Support page: ${m[1]}`],
  [/^Агент работает (.+)$/, (m) => `Agent has been working for ${dur(m[1])}`],
  [/^(\d+) (игра|игры|игр)$/, (m) => games(m[1])],
  [/^Графика: (\S+)(.*)$/, (m) => `Graphics: ${GRAPHICS[m[1]] ?? m[1]}${m[2].replace('сейчас', 'now').replace('пиксели', 'pixels').replace('символы', 'characters')}`],
  [/^Открывать: (окно .+)$/, (m) => `Open in: ${opener(m[1])}`],
  [/^Игры открываются (.+)\.$/, (m) =>
    `Games open ${m[1] === 'здесь, в панели' ? 'here, in the pane' : m[1] === 'во встроенном браузере Claude' ? "in Claude's built-in browser" : `in ${where(m[1].replace(/^в /, ''))}`}.`],
  [/^Когда агент закончил: (.+)$/, (m) => `When the agent finishes: ${SIGNAL[m[1]] ?? m[1]}`],
  [/^Когда агент ждёт разрешения: (.+)$/, (m) => `When the agent asks for permission: ${SIGNAL[m[1]] ?? m[1]}`],
  [/^Открыть (.+) в окне$/, (m) => `Open ${tr(m[1], 'en')} in a window`],
  [/^Окно Arcade открыто на вкладке (.+)\.$/, (m) => `The Arcade window is open on the ${tr(m[1], 'en')} tab.`],
  [/^Игры (.+) идут в окне браузера, а здесь его открыть нельзя\.$/, (m) => `${m[1]} games run in a browser window, and it can't be opened here.`],
  [/^(.+) идёт в окне браузера, а здесь его открыть нельзя\.$/, (m) => `${tr(m[1], 'en')} runs in a browser window, and it can't be opened here.`],
  [/^Добавлено: (.+) \((.+)\)\.$/, (m) => `Added: ${m[1]} (${m[2] === 'Денди' ? 'NES' : m[2]}).`],
  [/^«(.+)» уже есть в «Моих играх»\.$/, (m) => `“${m[1]}” is already in My games.`],
  [/^Удалено: (.+)\.$/, (m) => `Deleted: ${m[1]}.`],
  [/^Не получилось добавить: (.+)$/, (m) => `Could not add it: ${reason(m[1])}`],
  [/^Укажи путь к файлу: .+$/, () => 'Give the path to the file: /arcade-add C:\\Games\\game.nes — or drag the file into the terminal after the command.'],
  [/^Денди — твой файл, хранится только у тебя$/, () => 'NES — your file, kept only on your computer'],
  [/^(.+) — твой файл, хранится только у тебя$/, (m) => `${m[1]} — your file, kept only on your computer`],
  [/^Скачиваю (.+)…$/, (m) => `Downloading ${m[1]}…`],
  [/^Не получилось скачать (.+): (.+)$/, (m) => `Could not download ${m[1]}: ${m[2].replace('файл повреждён', 'the file is damaged').replace(/^сайт ответил (\d+)$/, 'the site answered $1')}`],
  [/^Файл игры «(.+)» не найден — добавь его снова: .+$/, (m) => `The file of “${m[1]}” is missing — add it again: /arcade-add path to the file`],
  [/^(.+) открыт в (.+)\. Игра стоит на паузе, пока окно не в фокусе\.$/, (m) => `${m[1]} is open in ${where(m[2])}. The game is paused while the window is not in focus.`],
  [/^Arcade открыт в (.+): выбирай приставку и игру\.$/, (m) => `Arcade is open in ${where(m[1])}: pick a console and a game.`],
  [/^(.+) открыт во встроенном браузере Claude\.$/, (m) => `${m[1]} is open in Claude's built-in browser.`],
  [/^Видео открыто в (.+)\.$/, (m) => `The video is open in ${where(m[1])}.`],
  [/^Видео открываются (.+)\.$/, (m) => `Videos open ${m[1] === 'во встроенном браузере Claude' ? "in Claude's built-in browser" : `in ${where(m[1].replace(/^в /, ''))}`}.`],
  [/^Видео: (https:\/\/\S+)$/, (m) => `Video: ${m[1]}`],
  [/^Не получилось загрузить видео: (.+)$/, (m) => `Could not load videos: ${m[1]}`],
  [/^Статья открыта в (.+)\.$/, (m) => `The article is open in ${where(m[1])}.`],
  [/^Книга открыта в (.+)\.$/, (m) => `The book is open in ${where(m[1])}.`],
  [/^Аудиокнига открыта в (.+)\.$/, (m) => `The audiobook is open in ${where(m[1])}.`],
  [/^«Мои книги» открыты в (.+)\.$/, (m) => `My books are open in ${where(m[1])}.`],
  [/^«Мои аудиокниги» открыты в (.+)\.$/, (m) => `My audiobooks are open in ${where(m[1])}.`],
  [/^Книги открываются (.+)\.$/, (m) => `Books open ${m[1] === 'во встроенном браузере Claude' ? "in Claude's built-in browser" : `in ${where(m[1].replace(/^в /, ''))}`}.`],
  [/^Аудиокниги открываются (.+)\.$/, (m) => `Audiobooks open ${m[1] === 'во встроенном браузере Claude' ? "in Claude's built-in browser" : `in ${where(m[1].replace(/^в /, ''))}`}.`],
  [/^Язык книг: (.+)$/, (m) => `Book language: ${m[1]}`],
  [/^Список не загрузился: (.+)$/, (m) => `The list didn't load: ${tr(m[1], 'en')}`],
  [/^сервер ответил (\d+)$/, (m) => `the server answered ${m[1]}`],
  [/^Открой в браузере: (https:\/\/\S+)$/, (m) => `Open in a browser: ${m[1]}`],
  [/^Выпуск открыт в (.+)\.$/, (m) => `The episode is open in ${where(m[1])}.`],
  [/^Статьи открываются (.+)\.$/, (m) => `Articles open ${m[1] === 'во встроенном браузере Claude' ? "in Claude's built-in browser" : `in ${where(m[1].replace(/^в /, ''))}`}.`],
  [/^Выпуски открываются (.+)\.$/, (m) => `Episodes open ${m[1] === 'во встроенном браузере Claude' ? "in Claude's built-in browser" : `in ${where(m[1].replace(/^в /, ''))}`}.`],
  [/^Статья: (https:\/\/\S+)$/, (m) => `Article: ${m[1]}`],
  [/^Выпуск: (https:\/\/\S+)$/, (m) => `Episode: ${m[1]}`],
  [/^Не получилось загрузить статьи: (.+)$/, (m) => `Could not load articles: ${m[1]}`],
  [/^Не получилось загрузить выпуски: (.+)$/, (m) => `Could not load episodes: ${m[1]}`],
  [/^Трансляция открыта в (.+)\.$/, (m) => `The stream is open in ${where(m[1])}.`],
  [/^Трансляции открываются (.+)\.$/, (m) => `Streams open ${m[1] === 'во встроенном браузере Claude' ? "in Claude's built-in browser" : `in ${where(m[1].replace(/^в /, ''))}`}.`],
  [/^Трансляция: (https:\/\/\S+)$/, (m) => `Stream: ${m[1]}`],
  [/^Канал добавлен: (.+)\.$/, (m) => `Channel added: ${m[1]}.`],
  [/^Канал убран: (.+)\.$/, (m) => `Channel removed: ${m[1]}.`],
  [/^в эфире · зрители: (.+)$/, (m) => `live · viewers: ${m[1]}`],
  [/^в эфире · (.+) · зрители: (.+)$/, (m) => `live · ${m[1]} · viewers: ${m[2]}`],
  // Просьба в поле ввода для Claude в Desktop: адрес не переводим
  [/^Открой во встроенном браузере: (.+)$/, (m) => `Open in the built-in browser: ${m[1]}`],
  [/^Попроси Claude открыть во встроенном браузере: (.+)$/, (m) => `Ask Claude to open this in the built-in browser: ${m[1]}`],
  [/^Не получилось открыть окно: (.+)$/, (m) => `Could not open the window: ${m[1].replace(/^код (\d+)$/, 'code $1')}`],
  [/^Пауза: (агент ждёт разрешения|агент закончил)\. Любая клавиша игры — играть дальше, Esc — к агенту$/,
    (m) => `Paused: ${m[1] === 'агент закончил' ? 'the agent finished' : 'the agent is waiting for permission'}. Any game key — keep playing, Esc — back to the agent`],
  [/^Не узнаю клавишу «(.+)»\. Назначим управление под твою раскладку\.$/, (m) => `I don't recognize the key “${m[1]}”. Let's set up the controls for your layout.`],
  [/^(.*)Нажми клавишу для «(.+)» \((\d+) из (\d+)\)$/, (m) => `${tr(m[1].trim(), 'en')} Press the key for “${words(m[2])}” (${m[3]} of ${m[4]})`.trim()],
  [/^Нажатия: (.*)$/, (m) => `Pressed: ${m[1]}`],
  [/^Зажато: (.*)$/, (m) => `Held: ${m[1]}`],
  [/^Клавиши: (.*)$/, (m) => `Keys: ${words(m[1])}`],
  [/^(.+) — этот терминал не показывает картинки$/, (m) => `${m[1]} — this terminal does not show images`],
  [/^(движение|прицел) .+$/, (m) => words(m[0])],
  [/^(.+) · графика: (\S+)$/, (m) => `${place(m[1])} · graphics: ${GRAPHICS[m[2]] ?? m[2]}`],
  [/^открывать: (.+)$/, (m) => `open in: ${opener(m[1])}`],
  // Журнал событий: «12:00:05 агент начал ход»
  [/^(\d\d:\d\d(?::\d\d)?) (.+)$/, (m) => `${m[1]} ${EVENTS[m[2]] ?? event(m[2])}`],
]

const EVENTS = { 'агент начал ход': 'the agent started a turn', 'агент закончил ход': 'the agent finished the turn', 'агент снова работает': 'the agent is working again' }
const event = (t) =>
  t
    .replace(/^запрос разрешения: (.+)$/, (_, tool) => `permission request: ${tool === 'инструмент' ? 'a tool' : tool}`)
    .replace(/^каталог с сайта не получен: (.+)$/, 'could not get the catalog from the site: $1')
    .replace(/^не удалось найти браузеры: (.+)$/, 'could not find browsers: $1')
    .replace(/^уведомление не показалось: (.+)$/, 'the notification did not show: $1')
    .replace(/^ошибка мода: (.+)$/, 'mod error: $1')
const opener = (t) => {
  const note = (x) => ({ 'ищу браузеры…': 'looking for browsers…', 'обычное окно браузера': 'a regular browser window' })[x] ?? x
  const byDefault = t.match(/^окно браузера по умолчанию(?: \((.+)\))?$/)
  if (byDefault) return `default browser window${byDefault[1] ? ` (${note(byDefault[1])})` : ''}`
  const named = t.match(/^окно (.+?)(?: \((обычное окно браузера|ищу браузеры…)\))?$/)
  if (named) return `${named[1]} window${named[2] ? ` (${note(named[2])})` : ''}`
  return t
}
const place = (t) =>
  t === 'играть здесь, в панели' ? 'play here, in the pane' : t.startsWith('открывать: ') ? `open in: ${where(t.slice(11).replace(/^в /, ''))}` : t

export function tr(text, lang = 'ru') {
  if (lang === 'ru' || typeof text !== 'string') return text
  const en = trEn(text)
  return lang === 'en' ? en : fromEnglish(en, lang)
}

// Фразы словаря с отступом ('  по желанию: …') — ещё и без него: плитка Desktop переводит описание уже обрезанным
const TRIMMED = Object.fromEntries(
  Object.entries(EXACT)
    .filter(([key]) => key !== key.trim())
    .map(([key, out]) => [key.trim(), out.trim()]),
)

function trEn(text) {
  if (!/[А-Яа-яЁё]/.test(text)) return text
  const lead = text.match(/^\s*/)[0]
  const trail = text.match(/\s*$/)[0]
  const exact = EXACT[text] ?? EXACT[text.trim()] ?? TRIMMED[text.trim()]
  if (exact !== undefined) return EXACT[text] !== undefined ? exact : `${lead}${exact}${trail}`
  const core = text.trim()
  for (const [re, make] of RULES) {
    const m = core.match(re)
    if (m) return `${lead}${make(m)}${trail}`
  }
  return text
}

// Чужой текст в интерфейсе (название видео, тема от модели) переводить нельзя: словарь заменил бы в нём слова.
// keep(узел) — узел и всё внутри него translateTree оставляет как есть
const KEPT = new WeakSet()
// Узел помечен keep — его текст не переводится
export function isKept(node) {
  return Boolean(node && typeof node === 'object' && KEPT.has(node))
}
export function keep(node) {
  if (node && typeof node === 'object') KEPT.add(node)
  return node
}

// Перевод готового дерева интерфейса: строки-дети, подписи кнопок, подписи и подсказки полей
export function translateTree(node, lang) {
  if (lang === 'ru' || node == null) return node
  if (typeof node === 'string') return tr(node, lang)
  if (KEPT.has(node)) return node
  if (Array.isArray(node)) return node.map((n) => translateTree(n, lang))
  if (typeof node !== 'object') return node
  const out = { ...node }
  if (node.props && typeof node.props === 'object') {
    out.props = { ...node.props }
    for (const key of ['label', 'placeholder', 'alt']) if (typeof out.props[key] === 'string') out.props[key] = tr(out.props[key], lang)
  }
  if (Array.isArray(node.children)) out.children = node.children.map((c) => translateTree(c, lang))
  return out
}

// --- Остальные языки: перевод английской строки ------------------------------------------------------------------
// locales/<язык>.js: exact — английская фраза → перевод; templates — английский шаблон с {0}, {1} → перевод
// (подставленное переводится тем же способом; {0#one=# игра;few=# игры;other=# игр} — форма числа по
// Intl.PluralRules); words — пары для подсказок клавиш. Чего нет в переводе — остаётся по-английски.
const compiled = new Map()
// Для тестов и смены переводов на лету: забыть разобранные шаблоны
export function resetLocaleCache() {
  compiled.clear()
}
function templatesOf(lang) {
  if (compiled.has(lang)) return compiled.get(lang)
  const list = Object.entries(LOCALES[lang]?.templates ?? {})
    .filter(([, out]) => typeof out === 'string' && out)
    .map(([key, out]) => {
      const parts = key.split(/(\{\d+\})/)
      const re = new RegExp(`^${parts.map((p) => (/^\{\d+\}$/.test(p) ? '(.+?)' : p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))).join('')}$`)
      return { re, out, order: [...key.matchAll(/\{(\d+)\}/g)].map((m) => Number(m[1])), weight: key.replace(/\{\d+\}/g, '').length }
    })
    .sort((a, b) => b.weight - a.weight)
  compiled.set(lang, list)
  return list
}
function pluralForm(n, forms, lang) {
  const map = Object.fromEntries(forms.split(';').map((p) => [p.slice(0, p.indexOf('=')).trim(), p.slice(p.indexOf('=') + 1)]))
  const cat = new Intl.PluralRules(lang).select(Number(String(n).replace(/\D/g, '')) || 0)
  return (map[cat] ?? map.other ?? '').replace(/#/g, n)
}
export function fromEnglish(en, lang) {
  const L = LOCALES[lang]
  if (!L || typeof en !== 'string' || !en.trim()) return en
  const lead = en.match(/^\s*/)[0]
  const trail = en.match(/\s*$/)[0]
  const core = en.trim()
  if (L.exact?.[core]) return lead + L.exact[core] + trail
  const time = core.match(/^(\d\d:\d\d(?::\d\d)?) (.+)$/)
  if (time) return `${lead}${time[1]} ${fromEnglish(time[2], lang)}${trail}`
  for (const t of templatesOf(lang)) {
    const m = core.match(t.re)
    if (!m) continue
    const values = {}
    t.order.forEach((idx, k) => {
      values[idx] = m[k + 1]
    })
    return lead + t.out.replace(/\{(\d+)(?:#([^}]*))?\}/g, (_, idx, forms) => (forms ? pluralForm(values[idx], forms, lang) : fromEnglish(values[idx], lang))) + trail
  }
  let out = core
  for (const [a, b] of L.words ?? []) out = out.split(a).join(b)
  return lead + out + trail
}
