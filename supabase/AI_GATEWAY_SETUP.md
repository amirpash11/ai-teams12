# AI Teams secure AI gateway

The app now routes paid AI-provider requests through the authenticated Supabase Edge Function:
`supabase/functions/ai-gateway/index.ts`.

## Production setup

1. In Supabase, deploy the `ai-gateway` Edge Function.
2. In Edge Function Secrets, create one JSON secret named `AI_TEAMS_PROVIDER_KEYS`.
3. Put only the provider keys you actually use, for example:

```json
{
  "openai": "YOUR_OPENAI_KEY",
  "openrouter": "YOUR_OPENROUTER_KEY",
  "claude": "YOUR_ANTHROPIC_KEY",
  "gemini": "YOUR_GEMINI_KEY"
}
```

4. Do not put these values into GitHub, `index.html`, `provider-manager.js`, or browser localStorage.
5. Users must sign in through the app's Supabase cloud-storage panel before using paid providers.
6. AI Horde remains available without a paid provider secret.

The browser sends the user's Supabase session to the gateway. The gateway validates the user and reads provider secrets from its server environment.

## Custom provider

For a custom provider, put its secret in `AI_TEAMS_PROVIDER_KEYS` and its endpoint in a second Edge Function secret named `AI_TEAMS_CUSTOM_ENDPOINTS`, for example:

```json
{
  "custom": "https://api.example.com/v1/chat/completions",
  "my-provider": "https://api.example.com/v1/chat/completions"
}
```

The browser-supplied Endpoint is not trusted by the Gateway. This prevents an authenticated user from turning the server into a request proxy for arbitrary internal or private URLs.

## Important

The GitHub repository contains code and configuration placeholders only. Secret values must be entered in Supabase's secret manager, not committed to this repository.


## Verification checklist

After deployment, verify in this order:
1. Supabase Authentication allows Email/Password sign-up and sign-in.
2. Run `supabase-schema.sql` once in the SQL Editor.
3. Confirm the `ai_teams_projects` table has RLS enabled and the own-user policies are present.
4. Set only the provider secrets you actually own. Never paste them into GitHub.
5. Open AI Teams → ☁ ذخیره‌سازی ابری, enter the Project URL and Publishable Key, then sign in.
6. Test an AI Horde agent first. It does not require a provider secret.
7. Test one paid provider with a minimal one-sentence request.
8. Test project save/restore, then sign out and sign in again.
9. For OpenAI-compatible streaming providers, the Gateway also supports authenticated SSE when the request uses `stream: true`.
10. If a provider is unavailable, the team engine retries the provider and can fall back to AI Horde.

### Provider-key reality

OpenAI, Anthropic/Claude, Gemini, and OpenRouter are not made keyless by this application. A provider account/API key is required where the upstream service requires one. AI Horde is the built-in keyless/free path for initial testing.

### Secret names

Preferred single JSON secret:

```json
{
  "openai": "OPENAI_KEY",
  "openrouter": "OPENROUTER_KEY",
  "claude": "ANTHROPIC_KEY",
  "gemini": "GEMINI_KEY"
}
```

Optional per-provider fallback environment names are also accepted by the Gateway:
- `AI_TEAMS_OPENAI_API_KEY`
- `AI_TEAMS_OPENROUTER_API_KEY`
- `AI_TEAMS_CLAUDE_API_KEY`
- `AI_TEAMS_GEMINI_API_KEY`

Never commit real values.
