// Переводы Arcade: собирает английские фразы интерфейса мода и окна и обновляет заготовки 11 языков.
// Запуск: node tools/i18n/collect.mjs — после правок интерфейса и описаний игр. Потом — заполнить пустые строки в
// mod/hooks/locales/<язык>.js и site/web/locales/<язык>.json (см. tools/i18n/README.md).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LANGS = ['uk', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'tr', 'ja', 'zh', 'ko']
const templates = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'i18n', 'templates.json'), 'utf8'))
const CYR = /[А-Яа-яЁё]/

// После этих слов «/» начинает регулярное выражение, а не деление
const BEFORE_REGEX = new Set(['return', 'typeof', 'instanceof', 'case', 'do', 'else', 'in', 'of', 'new', 'delete', 'void', 'throw', 'yield', 'await'])
const WORD = /[\w$\u0080-￿]+/y

// Строки с кириллицей из кода: '…', "…" и `…` без подстановок; у `…${…}…` — строки внутри подстановок. Код читается
// по порядку, как его читает JavaScript: кавычка в комментарии, в регулярном выражении или закрывающая кавычка
// шаблона не начинает строку и не съедает код до следующей кавычки
function literals(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = []
  const keep = (s) => CYR.test(s) && out.push(s)
  const subst = [] // открытые подстановки ${…}: сколько в каждой открыто скобок {
  let prev = '' // последний значимый знак или слово
  let i = 0
  // Строка '…' или "…": i — на кавычке. Экранированные кавычки — как есть, остальное экранирование не трогаем
  const quoted = (q) => {
    let s = ''
    for (i++; i < src.length && src[i] !== q && src[i] !== '\n'; i++) s += src[i] === '\\' ? (/['"]/.test(src[i + 1]) ? '' : '\\') + src[++i] : src[i]
    i++
    return s
  }
  // Кусок шаблона: i — после ` или } подстановки. open — кусок кончился на ${, а не на `
  const template = () => {
    let s = ''
    for (; i < src.length; i++) {
      if (src[i] === '\\') s += src[i] + src[++i]
      else if (src[i] === '`') return i++, { s, open: false }
      else if (src[i] === '$' && src[i + 1] === '{') return (i += 2), { s, open: true }
      else s += src[i]
    }
    return { s, open: false }
  }
  // Регулярное выражение: i — на «/»
  const regex = () => {
    let cls = false
    for (i++; i < src.length && src[i] !== '\n'; i++) {
      if (src[i] === '\\') i++
      else if (src[i] === '[') cls = true
      else if (src[i] === ']') cls = false
      else if (src[i] === '/' && !cls) break
    }
    i++
  }
  while (i < src.length) {
    const c = src[i]
    if (/\s/.test(c)) i++
    else if (c === '/' && src[i + 1] === '/') i = src.includes('\n', i) ? src.indexOf('\n', i) : src.length
    else if (c === '/' && src[i + 1] === '*') i = src.includes('*/', i + 2) ? src.indexOf('*/', i + 2) + 2 : src.length
    else if (c === '/' && (!prev || BEFORE_REGEX.has(prev) || /^[(,=:[!&|?{};+\-*%<>~^]$/.test(prev))) regex(), (prev = 'x')
    else if (c === "'" || c === '"') keep(quoted(c)), (prev = 'x')
    else if (c === '`' || (c === '}' && subst.at(-1) === 0)) {
      if (c === '}') subst.pop()
      i++
      const t = template()
      if (t.open) subst.push(0)
      else if (c === '`') keep(t.s)
      prev = t.open ? '{' : 'x'
    } else if ((WORD.lastIndex = i), WORD.exec(src)) {
      prev = BEFORE_REGEX.has(src.slice(i, WORD.lastIndex)) ? src.slice(i, WORD.lastIndex) : 'x'
      i = WORD.lastIndex
    } else {
      if (subst.length && c === '{') subst[subst.length - 1]++
      if (subst.length && c === '}') subst[subst.length - 1]--
      prev = c
      i++
    }
  }
  return out
}
// Слова подсказок клавиш: английские части пар «слово — клавиша»
const hintWords = (en) => en.split(/ · /).flatMap((part) => part.split(/ — /).slice(0, 1)).map((w) => w.trim()).filter((w) => /^[a-z][a-z ,'-]{2,40}$/i.test(w))

// Английские значения словаря переводчика: подписи, которые код собирает шаблонной строкой (`Язык: ${…}`)
function dictionary(file) {
  const src = fs.readFileSync(file, 'utf8')
  return [...src.matchAll(/'((?:[^'\\\n]|\\.)*)':\s*'((?:[^'\\\n]|\\.)*)'/g)].filter((m) => CYR.test(m[1]) && !CYR.test(m[2])).map((m) => m[2].replace(/\\'/g, "'"))
}

function collect(files, translate, dict = []) {
  const exact = new Set(dict.map((s) => s.trim()).filter(Boolean))
  const words = new Set()
  for (const file of files) {
    for (const lit of literals(file)) {
      const en = String(translate(lit) ?? '').trim()
      if (!en || CYR.test(en) || en === lit) continue
      exact.add(en)
      if (en.includes(' — ') && en.includes(' · ')) for (const w of hintWords(en)) words.add(w)
    }
  }
  return { exact: [...exact].sort(), words: [...words].sort() }
}

function merge(previous, source, tpl) {
  const exact = Object.fromEntries(source.exact.map((k) => [k, previous?.exact?.[k] ?? '']))
  const temps = Object.fromEntries(tpl.map((k) => [k, previous?.templates?.[k] ?? '']))
  const prevWords = new Map(previous?.words ?? [])
  const words = source.words.map((w) => [w, prevWords.get(w) ?? ''])
  return { exact, templates: temps, words }
}
const empty = (o) => Object.values(o.exact).filter((v) => !v).length + Object.values(o.templates).filter((v) => !v).length + o.words.filter(([, v]) => !v).length + Object.values(o.about ?? {}).filter((v) => !v).length

// --- Мод ---------------------------------------------------------------------------------------------------------
const { tr } = await import(pathToFileURL(path.join(ROOT, 'mod', 'hooks', 'i18n.js')).href)
// Код мода — hooks/ с подпапками app/ и screens/; переводы, эмулятор и игры Денди не нужны
const modFiles = fs
  .readdirSync(path.join(ROOT, 'mod', 'hooks'), { recursive: true })
  .map((f) => f.replaceAll('\\', '/'))
  .filter((f) => f.endsWith('.js') && f !== 'i18n.js' && !/^(locales|vendor|roms)\//.test(f))
  .map((f) => path.join(ROOT, 'mod', 'hooks', f))
// Фразы, которые код собирает сам (например «a Chrome window»), — дополнительно из templates.json: modExact и siteExact
const modSource = collect(modFiles, (s) => tr(s, 'en'), [...dictionary(path.join(ROOT, 'mod', 'hooks', 'i18n.js')), ...(templates.modExact ?? [])])
for (const lang of LANGS) {
  const file = path.join(ROOT, 'mod', 'hooks', 'locales', `${lang}.js`)
  const previous = fs.existsSync(file) ? (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).default : null
  const next = merge(previous, modSource, templates.mod)
  fs.writeFileSync(file, `// Перевод интерфейса мода (${lang}). Ключи — английские фразы; пустые строки — ещё не переведены.\n// Обновляется: node tools/i18n/collect.mjs. Правила — tools/i18n/README.md\nexport default ${JSON.stringify(next, null, 1)}\n`)
  console.log(`мод ${lang}: фраз ${modSource.exact.length}, шаблонов ${templates.mod.length}, слов ${modSource.words.length}; не переведено ${empty(next)}`)
}

// --- Окно --------------------------------------------------------------------------------------------------------
const store = new Map([['arcade:lang', 'en']])
const ctx = { window: {}, document: { documentElement: {} }, navigator: { language: 'en-US' }, location: { search: '?lang=en' }, URLSearchParams, localStorage: { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) } }
ctx.window = ctx
vm.createContext(ctx)
vm.runInContext(fs.readFileSync(path.join(ROOT, 'site', 'web', 'i18n.js'), 'utf8'), ctx)
const T = ctx.T ?? ctx.window.T
const siteFiles = fs.readdirSync(path.join(ROOT, 'site', 'web')).filter((f) => f.endsWith('.js') && !['i18n.js', 'jsnes.js', 'mapper28.js'].includes(f)).map((f) => path.join(ROOT, 'site', 'web', f))
const siteSource = collect(siteFiles, (s) => T(s), [...dictionary(path.join(ROOT, 'site', 'web', 'i18n.js')), ...(templates.siteExact ?? [])])
// Описания игр каталога (about): английское описание → перевод. Английские описания — из сборки сайта во временную папку
const { build, download } = await import(pathToFileURL(path.join(ROOT, 'site', 'build.mjs')).href)
// Игры, которые сборка скачивает (download в каталоге), должны быть в кеше — иначе сборка остановится
await download({ root: path.join(ROOT, 'site') })
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'arcade-i18n-'))
let abouts
try {
  abouts = [...new Set(Object.values(build({ root: path.join(ROOT, 'site'), out: temp }).games).map((g) => g.about_en).filter(Boolean))].sort()
} finally {
  fs.rmSync(temp, { recursive: true, force: true })
}
fs.mkdirSync(path.join(ROOT, 'site', 'web', 'locales'), { recursive: true })
for (const lang of LANGS) {
  const file = path.join(ROOT, 'site', 'web', 'locales', `${lang}.json`)
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
  const next = { ...merge(previous, siteSource, templates.site), about: Object.fromEntries(abouts.map((k) => [k, previous?.about?.[k] ?? ''])) }
  fs.writeFileSync(file, JSON.stringify(next, null, 1) + '\n')
  console.log(`окно ${lang}: фраз ${siteSource.exact.length}, шаблонов ${templates.site.length}, слов ${siteSource.words.length}, описаний ${abouts.length}; не переведено ${empty(next)}`)
}
