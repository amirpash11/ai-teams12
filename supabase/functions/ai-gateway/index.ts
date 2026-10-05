import { createSupabaseContext } from 'npm:@supabase/server@1'

const APP_ORIGIN = (Deno.env.get('AI_TEAMS_APP_ORIGIN') || 'https://amirpash11.github.io').replace(/\/$/, '')
const RATE_LIMIT = 30
const RATE_WINDOW_SECONDS = 60

const corsHeaders = {
  'Access-Control-Allow-Origin': APP_ORIGIN,
  'Vary': 'Origin',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extraHeaders }
  })

type Provider = 'openai' | 'openrouter' | 'claude' | 'gemini' | 'horde' | 'custom'

function keyMap() {
  const raw = Deno.env.get('AI_TEAMS_PROVIDER_KEYS') || '{}'
  try { return JSON.parse(raw) as Record<string, string> } catch { return {} }
}

function getSecretKey(provider: string) {
  const keys = keyMap()
  return keys[provider] || Deno.env.get('AI_TEAMS_' + provider.toUpperCase() + '_API_KEY') || ''
}

function customEndpointMap() {
  const raw = Deno.env.get('AI_TEAMS_CUSTOM_ENDPOINTS') || '{}'
  try { return JSON.parse(raw) as Record<string, string> } catch { return {} }
}

function compactText(value: unknown, max: number) {
  const s = String(value ?? '')
  if (s.length <= max) return s
  const head = Math.max(1000, Math.floor(max * 0.35))
  const tail = Math.max(1000, max - head)
  return s.slice(0, head) + '\n\n… بخش میانی برای کنترل حجم Context کوتاه شد …\n\n' + s.slice(-tail)
}

function endpointFor(provider: Provider, model: string) {
  if (provider === 'openai') return 'https://api.openai.com/v1/chat/completions'
  if (provider === 'openrouter') return 'https://openrouter.ai/api/v1/chat/completions'
  if (provider === 'claude') return 'https://api.anthropic.com/v1/messages'
  if (provider === 'gemini') return 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent'
  if (provider === 'horde') return 'https://oai.stablehorde.net/v1/chat/completions'
  return customEndpointMap()[provider] || ''
}

