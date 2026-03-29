// GET ?sale_ids=1,2,3 — comments per sale (ascending by time).
// POST { sale_id, body } — add comment as current viewer rep.

import { type NextRequest } from 'next/server'
import { fetchFeedCommentRows, insertFeedComment } from '@/lib/db'
import { aggregateFeedComments } from '@/lib/feedAggregate'
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
    const rows = await fetchFeedCommentRows(saleIds)
    const payload = aggregateFeedComments(rows, saleIds)
    return Response.json(payload, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await requireFeedViewer()
  if ('error' in auth) return auth.error

  let body: { sale_id?: unknown; body?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const saleId = typeof body.sale_id === 'number' ? body.sale_id : parseInt(String(body.sale_id), 10)
  const text = typeof body.body === 'string' ? body.body.trim() : ''
  if (!Number.isFinite(saleId) || saleId <= 0) {
    return Response.json({ error: 'Invalid sale_id' }, { status: 400 })
  }
  if (text.length === 0 || text.length > 2000) {
    return Response.json({ error: 'Invalid body' }, { status: 400 })
  }

  try {
    const row = await insertFeedComment(saleId, auth.kode, auth.repName, text)
    return Response.json({
      ok: true,
      comment: {
        id: row.id,
        sale_id: row.sale_id,
        rep_name: row.rep_name,
        body: row.body,
        created_at: row.created_at,
      },
    })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
