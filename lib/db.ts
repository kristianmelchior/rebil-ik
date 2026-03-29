// Only file that imports @supabase/supabase-js.
// All functions throw on Supabase error — route handler catches and returns 500.

import { createClient } from '@supabase/supabase-js'
import type { Rep, SaleRow, LeadRow, NpsRow } from './types'

function supabaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    ''
  )
}

/** Anon / publishable key — see Supabase → Project Settings → API. */
function supabaseKey(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.SUPABASE_KEY ||
    ''
  )
}

const supabase = createClient(supabaseUrl(), supabaseKey())

const PAGE_SIZE = 1000 // Supabase default cap — we page through all results

// Fetch all rows from a paginated Supabase query.
// Calls queryFn(from, to) repeatedly until fewer than PAGE_SIZE rows are returned.
// Input: queryFn (accepts range offsets, returns awaitable with data/error)  Output: T[]
async function fetchAll<T>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  queryFn: (from: number, to: number) => any
): Promise<T[]> {
  const all: T[] = []
  let offset = 0

  while (true) {
    const { data, error } = await queryFn(offset, offset + PAGE_SIZE - 1)
    if (error) throw error
    if (!data || data.length === 0) break
    all.push(...(data as T[]))
    if (data.length < PAGE_SIZE) break // last page reached
    offset += PAGE_SIZE
  }

  return all
}

// Derive tier from rolle string as specified.
// Input: rolle (string from reps table)  Output: 'IK' | 'Senior' | 'Spesialist'
function deriveTier(rolle: string): 'IK' | 'Senior' | 'Spesialist' {
  if (rolle === 'Senior innkjøpskonsulent') return 'Senior'
  if (rolle === 'Innkjøpsspesialist') return 'Spesialist'
  return 'IK'
}

// Fetch a single rep by kode. Returns null if not found.
// Input: kode (rep UUID string)  Output: Rep | null
export async function getRepByKode(kode: string): Promise<Rep | null> {
  const { data, error } = await supabase
    .from('reps')
    .select('*')
    .eq('kode', kode)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // no rows found
    throw error
  }

  return { ...data, tier: deriveTier(data.rolle) } as Rep
}

// All reps for admin picker — kode + full_name only, sorted by name.
export async function getAllRepsForPicker(): Promise<{ kode: string; full_name: string }[]> {
  const { data, error } = await supabase
    .from('reps')
    .select('kode, full_name')
    .order('full_name')

  if (error) throw error
  return (data ?? []) as { kode: string; full_name: string }[]
}

// Fetch all sales rows for a given year (all reps — used for team median).
// Input: year (number)  Output: SaleRow[]
export async function getAllSales(year: number): Promise<SaleRow[]> {
  return fetchAll<SaleRow>((from, to) =>
    supabase
      .from('sales')
      .select('*')
      .gte('dato_kjopt', `${year}-01-01`)
      .lte('dato_kjopt', `${year}-12-31`)
      .range(from, to)
  )
}

// Fetch all leads rows for a given year where teller_lead = true.
// Input: year (number)  Output: LeadRow[]
export async function getAllLeads(year: number): Promise<LeadRow[]> {
  return fetchAll<LeadRow>((from, to) =>
    supabase
      .from('leads')
      .select('*')
      .eq('teller_lead', true)
      .gte('createdate', `${year}-01-01`)
      .lte('createdate', `${year}-12-31`)
      .range(from, to)
  )
}

// Fetch all NPS rows for a given year, excluding null/zz_unknown kodes.
// Input: year (number)  Output: NpsRow[]
export async function getAllNps(year: number): Promise<NpsRow[]> {
  return fetchAll<NpsRow>((from, to) =>
    supabase
      .from('nps')
      .select('*')
      .not('kode', 'is', null)
      .neq('kode', 'zz_unknown')
      .gte('month', `${year}-01-01`)
      .lte('month', `${year}-12-31`)
      .range(from, to)
  )
}

// Recent team sales for Boooom! feed (last N days, biler > 0, not Salgshjelp).
export async function getRecentSales(days = 7): Promise<SaleRow[]> {
  const from = new Date()
  from.setDate(from.getDate() - days)
  const fromStr = from.toISOString().slice(0, 10)

  return fetchAll<SaleRow>((start, end) =>
    supabase
      .from('sales')
      .select('*')
      .gte('dato_kjopt', fromStr)
      .gt('biler', 0)
      .neq('bonustype', 'Salgshjelp')
      .order('dato_kjopt', { ascending: false })
      .range(start, end)
  )
}

// --- Boooom! feed social (tables: feed_reactions, feed_comments) ---

export interface FeedReactionRow {
  id: string
  sale_id: number
  kode: string
  rep_name: string
  emoji: string
}

export async function fetchFeedReactionRows(saleIds: number[]): Promise<FeedReactionRow[]> {
  if (saleIds.length === 0) return []
  const { data, error } = await supabase
    .from('feed_reactions')
    .select('id,sale_id,kode,rep_name,emoji')
    .in('sale_id', saleIds)

  if (error) throw error
  return (data ?? []) as FeedReactionRow[]
}

export async function toggleFeedReaction(
  saleId: number,
  emoji: string,
  kode: string,
  repName: string
): Promise<'added' | 'removed'> {
  const { data: existing, error: selErr } = await supabase
    .from('feed_reactions')
    .select('id')
    .eq('sale_id', saleId)
    .eq('kode', kode)
    .eq('emoji', emoji)
    .maybeSingle()

  if (selErr) throw selErr

  if (existing) {
    const { error: delErr } = await supabase.from('feed_reactions').delete().eq('id', existing.id)
    if (delErr) throw delErr
    return 'removed'
  }

  const { error: insErr } = await supabase.from('feed_reactions').insert({
    sale_id: saleId,
    kode,
    rep_name: repName,
    emoji,
  })
  if (insErr) throw insErr
  return 'added'
}

export interface FeedCommentRow {
  id: string
  sale_id: number
  kode: string
  rep_name: string
  body: string
  created_at: string
}

export async function fetchFeedCommentRows(saleIds: number[]): Promise<FeedCommentRow[]> {
  if (saleIds.length === 0) return []
  const { data, error } = await supabase
    .from('feed_comments')
    .select('id,sale_id,kode,rep_name,body,created_at')
    .in('sale_id', saleIds)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as FeedCommentRow[]
}

export async function insertFeedComment(
  saleId: number,
  kode: string,
  repName: string,
  body: string
): Promise<FeedCommentRow> {
  const { data, error } = await supabase
    .from('feed_comments')
    .insert({ sale_id: saleId, kode, rep_name: repName, body })
    .select('id,sale_id,kode,rep_name,body,created_at')
    .single()

  if (error) throw error
  return data as FeedCommentRow
}
