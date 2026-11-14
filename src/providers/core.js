const coreModule = '@meting/core'
const methodByType = {
  search: 'search',
  song: 'song',
  album: 'album',
  artist: 'artist',
  playlist: 'playlist',
  lrc: 'lyric',
  url: 'url',
  pic: 'pic'
}
const listTypes = new Set(['search', 'song', 'album', 'artist', 'playlist'])
const methodsByServer = {
  netease: new Set(['search', 'song', 'album', 'artist', 'playlist', 'url', 'lrc', 'pic']),
  tencent: new Set(['search', 'song', 'album', 'artist', 'playlist', 'url', 'lrc', 'pic'])
}

const parallelMap = async (values, mapper, limit = 8) => {
  const result = new Array(values.length)
  let nextIndex = 0
  const workerCount = Math.min(limit, values.length)
  await Promise.all(Array.from({ length: workerCount }, async () => {
    while (nextIndex < values.length) {
      const index = nextIndex++
      result[index] = await mapper(values[index], index)
    }
  }))
  return result
}

export async function handleCore (server, type, id, cookie = '') {
  if (!methodsByServer[server]?.has(type)) return -1

  const { default: Meting } = await import(coreModule)
  const meting = new Meting(server)
  meting.format(true)
  if (cookie) meting.cookie(cookie)

  const method = methodByType[type]
  if (!method) return -1
  const options = type === 'search' ? { limit: 30 } : undefined
  const data = JSON.parse(await meting[method](id, options))

  if (listTypes.has(type)) {
    if (server === 'tencent' && type === 'playlist') {
      return parallelMap(data, async item => {
        const provider = new Meting(server)
        provider.format(true)
        provider.cookie(cookie)
        if (!item.id) return formatItem(item)
        try {
          const song = JSON.parse(await provider.song(item.id))[0]
          return formatItem({ ...item, ...song })
        } catch {
          return formatItem(item)
        }
      })
    }
    return data.map(formatItem)
  }

  if (type === 'lrc') return data
  if (type === 'pic') return data?.url || ''
  if (type === 'url') return normalizeUrl(server, data?.url || '')
  return data
}

const formatItem = item => ({
  title: item.name,
  author: Array.isArray(item.artist) ? item.artist.join(' / ') : item.artist || '',
  url: item.url_id,
  pic: item.pic_id,
  lrc: item.lyric_id
})

const normalizeUrl = (server, url) => {
  if (server === 'netease') {
    url = url
      .replace('://m7c.', '://m7.')
      .replace('://m8c.', '://m8.')
      .replace('http://', 'https://')
    if (url.includes('vuutv=')) {
      const parsed = new URL(url)
      parsed.search = ''
      url = parsed.toString()
    }
  }

  if (server === 'tencent') {
    url = url
      .replace('http://', 'https://')
      .replace('://ws.stream.qqmusic.qq.com', '://dl.stream.qqmusic.qq.com')
  }

  return url
}
