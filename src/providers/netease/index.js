import { get_playlist } from "./playlist.js"
import { get_song_url, get_song_info } from "./song.js"
import { get_lyric } from "./lyric.js"
import { get_artist_songs } from "./artist_songs.js"
import { get_search_songs } from "./search.js"
import { handleCore } from "../core.js"
import config from "../../config.js"
import { get_runtime } from "../../util.js"

const legacySupportType = ['url', 'lrc', 'song', 'playlist', 'artist', 'search', 'pic']
const useCore = get_runtime() === 'node' && !config.OVERSEAS
const support_type = useCore ? [...legacySupportType, 'album'] : legacySupportType

const handleLegacy = async (type, id, cookie = '') => {
    let result;
    switch (type) {
        case 'lrc':
            result = await get_lyric(id, cookie)
            break
        case 'url':
            result = await get_song_url(id, cookie)
            break
        case 'pic':
            result = (await get_song_info(id, cookie))[0].pic
            break
        case 'song':
            result = await get_song_info(id, cookie)
            break
        case 'playlist':
            result = await get_playlist(id, cookie)
            break
        case 'artist':
            result = await get_artist_songs(id, cookie)
            break
        case 'search':
            result = await get_search_songs(id, cookie)
            break
        default:
            return -1;
    }
    return result
}

const handle = async (type, id, cookie = '') => {
    if (!support_type.includes(type)) return -1
    if (!useCore) return handleLegacy(type, id, cookie)
    return handleCore('netease', type, id, cookie)
}

export { handle, handleLegacy, support_type }

export default {
    register: (ctx) => {
        ctx.register('netease', { handle, support_type })
    }
}
