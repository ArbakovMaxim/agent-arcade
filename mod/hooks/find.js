// Поиск по библиотеке: игры, книги, аудиокниги и каналы Twitch. Сравнение без регистра и без диакритики: «Шерлок»,
// «шерлок» и «ШЕРЛОК» — одно и то же, ё = е, é = e. Здесь нет вызовов Claude Code — экран поиска в hooks/screens/games.js
export const MIN_QUERY = 2 // короче — ещё не ищем: одна буква находит полкаталога
export const FIND_LIMIT = 60 // больше на экране не показываем — просим уточнить

// Текст для сравнения: строчными, без ударений и прочих знаков над буквами
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

// Слова запроса: '' — ничего
export function queryWords(query) {
  return fold(query).split(/[\s,.;:!?«»"“”()]+/).filter(Boolean)
}

// Насколько запись подходит к запросу: -1 — не подходит (какого-то слова нет ни в одном поле); 0 — название
// начинается с запроса, 1 — с него начинается слово названия, 2 — все слова есть в названии, 3 — в других полях
// (автор, жанр, раздел). fields[0] — название
export function rank(fields, query) {
  const words = queryWords(query)
  if (!words.length) return -1
  const list = fields.filter((f) => f != null && f !== '').map(fold)
  const hay = list.join('\n')
  if (!words.every((w) => hay.includes(w))) return -1
  const title = list[0] ?? ''
  const whole = words.join(' ')
  if (title.startsWith(whole)) return 0
  if (title.split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(words[0])) && title.includes(whole)) return 1
  if (words.every((w) => title.includes(w))) return 2
  return 3
}

// Найти в списке: fieldsOf(запись) → поля, первое — название. Порядок — по тому, как подходит, при равенстве — как в
// списке
export function find(list, query, fieldsOf) {
  return list
    .map((item, i) => ({ item, i, r: rank(fieldsOf(item), query) }))
    .filter((x) => x.r >= 0)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.item)
}

// Избранное из $.store или с сайта: id по порядку добавления, без повторов, не больше limit
export function restoreFavorites(value, limit) {
  if (!Array.isArray(value)) return null
  const ids = value.filter((id) => typeof id === 'string' && /^[\w.:-]{1,100}$/.test(id))
  return [...new Set(ids)].slice(-limit)
}

// Отметить или снять: { list, added } — added: true — добавлено, false — снято, null — места нет
export function toggleIn(list, id, limit) {
  if (list.includes(id)) return { list: list.filter((x) => x !== id), added: false }
  if (list.length >= limit) return { list, added: null }
  return { list: [...list, id], added: true }
}
