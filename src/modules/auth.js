export function shouldPreferGoogleRedirect(
  locationLike = globalThis.location,
  navigatorLike = globalThis.navigator,
  matchMediaLike = globalThis.matchMedia?.bind(globalThis)
) {
  const host = locationLike?.hostname || '';
  const userAgent = navigatorLike?.userAgent || '';
  const standalone = Boolean(
    matchMediaLike?.('(display-mode: standalone)')?.matches || navigatorLike?.standalone === true
  );
  const inAppBrowser = /Instagram|FBAN|FBAV|Line|wv/i.test(userAgent);

  return (
    host.endsWith('github.io') ||
    standalone ||
    inAppBrowser ||
    /iPad|iPhone|iPod/i.test(userAgent)
  );
}

export function getGoogleLoginErrorMessage(
  err,
  host = globalThis.location?.hostname || 'this site'
) {
  switch (err?.code) {
    case 'auth/unauthorized-domain':
      return `Google sign-in is not authorised for ${host} yet. Add it in Firebase Auth → Settings → Authorized domains.`;
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Authentication yet.';
    case 'auth/network-request-failed':
      return 'Network error while contacting Google. Check your connection and try again.';
    case 'auth/web-storage-unsupported':
      return 'This browser is blocking the storage Google sign-in needs. Try a normal browser tab.';
    default:
      return 'Please try again.';
  }
}
