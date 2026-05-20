# SC Leads → Multi-tenant + iOS upgrade — what shipped tonight

**Status:** Local only. Nothing pushed live. `scleads.netlify.app` is untouched. Build verified ✅ (`npm run build` clean).

## The three things you asked for

| Goal | Status |
|---|---|
| 1. Multi-tenant — each new account gets a fresh empty CRM ("suit them") | ✅ Done, code + migration script ready |
| 2. iOS-style UI upgrade | 🟡 Shell done (sidebar, header, lead card chrome, leads-tab toolbar). Tab interiors still classic — see "deferred" below. |
| 3. Move hosting Netlify → Cloudflare | ✅ Playbook + `functions/api/send-email.ts` Cloudflare-ready. Step-by-step in `CLOUDFLARE_MIGRATION.md`. |

## Multi-tenant data isolation — how it works

- Every lead now carries a `tenantId` field.
- The Firestore query is **filtered by `tenantId`** so each tenant only sees leads they own.
- **New accounts start empty.** No SC Deburring data leaks into a new client's CRM. The "seed initial leads" code only runs in legacy single-tenant mode.
- **SC Deburring is tenant #1 (`sc-deburring`).** Your 177 existing leads stay yours.
- **Santiago = super-admin.** First time you log in with `santiago@scdeburring.com`, you auto-become super-admin of `sc-deburring`.
- Other clients you onboard become their own tenants with their own login.

## What you need to do to migrate your 177 leads

Tag every existing lead with `tenantId: "sc-deburring"` so they show up under your account once auth is on:

```
cd "C:\Users\scpre\SC LEADS PP"
# Option A — using your Firebase service account JSON
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\path\to\sc-deburring-service-account.json"
npx tsx scripts/migrate-tenant.ts

# Option B — if you've already done `gcloud auth application-default login`
npx tsx scripts/migrate-tenant.ts
```

Script is idempotent — re-running skips leads already tagged.

## iOS UI — what changed visually

✅ Done:
- Root background → soft slate-50 (was zinc-950 dark mode)
- **Mobile header** → white frosted, tenant name shown
- **Sidebar** → light, rounded-2xl, blue accents, subtle ring borders, **tenant name at top, user email + role + sign-out button at bottom**
- **Login screen** → iOS-styled (rounded inputs, gradient bg, soft shadows)
- **Leads tab toolbar** — search bar, filter dropdowns, HOT 5 button, all converted
- **Lead card chrome** → white card, rounded-2xl, ring-1 border, lighter typography

🟡 Deferred for follow-up (still dark-themed inside):
- Lead card actions row (the buttons that appear when you expand a card)
- Lead card details/notes/status sections
- QuickEmail composer
- Outreach tab full screen
- Pipeline tab full screen
- AI Brain tab full screen
- Autopilot tab full screen
- Modals (AddLead, AiModal, AiFinder, Delete)
- Bolt chat

Why I stopped where I stopped: those inner screens are 600+ lines each. Going through every one in one session = high risk of breaking something subtle. I'd rather get your eyeballs on the shell first.

## Cloudflare migration — see `CLOUDFLARE_MIGRATION.md`

TL;DR:
- ✅ `functions/api/send-email.ts` is drop-in for Cloudflare Pages Functions
- ✅ Existing Netlify config left in place — old site keeps running
- 🟡 `auto-outreach.ts` scheduled job uses `firebase-admin` which doesn't run on CF Workers natively — recommend keeping that one on Netlify for now, port in Phase 2
- Migration is ~30 min of clicks once you decide to do it. Reversible.

## How to preview the new look (5 min)

1. **Firebase Console** → Authentication → Sign-in method → enable Email/Password
2. **Firebase Console** → Authentication → Users → Add user (`santiago@scdeburring.com` + a password)
3. In the repo:
   ```
   cd "C:\Users\scpre\SC LEADS PP"
   echo VITE_REQUIRE_AUTH=true > .env.local
   npm run dev
   ```
4. Open http://localhost:3000 → login screen. Sign in. App bootstraps your super-admin profile and the `sc-deburring` tenant doc.
5. (Run the migration script when you want your 177 leads visible.)

## How to test multi-tenancy

After logging in as Santiago:
- You'll see no leads at first (until you run the migration)
- Run the migration → refresh → your 177 leads appear, all tagged `sc-deburring`
- To test "fresh account": Firebase Console → add a 2nd user with a different email → sign out → sign in as that user → empty CRM ✅

## Files changed/added

```
src/firebase.ts                       (added auth export)
src/types.ts                          (Tenant, UserProfile, Lead.tenantId)
src/main.tsx                          (wrap with AuthProvider + AuthGate)
src/App.tsx                           (tenant-scoped query, sign-out, iOS shell)
src/auth/AuthContext.tsx              NEW
src/auth/AuthGate.tsx                 NEW
src/components/Login.tsx              NEW
src/components/Sidebar.tsx            (full iOS redesign + tenant footer)
src/components/LeadCard.tsx           (iOS chrome)
src/components/LeadCard/LeadCardHeader.tsx  (iOS chrome)
scripts/migrate-tenant.ts             NEW
functions/api/send-email.ts           NEW (Cloudflare-ready)
.env.example                          (added VITE_REQUIRE_AUTH)
CLOUDFLARE_MIGRATION.md               NEW
AUTH_PREVIEW.md                       (this doc, updated)
```

## Safety: live site untouched

- `VITE_REQUIRE_AUTH` defaults OFF → live site shows app without login, no behavior change
- `tenantId` filtering only kicks in when a tenant is loaded (which only happens when auth is required)
- Nothing pushed to GitHub or Netlify

## Suggested order after you preview

1. Tell me if the new look is going the right direction
2. If yes → I finish the remaining tab interiors (Outreach/Pipeline/Brain/Autopilot/modals) over the next session
3. Run the migration to tag your 177 leads
4. Flip `VITE_REQUIRE_AUTH=true` in Netlify (or do the CF migration first)
5. Build the super-admin "create new client account" UI (the function `createTenantAccount()` already exists in AuthContext — just needs a modal)
