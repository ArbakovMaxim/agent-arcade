// Всплывающее уведомление о новом сообщении, как у мессенджеров. Windows: своё окно-карточка внизу слева поверх всех
// окон (WPF из PowerShell): аватарка, кто написал, текст и звук; через несколько секунд прячется само, пока мышь
// над ним — ждёт. Клик по карточке — процесс печатает «open» и поднимает окно, откуда запущен Claude Code: мод
// открывает этот чат. Mac и Linux — обычное системное уведомление, место выбирает система.
import { avatarSvg, initial, letterColor, validPic } from './avatars.js'
import { powershell } from './browsers.js'
import { CHAT_ID } from './chats.js'
import { ALERT_SOUNDS, SOUND_CUT_S, SOUND_MAX_BYTES, systemSoundPath } from './sounds.js'

export { ALERT_SOUNDS } from './sounds.js'

export const POPUP_TITLE_MAX = 80
export const POPUP_TEXT_MAX = 200

const XAML_NS = 'http://schemas.microsoft.com/winfx/2006/xaml/presentation'
const COLOR = /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/
const NUMBER = /^-?\d+(?:\.\d+)?$/
const PATH_DATA = /^[MLHVQACSTZmlhvqacstz\d\s.,-]+$/

const xml = (text) => String(text).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)
const round2 = (n) => String(Math.round(n * 100) / 100)

// Аватарка — рисунок WPF 64×64 в круге: из той же SVG-картинки, что видят в чатах. Не вышло — буква, как без аватарки
export function avatarXaml(pic, name, seed = name) {
  return (validPic(pic) && svgToXaml(avatarSvg(pic))) || letterXaml(name, seed)
}

// Буква на цвете от ника или номера чата — как letterSvg
export function letterXaml(name, seed = name) {
  return (
    `<Grid xmlns="${XAML_NS}" Width="64" Height="64"><Ellipse Fill="${letterColor(seed)}"/>` +
    `<TextBlock Text="${xml(initial(name))}" FontFamily="Segoe UI" FontSize="30" FontWeight="SemiBold" Foreground="#FFFFFF" ` +
    'HorizontalAlignment="Center" VerticalAlignment="Center"/></Grid>'
  )
}

// SVG аватарок (avatars.js) → XAML. Там только rect, circle, ellipse, path и g, поворот — rotate(угол x y). Всё
// остальное или странное значение — null: такой картинки в карточке не будет
export function svgToXaml(svg) {
  const tags = /<(\/?)([a-zA-Z]+)((?:\s+[\w:-]+="[^"]*")*)\s*(\/?)>/g
  if (String(svg).replace(tags, '').trim()) return null
  const out = []
  let clip = false
  for (const [, close, tag, raw, self] of String(svg).matchAll(tags)) {
    if (tag === 'clipPath') {
      clip = !close
      continue
    }
    if (clip || tag === 'svg') continue
    if (tag === 'g') {
      if (close) {
        out.push('</Canvas>')
        continue
      }
      const turn = rotation(attrs(raw).transform, 0, 0)
      if (turn === null) return null
      out.push(turn ? `<Canvas><Canvas.RenderTransform>${turn}</Canvas.RenderTransform>` : '<Canvas>')
      if (self) out.push('</Canvas>')
      continue
    }
    if (close) continue
    const piece = shape(tag, attrs(raw))
    if (!piece) return null
    out.push(piece)
  }
  return (
    `<Canvas xmlns="${XAML_NS}" Width="64" Height="64"><Canvas.Clip><EllipseGeometry Center="32,32" RadiusX="32" RadiusY="32"/></Canvas.Clip>` +
    `${out.join('')}</Canvas>`
  )
}

function attrs(raw) {
  return Object.fromEntries([...raw.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, k, v]) => [k, v]))
}

