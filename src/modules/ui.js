function formatRelativeTime(msAgo) {
  if (msAgo < 45 * 1000) return 'just now';
  if (msAgo < 60 * 60 * 1000) return `${Math.max(1, Math.round(msAgo / 60000))}m ago`;
  if (msAgo < 24 * 60 * 60 * 1000) return `${Math.max(1, Math.round(msAgo / 3600000))}h ago`;
  return `${Math.max(1, Math.round(msAgo / 86400000))}d ago`;
}

export function formatLastSyncedLabel(meta = null, now = Date.now()) {
  if (!meta?.ts) return 'Not synced on this device yet.';
  if (meta.status === 'saving') return 'Syncing changes now…';
  if (meta.status === 'pending') return 'Changes pending sync · waiting for connection.';

  const relative = formatRelativeTime(Math.max(0, now - Number(meta.ts)));

  if (meta.status === 'error') {
    return `Sync issue · last attempt ${relative}`;
  }

  return `Last synced ${relative}`;
}

export function registerServiceWorker() {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;
  if (window.location.protocol === 'file:') return;

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { scope: './' }).catch((err) => {
      console.warn('Service worker registration failed.', err);
    });
  });
}
