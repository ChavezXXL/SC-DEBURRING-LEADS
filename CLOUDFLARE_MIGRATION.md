# Cloudflare-only hosting — the deploy playbook

This repo is now **Cloudflare-only**. Netlify is fully stripped:
- ❌ `netlify.toml` deleted
- ❌ `netlify/functions/` deleted
- ❌ `@netlify/functions` dep removed
- ✅ `functions/api/send-email.ts` — Cloudflare Pages Function
- ✅ `workers/auto-outreach/` — Cloudflare Worker with daily cron trigger
- ✅ `src/services/email.ts` now hits `/api/send-email` (not `/.netlify/functions/...`)

## Two things to deploy

### 1. The CRM app → Cloudflare Pages

1. Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**
2. Pick repo **`ChavezXXL/SC-DEBURRING-LEADS`**
3. Project name: `apexgrowth-crm` (or whatever)
4. **Production branch:** `main`
5. Build settings (Vite preset):
   - Build command: `npm run build`
   - Build output: `dist`
6. Environment variables:
   | Name | Value |
   |---|---|
   | `NODE_VERSION` | `20` |
   | `VITE_FIREBASE_API_KEY` | (from Firebase Console → Project settings) |
   | `RESEND_API_KEY` | (your Resend key) |
   | `RESEND_DOMAIN` | `scprecisiondeburring.com` |
   | `VITE_REQUIRE_AUTH` | `true` when ready to gate behind login |
7. **Save and Deploy.**

Cloudflare auto-deploys every branch. Your `apex-shell-preview` branch will get its own URL like `<hash>-apex-shell-preview.<project>.pages.dev` — that's your live preview of the iOS shell + multi-tenant work.

### 2. The auto-outreach scheduled job → Cloudflare Worker

Separate from the Pages site because cron triggers run on Workers, not Pages.

```
cd workers/auto-outreach
npx wrangler login              # one-time
npx wrangler deploy             # deploys + registers the cron
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT   # paste full JSON on one line
npx wrangler secret put GEMINI_API_KEY
npx wrangler secret put RESEND_API_KEY
```

Schedule: `0 15 * * *` UTC = 8am PT, daily.

**Manual test trigger** (after deploy, no waiting for cron):
```
curl -X POST https://apexgrowth-auto-outreach.<your-account>.workers.dev
```

You should get back JSON listing what was sent.

### How auto-outreach authenticates to Firebase without `firebase-admin`

The Worker can't run Node-only packages. So it:
1. Reads your Firebase **service-account JSON** from a Worker secret
2. Signs a JWT with the service account's private key using WebCrypto (RSASSA-PKCS1-v1_5 + SHA-256)
3. Exchanges that JWT for an OAuth access token at `oauth2.googleapis.com/token`
4. Calls the Firestore REST API directly with that token

How to get the service-account JSON: Firebase Console → Project settings → Service accounts → **Generate new private key** → download. Then `wrangler secret put FIREBASE_SERVICE_ACCOUNT` and paste the entire JSON.

## After deploy

Once Pages is live and you're happy:

1. **Delete the Netlify site** (Netlify dashboard → Site settings → Delete this site). Your old Netlify environment vars contain your Resend key — make sure you've copied it into Cloudflare first.
2. **Point your custom domain (optional):** Pages → Custom domains → add `crm.scdeburring.com` or whatever. Cloudflare provisions SSL in ~1 min.
3. Flip `VITE_REQUIRE_AUTH=true` once you've signed yourself in via Firebase Auth and run the migration script to tag your 177 leads as the `sc-deburring` tenant.

## Rollback

If something breaks: do nothing. Netlify site is still live until YOU delete it. Just keep using `scleads.netlify.app` while we debug. Nothing destructive happens automatically.
