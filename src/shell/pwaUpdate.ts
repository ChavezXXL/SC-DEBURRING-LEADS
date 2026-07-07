/**
 * Dark "new version available" refresh prompt for the service worker.
 *
 * Why this exists: the app has a history of serving STALE builds after a
 * deploy. The real fix is in vite.config.ts (registerType 'autoUpdate' +
 * workbox skipWaiting/clientsClaim/cleanupOutdatedCaches) — a new SW takes
 * control on the next load automatically. This module handles the one case
 * that config can't: a tab that's ALREADY open when a deploy lands. Rather
 * than a jarring blocking `confirm()` (off-theme, and Enter could fire it by
 * accident), it shows a small dark toast that lets the user apply the update
 * in place with one tap — or ignore it and pick it up on their next reload.
 *
 * Rendered straight to the DOM (no React state) so it's independent of the
 * app tree and can't be torn down by the very update it's announcing.
 */

const TOAST_ID = 'apex-sw-refresh';

export function showRefreshPrompt(onReload: () => void) {
  // Never stack two prompts.
  if (document.getElementById(TOAST_ID)) return;

  const host = document.createElement('div');
  host.id = TOAST_ID;
  host.setAttribute('role', 'status');
  host.setAttribute('aria-live', 'polite');
  // Bottom-center on mobile, bottom-right on desktop — mirrors the app's
  // Toast placement. Inline styles (not Tailwind) so it renders correctly even
  // before/independent of the app's CSS being applied.
  Object.assign(host.style, {
    position: 'fixed',
    left: '50%',
    bottom: '24px',
    transform: 'translateX(-50%)',
    zIndex: '2147483647',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    maxWidth: '92vw',
    padding: '10px 12px 10px 16px',
    borderRadius: '14px',
    background: '#12151A', // apex-850 card surface
    color: '#E2E8F0', // slate-200
    boxShadow: '0 10px 30px rgba(0,0,0,0.55)',
    border: '1px solid rgba(255,255,255,0.10)', // white/10 hairline
    font: "500 14px/1.2 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  } satisfies Partial<CSSStyleDeclaration>);

  const label = document.createElement('span');
  label.textContent = 'New version available';
  label.style.whiteSpace = 'nowrap';

  const refresh = document.createElement('button');
  refresh.textContent = 'Refresh';
  Object.assign(refresh.style, {
    cursor: 'pointer',
    border: 'none',
    borderRadius: '10px',
    padding: '7px 14px',
    background: '#F26D21', // molten orange accent
    color: '#ffffff',
    font: "600 13px/1 ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  } satisfies Partial<CSSStyleDeclaration>);
  refresh.addEventListener('click', () => {
    refresh.textContent = 'Updating…';
    refresh.disabled = true;
    onReload();
  });

  const dismiss = document.createElement('button');
  dismiss.setAttribute('aria-label', 'Dismiss');
  dismiss.textContent = '✕';
  Object.assign(dismiss.style, {
    cursor: 'pointer',
    border: 'none',
    background: 'transparent',
    color: '#94A3B8', // slate-400
    font: '600 13px/1 ui-sans-serif, system-ui, sans-serif',
    padding: '6px',
  } satisfies Partial<CSSStyleDeclaration>);
  dismiss.addEventListener('click', () => host.remove());

  host.append(label, refresh, dismiss);
  document.body.appendChild(host);
}
