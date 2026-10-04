import { createSupabaseContext } from 'npm:@supabase/server@1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
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

  const { data: ctx, error: authError } = await createSupabaseContext(req, { auth: 'user' })
  if (authError) return json({ error: 'احراز هویت لازم است.', code: authError.code }, authError.status || 401)

  try {
    const input = await req.json()
    const provider = String(input?.provider || '') as Provider
    const model = String(input?.model || '')
    const messages = Array.isArray(input?.messages) ? input.messages : []
    const system = String(input?.system || '')

    if (!provider || !model || !messages.length) return json({ error: 'provider، model و messages الزامی هستند.' }, 400)
    const endpoint = endpointFor(provider, model)
    if (!endpoint) return json({ error: 'Endpoint سرویس مشخص نشده است.' }, 400)

    const key = provider === 'horde' ? '' : getSecretKey(provider)
    if (provider !== 'horde' && !key) {
      return json({ error: 'کلید این Provider در Supabase تنظیم نشده است: ' + provider }, 503)
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    let body: any

    if (provider === 'claude') {
      headers['x-api-key'] = key
      headers['anthropic-version'] = '2023-06-01'
      body = { model, max_tokens: Number(input?.max_tokens || 1200), system, messages }
    } else if (provider === 'gemini') {
      headers['x-goog-api-key'] = key
      const contents = messages
        .filter((m: any) => m?.role !== 'system')
        .map((m: any) => ({
          role: m?.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: String(m?.content || '') }]
        }))
      body = {
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        contents
      }
    } else {
      if (provider === 'horde') headers['Authorization'] = 'Bearer 0000000000'
      else headers['Authorization'] = 'Bearer ' + key
      if (provider === 'openrouter') headers['HTTP-Referer'] = String(input?.referer || 'https://ai-teams.local')
      body = { model, messages, temperature: Number(input?.temperature ?? 0.2) }
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90000)
    try {
      const upstream = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
      const raw = await upstream.text()
      let data: any = {}
      try { data = JSON.parse(raw) } catch {}
      if (!upstream.ok) return json({ error: data?.error?.message || data?.message || raw.slice(0, 600) || ('HTTP ' + upstream.status) }, upstream.status)
      const output = extract(data, provider)
      if (!output) return json({ error: 'مدل پاسخ متنی قابل استخراجی برنگرداند.' }, 502)
      return json({ output, provider, model, user_id: ctx.userClaims?.sub || null })
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') return json({ error: 'زمان پاسخ سرویس تمام شد.' }, 504)
    return json({ error: e instanceof Error ? e.message : 'خطای داخلی Gateway' }, 500)
  }
})
