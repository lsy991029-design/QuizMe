const FALLBACK_ACCESS_CODE = '826417';
const ACCESS_GRANT_KEY = 'history-quiz:access-grant:v1';

const configuredAccessCode = import.meta.env.VITE_QUIZ_ACCESS_CODE;
export const ACCESS_CODE = typeof configuredAccessCode === 'string' && /^\d{6}$/.test(configuredAccessCode)
  ? configuredAccessCode
  : FALLBACK_ACCESS_CODE;

export function hasAccessGrant(): boolean {
  try {
    return sessionStorage.getItem(ACCESS_GRANT_KEY) === ACCESS_CODE;
  } catch {
    return false;
  }
}

export function grantAccess(): void {
  try {
    sessionStorage.setItem(ACCESS_GRANT_KEY, ACCESS_CODE);
  } catch {
    // Browsers that block sessionStorage can still continue for this page load.
  }
}

export function isAccessCode(value: string): boolean {
  return value === ACCESS_CODE;
}

export function isSharedEntry(url = new URL(window.location.href)): boolean {
  return url.searchParams.get('entry') === 'share' || url.hash.startsWith('#share=');
}

export function makeTestEntryUrl(base = window.location.href): string {
  const url = new URL(base);
  url.search = '?entry=share';
  url.hash = '';
  return url.href;
}

export function clearSharedEntry(): void {
  const url = new URL(window.location.href);
  url.searchParams.delete('entry');
  url.hash = '';
  history.replaceState(null, '', url.pathname + url.search);
}
