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
