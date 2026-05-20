# Netlify → Cloudflare Pages migration playbook

You want to move hosting off Netlify onto Cloudflare. Firebase Firestore stays put for data. This is the step-by-step.

## What stays the same

- **Code repo** (GitHub) — Cloudflare Pages connects to the same repo
- **Firebase Firestore** — data layer doesn't change at all
- **Domain `scleads.netlify.app`** — eventually point your custom domain at Cloudflare. The `.netlify.app` URL will keep working until you delete the Netlify site.

## What changes

| Piece | Netlify | Cloudflare |
|---|---|---|
| Hosting | `scleads.netlify.app` | `apexgrowth-crm.pages.dev` (or whatever you name it) |
| Serverless functions | `netlify/functions/*.ts` | `functions/api/*.ts` (already added) |
| Send-email endpoint | `/.netlify/functions/send-email` | `/api/send-email` |
| Scheduled function (auto-outreach) | Netlify Scheduled Function | Cloudflare Cron Trigger (Workers) |
| Env vars | Netlify dashboard | Cloudflare dashboard |
| Build command | `npm run build` | Same |
| Output dir | `dist` | Same |

## What I already prepared

- ✅ `functions/api/send-email.ts` — Cloudflare Pages Function equivalent of the Netlify version. Drop-in compatible with Resend, no Node-only deps.
- ✅ Existing Netlify config (`netlify.toml`, `netlify/functions/*`) left in place so the old site keeps working during the transition.

## What's NOT yet ported (and why)

**`netlify/functions/auto-outreach.ts`** — the scheduled job that runs daily at 8am PT and sends auto-outreach emails. It uses `firebase-admin` (Node-only) and Netlify's cron syntax. To run on Cloudflare you'd need to:

- Replace `firebase-admin` with the Firestore REST API (Workers don't run native Node modules), OR
- Run it as a Cloudflare Worker (not Pages Function) with a Cron Trigger configured in `wrangler.toml`, OR
- Keep this one job on Netlify for now (cheapest path), only migrate hosting + send-email.

Recommendation: **migrate hosting first, keep auto-outreach on Netlify temporarily**. Once stable, port auto-outreach in a separate pass.

---

## Step-by-step (≈30 min total, mostly waiting on deploys)

### 1. Connect the repo to Cloudflare Pages (5 min)

1. Go to https://dash.cloudflare.com → Workers & Pages → Create application → Pages → Connect to Git
2. Authorize Cloudflare to access your GitHub
3. Pick the `SC LEADS PP` repo (or whatever you renamed it to on GitHub)
4. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (leave blank)
   - **Node version:** 20 (set via env var `NODE_VERSION=20`)

### 2. Add environment variables (5 min)

In Cloudflare Pages → Settings → Environment Variables, add:

| Name | Value | Where to find it |
|---|---|---|
| `NODE_VERSION` | `20` | — |
| `VITE_FIREBASE_API_KEY` | (your existing Firebase web API key) | Firebase Console → Project settings |
| `RESEND_API_KEY` | (your existing Resend key) | Currently in Netlify env vars |
| `RESEND_DOMAIN` | `scprecisiondeburring.com` | — |
| `VITE_REQUIRE_AUTH` | `true` (when you're ready to require login) | — |

### 3. Trigger the first deploy (2 min)

Click "Save and Deploy" in Cloudflare Pages. First build takes 2-3 min. You'll get a URL like `apexgrowth-crm-abc.pages.dev`.

### 4. Test the deploy (5 min)

Open the `.pages.dev` URL and check:

- [ ] App loads
- [ ] Login screen appears (if VITE_REQUIRE_AUTH=true)
- [ ] Sign in works → leads load from Firestore
- [ ] Send a test outreach email → confirm it routes through `/api/send-email`
- [ ] Open browser devtools → no console errors

### 5. Update the email endpoint in the app code (1 min)

The current code probably hits `/.netlify/functions/send-email`. Change it to `/api/send-email` so Cloudflare Pages routes it to your new function.

Search the codebase:
```
grep -r "netlify/functions" "C:\Users\scpre\SC LEADS PP\src"
```

Replace `/.netlify/functions/send-email` → `/api/send-email`. Same for auto-outreach when you eventually port it.

### 6. Point your custom domain (optional, 5 min + DNS propagation)

If you have a custom domain (e.g. `crm.scdeburring.com`):

1. Cloudflare Pages → your project → Custom domains → Set up a custom domain
2. Cloudflare walks you through the DNS records. If your domain is already on Cloudflare DNS, it just adds the CNAME automatically.
3. SSL certificate provisions in ~1 min.

### 7. Cut over (when you're confident)

- Update any links that pointed to `scleads.netlify.app` → the new Cloudflare URL
- Leave the Netlify site running for a week as a fallback
- Once you're sure CF is stable, delete the Netlify site (optional — costs nothing to leave it)

---

## Phase 2: Port the auto-outreach scheduled job

When you're ready, the cleanest path is a separate Cloudflare Worker (not a Pages Function) with a Cron Trigger.

Rough plan:
1. New file: `workers/auto-outreach/worker.ts`
2. `workers/auto-outreach/wrangler.toml` with:
   ```
   name = "apexgrowth-auto-outreach"
   compatibility_date = "2025-01-01"
   [triggers]
   crons = ["0 15 * * *"]   # 8am PT daily
   ```
3. Use Firestore REST API instead of `firebase-admin`. The web `firebase/firestore` SDK works in Workers if you use the modular tree-shakeable API, but service-account auth is trickier — easiest path is signing a JWT with a service account and calling the REST endpoint directly.
4. Deploy with `npx wrangler deploy`.

Estimate: 1-2 hours of focused work.

---

## Rollback

Netlify and Cloudflare can run in parallel forever. If something breaks on Cloudflare:

- The Netlify site keeps serving `scleads.netlify.app` unchanged
- Just point users back to that URL
- Investigate the CF issue at your own pace

Nothing is destructive about this migration until you flip your custom domain DNS — and even that is just a CNAME change you can reverse in 5 min.
