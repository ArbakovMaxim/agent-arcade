// Статистика игр в окне браузера: сколько раз и сколько времени играли, когда последний раз, рекорд.
// Хранится в localStorage профиля браузера, который открывает Arcade, поэтому переживает закрытие окна.
;(function () {
  'use strict'

  const KEY = 'arcade:stats'

  function load() {
    try {
      const data = JSON.parse(localStorage.getItem(KEY) || '{}')
      return data && typeof data === 'object' ? data : {}
    } catch {
      return {}
    }
  }

  function entryOf(all, id) {
    const saved = all[id] && typeof all[id] === 'object' ? all[id] : {}
    return {
      plays: Number(saved.plays) || 0,
      seconds: Number(saved.seconds) || 0,
      last: Number(saved.last) || 0,
      best: Number.isFinite(saved.best) ? saved.best : null,
    }
  }

  // Меняет запись одной игры и сразу сохраняет
  function update(id, change) {
    const all = load()
    const entry = entryOf(all, id)
    change(entry)
    all[id] = entry
    try {
      localStorage.setItem(KEY, JSON.stringify(all))
    } catch {
      // Хранилище переполнено или отключено — статистика просто не сохранится
    }
    return entry
  }

  function get(id) {
    return entryOf(load(), id)
  }

  // Счёт из памяти приставки по описанию игры: сумма байтов на множители
  function readScore(spec, memory) {
    if (!spec || !Array.isArray(spec.parts)) return null
    let total = 0
    for (const [address, weight] of spec.parts) total += (memory[address] || 0) * weight
    return total
  }

  function plural(n, one, few, many) {
    const tens = n % 100
    const units = n % 10
    if (tens >= 11 && tens <= 14) return many
    if (units === 1) return one
    if (units >= 2 && units <= 4) return few
    return many
  }

  function duration(seconds) {
    const minutes = Math.floor(seconds / 60)
    if (minutes < 1) return T('меньше минуты')
    if (minutes < 60) return T(`${minutes} мин`)
    return T(`${Math.floor(minutes / 60)} ч ${String(minutes % 60).padStart(2, '0')} мин`)
  }

  function times(n) {
    return T(`${n} ${plural(n, 'раз', 'раза', 'раз')}`)
  }

  function number(n) {
    return n.toLocaleString('ru-RU')
  }

  // Одна строка о игре: «сыграно 12 мин · 4 раза · рекорд 12 300»
  function summary(id, spec) {
    const s = get(id)
    if (!s.plays) return T('ещё не играли')
    const parts = [T(`сыграно ${duration(s.seconds)}`), times(s.plays)]
    if (spec && s.best !== null && s.best > 0) parts.push(`${spec.label} ${number(s.best)}`)
    return parts.join(' · ')
  }

  function totalSeconds() {
    const all = load()
    return Object.keys(all).reduce((sum, id) => sum + entryOf(all, id).seconds, 0)
  }

  window.ArcadeStats = { load, get, update, readScore, duration, times, number, summary, totalSeconds }
})()
