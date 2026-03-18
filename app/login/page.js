'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [mode, setMode] = useState('password')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace('/dashboard')
      else setChecking(false)
    })
  }, [])

  async function handlePasswordLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.replace('/dashboard')
  }

  async function handleMagicLink(e) {
    e.preventDefault()
    setLoading(true); setError(''); setSuccess('')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://miitv-crm.vercel.app'
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: appUrl + '/dashboard' } })
    if (error) setError(error.message)
    else setSuccess('Magic link sent to ' + email)
    setLoading(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    if (!email) { setError('Enter your email first'); return }
    setLoading(true); setError(''); setSuccess('')
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://miitv-crm.vercel.app'
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: appUrl + '/dashboard' })
    if (error) setError(error.message)
    else setSuccess('Password reset email sent to ' + email)
    setLoading(false)
  }

  const box = { width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:9, padding:'10px 13px', color:'#dde4f0', fontFamily:'inherit', fontSize:14, outline:'none' }
  const lnk = { background:'none', border:'none', color:'#60a5fa', fontSize:12, cursor:'pointer', fontFamily:'inherit', display:'block', marginTop:8 }

  if (checking) return null

  return (
    React.createElement('div', { style:{ minHeight:'100vh', background:'#07090f', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'system-ui,sans-serif' } },
      React.createElement('div', { style:{ width:380, padding:36, background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:20 } },
        React.createElement('div', { style:{ display:'flex', alignItems:'center', gap:10, marginBottom:28 } },
          React.createElement('div', { style:{ width:36,height:36,borderRadius:9,background:'linear-gradient(135deg,#0ea5e9,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:16,color:'#fff' } }, 'M'),
          React.createElement('div', null,
            React.createElement('div', { style:{ fontWeight:800,fontSize:17,color:'#dde4f0' } }, 'MiiTV CRM'),
            React.createElement('div', { style:{ fontSize:12,color:'#475569' } }, mode==='password'?'Sign in to your account':mode==='magic'?'Magic link':'Reset password')
          )
        ),
        success ? (
          React.createElement('div', { style:{ textAlign:'center', padding:'20px 0' } },
            React.createElement('div', { style:{ color:'#34d399', fontWeight:700, marginBottom:8, fontSize:15 } }, 'Email sent!'),
            React.createElement('div', { style:{ color:'#64748b', fontSize:13 } }, success),
            React.createElement('button', { onClick:()=>{ setSuccess(''); setMode('password') }, style:{ ...lnk, textAlign:'center', marginTop:16 } }, 'Back to sign in')
          )
        ) : (
          React.createElement('form', { onSubmit: mode==='password'?handlePasswordLogin:mode==='magic'?handleMagicLink:handleReset },
            React.createElement('div', { style:{ marginBottom:14 } },
              React.createElement('label', { style:{ display:'block', fontSize:12, color:'#475569', fontWeight:700, marginBottom:6 } }, 'Email'),
              React.createElement('input', { type:'email', required:true, value:email, onChange:e=>setEmail(e.target.value), placeholder:'you@example.com', style:box })
            ),
            mode==='password' && React.createElement('div', { style:{ marginBottom:14 } },
              React.createElement('label', { style:{ display:'block', fontSize:12, color:'#475569', fontWeight:700, marginBottom:6 } }, 'Password'),
              React.createElement('input', { type:'password', required:true, value:password, onChange:e=>setPassword(e.target.value), placeholder:'password', style:box })
            ),
            error && React.createElement('div', { style:{ color:'#f87171', fontSize:12, marginBottom:12, padding:'8px 12px', background:'rgba(248,113,113,.1)', borderRadius:8 } }, error),
            React.createElement('button', { type:'submit', disabled:loading, style:{ width:'100%', padding:'11px', background:'linear-gradient(135deg,#0ea5e9,#6366f1)', color:'#fff', border:'none', borderRadius:10, fontFamily:'inherit', fontWeight:700, fontSize:14, cursor:'pointer', opacity:loading?0.6:1 } },
              loading?'Please wait...':mode==='password'?'Sign In':mode==='magic'?'Send Magic Link':'Send Reset Link'
            ),
            React.createElement('div', { style:{ textAlign:'center', marginTop:14 } },
              mode!=='password' && React.createElement('button', { type:'button', onClick:()=>{setMode('password');setError('')}, style:lnk }, 'Sign in with password'),
              mode!=='magic' && React.createElement('button', { type:'button', onClick:()=>{setMode('magic');setError('')}, style:lnk }, 'Use magic link instead'),
              mode!=='reset' && React.createElement('button', { type:'button', onClick:()=>{setMode('reset');setError('')}, style:{...lnk,color:'#94a3b8'} }, 'Forgot password?')
            )
          )
        )
      )
    )
  )
}
