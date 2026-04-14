// On-demand cache revalidation — call this after a HubSpot/data sync to flush stale data.
// POST /api/revalidate  { "secret": "<REVALIDATE_SECRET>" }
// Set REVALIDATE_SECRET in Vercel environment variables.

import { revalidateTag } from 'next/cache'

export async function POST(req: Request) {
  try {
    const { secret } = await req.json()

    if (!process.env.REVALIDATE_SECRET) {
      return Response.json({ error: 'REVALIDATE_SECRET not configured' }, { status: 500 })
    }

    if (secret !== process.env.REVALIDATE_SECRET) {
      return Response.json({ error: 'Invalid secret' }, { status: 401 })
    }

    revalidateTag('sales-data', { expire: 0 })
    revalidateTag('reps-data', { expire: 0 })

    return Response.json({ revalidated: true, timestamp: new Date().toISOString() })
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 })
  }
}
