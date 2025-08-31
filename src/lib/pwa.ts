// PWA registration helper for vite-plugin-pwa
// Registers service worker and handles update lifecycle unobtrusively
import { registerSW } from 'virtual:pwa-register';
import { toast } from '@/components/ui/use-toast';

export function registerServiceWorker() {
  try {
    const updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        // New version available. Auto-apply to avoid stale UI in cached browsers.
        try { updateSW(); } catch (e) {
          // Ignore update errors
        }
        // Also show a small heads-up toast.
        toast({
          title: 'Updating…',
          description: 'A new version was detected and is being applied.',
        });
      },
      onOfflineReady() {
        toast({
          title: 'Offline ready',
          description: 'This app is now available offline.',
        });
      },
      onRegistered() {
        // SW registered successfully
      },
      onRegisterError() {
        // Registration error occurred, but we can ignore it
      },
    });
  } catch {
    // SW not supported or registration failed; ignore to keep app functional
  }
}