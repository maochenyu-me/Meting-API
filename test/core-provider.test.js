import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import config from '../src/config.js'
import { clearCookieCache } from '../src/utils/cookie.js'
import Providers from '../src/providers/index.js'
import { handleCore } from '../src/providers/core.js'

const calls = []

vi.mock('@meting/core', () => ({
  default: class {
    constructor (server) {
      this.server = server
    }

    format (enabled) {
      calls.push(['format', this.server, enabled])
    }

    cookie (value) {
      calls.push(['cookie', this.server, value])
    }

    async search (id) {
      calls.push(['search', this.server, id])
      return JSON.stringify([{ name: 'Song', artist: ['Artist'], url_id: 'u1', pic_id: 'p1', lyric_id: 'l1' }])
    }

    async song (id) {
      calls.push(['song', this.server, id])
      return JSON.stringify([{ name: id === 'song-id' ? 'Fetched Track' : 'Song', artist: ['Artist'], url_id: id === 'song-id' ? 'full-url-id' : 'u1', pic_id: 'p1', lyric_id: 'l1' }])
    }

    async album (id) {
      calls.push(['album', this.server, id])
      return JSON.stringify([])
    }

    async artist (id) {
      calls.push(['artist', this.server, id])
      return JSON.stringify([])
    }

    async playlist (id) {
      calls.push(['playlist', this.server, id])
      return JSON.stringify(this.server === 'tencent' ? [{ id: 'song-id', name: 'Track', artist: [], url_id: 'song-id', pic_id: 'song-id', lyric_id: 'song-id' }] : [])
    }

    async url (id) {
      calls.push(['url', this.server, id])
      return JSON.stringify({ url: `https://media.example/${this.server}/${id}` })
    }

    async lyric (id) {
      calls.push(['lyric', this.server, id])
      return JSON.stringify({ lyric: '[00:00.000]line', tlyric: '' })
    }

    async pic (id) {
      calls.push(['pic', this.server, id])
      return JSON.stringify({ url: `https://image.example/${this.server}/${id}` })
    }
  }
}))

beforeEach(() => {
  calls.length = 0
})

afterEach(() => {
  clearCookieCache()
  config.OVERSEAS = false
  vi.unstubAllEnvs()
})

describe('core-backed platform providers', () => {
  it('refuses unsupported core platform/type pairs instead of silently defaulting', async () => {
    expect(await handleCore('spotify', 'song', 'id')).toBe(-1)
    expect(await handleCore('tencent', 'unknown', 'query')).toBe(-1)
    expect(new Providers().get('tencent').support_type).toEqual(['url', 'pic', 'lrc', 'song', 'playlist', 'search', 'album', 'artist'])
    await expect(new Providers().get('tencent').handle('unknown', 'keyword')).resolves.toBe(-1)
  })

  it.each(['netease', 'tencent'])('%s routes standard provider operations through @meting/core', async (server) => {
    const handle = new Providers().get(server).handle
    expect(await handle('search', 'keyword', 'MUSIC_U=secret')).toEqual([
      { title: 'Song', author: 'Artist', url: 'u1', pic: 'p1', lrc: 'l1' }
    ])
    expect(await handle('song', 'song-id')).toEqual([
      { title: 'Fetched Track', author: 'Artist', url: 'full-url-id', pic: 'p1', lrc: 'l1' }
    ])
    expect(await handle('playlist', 'playlist-id')).toEqual(server === 'tencent'
      ? [{ title: 'Fetched Track', author: 'Artist', url: 'full-url-id', pic: 'p1', lrc: 'l1' }]
      : [])
    expect(await handle('lrc', 'lyric-id')).toEqual({ lyric: '[00:00.000]line', tlyric: '' })
    expect(await handle('url', 'url-id')).toBe(`https://media.example/${server}/url-id`)
    expect(await handle('pic', 'pic-id')).toBe(`https://image.example/${server}/pic-id`)
    expect(calls).toContainEqual(['format', server, true])
    expect(calls).toContainEqual(['cookie', server, 'MUSIC_U=secret'])
  })

  it('preserves the legacy QQ JSONP playback response for overseas deployments', async () => {
  config.OVERSEAS = true
  const result = await new Providers().get('tencent').handle('url', 'song-mid')

  expect(result).toMatch(/^@qq_get_url_from_json@callback@callback@https:/)
    expect(calls).toEqual([])
  })

  it('keeps Spotify and YouTube Music providers independent of @meting/core', async () => {
  config.OVERSEAS = false
  vi.stubEnv('YT_API', 'https://custom-music-api.example')
  const originalFetch = globalThis.fetch
    globalThis.fetch = vi.fn(async url => ({ json: async () => ({ url }) }))
    vi.resetModules()
    const { default: Providers } = await import('../src/providers/index.js')
    const providers = new Providers()

    try {
      expect(providers.get_provider_list()).toEqual(['tencent', 'netease', 'ytmusic', 'spotify'])
      expect(await providers.get('ytmusic').handle('song', 'yt-id')).toEqual({
        url: 'https://custom-music-api.example?server=ytmusic&type=song&id=yt-id'
      })
      expect(await providers.get('spotify').handle('playlist', 'sp-id')).toEqual({
        url: 'https://custom-music-api.example?server=spotify&type=playlist&id=sp-id'
      })
      expect(calls).toEqual([])
    } finally {
      globalThis.fetch = originalFetch
    }
  })
})