// Одна фигура: место на холсте, размеры, заливка и обводка, поворот
function shape(tag, a) {
  const n = (key, fallback = '0') => {
    const v = a[key] ?? fallback
    return NUMBER.test(v) ? Number(v) : NaN
  }
  let head
  let left = 0
  let top = 0
  if (tag === 'rect') {
    left = n('x')
    top = n('y')
    const rx = n('rx')
    head = `Rectangle Canvas.Left="${round2(left)}" Canvas.Top="${round2(top)}" Width="${round2(n('width'))}" Height="${round2(n('height'))}"${rx ? ` RadiusX="${round2(rx)}" RadiusY="${round2(rx)}"` : ''}`
  } else if (tag === 'circle' || tag === 'ellipse') {
    const rx = tag === 'circle' ? n('r') : n('rx')
    const ry = tag === 'circle' ? n('r') : n('ry')
    left = n('cx') - rx
    top = n('cy') - ry
    head = `Ellipse Canvas.Left="${round2(left)}" Canvas.Top="${round2(top)}" Width="${round2(rx * 2)}" Height="${round2(ry * 2)}"`
  } else if (tag === 'path') {
    // F1 — заливка «nonzero», как в SVG по умолчанию
    if (!PATH_DATA.test(a.d ?? '')) return null
    head = `Path Data="F1 ${a.d}"`
  } else {
    return null
  }
  if (head.includes('NaN')) return null
  const look = paint(a)
  const turn = rotation(a.transform, left, top)
  if (look === null || turn === null) return null
  const name = head.split(' ')[0]
  return turn ? `<${head} ${look}><${name}.RenderTransform>${turn}</${name}.RenderTransform></${name}>` : `<${head} ${look}/>`
}

// Заливка и обводка. Без fill в SVG заливка чёрная, fill="none" — без заливки
function paint(a) {
  const out = []
  const fill = a.fill ?? '#000'
  if (fill !== 'none') {
    if (!COLOR.test(fill)) return null
    out.push(`Fill="${fill}"`)
  }
  if (a.stroke !== undefined && a.stroke !== 'none') {
    const width = a['stroke-width'] ?? '1'
    if (!COLOR.test(a.stroke) || !NUMBER.test(width)) return null
    out.push(`Stroke="${a.stroke}" StrokeThickness="${width}"`)
    if (a['stroke-linecap'] === 'round') out.push('StrokeStartLineCap="Round" StrokeEndLineCap="Round"')
  }
  return out.join(' ')
}

// rotate(угол x y) → RotateTransform; центр поворота у WPF — в координатах самой фигуры. Нет поворота — '', не он — null
function rotation(transform, left, top) {
  if (transform === undefined) return ''
  const m = /^rotate\((-?[\d.]+)(?:[\s,]+(-?[\d.]+)[\s,]+(-?[\d.]+))?\)$/.exec(transform.trim())
  if (!m) return null
  return `<RotateTransform Angle="${m[1]}" CenterX="${round2(Number(m[2] ?? 0) - left)}" CenterY="${round2(Number(m[3] ?? 0) - top)}"/>`
}

