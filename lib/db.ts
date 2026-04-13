// Only file that imports @supabase/supabase-js.
// All functions throw on Supabase error — route handler catches and returns 500.

import { randomUUID } from 'node:crypto'
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

/**
 * Server-side client for feed_reactions / feed_comments.
 * Set SUPABASE_SERVICE_ROLE_KEY (Project Settings → API → service_role) on the server
 * so RLS never blocks these routes; the anon key often fails on insert/select for new tables.
 */
let feedSocialClientSingleton: ReturnType<typeof createClient> | null = null

function resolveServiceRoleKey(): string | undefined {
  for (const name of [
    'SUPABASE_SERVICE_ROLE_KEY',
    'SUPABASE_SERVICE_KEY',
    'SB_SERVICE_ROLE_KEY',
  ] as const) {
    const v = process.env[name]?.trim()
    if (v) return v
  }
  return undefined
}

function formatSupabaseError(err: unknown): string {
  if (err && typeof err === 'object') {
    const e = err as { message?: string; details?: string; hint?: string; code?: string }
    const parts = [e.message, e.details, e.hint].filter(Boolean)
    if (parts.length) return parts.join(' — ')
  }
  return err instanceof Error ? err.message : String(err)
}

function feedSocialClient() {
  const serviceKey = resolveServiceRoleKey()
  if (serviceKey) {
    if (!feedSocialClientSingleton) {
      feedSocialClientSingleton = createClient(supabaseUrl(), serviceKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
    }
    return feedSocialClientSingleton
  }
  return supabase
}

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

// Fetch a single rep by email. Returns null if not found.
// Input: email (string)  Output: Rep | null
export async function getRepByEmail(email: string): Promise<Rep | null> {
  const { data, error } = await supabase
    .from('reps')
    .select('*')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null
    throw error
  }

  return { ...data, tier: deriveTier(data.rolle) } as Rep
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

// Fetch team members for a teamleder — reps where teamleder = name, sorted by name.
// Input: teamlederName (string)  Output: { kode, full_name }[]
export async function getTeamMembers(teamlederName: string): Promise<{ kode: string; full_name: string }[]> {
  const { data, error } = await supabase
    .from('reps')
    .select('kode, full_name')
    .eq('teamleder', teamlederName)
    .order('full_name')

  if (error) throw error
  return (data ?? []) as { kode: string; full_name: string }[]
}

// All reps with teamleder info — for stats table.
export async function getAllRepsWithDetails(): Promise<{ kode: string; full_name: string; teamleder: string }[]> {
  const { data, error } = await supabase
    .from('reps')
    .select('kode, full_name, teamleder')
    .order('full_name')
  if (error) throw error
  return (data ?? []) as { kode: string; full_name: string; teamleder: string }[]
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

// Fetch NPS rows for a single rep by kode, full year, sorted by submitted_at desc.
// Input: kode (string), year (number)  Output: NpsRow[]
export async function getNpsByKode(kode: string, year: number): Promise<NpsRow[]> {
  return fetchAll<NpsRow>((from, to) =>
    supabase
      .from('nps')
      .select('*')
      .eq('kode', kode)
      .gte('month', `${year}-01-01`)
      .lte('month', `${year}-12-31`)
      .order('submitted_at', { ascending: false })
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
  const { data, error } = await feedSocialClient()
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
  const db = feedSocialClient()
  const { data: existing, error: selErr } = await db
    .from('feed_reactions')
    .select('id')
    .eq('sale_id', saleId)
    .eq('kode', kode)
    .eq('emoji', emoji)
    .maybeSingle()

  if (selErr) throw selErr

  if (existing) {
    const { error: delErr } = await db.from('feed_reactions').delete().eq('id', existing.id)
    if (delErr) throw delErr
    return 'removed'
  }

  const { error: insErr } = await db.from('feed_reactions').insert({
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
  rep_kode: string
  rep_name: string
  body: string
  created_at: string
}

export async function fetchFeedCommentRows(saleIds: number[]): Promise<FeedCommentRow[]> {
  if (saleIds.length === 0) return []
  const { data, error } = await feedSocialClient()
    .from('feed_comments')
    .select('id,sale_id,rep_kode,rep_name,body,created_at')
    .in('sale_id', saleIds)
    .order('created_at', { ascending: true })

  if (error) {
    const base = formatSupabaseError(error)
    const hint =
      resolveServiceRoleKey() == null
        ? ' Legg til SUPABASE_SERVICE_ROLE_KEY i miljøvariabler for serveren.'
        : ''
    throw new Error(`${base}${hint}`)
  }
  return (data ?? []) as FeedCommentRow[]
}

export async function insertFeedComment(
  saleId: number,
  kode: string,
  repName: string,
  body: string
): Promise<FeedCommentRow> {
  const db = feedSocialClient()
  const id = randomUUID()

  const { error } = await db.from('feed_comments').insert({
    id,
    sale_id: saleId,
    rep_kode: kode,
    rep_name: repName,
    body,
  })

  if (error) {
    const base = formatSupabaseError(error)
    const hint =
      resolveServiceRoleKey() == null
        ? ' Legg til SUPABASE_SERVICE_ROLE_KEY i .env.local (server) — se kommentar i lib/db.ts.'
        : ''
    throw new Error(`${base}${hint}`)
  }

  const { data: row, error: readErr } = await db
    .from('feed_comments')
    .select('id,sale_id,rep_kode,rep_name,body,created_at')
    .eq('id', id)
    .maybeSingle()

  if (!readErr && row) {
    return row as FeedCommentRow
  }

  const created_at = new Date().toISOString()
  return {
    id,
    sale_id: saleId,
    rep_kode: kode,
    rep_name: repName,
    body,
    created_at,
  }
}
