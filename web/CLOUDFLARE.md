# Cloudflare Deployment

This project is a **TanStack Start SSR app** that compiles to a **Cloudflare Worker**
via `@cloudflare/vite-plugin`. It can deploy to either Cloudflare **Workers**
(recommended) or Cloudflare **Pages** (advanced `_worker.js` mode).

The `chrome-error://chromewebdata/ ... Unsafe attempt to load URL ...` you saw
means the browser couldn't load `umbraxis-nexus.pages.dev` at all — the
deployment either failed to build or is missing required environment variables,
so Cloudflare served nothing for the root document.

---

## Required environment variables (BOTH builds need these)

Set these in the Cloudflare dashboard → your project → **Settings → Variables and Secrets**:

| Name | Where it's used | Type |
|---|---|---|
| `SUPABASE_URL` | SSR / server functions | Plaintext |
| `SUPABASE_PUBLISHABLE_KEY` | SSR / auth middleware | Plaintext |
| `SUPABASE_SERVICE_ROLE_KEY` | server-only admin client | **Secret** |
| `VITE_SUPABASE_URL` | client bundle (build-time) | Plaintext |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | client bundle (build-time) | Plaintext |

Without `VITE_*` at **build** time, the client crashes on first paint
(see `src/integrations/supabase/client.ts`). Without `SUPABASE_*` at
**runtime**, every server function 500s.

Compatibility flags: `nodejs_compat` (already in `wrangler.jsonc`). For Pages,
add it under Settings → Functions → Compatibility flags for **both**
production and preview.

---

## Option A — Cloudflare Workers (recommended)

```bash
bun run deploy
# = vite build && wrangler deploy
```

Wrangler reads `wrangler.jsonc` and uploads the worker bundle produced by
`@cloudflare/vite-plugin`. URL: `https://umbraxis-nexus.<account>.workers.dev`.

## Option B — Cloudflare Pages

In the Pages dashboard:

- **Build command:** `bun run build` (or `npm run build`)
- **Build output directory:** `dist`
- **Root directory:** *(leave empty)*
- Add the env vars above. Add `nodejs_compat` under Functions → Compatibility flags.

The Vite plugin emits `dist/_worker.js` + `dist/_routes.json`, which Pages
picks up automatically (advanced mode). No `vercel.json`, `_redirects`, or
`_headers` file is needed — TanStack Start handles routing.

Manual deploy from CLI:

```bash
bun run deploy:pages
```

---

## Why the chrome-error happened

Most likely one of:

1. The Pages build failed (missing `VITE_SUPABASE_*` at build time, or
   `nodejs_compat` not enabled).
2. The project was deployed without `_worker.js` being recognized
   (output dir not set to `dist`).
3. The deployment never finished and the hostname has no live deployment yet.

Check **Pages → Deployments → latest → Build log** for the real cause.
