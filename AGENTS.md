# Project Rules

- Never commit real `.env` files or files containing API keys, tokens, database URLs, private keys, service-role keys, or other secrets.
- Always keep `.env.example` committed with placeholder values only.
- Use `npm install` and `npm run build` for deployment checks. The repo may contain `bun.lock`, but Vercel must use the explicit npm commands in `vercel.json`.
- This is a TanStack Start / Nitro SSR app. Vercel must build Nitro output, not deploy only `dist/` as a static Vite site.
- Vercel settings: Root Directory is the repository root, Framework Preset is Other, Install Command is `npm install`, Build Command is `npm run build`, and Output Directory should be left empty/default.
- If ready-to-copy Vercel handoff files are needed, name them `VERCEL_ENV_IMPORT.local.env` and `VERCEL_ENV_VALUES.local.md`; keep them local only and confirm they are ignored by Git.
- Public frontend variables such as `VITE_*`, `NEXT_PUBLIC_*`, or similar are visible in the browser. Do not put private secrets there.
- Supabase anon/public keys may be used in frontend variables. Supabase service-role keys must stay backend/server-only and must not use `VITE_*`.
- Do not require `SUPABASE_SERVICE_ROLE_KEY` unless the app actually uses backend admin privileges.
- Supabase URL values must be base project URLs like `https://PROJECT_REF.supabase.co`; do not include `/rest/v1`. `VITE_SUPABASE_PROJECT_ID` is only the project ref.
- Supabase database migrations in `supabase/migrations` must be applied before Vercel can run routes that query `profiles` or `game_saves`.
- If Supabase CLI is available, preview migrations with `npx supabase db push --linked --dry-run` before applying them with `npx supabase db push --linked`.
- Gemini API keys must stay backend/server-only and must not use `VITE_*`. For Gemini features, default to `gemini-2.5-flash-lite` for free/low-cost student usage.
- Remote font CSS imports can break Lightning CSS/Vite builds; prefer document/head font links when needed.
- Supabase database tables and RLS policies must exist before Vercel or local runtime can query them.
- Do not change unrelated app logic unless required for deployment.
- Prefer minimal, correct Vercel configuration.
- Before deploy, confirm `.env`, `.env.local`, `VERCEL_ENV_IMPORT.local.env`, and `VERCEL_ENV_VALUES.local.md` are ignored; run `npm run build`; confirm `.vercel/output` is produced; then commit and push only safe files.
