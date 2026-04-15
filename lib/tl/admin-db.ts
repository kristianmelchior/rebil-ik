// Admin DB operations for TL user management.
// Uses the service role key to bypass RLS — server-side only.

import { createClient } from '@supabase/supabase-js'
import type { Rep } from '@/lib/types'

function getAdminClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL
  const service = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY
  if (!url || !service) throw new Error('Missing SUPABASE_SERVICE_KEY env var')
  return createClient(url, service, { auth: { persistSession: false } })
}

export type RepAdmin = Pick<Rep, 'kode' | 'full_name' | 'email' | 'rolle' | 'teamleder'>

/** Sorted list of distinct non-empty teamleder names. */
export async function getTeamleders(): Promise<string[]> {
  const { data, error } = await getAdminClient()
    .from('reps')
    .select('teamleder')
    .not('teamleder', 'is', null)
    .neq('teamleder', '')
  if (error) throw error
  const names = [...new Set((data ?? []).map((r: { teamleder: string }) => r.teamleder))]
  return names.sort()
}

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

// ── Rotten deal rules ────────────────────────────────────────────────────────

export interface RottenRule {
  stage_id: string
  key:      'create_date' | 'last_activity_at'
  days:     number
}

/** Fetch all rotten-deal rules. Returns an empty array if the table is empty. */
export async function getRottenRules(): Promise<RottenRule[]> {
  const { data, error } = await getAdminClient()
    .from('rotten_deal_rules')
    .select('stage_id, key, days')
  if (error) throw error
  return (data ?? []) as RottenRule[]
}

/** Replace all rotten-deal rules (upsert by stage_id). */
export async function upsertRottenRules(rules: RottenRule[]): Promise<void> {
  if (rules.length === 0) return
  const { error } = await getAdminClient()
    .from('rotten_deal_rules')
    .upsert(rules, { onConflict: 'stage_id' })
  if (error) throw error
}
