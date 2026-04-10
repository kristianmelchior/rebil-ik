// Shared Supabase browser client for AuthGate and /auth/callback.
// Uses @supabase/ssr's createBrowserClient which stores the PKCE code
// verifier in cookies — this survives the cross-origin OAuth redirect
// that breaks localStorage-based storage in Next.js.

import { createBrowserClient } from '@supabase/ssr'

export function getSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
