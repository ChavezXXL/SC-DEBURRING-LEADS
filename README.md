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

## Deploy to Netlify (Production)

This repo now includes `netlify.toml` so Netlify uses the correct build settings automatically.

1. Push this repo/branch to GitHub.
2. In Netlify, click **Add new site** → **Import an existing project**.
3. Select this repository.
4. Netlify should auto-detect:
   - Build command: `npm run build`
   - Publish directory: `dist`
5. Add required environment variables in Netlify Site Settings:
   - `GEMINI_API_KEY` (base64-encoded value expected by current app flow)
   - Any required `VITE_FIREBASE_*` keys
6. Click **Deploy site**.

For SPA routing, all paths are redirected to `index.html` via `netlify.toml`.

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