// Проигрыватель звука уведомления о сессии (Windows): громкость, звук Arcade или свой файл, не дольше SOUND_CUT_S
// секунд. Что играть — только через переменные окружения, путь в текст скрипта не попадает:
// ARCADE_POPUP_SOUND_FILE — звук Arcade или свой файл (только .wav и .mp3 из папки sounds, не больше SOUND_MAX_BYTES),
// ARCADE_POPUP_SOUND — звук из C:\Windows\Media: его играет и вместо файла, которого нет или который не играет;
// ARCADE_POPUP_VOLUME — громкость 1–100. Конец звука — $script:onEnd
const PLAYER_PS = `
function Get-ArcadeStdPath {
  $name = $env:ARCADE_POPUP_SOUND
  if (-not ($name -match '^[A-Za-z0-9 ]+\\.wav$')) { $name = 'Windows Notify Messaging.wav' }
  return (Join-Path $env:WINDIR ('Media\\' + $name))
}
function Get-ArcadeSoundPath {
  $file = $env:ARCADE_POPUP_SOUND_FILE
  if ($file) {
    try {
      $item = Get-Item -LiteralPath $file -ErrorAction Stop
      $plain = -not $item.PSIsContainer -and -not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)
      if ($plain -and $item.Extension -match '^\\.(wav|mp3)$' -and $item.Length -gt 0 -and $item.Length -le ${SOUND_MAX_BYTES} -and $item.Directory.Name -eq 'sounds') { return $item.FullName }
    } catch { }
  }
  return (Get-ArcadeStdPath)
}
$script:volume = 1.0
$level = 0
if ([int]::TryParse($env:ARCADE_POPUP_VOLUME, [ref]$level) -and $level -ge 1 -and $level -le 100) { $script:volume = $level / 100 }
$script:player = $null
$script:waitSync = $false
$script:onEnd = { }
$script:cut = New-Object System.Windows.Threading.DispatcherTimer
$script:cut.Interval = [TimeSpan]::FromSeconds(${SOUND_CUT_S})
$script:cut.Add_Tick({ Stop-ArcadeSound })
function Close-ArcadePlayer {
  $script:cut.Stop()
  if ($script:player) {
    try { $script:player.Stop(); $script:player.Close() } catch { }
    $script:player = $null
  }
}
function Stop-ArcadeSound {
  Close-ArcadePlayer
  & $script:onEnd
}
# Файл не открылся — стандартный звук события; не играет и он — системный «динь»
function Start-ArcadeFallback {
  $std = Get-ArcadeStdPath
  if ($script:soundPath -ne $std) {
    $script:soundPath = $std
    Start-ArcadeSound
    return
  }
  try {
    if (Test-Path -LiteralPath $std) {
      $simple = New-Object System.Media.SoundPlayer $std
      if ($script:waitSync) { $simple.PlaySync() } else { $simple.Play() }
    } else { [System.Media.SystemSounds]::Asterisk.Play() }
  } catch { }
  Stop-ArcadeSound
}
function Start-ArcadeSound {
  try {
    $p = New-Object System.Windows.Media.MediaPlayer
    $script:player = $p
    $p.Volume = $script:volume
    $p.Add_MediaEnded({ param($s, $e) if ($s -eq $script:player) { Stop-ArcadeSound } })
    $p.Add_MediaFailed({ param($s, $e) if ($s -eq $script:player) { Close-ArcadePlayer; Start-ArcadeFallback } })
    $p.Open((New-Object System.Uri $script:soundPath))
    $p.Play()
    $script:cut.Start()
  } catch {
    Close-ArcadePlayer
    Start-ArcadeFallback
  }
}
`

