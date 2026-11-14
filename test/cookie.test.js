import { afterEach, describe, expect, it, vi } from 'vitest'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { Hono } from 'hono'
import config from '../src/config.js'
import { createAuthSignature } from '../src/utils/auth.js'
import { clearCookieCache, isAllowedHost, readCookieFile } from '../src/utils/cookie.js'

vi.mock('../src/providers/index.js', () => ({
  default: class {
    get_provider_list () {
      return ['netease']
    }

    get () {
      return {
        support_type: ['search', 'url'],
        handle: (...args) => globalThis.__cookieTestHandle(...args)
      }
    }
  }
}))

const { default: api } = await import('../src/service/api.js')

afterEach(() => {
  clearCookieCache()
  delete globalThis.__cookieTestHandle
  vi.unstubAllEnvs()
  config.COOKIE_ALLOW_HOSTS = []
})

describe('cookie configuration', () => {
  it('reads a cookie from the provider environment variable', async () => {
    vi.stubEnv('METING_COOKIE_NETEASE', '  MUSIC_U=env-value  ')

    await expect(readCookieFile('netease')).resolves.toBe('MUSIC_U=env-value')
  })

  it('falls back to a provider cookie file', async () => {
    const cookieDirectory = join(process.cwd(), 'cookie')
    const cookiePath = join(cookieDirectory, `vitest-${process.pid}`)

    try {
      await mkdir(cookieDirectory, { recursive: true })
      await writeFile(cookiePath, '  qqmusic_key=file-value  ')

      await expect(readCookieFile(`vitest-${process.pid}`)).resolves.toBe('qqmusic_key=file-value')
    } finally {
      await rm(cookiePath, { force: true })
      await rm(cookieDirectory, { recursive: false }).catch(() => {})
    }
  })

  it('only allows configured referrer hosts and rejects malformed referrers', () => {
    config.COOKIE_ALLOW_HOSTS = ['music.example.com']

    expect(isAllowedHost('https://music.example.com/player')).toBe(true)
    expect(isAllowedHost('https://evil.example.com/player')).toBe(false)
    expect(isAllowedHost('not a url')).toBe(false)
    expect(isAllowedHost(undefined)).toBe(false)
  })

  it('does not read files outside the cookie directory', async () => {
    await expect(readCookieFile('../package')).resolves.toBe('')
  })

  it('passes cookies only for explicitly allowed referrer hosts', async () => {
    const app = new Hono()
    app.get('/api', api)
    const receivedCookies = []
    globalThis.__cookieTestHandle = async (...args) => {
      receivedCookies.push(args[2])
      return args[0] === 'url' ? 'https://media.example/song' : []
    }
    config.COOKIE_ALLOW_HOSTS = ['music.example.com']
    config.METING_TOKEN = '0123456789abcdef0123456789abcdef'
    vi.stubEnv('METING_COOKIE_NETEASE', 'MUSIC_U=secret')
    const auth = await createAuthSignature('netease', 'url', 'test')

    const allowed = await app.request(`/api?server=netease&type=url&id=test&auth=${auth}`, {
      headers: { referer: 'https://music.example.com/player' }
    })
    const denied = await app.request(`/api?server=netease&type=url&id=test&auth=${auth}`, {
      headers: { referer: 'https://evil.example.com/player' }
    })

    expect(allowed.status).toBe(302)
    expect(denied.status).toBe(302)
    expect(receivedCookies).toEqual(['MUSIC_U=secret', ''])
  })
})
