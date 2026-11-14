import config from '../config.js'

const encoder = new TextEncoder()
let cachedSecret = ''
let cachedKey

const getSecret = () => typeof config.METING_TOKEN === 'string' ? config.METING_TOKEN : ''

const getKey = async secret => {
  if (secret !== cachedSecret) {
    cachedSecret = secret
    cachedKey = undefined
  }
  if (!cachedKey) {
    const subtle = globalThis.crypto?.subtle || (await import('node:crypto')).webcrypto.subtle
    cachedKey = await subtle.importKey('raw', encoder.encode(secret), {
      name: 'HMAC',
      hash: 'SHA-1'
    }, false, ['sign', 'verify'])
  }
  return cachedKey
}

export function isAuthConfigured () {
  return encoder.encode(getSecret()).byteLength >= 32
}

export async function createAuthSignature (server, type, id) {
  const secret = getSecret()
  if (encoder.encode(secret).byteLength < 32) throw new Error('METING_TOKEN must contain at least 32 bytes')

  const subtle = globalThis.crypto?.subtle || (await import('node:crypto')).webcrypto.subtle
  const signature = await subtle.sign('HMAC', await getKey(secret), encoder.encode(`${server}${type}${id}`))
  return Array.from(new Uint8Array(signature), byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyAuthSignature (server, type, id, signature) {
  if (!isAuthConfigured() || typeof signature !== 'string' || !/^[a-f\d]{40}$/i.test(signature)) return false

  const subtle = globalThis.crypto?.subtle || (await import('node:crypto')).webcrypto.subtle
  const signatureBytes = Uint8Array.from(signature.match(/.{2}/g), byte => Number.parseInt(byte, 16))
  return subtle.verify('HMAC', await getKey(getSecret()), signatureBytes, encoder.encode(`${server}${type}${id}`))
}
