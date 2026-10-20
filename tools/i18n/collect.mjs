// Переводы Arcade: собирает английские фразы интерфейса мода и окна и обновляет заготовки 11 языков.
// Запуск: node tools/i18n/collect.mjs — после правок интерфейса. Потом — заполнить пустые строки в
// mod/hooks/locales/<язык>.js и site/web/locales/<язык>.json (см. tools/i18n/README.md).
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LANGS = ['uk', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'tr', 'ja', 'zh', 'ko']
const templates = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'i18n', 'templates.json'), 'utf8'))
const CYR = /[А-Яа-яЁё]/

// Строки с кириллицей из кода: '…', "…" и `…` без подстановок
function literals(file) {
  const src = fs.readFileSync(file, 'utf8')
  const out = []
  for (const m of src.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`([^`$\\]*)`/g)) {
    const s = (m[1] ?? m[2] ?? m[3] ?? '').replace(/\\'/g, "'").replace(/\\"/g, '"')
    if (CYR.test(s)) out.push(s)
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
const empty = (o) => Object.values(o.exact).filter((v) => !v).length + Object.values(o.templates).filter((v) => !v).length + o.words.filter(([, v]) => !v).length

// --- Мод ---------------------------------------------------------------------------------------------------------
const { tr } = await import(pathToFileURL(path.join(ROOT, 'mod', 'hooks', 'i18n.js')).href)
const modFiles = fs.readdirSync(path.join(ROOT, 'mod', 'hooks')).filter((f) => f.endsWith('.js') && f !== 'i18n.js').map((f) => path.join(ROOT, 'mod', 'hooks', f))
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
fs.mkdirSync(path.join(ROOT, 'site', 'web', 'locales'), { recursive: true })
for (const lang of LANGS) {
  const file = path.join(ROOT, 'site', 'web', 'locales', `${lang}.json`)
  const previous = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null
  const next = merge(previous, siteSource, templates.site)
  fs.writeFileSync(file, JSON.stringify(next, null, 1) + '\n')
  console.log(`окно ${lang}: фраз ${siteSource.exact.length}, шаблонов ${templates.site.length}, слов ${siteSource.words.length}; не переведено ${empty(next)}`)
}
