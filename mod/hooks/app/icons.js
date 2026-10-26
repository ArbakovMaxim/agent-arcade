// Arcade: иконки плиток, флажки языков, обложки.
import { tr } from '../i18n.js'
import { S } from './state.js'

// --- Desktop: иконки плиток и обложки игр (картинки Svg) ---------------------------------------------------------
const ICON_COLORS = { nes: '#e5484d', sega: '#3e63dd', sms: '#30a46c', psx: '#8e4ec6', games: '#f76b15', books: '#12a594', audiobooks: '#d6409f', mine: '#ffb224', settings: '#8b8d98', account: '#46a758', friends: '#e93d82', chats: '#0090ff', lang: '#0090ff', support: '#ff8b3e', library: '#6e56cf', youtube: '#ff0033', articles: '#29a383', podcasts: '#ab4aba', twitch: '#9146ff', tiktok: '#fe2c55', arcade: '#f76b15', shooters: '#e5484d', racing: '#30a46c', strategy: '#3e63dd', quests: '#ffb224', board: '#12a594', search: '#8e4ec6', favorites: '#ffb224', notes: '#00a2c7', boards: '#3e9b4f', opener: '#3e63dd', 'keep-menu': '#12a594', 'back-on-done': '#f76b15', wide: '#8e4ec6', 'ask-after': '#f76b15', 'on-done': '#30a46c', 'on-permission': '#ffb224', notify: '#e5484d', 'msg-notify': '#0090ff', 'account-sync': '#0090ff', 'account-logout': '#8b8d98', 'account-delete': '#e5484d', 'board-send': '#d97757', 'board-delete': '#e5484d', 'board-login': '#46a758', 'board-handle': '#46a758', 'board-share': '#e93d82', 'board-invite': '#e93d82', 'board-friends': '#e93d82', 'board-off': '#8b8d98', terms: '#3e63dd', privacy: '#46a758' }
// Серая иконка — у раздела, убранного из главного меню
export const OFF_COLOR = '#8b8d98'
export function iconSvg(kind, color) {
  const c = color ?? ICON_COLORS[kind] ?? '#6e56cf'
  const shapes = {
    pad: `<rect x="6" y="15" width="36" height="18" rx="9" fill="${c}"/><rect x="12" y="21" width="9" height="3" fill="#fff"/><rect x="15" y="18" width="3" height="9" fill="#fff"/><circle cx="32" cy="22" r="2.4" fill="#fff"/><circle cx="37" cy="26" r="2.4" fill="#fff"/>`,
    disc: `<circle cx="24" cy="24" r="17" fill="${c}"/><circle cx="24" cy="24" r="5" fill="#111"/><path d="M24 9a15 15 0 0 1 13 7.5" stroke="#fff" stroke-width="2.5" fill="none" opacity=".7"/>`,
    stick: `<rect x="10" y="30" width="28" height="9" rx="3" fill="${c}"/><rect x="22" y="14" width="4" height="17" fill="#ddd"/><circle cx="24" cy="13" r="6" fill="${c}"/><circle cx="33" cy="34" r="2" fill="#fff"/>`,
    book: `<path d="M8 12h14a4 4 0 0 1 4 4v22a3 3 0 0 0-3-3H8z" fill="${c}"/><path d="M40 12H26a4 4 0 0 0-4 4v22a3 3 0 0 1 3-3h15z" fill="${c}" opacity=".75"/>`,
    phones: `<path d="M10 28a14 14 0 0 1 28 0" stroke="${c}" stroke-width="4" fill="none"/><rect x="7" y="26" width="8" height="13" rx="3" fill="${c}"/><rect x="33" y="26" width="8" height="13" rx="3" fill="${c}"/>`,
    folder: `<path d="M7 14h12l4 4h18v19H7z" fill="${c}"/>`,
    gear: `<circle cx="24" cy="24" r="11" fill="none" stroke="${c}" stroke-width="7" stroke-dasharray="5 3.6"/><circle cx="24" cy="24" r="5" fill="${c}"/>`,
    person: `<circle cx="24" cy="17" r="8" fill="${c}"/><path d="M9 40a15 13 0 0 1 30 0z" fill="${c}"/>`,
    // Друзья: двое, второй — позади
    people: `<circle cx="31" cy="16" r="6" fill="${c}" opacity=".6"/><path d="M21 36a10 10 0 0 1 20 0z" fill="${c}" opacity=".6"/><circle cx="19" cy="19" r="7" fill="${c}"/><path d="M7 41a12 12 0 0 1 24 0z" fill="${c}"/>`,
    // Чаты: облачко с тремя точками
    bubble: `<path d="M9 12h30a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4H22l-8 7v-7H9a4 4 0 0 1-4-4V16a4 4 0 0 1 4-4z" fill="${c}"/><circle cx="16" cy="23.5" r="2.5" fill="#fff"/><circle cx="24" cy="23.5" r="2.5" fill="#fff"/><circle cx="32" cy="23.5" r="2.5" fill="#fff"/>`,
    globe: `<circle cx="24" cy="24" r="15" fill="none" stroke="${c}" stroke-width="3"/><ellipse cx="24" cy="24" rx="6" ry="15" fill="none" stroke="${c}" stroke-width="2.5"/><path d="M9 24h30" stroke="${c}" stroke-width="2.5"/>`,
    cup: `<path d="M10 18h22v10a9 9 0 0 1-9 9h-4a9 9 0 0 1-9-9z" fill="${c}"/><path d="M32 21h4a4 4 0 0 1 0 8h-4" stroke="${c}" stroke-width="3" fill="none"/><path d="M16 9c0 3 3 3 3 6M23 9c0 3 3 3 3 6" stroke="#ddd" stroke-width="2" fill="none"/>`,
    window: `<rect x="7" y="10" width="34" height="28" rx="4" fill="none" stroke="${c}" stroke-width="3"/><rect x="7" y="10" width="34" height="7" rx="3" fill="${c}"/><path d="M20 25l8 4-8 4z" fill="${c}"/>`,
    play: `<rect x="6" y="12" width="36" height="24" rx="8" fill="${c}"/><path d="M20 18v12l10-6z" fill="#fff"/>`,
    doc: `<path d="M13 7h15l9 9v25H13z" fill="${c}"/><path d="M28 7v9h9" fill="#fff" opacity=".35"/><path d="M18 23h14M18 28h14M18 33h10" stroke="#fff" stroke-width="2.5"/>`,
    mic: `<rect x="18" y="7" width="12" height="21" rx="6" fill="${c}"/><path d="M12 22a12 12 0 0 0 24 0" stroke="${c}" stroke-width="3" fill="none"/><path d="M24 34v7M17 41h14" stroke="${c}" stroke-width="3"/>`,
    // Трансляции: экран с антенной и точкой эфира
    tv: `<rect x="7" y="14" width="34" height="23" rx="5" fill="${c}"/><path d="M18 6l6 8 6-8" stroke="${c}" stroke-width="3" fill="none"/><circle cx="16" cy="25.5" r="3.5" fill="#fff"/><path d="M24 23h11M24 28h8" stroke="#fff" stroke-width="2.5"/>`,
    // TikTok — нота
    note: `<circle cx="19" cy="32" r="8" fill="${c}"/><rect x="24" y="8" width="5" height="25" fill="${c}"/><path d="M29 8c1 5 5 8 10 8v6c-4 0-7-1.5-10-4z" fill="${c}"/>`,
    // Жанры игр: прицел, клетчатый флаг, ладья, компас, кубик
    target: `<circle cx="24" cy="24" r="13" fill="none" stroke="${c}" stroke-width="4"/><circle cx="24" cy="24" r="4" fill="${c}"/><path d="M24 5v10M24 33v10M5 24h10M33 24h10" stroke="${c}" stroke-width="3"/>`,
    flag: `<rect x="10" y="8" width="3" height="33" rx="1.5" fill="#ddd"/><rect x="13" y="9" width="26" height="18" fill="${c}"/><path d="M13 9h6.5v6H13zM26 9h6.5v6H26zM19.5 15H26v6h-6.5zM32.5 15H39v6h-6.5zM13 21h6.5v6H13zM26 21h6.5v6H26z" fill="#fff"/>`,
    rook: `<path d="M13 9h5v4h4V9h4v4h4V9h5v9l-4 4v12h4v5H13v-5h4V22l-4-4z" fill="${c}"/>`,
    compass: `<circle cx="24" cy="24" r="15" fill="none" stroke="${c}" stroke-width="3"/><path d="M24 11l5 13-5 13-5-13z" fill="${c}"/><circle cx="24" cy="24" r="2.5" fill="#fff"/>`,
    // Поиск — лупа, избранное — звезда
    lens: `<circle cx="21" cy="21" r="11" fill="none" stroke="${c}" stroke-width="5"/><path d="M29 29l10 10" stroke="${c}" stroke-width="6" stroke-linecap="round"/>`,
    star: `<polygon points="${star(24, 25, 17)}" fill="${c}"/>`,
    // Блокнот: обложка со строками и пружина слева
    notebook: `<rect x="12" y="7" width="27" height="34" rx="3" fill="${c}"/><path d="M19 16h14M19 22h14M19 28h9" stroke="#fff" stroke-width="2.5"/><path d="M9 12h6M9 19h6M9 26h6M9 33h6" stroke="#ddd" stroke-width="2.5" stroke-linecap="round"/>`,
    dice: `<rect x="10" y="10" width="28" height="28" rx="6" fill="${c}"/><circle cx="18" cy="18" r="3" fill="#fff"/><circle cx="24" cy="24" r="3" fill="#fff"/><circle cx="30" cy="30" r="3" fill="#fff"/>`,
    // Доска проектов: три колонки с карточками
    kanban: `<rect x="8" y="9" width="9" height="30" rx="2" fill="${c}"/><rect x="19.5" y="9" width="9" height="22" rx="2" fill="${c}"/><rect x="31" y="9" width="9" height="14" rx="2" fill="${c}"/><path d="M10.5 15h4M10.5 21h4M10.5 27h4M22 15h4M22 21h4M33.5 15h4" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
    // Настройки: меню над браузером, стрелка назад к разговору, панель во всю ширину, галочка, восклицательный знак,
    // колокольчик
    stack: `<rect x="8" y="8" width="32" height="11" rx="3" fill="${c}"/><rect x="8" y="22" width="32" height="18" rx="3" fill="${c}" opacity=".6"/><path d="M13 13.5h12" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
    back: `<path d="M19 11l-9 9 9 9" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 20h17a9 9 0 0 1 0 18h-6" stroke="${c}" stroke-width="5" fill="none" stroke-linecap="round"/>`,
    widen: `<rect x="6" y="11" width="36" height="26" rx="4" fill="none" stroke="${c}" stroke-width="3"/><path d="M14 24h20" stroke="${c}" stroke-width="3"/><path d="M18 19l-5 5 5 5M30 19l5 5-5 5" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    check: `<circle cx="24" cy="24" r="16" fill="${c}"/><path d="M16 24.5l6 6 11-12" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    alert: `<circle cx="24" cy="24" r="16" fill="${c}"/><rect x="22" y="13" width="4" height="14" rx="2" fill="#fff"/><circle cx="24" cy="33" r="2.5" fill="#fff"/>`,
    bell: `<path d="M24 8a10 10 0 0 0-10 10v8l-4 6h28l-4-6v-8A10 10 0 0 0 24 8z" fill="${c}"/><path d="M20 35a4 4 0 0 0 8 0" fill="${c}"/>`,
    // Строка «сыграть?» — секундомером: через сколько она появится
    timer: `<path d="M20 7h8M24 7v5" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><circle cx="24" cy="27" r="15" fill="${c}"/><path d="M24 27v-8M24 27l6 4" stroke="#fff" stroke-width="3.5" stroke-linecap="round"/>`,
    // Аккаунт: две стрелки по кругу — синхронизация, дверь со стрелкой наружу — выход, корзина — удалить
    sync: `<path d="M36.2 19.6A13 13 0 0 0 11 24M11.8 28.4A13 13 0 0 0 37 24" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M6.5 20l4.5 5.5 4.5-5.5M32.5 28l4.5-5.5 4.5 5.5" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    exit: `<path d="M22 9H13a4 4 0 0 0-4 4v22a4 4 0 0 0 4 4h9" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M19 24h19" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M31 16l8 8-8 8" stroke="${c}" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`,
    // Доска: «Отдать Claude» — бумажный самолётик
    send: `<path d="M6 23l35-15-9 33-8-12z" fill="${c}"/><path d="M24 29l17-21" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".7"/>`,
    trash: `<path d="M9 13h30" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M19 12V8h10v4" stroke="${c}" stroke-width="3" fill="none"/><path d="M13 17h22l-2 21a3 3 0 0 1-3 3H18a3 3 0 0 1-3-3z" fill="${c}"/><path d="M20.5 22v13M27.5 22v13" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
    // Настройки: условия — документом, конфиденциальность — замком
    lock: `<path d="M16 21v-5a8 8 0 0 1 16 0v5" stroke="${c}" stroke-width="4" fill="none"/><rect x="11" y="21" width="26" height="19" rx="4" fill="${c}"/><circle cx="24" cy="29" r="2.6" fill="#fff"/><path d="M24 30v5" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>`,
  }
  const shape = { nes: 'pad', sega: 'pad', sms: 'pad', psx: 'disc', games: 'stick', books: 'book', audiobooks: 'phones', mine: 'folder', settings: 'gear', account: 'person', friends: 'people', chats: 'bubble', lang: 'globe', support: 'cup', library: 'window', youtube: 'play', articles: 'doc', podcasts: 'mic', twitch: 'tv', tiktok: 'note', arcade: 'stick', shooters: 'target', racing: 'flag', strategy: 'rook', quests: 'compass', board: 'dice', search: 'lens', favorites: 'star', notes: 'notebook', boards: 'kanban', opener: 'window', 'keep-menu': 'stack', 'back-on-done': 'back', wide: 'widen', 'ask-after': 'timer', 'on-done': 'check', 'on-permission': 'alert', notify: 'bell', 'msg-notify': 'bubble', 'account-sync': 'sync', 'account-logout': 'exit', 'account-delete': 'trash', 'board-send': 'send', 'board-delete': 'trash', 'board-login': 'person', 'board-handle': 'person', 'board-share': 'people', 'board-invite': 'people', 'board-friends': 'people', 'board-off': 'exit', terms: 'doc', privacy: 'lock' }[kind] ?? 'stick'
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#ffffff10"/>${shapes[shape]}</svg>`
}
// Флажки плиток «Arcade · язык»: флаг 36×24, упрощённый до читаемого в 36 точках. Английский — флаг Великобритании,
// португальский — Бразилии: перевод бразильский («você», «arquivo»)
const star = (cx, cy, r, turn = 0) =>
  Array.from({ length: 10 }, (_, k) => {
    const a = ((turn - 90 + k * 36) * Math.PI) / 180
    const d = k % 2 ? r * 0.382 : r
    return `${(cx + d * Math.cos(a)).toFixed(2)},${(cy + d * Math.sin(a)).toFixed(2)}`
  }).join(' ')
