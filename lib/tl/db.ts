// Supabase queries for the TL dashboard.
// Uses the same Supabase project but only touches deals_current.

import { createClient } from '@supabase/supabase-js'
import type { Deal } from './types'

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) throw new Error('Missing Supabase env vars')
  return createClient(url, key)
}

/** Fetch all active deals from deals_current, ordered by last activity (oldest first). */
export async function getDeals(): Promise<Deal[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('deals_current')
    .select('*')
    .order('last_activity_at', { ascending: true, nullsFirst: true })
  if (error) throw error
  return (data ?? []) as Deal[]
}

/** Fetch deals for a specific owner. */
export async function getDealsByOwner(ownerId: string): Promise<Deal[]> {
  const supabase = getClient()
  const { data, error } = await supabase
    .from('deals_current')
    .select('*')
    .eq('owner_id', ownerId)
    .order('last_activity_at', { ascending: true, nullsFirst: true })
  if (error) throw error
  return (data ?? []) as Deal[]
}
