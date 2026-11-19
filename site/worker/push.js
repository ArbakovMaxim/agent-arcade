// Уведомления на телефон — Web Push без библиотек, на WebCrypto. Сообщение шифруется для браузера телефона (aes128gcm,
// RFC 8291): служба доставки — Google, Apple, Mozilla или Microsoft — видит только шифр. Сайт подписывает просьбу
// доставить своим ключом VAPID (RFC 8292): служба принимает сообщения для подписки только от того ключа, с которым
// её сделали. В подписи — адрес сайта; почты в ней нет

const encoder = new TextEncoder()
const FETCH_MS = 8000

export const RECORD = 4096 // размер записи aes128gcm: сообщение — одна запись
export const PUSH_TTL = 30 * 60 // секунд: не доставили за полчаса — уже неважно
export const VAPID_TTL = 12 * 3600 // секунд живёт подпись VAPID; службы принимают не больше суток
export const MAX_ENDPOINT = 1024
export const MAX_PUSH_TEXT = 140

// Куда сайт шлёт сообщения: только службы доставки браузеров — чужой адрес в подписке не сделает из сайта рассылку
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/, // Chrome, Android, Opera, Samsung
  /^(?:[a-z0-9-]+\.)*push\.apple\.com$/, // Safari, iPhone и iPad
  /^updates\.push\.services\.mozilla\.com$/, // Firefox
  /^(?:[a-z0-9-]+\.)*notify\.windows\.com$/, // Edge
]

export function b64u(bytes) {
  let raw = ''
  for (const b of new Uint8Array(bytes)) raw += String.fromCharCode(b)
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

// base64url → байты; не того вида — null
export function unb64u(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9_-]*$/.test(text) || text.length % 4 === 1) return null
  const raw = atob(text.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (text.length % 4)) % 4))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

function concat(...parts) {
  const out = new Uint8Array(parts.reduce((sum, p) => sum + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

async function hmac(key, data) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data))
}

// Подписка браузера телефона ({ endpoint, keys: { p256dh, auth } }, как её отдаёт PushSubscription.toJSON()) →
// { endpoint, p256dh, auth }: адрес — https у известной службы доставки, ключ — точка кривой P-256 (65 байт), секрет —
// 16 байт. Не того вида — null
export async function cleanSubscription(sub) {
  if (!sub || typeof sub !== 'object' || typeof sub.endpoint !== 'string' || sub.endpoint.length > MAX_ENDPOINT) return null
  let url
  try {
    url = new URL(sub.endpoint)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash || !PUSH_HOSTS.some((host) => host.test(url.hostname))) return null
  const p256dh = unb64u(sub.keys?.p256dh)
  const auth = unb64u(sub.keys?.auth)
  if (p256dh?.length !== 65 || p256dh[0] !== 4 || auth?.length !== 16) return null
  try {
    await crypto.subtle.importKey('raw', p256dh, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  } catch {
    return null
  }
  return { endpoint: url.href, p256dh: b64u(p256dh), auth: b64u(auth) }
}

// Текст уведомления: строка до MAX_PUSH_TEXT знаков без переводов строк, управляющих и меняющих направление знаков;
// иначе null
export function pushText(text) {
  if (typeof text !== 'string') return null
  const clean = text.trim()
  if (!clean || [...clean].length > MAX_PUSH_TEXT || /[\u0000-\u001f\u007f-\u009f\u2028\u2029\u202a-\u202e\u2066-\u2069]/.test(clean)) return null
  return clean
}

// Шифр для браузера телефона: aes128gcm одной записью (RFC 8291). salt и local (пара ключей ECDH сайта) — только для
// проверки на примере из RFC; в жизни они новые на каждое сообщение
export async function encrypt(payload, p256dh, auth, { salt = crypto.getRandomValues(new Uint8Array(16)), local } = {}) {
  const ua = unb64u(p256dh)
  const pair = local ?? (await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']))
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey))
  const uaKey = await crypto.subtle.importKey('raw', ua, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, pair.privateKey, 256))
  const prkKey = await hmac(unb64u(auth), shared)
  const ikm = await hmac(prkKey, concat(encoder.encode('WebPush: info\0'), ua, asPublic, [1]))
  const prk = await hmac(salt, ikm)
  const cek = (await hmac(prk, encoder.encode('Content-Encoding: aes128gcm\0\x01'))).slice(0, 16)
  const nonce = (await hmac(prk, encoder.encode('Content-Encoding: nonce\0\x01'))).slice(0, 12)
  const key = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const sealed = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, concat(payload, [2])))
  const header = new Uint8Array(21)
  header.set(salt)
  new DataView(header.buffer).setUint32(16, RECORD)
  header[20] = asPublic.length
  return concat(header, asPublic, sealed)
}

// Ключ VAPID сайта: закрытый — JWK, открытый — base64url (его страница телефона отдаёт браузеру при подписке)
export async function makeVapid() {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify'])
  return { jwk: await crypto.subtle.exportKey('jwk', pair.privateKey), key: b64u(await crypto.subtle.exportKey('raw', pair.publicKey)) }
}

// Заголовок Authorization для службы доставки: JWT ES256 { aud — служба, exp, sub — адрес сайта } и открытый ключ
export async function vapidAuth(endpoint, vapid, subject, now) {
  const part = (value) => b64u(encoder.encode(JSON.stringify(value)))
  const unsigned = `${part({ typ: 'JWT', alg: 'ES256' })}.${part({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + VAPID_TTL, sub: subject })}`
  const key = await crypto.subtle.importKey('jwk', vapid.jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned))
  return `vapid t=${unsigned}.${b64u(signature)}, k=${vapid.key}`
}

// Отправить текст на телефон → код ответа службы (201 — принято; 404 и 410 — подписки больше нет)
export async function sendPush(phone, text, vapid, subject, now) {
  const body = await encrypt(encoder.encode(JSON.stringify({ text })), phone.p256dh, phone.auth)
  const response = await fetch(phone.endpoint, {
    method: 'POST',
    headers: {
      Authorization: await vapidAuth(phone.endpoint, vapid, subject, now),
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(PUSH_TTL),
      Urgency: 'high',
      // Новое сообщение заменяет недоставленное старое: телефон, вышедший в сеть, покажет одно
      Topic: 'arcade-waiting',
    },
    body,
    signal: AbortSignal.timeout(FETCH_MS),
  })
  return response.status
}