// Полосы поровну: сверху вниз или слева направо
const stripes = (colors, vertical = false) =>
  colors.map((c, i) => (vertical ? `<rect x="${(36 / colors.length) * i}" width="${36 / colors.length}" height="24" fill="${c}"/>` : `<rect y="${(24 / colors.length) * i}" width="36" height="${24 / colors.length}" fill="${c}"/>`)).join('')
// Триграмма флага Кореи: три черты, 1 — сплошная, 0 — с разрывом
const trigram = (x, y, angle, bars) =>
  `<g transform="translate(${x} ${y}) rotate(${angle})" fill="#000">${bars.map((solid, k) => (solid ? `<rect x="-2.5" y="${k * 1.6 - 2.1}" width="5" height="1"/>` : `<rect x="-2.5" y="${k * 1.6 - 2.1}" width="2.1" height="1"/><rect x=".4" y="${k * 1.6 - 2.1}" width="2.1" height="1"/>`)).join('')}</g>`
export const FLAGS = {
  en: `<rect width="36" height="24" fill="#012169"/><path d="M0 0l36 24M36 0L0 24" stroke="#fff" stroke-width="4.8"/><path d="M0 0l36 24M36 0L0 24" stroke="#c8102e" stroke-width="1.6"/><path d="M18 0v24M0 12h36" stroke="#fff" stroke-width="8"/><path d="M18 0v24M0 12h36" stroke="#c8102e" stroke-width="4.8"/>`,
  ru: stripes(['#fff', '#0039a6', '#d52b1e']),
  uk: stripes(['#0057b7', '#ffd700']),
  es: `<rect width="36" height="24" fill="#aa151b"/><rect y="6" width="36" height="12" fill="#f1bf00"/>`,
  fr: stripes(['#002395', '#fff', '#ed2939'], true),
  de: stripes(['#000', '#dd0000', '#ffce00']),
  pt: `<rect width="36" height="24" fill="#009c3b"/><path d="M18 3l15 9-15 9-15-9z" fill="#ffdf00"/><circle cx="18" cy="12" r="5.2" fill="#002776"/><path d="M13 11a9 9 0 0 1 9.9 2.6" stroke="#fff" stroke-width=".9" fill="none"/>`,
  it: stripes(['#009246', '#fff', '#ce2b37'], true),
  pl: stripes(['#fff', '#dc143c']),
  tr: `<rect width="36" height="24" fill="#e30a17"/><circle cx="13" cy="12" r="6" fill="#fff"/><circle cx="14.5" cy="12" r="4.8" fill="#e30a17"/><polygon points="${star(21.2, 12, 3, -90)}" fill="#fff"/>`,
  ja: `<rect width="36" height="24" fill="#fff"/><circle cx="18" cy="12" r="7.2" fill="#bc002d"/>`,
  zh: `<rect width="36" height="24" fill="#de2910"/>${[[6, 6, 3.6], [12, 2.4, 1.2], [14.4, 4.8, 1.2], [14.4, 8.4, 1.2], [12, 10.8, 1.2]].map(([x, y, r]) => `<polygon points="${star(x, y, r)}" fill="#ffde00"/>`).join('')}`,
  ko: `<rect width="36" height="24" fill="#fff"/><g transform="rotate(33.7 18 12)"><circle cx="18" cy="12" r="6" fill="#0047a0"/><path d="M12 12a6 6 0 0 1 12 0z" fill="#cd2e3a"/><circle cx="15" cy="12" r="3" fill="#cd2e3a"/><circle cx="21" cy="12" r="3" fill="#0047a0"/></g>${trigram(9.7, 6.4, 123.7, [1, 1, 1])}${trigram(26.3, 6.4, 56.3, [0, 1, 0])}${trigram(9.7, 17.6, 56.3, [1, 0, 1])}${trigram(26.3, 17.6, 123.7, [0, 0, 0])}`,
}
// Флаг — во вложенном svg: он обрезает всё, что вылезло за края (диагонали британского флага); тонкая рамка видна
// у белых флагов и на светлой теме, и на тёмной
export function flagSvg(code) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="12" fill="#ffffff10"/><svg x="6" y="12" width="36" height="24" viewBox="0 0 36 24">${FLAGS[code]}</svg><rect x="6.5" y="12.5" width="35" height="23" fill="none" stroke="#8080804d"/></svg>`
}
// Обложка игры или книги: цвет от названия, крупные буквы
export function coverSvg(g) {
  let h = 0
  for (const ch of g.id) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const hue = h % 360
  const letters = String(tr(g.title, S.lang)).replace(/[^\p{L}\p{N} ]/gu, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join('') || '?'
  const esc = (t) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 56"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},62%,52%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},70%,32%)"/></linearGradient></defs><rect width="56" height="56" rx="10" fill="url(#g)"/><text x="28" y="35" font-family="system-ui,sans-serif" font-size="20" font-weight="700" fill="#fff" text-anchor="middle">${esc(letters)}</text></svg>`
}
