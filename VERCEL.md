# Vercel deployment

This is a TanStack Start React app built with Vite and Nitro. It needs a server/SSR deployment on Vercel; deploying it as a static Vite app can produce a Vercel 404 because the Nitro server output is not being used.

## Build settings

- Framework preset: `Other`
- Root directory: repository root
- Install command: leave default (`npm install`)
- Build command: `npm run build`
- Output directory: leave empty/default
- Node.js version: `20` or newer

## Environment variables

Add these in Vercel Project Settings -> Environment Variables for Production, Preview, and Development:

```text
SUPABASE_URL=https://tbhczotafnvdwsiouwwj.supabase.co
SUPABASE_PUBLISHABLE_KEY=<anon key>
VITE_SUPABASE_PROJECT_ID=tbhczotafnvdwsiouwwj
VITE_SUPABASE_URL=https://tbhczotafnvdwsiouwwj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
NITRO_PRESET=vercel
```

Only the `VITE_*` variables are exposed to browser code. Do not add `SUPABASE_SERVICE_ROLE_KEY` unless backend admin operations are introduced; this app currently uses the anon/public key with user JWTs and RLS for game saves.

For local development, put real values in `.env.local`. That file is ignored by Git. The app's Supabase tables must also be present before deployment can query them; apply the SQL files in `supabase/migrations` through the Supabase CLI or the Supabase SQL editor.
