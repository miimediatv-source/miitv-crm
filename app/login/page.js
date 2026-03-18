'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'

// Create client inline to avoid SSR issues
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [magicSent, setMagicSent] = useState(false)
  const [mode, setMode]         = useState('password')

  async function handlePasswordLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError(error.message)
    else router.replace('/dashboard')
    setLoading(false)
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: (process.env.NEXT_PUBLIC_APP_URL || 'https://miitv-crm.vercel.app') + '/dashboard' }
      })
      if (error) setError(error.message)
      else setMagicSent(true)
    } catch(err) {
      setError(err.message || 'Failed to send magic link')
    }
    setLoading(false)
  }

  return (
    <div style={{ minHeight:'100vh', background:'#07090f', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:"'Sora',system-ui,sans-serif" }}>
      <style>{\`@import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&display=swap'); *{box-sizing:border-box;margin:0;padding:0}\`}</style>
      <div style={{ width:380, padding:36, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:20 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:28 }}>
          <div style={{ width:36,height:36,borderRadius:9,background:'linear-gradient(135deg,#0ea5e9,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,color:'#fff' }}>M</div>
          <div>
            <div style={{ fontWeight:800,fontSize:17,color:'#dde4f0',letterSpacing:'-.3px' }}>MiiTV CRM</div>
            <div style={{ fontSize:12,color:'#475569' }}>Sign in to your account</div>
          </div>
        </div>

        {magicSent ? (
          <div style={{ textAlign:'center',padding:'20px 0' }}>
            <div style={{ fontSize:32,marginBottom:12 }}>📧</div>
            <div style={{ color:'#34d399',fontWeight:700,marginBottom:8 }}>Magic link sent!</div>
            <div style={{ color:'#64748b',fontSize:13 }}>Check your email at <strong style={{color:'#94a3b8'}}>{email}</strong> and click the link to sign in.</div>
            <button onClick={()=>setMagicSent(false)} style={{ marginTop:16,background:'none',border:'none',color:'#60a5fa',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>← Try again</button>
          </div>
        ) : (
          <form onSubmit={mode === 'password' ? handlePasswordLogin : handleMagicLink}>
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block',fontSize:12,color:'#475569',fontWeight:700,marginBottom:6 }}>Email</label>
              <input
                type="email" required value={email} onChange={e=>setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:9,padding:'10px 13px',color:'#dde4f0',fontFamily:'inherit',fontSize:14,outline:'none' }}
              />
            </div>
            {mode === 'password' && (
              <div style={{ marginBottom:14 }}>
                <label style={{ display:'block',fontSize:12,color:'#475569',fontWeight:700,marginBottom:6 }}>Password</label>
                <input
                  type="password" required value={password} onChange={e=>setPassword(e.target.value)}
                  placeholder="••••••••"
                  style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:9,padding:'10px 13px',color:'#dde4f0',fontFamily:'inherit',fontSize:14,outline:'none' }}
                />
              </div>
            )}
            {error && <div style={{ color:'#f87171',fontSize:12,marginBottom:12,padding:'8px 12px',background:'rgba(248,113,113,.1)',borderRadius:8 }}>{error}</div>}
            <button type="submit" disabled={loading}
              style={{ width:'100%',padding:'11px',background:'linear-gradient(135deg,#0ea5e9,#6366f1)',color:'#fff',border:'none',borderRadius:10,fontFamily:'inherit',fontWeight:700,fontSize:14,cursor:'pointer',opacity:loading?.6:1 }}>
              {loading ? 'Sending…' : mode === 'password' ? 'Sign In' : 'Send Magic Link'}
            </button>
            <div style={{ textAlign:'center',marginTop:14 }}>
              <button type="button" onClick={()=>{ setMode(m=>m==='password'?'magic':'password'); setError('') }}
                style={{ background:'none',border:'none',color:'#60a5fa',fontSize:12,cursor:'pointer',fontFamily:'inherit' }}>
                {mode==='password' ? 'Use magic link instead →' : 'Use password instead →'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
