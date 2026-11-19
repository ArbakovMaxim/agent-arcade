// Звуки уведомлений о сессиях: громкость, свой звук для «ждёт тебя» и «закончил ход», свои файлы из
// ~/.claude/arcade/sounds и повтор «ждёт тебя», пока висит карточка. Здесь — без $: списки звуков, проверка имён
// файлов и что играть. Встроенные звуки Arcade (mod/sounds/*.wav) синтезированы tools/sounds/make-sounds.py —
// своя запись, лицензия та же, что у Arcade

export const SOUND_VOLUMES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
export const SOUND_CUT_S = 10 // звук играет не дольше; карточка «ждёт тебя» висит 15 с
export const SOUND_REPEAT_S = 5 // повтор «ждёт тебя» — через столько секунд после конца звука
export const SOUND_MAX_BYTES = 5 * 1024 * 1024
export const SOUND_FILES_MAX = 60 // столько своих файлов в списке, дальше — по алфавиту не попадают
export const SOUND_STD = 'std'

// Стандартные звуки событий: wait — сессия ждёт тебя, done — закончила ход. У сообщений из чатов свой, прежний
export const ALERT_SOUNDS = {
  windows: { wait: 'Windows Message Nudge.wav', done: 'Windows Notify System Generic.wav' },
  mac: { wait: 'Ping', done: 'Glass' },
  linux: { wait: 'message-new-instant', done: 'complete' },
}

// Свои звуки Arcade — файлы mod/sounds
export const ARCADE_SOUNDS = [
  { id: 'arcade:chime', file: 'chime.wav', label: 'Перезвон' },
  { id: 'arcade:bell', file: 'bell.wav', label: 'Колокол' },
  { id: 'arcade:pulse', file: 'pulse.wav', label: 'Пульс' },
  { id: 'arcade:rise', file: 'rise.wav', label: 'Подъём' },
  { id: 'arcade:alarm', file: 'alarm.wav', label: 'Будильник' },
]

// Звуки системы. Windows — файлы C:\Windows\Media (в списке — только те, что есть на этом компьютере), Mac —
// /System/Library/Sounds, Linux — тема freedesktop
export const SYSTEM_SOUNDS = {
  windows: [
    'Windows Message Nudge',
    'Windows Notify System Generic',
    'Windows Notify Messaging',
    'Windows Notify Email',
    'Windows Notify Calendar',
    'Windows Proximity Notification',
    'Windows Ding',
    'Windows Exclamation',
    'Windows Background',
    'Windows Unlock',
    'chimes',
    'chord',
    'ding',
    'notify',
    'tada',
    'Alarm01',
    'Alarm02',
    'Alarm03',
    'Ring01',
    'Ring02',
  ],
  mac: ['Basso', 'Blow', 'Bottle', 'Frog', 'Funk', 'Glass', 'Hero', 'Morse', 'Ping', 'Pop', 'Purr', 'Sosumi', 'Submarine', 'Tink'],
  linux: ['message-new-instant', 'complete', 'bell', 'message', 'dialog-information', 'dialog-warning', 'alarm-clock-elapsed', 'phone-incoming-call', 'window-attention', 'service-login'],
}

// Какие файлы можно положить в папку звуков
export const SOUND_EXT = { windows: ['wav', 'mp3'], linux: ['wav', 'mp3'], mac: ['wav', 'mp3', 'aiff', 'm4a'] }

// Имя своего файла: буквы, цифры, пробел, точка, _, -, скобки — без разделителей пути, кавычек, # и %
const OWN_NAME = /^[\p{L}\p{N} ._()-]{1,80}$/u
const SYS_NAME = /^[A-Za-z0-9 -]{1,60}$/

export function ownSoundName(name, platform) {
  if (typeof name !== 'string' || !OWN_NAME.test(name) || name.startsWith('.') || !name.includes('.')) return false
  const ext = name.slice(name.lastIndexOf('.') + 1).toLowerCase()
  return (SOUND_EXT[platform] ?? SOUND_EXT.windows).includes(ext)
}

// Свои файлы из $.fs.list папки звуков: обычные файлы (не ссылки) с хорошим именем и расширением, не пустые и не
// больше 5 МБ — по алфавиту
export function ownSoundFiles(entries, platform) {
  if (!Array.isArray(entries)) return []
  return entries
    .filter((e) => e && e.kind === 'file' && ownSoundName(e.name, platform) && e.size > 0 && e.size <= SOUND_MAX_BYTES)
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b))
    .slice(0, SOUND_FILES_MAX)
}

// Звуки системы для списка. На Windows — только те, что лежат в C:\Windows\Media (media — её $.fs.list; не прочли —
// весь список)
export function systemSoundList(platform, media) {
  const all = SYSTEM_SOUNDS[platform] ?? []
  if (platform !== 'windows' || !Array.isArray(media)) return all
  const have = new Set(media.filter((e) => e && e.kind === 'file').map((e) => String(e.name).toLowerCase()))
  return all.filter((name) => have.has(`${name.toLowerCase()}.wav`))
}

// Сохранённый выбор звука: std, arcade:имя, sys:имя или file:имя. Чужое или битое — стандартный
export function soundIdOf(raw) {
  if (typeof raw !== 'string') return SOUND_STD
  if (ARCADE_SOUNDS.some((s) => s.id === raw)) return raw
  if (raw.startsWith('sys:') && SYS_NAME.test(raw.slice(4))) return raw
  if (raw.startsWith('file:') && OWN_NAME.test(raw.slice(5))) return raw
  return SOUND_STD
}

export function soundVolumeOf(raw) {
  return SOUND_VOLUMES.includes(raw) ? raw : 100
}

// Подпись звука: стандартный и звуки Arcade — по-русски (их переводит словарь), остальное — имя как есть
export function soundLabelOf(id) {
  if (id === SOUND_STD) return 'Стандартный'
  const own = ARCADE_SOUNDS.find((s) => s.id === id)
  if (own) return own.label
  return id.slice(id.indexOf(':') + 1)
}

const trimDir = (dir) => String(dir).replace(/[\\/]+$/, '')

// Файл звука системы на Mac и Linux — для afplay и paplay
export function systemSoundPath(platform, name) {
  if (platform === 'mac') return `/System/Library/Sounds/${name}.aiff`
  if (platform === 'linux') return `/usr/share/sounds/freedesktop/stereo/${name}.oga`
  return null
}

// Что играть: name — звук системы (на Windows — файл из C:\Windows\Media), file — путь к звуку Arcade или своему
// файлу, std — стандартный звук события: им заменяется файл, которого нет или который не играет.
// root — папка плагина, dir — папка своих звуков, sep — разделитель пути
export function soundSource(platform, id, kind, { root = '', dir = '', sep = '/' } = {}) {
  const std = ALERT_SOUNDS[platform]?.[kind] ?? null
  const out = { std, name: std, file: null }
  const own = ARCADE_SOUNDS.find((s) => s.id === id)
  if (own && root) out.file = [trimDir(root), 'sounds', own.file].join(sep)
  else if (id.startsWith('sys:') && (SYSTEM_SOUNDS[platform] ?? []).includes(id.slice(4))) out.name = platform === 'windows' ? `${id.slice(4)}.wav` : id.slice(4)
  else if (id.startsWith('file:') && dir && ownSoundName(id.slice(5), platform)) out.file = [trimDir(dir), id.slice(5)].join(sep)
  return out
}
