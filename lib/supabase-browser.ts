// Shared Supabase browser client factory used by AuthGate and /auth/callback.
//
// Uses cookie-based storage for the PKCE code verifier so it survives the
// cross-origin OAuth redirect (localStorage can be unreliable in some browsers
// after a redirect from accounts.google.com → supabase.co → our app).

function buildCookieStorage() {
  return {
    getItem(key: string): string | null {
      if (typeof document === 'undefined') return null
      const match = document.cookie.match(
        new RegExp(`(?:^|; )${encodeURIComponent(key)}=([^;]*)`)
      )
      return match ? decodeURIComponent(match[1]) : null
    },
    setItem(key: string, value: string): void {
      if (typeof document === 'undefined') return
      // max-age 600 s (10 min) — only needed during the OAuth round-trip
      document.cookie = `${encodeURIComponent(key)}=${encodeURIComponent(value)};path=/;max-age=600;SameSite=Lax`
    },
    removeItem(key: string): void {
      if (typeof document === 'undefined') return
      document.cookie = `${encodeURIComponent(key)}=;path=/;max-age=0;SameSite=Lax`
    },
  }
}

let _client: ReturnType<typeof import('@supabase/supabase-js').createClient> | null = null

export function getSupabaseBrowserClient() {
  if (_client) return _client
  // Import is deferred so this module is safe to import from 'use client' files.
  const { createClient } = require('@supabase/supabase-js')
  _client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        storage: buildCookieStorage(),
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }
  )
  return _client!
}
