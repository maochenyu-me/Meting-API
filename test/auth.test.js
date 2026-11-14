import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { Hono } from 'hono'
import config from '../src/config.js'

const token = '0123456789abcdef0123456789abcdef'
const calls = []

vi.mock('../src/providers/index.js', () => ({
  default: class {
    get_provider_list () {
      return ['netease']
    }

    get () {
      return {
        support_type: ['search', 'song', 'url', 'pic', 'lrc'],
        handle: async (type, id, cookie) => {
          calls.push({ type, id, cookie })
          if (type === 'url' || type === 'pic') return `https://media.example/${id}`
          if (type === 'lrc') return { lyric: '[00:00.000]line', tlyric: '' }
          return [{ title: 'Song', author: 'Artist', url: 'song-url-id', pic: 'pic-id', lrc: 'lyric-id' }]
        }
      }
    }
  }
}))

const { default: api } = await import('../src/service/api.js')
const app = new Hono()
app.get('/api', api)

const sign = (server, type, id) => createHmac('sha1', token)
  .update(`${server}${type}${id}`)
  .digest('hex')

beforeEach(() => {
  calls.length = 0
  config.METING_TOKEN = token
})

afterEach(() => {
  config.METING_TOKEN = ''
  vi.unstubAllEnvs()
})

describe('API signature authentication', () => {
  it('fails closed when the signing secret is missing or too short', async () => {
    config.METING_TOKEN = ''
    const missing = await app.request('/api?server=netease&type=search&id=test')
    config.METING_TOKEN = 'short-secret'
    const short = await app.request('/api?server=netease&type=search&id=test')

    expect(missing.status).toBe(503)
    expect(missing.headers.get('cache-control')).toBe('no-store')
    expect(short.status).toBe(503)
    expect(calls).toEqual([])
  })

  it.each(['url', 'pic', 'lrc'])('rejects unsigned %s resource requests', async type => {
    const response = await app.request(`/api?server=netease&type=${type}&id=resource-id`)

    expect(response.status).toBe(401)
    expect(calls).toEqual([])
  })

  it('ignores signature parameters on public metadata requests', async () => {
    const response = await app.request('/api?server=netease&type=song&id=song-id&auth=invalid')

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(1)
  })

  it('keeps metadata requests public when no signature is supplied', async () => {
    const response = await app.request('/api?server=netease&type=song&id=song-id')

    expect(response.status).toBe(200)
    expect(calls).toHaveLength(1)
  })

  it('accepts a valid HMAC signature on a resource request', async () => {
    const auth = sign('netease', 'url', 'resource-id')
    const response = await app.request(`/api?server=netease&type=url&id=resource-id&auth=${auth}`)

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://media.example/resource-id')
    expect(calls).toEqual([{ type: 'url', id: 'resource-id', cookie: '' }])
  })

  it('accepts the token alias used by upstream clients', async () => {
    const tokenSignature = sign('netease', 'lrc', 'lyric-id')
    const response = await app.request(`/api?server=netease&type=lrc&id=lyric-id&token=${tokenSignature}`)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('[00:00.000]line')
  })

  it.each([
    ['changed id', 'url', 'other-id', sign('netease', 'url', 'resource-id')],
    ['changed type', 'pic', 'resource-id', sign('netease', 'url', 'resource-id')],
    ['invalid signature', 'url', 'resource-id', '0'.repeat(40)]
  ])('rejects a %s', async (_label, type, id, auth) => {
    const response = await app.request(`/api?server=netease&type=${type}&id=${id}&auth=${auth}`)

    expect(response.status).toBe(401)
    expect(calls).toEqual([])
  })

  it('keeps metadata requests public and signs generated resource URLs', async () => {
    const response = await app.request('/api?server=netease&type=song&id=song-id')
    const [song] = await response.json()

    expect(response.status).toBe(200)
    for (const [field, type, id] of [
      ['url', 'url', 'song-url-id'],
      ['pic', 'pic', 'pic-id'],
      ['lrc', 'lrc', 'lyric-id']
    ]) {
      const resource = new URL(song[field])
      expect(resource.searchParams.get('auth')).toBe(sign('netease', type, id))
      expect(resource.searchParams.get('server')).toBe('netease')
      expect(resource.searchParams.get('type')).toBe(type)
      expect(resource.searchParams.get('id')).toBe(id)
    }
  })
})
