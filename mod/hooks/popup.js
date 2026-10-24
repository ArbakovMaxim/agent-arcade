// Всплывающее уведомление о новом сообщении, как у мессенджеров. Windows: своё окно-карточка внизу слева поверх всех
// окон (WPF из PowerShell): аватарка, кто написал, текст и звук; через несколько секунд прячется само, пока мышь
// над ним — ждёт. Клик по карточке — процесс печатает «open» и поднимает окно, откуда запущен Claude Code: мод
// открывает этот чат. Mac и Linux — обычное системное уведомление, место выбирает система.
import { avatarSvg, initial, letterColor, validPic } from './avatars.js'
import { powershell } from './browsers.js'
import { CHAT_ID } from './chats.js'

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

// Карточка. Текст и картинка — через переменные окружения: кириллица и кавычки не ломают команду, а в разметку текст
// не попадает. Слот — место в стопке снизу вверх, если карточек сразу несколько
const POPUP_SCRIPT = `
$ErrorActionPreference = 'Stop'
# Без строк о ходе загрузки модулей: в выводе должен остаться только ответ карточки
$ProgressPreference = 'SilentlyContinue'
# Чёткий текст на экранах с масштабом: powershell.exe сам о масштабе не знает, без этого Windows растянет карточку
try {
  Add-Type -Namespace Arcade -Name Dpi -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();'
  [void][Arcade.Dpi]::SetProcessDPIAware()
} catch { }
Add-Type -AssemblyName PresentationFramework
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase
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
$timer = New-Object System.Windows.Threading.DispatcherTimer
$timer.Interval = [TimeSpan]::FromSeconds(6)
$timer.Add_Tick({ $timer.Stop(); $w.Close() })
$w.Add_MouseEnter({ $timer.Stop() })
$w.Add_MouseLeave({ $timer.Interval = [TimeSpan]::FromSeconds(3); $timer.Start() })
$w.FindName('Shut').Add_MouseLeftButtonUp({ param($s, $e) $e.Handled = $true; $w.Close() })
$w.FindName('Card').Add_MouseLeftButtonUp({
  $script:answer = 'open'
  # Поднять окно, откуда запущен Claude Code: первое вверх по родителям, у которого есть видимое окно
  try {
    Add-Type -AssemblyName Microsoft.VisualBasic
    $id = $PID
    for ($i = 0; $i -lt 10; $i++) {
      $id = [int](Get-CimInstance Win32_Process -Filter "ProcessId=$id").ParentProcessId
      $p = Get-Process -Id $id -ErrorAction SilentlyContinue
      if (-not $p) { break }
      if ($p.MainWindowHandle -ne [IntPtr]::Zero) { [Microsoft.VisualBasic.Interaction]::AppActivate($id); break }
    }
  } catch { }
  $w.Close()
})
$w.Add_Closed({ $w.Dispatcher.InvokeShutdown() })
try {
  $wav = Join-Path $env:WINDIR 'Media\\Windows Notify Messaging.wav'
  if (Test-Path $wav) { (New-Object System.Media.SoundPlayer $wav).Play() } else { [System.Media.SystemSounds]::Asterisk.Play() }
} catch { }
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

// Команда карточки: { argv, env } или null, если на этой системе показать нечем. pic — avatarXaml, slot — 0, 1, 2…
export function popupCommand(platform, { title, text, pic = '', slot = 0 }) {
  const head = cut(title, POPUP_TITLE_MAX)
  const body = cut(text, POPUP_TEXT_MAX)
  if (platform === 'windows') {
    return { argv: powershell(POPUP_SCRIPT), env: { ARCADE_POPUP_TITLE: head, ARCADE_POPUP_TEXT: body, ARCADE_POPUP_PIC: pic, ARCADE_POPUP_SLOT: String(slot) } }
  }
  if (platform === 'mac') {
    return {
      argv: ['osascript', '-e', 'on run argv', '-e', 'display notification (item 2 of argv) with title (item 1 of argv) subtitle "Arcade" sound name "Glass"', '-e', 'end run', head, body],
      env: {},
    }
  }
  if (platform === 'linux') return { argv: ['notify-send', '--app-name=Arcade', head, body], env: {} }
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
