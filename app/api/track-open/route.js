export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
const PIXEL = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64')
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url)
    const emailId = searchParams.get('id')
    if (emailId) {
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hpqpzotvcdgpuqtxlczm.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY)
      const now = new Date().toISOString()
      const { data: existing } = await supabase.from('email_tracking').select('id, open_count, opened_at').eq('email_id', emailId).single()
      if (existing) { await supabase.from('email_tracking').update({ open_count: (existing.open_count || 0) + 1, opened_at: existing.opened_at || now, last_opened: now }).eq('email_id', emailId) }
    }
  } catch (_) {}
  return new NextResponse(PIXEL, { status: 200, headers: { 'Content-Type': 'image/gif', 'Cache-Control': 'no-store', 'Pragma': 'no-cache', 'Expires': '0' } })
}
