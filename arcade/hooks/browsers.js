// Окно с игрой в браузере на Windows: какие браузеры установлены, где поставить окно, как его открыть.
// Здесь нет вызовов Claude Code — только тексты команд PowerShell и разбор их ответов, поэтому модуль
// проверяется отдельно. Данные в команды идут через переменные окружения, а не через текст команды:
// так пути с пробелами и кириллицей не ломают кавычки.

const WIDTH = 256
const HEIGHT = 240
const BAR = 28 // полоска с кнопками внизу страницы игры (web/index.html)
const FRAME_X = 32 // рамка окна по ширине, с запасом
const FRAME_Y = 64 // заголовок и рамка окна по высоте, с запасом

// Браузеры по их записи в реестре (App Paths). Те, что на Chromium, открывают страницу отдельным окном-приложением.
const KNOWN = [
  { id: 'chrome', name: 'Google Chrome', exe: 'chrome.exe', app: true },
  { id: 'edge', name: 'Microsoft Edge', exe: 'msedge.exe', app: true },
  { id: 'brave', name: 'Brave', exe: 'brave.exe', app: true },
  { id: 'vivaldi', name: 'Vivaldi', exe: 'vivaldi.exe', app: true },
  { id: 'opera', name: 'Opera', exe: 'opera.exe', app: true },
  { id: 'firefox', name: 'Firefox', exe: 'firefox.exe', app: false },
]

// Браузер по умолчанию: Windows хранит его как ProgId обработчика ссылок http
const PROG_IDS = [
  [/^ChromeHTML/i, 'chrome'],
  [/^MSEdgeHTM/i, 'edge'],
  [/^BraveHTML/i, 'brave'],
  [/^VivaldiHTM/i, 'vivaldi'],
  [/^Opera/i, 'opera'],
  [/^FirefoxURL/i, 'firefox'],
]

// Ищет браузеры в реестре, узнаёт браузер по умолчанию и рабочую область главного экрана; отвечает одной строкой JSON
const DETECT_SCRIPT = `
$ErrorActionPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$known = @(
${KNOWN.map((b) => `  @{ id = '${b.id}'; name = '${b.name}'; exe = '${b.exe}'; app = $${b.app} }`).join(',\n')}
)
$roots = @(
  'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\App Paths',
  'HKLM:\\Software\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths'
)
$found = @()
foreach ($b in $known) {
  foreach ($root in $roots) {
    $item = Get-ItemProperty -LiteralPath ($root + '\\' + $b.exe)
    $path = if ($item) { $item.'(default)' } else { $null }
    if ($path) {
      $path = [Environment]::ExpandEnvironmentVariables($path.Trim('"'))
      if (Test-Path -LiteralPath $path) {
        $found += [pscustomobject]@{ id = $b.id; name = $b.name; path = $path; app = $b.app }
        break
      }
    }
  }
}
$choice = Get-ItemProperty -LiteralPath 'HKCU:\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\http\\UserChoice'
$progId = if ($choice) { [string]$choice.ProgId } else { '' }
$screen = $null
try {
  Add-Type -AssemblyName System.Windows.Forms
  $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
  $screen = [pscustomobject]@{ x = $area.X; y = $area.Y; width = $area.Width; height = $area.Height }
} catch {}
[pscustomobject]@{ browsers = @($found); defaultProgId = $progId; screen = $screen } | ConvertTo-Json -Compress -Depth 4
`

// Открывает игру: выбранным браузером с аргументами или, если браузер не известен, тем, что открывает ссылки
const LAUNCH_SCRIPT = `
$ErrorActionPreference = 'Stop'
if ($env:ARCADE_BROWSER) {
  Start-Process -FilePath $env:ARCADE_BROWSER -ArgumentList $env:ARCADE_ARGS
} else {
  Start-Process -FilePath $env:ARCADE_URL
}
`

// PowerShell принимает скрипт в -EncodedCommand как base64 от UTF-16LE: никаких кавычек и переводов строк в командной строке
export function encodePowerShell(script) {
  const bytes = new Uint8Array(script.length * 2)
  for (let i = 0; i < script.length; i++) {
    const code = script.charCodeAt(i)
    bytes[i * 2] = code & 0xff
    bytes[i * 2 + 1] = code >> 8
  }
  return bytes.toBase64()
}

