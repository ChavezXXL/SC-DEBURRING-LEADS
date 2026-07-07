import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './auth/AuthContext';
import { AuthGate } from './auth/AuthGate';
import { TenantTheme } from './auth/TenantTheme';
import { WorkspaceProvider } from './auth/WorkspaceContext';
import { ToastProvider } from './ui/Toast';
import { ErrorBoundary } from './ui/ErrorBoundary';
import { showRefreshPrompt } from './shell/pwaUpdate';

// Service worker registration. The heavy lifting for build freshness happens in
// vite.config.ts (autoUpdate + skipWaiting/clientsClaim/cleanupOutdatedCaches):
// a new deploy's SW activates on the next load with no manual cache-clear. This
// callback only covers a tab that's ALREADY open when a deploy lands — it shows
// a small dark "Refresh" toast instead of a blocking confirm(), so nobody loses
// a half-typed note to a surprise reload.
const updateSW = registerSW({
  onNeedRefresh() {
    showRefreshPrompt(() => updateSW(true));
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <WorkspaceProvider>
          <TenantTheme>
            <ToastProvider>
              <AuthGate>
                <App />
              </AuthGate>
            </ToastProvider>
          </TenantTheme>
        </WorkspaceProvider>
      </AuthProvider>
    </ErrorBoundary>
  </StrictMode>,
);
