// GET /api/feed — recent team sales for Boooom! tab (auth: rep session or admin).

import { cookies } from 'next/headers'
import { getRecentSales } from '@/lib/db'
import { SESSION_COOKIE_NAME, ADMIN_SESSION_COOKIE_NAME } from '@/lib/auth'

export async function GET() {
  const cookieStore = await cookies()
  const isAdmin = cookieStore.get(ADMIN_SESSION_COOKIE_NAME)?.value === '1'
  const repKode = cookieStore.get(SESSION_COOKIE_NAME)?.value

  if (!isAdmin && !repKode) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const sales = await getRecentSales(7)
    return Response.json(sales, { headers: { 'Cache-Control': 'no-store' } })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
