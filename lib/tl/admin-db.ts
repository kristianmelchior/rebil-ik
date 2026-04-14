// Admin DB operations for TL user management.
// Uses the service role key to bypass RLS — server-side only.

import { createClient } from '@supabase/supabase-js'
import type { Rep } from '@/lib/types'

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_KEY
  if (!url || !service) throw new Error('Missing SUPABASE_SERVICE_KEY env var')
  return createClient(url, service, { auth: { persistSession: false } })
}

export type RepAdmin = Pick<Rep, 'kode' | 'full_name' | 'email' | 'rolle' | 'teamleder'>

/** Fetch all reps with their role info. */
export async function getAllRepsAdmin(): Promise<RepAdmin[]> {
  const { data, error } = await getAdminClient()
    .from('reps')
    .select('kode, full_name, email, rolle, teamleder')
    .order('full_name')
  if (error) throw error
  return (data ?? []) as RepAdmin[]
}

/** Update a rep's rolle. */
export async function updateRepRolle(kode: string, rolle: string): Promise<void> {
  const { error } = await getAdminClient()
    .from('reps')
    .update({ rolle })
    .eq('kode', kode)
  if (error) throw error
}
