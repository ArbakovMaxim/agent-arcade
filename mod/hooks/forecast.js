// Arcade: прогноз лимита Claude — когда в нынешнем темпе кончится окно 5 часов или недели. Чистые функции, без $:
// замеры (проценты самого Claude Code) складывает app/usage. Arcade токены не считает: темп — только по тому, как росли
// проценты окна за последний час. Это оценка, на экране она так и подписана — «примерно»

export const FC_KINDS = ['five_hour', 'seven_day'] // окна, для которых есть прогноз
export const FC_SPAN = 60 * 60_000 // темп — по замерам за последний час
export const FC_MIN = 10 * 60_000 // замеры охватывают меньше — прогноза нет
export const FC_LOW = 2 // рост меньше стольких процентов…
export const FC_LOW_SPAN = 30 * 60_000 // …за меньшее время — тоже нет: не отличить от случайности
export const FC_ASK = 30 * 60_000 // кончится раньше — спросить перед запуском очереди
export const FC_SOON = 20 * 60_000 // кончится раньше — одна всплывашка на окно
const POINTS = 240 // замеров на окно, не больше (раз в полминуты — два часа)
const JUMP = 5 * 60_000 // время сброса сдвинулось больше — окно новое
const DROP = 1 // проценты упали больше — окно новое (сбросилось)

// Окна сейчас из нескольких замеров (своего и других сессий: окна общие на учётную запись, а замер сессии, что давно
// не говорила с Claude, отстаёт): по каждому окну — самое новое (сброс позже), в нём — больше процентов. Окна, чей
// сброс прошёл, — прочь
export function mergeLimits(lists, now) {
  const by = {}
  for (const list of Array.isArray(lists) ? lists : []) {
    for (const w of Array.isArray(list) ? list : []) {
      if (!w || !FC_KINDS.includes(w.kind) || !Number.isFinite(w.pct)) continue
      const reset = Number.isFinite(w.reset) ? w.reset : 0
      if (reset && reset <= now) continue
      const b = by[w.kind]
      const same = b && Math.abs(reset - b.reset) <= JUMP
      if (!b || (!same && reset > b.reset) || (same && w.pct > b.pct)) by[w.kind] = { kind: w.kind, pct: w.pct, reset }
    }
  }
  return FC_KINDS.map((k) => by[k]).filter(Boolean)
}

// hist — { [вид окна]: { reset, pts: [[когда, проценты], …] } }. Добавить замер: окна limits ({ kind, pct, reset }) в
// момент at. Замер не новее последнего (отметка другой сессии постарше) — пропустить; окно сбросилось — начать заново;
// старше часа — прочь
export function addReading(hist, limits, at) {
  const out = { ...(hist ?? {}) }
  if (!Number.isFinite(at)) return out
  for (const w of Array.isArray(limits) ? limits : []) {
    if (!w || !FC_KINDS.includes(w.kind) || !Number.isFinite(w.pct)) continue
    const reset = Number.isFinite(w.reset) ? w.reset : 0
    const h = out[w.kind]
    const last = h?.pts?.at(-1)
    if (last && at <= last[0]) continue
    const fresh = !last || Math.abs(reset - h.reset) > JUMP || w.pct < last[1] - DROP
    if (!fresh && w.pct < last[1]) continue
    const pts = fresh ? [] : h.pts.filter((p) => p[0] >= at - FC_SPAN)
    out[w.kind] = { reset, pts: [...pts, [at, w.pct]].slice(-POINTS) }
  }
  return out
}

// Прогноз окна по замерам h на момент now; reset — когда окно сбросится (0 — неизвестно). { end } — кончится около
// end; { enough: true } — до сброса хватит; null — замеров мало, окно уже кончилось или сброс прошёл
export function forecast(h, now, reset = 0) {
  const pts = (h?.pts ?? []).filter((p) => p[0] >= now - FC_SPAN && p[0] <= now)
  if (pts.length < 2) return null
  const [a, b] = [pts[0], pts.at(-1)]
  const span = b[0] - a[0]
  const grow = b[1] - a[1]
  const r = reset || h.reset || 0
  if (span < FC_MIN || b[1] >= 100 || (r && r <= now)) return null
  if (grow < FC_LOW && span < FC_LOW_SPAN) return null
  if (grow <= 0) return r ? { enough: true } : null
  const end = b[0] + ((100 - b[1]) * span) / grow
  if (r && end >= r) return { enough: true }
  return { end: Math.max(end, now) }
}

// Окно, которое по прогнозу кончится раньше всех и раньше чем через within: { kind, end } или null
export function soonest(hist, limits, now, within) {
  let best = null
  for (const w of Array.isArray(limits) ? limits : []) {
    const fc = forecast(hist?.[w.kind], now, w.reset)
    if (fc?.end && fc.end - now < within && (!best || fc.end < best.end)) best = { kind: w.kind, end: fc.end }
  }
  return best
}
