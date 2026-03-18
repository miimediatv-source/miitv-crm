export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const { createClient } = await import('@supabase/supabase-js')

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hpqpzotvcdgpuqtxlczm.supabase.co'
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceKey) {
      return Response.json({ error: 'Server not configured' }, { status: 500 })
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { email } = await request.json()
    if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://miitv-crm.vercel.app'

    const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: appUrl + '/dashboard'
    })

    if (error) return Response.json({ error: error.message }, { status: 400 })
    return Response.json({ success: true, email: data.user?.email })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
