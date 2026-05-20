<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3ab9b43d-4a14-4abf-96ce-20b75e480e28

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Deploy to Cloudflare Pages (Production)

1. Push this repo to GitHub (already done).
2. In Cloudflare dashboard → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
3. Pick this repo.
4. Build settings (Framework preset: **Vite**):
   - Build command: `npm run build`
   - Build output: `dist`
5. Environment variables → add:
   - `NODE_VERSION` = `20`
   - `VITE_FIREBASE_API_KEY` (web API key from Firebase Console)
   - `RESEND_API_KEY` (for the `/api/send-email` Pages function)
   - `RESEND_DOMAIN` = `scprecisiondeburring.com`
   - `VITE_REQUIRE_AUTH` = `true` (when ready to gate behind login)
6. Save and Deploy.

Pages Functions live under `functions/`. SPA routing is handled by Pages automatically.

### Auto-outreach scheduled job

The daily auto-outreach worker is a separate Cloudflare Worker at `workers/auto-outreach/`. Deploy it independently with `npx wrangler deploy` from that directory. See the wrangler.toml for required secrets.

## Push This Branch to GitHub

I can commit changes in this environment, but pushing to GitHub requires your repository remote + auth token/SSH key.

1. Add your GitHub remote (one time):
   `git remote add origin https://github.com/<your-org-or-user>/<your-repo>.git`
2. Push current branch:
   `git push -u origin work`
3. Open a PR on GitHub from `work` into your main branch.

If you use GitHub CLI:
- `gh auth login`
- `gh repo set-default <your-org-or-user>/<your-repo>`
- `git push -u origin work`