function powershell(script) {
  return ['powershell.exe', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encodePowerShell(script)]
}

export const DETECT_ARGV = powershell(DETECT_SCRIPT)
export const DETECT_SCRIPT_TEXT = DETECT_SCRIPT
export const LAUNCH_SCRIPT_TEXT = LAUNCH_SCRIPT

// Ответ поиска → { browsers, defaultId, screen }. Ответ пришёл из чужой программы, поэтому проверяем каждое поле.
export function parseDetection(stdout) {
  const empty = { browsers: [], defaultId: null, screen: null }
  const start = typeof stdout === 'string' ? stdout.indexOf('{') : -1
  if (start < 0) return empty
  let data
  try {
    data = JSON.parse(stdout.slice(start))
  } catch {
    return empty
  }
  const list = Array.isArray(data?.browsers) ? data.browsers : data?.browsers ? [data.browsers] : []
  const browsers = list
    .filter((b) => KNOWN.some((k) => k.id === b?.id) && typeof b.path === 'string' && b.path)
    .map((b) => ({ id: b.id, name: KNOWN.find((k) => k.id === b.id).name, path: b.path, app: KNOWN.find((k) => k.id === b.id).app }))
  const progId = typeof data?.defaultProgId === 'string' ? data.defaultProgId : ''
  const defaultId = PROG_IDS.find(([pattern]) => pattern.test(progId))?.[1] ?? null
  const s = data?.screen
  const screen =
    s && [s.x, s.y, s.width, s.height].every((n) => Number.isFinite(n)) && s.width > 0 && s.height > 0
      ? { x: s.x, y: s.y, width: s.width, height: s.height }
      : null
  return { browsers, defaultId, screen }
}

// Окно справа на главном экране: кадр Денди в целое число раз (×2…×4), сколько влезает
export function windowBounds(screen) {
  if (!screen) return null
  const fits = Math.min((screen.width * 0.45) / WIDTH, (screen.height - FRAME_Y - BAR) / HEIGHT)
  const scale = Math.max(2, Math.min(4, Math.floor(fits)))
  const width = WIDTH * scale + FRAME_X
  const height = HEIGHT * scale + BAR + FRAME_Y
  const x = screen.x + Math.max(0, screen.width - width - 12)
  const y = screen.y + Math.max(0, Math.round((screen.height - height) / 2))
  return { width, height, x, y }
}

// Адрес страницы в папке мода: игра, или библиотека, если игра не указана
export function gameUrl(root, gameId) {
  const path = root.replace(/\\/g, '/').replace(/\/+$/, '')
  const prefix = path.startsWith('/') ? 'file://' : 'file:///'
  const page = encodeURI(`${prefix}${path}/web/index.html`)
  return gameId ? `${page}?game=${encodeURIComponent(gameId)}` : page
}

// Команда, которая открывает окно с игрой: { argv, env }.
// target: { kind: 'browser', browser } или { kind: 'default' } — браузер, который в системе открывает ссылки.
export function launchCommand(target, url, bounds, profileRoot) {
  if (target.kind !== 'browser') return { argv: powershell(LAUNCH_SCRIPT), env: { ARCADE_URL: url } }
  const { browser } = target
  const args = browser.app
    ? [
        `--app="${url}"`,
        ...(bounds ? [`--window-size=${bounds.width},${bounds.height}`, `--window-position=${bounds.x},${bounds.y}`] : []),
        // Свой профиль: окно встаёт по размеру и месту, а сохранения игры не смешиваются с вкладками человека
        ...(profileRoot ? [`--user-data-dir="${profileRoot}\\${browser.id}"`] : []),
        '--no-first-run',
        '--no-default-browser-check',
      ]
    : ['-new-window', `"${url}"`]
  return { argv: powershell(LAUNCH_SCRIPT), env: { ARCADE_BROWSER: browser.path, ARCADE_ARGS: args.join(' '), ARCADE_URL: url } }
}
