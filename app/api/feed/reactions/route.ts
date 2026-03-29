// GET ?sale_ids=1,2,3 — reaction counts + myReactions per sale.
// POST { sale_id, emoji } — toggle reaction for current viewer rep.

import { type NextRequest } from 'next/server'
import { fetchFeedReactionRows, toggleFeedReaction } from '@/lib/db'
import { aggregateFeedReactions } from '@/lib/feedAggregate'
import { isAllowedFeedEmoji } from '@/lib/feedEmoji'
import { requireFeedViewer } from '@/lib/feedAuth'

export async function GET(request: NextRequest) {
  const auth = await requireFeedViewer()
  if ('error' in auth) return auth.error

  const raw = request.nextUrl.searchParams.get('sale_ids') ?? ''
  const saleIds = raw
    .split(',')
    .map(s => parseInt(s.trim(), 10))
    .filter(n => !Number.isNaN(n))

  if (saleIds.length === 0) {
    return Response.json({}, { headers: { 'Cache-Control': 'no-store' } })
  }

  try {
    const rows = await fetchFeedReactionRows(saleIds)
    const payload = aggregateFeedReactions(rows, saleIds, auth.kode)
    return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireFeedViewer()
  if ('error' in auth) return auth.error

  let body: { sale_id?: unknown; emoji?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const saleId = typeof body.sale_id === 'number' ? body.sale_id : parseInt(String(body.sale_id), 10)
  const emoji = typeof body.emoji === 'string' ? body.emoji : ''
  if (!Number.isFinite(saleId) || saleId <= 0) {
    return Response.json({ error: 'Invalid sale_id' }, { status: 400 })
  }
  if (!isAllowedFeedEmoji(emoji)) {
    return Response.json({ error: 'Invalid emoji' }, { status: 400 })
  }

  try {
    const result = await toggleFeedReaction(saleId, emoji, auth.kode, auth.repName)
    return Response.json({ ok: true, state: result })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
