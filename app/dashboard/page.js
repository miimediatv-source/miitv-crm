'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import MiiTVCRM from '../../components/MiiTVCRM'

export default function DashboardPage() {
  const router  = useRouter()
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) router.replace('/login')
      else { setUser(session.user); setLoading(false) }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) router.replace('/login')
    })
    return () => subscription.unsubscribe()
  }, [])

  if (loading) return (
    <div style={{ minHeight:'100vh', background:'#07090f', display:'flex', alignItems:'center', justifyContent:'center', color:'#475569', fontFamily:'sans-serif', fontSize:14 }}>
      Loading…
    </div>
  )

  return <MiiTVCRM user={user} />
}
