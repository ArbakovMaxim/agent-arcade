// Аватарки чатов Arcade: 24 готовые картинки, своих фото нет. Аккаунт хранит только номер 0–23 (сайт: PUT /api/me/avatar),
// картинку каждый рисует у себя из этого файла. Кто аватарку не выбрал — кружок с первой буквой ника, цвет от ника.
// Картинка группы — тоже номер из этих 24, выбирает хозяин группы; без него — буква названия, цвет от номера чата.
// Файл общий: сборка сайта кладёт его на страницу чатов как есть (без export, в window.ArcadeAvatars),
// поэтому здесь нет импортов. Картинка — отдельный SVG-документ: в Desktop и VS Code он рисуется как изображение,
// на сайте — через <img>, поэтому id внутри не пересекаются.

// Лепестки подсолнуха, пиксели пришельца и плечи людей — общие куски
const PETALS = [...Array(10)].map((_, k) => `<ellipse cx="32" cy="17" rx="4" ry="8" fill="#EF9F27" transform="rotate(${k * 36} 32 28)"/>`).join('')
const INVADER = ['..X.....X..', '...X...X...', '..XXXXXXX..', '.XX.XXX.XX.', 'XXXXXXXXXXX', 'X.XXXXXXX.X', 'X.X.....X.X', '...XX.XX...']
  .map((row, y) => [...row].map((c, x) => (c === 'X' ? `<rect x="${(13.3 + x * 3.4).toFixed(1)}" y="${(18.4 + y * 3.4).toFixed(1)}" width="3.5" height="3.5" fill="#97C459"/>` : '')).join(''))
  .join('')
const SHOULDERS = (color) => `<path d="M14 64 Q14 50 32 50 Q50 50 50 64Z" fill="${color}"/>`

