import { useEffect, useState } from 'react';

/**
 * Captures the browser's `beforeinstallprompt` event so the app can offer its
 * own "Install app" affordance (Chrome/Edge/Android fire this; iOS Safari does
 * not, so there the hook simply reports unavailable and callers hide the UI).
 *
 * Usage:
 *   const { canInstall, promptInstall } = useInstallPrompt();
 *   {canInstall && <button onClick={promptInstall}>Install app</button>}
 */

// Minimal shape of the non-standard event — avoids pulling in DOM lib types
// that aren't guaranteed across TS targets.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function isStandalone(): boolean {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari's legacy standalone flag.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      // Stop Chrome's default mini-infobar; we surface our own button instead.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    // The event can only be used once; drop it either way.
    setDeferred(null);
  };

  return {
    // Only show the button when the browser has offered an install AND we're
    // not already running installed.
    canInstall: !!deferred && !installed,
    installed,
    promptInstall,
  };
}
