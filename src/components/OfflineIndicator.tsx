import { useEffect, useState } from 'react';

// Unobtrusive offline indicator; respects accessibility by using role="status"
export default function OfflineIndicator() {
  const [online, setOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true,
  );

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-3 bottom-3 z-50 rounded-md bg-amber-100 text-amber-900 border border-amber-300 shadow px-3 py-2 text-sm"
    >
      You are offline. Changes will sync when you’re back online.
    </div>
  );
}
