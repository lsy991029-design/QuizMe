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
