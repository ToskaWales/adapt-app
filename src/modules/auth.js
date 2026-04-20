export function isInAppBrowser(navigatorLike = globalThis.navigator) {
  return /Instagram|FBAN|FBAV|Line|wv/i.test(navigatorLike?.userAgent || '');
}

export function shouldPreferGoogleRedirect(
  locationLike = globalThis.location,
  navigatorLike = globalThis.navigator,
  matchMediaLike = globalThis.matchMedia?.bind(globalThis)
) {
  // signInWithRedirect silently fails in all modern browsers because they block
  // the cross-origin iframe Firebase needs to deliver the token back, even when
  // the redirect itself completes successfully. Use signInWithPopup everywhere.
  // In-app browsers (Instagram, etc.) are handled separately with an open-externally message.
  return false;
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
    case 'auth/popup-closed-by-user':
      return 'The sign-in popup closed before completing. Try again — if it keeps happening, disable browser extensions or try a different browser.';
    default:
      return `Sign-in failed (${err?.code || 'unknown'}). Please try again.`;
  }
}
