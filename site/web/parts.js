// Склейка больших файлов чужой сборки (Warzone 2100): Cloudflare отдаёт файл не больше 25 МиБ, поэтому сборка
// режет такие файлы на куски (build.mjs, prepare). Игра просит целый файл через fetch — отдаём ей поток из кусков
// подряд, распакованный из gzip, если куски сжаты. Content-Length — размер целого файла: по нему игра рисует загрузку.
// Сборка кладёт этот код в arcade-parts.js игры после window.ARCADE_PARTS = { имя: { size, gzip, parts } }
;(function () {
  'use strict'
  const parts = window.ARCADE_PARTS || {}
  const original = window.fetch.bind(window)
  const wanted = new Map(Object.entries(parts).map(([name, spec]) => [new URL(name, document.baseURI).href, spec]))
  const address = (input) => {
    try {
      const url = new URL(typeof input === 'string' || input instanceof URL ? input : input.url, document.baseURI)
      url.search = ''
      url.hash = ''
      return url.href
    } catch {
      return ''
    }
  }

  async function joined(href, spec) {
    // Все куски запрашиваем сразу, читаем по порядку
    const responses = await Promise.all(spec.parts.map((part) => original(new URL(part, href).href)))
    const bad = responses.find((r) => !r.ok)
    if (bad) return new Response(null, { status: bad.status, statusText: bad.statusText })
    let next = 0
    let reader = null
    let body = new ReadableStream({
      async pull(controller) {
        for (;;) {
          if (!reader) {
            if (next >= responses.length) return controller.close()
            reader = responses[next++].body.getReader()
          }
          const { done, value } = await reader.read()
          if (!done) return controller.enqueue(value)
          reader = null
        }
      },
      cancel(reason) {
        for (const r of responses.slice(next)) r.body.cancel(reason).catch(() => {})
        if (reader) reader.cancel(reason).catch(() => {})
      },
    })
    if (spec.gzip) body = body.pipeThrough(new DecompressionStream('gzip'))
    return new Response(body, { status: 200, headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': String(spec.size) } })
  }

  window.fetch = function (input, init) {
    const href = address(input)
    const spec = wanted.get(href)
    return spec ? joined(href, spec) : original(input, init)
  }
})()