// [фон, рисунок на поле 64×64, имя по-русски, по-английски]. Порядок не менять: аккаунты хранят номер
const AVATARS = [
  ['#FAC775', '<path d="M18 27 L20 11 L31 22Z M46 27 L44 11 L33 22Z" fill="#854F0B"/><circle cx="32" cy="36" r="16" fill="#854F0B"/><circle cx="26" cy="34" r="2.5" fill="#FAEEDA"/><circle cx="38" cy="34" r="2.5" fill="#FAEEDA"/><path d="M30 40h4l-2 2.5z" fill="#F4C0D1"/>', 'кот', 'cat'],
  ['#F5C4B3', '<path d="M14 18 L24 26 L40 26 L50 18 L46 38 L32 52 L18 38Z" fill="#D85A30"/><path d="M22 38 L32 52 L42 38 L32 42Z" fill="#FAECE7"/><circle cx="25" cy="33" r="2.5" fill="#4A1B0C"/><circle cx="39" cy="33" r="2.5" fill="#4A1B0C"/><circle cx="32" cy="50" r="2.5" fill="#4A1B0C"/>', 'лиса', 'fox'],
  ['#EEEDFE', '<path d="M18 18 L24 25 L40 25 L46 18 L48 44 Q32 58 16 44Z" fill="#534AB7"/><circle cx="25" cy="34" r="7" fill="#EEEDFE"/><circle cx="39" cy="34" r="7" fill="#EEEDFE"/><circle cx="25" cy="34" r="3" fill="#26215C"/><circle cx="39" cy="34" r="3" fill="#26215C"/><path d="M30 41h4l-2 4z" fill="#EF9F27"/>', 'сова', 'owl'],
  ['#D3D1C7', '<circle cx="19" cy="20" r="6" fill="#2C2C2A"/><circle cx="45" cy="20" r="6" fill="#2C2C2A"/><circle cx="32" cy="35" r="17" fill="#fff"/><ellipse cx="25" cy="33" rx="4.5" ry="6" fill="#2C2C2A" transform="rotate(25 25 33)"/><ellipse cx="39" cy="33" rx="4.5" ry="6" fill="#2C2C2A" transform="rotate(-25 39 33)"/><circle cx="25" cy="33" r="1.6" fill="#fff"/><circle cx="39" cy="33" r="1.6" fill="#fff"/><ellipse cx="32" cy="41" rx="3" ry="2" fill="#2C2C2A"/>', 'панда', 'panda'],
  ['#F4C0D1', '<ellipse cx="25" cy="18" rx="4.5" ry="12" fill="#fff"/><ellipse cx="39" cy="18" rx="4.5" ry="12" fill="#fff"/><ellipse cx="25" cy="18" rx="2" ry="8" fill="#ED93B1"/><ellipse cx="39" cy="18" rx="2" ry="8" fill="#ED93B1"/><circle cx="32" cy="40" r="14" fill="#fff"/><circle cx="27" cy="38" r="2" fill="#4B1528"/><circle cx="37" cy="38" r="2" fill="#4B1528"/><circle cx="32" cy="43" r="1.8" fill="#D4537E"/>', 'кролик', 'rabbit'],
  ['#B5D4F4', '<ellipse cx="32" cy="38" rx="17" ry="20" fill="#042C53"/><ellipse cx="32" cy="42" rx="11" ry="14" fill="#fff"/><circle cx="27" cy="33" r="2.2" fill="#042C53"/><circle cx="37" cy="33" r="2.2" fill="#042C53"/><path d="M28 37h8l-4 4z" fill="#EF9F27"/>', 'пингвин', 'penguin'],
  ['#C0DD97', '<circle cx="22" cy="24" r="7" fill="#639922"/><circle cx="42" cy="24" r="7" fill="#639922"/><ellipse cx="32" cy="38" rx="20" ry="14" fill="#639922"/><circle cx="22" cy="24" r="4" fill="#fff"/><circle cx="42" cy="24" r="4" fill="#fff"/><circle cx="22" cy="24" r="2" fill="#173404"/><circle cx="42" cy="24" r="2" fill="#173404"/><path d="M22 42 Q32 50 42 42" stroke="#173404" stroke-width="2" fill="none" stroke-linecap="round"/>', 'лягушка', 'frog'],
  ['#9FE1CB', '<path d="M16 36 A16 16 0 0 1 48 36 L48 44 Q44 50 40 44 Q36 50 32 44 Q28 50 24 44 Q20 50 16 44Z" fill="#D4537E"/><circle cx="26" cy="33" r="3" fill="#fff"/><circle cx="38" cy="33" r="3" fill="#fff"/><circle cx="26" cy="33" r="1.5" fill="#4B1528"/><circle cx="38" cy="33" r="1.5" fill="#4B1528"/>', 'осьминог', 'octopus'],
  ['#AFA9EC', `<path d="M14 40 Q14 14 32 14 Q50 14 50 40 L50 52 L14 52Z" fill="#412402"/><circle cx="32" cy="34" r="13" fill="#F5C4B3"/><path d="M19 31 Q21 18 32 18 Q43 18 45 31 Q36 27 30 22 Q26 28 19 31Z" fill="#412402"/><circle cx="27" cy="35" r="1.8" fill="#412402"/><circle cx="37" cy="35" r="1.8" fill="#412402"/><path d="M28 40 Q32 43 36 40" stroke="#993C1D" stroke-width="1.8" fill="none" stroke-linecap="round"/>${SHOULDERS('#534AB7')}`, 'девушка', 'girl'],
  ['#85B7EB', `${SHOULDERS('#0F6E56')}<circle cx="32" cy="32" r="13" fill="#BA7517"/><path d="M19 32 Q19 48 32 48 Q45 48 45 32 Q40 40 32 40 Q24 40 19 32Z" fill="#2C2C2A"/><path d="M19 28 Q20 16 32 16 Q44 16 45 28 Q38 22 19 28Z" fill="#2C2C2A"/><circle cx="27" cy="31" r="1.8" fill="#2C2C2A"/><circle cx="37" cy="31" r="1.8" fill="#2C2C2A"/>`, 'бородач', 'bearded man'],
  ['#26215C', '<circle cx="13" cy="16" r="1.2" fill="#fff"/><circle cx="50" cy="12" r="1" fill="#fff"/><circle cx="53" cy="44" r="1.2" fill="#fff"/><path d="M16 64 Q16 50 32 50 Q48 50 48 64Z" fill="#F1EFE8"/><circle cx="32" cy="32" r="17" fill="#F1EFE8"/><rect x="20" y="24" width="24" height="16" rx="8" fill="#378ADD"/><path d="M24 30 Q26 27 30 27" stroke="#E6F1FB" stroke-width="2" fill="none" stroke-linecap="round"/>', 'космонавт', 'astronaut'],
  ['#F09595', `${SHOULDERS('#2C2C2A')}<circle cx="32" cy="33" r="15" fill="#2C2C2A"/><rect x="19" y="21" width="26" height="4" rx="2" fill="#E24B4A"/><path d="M44 22 L56 16 L54 27Z" fill="#E24B4A"/><rect x="20" y="29" width="24" height="8" rx="4" fill="#F5C4B3"/><circle cx="27" cy="33" r="1.8" fill="#2C2C2A"/><circle cx="37" cy="33" r="1.8" fill="#2C2C2A"/>`, 'ниндзя', 'ninja'],
  ['#97C459', `${SHOULDERS('#D85A30')}<circle cx="32" cy="34" r="13" fill="#FAC775"/><path d="M18 30 Q18 16 32 16 Q46 16 46 30Z" fill="#185FA5"/><rect x="32" y="27" width="20" height="4" rx="2" fill="#185FA5"/><circle cx="27" cy="36" r="1.8" fill="#412402"/><circle cx="37" cy="36" r="1.8" fill="#412402"/><path d="M28 41 Q32 44 36 41" stroke="#854F0B" stroke-width="1.8" fill="none" stroke-linecap="round"/>`, 'парень в кепке', 'guy in a cap'],
  ['#5DCAA5', `<circle cx="32" cy="14" r="7" fill="#26215C"/>${SHOULDERS('#FAC775')}<circle cx="32" cy="34" r="13" fill="#D85A30"/><path d="M19 32 Q18 18 32 18 Q46 18 45 32 Q40 24 32 24 Q24 24 19 32Z" fill="#26215C"/><circle cx="27" cy="35" r="1.8" fill="#2C2C2A"/><circle cx="37" cy="35" r="1.8" fill="#2C2C2A"/><path d="M28 40 Q32 43 36 40" stroke="#FAECE7" stroke-width="1.8" fill="none" stroke-linecap="round"/>`, 'девушка с пучком', 'girl with a bun'],
  ['#FAEEDA', '<path d="M26 34 H21 Q17 34 17 30 V24" stroke="#3B6D11" stroke-width="6" fill="none" stroke-linecap="round"/><path d="M38 30 H43 Q47 30 47 26 V20" stroke="#3B6D11" stroke-width="6" fill="none" stroke-linecap="round"/><rect x="26" y="14" width="12" height="34" rx="6" fill="#3B6D11"/><path d="M20 46 H44 L41 58 H23Z" fill="#D85A30"/><circle cx="32" cy="13" r="3" fill="#ED93B1"/>', 'кактус', 'cactus'],
  ['#B5D4F4', `<path d="M32 36 V64" stroke="#3B6D11" stroke-width="4"/><path d="M32 52 Q22 52 20 44 Q28 44 32 52Z" fill="#639922"/>${PETALS}<circle cx="32" cy="28" r="8" fill="#633806"/>`, 'подсолнух', 'sunflower'],
  ['#EAF3DE', '<rect x="25" y="32" width="14" height="20" rx="5" fill="#F1EFE8"/><path d="M12 36 Q12 14 32 14 Q52 14 52 36Z" fill="#E24B4A"/><circle cx="24" cy="24" r="3" fill="#fff"/><circle cx="38" cy="22" r="3.5" fill="#fff"/><circle cx="44" cy="31" r="2" fill="#fff"/><circle cx="20" cy="32" r="2" fill="#fff"/>', 'мухомор', 'mushroom'],
  ['#E6F1FB', '<rect x="29" y="44" width="6" height="12" fill="#633806"/><path d="M32 10 L44 26 H38 L48 38 H40 L50 48 H14 L24 38 H16 L26 26 H20Z" fill="#27500A"/>', 'ёлка', 'fir tree'],
  ['#FBEAF0', '<path d="M32 36 V60" stroke="#3B6D11" stroke-width="3"/><path d="M32 54 Q22 52 20 42 Q30 44 32 54Z" fill="#639922"/><path d="M20 18 L26 24 L32 14 L38 24 L44 18 L44 30 Q44 40 32 40 Q20 40 20 30Z" fill="#D4537E"/>', 'тюльпан', 'tulip'],
  ['#0C447C', '<path d="M26 46 L32 60 L38 46Z" fill="#EF9F27"/><path d="M22 34 L14 48 H23Z M42 34 L50 48 H41Z" fill="#E24B4A"/><path d="M32 8 Q44 20 42 46 H22 Q20 20 32 8Z" fill="#F1EFE8"/><circle cx="32" cy="26" r="5" fill="#378ADD"/>', 'ракета', 'rocket'],
  ['#3C3489', '<circle cx="12" cy="14" r="1.2" fill="#fff"/><circle cx="52" cy="52" r="1.2" fill="#fff"/><g transform="rotate(-20 32 32)"><ellipse cx="32" cy="32" rx="24" ry="7" fill="none" stroke="#FAC775" stroke-width="3"/></g><circle cx="32" cy="32" r="13" fill="#EF9F27"/><g transform="rotate(-20 32 32)"><path d="M8 32 A24 7 0 0 0 56 32" fill="none" stroke="#FAC775" stroke-width="3"/></g>', 'планета', 'planet'],
  ['#CECBF6', '<path d="M18 52 V30 Q18 14 32 14 Q46 14 46 30 V52 L41 47 L36 52 L32 47 L28 52 L23 47Z" fill="#fff"/><circle cx="27" cy="30" r="2.5" fill="#26215C"/><circle cx="37" cy="30" r="2.5" fill="#26215C"/><ellipse cx="32" cy="38" rx="3" ry="4" fill="#26215C"/>', 'призрак', 'ghost'],
  ['#9FE1CB', '<path d="M32 12 V18" stroke="#5F5E5A" stroke-width="2"/><circle cx="32" cy="11" r="3" fill="#E24B4A"/><rect x="16" y="18" width="32" height="26" rx="6" fill="#888780"/><circle cx="25" cy="30" r="4.5" fill="#E1F5EE"/><circle cx="39" cy="30" r="4.5" fill="#E1F5EE"/><circle cx="25" cy="30" r="2" fill="#04342C"/><circle cx="39" cy="30" r="2" fill="#04342C"/><rect x="24" y="37" width="16" height="3" rx="1.5" fill="#E1F5EE"/><rect x="22" y="46" width="20" height="18" rx="3" fill="#5F5E5A"/>', 'робот', 'robot'],
  ['#2C2C2A', INVADER, 'пришелец', 'alien'],
]

