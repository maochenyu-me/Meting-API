import Providers from "../src/providers/index.js"
import examples from "../src/example.js"
import api from '../src/service/api.js'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { test, expect } from 'vitest'
import config from '../src/config.js'
import { createAuthSignature } from '../src/utils/auth.js'

const app = new Hono()
app.use('*', cors())
app.get('/api', api)
config.METING_TOKEN = 'local-test-secret-change-before-deploy-0123456789'

// test('examples match providers', () => {
//     const p = new Providers()
//     const provider_list = p.get_provider_list()
//     expect(new Set(provider_list)).toEqual(new Set(Object.keys(examples)))
// })

test('test provider support_type', () => {
    const p = new Providers()
    Object.keys(examples).map(provider_name => {
        const provider = p.get(provider_name)
        Object.keys(examples[provider_name]).map(type => {
            expect(provider.support_type).toContain(type)
        })
    })
})

const YT_API = globalThis?.Deno?.env?.get("YT_API") || globalThis?.process?.env?.YT_API
const runLiveTests = globalThis?.process?.env?.METING_LIVE_TESTS === '1'

test.skipIf(!runLiveTests)('test api', async () => {
    for (const provider_name in examples) {
        if (["ytmusic", "spotify"].includes(provider_name) && !YT_API) {
            console.log("external api not found, skipping...")
            continue
        }
        for (const type in examples[provider_name]) {

            const id = examples[provider_name][type].value
            const signature = ['url', 'pic', 'lrc'].includes(type)
                ? await createAuthSignature(provider_name, type, id)
                : ''
            const auth = signature ? `&auth=${signature}` : ''
            const url = `http://localhost:3000/api?server=${provider_name}&type=${type}&id=${id}${auth}`
            let res, count = 0
            while (count < 5) {
                res = await app.request(url)
                console.log("testing " + url)
                console.log(res.status)
                if (200 <= res.status && res.status < 400) {
                    break
                } else {
                    count++
                    console.log("retrying " + count)
                    await new Promise(resolve => setTimeout(resolve, 1000))
                }
            }

            expect(res).toBeDefined()
            expect(res.status).toBeGreaterThanOrEqual(200)
            expect(res.status).toBeLessThan(400)
        }

    }
}, 10 * 60 * 1000)
