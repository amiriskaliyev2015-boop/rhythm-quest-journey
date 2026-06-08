# Project Rules

- Never commit real `.env` files or files containing API keys, tokens, database URLs, private keys, service-role keys, or other secrets.
- Always keep `.env.example` committed with placeholder values only.
- If ready-to-copy Vercel handoff files are needed, name them `VERCEL_ENV_IMPORT.local.env` and `VERCEL_ENV_VALUES.local.md`; keep them local only and confirm they are ignored by Git.
- Public frontend variables such as `VITE_*`, `NEXT_PUBLIC_*`, or similar are visible in the browser. Do not put private secrets there.
- Supabase anon/public keys may be used in frontend variables. Supabase service-role keys must stay backend/server-only and must not use `VITE_*`.
- Do not require `SUPABASE_SERVICE_ROLE_KEY` unless the app actually uses backend admin privileges.
- Gemini API keys must stay backend/server-only and must not use `VITE_*`. For Gemini features, default to `gemini-2.5-flash-lite` for free/low-cost student usage.
- Remote font CSS imports can break Lightning CSS/Vite builds; prefer document/head font links when needed.
- Supabase database tables and RLS policies must exist before Vercel or local runtime can query them.
- Do not change unrelated app logic unless required for deployment.
- Prefer minimal, correct Vercel configuration.
