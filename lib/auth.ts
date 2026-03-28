// Session cookies — httpOnly, set only from Route Handlers.

export const SESSION_COOKIE_NAME = 'rebil_rep_session'

/** Admin mode: password gate via POST /api/auth/admin-login; viewing rep via rebil_admin_view. */
export const ADMIN_SESSION_COOKIE_NAME = 'rebil_admin'
export const ADMIN_VIEW_KODE_COOKIE_NAME = 'rebil_admin_view'

/** Canonical admin password (Norwegian å). */
export const ADMIN_PASSWORD = 'bilerogbåter'

/** True if input matches admin password (trim, Unicode NFC, ASCII å→a alias). */
export function adminPasswordMatches(raw: string): boolean {
  const input = raw.trim().normalize('NFC')
  if (input === ADMIN_PASSWORD.normalize('NFC')) return true
  // Same word with plain "a" — avoids copy/paste or keyboard issues with å
  if (input === 'bilerogbater') return true
  return false
}

/** Max-Age in seconds (30 days). */
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 30
