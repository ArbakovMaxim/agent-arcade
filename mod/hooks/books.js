// Книги и аудиокниги: список приходит с сайта (/api/books/list) — Project Gutenberg, Викитека и LibriVox, у себя
// Arcade книг не хранит. Язык книг выбирает человек (сначала — язык интерфейса), разделы одни на все языки, поиск —
// по названию или автору. Открывается книга в окне Arcade: там читалка, проигрыватель и «Мои книги» этого браузера.

// Те же языки и разделы, что у сервера (site/worker/books.js) и окна (site/web/open-library.js): тест следит, чтобы
// списки совпадали. Название языка — на нём самом, чтобы найти свой, не понимая текущего
export const BOOK_LANGS = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  es: 'Español',
  it: 'Italiano',
  pt: 'Português',
  nl: 'Nederlands',
  ru: 'Русский',
  uk: 'Українська',
  pl: 'Polski',
  cs: 'Čeština',
  hu: 'Magyar',
  ro: 'Română',
  bg: 'Български',
  el: 'Ελληνικά',
  la: 'Latina',
  fi: 'Suomi',
  sv: 'Svenska',
  da: 'Dansk',
  no: 'Norsk',
  ca: 'Català',
  eo: 'Esperanto',
  tr: 'Türkçe',
  he: 'עברית',
  ar: 'العربية',
  hi: 'हिन्दी',
  zh: '中文',
  ja: '日本語',
  ko: '한국어',
  tl: 'Tagalog',
}
export const BOOK_SECTIONS = {
  popular: 'Популярное',
  fiction: 'Проза',
  poetry: 'Стихи',
  drama: 'Пьесы',
  adventure: 'Приключения',
  detective: 'Детективы',
  love: 'О любви',
  scifi: 'Фантастика',
  fairy: 'Сказки',
  children: 'Детям',
  stories: 'Рассказы',
  horror: 'Ужасы',
  humor: 'Юмор',
  history: 'История',
  biography: 'Биографии',
  philosophy: 'Философия',
  religion: 'Религия',
  science: 'Наука',
  travel: 'Путешествия',
}
export const BOOK_SOURCES = { gutenberg: 'Project Gutenberg', wikisource: 'Викитека', librivox: 'LibriVox' }
export const MIN_BOOK_QUERY = 2

// Язык книг: сохранённый, иначе язык интерфейса, если книги на нём есть, иначе английский
export function bookLang(saved, uiLang) {
  if (Object.hasOwn(BOOK_LANGS, saved ?? '')) return saved
  return Object.hasOwn(BOOK_LANGS, uiLang ?? '') ? uiLang : 'en'
}

// Поиск: как у сервера — буквы любых языков, цифры, пробел, дефис и апостроф; до 80 знаков
export function bookQuery(text) {
  return String(text ?? '')
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\p{M}'’ -]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80)
    .trim()
}

// Адрес списка на сайте: раздел или поиск, страница с первой
export function booksPath(kind, lang, { section = 'popular', q = '', page = 1 } = {}) {
  const what = q ? `q=${encodeURIComponent(q)}` : `section=${encodeURIComponent(section)}`
  return `api/books/list?kind=${kind}&lang=${encodeURIComponent(lang)}&${what}&page=${page}`
}

// Ссылка на книгу: gutenberg:<номер>, wikisource:<язык>:<страница>, librivox:<id archive.org>
const REF = { book: /^(gutenberg:\d{1,6}|wikisource:[a-z]{2,3}:[^\n\r]{1,255})$/, audio: /^librivox:[\w.-]{1,100}$/ }

// Ответ сайта → { items: [{ ref, source, title, author }], more } или { error }; чужие ссылки и пустые названия — мимо
export function parseBooks(kind, response) {
  if (!response) return { error: 'нет связи' }
  let data = null
  try {
    data = JSON.parse(response.text ?? '')
  } catch {
    // не JSON — ниже ответим кодом
  }
  if (!response.ok) return { error: typeof data?.error === 'string' ? data.error.slice(0, 120) : `сервер ответил ${response.status}` }
  if (!data || !Array.isArray(data.items)) return { error: 'не тот ответ' }
  const clip = (text, max) => String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
  const items = data.items
    .filter((x) => x && typeof x.ref === 'string' && REF[kind].test(x.ref) && clip(x.title, 200))
    .map((x) => ({ ref: x.ref, source: x.ref.split(':')[0], title: clip(x.title, 200), author: clip(x.author, 120) }))
  return { items, more: data.more === true }
}
