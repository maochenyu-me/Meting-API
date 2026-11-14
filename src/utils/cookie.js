import config from '../config.js'

const cookieCache = new Map()
const cookieTtl = 5 * 60 * 1000

const getEnv = (key) => globalThis?.Deno?.env?.get(key) || globalThis?.process?.env?.[key]
const getCookieDirectory = () => globalThis?.Deno?.cwd?.() || globalThis?.process?.cwd?.() || '.'

export async function readCookieFile (server, cookieDirectory = getCookieDirectory()) {
  if (!/^[a-z0-9_-]+$/i.test(server)) return ''

  const now = Date.now()
  const cached = cookieCache.get(server)
  if (cached && now - cached.timestamp < cookieTtl) return cached.value

  const envCookie = getEnv(`METING_COOKIE_${server.toUpperCase()}`)
  if (envCookie) {
    const value = envCookie.trim()
    cookieCache.set(server, { value, timestamp: now })
    return value
  }

  const filePath = `${cookieDirectory.replace(/[\\/]$/, '')}/cookie/${server}`
  const cookieDirectoryPath = `${cookieDirectory.replace(/[\\/]$/, '')}/cookie`
  try {
    if (globalThis?.process?.versions?.node) {
      const { relative, sep, isAbsolute } = await import('node:path')
      const fs = await import('node:fs/promises')
      const [resolvedPath, resolvedDirectory] = await Promise.all([
        fs.realpath(filePath),
        fs.realpath(cookieDirectoryPath)
      ])
      const relativePath = relative(resolvedDirectory, resolvedPath)
      if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return ''
      const value = (await fs.readFile(resolvedPath, 'utf8')).trim()
      cookieCache.set(server, { value, timestamp: now })
      return value
    }
    const value = globalThis?.Deno?.readTextFile
      ? (await globalThis.Deno.readTextFile(filePath)).trim()
      : (await (await import('node:fs/promises')).readFile(filePath, 'utf8')).trim()
    cookieCache.set(server, { value, timestamp: now })
    return value
  } catch {
    cookieCache.set(server, { value: '', timestamp: now })
    return ''
  }
}

export function isAllowedHost (referrer) {
  const allowedHosts = (getEnv('METING_COOKIE_ALLOW_HOSTS') || config.COOKIE_ALLOW_HOSTS || [])
  const hosts = Array.isArray(allowedHosts)
    ? allowedHosts
    : allowedHosts.split(',').map(host => host.trim().toLowerCase()).filter(Boolean)
  if (!referrer || hosts.length === 0) return false

  try {
    return hosts.includes(new URL(referrer).hostname.toLowerCase())
  } catch {
    return false
  }
}

export function clearCookieCache (server) {
  if (server) cookieCache.delete(server)
  else cookieCache.clear()
}