const AVATAR_COUNT = AVATARS.length

// Цвета кружков с буквой — тёмные, чтобы белая буква читалась
const LETTER_COLORS = ['#C0504D', '#D9822B', '#7E57C2', '#3E8E41', '#2A8C8C', '#3A78B5', '#C2477F', '#8D6E63']

// Номер аватарки: целое 0–23, иначе её нет
function validPic(n) {
  return Number.isInteger(n) && n >= 0 && n < AVATAR_COUNT
}

// Документ SVG в круге: сама картинка квадратная, круг вырезает clipPath
const round = (inner) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64"><clipPath id="r"><circle cx="32" cy="32" r="32"/></clipPath><g clip-path="url(#r)">${inner}</g></svg>`

function avatarSvg(n) {
  const [bg, body] = AVATARS[validPic(n) ? n : 0]
  return round(`<rect width="64" height="64" fill="${bg}"/>${body}`)
}

const escape = (text) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)

// Первая буква имени: без @ в начале, заглавная; нет букв — «?»
function initial(name) {
  const first = [...String(name ?? '').replace(/^@/, '').trim()][0]
  return first ? first.toUpperCase() : '?'
}

// Цвет кружка от ника или номера чата: у одного и того же — всегда один
function letterColor(seed) {
  let hash = 0
  for (const c of String(seed ?? '')) hash = (hash * 31 + c.codePointAt(0)) >>> 0
  return LETTER_COLORS[hash % LETTER_COLORS.length]
}

function letterSvg(name, seed = name) {
  return round(
    `<rect width="64" height="64" fill="${letterColor(seed)}"/><text x="32" y="33" text-anchor="middle" dominant-baseline="central" font-family="system-ui, -apple-system, 'Segoe UI', sans-serif" font-size="30" font-weight="600" fill="#fff">${escape(initial(name))}</text>`,
  )
}

// Картинка человека или группы: выбранная аватарка, иначе буква
function picSvg(pic, name, seed) {
  return validPic(pic) ? avatarSvg(pic) : letterSvg(name, seed)
}

// Что на аватарке — для подписи к картинке: по-русски для ru, иначе по-английски
function avatarName(n, lang) {
  if (!validPic(n)) return ''
  return lang === 'ru' ? AVATARS[n][2] : AVATARS[n][3]
}

export { AVATAR_COUNT, avatarName, avatarSvg, initial, letterColor, letterSvg, picSvg, validPic }
