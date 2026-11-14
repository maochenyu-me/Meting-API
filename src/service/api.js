import Providers from "../providers/index.js"
import { format as lyricFormat, get_url } from "../util.js"
import { isAllowedHost, readCookieFile } from "../utils/cookie.js"
import { createAuthSignature, isAuthConfigured, verifyAuthSignature } from "../utils/auth.js"

export default async (ctx) => {

    const p = new Providers()

    const query = ctx.req.query()
    const server = query.server || 'tencent'
    const type = query.type || 'playlist'
    const id = query.id || '7326220405'

    if (!isAuthConfigured()) {
        ctx.header('Cache-Control', 'no-store')
        ctx.status(503)
        return ctx.json({ status: 503, message: 'API 未配置有效的 METING_TOKEN' })
    }

    if (!p.get_provider_list().includes(server) || !p.get(server).support_type.includes(type)) {
        ctx.status(400)
        return ctx.json({ status: 400, message: 'server 参数不合法', param: { server, type, id } })
    }

    const isSignedResource = ['lrc', 'url', 'pic'].includes(type)
    const signature = query.auth || query.token || ''
    const authenticated = signature
        ? await verifyAuthSignature(server, type, id, signature)
        : false
    if (isSignedResource && !authenticated) {
        ctx.status(401)
        return ctx.json({ status: 401, message: '鉴权失败,非法调用' })
    }

    const cookie = isSignedResource && authenticated && isAllowedHost(ctx.req.header('referer'))
        ? await readCookieFile(server)
        : ''
    let data = await p.get(server).handle(type, id, cookie)
    if (data === -1) {
        ctx.status(400)
        return ctx.json({ status: 400, message: 'type 参数不合法', param: { server, type, id } })
    }

    if (type === 'url') {
        let url = data

        if (!url) {
            ctx.status(403)
            return ctx.json({ error: 'no url' })
        }
        if (url.startsWith('@'))
            return ctx.text(url)

        return ctx.redirect(url)
    }

    if (type === 'pic') {
        return ctx.redirect(data)
    }

    if (type === 'lrc') {
        return ctx.text(lyricFormat(data.lyric, data.tlyric || ''))
    }


    // json 类型数据填充api
    const result = await Promise.all(data.map(async x => {
        for (let i of ['url', 'pic', 'lrc']) {
            const _ = String(x[i])
            // 正常对象_均为id，以下例外不用填充：1.@开头/size为0=>qq音乐jsonp 2.已存在完整链接
            if (!_.startsWith('@') && !_.startsWith('http') && _.length > 0) {
                const signature = await createAuthSignature(server, i, _)
                const baseUrl = get_url(ctx)
                const separator = baseUrl.includes('?') ? '&' : '?'
                const params = new URLSearchParams({
                    server,
                    type: i,
                    id: _,
                    auth: signature,
                })
                x[i] = `${baseUrl}${separator}${params.toString()}`
            }
        }
        return x
    }))
    return ctx.json(result)
}
