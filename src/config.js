import { get_runtime } from "./util.js"

const getEnv = (key) => globalThis?.Deno?.env?.get(key) || globalThis?.process?.env?.[key]

let OVERSEAS = getEnv("OVERSEAS")
const runtime = get_runtime()

if (['cloudflare', 'vercel'].includes(runtime)) OVERSEAS = true

const PORT = getEnv("PORT") || 3000
const COOKIE_ALLOW_HOSTS = (getEnv("METING_COOKIE_ALLOW_HOSTS") || '')
    .split(',')
    .map(host => host.trim().toLowerCase())
    .filter(Boolean)
const METING_TOKEN = getEnv("METING_TOKEN") || ''

OVERSEAS = Boolean(OVERSEAS)

export default {
    OVERSEAS,
    PORT,
    COOKIE_ALLOW_HOSTS,
    METING_TOKEN,
}
