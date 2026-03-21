export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const email = body?.email
    if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

    const { createClient } = await import('@supabase/supabase-js')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'Server not configured' }, { status: 500 })

    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://hpqpzotvcdgpuqtxlczm.supabase.co',
      serviceKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://miitv-crm.vercel.app'

    const { data, error } = await admin.auth.admin.generateLink({
      type: 'invite',
      email,
      options: { redirectTo: appUrl + '/dashboard' }
    })

    if (error) return Response.json({ error: error.message }, { status: 400 })

    const inviteLink = data?.properties?.action_link
    if (!inviteLink) return Response.json({ error: 'Could not generate invite link' }, { status: 500 })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return Response.json({ error: 'RESEND_API_KEY not set' }, { status: 500 })

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + resendKey },
      body: JSON.stringify({
        from: 'MiiTV CRM <onboarding@resend.dev>',
        to: [email],
        subject: 'You have been invited to MiiTV CRM',
        html: '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#07090f;color:#dde4f0;border-radius:12px"><div style="font-weight:800;font-size:20px;margin-bottom:16px">MiiTV CRM</div><p style="color:#94a3b8;margin-bottom:24px">You have been invited to access the MiiTV CRM. Click the button below to set your password and sign in.</p><a href="' + inviteLink + '" style="display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#0ea5e9,#6366f1);color:#fff;text-decoration:none;border-radius:10px;font-weight:700;font-size:14px">Accept Invitation</a><p style="color:#475569;font-size:12px;margin-top:24px">If you did not expect this invitation you can ignore this email.</p></div>'
      })
    })

    const emailData = await emailRes.json()
    if (emailData.error) return Response.json({ error: emailData.error }, { status: 400 })

    return Response.json({ success: true, email })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
