import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'labo:pwa-install-dismissed';

/**
 * A quiet, dismissible "install the app" nudge. Only appears when the browser
 * fires `beforeinstallprompt` (i.e. the PWA is installable and not yet
 * installed) and the user has not dismissed it before.
 */
export function PwaPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY)) return;
    } catch {
      /* storage blocked — still fine to show */
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setDeferred(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!deferred) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* ignore */
    }
    setDeferred(null);
  };

  return (
    <div className="pwa-nudge" role="dialog" aria-label="აპლიკაციის დაყენება">
      <span className="pwa-nudge__text">
        <strong>Luka's Labo</strong> — დააყენე აპლიკაციად, იმუშავებს ინტერნეტის გარეშეც.
      </span>
      <span className="pwa-nudge__actions">
        <button
          className="btn btn--primary btn--sm"
          onClick={() => {
            void deferred.prompt();
            void deferred.userChoice.finally(dismiss);
          }}
        >
          დაყენება
        </button>
        <button className="btn btn--quiet btn--sm" onClick={dismiss} aria-label="დახურვა">
          ✕
        </button>
      </span>
    </div>
  );
}
