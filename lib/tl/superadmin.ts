// Superadmin check for the TL dashboard.
// Add emails to TL_SUPERADMIN_EMAILS in Vercel env vars (comma-separated).

export function isTlSuperadmin(email: string | null | undefined): boolean {
  if (!email) return false
  const raw = process.env.TL_SUPERADMIN_EMAILS ?? ''
  const allowed = raw.split(',').map(e => e.trim().toLowerCase()).filter(Boolean)
  return allowed.includes(email.toLowerCase())
}
