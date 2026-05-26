import { useState, useEffect, useCallback } from 'react';
import { X, Download, Smartphone } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    // Check if running as standalone PWA
    const standalone = window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    setIsStandalone(standalone);

    // Check if iOS
    const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iOS);

    // Check if user dismissed recently
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) {
      const dismissedTime = parseInt(dismissed);
      const sevenDays = 7 * 24 * 60 * 60 * 1000;
      if (Date.now() - dismissedTime < sevenDays) {
        return; // Don't show if dismissed within 7 days
      }
    }

    // Listen for beforeinstallprompt event (Android/Desktop Chrome)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      console.log('[PWA] beforeinstallprompt event captured');
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      
      // Show prompt after a short delay for better UX
      setTimeout(() => {
        setShowPrompt(true);
      }, 2000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Check if app was installed
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed');
      setShowPrompt(false);
      setDeferredPrompt(null);
    });

    // For iOS, show prompt after delay
    if (iOS && !standalone) {
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 5000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    if (!deferredPrompt) {
      console.log('[PWA] No deferred prompt available');
      return;
    }

    try {
      console.log('[PWA] Prompting install...');
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      console.log('[PWA] Install outcome:', outcome);
      if (outcome === 'accepted') {
        setShowPrompt(false);
      }
      
      setDeferredPrompt(null);
    } catch (error) {
      console.error('[PWA] Install prompt error:', error);
    }
  }, [deferredPrompt]);

  const handleDismiss = useCallback(() => {
    setShowPrompt(false);
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', Date.now().toString());
  }, []);

  // Don't show if already installed
  if (isStandalone) return null;

  // Don't show if not ready
  if (!showPrompt) return null;

  // iOS specific prompt
  if (isIOS) {
    return (
      <div 
        className="fixed inset-0 bg-black/50 z-[9999] flex items-end justify-center animate-in fade-in duration-300"
        onClick={handleDismiss}
      >
        <div 
          className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom duration-300"
          onClick={e => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-xl overflow-hidden bg-lime-400 p-1">
                <img 
                  src="/icons/icon-96x96.png" 
                  alt="101 Drivers" 
                  className="w-full h-full rounded-lg object-contain"
                />
              </div>
              <div>
                <h3 className="font-semibold text-lg">101 Drivers</h3>
                <p className="text-sm text-slate-500">Vehicle Delivery Service</p>
              </div>
            </div>
            <button 
              onClick={handleDismiss}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="text-center mb-6">
            <Smartphone className="w-12 h-12 mx-auto mb-3 text-lime-500" />
            <h4 className="text-xl font-semibold mb-2">Install the App</h4>
            <p className="text-slate-600 dark:text-slate-400 text-sm">
              Add 101 Drivers to your home screen for quick access and the best experience
            </p>
          </div>
          
          <div className="bg-slate-100 dark:bg-slate-800 rounded-xl p-4 text-left space-y-3">
            <p className="text-sm font-medium mb-2">Follow these steps:</p>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-lime-100 dark:bg-lime-900 flex items-center justify-center">
                <span className="text-lg">⬆️</span>
              </div>
              <span className="text-sm">Tap the Share button at the bottom</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-lime-100 dark:bg-lime-900 flex items-center justify-center">
                <span className="text-lg">➕</span>
              </div>
              <span className="text-sm">Tap "Add to Home Screen"</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-lime-100 dark:bg-lime-900 flex items-center justify-center">
                <span className="text-lg">✓</span>
              </div>
              <span className="text-sm">Tap "Add" in the top right</span>
            </div>
          </div>
          
          <button 
            onClick={handleDismiss}
            className="w-full mt-4 py-3 px-4 bg-lime-400 hover:bg-lime-500 text-slate-900 font-semibold rounded-xl transition-colors"
          >
            Got it!
          </button>
        </div>
      </div>
    );
  }

  // Android/Desktop prompt - only show if we have the deferred prompt
  if (!deferredPrompt) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-end justify-center animate-in fade-in duration-300">
      <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-t-3xl p-6 pb-10 animate-in slide-in-from-bottom duration-300">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden bg-lime-400 p-1">
              <img 
                src="/icons/icon-96x96.png" 
                alt="101 Drivers" 
                className="w-full h-full rounded-lg object-contain"
              />
            </div>
            <div>
              <h3 className="font-semibold text-lg">101 Drivers</h3>
              <p className="text-sm text-slate-500">Vehicle Delivery Service</p>
            </div>
          </div>
          <button 
            onClick={handleDismiss}
            className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="text-center mb-6">
          <Download className="w-12 h-12 mx-auto mb-3 text-lime-500" />
          <h4 className="text-xl font-semibold mb-2">Install the App</h4>
          <p className="text-slate-600 dark:text-slate-400 text-sm">
            Install 101 Drivers on your device for quick access, offline support, and the best experience
          </p>
        </div>
        
        <div className="space-y-3">
          <button 
            onClick={handleInstall}
            className="w-full py-3 px-4 bg-lime-400 hover:bg-lime-500 text-slate-900 font-semibold rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <Download className="w-5 h-5" />
            Install Now
          </button>
          <button 
            onClick={handleDismiss}
            className="w-full py-3 px-4 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-sm"
          >
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}

export default PWAInstallPrompt;