// Карточка. Текст и картинка — через переменные окружения: кириллица и кавычки не ломают команду, а в разметку текст
// не попадает. Слот — место в стопке снизу вверх, если карточек сразу несколько.
// Для уведомлений о сессиях ещё: SOUND — свой звук из C:\Windows\Media или none; HOLD — сколько секунд держать;
// FG=1 — сначала посмотреть, не впереди ли окно Claude Code: впереди — показать FG_TITLE и FG_TEXT (со звуком FG_SOUND),
// а их нет — молчать. VOLUME — играть проигрывателем PLAYER_PS: громкость, SOUND_FILE и REPEAT — через сколько секунд
// после конца звука повторить его, пока карточка висит и на неё не навели мышь (у FG — свои FG_SOUND_FILE и FG_REPEAT)
const POPUP_SCRIPT = `
$ErrorActionPreference = 'Stop'
# Без строк о ходе загрузки модулей: в выводе должен остаться только ответ карточки
$ProgressPreference = 'SilentlyContinue'
# Чёткий текст на экранах с масштабом: powershell.exe сам о масштабе не знает, без этого Windows растянет карточку.
# Там же — какое окно впереди и как развернуть свёрнутое
try {
  Add-Type -Namespace Arcade -Name Win -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware(); [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint pid); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr hWnd); [DllImport("user32.dll")] public static extern bool ShowWindowAsync(IntPtr hWnd, int cmd);'
  [void][Arcade.Win]::SetProcessDPIAware()
} catch { }
# Окно, откуда запущен Claude Code: первое вверх по родителям, у которого есть видимое окно
function Find-ArcadeHost {
  $id = $PID
  for ($i = 0; $i -lt 10; $i++) {
    $id = [int](Get-CimInstance Win32_Process -Filter "ProcessId=$id").ParentProcessId
    $p = Get-Process -Id $id -ErrorAction SilentlyContinue
    if (-not $p) { return $null }
    if ($p.MainWindowHandle -ne [IntPtr]::Zero) { return $p }
  }
  return $null
}
if ($env:ARCADE_POPUP_FG -eq '1') {
  try {
    $front = [uint32]0
    [void][Arcade.Win]::GetWindowThreadProcessId([Arcade.Win]::GetForegroundWindow(), [ref]$front)
    $owner = Find-ArcadeHost
    if ($owner -and $front -eq $owner.Id) {
      if (-not $env:ARCADE_POPUP_FG_TITLE) { exit 0 }
      $env:ARCADE_POPUP_TITLE = $env:ARCADE_POPUP_FG_TITLE
      $env:ARCADE_POPUP_TEXT = $env:ARCADE_POPUP_FG_TEXT
      if ($env:ARCADE_POPUP_FG_SOUND) {
        $env:ARCADE_POPUP_SOUND = $env:ARCADE_POPUP_FG_SOUND
        $env:ARCADE_POPUP_SOUND_FILE = $env:ARCADE_POPUP_FG_SOUND_FILE
        $env:ARCADE_POPUP_REPEAT = $env:ARCADE_POPUP_FG_REPEAT
      }
    }
  } catch { }
}
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
${PLAYER_PS}
$card = @'
<Window xmlns="${XAML_NS}" WindowStyle="None" AllowsTransparency="True" Background="Transparent" Topmost="True" ShowInTaskbar="False" ShowActivated="False" ResizeMode="NoResize" SizeToContent="Height" Width="384" Opacity="0">
  <Border Name="Card" Margin="12" CornerRadius="12" Background="#F51E2630" BorderBrush="#26FFFFFF" BorderThickness="1" Cursor="Hand">
    <Border.Effect><DropShadowEffect BlurRadius="14" ShadowDepth="2" Opacity="0.5"/></Border.Effect>
    <Grid Margin="12,10,8,12">
      <Grid.ColumnDefinitions><ColumnDefinition Width="48"/><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions>
      <Viewbox Name="Pic" Width="48" Height="48" VerticalAlignment="Top" Margin="0,2,0,0"/>
      <StackPanel Grid.Column="1" Margin="12,0,4,0">
        <TextBlock Text="Arcade" FontSize="11" Foreground="#8CFFFFFF"/>
        <TextBlock Name="Head" FontSize="14" FontWeight="SemiBold" Foreground="#FFFFFF" TextTrimming="CharacterEllipsis"/>
        <TextBlock Name="Body" FontSize="13" Foreground="#E0FFFFFF" TextWrapping="Wrap" TextTrimming="CharacterEllipsis" MaxHeight="36" Margin="0,1,0,0"/>
      </StackPanel>
      <TextBlock Name="Shut" Grid.Column="2" Text="&#x2715;" FontSize="12" Foreground="#8CFFFFFF" VerticalAlignment="Top" Padding="6,0,4,6"/>
    </Grid>
  </Border>
</Window>
'@
$w = [Windows.Markup.XamlReader]::Parse($card)
$w.FindName('Head').Text = $env:ARCADE_POPUP_TITLE
$w.FindName('Body').Text = $env:ARCADE_POPUP_TEXT
try { $w.FindName('Pic').Child = [Windows.Markup.XamlReader]::Parse($env:ARCADE_POPUP_PIC) } catch { }
$area = [System.Windows.SystemParameters]::WorkArea
$slot = 0
[void][int]::TryParse($env:ARCADE_POPUP_SLOT, [ref]$slot)
$w.Left = $area.Left
$w.Top = $area.Bottom
$script:answer = ''
$w.Add_Loaded({
  $w.Top = $area.Bottom - $w.ActualHeight - $slot * ($w.ActualHeight - 16)
  $w.BeginAnimation([System.Windows.Window]::OpacityProperty, (New-Object System.Windows.Media.Animation.DoubleAnimation(0, 1, [TimeSpan]::FromMilliseconds(180))))
})
$hold = 0
[void][int]::TryParse($env:ARCADE_POPUP_HOLD, [ref]$hold)
if ($hold -lt 3) { $hold = 6 }
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds($hold)
$timer.Add_Tick({ $timer.Stop(); $w.Close() })
# Повтор звука: hush — карточку заметили (навели мышь) или она закрылась; answered — закрыли сами: звук — сразу стоп;
# closing — закрылась сама, пока звук играет: доиграть и выйти
$script:hush = $false
$script:answered = $false
$script:closing = $false
$script:repeat = 0
$again = New-Object System.Windows.Threading.DispatcherTimer
$again.Add_Tick({ $again.Stop(); if (-not $script:hush) { Start-ArcadeSound } })
$w.Add_MouseEnter({ $timer.Stop(); $script:hush = $true; $again.Stop() })
$w.Add_MouseLeave({ $timer.Interval = [TimeSpan]::FromSeconds(3); $timer.Start() })
$w.FindName('Shut').Add_MouseLeftButtonUp({ param($s, $e) $e.Handled = $true; $script:answered = $true; $w.Close() })
$w.FindName('Card').Add_MouseLeftButtonUp({
  $script:answer = 'open'
  $script:answered = $true
  # Поднять окно, откуда запущен Claude Code; свёрнутое — сначала развернуть
  try {
    Add-Type -AssemblyName Microsoft.VisualBasic
    $p = Find-ArcadeHost
    if ($p) {
      try { if ([Arcade.Win]::IsIconic($p.MainWindowHandle)) { [void][Arcade.Win]::ShowWindowAsync($p.MainWindowHandle, 9) } } catch { }
      [Microsoft.VisualBasic.Interaction]::AppActivate($p.Id)
    }
  } catch { }
  $w.Close()
})
$w.Add_Closed({
  $script:hush = $true
  $again.Stop()
  if ($script:player -and -not $script:answered) { $script:closing = $true }
  else {
    Close-ArcadePlayer
    $w.Dispatcher.InvokeShutdown()
  }
})
# Звук: none — без звука; своё имя — только из C:\\Windows\\Media; без него — как у сообщений.
# С VOLUME — проигрыватель: громкость, свой файл, повтор
$sound = $env:ARCADE_POPUP_SOUND
if ($env:ARCADE_POPUP_VOLUME -and $sound -ne 'none') {
  $gap = 0
  [void][int]::TryParse($env:ARCADE_POPUP_REPEAT, [ref]$gap)
  if ($gap -ge 1) {
    $script:repeat = $gap
    $again.Interval = [TimeSpan]::FromSeconds($gap)
  }
  $script:onEnd = {
    if ($script:closing) { $w.Dispatcher.InvokeShutdown(); return }
    if ($script:repeat -gt 0 -and -not $script:hush) { $again.Start() }
  }
  $script:soundPath = Get-ArcadeSoundPath
  Start-ArcadeSound
} elseif ($sound -ne 'none') {
  try {
    if (-not ($sound -match '^[A-Za-z0-9 ]+\\.wav$')) { $sound = 'Windows Notify Messaging.wav' }
    $wav = Join-Path $env:WINDIR ('Media\\' + $sound)
    if (Test-Path $wav) { (New-Object System.Media.SoundPlayer $wav).Play() } else { [System.Media.SystemSounds]::Asterisk.Play() }
  } catch { }
}
$w.Show()
$timer.Start()
[System.Windows.Threading.Dispatcher]::Run()
if ($script:answer) { [Console]::Out.WriteLine($script:answer) }
`

