export const dynamic = 'force-dynamic'

export async function POST(request) {
  try {
    const body = await request.json()
    const email = body?.email
    if (!email) return Response.json({ error: 'Email required' }, { status: 400 })

    const { createClient } = await import('@supabase/supabase-js')
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!serviceKey) return Response.json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' }, { status: 500 })

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

    if (error) return Response.json({ error: 'Supabase error: ' + error.message }, { status: 400 })

    const inviteLink = data?.properties?.action_link
    if (!inviteLink) return Response.json({ error: 'No invite link generated' }, { status: 500 })

    const resendKey = process.env.RESEND_API_KEY
    if (!resendKey) return Response.json({ error: 'RESEND_API_KEY missing' }, { status: 500 })

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + resendKey },
      body: JSON.stringify({
        from: 'MiiTV CRM <onboarding@resend.dev>',
        to: [email],
        subject: 'You have been invited to MiiTV CRM',
        html: '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px"><h2>MiiTV CRM Invitation</h2><p>You have been invited. Click below to set your password and sign in.</p><a href="' + inviteLink + '" style="display:inline-block;padding:12px 24px;background:#0ea5e9;color:#fff;text-decoration:none;border-radius:8px;font-weight:700">Accept Invitation</a></div>'
      })
    })

    const emailData = await emailRes.json()
    console.log('Resend response:', JSON.stringify(emailData))

    if (!emailRes.ok) {
      return Response.json({ error: 'Resend failed: ' + JSON.stringify(emailData) }, { status: 400 })
    }

    return Response.json({ success: true, email, resendId: emailData.id })
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 })
  }
}
