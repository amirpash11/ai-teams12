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

For a custom provider, configure `custom` in `AI_TEAMS_PROVIDER_KEYS` and set the provider endpoint in the app. The endpoint is treated as configuration; the secret remains server-side.

## Important

The GitHub repository contains code and configuration placeholders only. Secret values must be entered in Supabase's secret manager, not committed to this repository.
