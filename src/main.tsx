import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { registerSW } from 'virtual:pwa-register';
import { AuthProvider } from './auth/AuthContext';
import { AuthGate } from './auth/AuthGate';
import { TenantTheme } from './auth/TenantTheme';
import { ToastProvider } from './ui/Toast';

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true);
    }
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <TenantTheme>
        <ToastProvider>
          <AuthGate>
            <App />
          </AuthGate>
        </ToastProvider>
      </TenantTheme>
    </AuthProvider>
  </StrictMode>,
);
