# THREAD — AI Research Intelligence

Production-oriented Next.js application for capturing web evidence, tracing claims to sources, detecting conflicts, exposing knowledge gaps, and planning the next research step. New accounts and projects start empty.

## Run locally

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open `http://localhost:3000` and create an account. Required production variables:

- `SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SEARCH_API_KEY` for Tavily search
- `OPENAI_API_KEY` for OpenAI analysis (optional; a grounded deterministic fallback remains available)
- `NEXT_PUBLIC_APP_URL`
- `EXTENSION_ALLOWED_ORIGINS`

Never commit `.env.local`.

## Database

Apply both files in `supabase/migrations/` to the configured Supabase project. The schema includes RLS policies that scope every research record to the authenticated project owner. The cleanup migration removes records from earlier development builds. `supabase/seed.sql` intentionally inserts nothing.

## Authentication

Email/password works through Supabase Auth. To enable Google and GitHub:

1. Enable each provider in Supabase Dashboard → Authentication → Providers.
2. Add the provider client ID and secret.
3. Add `https://YOUR_PROJECT.supabase.co/auth/v1/callback` to each provider's callback URLs.
4. Add local and Vercel URLs to Supabase Authentication → URL Configuration.

## Chrome extension

```bash
npm run extension:zip
```

Load `apps/extension/dist` through `chrome://extensions` → Developer mode → Load unpacked, or distribute `apps/extension/thread-extension.zip`. In the popup:

1. Open any compatible THREAD deployment once; the extension discovers its backend automatically. The production site is the default.
2. Log in to THREAD in the same Chrome profile.
3. Connect and choose a research project.
4. Highlight text on a web page and use Save, Explain, or Verify from the context menu.

For production, replace the wildcard extension origin with the exact installed extension ID in `EXTENSION_ALLOWED_ORIGINS`.

## Vercel

Import this repository, add the environment variables above, set `NEXT_PUBLIC_APP_URL` to the Vercel domain, and deploy. Add the final Vercel URL to Supabase Auth URL Configuration.

## Verification

```bash
npm run check
```

This runs lint, unit tests, the Manifest V3 extension build, TypeScript checks, and the optimized Next.js production build.
