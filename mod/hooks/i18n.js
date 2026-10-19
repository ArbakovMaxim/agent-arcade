// Язык интерфейса мода: русский (на нём написан код) или английский.
// Перевод делается по готовому дереву интерфейса: точные строки — по словарю, строки с подстановками — по шаблонам.
// Что не переведено, остаётся по-русски — интерфейс от этого не ломается.

export const LANGS = ['ru', 'en']

// Язык по окружению: LANG, LC_ALL, LC_MESSAGES. Без подсказок — русский, как было до выбора языка.
export function detectLang(...values) {
  for (const v of values) {
    if (typeof v === 'string' && v.trim()) return /^(ru|uk|be)/i.test(v.trim()) ? 'ru' : 'en'
  }
  return 'ru'
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
  'пока ничего': 'nothing yet',
  // Настройки
  'Язык: русский': 'Language: Russian',
  'Язык: English': 'Language: English',
  'Открывать: здесь, в панели': 'Open in: here, in the pane',
  'Открывать: окно браузера по умолчанию': 'Open in: default browser window',
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
  'Arcade: добавить свою игру — файл ROM Денди или Sega': 'Arcade: add your own game — a NES or Sega ROM file',
  'путь к файлу .nes, .md или .bin': 'path to a .nes, .md or .bin file',
}

const SIGNAL = { 'плашка, игра идёт': 'banner, game keeps running', 'пауза и плашка': 'pause and banner', 'сразу к агенту': 'straight back to the agent' }
const GRAPHICS = { авто: 'auto', пиксели: 'pixels', символы: 'characters' }
const WORDS = { вверх: 'up', вниз: 'down', влево: 'left', вправо: 'right', движение: 'move', прицел: 'aim', огонь: 'fire', 'или стрелки': 'or arrows' }

const dur = (t) => t.replace(/(\d+) ч/g, '$1 h').replace(/(\d+) мин/g, '$1 min').replace(/(\d+) с(?![а-я])/g, '$1 s')
const games = (n) => `${n} ${Number(n) === 1 ? 'game' : 'games'}`
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
    .replace(/^это архив\. Распакуй его и укажи путь к самому файлу игры: (.+)$/, 'this is an archive. Unpack it and give the path to the game file itself: $1')
    .replace(/^файл больше 4 МБ\..*$/, 'the file is larger than 4 MB. NES and Sega games are added here; PlayStation discs are added in the Arcade window: PlayStation → “Open PlayStation in a window”')
    .replace(/^это не похоже на игру.*$/, 'this does not look like a NES, Sega Mega Drive or Master System game')
    .replace(/^это игра для Game Gear.*$/, 'this is a Game Gear game — Game Gear is not supported in Arcade')
    .replace(/^это файл Doom \(WAD\)\..*$/, 'this is a Doom file (WAD). Add those in the Arcade window: Doom tab → “Open your own file”')
    .replace(/^картридж с маппером (\d+) наш эмулятор Денди пока не поддерживает$/, 'our NES emulator does not support mapper $1 yet')

const RULES = [
  [/^Агент работает (.+) — сыграть\? В сети ждут: (.+)$/, (m) => `Agent has been working for ${dur(m[1])} — play? Waiting online: ${m[2]}`],
  [/^Агент работает (.+) — сыграть\?$/, (m) => `Agent has been working for ${dur(m[1])} — play?`],
  [/^Присоединиться: (.+)$/, (m) => `Join: ${m[1]}`],
  [/^в сети ждут: (.+)$/, (m) => `waiting online: ${m[1]}`],
  [/^Агент работает (.+)$/, (m) => `Agent has been working for ${dur(m[1])}`],
  [/^(\d+) (игра|игры|игр)$/, (m) => games(m[1])],
  [/^Графика: (\S+)(.*)$/, (m) => `Graphics: ${GRAPHICS[m[1]] ?? m[1]}${m[2].replace('сейчас', 'now').replace('пиксели', 'pixels').replace('символы', 'characters')}`],
  [/^Открывать: окно (.+?)( \(обычное окно браузера\))?$/, (m) => `Open in: ${m[1]} window${m[2] ? ' (a regular browser window)' : ''}`],
  [/^Игры открываются (.+)\.$/, (m) => `Games open ${m[1] === 'здесь, в панели' ? 'here, in the pane' : `in ${where(m[1].replace(/^в /, ''))}`}.`],
  [/^Когда агент закончил: (.+)$/, (m) => `When the agent finishes: ${SIGNAL[m[1]] ?? m[1]}`],
  [/^Когда агент ждёт разрешения: (.+)$/, (m) => `When the agent asks for permission: ${SIGNAL[m[1]] ?? m[1]}`],
  [/^Открыть (.+) в окне$/, (m) => `Open ${m[1]} in a window`],
  [/^Окно Arcade открыто на вкладке (.+)\.$/, (m) => `The Arcade window is open on the ${m[1]} tab.`],
  [/^Игры (.+) идут в окне браузера, а здесь его открыть нельзя\.$/, (m) => `${m[1]} games run in a browser window, and it can't be opened here.`],
  [/^(.+) идёт в окне браузера, а здесь его открыть нельзя\.$/, (m) => `${m[1]} runs in a browser window, and it can't be opened here.`],
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
    .replace(/^запрос разрешения: (.+)$/, 'permission request: $1')
    .replace(/^каталог с сайта не получен: (.+)$/, 'could not get the catalog from the site: $1')
    .replace(/^не удалось найти браузеры: (.+)$/, 'could not find browsers: $1')
    .replace(/^уведомление не показалось: (.+)$/, 'the notification did not show: $1')
    .replace(/^ошибка мода: (.+)$/, 'mod error: $1')
const opener = (t) =>
  t
    .replace('окно браузера по умолчанию', 'default browser window')
    .replace(' (обычное окно браузера)', ' (a regular browser window)')
    .replace(/^окно (.+)$/, '$1 window')
const place = (t) =>
  t === 'играть здесь, в панели' ? 'play here, in the pane' : t.startsWith('открывать: ') ? `open in: ${where(t.slice(11).replace(/^в /, ''))}` : t

export function tr(text, lang = 'ru') {
  if (lang !== 'en' || typeof text !== 'string' || !/[А-Яа-яЁё]/.test(text)) return text
  const lead = text.match(/^\s*/)[0]
  const trail = text.match(/\s*$/)[0]
  const exact = EXACT[text] ?? EXACT[text.trim()]
  if (exact !== undefined) return EXACT[text] !== undefined ? exact : `${lead}${exact}${trail}`
  const core = text.trim()
  for (const [re, make] of RULES) {
    const m = core.match(re)
    if (m) return `${lead}${make(m)}${trail}`
  }
  return text
}

// Перевод готового дерева интерфейса: строки-дети, подписи кнопок, подписи и подсказки полей
export function translateTree(node, lang) {
  if (lang !== 'en' || node == null) return node
  if (typeof node === 'string') return tr(node, lang)
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
