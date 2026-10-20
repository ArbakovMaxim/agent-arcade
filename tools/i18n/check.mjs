// Проверка переводов Arcade: в каждом из 11 языков все фразы переведены, места {0}, {1} — те же,
// формы числа записаны правильно. Запуск: node tools/i18n/check.mjs — должно закончиться строкой «переводы в порядке».
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const LANGS = ['uk', 'es', 'fr', 'de', 'pt', 'it', 'pl', 'tr', 'ja', 'zh', 'ko']
const CATEGORIES = new Set(['zero', 'one', 'two', 'few', 'many', 'other'])
const problems = []
const places = (s) => [...s.matchAll(/\{(\d+)(?:#[^}]*)?\}/g)].map((m) => m[1]).sort().join(',')

function check(where, lang, data) {
  for (const [key, value] of Object.entries(data.exact ?? {})) {
    if (!value) problems.push(`${where} ${lang}: не переведено «${key}»`)
  }
  for (const [key, value] of Object.entries(data.templates ?? {})) {
    if (!value) {
      problems.push(`${where} ${lang}: не переведён шаблон «${key}»`)
      continue
    }
    if (places(key) !== places(value)) problems.push(`${where} ${lang}: в «${value}» другие места подстановки, чем в «${key}»`)
    for (const m of value.matchAll(/\{\d+#([^}]*)\}/g)) {
      const cats = m[1].split(';').map((p) => p.slice(0, p.indexOf('=')).trim())
      if (!cats.includes('other') || cats.some((c) => !CATEGORIES.has(c))) problems.push(`${where} ${lang}: формы числа в «${value}» — нужны категории Intl.PluralRules и обязательно other`)
    }
  }
  for (const [word, value] of data.words ?? []) if (!value) problems.push(`${where} ${lang}: не переведено слово подсказки «${word}»`)
}

for (const lang of LANGS) {
  check('мод', lang, (await import(pathToFileURL(path.join(ROOT, 'mod', 'hooks', 'locales', `${lang}.js`)).href)).default)
  check('окно', lang, JSON.parse(fs.readFileSync(path.join(ROOT, 'site', 'web', 'locales', `${lang}.json`), 'utf8')))
}
if (problems.length) {
  console.log(problems.slice(0, 60).join('\n'))
  console.log(`\nПроблем: ${problems.length}`)
  process.exitCode = 1
} else console.log('переводы в порядке')