export const POPUP_SCRIPT_TEXT = POPUP_SCRIPT

const cut = (text, max) => {
  const chars = [...String(text ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ')]
  return chars.length > max ? `${chars.slice(0, max - 1).join('')}…` : chars.join('')
}

// Прослушать звук без карточки (Windows): тот же проигрыватель, после конца звука — выход
const SOUND_SCRIPT = `
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
${PLAYER_PS}
$script:waitSync = $true
$script:onEnd = { [System.Windows.Threading.Dispatcher]::CurrentDispatcher.BeginInvokeShutdown('Background') }
$script:soundPath = Get-ArcadeSoundPath
Start-ArcadeSound
[System.Windows.Threading.Dispatcher]::Run()
`

export const SOUND_SCRIPT_TEXT = SOUND_SCRIPT

// Mac и Linux: файл звука — аргументом, не в текст команды; не играет — стандартный звук события. Не дольше SOUND_CUT_S
// секунд: afplay -t; paplay обрывает timeout (код 124 — оборвали, это не ошибка)
const AFPLAY = `afplay -v "$1" -t ${SOUND_CUT_S} "$2" || afplay -v "$1" "$3"`
const PAPLAY = `timeout ${SOUND_CUT_S} paplay --volume="$1" "$2"; s=$?; [ $s -eq 0 ] || [ $s -eq 124 ] || paplay --volume="$1" "$3"`

function playArgv(platform, file, std, volume) {
  if (platform === 'mac') return ['sh', '-c', AFPLAY, 'sh', String(volume / 100), file, std]
  if (platform === 'linux') return ['sh', '-c', PAPLAY, 'sh', String(Math.round((volume / 100) * 65536)), file, std]
  return null
}

// Что играть на Mac и Linux: файл звука или звука системы и стандартный — путями
const playPaths = (platform, src) => [src.file ?? systemSoundPath(platform, src.name), systemSoundPath(platform, src.std)]

// Команда «Прослушать»: { argv, env } или null. src — soundSource, volume — 10–100
export function soundPreviewCommand(platform, src, volume) {
  if (!src?.std) return null
  if (platform === 'windows') {
    const env = { ARCADE_POPUP_SOUND: src.name, ARCADE_POPUP_VOLUME: String(volume) }
    if (src.file) env.ARCADE_POPUP_SOUND_FILE = src.file
    return { argv: powershell(SOUND_SCRIPT), env }
  }
  const argv = playArgv(platform, ...playPaths(platform, src), volume)
  return argv ? { argv, env: {} } : null
}

// Команда карточки: { argv, env } или null, если на этой системе показать нечем. pic — avatarXaml, slot — 0, 1, 2….
// Для уведомлений о сессиях: sound — 'wait', 'done' или 'none' (без звука); hold — сколько секунд держать карточку;
// fg — что показать, если впереди окно Claude Code ({ title, text, kind }; null — тогда ничего). Только Windows: на Mac и
// Linux уведомление показывает система, какое окно впереди — не узнать. Без них — как у сообщений из чатов.
// voice — настройки звука: { volume, wait, done, repeat } (wait и done — soundSource, repeat — секунды повтора «ждёт
// тебя» или 0). На Mac и Linux звук не системы или тише 100% играет отдельная команда play: { argv, env }
export function popupCommand(platform, { title, text, pic = '', slot = 0, sound, hold, fg, voice }) {
  const head = cut(title, POPUP_TITLE_MAX)
  const body = cut(text, POPUP_TEXT_MAX)
  const src = voice && sound !== 'none' ? voice[sound] : null
  if (platform === 'windows') {
    const env = { ARCADE_POPUP_TITLE: head, ARCADE_POPUP_TEXT: body, ARCADE_POPUP_PIC: pic, ARCADE_POPUP_SLOT: String(slot) }
    if (sound !== undefined) env.ARCADE_POPUP_SOUND = src?.name ?? ALERT_SOUNDS.windows[sound] ?? 'none'
    if (src) {
      env.ARCADE_POPUP_VOLUME = String(voice.volume)
      if (src.file) env.ARCADE_POPUP_SOUND_FILE = src.file
      if (sound === 'wait' && voice.repeat) env.ARCADE_POPUP_REPEAT = String(voice.repeat)
    }
    if (hold !== undefined) env.ARCADE_POPUP_HOLD = String(hold)
    if (fg !== undefined) {
      env.ARCADE_POPUP_FG = '1'
      if (fg?.title) Object.assign(env, { ARCADE_POPUP_FG_TITLE: cut(fg.title, POPUP_TITLE_MAX), ARCADE_POPUP_FG_TEXT: cut(fg.text, POPUP_TEXT_MAX) })
      if (fg?.title && sound !== undefined) {
        const other = src ? voice[fg.kind] : null
        env.ARCADE_POPUP_FG_SOUND = sound === 'none' ? 'none' : (other?.name ?? ALERT_SOUNDS.windows[fg.kind] ?? 'none')
        if (other?.file) env.ARCADE_POPUP_FG_SOUND_FILE = other.file
        if (other && fg.kind === 'wait' && voice.repeat) env.ARCADE_POPUP_FG_REPEAT = String(voice.repeat)
      }
    }
    return { argv: powershell(POPUP_SCRIPT), env }
  }
  // Звук системы на полной громкости играет само уведомление, иначе — отдельная команда, а уведомление молчит
  const own = src && (src.file || voice.volume < 100) ? playArgv(platform, ...playPaths(platform, src), voice.volume) : null
  const play = own ? { argv: own, env: {} } : undefined
  if (platform === 'mac') {
    const name = sound === undefined ? 'Glass' : own ? null : (src?.name ?? ALERT_SOUNDS.mac[sound])
    return {
      argv: ['osascript', '-e', 'on run argv', '-e', `display notification (item 2 of argv) with title (item 1 of argv) subtitle "Arcade"${name ? ` sound name "${name}"` : ''}`, '-e', 'end run', head, body],
      env: {},
      ...(play && { play }),
    }
  }
  if (platform === 'linux') {
    const name = own ? null : (src?.name ?? ALERT_SOUNDS.linux[sound])
    const hint = sound === undefined ? [] : name ? [`--hint=string:sound-name:${name}`] : ['--hint=boolean:suppress-sound:true']
    return { argv: ['notify-send', '--app-name=Arcade', ...hint, head, body], env: {}, ...(play && { play }) }
  }
  return null
}

// --- О каких сообщениях уже всплывало ------------------------------------------------------------------------------
export const POPPED_KEPT = 100 // столько чатов помнить в $.store: дальше — самые давние забываются

// { id чата: время последнего сообщения, о котором всплывало } из $.store; не сходится — пусто
export function restorePopped(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  return Object.fromEntries(Object.entries(raw).filter(([id, at]) => CHAT_ID.test(id) && Number.isFinite(at)).slice(0, POPPED_KEPT))
}

// Не больше POPPED_KEPT записей — самые свежие
export function keepPopped(popped) {
  return Object.fromEntries(
    Object.entries(popped)
      .sort((a, b) => b[1] - a[1])
      .slice(0, POPPED_KEPT),
  )
}

// Чаты, о которых пора всплыть, — по порядку прихода: есть непрочитанное, последнее сообщение не своё и новее того,
// о котором уже всплывало
export function popupChats(chats, me, popped) {
  return chats
    .filter((c) => c.unread > 0 && c.last && c.last.f !== me && c.at > (popped[c.id] ?? 0))
    .sort((a, b) => a.at - b.at)
}