function extract(data: any, provider: Provider) {
  if (provider === 'claude') return (data?.content || []).map((x: any) => x?.text || '').join('\n')
  if (provider === 'gemini') return (data?.candidates?.[0]?.content?.parts || []).map((x: any) => x?.text || '').join('\n')
  return data?.choices?.[0]?.message?.content || data?.choices?.[0]?.text || ''
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'فقط POST مجاز است.' }, 405, { Allow: 'POST, OPTIONS' })

  const origin = req.headers.get('origin')
  if (origin && origin !== APP_ORIGIN) return json({ error: 'Origin مجاز نیست.' }, 403)
  const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: 'user' })
  if (authError || !ctx?.userClaims?.id) return json({ error: 'احراز هویت لازم است.', code: authError?.code || 'AUTH_REQUIRED' }, authError?.status || 401)
  const userId = ctx.userClaims.id

  try {
    const contentLength = Number(req.headers.get('content-length') || 0)
    if (Number.isFinite(contentLength) && contentLength > 1200000) return json({ error: 'درخواست بیش از حد بزرگ است.' }, 413)
    const input = await req.json()
    const rate = await ctx.supabaseAdmin.rpc('consume_ai_gateway_rate_limit', { p_user_id: userId, p_limit: RATE_LIMIT, p_window_seconds: RATE_WINDOW_SECONDS })
    if (rate.error) return json({ error: 'کنترل مصرف Gateway در دسترس نیست.' }, 503)
    const row = Array.isArray(rate.data) ? rate.data[0] : rate.data
    if (!row?.allowed) return json({ error: 'تعداد درخواست‌ها در دقیقه بیش از حد مجاز است.' }, 429, { 'Retry-After': String(RATE_WINDOW_SECONDS), 'X-RateLimit-Limit': String(RATE_LIMIT), 'X-RateLimit-Remaining': '0' })
    const provider = String(input?.provider || '').trim() as Provider
    const model = String(input?.model || '').trim()
    const messages = Array.isArray(input?.messages) ? input.messages : []
    const system = String(input?.system || '')

    if (!provider || !model || !messages.length) return json({ error: 'provider، model و messages الزامی هستند.' }, 400)
    if (provider.length > 64 || model.length > 200 || system.length > 20000) return json({ error: 'اندازه ورودی بیش از حد مجاز است.' }, 413)
    if (messages.length > 50) return json({ error: 'تعداد پیام‌ها بیش از حد مجاز است.' }, 413)
    const normalizedMessages = messages.map((m: any) => ({
      role: ['system','user','assistant'].includes(String(m?.role || 'user')) ? String(m?.role || 'user') : 'user',
      content: compactText(m?.content || '', 20000)
    }))
    if (normalizedMessages.some((m: any) => !m.content.trim())) return json({ error: 'هر پیام باید متن داشته باشد.' }, 400)
    const fixedProviders = ['openai','openrouter','claude','gemini','horde']
    const customEndpoints = customEndpointMap()
    const isConfiguredCustom = !fixedProviders.includes(provider) && provider !== 'custom' && !!customEndpoints[provider]
    if (!fixedProviders.includes(provider) && provider !== 'custom' && !isConfiguredCustom) return json({ error: 'Provider مجاز یا در Gateway تنظیم نشده است.' }, 400)
    const endpoint = endpointFor(provider, model)
    if (!endpoint) return json({ error: 'Endpoint سرویس مشخص نشده است.' }, 400)
    try {
      const endpointUrl = new URL(endpoint)
      if (endpointUrl.protocol !== 'https:') return json({ error: 'Endpoint باید HTTPS باشد.' }, 400)
    } catch { return json({ error: 'Endpoint نامعتبر است.' }, 400) }

    const key = provider === 'horde' ? '' : getSecretKey(provider)
    if (provider !== 'horde' && !key) {
      return json({ error: 'کلید این Provider در Supabase تنظیم نشده است: ' + provider }, 503)
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let body: any

    if (provider === 'claude') {
      headers['x-api-key'] = key
      headers['anthropic-version'] = '2023-06-01'
      const requestedMaxTokens = Number(input?.max_tokens || 1200)
      const maxTokens = Number.isFinite(requestedMaxTokens) ? Math.min(4096, Math.max(256, Math.floor(requestedMaxTokens))) : 1200
      body = { model, max_tokens: maxTokens, system: compactText(system,20000), messages: normalizedMessages.filter((m: any) => m.role !== 'system') }
    } else if (provider === 'gemini') {
      headers['x-goog-api-key'] = key
      body = {
        systemInstruction: system ? { parts: [{ text: system.slice(0,20000) }] } : undefined,
        contents: normalizedMessages.filter((m: any) => m?.role !== 'system').map((m: any) => ({ role: m?.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }))
      }
    } else {
      if (provider === 'horde') headers['Authorization'] = 'Bearer 0000000000'
      else headers['Authorization'] = 'Bearer ' + key
      if (provider === 'openrouter') headers['HTTP-Referer'] = String(input?.referer || 'https://ai-teams.local')
      body = { model, messages: normalizedMessages, temperature: Math.max(0, Math.min(2, Number(input?.temperature ?? 0.2))) }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90000)
    try {
      const hordeEndpoints = provider === 'horde'
        ? ['https://oai.stablehorde.net/v1/chat/completions', 'https://oai.aihorde.net/v1/chat/completions']
        : [endpoint]
      let lastUpstream: Response | null = null
      let lastData: any = {}
      let lastRaw = ''
      for (const candidate of hordeEndpoints) {
        try {
          lastUpstream = await fetch(candidate, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
          lastRaw = (await lastUpstream.text()).slice(0, 2000000)
          lastData = {}
          try { lastData = JSON.parse(lastRaw) } catch {}
          if (lastUpstream.ok) break
        } catch (err) {
          if (candidate === hordeEndpoints[hordeEndpoints.length - 1]) throw err
        }
      }
      const upstream = lastUpstream
      const data = lastData
      const raw = lastRaw
      if (!upstream) throw new Error('Upstream response unavailable')
      const upstreamHeaders: Record<string, string> = {}
      for (const name of ['retry-after', 'x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset']) {
        const value = upstream.headers.get(name)
        if (value) upstreamHeaders[name] = value
      }
      if (!upstream.ok) return json({ error: data?.error?.message || data?.message || raw.slice(0, 600) || ('HTTP ' + upstream.status) }, upstream.status, upstreamHeaders)
      const output = String(extract(data, provider) || '').slice(0, 100000)
      if (!output) return json({ error: 'مدل پاسخ متنی قابل استخراجی برنگرداند.' }, 502)
      return json({ output, provider, model })
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return json({ error: 'زمان پاسخ سرویس تمام شد.' }, 504)
    return json({ error: e instanceof Error ? e.message : 'خطای داخلی Gateway' }, 500)
  }
})
