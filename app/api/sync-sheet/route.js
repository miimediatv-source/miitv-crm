export const dynamic = 'force-dynamic'
export async function POST() {
  try {
    const { createClient } = await import('@supabase/supabase-js')
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hpqpzotvcdgpuqtxlczm.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY)
    const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '1PyK_0gHfe59Q9V0c2gSxX6FDgDaN4hFOITgtXN1WNzw'
    const res = await fetch('https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&gid=1013400195')
    const text = await res.text()
    const json = JSON.parse(text.slice(47, -2))
    const subscribers = json.table.rows.map(r => { const raw = r.c[1]?.v ?? ''; const parts = raw.split('\n'); const expRaw = r.c[2]?.f ?? r.c[2]?.v ?? null; return { id: Number(r.c[0]?.v), username: parts[0] ?? '', email: parts[1] ?? '', expiration: expRaw ? new Date(expRaw).toISOString() : null, conns: Number(r.c[3]?.v ?? 1), synced_at: new Date().toISOString() } }).filter(s => s.id && s.username && s.expiration)
    const { error } = await supabase.from('subscribers').upsert(subscribers, { onConflict: 'id' })
    if (error) throw error
    const { data: existing } = await supabase.from('subscribers').select('id')
    const toDelete = (existing || []).map(r => r.id).filter(id => !subscribers.map(s => s.id).includes(id))
    if (toDelete.length > 0) await supabase.from('subscribers').delete().in('id', toDelete)
    return Response.json({ success: true, synced: subscribers.length, deleted: toDelete.length })
  } catch (err) { return Response.json({ success: false, error: err.message }, { status: 500 }) }
}
export async function GET() { return POST() }
