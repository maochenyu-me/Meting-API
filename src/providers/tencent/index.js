import { get_playlist } from "./playlist.js";
import { get_song_url, get_song_info, get_pic } from "./song.js";
import { get_lyric } from "./lyric.js"
import config from "../../config.js"
import { handleCore } from "../core.js"
import { get_runtime } from "../../util.js"

const legacySupportType = ['url', 'pic', 'lrc', 'song', 'playlist']
const coreSupportType = [...legacySupportType, 'search', 'album', 'artist']
const useCore = get_runtime() === 'node'
const support_type = useCore ? coreSupportType : legacySupportType

const handleLegacy = async (type, id, cookie = '') => {
    let result;
    switch (type) {
        case 'lrc':
            result = await get_lyric(id, cookie)
            break
        case 'pic':
            result = await get_pic(id, cookie)
            break
        case 'url':
            result = await get_song_url(id, cookie)
            break
        case 'song':
            result = await get_song_info(id, cookie)
            break
        case 'playlist':
            result = await get_playlist(id, cookie)
            break
        default:
            return -1;
    }
    return result
}

const handle = async (type, id, cookie = '') => {
    if (!support_type.includes(type) && !(useCore && coreSupportType.includes(type))) return -1
    const preserveOverseasBehavior = config.OVERSEAS && ['url', 'song', 'playlist'].includes(type)
    if (!useCore || preserveOverseasBehavior) return handleLegacy(type, id, cookie)
    return handleCore('tencent', type, id, cookie)
}

export { handle, handleLegacy, support_type }

export default {
    register: (ctx) => {
        ctx.register('tencent', { handle, support_type })
    }
}
