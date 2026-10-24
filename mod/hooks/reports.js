// Отчёты об ошибках: что мод прикладывает к отчёту и разбор ответов сайта Arcade. Сеть и экраны — в hooks/register.js.
// Отправить отчёт может каждый: со входом он подписан аккаунтом, без входа — без подписи. Список и «Закрыть» — только у
// админа (автора Arcade): сайт сам проверяет, кто спрашивает, а мод другим даже не показывает плитку. Текст отчётов
// приходит с сайта — из него убираются управляющие знаки, как в чатах: терминал принял бы их за команды
import { HANDLE, count, trouble } from './account.js'
import { cleanText } from './chats.js'
import { jsonFrom } from './youtube.js'

export const MAX_REPORT = 2000 // знаков в отчёте
const MAX_LISTED = 50 // отчётов в одном ответе — больше сайт не отдаёт
const VERSION = /^\d{1,3}\.\d{1,3}\.\d{1,3}$/
const SURFACES = ['terminal', 'desktop', 'vscode', 'mobile']
const SYSTEMS = ['windows', 'mac', 'linux']
const LANG = /^[a-z]{2}$/
const ACCOUNT_ID = /^\d{1,20}$/

// Первые n знаков (не половинки суррогатных пар)
const cut = (text, n) => [...text].slice(0, n).join('')

// Версия мода из текста его plugin.json; не та — ''
export function versionFrom(text) {
  const version = jsonFrom(text)?.version
  return typeof version === 'string' && VERSION.test(version) ? version : ''
}

// Приметы отчёта: версия Arcade, где он открыт (surface), язык интерфейса и система — только знакомого вида
function details({ version, surface, lang, os } = {}) {
  const fields = {
    version: typeof version === 'string' && VERSION.test(version) ? version : '',
    surface: SURFACES.includes(surface) ? surface : '',
    lang: typeof lang === 'string' && LANG.test(lang) ? lang : '',
    os: SYSTEMS.includes(os) ? os : '',
  }
  return Object.fromEntries(Object.entries(fields).filter(([, v]) => v))
}

// Тело отчёта: текст без управляющих знаков и пробелов по краям и приметы. Что не знакомого вида — не прикладывается
export function reportBody(text, about) {
  return { text: cleanText(text).trim(), ...details(about) }
}

// Что не так с ответом про отчёты: общие ошибки аккаунта (trouble) и свои — 'empty' (пустой отчёт), 'long' (длиннее
// MAX_REPORT), 'often' (от тебя сегодня уже много отчётов), 'full' (у всех вместе сегодня слишком много), 'admin'
// (это только админу), 'gone' (отчёт уже закрыт). Сайт без отчётов — 'off' или 'down'
function failure(response, data) {
  const said = data?.error
  const status = response?.status
  if (status === 400) return said === 'long' ? 'long' : said === 'empty' ? 'empty' : 'down'
  if (status === 403) return said === 'admin' ? 'admin' : 'down'
  if (status === 404) return said === 'gone' ? 'gone' : 'down'
  if (status === 413) return 'long'
  if (status === 429) return 'often'
  if (status === 503 && (said === 'full' || said === 'off')) return said
  return trouble(response, data)
}

// Ответ на отправку → { id, error }: id — номер отчёта на сайте
export function parseReportSent(response) {
  const data = jsonFrom(response?.text)
  const error = failure(response, data)
  if (error) return { id: 0, error }
  return Number.isSafeInteger(data.id) && data.id > 0 ? { id: data.id, error: '' } : { id: 0, error: 'down' }
}

// Отчёт из списка: { id, at, text, version?, surface?, lang?, os?, from? } — from: { id, handle? }, кто отправил со
// входом (ника у аккаунта может не быть); не сходится — null
function reportFrom(r) {
  if (!r || typeof r !== 'object' || !Number.isSafeInteger(r.id) || r.id < 1 || !Number.isFinite(r.at)) return null
  const text = cut(cleanText(r.text), MAX_REPORT)
  if (!text.trim()) return null
  const id = typeof r.from?.id === 'string' && ACCOUNT_ID.test(r.from.id) ? r.from.id : ''
  const from = id ? { id, ...(HANDLE.test(r.from.handle ?? '') ? { handle: r.from.handle } : {}) } : null
  return { id: r.id, at: r.at, text, ...details(r), ...(from ? { from } : {}) }
}

// Ответ GET /api/me/reports → { reports, open, error }: открытые отчёты, новые сверху, и сколько открытых всего
export function parseReports(response) {
  const data = jsonFrom(response?.text)
  const error = failure(response, data)
  const none = (e) => ({ reports: [], open: 0, error: e })
  if (error) return none(error)
  if (!Array.isArray(data.reports)) return none('down')
  const reports = data.reports.slice(0, MAX_LISTED).map(reportFrom).filter(Boolean)
  return { reports, open: Math.max(count(data.open), reports.length), error: '' }
}

// Ответ POST /api/me/reports/close → { open, error }: сколько открытых осталось
export function parseClosed(response) {
  const data = jsonFrom(response?.text)
  const error = failure(response, data)
  return error ? { open: 0, error } : { open: count(data.open), error: '' }
}
