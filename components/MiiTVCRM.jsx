'use client'
import { useState, useMemo, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

function fmtDate(isoStr) {
  if (!isoStr) return ''
  const d = new Date(isoStr)
  if (isNaN(d)) return isoStr.slice(0,10)
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'2-digit', year:'numeric' })
}

function parseStatus(expStr) {
  const exp = new Date(expStr)
  const d   = Math.round((exp - new Date()) / 86400000)
  if (d < 0)   return 'Expired'
  if (d <= 30) return 'Expiring Soon'
  return 'Active'
}

function getDomain(email) {
  const at = email.indexOf('@')
  if (at < 0) return '?'
  return email.slice(at + 1).split('.')[0].toLowerCase()
}

function mkAvatar(u) { return u.replace(/[^a-zA-Z]/g,'').slice(0,2).toUpperCase()||'??' }

const STATUS_COLOR = {
  Active:          { bg:'#0c2218', text:'#34d399', border:'#14503a' },
  'Expiring Soon': { bg:'#271a07', text:'#f59e0b', border:'#7a4a10' },
  Expired:         { bg:'#270d0d', text:'#f87171', border:'#7a2020' },
}
const PALETTES = [
  ['#0d1f3c','#60a5fa'],['#1a0d3c','#a78bfa'],['#0c2218','#34d399'],
  ['#271a07','#f59e0b'],['#270d1a','#f472b6'],['#0d2929','#22d3ee'],
]
const COST_CATEGORIES = ['Hosting','Content','Marketing','Staff','Software','Other']
const PLAN_PRICES     = { monthly: 9.99, annual: 89.99 }

// ─── tiny shared UI components ───────────────────────────────────────────────
function Input({ label, ...props }) {
  return (
    <div style={{ marginBottom:12 }}>
      {label && <label style={{ display:'block', fontSize:11, color:'#475569', fontWeight:700, marginBottom:5 }}>{label}</label>}
      <input {...props}
        style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'9px 12px', color:'#dde4f0', fontFamily:'inherit', fontSize:13, outline:'none', ...props.style }} />
    </div>
  )
}
function Select({ label, children, ...props }) {
  return (
    <div style={{ marginBottom:12 }}>
      {label && <label style={{ display:'block', fontSize:11, color:'#475569', fontWeight:700, marginBottom:5 }}>{label}</label>}
      <select {...props}
        style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'9px 12px', color:'#dde4f0', fontFamily:'inherit', fontSize:13, outline:'none', ...props.style }}>
        {children}
      </select>
    </div>
  )
}
function Btn({ children, variant='primary', size='md', ...props }) {
  const bg = variant==='primary' ? 'linear-gradient(135deg,#0ea5e9,#6366f1)' : variant==='danger' ? 'rgba(248,113,113,.15)' : 'rgba(255,255,255,.06)'
  const col = variant==='primary' ? '#fff' : variant==='danger' ? '#f87171' : '#94a3b8'
  const pad = size==='sm' ? '5px 11px' : '9px 18px'
  return (
    <button {...props}
      style={{ cursor:'pointer', background:bg, color:col, border:'none', borderRadius:8, fontFamily:'inherit', fontWeight:600, fontSize:size==='sm'?12:13, padding:pad, transition:'all .15s', ...props.style }}
      onMouseEnter={e=>e.currentTarget.style.filter='brightness(1.15)'}
      onMouseLeave={e=>e.currentTarget.style.filter='none'}>
      {children}
    </button>
  )
}

// ─── MODAL ────────────────────────────────────────────────────────────────────
function Modal({ title, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.7)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)' }}>
      <div style={{ background:'#0d1321', border:'1px solid rgba(255,255,255,.1)', borderRadius:18, padding:28, width:480, maxHeight:'85vh', overflow:'auto' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
          <h3 style={{ fontSize:16, fontWeight:800 }}>{title}</h3>
          <Btn variant='ghost' size='sm' onClick={onClose}>✕</Btn>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── CHANGE PASSWORD ──────────────────────────────────────────────────────────
function ChangePasswordForm() {
  const [pw, setPw]       = useState('')
  const [pw2, setPw2]     = useState('')
  const [msg, setMsg]     = useState('')
  const [saving, setSaving] = useState(false)

  async function handle() {
    if (pw !== pw2) { setMsg('Passwords do not match'); return }
    if (pw.length < 6) { setMsg('Password must be at least 6 characters'); return }
    setSaving(true); setMsg('')
    const { error } = await supabase.auth.updateUser({ password: pw })
    setMsg(error ? `✗ ${error.message}` : '✓ Password updated successfully')
    if (!error) { setPw(''); setPw2('') }
    setSaving(false)
  }

  return (
    <>
      <Input label="New Password" type="password" placeholder="••••••••" value={pw} onChange={e=>setPw(e.target.value)} />
      <Input label="Confirm Password" type="password" placeholder="••••••••" value={pw2} onChange={e=>setPw2(e.target.value)} />
      {msg && <div style={{ fontSize:12,color:msg.startsWith('✓')?'#34d399':'#f87171',marginBottom:10 }}>{msg}</div>}
      <Btn onClick={handle} disabled={saving} style={{ width:'100%' }}>{saving?'Updating…':'Update Password'}</Btn>
    </>
  )
}

// ─── INVITE USER ──────────────────────────────────────────────────────────────
function InviteUserForm() {
  const [email, setEmail] = useState('')
  const [msg, setMsg]     = useState('')
  const [saving, setSaving] = useState(false)

  async function handle() {
    if (!email) return
    setSaving(true); setMsg('')
    try {
      const res = await fetch('/api/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (data.error) {
        setMsg('✗ ' + data.error)
      } else {
        setMsg('✓ Invite sent to ' + email)
        setEmail('')
      }
    } catch(err) {
      setMsg('✗ ' + err.message)
    }
    setSaving(false)
  }

  return (
    <>
      <Input label="Email address" type="email" placeholder="colleague@example.com" value={email} onChange={e=>setEmail(e.target.value)} />
      {msg && <div style={{ fontSize:12,color:msg.startsWith('✓')?'#34d399':'#f87171',marginBottom:10 }}>{msg}</div>}
      <Btn onClick={handle} disabled={saving} style={{ width:'100%' }}>{saving?'Sending…':'Send Invite'}</Btn>
      <p style={{ fontSize:11,color:'#334155',marginTop:10 }}>They will receive an invite email with a link to set their password and access the CRM.</p>
    </>
  )
}

// ─── EMAIL TEMPLATES ──────────────────────────────────────────────────────────
const DEFAULT_TEMPLATES = [
  {
    id: 'expiring7',
    label: '⚠️ Expiring Soon',
    subject: 'Your MiiTV subscription is expiring soon',
    body: `Hi [Name],

Just a quick heads-up that your MiiTV subscription is due to expire on [date] — that's in [days] days.

To avoid any interruption to your service, please renew before this date.

If you have any questions or need help renewing, just reply to this email.

Thanks,
The MiiTV Team`,
    builtIn: true,
  },
  {
    id: 'expired',
    label: '❌ Subscription Expired',
    subject: 'Your MiiTV subscription has expired',
    body: `Hi [Name],

Your MiiTV subscription expired on [date] ([days] days ago).

We'd love to have you back! Renewing is quick and easy — just get in touch and we'll get you set back up.

Hope to hear from you soon,
The MiiTV Team`,
    builtIn: true,
  },
  {
    id: 'general',
    label: '📢 Renewal Reminder',
    subject: 'Time to renew your MiiTV subscription',
    body: `Hi [Name],

Your MiiTV subscription is coming up for renewal on [date] — [days] days from now.

As a valued subscriber, we wanted to make sure you don't miss out on uninterrupted access to all your favourite content.

Please get in touch to renew — we're happy to help.

Thanks,
The MiiTV Team`,
    builtIn: true,
  },
  {
    id: 'important_notification',
    label: '🔔 Important Notification',
    subject: 'Important notice from MiiTV',
    body: `Hi [Name],

We wanted to reach out with an important update regarding your MiiTV account.

[Add your message here]

If you have any questions or concerns, please don't hesitate to get in touch — we're happy to help.

Kind regards,
The MiiTV Team`,
    builtIn: true,
  },
  {
    id: 'app_update',
    label: '📱 App Update',
    subject: 'MiiTV app update available',
    body: `Hi [Name],

Great news — we've just released an update to the MiiTV app with improvements and new features.

What's new:
• [Feature or fix 1]
• [Feature or fix 2]
• [Feature or fix 3]

To update, simply visit your device's app store and install the latest version. If you have any trouble updating, feel free to reply to this email and we'll help you out.

Thanks for being a MiiTV subscriber,
The MiiTV Team`,
    builtIn: true,
  },
  {
    id: 'maintenance',
    label: '🔧 Maintenance Notice',
    subject: 'Scheduled maintenance — MiiTV service',
    body: `Hi [Name],

We wanted to let you know that MiiTV will be undergoing scheduled maintenance on [date].

During this time, the service may be temporarily unavailable. We expect the maintenance to be completed as quickly as possible and apologise for any inconvenience this may cause.

No action is required on your part. Your subscription will not be affected.

Thank you for your patience,
The MiiTV Team`,
    builtIn: true,
  },
  {
    id: 'known_issue',
    label: '⚠️ Known Issue',
    subject: 'Service update — known issue',
    body: `Hi [Name],

We're aware of an issue currently affecting some MiiTV subscribers and wanted to keep you informed.

Issue: [Brief description of the issue]
Status: We are actively investigating and working on a fix.
Expected resolution: [Timeframe if known]

We sincerely apologise for any disruption this may have caused. Our team is working hard to resolve this as quickly as possible.

We'll send a follow-up email once the issue has been resolved. If you have any urgent queries, please reply to this email.

Thank you for your understanding,
The MiiTV Team`,
    builtIn: true,
  },
  {
    id: 'special_offer',
    label: '🎁 Special Offer',
    subject: 'Exclusive offer just for you — MiiTV',
    body: `Hi [Name],

As a valued MiiTV subscriber, we have a special offer we'd love to share with you.

[Describe the offer here — e.g. 20% off renewal, free extra month, bundle deal]

This offer is available for a limited time, so don't miss out!

To take advantage of this offer, simply reply to this email or get in touch and we'll sort everything for you.

Thanks for your continued support,
The MiiTV Team`,
    builtIn: true,
  },
  {
    id: 'firestick_incompatible',
    label: '⚠️ Firestick Incompatible',
    subject: 'Important: Your Firestick Device May Not Be Compatible with MiiTV',
    body: `Hi [Name],

We wanted to reach out with some important information regarding MiiTV compatibility with Amazon Firestick devices.

⚠️ COMPATIBILITY NOTICE — FIRESTICK SELECT MODELS

Unfortunately, certain Amazon Firestick models do NOT support sideloading of third-party apps, which means MiiTV cannot be installed or run on these devices.

Affected devices include:
• Amazon Firestick Lite
• Amazon Firestick (certain 2nd & 3rd generation models)
• Any Firestick running a restricted firmware version

What does this mean for you?
Sideloading allows users to install apps that are not available in the official Amazon Appstore. On restricted Firestick models, Amazon has disabled this functionality, preventing MiiTV from being installed.

What are your options?
✅ Android TV / Google TV devices — fully supported
✅ Android smartphones & tablets — fully supported
✅ Amazon Firestick 4K / 4K Max — sideloading supported (check your settings)
✅ NVIDIA Shield, Chromecast with Google TV — fully supported

How to check if your Firestick supports sideloading:
1. Go to Settings → My Fire TV → Developer Options
2. Look for "Apps from Unknown Sources" or "Install Unknown Apps"
3. If this option is present, your device is compatible
4. If this option is missing, your device does not support sideloading

We apologise for any inconvenience this may cause. If you have any questions or would like to discuss alternative device options, please don't hesitate to reply to this email.

Kind regards,
The MiiTV Team`,
    builtIn: true,
  },
]

function EmailTemplates({ urgent, subscribers = [], onSend }) {
  const storageKey = 'miitv_email_templates'

  // Load templates from localStorage, falling back to defaults
  const [templates, setTemplates] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKey)
      if (!saved) return DEFAULT_TEMPLATES
      const parsed = JSON.parse(saved)
      // Auto-merge: add any new built-in templates the user doesn't have yet
      const existingIds = new Set(parsed.map(t => t.id))
      const newBuiltIns = DEFAULT_TEMPLATES.filter(t => !existingIds.has(t.id))
      if (newBuiltIns.length > 0) {
        const merged = [...parsed, ...newBuiltIns]
        localStorage.setItem(storageKey, JSON.stringify(merged))
        return merged
      }
      return parsed
    } catch { return DEFAULT_TEMPLATES }
  })

  const [selected, setSelected]   = useState(null)
  const [editing, setEditing]     = useState(null)   // template being edited/created
  const [copied, setCopied]       = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [sendTo, setSendTo]           = useState({})
  const [sendToSearch, setSendToSearch] = useState('')

  // Empty form for a new template
  const blankForm = { id: `custom_${Date.now()}`, label: '', subject: '', body: '', builtIn: false }

  function save(list) {
    setTemplates(list)
    localStorage.setItem(storageKey, JSON.stringify(list))
  }

  function saveEdit() {
    if (!editing.label || !editing.subject || !editing.body) return
    const exists = templates.find(t => t.id === editing.id)
    const updated = exists
      ? templates.map(t => t.id === editing.id ? editing : t)
      : [...templates, { ...editing, id: `custom_${Date.now()}` }]
    save(updated)
    setSelected(editing)
    setEditing(null)
  }

  function deleteTemplate(id) {
    const updated = templates.filter(t => t.id !== id)
    save(updated)
    if (selected?.id === id) setSelected(null)
    setConfirmDelete(null)
  }

  function resetDefaults() {
    save(DEFAULT_TEMPLATES)
    setSelected(null)
    setEditing(null)
  }

  // Replace [Name], [date] and [days] with real values
  function renderBody(body, sub) {
    const s = sub || urgent?.[0]
    const daysLeft = s?.daysLeft ?? s?.expiration
      ? Math.round((new Date(s.expiration) - new Date()) / 86400000)
      : null
    const daysStr = daysLeft === null ? '[days]'
      : daysLeft < 0 ? `${Math.abs(daysLeft)}`
      : `${daysLeft}`
    return body
      .replace(/\[Name\]/g, s?.username || '[Name]')
      .replace(/\[date\]/g, fmtDate(s?.expiration) || '[date]')
      .replace(/\[days\]/g, daysStr)
  }

  function copy(t) {
    navigator.clipboard.writeText(`Subject: ${t.subject}\n\n${renderBody(t.body)}`)
    setCopied(t.id)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div>
      {/* ── Template tabs row ── */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        {templates.map(t => (
          <button key={t.id}
            style={{ cursor:'pointer', padding:'7px 14px', borderRadius:8, fontFamily:'inherit', fontSize:12, fontWeight:600, border:'1px solid',
              background: selected?.id===t.id ? 'rgba(96,165,250,.15)' : 'rgba(255,255,255,.04)',
              color: selected?.id===t.id ? '#60a5fa' : '#64748b',
              borderColor: selected?.id===t.id ? 'rgba(96,165,250,.3)' : 'rgba(255,255,255,.08)',
            }}
            onClick={() => { setSelected(selected?.id===t.id ? null : t); setEditing(null); setSendTo({}); setSendToSearch('') }}>
            {t.label || 'Untitled'}
          </button>
        ))}
        <button
          style={{ cursor:'pointer', padding:'7px 14px', borderRadius:8, fontFamily:'inherit', fontSize:12, fontWeight:600,
            border:'1px dashed rgba(96,165,250,.3)', background:'rgba(96,165,250,.05)', color:'#60a5fa' }}
          onClick={() => { setEditing({ ...blankForm, id:`custom_${Date.now()}` }); setSelected(null) }}>
          + New Template
        </button>
      </div>

      {/* ── Edit / Create form ── */}
      {editing && (
        <div style={{ background:'rgba(96,165,250,.04)', border:'1px solid rgba(96,165,250,.15)', borderRadius:12, padding:18, marginBottom:16 }}>
          <h4 style={{ fontSize:13, fontWeight:700, color:'#60a5fa', marginBottom:14 }}>
            {editing.builtIn ? '✏️ Edit Template' : '✨ New Template'}
          </h4>
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:11, color:'#475569', fontWeight:700, marginBottom:5 }}>Template Name</label>
            <input value={editing.label} onChange={e=>setEditing(v=>({...v,label:e.target.value}))} placeholder="e.g. 🎉 Welcome Back"
              style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'9px 12px', color:'#dde4f0', fontFamily:'inherit', fontSize:13, outline:'none' }} />
          </div>
          <div style={{ marginBottom:10 }}>
            <label style={{ display:'block', fontSize:11, color:'#475569', fontWeight:700, marginBottom:5 }}>Subject Line</label>
            <input value={editing.subject} onChange={e=>setEditing(v=>({...v,subject:e.target.value}))} placeholder="Email subject..."
              style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'9px 12px', color:'#dde4f0', fontFamily:'inherit', fontSize:13, outline:'none' }} />
          </div>
          <div style={{ marginBottom:14 }}>
            <label style={{ display:'block', fontSize:11, color:'#475569', fontWeight:700, marginBottom:5 }}>
              Body <span style={{ color:'#334155', fontWeight:400 }}>— use [Name], [date] and [days] as placeholders</span>
            </label>
            <textarea value={editing.body} onChange={e=>setEditing(v=>({...v,body:e.target.value}))} rows={10}
              style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'9px 12px', color:'#dde4f0', fontFamily:'inherit', fontSize:13, outline:'none', resize:'vertical' }} />
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant='ghost' onClick={()=>setEditing(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={saveEdit} disabled={!editing.label||!editing.subject||!editing.body} style={{ flex:2 }}>
              {templates.find(t=>t.id===editing.id) ? 'Save Changes' : 'Create Template'}
            </Btn>
          </div>
        </div>
      )}

      {/* ── Selected template preview ── */}
      {selected && !editing && (
        <div style={{ background:'rgba(255,255,255,.02)', border:'1px solid rgba(255,255,255,.07)', borderRadius:10, padding:16 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12, gap:10 }}>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'#475569', fontWeight:700, marginBottom:3 }}>Subject</div>
              <div style={{ fontSize:13, color:'#dde4f0', fontWeight:600 }}>{selected.subject}</div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <Btn size='sm' variant='ghost' onClick={()=>setEditing({...selected})}>✏️ Edit</Btn>
              {!selected.builtIn && (
                <Btn size='sm' variant='danger' onClick={()=>setConfirmDelete(selected.id)}>🗑️</Btn>
              )}
              <Btn size='sm' onClick={()=>copy(selected)}>
                {copied===selected.id ? '✓ Copied!' : '📋 Copy'}
              </Btn>
            </div>
          </div>

          {/* Send section — individual + bulk group */}
          {onSend && (() => {
            const tmplGroups = [
              { id:'all',        label:'👥 All subscribers',     color:'#60a5fa', subs: subscribers },
              { id:'active',     label:'✅ Active',              color:'#34d399', subs: subscribers.filter(s=>s.status==='Active') },
              { id:'expiring14', label:'⚠️ Expiring ≤14d',      color:'#f59e0b', subs: subscribers.filter(s=>s.daysLeft>=0&&s.daysLeft<=14) },
              { id:'expiring30', label:'🟡 Expiring ≤30d',      color:'#f59e0b', subs: subscribers.filter(s=>s.daysLeft>=0&&s.daysLeft<=30) },
              { id:'expired',    label:'❌ Expired',             color:'#f87171', subs: subscribers.filter(s=>s.status==='Expired') },
              { id:'individual', label:'👤 Individual',          color:'#a78bfa', subs: [] },
            ]
            const selGroup = tmplGroups.find(g=>g.id===sendTo?.groupId)
            const isIndividual = !sendTo?.groupId || sendTo.groupId==='individual'
            return (
              <div style={{ marginBottom:14, background:'rgba(56,189,248,.03)', border:'1px solid rgba(56,189,248,.1)', borderRadius:10, overflow:'hidden' }}>
                {/* Header */}
                <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(56,189,248,.08)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:12, color:'#38bdf8', fontWeight:700 }}>✉️ Send This Template</span>
                  {sendTo?.groupId && !isIndividual && (
                    <span style={{ fontSize:11, color:'#475569' }}>
                      <strong style={{color:'#dde4f0'}}>{selGroup?.subs.length||0}</strong> recipient{selGroup?.subs.length!==1?'s':''}
                    </span>
                  )}
                </div>

                {/* Group selector grid */}
                <div style={{ padding:'12px 14px', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                  <div style={{ fontSize:11, color:'#475569', fontWeight:700, marginBottom:8 }}>Send to Group</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
                    {tmplGroups.map(g => (
                      <button key={g.id}
                        onClick={() => setSendTo(v => ({ ...v, groupId: g.id, email:undefined, username:undefined }))}
                        style={{ cursor:'pointer', padding:'8px 6px', borderRadius:8, fontFamily:'inherit', fontSize:11, fontWeight:600,
                          textAlign:'center', border:'1px solid',
                          background: sendTo?.groupId===g.id ? `${g.color}18` : 'rgba(255,255,255,.03)',
                          borderColor: sendTo?.groupId===g.id ? g.color+'55' : 'rgba(255,255,255,.07)',
                          color: sendTo?.groupId===g.id ? g.color : '#64748b' }}>
                        <div>{g.label}</div>
                        {g.id!=='individual' && <div style={{ fontSize:10, opacity:.65, marginTop:2 }}>{g.subs.length} subs</div>}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Individual picker — shown when Individual selected */}
                {isIndividual && sendTo?.groupId === 'individual' && (
                  <div style={{ padding:'10px 14px', borderBottom:'1px solid rgba(255,255,255,.05)' }}>
                    <div style={{ fontSize:11, color:'#475569', fontWeight:700, marginBottom:7 }}>Subscriber</div>
                    <input
                      list="tmpl-sub-list"
                      placeholder="Search by name or email…"
                      value={sendTo?.email || sendToSearch || ''}
                      onChange={e => {
                        setSendToSearch(e.target.value)
                        const match = subscribers.find(s =>
                          s.email?.toLowerCase() === e.target.value.toLowerCase() ||
                          s.username?.toLowerCase() === e.target.value.toLowerCase()
                        )
                        setSendTo(v => match ? { ...v, email: match.email, username: match.username, sub: match } : { ...v, email: undefined, username: undefined, sub: undefined })
                      }}
                      style={{ width:'100%', background:'rgba(255,255,255,.05)', border:'1px solid rgba(255,255,255,.1)', borderRadius:8, padding:'8px 11px', color:'#dde4f0', fontFamily:'inherit', fontSize:13, outline:'none' }}
                    />
                    <datalist id="tmpl-sub-list">
                      {subscribers.map(s => <option key={s.id} value={s.email} label={s.username} />)}
                    </datalist>
                    {sendTo?.sub && (
                      <div style={{ marginTop:6, fontSize:12, color:'#a78bfa' }}>
                        ✓ <strong>{sendTo.sub.username}</strong> · {sendTo.sub.email}
                        {sendTo.sub.expiration && <span style={{ color:'#475569', marginLeft:6 }}>expires {fmtDate(sendTo.sub.expiration)}</span>}
                      </div>
                    )}
                  </div>
                )}

                {/* Send button */}
                <div style={{ padding:'10px 14px' }}>
                  {!isIndividual ? (
                    <Btn
                      disabled={!sendTo?.groupId || !selGroup || selGroup.subs.length===0}
                      onClick={() => onSend({
                        emailSubject: selected.subject,
                        emailBody: selected.body,
                        emailTemplateId: selected.id,
                        sendMode: 'bulk',
                        bulkGroup: sendTo.groupId,
                      }, true)}
                      style={{ width:'100%', background:'rgba(167,139,250,.15)', color:'#a78bfa', border:'1px solid rgba(167,139,250,.3)', justifyContent:'center' }}>
                      📨 Send to {selGroup?.subs.length||0} Subscriber{selGroup?.subs.length!==1?'s':''}
                    </Btn>
                  ) : (
                    <Btn
                      disabled={!sendTo?.sub}
                      onClick={() => onSend({
                        emailTo: sendTo.sub.email,
                        emailToName: sendTo.sub.username,
                        emailSubject: selected.subject,
                        emailBody: renderBody(selected.body, sendTo.sub),
                        emailTemplateId: selected.id,
                        sendMode: 'individual',
                      }, false)}
                      style={{ width:'100%', background:'rgba(56,189,248,.15)', color:'#38bdf8', border:'1px solid rgba(56,189,248,.3)', justifyContent:'center' }}>
                      ✉️ {sendTo?.groupId ? 'Send to Subscriber' : 'Select a group above'}
                    </Btn>
                  )}
                </div>
              </div>
            )
          })()}

          <div style={{ fontSize:11, color:'#475569', fontWeight:700, marginBottom:6 }}>
            Body Preview {sendTo ? <span style={{ color:'#38bdf8', fontWeight:400 }}>(personalised for {sendTo.username})</span> : urgent?.length>0 ? <span style={{ color:'#334155', fontWeight:400 }}>(with first expiring subscriber)</span> : ''}
          </div>
          <pre style={{ fontSize:12, color:'#94a3b8', lineHeight:1.7, whiteSpace:'pre-wrap', fontFamily:"'Sora',sans-serif", background:'rgba(0,0,0,.2)', padding:12, borderRadius:8 }}>
            {renderBody(selected.body, sendTo)}
          </pre>
          {urgent?.length > 0 && !sendTo && (
            <div style={{ marginTop:12, fontSize:12, color:'#475569' }}>
              💡 <strong style={{color:'#dde4f0'}}>{urgent.length}</strong> subscriber{urgent.length!==1?'s':''} expiring within 14 days — select one above to send directly.
            </div>
          )}
        </div>
      )}

      {/* ── Delete confirmation ── */}
      {confirmDelete && (
        <div style={{ marginTop:12, padding:'12px 14px', background:'rgba(248,113,113,.07)', border:'1px solid rgba(248,113,113,.2)', borderRadius:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span style={{ fontSize:13, color:'#f87171' }}>Delete this template? This cannot be undone.</span>
          <div style={{ display:'flex', gap:8 }}>
            <Btn variant='ghost' size='sm' onClick={()=>setConfirmDelete(null)}>Cancel</Btn>
            <Btn variant='danger' size='sm' onClick={()=>deleteTemplate(confirmDelete)}>Delete</Btn>
          </div>
        </div>
      )}

      {/* ── Footer ── */}
      <div style={{ marginTop:16, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'#334155' }}>{templates.length} template{templates.length!==1?'s':''} · saved in browser</span>
        <button onClick={resetDefaults}
          style={{ background:'none', border:'none', color:'#334155', fontSize:11, cursor:'pointer', fontFamily:'inherit' }}>
          Reset to defaults
        </button>
      </div>
    </div>
  )
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function MiiTVCRM({ user }) {
  const [view, setView]             = useState('subscribers')
  const [emailTracking, setEmailTracking] = useState({}) // emailId -> { open_count, opened_at, last_opened }
  const [modalTemplates, setModalTemplates] = useState([])
  const [referrals, setReferrals]           = useState([])
  // Vercel deployment URL — tracking pixel must point here, not window.location.origin
  const API_BASE = process.env.NEXT_PUBLIC_APP_URL || 'https://miitv-crm.vercel.app'

  const DEFAULT_LOGO = 'data:image/png;base64,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'
  const [company, setCompany] = useState(() => {
    try {
      const saved = localStorage.getItem('miitv_company_profile')
      const defaults = { name: 'MiiTV', tagline: 'CRM', logo: DEFAULT_LOGO, email: '', phone: '', website: '', address: '', emailSignature: 'The MiiTV Team' }
      return saved ? { ...defaults, ...JSON.parse(saved) } : defaults
    } catch {
      return { name: 'MiiTV', tagline: 'CRM', logo: DEFAULT_LOGO, email: '', phone: '', website: '', address: '', emailSignature: 'The MiiTV Team' }
    }
  })

  function saveCompany(data) {
    setCompany(data)
    localStorage.setItem('miitv_company_profile', JSON.stringify(data))
  }

  const [emailLog, setEmailLog]     = useState(() => {
    try { return JSON.parse(localStorage.getItem('miitv_email_log') || '[]') } catch { return [] }
  })
  const [subscribers, setSubscribers] = useState([])
  const [costs, setCosts]           = useState([])
  const [revenue, setRevenue]       = useState([])
  const [loading, setLoading]       = useState(true)
  const [syncing, setSyncing]       = useState(false)
  const [syncMsg, setSyncMsg]       = useState('')
  const [selected, setSelected]     = useState(null)
  const [search, setSearch]         = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [connsFilter, setConnsFilter]   = useState('All')
  const [sortBy, setSortBy]         = useState('id')
  const [statCard, setStatCard]       = useState(null) // active stat card filter
  const [userMenu, setUserMenu]       = useState(false) // topbar user dropdown
  const [finSort, setFinSort]         = useState({ col:'date', dir:'desc' }) // financials sort
  const [selectedSubs, setSelectedSubs] = useState([])  // hand-picked recipients for multi-select send
  const [subPickSearch, setSubPickSearch] = useState('')
  const [sortDir, setSortDir]       = useState('desc')
  const [page, setPage]             = useState(0)
  const [modal, setModal]           = useState(null) // 'add-cost' | 'add-revenue' | 'add-note'
  const [selectedMonth, setSelectedMonth] = useState(null)
  const [form, setForm]             = useState({})
  const [saving, setSaving]         = useState(false)
  const PAGE_SIZE = 25

  // ── Load data ────────────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true)
    const [{ data: subs }, { data: costsData }, { data: revData }] = await Promise.all([
      supabase.from('subscribers').select('*').order('id', { ascending: false }),
      supabase.from('costs').select('*').order('date', { ascending: false }),
      supabase.from('revenue').select('*').order('date', { ascending: false }),
    ])
    setSubscribers(subs || [])
    setCosts(costsData || [])
    setRevenue(revData || [])
    // Load referrals
    const { data: refData } = await supabase.from('referrals').select('*').order('created_at', { ascending: false })
    setReferrals(refData || [])
    setLoading(false)
  }, [])

  useEffect(() => { loadAll() }, [loadAll])

  // ── Load email open tracking from Supabase ───────────────────────────────────
  const loadTracking = useCallback(async (log) => {
    if (!log || log.length === 0) return
    const ids = log.map(e => String(e.id))
    const { data } = await supabase
      .from('email_tracking')
      .select('email_id, open_count, opened_at, last_opened')
      .in('email_id', ids)
    if (data) {
      const map = {}
      data.forEach(row => { map[row.email_id] = row })
      setEmailTracking(prev => ({ ...prev, ...map }))
    }
  }, [supabase])

  // ── Load saved email log tracking on mount ────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('miitv_email_log')
      if (saved) loadTracking(JSON.parse(saved))
    } catch {}
  }, [loadTracking])

  // ── Load email templates into state when compose modal opens ──────────────────
  function loadModalTemplates() {
    try {
      const saved = localStorage.getItem('miitv_email_templates')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Merge with defaults so built-ins are always available
        const existingIds = new Set(parsed.map(t => t.id))
        const missing = DEFAULT_TEMPLATES.filter(t => !existingIds.has(t.id))
        setModalTemplates(missing.length > 0 ? [...parsed, ...missing] : parsed)
      } else {
        // Nothing saved yet — use all defaults
        setModalTemplates(DEFAULT_TEMPLATES)
      }
    } catch { setModalTemplates(DEFAULT_TEMPLATES) }
  }

  // ── Enrich subscribers with computed fields ──────────────────────────────────
  const contacts = useMemo(() => subscribers.map((s, i) => ({
    ...s,
    status:   parseStatus(s.expiration),
    daysLeft: Math.round((new Date(s.expiration) - new Date()) / 86400000),
    domain:   getDomain(s.email),
    avatar:   mkAvatar(s.username),
    pal:      i % PALETTES.length,
    cost:     Number(s.cost || 0),
    profit:   Number(s.profit || 0),
  })), [subscribers])

  // ── Stats ────────────────────────────────────────────────────────────────────
  const total    = contacts.length
  const active   = contacts.filter(c => c.status === 'Active').length
  const expiring = contacts.filter(c => c.status === 'Expiring Soon').length
  const expired  = contacts.filter(c => c.status === 'Expired').length
  const multi    = contacts.filter(c => c.conns > 1).length
  const urgent   = contacts.filter(c => c.daysLeft >= 0 && c.daysLeft <= 14)

  // Manual entries
  const manualRevenue = revenue.reduce((s, r) => s + Number(r.amount), 0)
  const manualCosts   = costs.reduce((s, c) => s + Number(c.amount), 0)
  // Subscriber totals from sheet
  const subRevenue    = contacts.reduce((s, c) => s + Number(c.profit || 0), 0)
  const subCosts      = contacts.reduce((s, c) => s + Number(c.cost || 0), 0)
  // Combined
  const totalRevenue  = manualRevenue + subRevenue
  const totalCosts    = manualCosts + subCosts
  const profit        = totalRevenue - totalCosts
  const thisMonthKey   = new Date().toISOString().slice(0,7)
  const manualThisRev  = revenue.filter(r => r.date?.slice(0,7) === thisMonthKey).reduce((s,r)=>s+Number(r.amount),0)
  const manualThisCost = costs.filter(c => c.date?.slice(0,7) === thisMonthKey).reduce((s,c)=>s+Number(c.amount),0)
  // Subscribers expiring this month
  const subThisMonth   = contacts.filter(c => c.expiration?.slice(0,7) === thisMonthKey)
  const subThisRev     = subThisMonth.reduce((s,c) => s + Number(c.profit || 0), 0)
  const subThisCost    = subThisMonth.reduce((s,c) => s + Number(c.cost || 0), 0)
  const thisMonthRev   = manualThisRev + subThisRev
  const thisMonthCost  = manualThisCost + subThisCost

  // ── Filtered / sorted subscribers ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let r = contacts
    if (search) {
      const q = search.toLowerCase()
      r = r.filter(c => c.username.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || String(c.id).includes(q))
    }
    if (statusFilter !== 'All') r = r.filter(c => c.status === statusFilter)
    if (connsFilter === 'Multi')  r = r.filter(c => c.conns > 1)
    if (connsFilter === 'Single') r = r.filter(c => c.conns === 1)
    return [...r].sort((a, b) => {
      let av = a[sortBy], bv = b[sortBy]
      if (sortBy === 'expiration') { av = new Date(av); bv = new Date(bv) }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [contacts, search, statusFilter, connsFilter, sortBy, sortDir])

  const pageCount = Math.ceil(filtered.length / PAGE_SIZE)
  const pageData  = filtered.slice(page * PAGE_SIZE, (page+1) * PAGE_SIZE)

  function toggleSort(col) {
    if (sortBy === col) setSortDir(d => d==='asc'?'desc':'asc')
    else { setSortBy(col); setSortDir('asc') }
    setPage(0)
  }

  // ── Google Sheet sync ─────────────────────────────────────────────────────────
  async function syncSheet() {
    setSyncing(true); setSyncMsg('')
    try {
      // Fetch directly from Google Sheet (works in browser + Android app)
      const SHEET_ID = process.env.NEXT_PUBLIC_GOOGLE_SHEET_ID || '1PyK_0gHfe59Q9V0c2gSxX6FDgDaN4hFOITgtXN1WNzw'
      const url = 'https://docs.google.com/spreadsheets/d/' + SHEET_ID + '/gviz/tq?tqx=out:json&gid=' + (process.env.NEXT_PUBLIC_GOOGLE_SHEET_GID || '1013400195')
      const res = await fetch(url)
      const text = await res.text()
      const json = JSON.parse(text.slice(47, -2))
      const rows = json.table.rows
      const subs = rows.map(r => {
        const raw = r.c[1]?.v ?? ''
        const parts = raw.split('\n')
        const expRaw = r.c[2]?.f ?? r.c[2]?.v ?? null
        return {
          id: Number(r.c[0]?.v),
          username: parts[0] ?? '',
          email: parts[1] ?? '',
          expiration: expRaw ? new Date(expRaw).toISOString() : null,
          conns: Number(r.c[3]?.v ?? 1),
          cost: Number(r.c[4]?.v ?? 0),
          profit: Number(r.c[5]?.v ?? 0),
          synced_at: new Date().toISOString(),
        }
      }).filter(s => s.id && s.username && s.expiration)
      // Upsert all subscribers from sheet
      const { error } = await supabase.from('subscribers').upsert(subs, { onConflict: 'id' })
      if (error) throw error

      // Delete any subscribers in Supabase that are no longer in the sheet
      const sheetIds = subs.map(s => s.id)
      const { data: existingData } = await supabase.from('subscribers').select('id')
      const toDelete = (existingData || []).map(r => r.id).filter(id => !sheetIds.includes(id))
      if (toDelete.length > 0) {
        await supabase.from('subscribers').delete().in('id', toDelete)
        setSyncMsg('✓ Synced ' + subs.length + ' subscribers · removed ' + toDelete.length + ' deleted')
      } else {
        setSyncMsg('✓ Synced ' + subs.length + ' subscribers')
      }
      await loadAll()
    } catch(err) { setSyncMsg('✗ ' + err.message) }
    setSyncing(false)
    setTimeout(() => setSyncMsg(''), 4000)
  }

  // ── Save cost ─────────────────────────────────────────────────────────────────
  async function saveCost() {
    if (!form.amount || !form.category || !form.date) return
    setSaving(true)
    const { error } = await supabase.from('costs').insert({
      category: form.category, amount: Number(form.amount),
      description: form.description || '', date: form.date,
    })
    if (!error) { await loadAll(); setModal(null); setForm({}) }
    setSaving(false)
  }

  // ── Save revenue ──────────────────────────────────────────────────────────────
  async function saveRevenue() {
    if (!form.amount || !form.date) return
    setSaving(true)
    const { error } = await supabase.from('revenue').insert({
      subscriber_id: form.subscriber_id ? Number(form.subscriber_id) : null,
      amount: Number(form.amount), plan: form.plan || 'monthly',
      date: form.date, notes: form.notes || '',
    })
    if (!error) { await loadAll(); setModal(null); setForm({}) }
    setSaving(false)
  }

  // ── Update cost ───────────────────────────────────────────────────────────────
  async function updateCost() {
    if (!form.amount || !form.category || !form.date) return
    setSaving(true)
    const { error } = await supabase.from('costs').update({
      category: form.category, amount: Number(form.amount),
      description: form.description || '', date: form.date,
    }).eq('id', form.id)
    if (!error) { await loadAll(); setModal(null); setForm({}) }
    setSaving(false)
  }

  // ── Delete cost ───────────────────────────────────────────────────────────────
  async function deleteCost(id) {
    const { error } = await supabase.from('costs').delete().eq('id', id)
    if (!error) { await loadAll(); setModal(null); setForm({}) }
  }

  // ── Update revenue ────────────────────────────────────────────────────────────
  async function updateRevenue() {
    if (!form.amount || !form.date) return
    setSaving(true)
    const { error } = await supabase.from('revenue').update({
      subscriber_id: form.subscriber_id ? Number(form.subscriber_id) : null,
      amount: Number(form.amount), plan: form.plan || 'monthly',
      date: form.date, notes: form.notes || '',
    }).eq('id', form.id)
    if (!error) { await loadAll(); setModal(null); setForm({}) }
    setSaving(false)
  }

  // ── Delete revenue ────────────────────────────────────────────────────────────
  async function deleteRevenue(id) {
    const { error } = await supabase.from('revenue').delete().eq('id', id)
    if (!error) { await loadAll(); setModal(null); setForm({}) }
  }

  // ── Send email via mailto: (opens Outlook) ───────────────────────────────────
  async function sendEmail() {
    if (!form.emailTo || !form.emailSubject || !form.emailBody) return
    setSaving(true)
    setForm(f => ({ ...f, emailStatus: 'sending' }))
    const emailId = String(Date.now())
    try {
      const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id:  process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_y6gmrt6',
          template_id: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_1g2axdc',
          user_id:     process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'RI31LgNPqydWoarYi',
          template_params: {
            to_email:  form.emailTo,
            to_name:   form.emailToName || form.emailTo,
            subject:   form.emailSubject,
            message:   form.emailBody + (company.emailSignature ? `\n\n-- \n${company.emailSignature}${company.email ? '\n' + company.email : ''}${company.phone ? ' · ' + company.phone : ''}${company.website ? '\n' + company.website : ''}` : ''),
            from_name: company.name || 'MiiTV',
            tracking_pixel: `<img src="${API_BASE}/api/track-open?id=${emailId}" width="1" height="1" style="display:none" alt="" />`,
          },
        }),
      })
      if (res.ok) {
        const sub = subscribers.find(s => s.email === form.emailTo)
        if (sub) {
          await supabase.from('activity').insert({
            subscriber_id: sub.id, type: 'email',
            note: `Email sent via EmailJS: "${form.emailSubject}"`, created_by: user?.email,
          })
        }
        // Log to email history
        const logEntry = {
          id: emailId,
          to: form.emailTo,
          toName: form.emailToName || form.emailTo,
          subject: form.emailSubject,
          body: form.emailBody,
          sentAt: new Date().toISOString(),
          status: 'sent',
        }
        // Create tracking row in Supabase (open count starts at 0)
        const trackingPixelUrl = `${API_BASE}/api/track-open?id=${emailId}`
        await supabase.from('email_tracking').insert({
          email_id:  emailId,
          to_email:  form.emailTo,
          subject:   form.emailSubject,
          sent_at:   logEntry.sentAt,
          open_count: 0,
        })
        // Store pixel URL in log entry for reference
        logEntry.trackingPixelUrl = trackingPixelUrl
        setEmailLog(prev => {
          const updated = [logEntry, ...prev].slice(0, 200)
          localStorage.setItem('miitv_email_log', JSON.stringify(updated))
          return updated
        })
        // Refresh tracking state
        loadTracking([logEntry])
        setForm(f => ({ ...f, emailStatus: 'sent' }))
        setTimeout(() => { setModal(null); setForm({}) }, 1500)
      } else {
        const txt = await res.text()
        setForm(f => ({ ...f, emailStatus: 'error: ' + txt }))
      }
    } catch (err) {
      setForm(f => ({ ...f, emailStatus: 'error: ' + err.message }))
    }
    setSaving(false)
  }

  // ── Send bulk group email via EmailJS ───────────────────────────────────────────────
  async function sendBulkEmail(recipients) {
    if (!form.emailSubject || !form.emailBody || !recipients?.length) return
    setSaving(true)
    setForm(f => ({ ...f, bulkStatus: 'sending', bulkDone: 0, bulkTotal: recipients.length, bulkErrors: [] }))
    let done = 0, errors = []
    for (const sub of recipients) {
      const subDaysLeft = sub.expiration
        ? Math.round((new Date(sub.expiration) - new Date()) / 86400000)
        : null
      const subDaysStr = subDaysLeft === null ? '' : subDaysLeft < 0 ? `${Math.abs(subDaysLeft)}` : `${subDaysLeft}`
      const body = form.emailBody
        .replace(/\[Name\]/g, sub.username || sub.email)
        .replace(/\[date\]/g, fmtDate(sub.expiration) || '')
        .replace(/\[days\]/g, subDaysStr)
      const bulkEmailId = `${Date.now()}_${sub.id}`
      const bulkPixel = `<img src="${API_BASE}/api/track-open?id=${bulkEmailId}" width="1" height="1" style="display:none" alt="" />`
      try {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id:  process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_y6gmrt6',
            template_id: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_1g2axdc',
            user_id:     process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'RI31LgNPqydWoarYi',
            template_params: {
              to_email:  sub.email,
              to_name:   sub.username || sub.email,
              subject:   form.emailSubject,
              message:   body + (company.emailSignature ? `\n\n-- \n${company.emailSignature}` : ''),
              from_name: company.name || 'MiiTV',
              tracking_pixel: bulkPixel,
            },
          }),
        })
        if (res.ok) {
          done++
          // Log activity
          await supabase.from('activity').insert({
            subscriber_id: sub.id, type: 'email',
            note: `Bulk email sent: "${form.emailSubject}"`, created_by: user?.email,
          })
          // Create tracking row
          await supabase.from('email_tracking').insert({
            email_id:   bulkEmailId,
            to_email:   sub.email,
            subject:    form.emailSubject,
            sent_at:    new Date().toISOString(),
            open_count: 0,
          })
          // Add to email log
          const bulkLogEntry = {
            id: bulkEmailId,
            to: sub.email,
            toName: sub.username || sub.email,
            subject: form.emailSubject,
            body,
            sentAt: new Date().toISOString(),
            status: 'sent',
            trackingPixelUrl: `${API_BASE}/api/track-open?id=${bulkEmailId}`,
          }
          setEmailLog(prev => {
            const updated = [bulkLogEntry, ...prev].slice(0, 200)
            localStorage.setItem('miitv_email_log', JSON.stringify(updated))
            return updated
          })
        } else {
          errors.push(sub.email)
        }
      } catch { errors.push(sub.email) }
      setForm(f => ({ ...f, bulkDone: done, bulkErrors: errors }))
      // Small delay to avoid EmailJS rate limits
      await new Promise(r => setTimeout(r, 300))
    }
    setForm(f => ({ ...f, bulkStatus: errors.length === 0 ? 'done' : 'done-with-errors' }))
    setSaving(false)
  }

  // ── Send to hand-picked subscribers (BCC — addresses hidden) ──────────────────
  async function sendMultiEmail(pickedSubs) {
    if (!form.emailSubject || !form.emailBody || !pickedSubs?.length) return
    setSaving(true)
    setForm(f => ({ ...f, bulkStatus: 'sending', bulkDone: 0, bulkTotal: pickedSubs.length, bulkErrors: [] }))
    let done = 0, errors = []
    for (const sub of pickedSubs) {
      const body = form.emailBody
        .replace(/\[Name\]/g, sub.username || sub.email)
        .replace(/\[date\]/g, fmtDate(sub.expiration) || '')
      const multiEmailId = `${Date.now()}_${sub.id}`
      const multiPixel = `<img src="${API_BASE}/api/track-open?id=${multiEmailId}" width="1" height="1" style="display:none" alt="" />`
      try {
        const res = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id:  process.env.NEXT_PUBLIC_EMAILJS_SERVICE_ID || 'service_y6gmrt6',
            template_id: process.env.NEXT_PUBLIC_EMAILJS_TEMPLATE_ID || 'template_1g2axdc',
            user_id:     process.env.NEXT_PUBLIC_EMAILJS_PUBLIC_KEY || 'RI31LgNPqydWoarYi',
            template_params: {
              to_email:  sub.email,
              to_name:   sub.username || sub.email,
              subject:   form.emailSubject,
              message:   body + (company.emailSignature ? `\n\n-- \n${company.emailSignature}` : ''),
              from_name: company.name || 'MiiTV',
              tracking_pixel: multiPixel,
            },
          }),
        })
        if (res.ok) {
          done++
          await supabase.from('activity').insert({
            subscriber_id: sub.id, type: 'email',
            note: `Multi-select email sent: "${form.emailSubject}"`, created_by: user?.email,
          })
          await supabase.from('email_tracking').insert({
            email_id: multiEmailId, to_email: sub.email,
            subject: form.emailSubject, sent_at: new Date().toISOString(), open_count: 0,
          })
          const entry = {
            id: multiEmailId, to: sub.email, toName: sub.username || sub.email,
            subject: form.emailSubject, body, sentAt: new Date().toISOString(), status: 'sent',
            trackingPixelUrl: `${API_BASE}/api/track-open?id=${multiEmailId}`,
          }
          setEmailLog(prev => { const u=[entry,...prev].slice(0,200); localStorage.setItem('miitv_email_log',JSON.stringify(u)); return u })
        } else { errors.push(sub.email) }
      } catch { errors.push(sub.email) }
      setForm(f => ({ ...f, bulkDone: done, bulkErrors: errors }))
      await new Promise(r => setTimeout(r, 300))
    }
    setForm(f => ({ ...f, bulkStatus: errors.length===0?'done':'done-with-errors' }))
    setSelectedSubs([])
    setSaving(false)
  }

    // ── Save note ─────────────────────────────────────────────────────────────────
  async function saveNote() {
    if (!form.note || !selected) return
    setSaving(true)
    const { error } = await supabase.from('activity').insert({
      subscriber_id: selected.id, type: form.type || 'note',
      note: form.note, created_by: user?.email,
    })
    if (!error) { setModal(null); setForm({}) }
    setSaving(false)
  }

  // ── Sign out ──────────────────────────────────────────────────────────────────
  async function signOut() { await supabase.auth.signOut() }

  async function deleteSubscriber(sub) {
    if (!window.confirm('Remove ' + sub.username + ' from the CRM?\nThis cannot be undone.')) return
    const { error } = await supabase.from('subscribers').delete().eq('id', sub.id)
    if (!error) {
      setSelected(null)
      await loadAll()
      setSyncMsg('✓ Removed ' + sub.username)
      setTimeout(() => setSyncMsg(''), 3000)
    } else {
      alert('Error: ' + error.message)
    }
  }

  // ── Domain breakdown (analytics) ─────────────────────────────────────────────
  const domainCounts = useMemo(() => {
    const m = {}
    contacts.forEach(c => { m[c.domain] = (m[c.domain]||0)+1 })
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,12)
  }, [contacts])

  const monthlyExpiry = useMemo(() => {
    const m = {}
    contacts.forEach(c => { const k=c.expiration?.slice(0,7); if(k) m[k]=(m[k]||0)+1 })
    return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0]))
  }, [contacts])
  const maxMonth = Math.max(...monthlyExpiry.map(e=>e[1]), 1)

  const monthlyCosts = useMemo(() => {
    const m = {}
    costs.forEach(c => { const k=c.date?.slice(0,7); if(k) m[k]=(m[k]||0)+Number(c.amount) })
    return Object.entries(m).sort((a,b)=>a[0].localeCompare(b[0])).slice(-12)
  }, [costs])

  const costByCategory = useMemo(() => {
    const m = {}
    costs.forEach(c => { m[c.category]=(m[c.category]||0)+Number(c.amount) })
    return Object.entries(m).sort((a,b)=>b[1]-a[1])
  }, [costs])

  const fmt = n => `£${Number(n).toLocaleString('en-GB',{minimumFractionDigits:2,maximumFractionDigits:2})}`

  if (loading) return (
    <div style={{ minHeight:'100vh',background:'#07090f',display:'flex',alignItems:'center',justifyContent:'center',color:'#475569',fontFamily:'sans-serif',fontSize:14 }}>
      Loading MiiTV CRM…
    </div>
  )

  return (
    <div style={{ fontFamily:"'Sora',system-ui,sans-serif", background:'#07090f', minHeight:'100vh', color:'#dde4f0', display:'flex', flexDirection:'column' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@300;400;500;600;700;800&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#0c0f18}
        ::-webkit-scrollbar-thumb{background:#1e2d4a;border-radius:2px}
        input,select,textarea{font-family:inherit}
        .sr{cursor:pointer;transition:background .1s;border-radius:7px}
        .sr:hover{background:rgba(96,165,250,.06)}
        .sh{cursor:pointer;background:none;border:none;color:#475569;font-family:inherit;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;display:inline-flex;align-items:center;gap:3px;white-space:nowrap}
        .sh:hover{color:#94a3b8}
        .pb{cursor:pointer;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.07);border-radius:7px;padding:5px 10px;color:#64748b;font-size:12px;font-weight:600;transition:all .15s;font-family:inherit}
        .pb:hover{background:rgba(96,165,250,.1);color:#60a5fa}
        .pb.on{background:rgba(96,165,250,.16);color:#60a5fa;border-color:rgba(96,165,250,.3)}
        .pb:disabled{opacity:.22;cursor:default}
        .card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:13px;padding:18px}
        @keyframes fu{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fu .22s ease}
        @media(max-width:600px){
          .desktop-only{display:none!important}
          .mobile-nav{display:flex!important}
          .main-content{padding:10px 10px 82px 10px!important}
          .card{padding:13px!important;border-radius:10px!important}
          .stat-grid{grid-template-columns:repeat(2,1fr)!important}
          .topbar-actions{display:none!important}
          .topbar{padding:0 12px!important;height:52px!important}
          .sub-desktop{display:none!important}
          .sub-mobile{display:flex!important}
          .two-col{grid-template-columns:1fr!important}
          .hide-mobile{display:none!important}
          .settings-grid{grid-template-columns:1fr!important}
          .company-inner{grid-template-columns:1fr!important}
          .company-fields{grid-template-columns:1fr!important}
          .company-logo-col{flex-direction:row!important;align-items:center!important;gap:16px!important;margin-bottom:14px}
        }
        @media(min-width:601px){
          .mobile-nav{display:none!important}
          .sub-mobile{display:none!important}
          .sub-desktop{display:grid!important}
        }
      `}</style>

      {/* ── Topbar ── */}
      <div className="topbar" style={{ display:'flex',alignItems:'center',padding:'0 22px',height:54,borderBottom:'1px solid rgba(255,255,255,.06)',background:'rgba(7,9,15,.97)',position:'sticky',top:0,zIndex:100,backdropFilter:'blur(12px)',gap:10 }}>
        {/* Logo */}
        <div style={{ display:'flex',alignItems:'center',gap:9,flexShrink:0 }}>
          {company.logo
            ? <img src={company.logo} alt={company.name} style={{ width:32,height:32,borderRadius:8,objectFit:'cover' }} />
            : <div style={{ width:32,height:32,borderRadius:8,background:'linear-gradient(135deg,#0ea5e9,#6366f1)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:800,fontSize:14,color:'#fff' }}>{(company.name||'M')[0].toUpperCase()}</div>
          }
          <span className="desktop-only" style={{ fontWeight:800,fontSize:14,letterSpacing:'-.3px',whiteSpace:'nowrap' }}>{company.name||'MiiTV'} <span style={{ color:'#38bdf8',fontWeight:400,fontSize:12 }}>{company.tagline||'CRM'}</span></span>
        </div>
        {/* Desktop nav tabs */}
        <div className="desktop-only" style={{ display:'flex',gap:4,overflowX:'auto' }}>
          {[['subscribers','👥 Subscribers'],['financials','💰 Financials'],['analytics','📊 Analytics'],['emails','✉️ Emails'],['referrals','🎁 Referrals'],['settings','⚙️ Settings']].map(([v,l])=>(
            <button key={v}
              style={{ cursor:'pointer',border:'none',borderRadius:8,fontFamily:'inherit',fontWeight:600,fontSize:13,padding:'7px 14px',background:view===v?'rgba(96,165,250,.13)':'none',color:view===v?'#60a5fa':'#64748b',outline:'none',position:'relative',display:'inline-flex',alignItems:'center',gap:5,whiteSpace:'nowrap' }}
              onClick={()=>{ setView(v); setSelected(null) }}>
              {l}
              {v==='emails' && emailLog.length>0 && (
                <span style={{ fontSize:10,fontWeight:700,background:'rgba(56,189,248,.2)',color:'#38bdf8',borderRadius:10,padding:'1px 6px',minWidth:18,textAlign:'center' }}>{emailLog.length}</span>
              )}
              {v==='referrals' && referrals.filter(r=>r.status==='pending').length>0 && (
                <span style={{ fontSize:10,fontWeight:700,background:'rgba(245,158,11,.2)',color:'#f59e0b',borderRadius:10,padding:'1px 6px',minWidth:18,textAlign:'center' }}>{referrals.filter(r=>r.status==='pending').length}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ flex:1 }}/>
        <div className="topbar-actions" style={{ display:'flex',alignItems:'center',gap:8 }}>
          {syncMsg && <span style={{ fontSize:12, color: syncMsg.startsWith('✓') ? '#34d399' : '#f87171' }}>{syncMsg}</span>}
          <Btn variant='ghost' size='sm' onClick={syncSheet} disabled={syncing}>{syncing ? '⟳ Syncing…' : '⟳ Sync'}</Btn>
          <Btn size='sm' onClick={()=>{ setForm({ sendMode:'individual' }); setModal('send-email'); loadModalTemplates() }}
            style={{ background:'rgba(56,189,248,.12)', color:'#38bdf8', border:'1px solid rgba(56,189,248,.22)' }}>✉️</Btn>
          <Btn size='sm' onClick={()=>{ setForm({ sendMode:'bulk' }); setModal('send-email'); loadModalTemplates() }}
            style={{ background:'rgba(167,139,250,.1)', color:'#a78bfa', border:'1px solid rgba(167,139,250,.2)' }}>📨</Btn>
          <div style={{ position:'relative' }}>
            <div title={user?.email} style={{ width:28,height:28,borderRadius:'50%',background:'linear-gradient(135deg,#f59e0b,#ef4444)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'#fff',cursor:'pointer' }}
              onClick={()=>setUserMenu(v=>!v)}>{(user?.email||'?')[0].toUpperCase()}</div>
            {userMenu && (
              <div style={{ position:'absolute',right:0,top:36,background:'#0f1521',border:'1px solid rgba(255,255,255,.12)',borderRadius:10,padding:8,minWidth:200,zIndex:300,boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}
                onMouseLeave={()=>setUserMenu(false)}>
                <div style={{ padding:'6px 10px',fontSize:11,color:'#475569',borderBottom:'1px solid rgba(255,255,255,.07)',marginBottom:6 }}>{user?.email}</div>
                <button onClick={()=>{ setUserMenu(false); setView('settings') }}
                  style={{ width:'100%',textAlign:'left',background:'none',border:'none',color:'#dde4f0',fontSize:13,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontFamily:'inherit' }}>
                  🔑 Change Password
                </button>
                <button onClick={()=>{ setUserMenu(false); signOut() }}
                  style={{ width:'100%',textAlign:'left',background:'none',border:'none',color:'#f87171',fontSize:13,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontFamily:'inherit' }}>
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
        {/* Mobile: right side actions */}
        <div className="mobile-nav" style={{ display:'none',alignItems:'center',gap:8 }}>
          <Btn size='sm' onClick={()=>{ setForm({ sendMode:'individual' }); setModal('send-email'); loadModalTemplates() }}
            style={{ background:'rgba(56,189,248,.12)', color:'#38bdf8', border:'1px solid rgba(56,189,248,.22)',padding:'6px 10px' }}>✉️</Btn>
          <div style={{ position:'relative' }}>
            <div title={user?.email} style={{ width:30,height:30,borderRadius:'50%',background:'linear-gradient(135deg,#f59e0b,#ef4444)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:12,fontWeight:700,color:'#fff',cursor:'pointer' }}
              onClick={()=>setUserMenu(v=>!v)}>{(user?.email||'?')[0].toUpperCase()}</div>
            {userMenu && (
              <div style={{ position:'fixed',right:10,top:58,background:'#0f1521',border:'1px solid rgba(255,255,255,.12)',borderRadius:10,padding:8,minWidth:200,zIndex:300,boxShadow:'0 8px 32px rgba(0,0,0,.4)' }}>
                <div style={{ padding:'6px 10px',fontSize:11,color:'#475569',borderBottom:'1px solid rgba(255,255,255,.07)',marginBottom:6 }}>{user?.email}</div>
                <button onClick={()=>{ setUserMenu(false); setView('settings') }}
                  style={{ width:'100%',textAlign:'left',background:'none',border:'none',color:'#dde4f0',fontSize:13,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontFamily:'inherit' }}>
                  🔑 Change Password
                </button>
                <button onClick={()=>{ setUserMenu(false); signOut() }}
                  style={{ width:'100%',textAlign:'left',background:'none',border:'none',color:'#f87171',fontSize:13,padding:'7px 10px',borderRadius:6,cursor:'pointer',fontFamily:'inherit' }}>
                  🚪 Sign Out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile bottom nav ── */}
      <div className="mobile-nav" style={{ display:'none',position:'fixed',bottom:0,left:0,right:0,zIndex:200,
        background:'rgba(7,9,15,.97)',borderTop:'1px solid rgba(255,255,255,.08)',
        backdropFilter:'blur(12px)',padding:'6px 0 env(safe-area-inset-bottom,6px) 0' }}>
        <div style={{ display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:0 }}>
          {[
            ['subscribers','👥','Subs'],
            ['financials','💰','Money'],
            ['analytics','📊','Stats'],
            ['emails','✉️','Emails'],
            ['referrals','🎁','Refs'],
            ['settings','⚙️','Settings'],
          ].map(([v,icon,label])=>(
            <button key={v} onClick={()=>{ setView(v); setSelected(null) }}
              style={{ cursor:'pointer',border:'none',background:'none',fontFamily:'inherit',
                display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'6px 2px',
                color: view===v ? '#60a5fa' : '#475569' }}>
              <span style={{ fontSize:20,lineHeight:1,position:'relative' }}>
                {icon}
                {v==='emails' && emailLog.length>0 && (
                  <span style={{ position:'absolute',top:-4,right:-6,fontSize:9,fontWeight:700,
                    background:'#38bdf8',color:'#000',borderRadius:10,padding:'1px 4px',lineHeight:1.4 }}>{emailLog.length}</span>
                )}
                {v==='referrals' && referrals.filter(r=>r.status==='pending').length>0 && (
                  <span style={{ position:'absolute',top:-4,right:-6,fontSize:9,fontWeight:700,
                    background:'#f59e0b',color:'#000',borderRadius:10,padding:'1px 4px',lineHeight:1.4 }}>{referrals.filter(r=>r.status==='pending').length}</span>
                )}
              </span>
              <span style={{ fontSize:9,fontWeight:600,textTransform:'uppercase',letterSpacing:'.04em' }}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex:1,display:'flex',overflow:'hidden',height:'calc(100vh - 54px)' }}>
        <div className="main-content" style={{ flex:1,overflow:'auto',padding:'18px 20px 20px 22px' }}>

          {/* ════════════════════ SUBSCRIBERS ════════════════════ */}
          {view === 'subscribers' && (
            <div className="fu">
              <div className="stat-grid" style={{ display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:11,marginBottom:18,gridTemplateRows:'auto' }}>
                {[
                  { id:'total',     label:'Total',        value:total,    color:'#60a5fa', icon:'👥' },
                  { id:'active',    label:'Active',       value:active,   color:'#34d399', icon:'✅' },
                  { id:'expiring',  label:'Expiring ≤30d',value:expiring, color:'#f59e0b', icon:'⏳' },
                  { id:'expired',   label:'Expired',      value:expired,  color:'#f87171', icon:'❌' },
                  { id:'multi',     label:'Multi-device', value:multi,    color:'#a78bfa', icon:'🔗' },
                ].map(s=>{
                  const isActive = statCard === s.id
                  return (
                    <div key={s.id} className="card" onClick={()=>{ setStatCard(isActive ? null : s.id); setPage(0); setSearch(''); setStatusFilter('All'); setConnsFilter('All') }}
                      style={{ padding:'13px 15px', cursor:'pointer', transition:'all .15s',
                        background: isActive ? `rgba(${s.color==='#60a5fa'?'96,165,250':s.color==='#34d399'?'52,211,153':s.color==='#f59e0b'?'245,158,11':s.color==='#f87171'?'248,113,113':'167,139,250'},.1)` : 'rgba(255,255,255,.025)',
                        border: isActive ? `1px solid ${s.color}44` : '1px solid rgba(255,255,255,.07)',
                        transform: isActive ? 'translateY(-2px)' : 'none',
                        boxShadow: isActive ? `0 4px 20px ${s.color}22` : 'none',
                      }}>
                      <div style={{ fontSize:10.5,color: isActive ? s.color : '#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:5 }}>{s.icon} {s.label}</div>
                      <div style={{ fontSize:28,fontWeight:800,color:s.color,letterSpacing:'-1px',lineHeight:1 }}>{s.value}</div>
                      {isActive && <div style={{ fontSize:9,color:s.color,fontWeight:600,marginTop:4,opacity:.8 }}>▼ FILTERED</div>}
                    </div>
                  )
                })}
              </div>

              <div style={{ display:'flex',gap:9,marginBottom:13,alignItems:'center' }}>
                <input placeholder="🔍  Search username, email or ID…" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}
                  style={{ flex:1,maxWidth:320,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:9,padding:'8px 13px',color:'#dde4f0',fontSize:13,outline:'none' }} />
                <select value={statusFilter} onChange={e=>{setStatusFilter(e.target.value);setPage(0);}}
                  style={{ maxWidth:160,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:9,padding:'8px 13px',color:'#dde4f0',fontSize:13,outline:'none' }}>
                  <option value="All">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="Expiring Soon">Expiring Soon</option>
                  <option value="Expired">Expired</option>
                </select>
                <select value={connsFilter} onChange={e=>{setConnsFilter(e.target.value);setPage(0);}}
                  style={{ maxWidth:156,background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:9,padding:'8px 13px',color:'#dde4f0',fontSize:13,outline:'none' }}>
                  <option value="All">All Connections</option>
                  <option value="Single">Single (1)</option>
                  <option value="Multi">Multi (2+)</option>
                </select>
                <span style={{ fontSize:12,color:'#334155' }}>{filtered.length} result{filtered.length!==1?'s':''}</span>
                {statCard && (
                  <button onClick={()=>setStatCard(null)}
                    style={{ cursor:'pointer',background:'rgba(96,165,250,.1)',border:'1px solid rgba(96,165,250,.25)',borderRadius:7,
                      padding:'4px 10px',fontSize:11,fontWeight:700,color:'#60a5fa',fontFamily:'inherit',display:'flex',alignItems:'center',gap:5 }}>
                    ✕ Clear filter
                  </button>
                )}
              </div>

              {/* Desktop table */}
              <div className="sub-desktop" style={{ background:'rgba(255,255,255,.02)',border:'1px solid rgba(255,255,255,.06)',borderRadius:12,overflow:'hidden' }}>
                <div style={{ display:'grid',gridTemplateColumns:'70px 1.8fr 2fr 1.6fr 60px 115px',gap:8,padding:'8px 14px',borderBottom:'1px solid rgba(255,255,255,.05)',alignItems:'center' }}>
                  {[['id','ID'],['username','Username'],null,['expiration','Expires'],['conns','Conn.'],null].map((col,i)=>
                    col ? <button key={col[0]} className="sh" onClick={()=>toggleSort(col[0])}>{col[1]}{sortBy===col[0]?(sortDir==='asc'?' ↑':' ↓'):''}</button>
                        : <span key={i} style={{ fontSize:11,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em' }}>{i===2?'Email':'Status'}</span>
                  )}
                </div>
                {pageData.map(c=>{
                  const [abg,atxt]=PALETTES[c.pal]
                  const sc=STATUS_COLOR[c.status]
                  const isSel=selected?.id===c.id
                  return (
                    <div key={c.id} className="sr"
                      style={{ display:'grid',gridTemplateColumns:'70px 1.8fr 2fr 1.6fr 60px 115px',gap:8,padding:'9px 14px',borderBottom:'1px solid rgba(255,255,255,.04)',alignItems:'center',background:isSel?'rgba(96,165,250,.07)':'transparent' }}
                      onClick={()=>setSelected(isSel?null:c)}>
                      <span style={{ fontFamily:"'DM Mono',monospace",fontSize:11,color:'#334155' }}>{c.id}</span>
                      <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                        <div style={{ width:27,height:27,borderRadius:'50%',background:abg,border:`1px solid ${atxt}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,fontWeight:700,color:atxt,flexShrink:0 }}>{c.avatar}</div>
                        <span style={{ fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.username}</span>
                      </div>
                      <span style={{ fontSize:12,color:'#4b5563',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.email}</span>
                      <div style={{ display:'flex',flexDirection:'column',gap:1 }}>
                        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:11,color:c.daysLeft<0?'#f87171':c.daysLeft<=30?'#f59e0b':'#64748b' }}>{fmtDate(c.expiration)}</span>
                        <span style={{ fontSize:10,color:'#334155' }}>{c.daysLeft<0?`${Math.abs(c.daysLeft)}d ago`:`+${c.daysLeft}d`}</span>
                      </div>
                      <span style={{ fontSize:12,color:c.conns>1?'#a78bfa':'#334155',fontWeight:600,textAlign:'center' }}>{c.conns}</span>
                      <span style={{ fontSize:10.5,fontWeight:700,color:sc.text,background:sc.bg,border:`1px solid ${sc.border}`,padding:'2px 7px',borderRadius:6,whiteSpace:'nowrap' }}>{c.status}</span>
                    </div>
                  )
                })}
              </div>

              {/* Mobile card list */}
              <div className="sub-mobile" style={{ display:'none',flexDirection:'column',gap:8 }}>
                {pageData.map(c=>{
                  const [abg,atxt]=PALETTES[c.pal]
                  const sc=STATUS_COLOR[c.status]
                  const isSel=selected?.id===c.id
                  return (
                    <div key={c.id}
                      onClick={()=>setSelected(isSel?null:c)}
                      style={{ background:isSel?'rgba(96,165,250,.08)':'rgba(255,255,255,.025)',
                        border:`1px solid ${isSel?'rgba(96,165,250,.25)':'rgba(255,255,255,.07)'}`,
                        borderRadius:12,padding:'12px 14px',cursor:'pointer' }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:8 }}>
                        <div style={{ width:36,height:36,borderRadius:'50%',background:abg,border:`1px solid ${atxt}44`,
                          display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:700,color:atxt,flexShrink:0 }}>{c.avatar}</div>
                        <div style={{ flex:1,minWidth:0 }}>
                          <div style={{ fontWeight:700,fontSize:14,color:'#dde4f0',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.username}</div>
                          <div style={{ fontSize:11,color:'#475569',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.email}</div>
                        </div>
                        <span style={{ fontSize:11,fontWeight:700,color:sc.text,background:sc.bg,
                          border:`1px solid ${sc.border}`,padding:'3px 8px',borderRadius:6,whiteSpace:'nowrap',flexShrink:0 }}>{c.status}</span>
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',fontSize:11,color:'#475569' }}>
                        <span>📅 {fmtDate(c.expiration)} <span style={{ color:c.daysLeft<0?'#f87171':c.daysLeft<=30?'#f59e0b':'#64748b' }}>({c.daysLeft<0?`${Math.abs(c.daysLeft)}d ago`:`+${c.daysLeft}d`})</span></span>
                        <span style={{ color:'#334155' }}>ID: {c.id}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{ display:'flex',gap:5,justifyContent:'center',marginTop:14,alignItems:'center',flexWrap:'wrap' }}>
                <button className="pb" disabled={page===0} onClick={()=>setPage(p=>p-1)}>← Prev</button>
                {Array.from({length:Math.min(pageCount,9)},(_,i)=>{
                  const p=pageCount<=9?i:Math.max(0,Math.min(page-4,pageCount-9))+i
                  return <button key={p} className={`pb ${page===p?'on':''}`} onClick={()=>setPage(p)}>{p+1}</button>
                })}
                <button className="pb" disabled={page>=pageCount-1} onClick={()=>setPage(p=>p+1)}>Next →</button>
                <span style={{ fontSize:11,color:'#334155',marginLeft:4 }}>Page {page+1} of {pageCount}</span>
              </div>
            </div>
          )}

          {/* ════════════════════ FINANCIALS ════════════════════ */}
          {view === 'financials' && (
            <div className="fu">
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
                <div>
                  <h2 style={{ fontSize:19,fontWeight:800,marginBottom:3 }}>Financials</h2>
                  <p style={{ color:'#475569',fontSize:13 }}>Track revenue, costs and profit</p>
                </div>
                <div style={{ display:'flex',gap:8 }}>
                  <Btn onClick={()=>{ setForm({ date:new Date().toISOString().slice(0,10) }); setModal('add-revenue') }}>+ Add Revenue</Btn>
                  <Btn variant='ghost' onClick={()=>{ setForm({ category:'Hosting', date:new Date().toISOString().slice(0,10) }); setModal('add-cost') }}>+ Add Cost</Btn>
                </div>
              </div>

              {/* Summary cards */}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
                {[
                  { label:'Total Revenue',value:fmt(totalRevenue),sub:subRevenue>0?fmt(manualRevenue)+' manual + '+fmt(subRevenue)+' subs':null,color:'#34d399',icon:'💰' },
                  { label:'Total Costs',value:fmt(totalCosts),sub:subCosts>0?fmt(manualCosts)+' manual + '+fmt(subCosts)+' subs':null,color:'#f87171',icon:'💸' },
                  { label:'Net Profit',value:fmt(profit),color:profit>=0?'#34d399':'#f87171',icon:'📈' },
                  { label:'This Month',value:fmt(thisMonthRev-thisMonthCost),sub:subThisMonth.length>0?subThisMonth.length+' subs expiring · '+fmt(subThisRev)+' rev':null,color:(thisMonthRev-thisMonthCost)>=0?'#34d399':'#f87171',icon:'📅' },
                ].map(s=>(
                  <div key={s.label} className="card">
                    <div style={{ fontSize:10.5,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6 }}>{s.icon} {s.label}</div>
                    <div style={{ fontSize:22,fontWeight:800,color:s.color,letterSpacing:'-.5px' }}>{s.value}</div>
                    {s.sub && <div style={{ fontSize:10,color:'#475569',marginTop:3 }}>{s.sub}</div>}
                  </div>
                ))}
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
                {/* Recent Revenue */}
                <div className="card">
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                    <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700 }}>💰 Revenue</h3>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ fontSize:12,color:'#334155' }}>{revenue.length} entries</span>
                      <select value={finSort.col==='date'&&finSort.dir} onChange={e=>setFinSort({col:'date',dir:e.target.value})}
                        style={{ fontSize:11,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',color:'#94a3b8',borderRadius:6,padding:'2px 6px',fontFamily:'inherit',cursor:'pointer' }}>
                        <option value="desc">Newest first</option>
                        <option value="asc">Oldest first</option>
                      </select>
                      <select onChange={e=>setFinSort({col:e.target.value,dir:'desc'})}
                        style={{ fontSize:11,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',color:'#94a3b8',borderRadius:6,padding:'2px 6px',fontFamily:'inherit',cursor:'pointer' }}>
                        <option value="date">Sort by date</option>
                        <option value="amount">Sort by amount</option>
                        <option value="plan">Sort by plan</option>
                      </select>
                    </div>
                  </div>
                  {revenue.length === 0 ? (
                    <div style={{ color:'#334155',fontSize:13,textAlign:'center',padding:'20px 0' }}>No revenue recorded yet</div>
                  ) : [...revenue].sort((a,b)=>{
                      const av = finSort.col==='amount' ? Number(a.amount) : finSort.col==='plan' ? (a.plan||'') : (a.date||'')
                      const bv = finSort.col==='amount' ? Number(b.amount) : finSort.col==='plan' ? (b.plan||'') : (b.date||'')
                      return finSort.dir==='asc' ? (av>bv?1:-1) : (av<bv?1:-1)
                    }).map(r=>(
                    <div key={r.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.04)',gap:8 }}>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:600,color:'#dde4f0' }}>{r.plan || 'Payment'}</div>
                        <div style={{ fontSize:11,color:'#475569' }}>{fmtDate(r.date)}{r.notes && ' · '+r.notes}</div>
                      </div>
                      <span style={{ color:'#34d399',fontWeight:700,fontSize:13,flexShrink:0 }}>{fmt(r.amount)}</span>
                      <div style={{ display:'flex',gap:4,flexShrink:0 }}>
                        <button onClick={()=>{ setForm({...r, amount: String(r.amount)}); setModal('edit-revenue') }}
                          style={{ cursor:'pointer',background:'rgba(96,165,250,.1)',border:'none',color:'#60a5fa',borderRadius:6,padding:'3px 8px',fontSize:11,fontFamily:'inherit',fontWeight:600 }}>✏️</button>
                        <button onClick={()=>{ setForm(r); setModal('confirm-delete-revenue') }}
                          style={{ cursor:'pointer',background:'rgba(248,113,113,.1)',border:'none',color:'#f87171',borderRadius:6,padding:'3px 8px',fontSize:11,fontFamily:'inherit',fontWeight:600 }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Costs */}
                <div className="card">
                  <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                    <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700 }}>💸 Costs</h3>
                    <div style={{ display:'flex',alignItems:'center',gap:8 }}>
                      <span style={{ fontSize:12,color:'#334155' }}>{costs.length} entries</span>
                      <select onChange={e=>setFinSort({col:e.target.value,dir:finSort.dir})}
                        style={{ fontSize:11,background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',color:'#94a3b8',borderRadius:6,padding:'2px 6px',fontFamily:'inherit',cursor:'pointer' }}>
                        <option value="date">Sort by date</option>
                        <option value="amount">Sort by amount</option>
                        <option value="category">Sort by category</option>
                      </select>
                    </div>
                  </div>
                  {costs.length === 0 ? (
                    <div style={{ color:'#334155',fontSize:13,textAlign:'center',padding:'20px 0' }}>No costs recorded yet</div>
                  ) : [...costs].sort((a,b)=>{
                      const av = finSort.col==='amount' ? Number(a.amount) : finSort.col==='category' ? (a.category||'') : (a.date||'')
                      const bv = finSort.col==='amount' ? Number(b.amount) : finSort.col==='category' ? (b.category||'') : (b.date||'')
                      return finSort.dir==='asc' ? (av>bv?1:-1) : (av<bv?1:-1)
                    }).map(c=>(
                    <div key={c.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'1px solid rgba(255,255,255,.04)',gap:8 }}>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:600,color:'#dde4f0' }}>{c.category}</div>
                        <div style={{ fontSize:11,color:'#475569' }}>{fmtDate(c.date)}{c.description && ' · '+c.description}</div>
                      </div>
                      <span style={{ color:'#f87171',fontWeight:700,fontSize:13,flexShrink:0 }}>{fmt(c.amount)}</span>
                      <div style={{ display:'flex',gap:4,flexShrink:0 }}>
                        <button onClick={()=>{ setForm({...c, amount: String(c.amount)}); setModal('edit-cost') }}
                          style={{ cursor:'pointer',background:'rgba(96,165,250,.1)',border:'none',color:'#60a5fa',borderRadius:6,padding:'3px 8px',fontSize:11,fontFamily:'inherit',fontWeight:600 }}>✏️</button>
                        <button onClick={()=>{ setForm(c); setModal('confirm-delete-cost') }}
                          style={{ cursor:'pointer',background:'rgba(248,113,113,.1)',border:'none',color:'#f87171',borderRadius:6,padding:'3px 8px',fontSize:11,fontFamily:'inherit',fontWeight:600 }}>🗑️</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Subscriber financials table */}
              {contacts.some(c => c.cost > 0 || c.profit > 0) && (()=>{
                const sorted = [...contacts].filter(c => c.cost > 0 || c.profit > 0)
                return (
                  <div className="card" style={{ marginBottom:16 }}>
                    <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14 }}>
                      <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700 }}>👥 Subscriber Financials</h3>
                      <span style={{ fontSize:12,color:'#334155' }}>{sorted.length} subscribers · {fmt(subRevenue)} revenue · {fmt(subCosts)} costs</span>
                    </div>
                    <div style={{ overflowX:'auto' }}>
                      <table style={{ width:'100%',borderCollapse:'collapse',fontSize:12 }}>
                        <thead>
                          <tr style={{ borderBottom:'1px solid rgba(255,255,255,.08)' }}>
                            {[['Username','username'],['Email','email'],['Expiry','expiration'],['Cost','cost'],['Profit','profit'],['Net','net']].map(([lbl,col])=>(
                              <th key={col} onClick={()=>setFinSort(s=>({col,dir:s.col===col&&s.dir==='desc'?'asc':'desc'}))}
                                style={{ textAlign:'left',padding:'6px 10px',color:'#475569',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',userSelect:'none' }}>
                                {lbl} {finSort.col===col?(finSort.dir==='asc'?'↑':'↓'):''}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[...sorted].sort((a,b)=>{
                            const col = finSort.col
                            const av = col==='cost'?Number(a.cost):col==='profit'?Number(a.profit):col==='net'?(Number(a.profit)-Number(a.cost)):col==='expiration'?(a.expiration||''):(a[col]||'')
                            const bv = col==='cost'?Number(b.cost):col==='profit'?Number(b.profit):col==='net'?(Number(b.profit)-Number(b.cost)):col==='expiration'?(b.expiration||''):(b[col]||'')
                            return finSort.dir==='asc'?(av>bv?1:-1):(av<bv?1:-1)
                          }).slice(0,50).map(c=>{
                            const net = Number(c.profit||0) - Number(c.cost||0)
                            const sc = parseStatus(c.expiration)
                            return (
                              <tr key={c.id} style={{ borderBottom:'1px solid rgba(255,255,255,.03)',cursor:'pointer' }} onClick={()=>{ setView('subscribers'); setSelected(c) }}>
                                <td style={{ padding:'6px 10px',color:'#dde4f0',fontWeight:600 }}>{c.username}</td>
                                <td style={{ padding:'6px 10px',color:'#475569',fontFamily:"'DM Mono',monospace",fontSize:11 }}>{c.email}</td>
                                <td style={{ padding:'6px 10px',whiteSpace:'nowrap' }}>
                                  <span style={{ color:sc==='Expired'?'#f87171':sc==='Expiring Soon'?'#f59e0b':'#64748b' }}>{fmtDate(c.expiration)}</span>
                                </td>
                                <td style={{ padding:'6px 10px',color:'#f87171',fontWeight:600 }}>{fmt(c.cost)}</td>
                                <td style={{ padding:'6px 10px',color:'#34d399',fontWeight:600 }}>{fmt(c.profit)}</td>
                                <td style={{ padding:'6px 10px',fontWeight:700,color:net>=0?'#34d399':'#f87171' }}>{fmt(net)}</td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {sorted.length > 50 && <div style={{ textAlign:'center',padding:'8px',fontSize:11,color:'#475569' }}>Showing 50 of {sorted.length}</div>}
                    </div>
                  </div>
                )
              })()}

              {/* Cost by category */}
              {costByCategory.length > 0 && (
                <div className="card">
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700,marginBottom:14 }}>📊 Costs by Category</h3>
                  <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10 }}>
                    {costByCategory.map(([cat,amt])=>(
                      <div key={cat} style={{ padding:'10px 12px',background:'rgba(248,113,113,.05)',border:'1px solid rgba(248,113,113,.12)',borderRadius:9 }}>
                        <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:4 }}>{cat}</div>
                        <div style={{ fontSize:16,fontWeight:700,color:'#f87171' }}>{fmt(amt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Subscriber Cost / Profit Breakdown ── */}
              {contacts.filter(c => c.cost > 0 || c.profit > 0).length > 0 && (
                <div className="card" style={{ marginTop:16 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
                    <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700 }}>👥 Subscriber Cost / Profit Breakdown</h3>
                    <div style={{ fontSize:11,color:'#475569' }}>{contacts.filter(c=>c.cost>0||c.profit>0).length} subscribers</div>
                  </div>
                  {/* Summary totals row */}
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12,padding:'10px 12px',background:'rgba(255,255,255,.03)',borderRadius:8 }}>
                    <div>
                      <div style={{ fontSize:10,color:'#475569',fontWeight:700,marginBottom:2 }}>TOTAL COST</div>
                      <div style={{ fontSize:16,fontWeight:800,color:'#f87171' }}>{fmt(subCosts)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10,color:'#475569',fontWeight:700,marginBottom:2 }}>TOTAL REVENUE</div>
                      <div style={{ fontSize:16,fontWeight:800,color:'#34d399' }}>{fmt(subRevenue)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize:10,color:'#475569',fontWeight:700,marginBottom:2 }}>NET PROFIT</div>
                      <div style={{ fontSize:16,fontWeight:800,color:(subRevenue-subCosts)>=0?'#34d399':'#f87171' }}>{fmt(subRevenue-subCosts)}</div>
                    </div>
                  </div>
                  {/* Table header */}
                  <div style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:8,padding:'6px 10px',background:'rgba(255,255,255,.03)',borderRadius:6,marginBottom:4 }}>
                    {['Subscriber','Cost','Revenue','Profit'].map(h=>(
                      <div key={h} style={{ fontSize:10,color:'#475569',fontWeight:700,textTransform:'uppercase' }}>{h}</div>
                    ))}
                  </div>
                  {/* Subscriber rows - sortable by profit */}
                  <div style={{ maxHeight:400,overflowY:'auto' }}>
                    {[...contacts]
                      .filter(c => c.cost > 0 || c.profit > 0)
                      .sort((a,b) => (b.profit - b.cost) - (a.profit - a.cost))
                      .map(c => {
                        const net = c.profit - c.cost
                        return (
                          <div key={c.id} style={{ display:'grid',gridTemplateColumns:'2fr 1fr 1fr 1fr',gap:8,padding:'7px 10px',borderBottom:'1px solid rgba(255,255,255,.04)',alignItems:'center',cursor:'pointer' }}
                            onClick={()=>{ setSelected(c); setView('subscribers') }}>
                            <div>
                              <div style={{ fontSize:12,fontWeight:600,color:'#dde4f0' }}>{c.username}</div>
                              <div style={{ fontSize:10,color:'#475569' }}>{c.email}</div>
                            </div>
                            <div style={{ fontSize:12,color:'#f87171',fontWeight:600 }}>{fmt(c.cost)}</div>
                            <div style={{ fontSize:12,color:'#34d399',fontWeight:600 }}>{fmt(c.profit)}</div>
                            <div style={{ fontSize:12,fontWeight:700,color:net>=0?'#34d399':'#f87171' }}>{fmt(net)}</div>
                          </div>
                        )
                      })
                    }
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════════ ANALYTICS ════════════════════ */}
          {view === 'analytics' && (
            <div className="fu">
              <h2 style={{ fontSize:19,fontWeight:800,marginBottom:3 }}>Analytics</h2>
              <p style={{ color:'#475569',fontSize:13,marginBottom:20 }}>{total} subscribers · live from Supabase</p>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16 }}>
                <div className="card">
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700,marginBottom:15 }}>📋 Status Breakdown</h3>
                  {[['Active',active,'#34d399'],['Expiring Soon',expiring,'#f59e0b'],['Expired',expired,'#f87171']].map(([l,v,col])=>(
                    <div key={l} style={{ marginBottom:11 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:13 }}>
                        <span style={{ color:col,fontWeight:600 }}>{l}</span>
                        <span style={{ color:'#475569' }}>{v} <span style={{ color:'#334155',fontSize:11 }}>({total?Math.round(v/total*100):0}%)</span></span>
                      </div>
                      <div style={{ height:5,background:'rgba(255,255,255,.05)',borderRadius:4 }}>
                        <div style={{ height:'100%',width:`${total?v/total*100:0}%`,background:col,borderRadius:4 }}/>
                      </div>
                    </div>
                  ))}
                  {urgent.length > 0 && (
                    <div style={{ marginTop:14,padding:'9px 11px',background:'rgba(245,158,11,.07)',borderRadius:8,border:'1px solid rgba(245,158,11,.15)',fontSize:12,color:'#d97706' }}>
                      ⚠️ <strong>{urgent.length}</strong> subscriber{urgent.length!==1?'s':''} expiring within 14 days
                    </div>
                  )}
                </div>

                <div className="card">
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700,marginBottom:15 }}>🔗 Device Connections</h3>
                  {[['Single device (1)',total-multi,'#60a5fa'],['Multi-device (2+)',multi,'#a78bfa']].map(([l,v,col])=>(
                    <div key={l} style={{ marginBottom:11 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',marginBottom:4,fontSize:13 }}>
                        <span style={{ color:col,fontWeight:600 }}>{l}</span>
                        <span style={{ color:'#475569' }}>{v} <span style={{ color:'#334155',fontSize:11 }}>({total?Math.round(v/total*100):0}%)</span></span>
                      </div>
                      <div style={{ height:5,background:'rgba(255,255,255,.05)',borderRadius:4 }}>
                        <div style={{ height:'100%',width:`${total?v/total*100:0}%`,background:col,borderRadius:4 }}/>
                      </div>
                    </div>
                  ))}
                  <div style={{ marginTop:14 }}>
                    <div style={{ fontSize:12,color:'#475569',fontWeight:700,marginBottom:8 }}>Top email providers</div>
                    <div style={{ display:'flex',flexWrap:'wrap',gap:5 }}>
                      {domainCounts.map(([dom,count])=>(
                        <span key={dom} style={{ fontSize:11,background:'rgba(99,102,241,.1)',color:'#a78bfa',border:'1px solid rgba(99,102,241,.18)',borderRadius:6,padding:'2px 8px',fontWeight:600 }}>
                          {dom} <span style={{ opacity:.5 }}>{count}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="card" style={{ marginBottom:16 }}>
                <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700 }}>📅 Expiry by Month</h3>
                  {selectedMonth && (
                    <button onClick={()=>setSelectedMonth(null)}
                      style={{ background:'rgba(96,165,250,.1)',border:'1px solid rgba(96,165,250,.2)',borderRadius:7,padding:'4px 10px',color:'#60a5fa',fontSize:12,fontWeight:600,cursor:'pointer',fontFamily:'inherit' }}>
                      ✕ Clear selection
                    </button>
                  )}
                </div>
                {/* Bar chart */}
                <div style={{ display:'flex',alignItems:'flex-end',gap:5,height:130,marginBottom:4 }}>
                  {monthlyExpiry.map(([month,count])=>{
                    const h=Math.max(4,Math.round((count/maxMonth)*100))
                    const now=new Date().toISOString().slice(0,7)
                    const isPast=month<now, isNow=month===now
                    const isSelected=selectedMonth===month
                    const col=isSelected?'#6366f1':isPast?'#1e2d4a':isNow?'#f59e0b':'#38bdf8'
                    const textCol=isSelected?'#a78bfa':isPast?'#334155':isNow?'#f59e0b':'#38bdf8'
                    const [yr,mo]=month.split('-')
                    const label=MONTH_LABELS[parseInt(mo,10)-1]+' '+yr.slice(2)
                    return (
                      <div key={month}
                        onClick={()=>setSelectedMonth(isSelected?null:month)}
                        style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,minWidth:0,cursor:'pointer' }}
                        title={`${label}: ${count} subscribers`}>
                        <span style={{ fontSize:9.5,color:textCol,fontWeight:700 }}>{count}</span>
                        <div style={{ width:'100%',height:h,background:col,borderRadius:'3px 3px 0 0',
                          transition:'background .15s',
                          boxShadow:isSelected?'0 0 8px rgba(99,102,241,.5)':'none' }}/>
                        <span style={{ fontSize:9,color:isSelected?'#a78bfa':isPast?'#334155':'#94a3b8',whiteSpace:'nowrap',fontWeight:isSelected?700:400 }}>{label}</span>
                      </div>
                    )
                  })}
                </div>
                {/* Selected month subscriber list */}
                {selectedMonth && (()=>{
                  const [yr,mo]=selectedMonth.split('-')
                  const label=MONTH_LABELS[parseInt(mo,10)-1]+' 20'+yr.slice(2)
                  const monthSubs=contacts.filter(c=>c.expiration?.slice(0,7)===selectedMonth)
                    .sort((a,b)=>new Date(a.expiration)-new Date(b.expiration))
                  return (
                    <div style={{ marginTop:14,borderTop:'1px solid rgba(255,255,255,.07)',paddingTop:14 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10 }}>
                        <h4 style={{ fontSize:13,fontWeight:700,color:'#dde4f0' }}>
                          Subscribers expiring in <span style={{ color:'#a78bfa' }}>{label}</span>
                        </h4>
                        <span style={{ fontSize:12,color:'#475569' }}>{monthSubs.length} subscriber{monthSubs.length!==1?'s':''}</span>
                      </div>
                      <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:7,maxHeight:280,overflow:'auto' }}>
                        {monthSubs.map(c=>{
                          const sc=STATUS_COLOR[c.status]
                          return (
                            <div key={c.id}
                              onClick={()=>{ setView('subscribers'); setSelected(c); setSelectedMonth(null) }}
                              style={{ display:'flex',alignItems:'center',gap:10,padding:'9px 12px',
                                background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.06)',
                                borderRadius:9,cursor:'pointer',transition:'background .1s' }}
                              onMouseEnter={e=>e.currentTarget.style.background='rgba(99,102,241,.08)'}
                              onMouseLeave={e=>e.currentTarget.style.background='rgba(255,255,255,.03)'}>
                              <div style={{ width:32,height:32,borderRadius:'50%',
                                background:PALETTES[c.pal][0],border:`1px solid ${PALETTES[c.pal][1]}44`,
                                display:'flex',alignItems:'center',justifyContent:'center',
                                fontSize:11,fontWeight:700,color:PALETTES[c.pal][1],flexShrink:0 }}>
                                {c.avatar}
                              </div>
                              <div style={{ flex:1,minWidth:0 }}>
                                <div style={{ fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.username}</div>
                                <div style={{ fontSize:11,color:'#475569',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{c.email}</div>
                              </div>
                              <div style={{ textAlign:'right',flexShrink:0 }}>
                                <div style={{ fontSize:11,fontFamily:"'DM Mono',monospace",color:'#64748b' }}>{fmtDate(c.expiration)}</div>
                                <span style={{ fontSize:10,fontWeight:700,color:sc.text,background:sc.bg,
                                  border:`1px solid ${sc.border}`,padding:'1px 6px',borderRadius:4,display:'inline-block',marginTop:2 }}>
                                  {c.status}
                                </span>
                              </div>
                              <button
                                onClick={e=>{ e.stopPropagation(); setForm({ emailTo:c.email, emailToName:c.username, emailToSearch:c.email }); setModal('send-email'); loadModalTemplates() }}
                                style={{ background:'rgba(56,189,248,.1)',border:'none',color:'#38bdf8',borderRadius:6,
                                  padding:'5px 8px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600,flexShrink:0 }}>
                                ✉️
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}
              </div>

              {urgent.length > 0 && (
                <div style={{ background:'rgba(245,158,11,.04)',border:'1px solid rgba(245,158,11,.14)',borderRadius:13,padding:18 }}>
                  <h3 style={{ fontSize:13,color:'#f59e0b',fontWeight:700,marginBottom:13 }}>🚨 Expiring within 14 days</h3>
                  {urgent.sort((a,b)=>a.daysLeft-b.daysLeft).map(c=>(
                    <div key={c.id} style={{ display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 11px',background:'rgba(245,158,11,.05)',borderRadius:8,marginBottom:7,cursor:'pointer' }}
                      onClick={()=>{ setView('subscribers'); setSelected(c) }}>
                      <div style={{ display:'flex',gap:10,alignItems:'center' }}>
                        <span style={{ fontFamily:"'DM Mono',monospace",fontSize:11,color:'#475569' }}>{c.id}</span>
                        <span style={{ fontWeight:600,fontSize:13 }}>{c.username}</span>
                        <span style={{ fontSize:12,color:'#64748b' }}>{c.email}</span>
                      </div>
                      <span style={{ fontSize:12,color:'#f59e0b',fontWeight:700 }}>{c.daysLeft===0?'Today!':c.daysLeft===1?'Tomorrow':`${c.daysLeft} days`}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          {/* ════════════════════ EMAILS ════════════════════ */}
          {view === 'emails' && (
            <div className="fu">
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
                <div>
                  <h2 style={{ fontSize:19,fontWeight:800,marginBottom:3 }}>Emails</h2>
                  <p style={{ color:'#475569',fontSize:13 }}>Sent email history from this CRM</p>
                </div>
                <div style={{ display:'flex',gap:8,alignItems:'center' }}>
                  <span style={{ fontSize:12,color:'#334155' }}>{emailLog.length} sent</span>
                  <Btn onClick={()=>{ setForm({}); setModal('send-email'); loadModalTemplates() }}
                    style={{ background:'rgba(56,189,248,.13)',color:'#38bdf8',border:'1px solid rgba(56,189,248,.25)' }}>
                    ✉️ Compose Email
                  </Btn>
                  {emailLog.length > 0 && (
                    <Btn variant='ghost' size='sm' onClick={()=>loadTracking(emailLog)}>
                      ⟳ Refresh Opens
                    </Btn>
                  )}
                  {emailLog.length > 0 && (
                    <Btn variant='ghost' size='sm' onClick={()=>{
                      if (!window.confirm('Clear all email history? This cannot be undone.')) return
                      setEmailLog([]); localStorage.removeItem('miitv_email_log')
                    }}>🗑️ Clear History</Btn>
                  )}
                </div>
              </div>

              {emailLog.length === 0 ? (
                <div className="card" style={{ textAlign:'center',padding:'48px 24px',color:'#334155' }}>
                  <div style={{ fontSize:36,marginBottom:12 }}>✉️</div>
                  <div style={{ fontSize:15,fontWeight:600,color:'#475569',marginBottom:6 }}>No emails sent yet</div>
                  <div style={{ fontSize:13,marginBottom:20 }}>Emails you send from the CRM will appear here.</div>
                  <Btn onClick={()=>{ setForm({}); setModal('send-email'); loadModalTemplates() }}
                    style={{ background:'rgba(56,189,248,.13)',color:'#38bdf8',border:'1px solid rgba(56,189,248,.25)' }}>
                    ✉️ Send your first email
                  </Btn>
                </div>
              ) : (
                <div>
                  {/* Stats row */}
                  {(()=>{
                    const openedCount = emailLog.filter(e=>emailTracking[String(e.id)]?.open_count>0).length
                    const openRate = emailLog.length > 0 ? Math.round(openedCount/emailLog.length*100) : 0
                    return (
                      <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
                        {[
                          { label:'Total Sent', value: emailLog.length, color:'#38bdf8', icon:'📬', sub: null },
                          { label:'Opened', value: openedCount, color:'#34d399', icon:'👁️', sub: `${openRate}% open rate` },
                          { label:'This Month', value: emailLog.filter(e=>e.sentAt?.slice(0,7)===new Date().toISOString().slice(0,7)).length, color:'#a78bfa', icon:'📅', sub: null },
                          { label:'Unique Recipients', value: new Set(emailLog.map(e=>e.to)).size, color:'#f59e0b', icon:'👥', sub: null },
                        ].map(s=>(
                          <div key={s.label} className="card">
                            <div style={{ fontSize:10.5,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6 }}>{s.icon} {s.label}</div>
                            <div style={{ fontSize:22,fontWeight:800,color:s.color }}>{s.value}</div>
                            {s.sub && <div style={{ fontSize:11,color:'#475569',marginTop:3 }}>{s.sub}</div>}
                          </div>
                        ))}
                      </div>
                    )
                  })()}

                  {/* Email list */}
                  <div className="card" style={{ padding:0,overflow:'hidden' }}>
                    {/* Header */}
                    <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 2fr 110px 110px 80px',gap:0,padding:'10px 16px',
                      borderBottom:'1px solid rgba(255,255,255,.07)',background:'rgba(255,255,255,.02)' }}>
                      {['Recipient','Subject','Preview','Sent','Opened',''].map((h,i)=>(
                        <div key={i} style={{ fontSize:10.5,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em' }}>{h}</div>
                      ))}
                    </div>
                    {emailLog.map((e,i) => {
                      const sub = contacts.find(c => c.email === e.to)
                      const sc = sub ? STATUS_COLOR[sub.status] : null
                      const d = new Date(e.sentAt)
                      const dateStr = d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'})
                      const timeStr = d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'})
                      const tracking = emailTracking[String(e.id)]
                      const opened = tracking?.open_count > 0
                      return (
                        <div key={e.id}
                          style={{ display:'grid',gridTemplateColumns:'1fr 1fr 2fr 110px 110px 80px',gap:0,
                            padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.04)',
                            background:i%2===0?'transparent':'rgba(255,255,255,.01)',
                            transition:'background .1s',cursor:'pointer' }}
                          onMouseEnter={ev=>ev.currentTarget.style.background='rgba(56,189,248,.04)'}
                          onMouseLeave={ev=>ev.currentTarget.style.background=i%2===0?'transparent':'rgba(255,255,255,.01)'}
                          onClick={()=>setModal('view-email-'+e.id)}>
                          {/* Recipient */}
                          <div style={{ minWidth:0 }}>
                            <div style={{ fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                              {e.toName || e.to}
                            </div>
                            <div style={{ fontSize:11,color:'#475569',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',fontFamily:"'DM Mono',monospace" }}>
                              {e.to}
                            </div>
                            {sc && (
                              <span style={{ fontSize:10,fontWeight:700,color:sc.text,background:sc.bg,
                                border:`1px solid ${sc.border}`,padding:'1px 5px',borderRadius:4,display:'inline-block',marginTop:2 }}>
                                {sub.status}
                              </span>
                            )}
                          </div>
                          {/* Subject */}
                          <div style={{ fontSize:13,fontWeight:600,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:12,alignSelf:'center' }}>
                            {e.subject}
                          </div>
                          {/* Preview */}
                          <div style={{ fontSize:12,color:'#475569',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',paddingRight:12,alignSelf:'center' }}>
                            {e.body?.replace(/\n/g,' ').slice(0,80)}…
                          </div>
                          {/* Sent date */}
                          <div style={{ alignSelf:'center' }}>
                            <div style={{ fontSize:12,color:'#64748b' }}>{dateStr}</div>
                            <div style={{ fontSize:11,color:'#334155' }}>{timeStr}</div>
                          </div>
                          {/* Opened status */}
                          <div style={{ alignSelf:'center' }}>
                            {opened ? (
                              <div>
                                <span style={{ fontSize:11,fontWeight:700,color:'#34d399',background:'rgba(52,211,153,.1)',
                                  border:'1px solid rgba(52,211,153,.25)',borderRadius:6,padding:'2px 8px',display:'inline-block' }}>
                                  ✓ Opened {tracking.open_count > 1 ? `×${tracking.open_count}` : ''}
                                </span>
                                <div style={{ fontSize:10,color:'#334155',marginTop:3 }}>
                                  {new Date(tracking.opened_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}
                                </div>
                              </div>
                            ) : (
                              <span style={{ fontSize:11,color:'#334155',background:'rgba(255,255,255,.03)',
                                border:'1px solid rgba(255,255,255,.07)',borderRadius:6,padding:'2px 8px',display:'inline-block' }}>
                                — Not opened
                              </span>
                            )}
                          </div>
                          {/* Actions */}
                          <div style={{ display:'flex',gap:5,alignSelf:'center' }} onClick={ev=>ev.stopPropagation()}>
                            <button
                              title="Send again"
                              onClick={()=>{ setForm({ emailTo:e.to, emailToName:e.toName, emailToSearch:e.to, emailSubject:e.subject, emailBody:e.body }); setModal('send-email'); loadModalTemplates() }}
                              style={{ background:'rgba(56,189,248,.1)',border:'none',color:'#38bdf8',borderRadius:6,
                                padding:'5px 8px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>
                              ↩️
                            </button>
                            <button
                              title="Delete"
                              onClick={()=>{
                                const updated = emailLog.filter(x=>x.id!==e.id)
                                setEmailLog(updated)
                                localStorage.setItem('miitv_email_log', JSON.stringify(updated))
                              }}
                              style={{ background:'rgba(248,113,113,.1)',border:'none',color:'#f87171',borderRadius:6,
                                padding:'5px 8px',fontSize:11,cursor:'pointer',fontFamily:'inherit',fontWeight:600 }}>
                              🗑️
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* View email modal */}
              {emailLog.map(e => modal === 'view-email-'+e.id && (()=>{
                const tracking = emailTracking[String(e.id)]
                const opened = tracking?.open_count > 0
                return (
                <Modal key={e.id} title="✉️ Sent Email" onClose={()=>setModal(null)}>
                  <div style={{ marginBottom:12,padding:'10px 12px',background:'rgba(255,255,255,.03)',borderRadius:9 }}>
                    <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:3 }}>To</div>
                    <div style={{ fontSize:13,color:'#38bdf8' }}>{e.toName} &lt;{e.to}&gt;</div>
                  </div>
                  <div style={{ marginBottom:12,padding:'10px 12px',background:'rgba(255,255,255,.03)',borderRadius:9 }}>
                    <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:3 }}>Subject</div>
                    <div style={{ fontSize:13,fontWeight:600,color:'#dde4f0' }}>{e.subject}</div>
                  </div>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12 }}>
                    <div style={{ padding:'10px 12px',background:'rgba(255,255,255,.03)',borderRadius:9 }}>
                      <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:3 }}>Sent</div>
                      <div style={{ fontSize:12,color:'#64748b' }}>{new Date(e.sentAt).toLocaleString('en-GB')}</div>
                    </div>
                    <div style={{ padding:'10px 12px',borderRadius:9,
                      background: opened ? 'rgba(52,211,153,.07)' : 'rgba(255,255,255,.03)',
                      border: opened ? '1px solid rgba(52,211,153,.2)' : '1px solid transparent' }}>
                      <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:3 }}>Open Status</div>
                      {opened ? (
                        <div>
                          <div style={{ fontSize:13,fontWeight:700,color:'#34d399' }}>
                            ✓ Opened {tracking.open_count > 1 ? `${tracking.open_count} times` : ''}
                          </div>
                          <div style={{ fontSize:11,color:'#475569',marginTop:2 }}>
                            First: {new Date(tracking.opened_at).toLocaleString('en-GB')}
                          </div>
                          {tracking.open_count > 1 && (
                            <div style={{ fontSize:11,color:'#334155',marginTop:1 }}>
                              Last: {new Date(tracking.last_opened).toLocaleString('en-GB')}
                            </div>
                          )}
                        </div>
                      ) : (
                        <div style={{ fontSize:13,color:'#334155' }}>— Not opened yet</div>
                      )}
                    </div>
                  </div>
                  <div style={{ marginBottom:16 }}>
                    <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:6 }}>Message</div>
                    <pre style={{ fontSize:12,color:'#94a3b8',lineHeight:1.7,whiteSpace:'pre-wrap',
                      fontFamily:"'Sora',sans-serif",background:'rgba(0,0,0,.2)',padding:12,borderRadius:8 }}>
                      {e.body}
                    </pre>
                  </div>
                  <div style={{ display:'flex',gap:8 }}>
                    <Btn variant='ghost' onClick={()=>setModal(null)} style={{ flex:1 }}>Close</Btn>
                    <Btn onClick={()=>{ setForm({ emailTo:e.to, emailToName:e.toName, emailToSearch:e.to, emailSubject:e.subject, emailBody:e.body }); setModal('send-email'); loadModalTemplates() }}
                      style={{ flex:1,background:'rgba(56,189,248,.13)',color:'#38bdf8',border:'1px solid rgba(56,189,248,.25)' }}>
                      ↩️ Send Again
                    </Btn>
                  </div>
                </Modal>
                )
              })())}
            </div>
          )}

                    {/* ════════════════════ REFERRALS ════════════════════ */}
          {view === 'referrals' && (()=>{
            const rewarded   = referrals.filter(r=>r.status==='rewarded')
            const pending    = referrals.filter(r=>r.status==='pending')
            const signedUp   = referrals.filter(r=>r.status==='signed_up')

            // Per-referrer stats
            const referrerMap = {}
            referrals.forEach(r => {
              if (!r.referrer_id) return
              if (!referrerMap[r.referrer_id]) referrerMap[r.referrer_id] = { total:0, rewarded:0, signedUp:0 }
              referrerMap[r.referrer_id].total++
              if (r.status==='rewarded') referrerMap[r.referrer_id].rewarded++
              if (r.status==='signed_up') referrerMap[r.referrer_id].signedUp++
            })

            async function addReferral() {
              const referrerId = parseInt(form.refReferrerId)
              if (!form.refReferredEmail || !referrerId) return
              setSaving(true)
              const { error } = await supabase.from('referrals').insert({
                referrer_id:    referrerId,
                referred_email: form.refReferredEmail.trim(),
                referred_name:  form.refReferredName?.trim() || null,
                status:         'pending',
                notes:          form.refNotes?.trim() || null,
              })
              if (!error) {
                setModal(null); setForm({})
                const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false })
                setReferrals(data || [])
              }
              setSaving(false)
            }

            async function updateStatus(id, status) {
              await supabase.from('referrals').update({ status, updated_at: new Date().toISOString() }).eq('id', id)
              const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false })
              setReferrals(data || [])
            }

            async function deleteReferral(id) {
              if (!window.confirm('Delete this referral?')) return
              await supabase.from('referrals').delete().eq('id', id)
              const { data } = await supabase.from('referrals').select('*').order('created_at', { ascending: false })
              setReferrals(data || [])
            }

            const STATUS_PILL = {
              pending:   { label:'Pending',    bg:'rgba(245,158,11,.12)', color:'#f59e0b',  border:'rgba(245,158,11,.25)' },
              signed_up: { label:'Signed Up',  bg:'rgba(96,165,250,.12)', color:'#60a5fa',  border:'rgba(96,165,250,.25)' },
              rewarded:  { label:'Rewarded ✓', bg:'rgba(52,211,153,.12)', color:'#34d399',  border:'rgba(52,211,153,.25)' },
            }

            // Top referrers (sorted by total)
            const topReferrers = Object.entries(referrerMap)
              .map(([id, stats]) => ({ sub: contacts.find(c=>String(c.id)===id), ...stats }))
              .filter(r=>r.sub)
              .sort((a,b)=>b.total-a.total)
              .slice(0, 5)

            return (
            <div className="fu">
              {/* Header */}
              <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:20 }}>
                <div>
                  <h2 style={{ fontSize:19,fontWeight:800,marginBottom:3 }}>🎁 Refer a Friend</h2>
                  <p style={{ color:'#475569',fontSize:13 }}>Track referrals · 1 month free per referral · 6 referrals = 12 months FREE</p>
                </div>
                <Btn onClick={()=>{ setForm({ refReferrerId:'' }); setModal('add-referral') }}
                  style={{ background:'rgba(52,211,153,.12)',color:'#34d399',border:'1px solid rgba(52,211,153,.25)' }}>
                  + Log Referral
                </Btn>
              </div>

              {/* Stats cards */}
              <div style={{ display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:20 }}>
                {[
                  { label:'Total Referrals', value:referrals.length,  color:'#38bdf8', icon:'🔗' },
                  { label:'Pending',         value:pending.length,     color:'#f59e0b', icon:'⏳' },
                  { label:'Signed Up',       value:signedUp.length,    color:'#60a5fa', icon:'✅' },
                  { label:'Rewarded',        value:rewarded.length,    color:'#34d399', icon:'🎉' },
                ].map(s=>(
                  <div key={s.label} className="card">
                    <div style={{ fontSize:10.5,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em',marginBottom:6 }}>{s.icon} {s.label}</div>
                    <div style={{ fontSize:22,fontWeight:800,color:s.color }}>{s.value}</div>
                  </div>
                ))}
              </div>

              <div style={{ display:'grid',gridTemplateColumns:'1fr 320px',gap:16,alignItems:'start' }}>
                {/* Referral list */}
                <div className="card" style={{ padding:0,overflow:'hidden' }}>
                  <div style={{ padding:'14px 16px',borderBottom:'1px solid rgba(255,255,255,.07)',display:'flex',justifyContent:'space-between',alignItems:'center' }}>
                    <span style={{ fontSize:13,fontWeight:700,color:'#dde4f0' }}>All Referrals</span>
                    <span style={{ fontSize:12,color:'#334155' }}>{referrals.length} total</span>
                  </div>
                  {/* Column headers */}
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr 120px 100px',gap:0,padding:'9px 16px',
                    borderBottom:'1px solid rgba(255,255,255,.07)',background:'rgba(255,255,255,.02)' }}>
                    {['Referred By','Referred Friend','Date','Status',''].map((h,i)=>(
                      <div key={i} style={{ fontSize:10.5,color:'#475569',fontWeight:700,textTransform:'uppercase',letterSpacing:'.06em' }}>{h}</div>
                    ))}
                  </div>
                  {referrals.length === 0 ? (
                    <div style={{ padding:'40px 24px',textAlign:'center',color:'#334155' }}>
                      <div style={{ fontSize:32,marginBottom:10 }}>🎁</div>
                      <div style={{ fontSize:14,fontWeight:600,color:'#475569',marginBottom:6 }}>No referrals yet</div>
                      <div style={{ fontSize:12,marginBottom:16 }}>Log your first referral to start tracking rewards.</div>
                      <Btn onClick={()=>{ setForm({ refReferrerId:'' }); setModal('add-referral') }}
                        style={{ background:'rgba(52,211,153,.12)',color:'#34d399',border:'1px solid rgba(52,211,153,.25)' }}>
                        + Log First Referral
                      </Btn>
                    </div>
                  ) : referrals.map((r,i)=>{
                    const referrer = contacts.find(c=>c.id===r.referrer_id)
                    const referred = contacts.find(c=>c.id===r.referred_id)
                    const pill = STATUS_PILL[r.status] || STATUS_PILL.pending
                    const refCount = referrerMap[r.referrer_id]?.total || 0
                    const isMilestone = refCount >= 6
                    return (
                      <div key={r.id} style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr 120px 100px',gap:0,
                        padding:'12px 16px',borderBottom:'1px solid rgba(255,255,255,.04)',
                        background:i%2===0?'transparent':'rgba(255,255,255,.01)' }}>
                        {/* Referrer */}
                        <div style={{ alignSelf:'center' }}>
                          <div style={{ display:'flex',alignItems:'center',gap:7 }}>
                            <div style={{ fontWeight:600,fontSize:13,color:'#dde4f0' }}>{referrer?.username || '—'}</div>
                            {isMilestone && <span title="6+ referrals — milestone reached!" style={{ fontSize:14 }}>🏆</span>}
                          </div>
                          {referrer && <div style={{ fontSize:11,color:'#475569' }}>{refCount} referral{refCount!==1?'s':''}</div>}
                        </div>
                        {/* Referred */}
                        <div style={{ alignSelf:'center' }}>
                          <div style={{ fontWeight:600,fontSize:13,color:'#dde4f0' }}>{r.referred_name || referred?.username || '—'}</div>
                          <div style={{ fontSize:11,color:'#475569' }}>{r.referred_email}</div>
                        </div>
                        {/* Date */}
                        <div style={{ alignSelf:'center',fontSize:12,color:'#64748b' }}>
                          {new Date(r.created_at).toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}
                        </div>
                        {/* Status pill + dropdown */}
                        <div style={{ alignSelf:'center' }}>
                          <select value={r.status} onChange={e=>updateStatus(r.id, e.target.value)}
                            style={{ background:pill.bg,border:`1px solid ${pill.border}`,color:pill.color,
                              borderRadius:6,padding:'3px 8px',fontSize:11,fontWeight:700,fontFamily:'inherit',cursor:'pointer',outline:'none' }}>
                            <option value="pending">⏳ Pending</option>
                            <option value="signed_up">✅ Signed Up</option>
                            <option value="rewarded">🎉 Rewarded</option>
                          </select>
                        </div>
                        {/* Actions */}
                        <div style={{ alignSelf:'center',display:'flex',gap:5 }}>
                          <button title="Send referral email" onClick={()=>{
                            const sub = referrer
                            setForm({ emailTo: sub?.email||'', emailToName: sub?.username||'', emailToSearch: sub?.email||'',
                              emailSubject: '🎁 Your MiiTV Referral Reward!',
                              emailBody: `Hi ${sub?.username||'there'},

Great news! Your referral of ${r.referred_name||r.referred_email} has been confirmed.

As a thank you, you have earned 1 month FREE on your MiiTV subscription!

${refCount >= 6 ? `🏆 AMAZING — you have hit 6 referrals and earned 12 MONTHS FREE TV!

` : ''}Keep referring friends to earn more free months.

Thanks for spreading the word!
The MiiTV Team` })
                            setModal('send-email'); loadModalTemplates()
                          }}
                            style={{ background:'rgba(56,189,248,.1)',border:'1px solid rgba(56,189,248,.2)',color:'#38bdf8',
                              borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:12,fontFamily:'inherit' }}>✉️</button>
                          <button title="Delete referral" onClick={()=>deleteReferral(r.id)}
                            style={{ background:'rgba(248,113,113,.08)',border:'1px solid rgba(248,113,113,.2)',color:'#f87171',
                              borderRadius:6,padding:'4px 8px',cursor:'pointer',fontSize:12,fontFamily:'inherit' }}>🗑️</button>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Right panel: Top referrers + milestone tracker */}
                <div style={{ display:'flex',flexDirection:'column',gap:14 }}>
                  {/* Milestone info */}
                  <div style={{ background:'linear-gradient(135deg,rgba(245,158,11,.08),rgba(251,191,36,.04))',
                    border:'1px solid rgba(245,158,11,.2)',borderRadius:13,padding:18 }}>
                    <div style={{ fontSize:13,fontWeight:800,color:'#f59e0b',marginBottom:10 }}>🏆 Referral Rewards</div>
                    <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                        background:'rgba(52,211,153,.06)',border:'1px solid rgba(52,211,153,.15)',borderRadius:9 }}>
                        <span style={{ fontSize:20 }}>🎁</span>
                        <div>
                          <div style={{ fontSize:12,fontWeight:700,color:'#34d399' }}>1 Referral</div>
                          <div style={{ fontSize:11,color:'#475569' }}>1 month FREE TV</div>
                        </div>
                      </div>
                      <div style={{ display:'flex',alignItems:'center',gap:10,padding:'10px 12px',
                        background:'rgba(245,158,11,.06)',border:'1px solid rgba(245,158,11,.2)',borderRadius:9 }}>
                        <span style={{ fontSize:20 }}>🏆</span>
                        <div>
                          <div style={{ fontSize:12,fontWeight:700,color:'#f59e0b' }}>6 Referrals</div>
                          <div style={{ fontSize:11,color:'#475569' }}>12 months FREE TV!</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Top referrers leaderboard */}
                  <div className="card">
                    <div style={{ fontSize:12,fontWeight:700,color:'#64748b',marginBottom:12 }}>🥇 Top Referrers</div>
                    {topReferrers.length === 0 ? (
                      <div style={{ fontSize:12,color:'#334155',textAlign:'center',padding:'12px 0' }}>No referrals yet</div>
                    ) : topReferrers.map((r,i)=>{
                      const pct = Math.min(100, Math.round((r.total/6)*100))
                      const medals = ['🥇','🥈','🥉','4️⃣','5️⃣']
                      return (
                        <div key={r.sub.id} style={{ marginBottom:14 }}>
                          <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:5 }}>
                            <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                              <span style={{ fontSize:14 }}>{medals[i]||'·'}</span>
                              <span style={{ fontSize:13,fontWeight:600,color:'#dde4f0' }}>{r.sub.username}</span>
                              {r.total >= 6 && <span style={{ fontSize:11 }}>🏆</span>}
                            </div>
                            <span style={{ fontSize:12,color:'#475569' }}>{r.total}/6</span>
                          </div>
                          {/* Progress bar to milestone */}
                          <div style={{ height:6,background:'rgba(255,255,255,.06)',borderRadius:3,overflow:'hidden' }}>
                            <div style={{ height:6,borderRadius:3,width:`${pct}%`,transition:'width .4s',
                              background: r.total >= 6
                                ? 'linear-gradient(90deg,#f59e0b,#fbbf24)'
                                : 'linear-gradient(90deg,#34d399,#38bdf8)' }} />
                          </div>
                          <div style={{ fontSize:10,color:'#334155',marginTop:3 }}>
                            {r.total >= 6 ? '🎉 Milestone reached! 12 months FREE' : `${6 - r.total} more to 12-month milestone`}
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Quick stats */}
                  <div className="card">
                    <div style={{ fontSize:12,fontWeight:700,color:'#64748b',marginBottom:12 }}>📊 Reward Summary</div>
                    <div style={{ display:'flex',flexDirection:'column',gap:8 }}>
                      <div style={{ display:'flex',justifyContent:'space-between',fontSize:13 }}>
                        <span style={{ color:'#475569' }}>Free months awarded</span>
                        <span style={{ fontWeight:700,color:'#34d399' }}>{rewarded.length} months</span>
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',fontSize:13 }}>
                        <span style={{ color:'#475569' }}>Milestones (6 refs)</span>
                        <span style={{ fontWeight:700,color:'#f59e0b' }}>{Object.values(referrerMap).filter(r=>r.total>=6).length}</span>
                      </div>
                      <div style={{ display:'flex',justifyContent:'space-between',fontSize:13 }}>
                        <span style={{ color:'#475569' }}>Awaiting reward</span>
                        <span style={{ fontWeight:700,color:'#60a5fa' }}>{signedUp.length}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Add Referral Modal */}
              {modal === 'add-referral' && (
                <Modal title="+ Log Referral" onClose={()=>{ setModal(null); setForm({}) }}>
                  <div style={{ marginBottom:12,position:'relative' }}>
                    <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Referred By (existing subscriber) *</label>
                    {/* Show selected subscriber name if one is chosen */}
                    {form.refReferrerId && !form.refReferrerSearch ? (()=>{
                      const sel = contacts.find(c=>String(c.id)===String(form.refReferrerId))
                      return sel ? (
                        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',
                          background:'rgba(52,211,153,.06)',border:'1px solid rgba(52,211,153,.2)',
                          borderRadius:8,padding:'9px 12px' }}>
                          <div>
                            <span style={{ fontSize:13,fontWeight:600,color:'#34d399' }}>{sel.username}</span>
                            <span style={{ fontSize:12,color:'#475569',marginLeft:8 }}>{sel.email}</span>
                          </div>
                          <button onClick={()=>setForm(f=>({...f,refReferrerId:'',refReferrerSearch:''}))}
                            style={{ background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:14,fontFamily:'inherit' }}>✕</button>
                        </div>
                      ) : null
                    })() : (
                      <div style={{ position:'relative' }}>
                        <input
                          value={form.refReferrerSearch||''}
                          onChange={e=>setForm(f=>({...f,refReferrerSearch:e.target.value,refReferrerId:''}))}
                          placeholder="Search by name or email…"
                          autoComplete="off"
                          style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',
                            borderRadius:8,padding:'9px 12px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none',boxSizing:'border-box' }}
                        />
                        {form.refReferrerSearch && (()=>{
                          const q = form.refReferrerSearch.toLowerCase()
                          const filtered = contacts
                            .filter(c=>c.username?.toLowerCase().includes(q)||c.email?.toLowerCase().includes(q))
                            .sort((a,b)=>a.username.localeCompare(b.username))
                            .slice(0,8)
                          if (!filtered.length) return (
                            <div style={{ position:'absolute',top:'100%',left:0,right:0,zIndex:50,
                              background:'#131c2e',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,
                              padding:'10px 14px',fontSize:12,color:'#475569',marginTop:3 }}>
                              No subscribers found
                            </div>
                          )
                          return (
                            <div style={{ position:'absolute',top:'100%',left:0,right:0,zIndex:50,
                              background:'#131c2e',border:'1px solid rgba(255,255,255,.12)',borderRadius:8,
                              overflow:'hidden',marginTop:3,boxShadow:'0 8px 24px rgba(0,0,0,.4)' }}>
                              {filtered.map(c=>(
                                <div key={c.id}
                                  onClick={()=>setForm(f=>({...f,refReferrerId:String(c.id),refReferrerSearch:''}))}
                                  style={{ padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid rgba(255,255,255,.05)',
                                    transition:'background .1s' }}
                                  onMouseEnter={e=>e.currentTarget.style.background='rgba(52,211,153,.07)'}
                                  onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
                                  <span style={{ fontSize:13,fontWeight:600,color:'#dde4f0' }}>{c.username}</span>
                                  <span style={{ fontSize:12,color:'#475569',marginLeft:8 }}>{c.email}</span>
                                </div>
                              ))}
                            </div>
                          )
                        })()}
                      </div>
                    )}
                  </div>
                  <Input label="Friend's Name" placeholder="Jane Smith" value={form.refReferredName||''} onChange={e=>setForm(f=>({...f,refReferredName:e.target.value}))} />
                  <Input label="Friend's Email *" placeholder="jane@email.com" value={form.refReferredEmail||''} onChange={e=>setForm(f=>({...f,refReferredEmail:e.target.value}))} />
                  <div style={{ marginBottom:16 }}>
                    <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Notes (optional)</label>
                    <textarea value={form.refNotes||''} onChange={e=>setForm(f=>({...f,refNotes:e.target.value}))} rows={3}
                      placeholder="e.g. Friend signed up on 8 March"
                      style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'9px 12px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none',resize:'vertical' }} />
                  </div>
                  {/* Show current referral count for selected referrer */}
                  {form.refReferrerId && (()=>{
                    const count = referrerMap[parseInt(form.refReferrerId)]?.total || 0
                    const newCount = count + 1
                    return (
                      <div style={{ marginBottom:14,padding:'10px 12px',borderRadius:9,
                        background: newCount >= 6 ? 'rgba(245,158,11,.08)' : 'rgba(52,211,153,.06)',
                        border: newCount >= 6 ? '1px solid rgba(245,158,11,.2)' : '1px solid rgba(52,211,153,.15)' }}>
                        <div style={{ fontSize:12,fontWeight:700,color: newCount >= 6 ? '#f59e0b' : '#34d399' }}>
                          {newCount >= 6 ? '🏆 MILESTONE! This will be their 6th referral — 12 months FREE TV!' : `🎁 This will be referral #${newCount} — they earn 1 month free!`}
                        </div>
                        <div style={{ fontSize:11,color:'#475569',marginTop:3 }}>{count} existing referral{count!==1?'s':''} on record</div>
                      </div>
                    )
                  })()}
                  <div style={{ display:'flex',gap:8 }}>
                    <Btn variant='ghost' onClick={()=>{ setModal(null); setForm({}) }} style={{ flex:1 }}>Cancel</Btn>
                    <Btn onClick={addReferral} disabled={saving||!form.refReferredEmail||!form.refReferrerId}
                      style={{ flex:1,background:'rgba(52,211,153,.13)',color:'#34d399',border:'1px solid rgba(52,211,153,.25)' }}>
                      {saving ? 'Saving…' : '+ Log Referral'}
                    </Btn>
                  </div>
                </Modal>
              )}
            </div>
            )
          })()}

          {/* ════════════════════ SETTINGS ════════════════════ */}
          {view === 'settings' && (
            <div className="fu">
              <h2 style={{ fontSize:19,fontWeight:800,marginBottom:3 }}>Settings</h2>
              <p style={{ color:'#475569',fontSize:13,marginBottom:22 }}>Manage your account, users, email templates and sync preferences</p>
              <div className="settings-grid" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }}>

                {/* ── Company Profile ── */}
                <div className="card" style={{ gridColumn:'1/-1' }}>
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700,marginBottom:16 }}>🏢 Company Profile</h3>
                  <div className="company-inner" style={{ display:'grid',gridTemplateColumns:'auto 1fr',gap:20,alignItems:'start' }}>
                    {/* Logo upload */}
                    <div className="company-logo-col" style={{ display:'flex',flexDirection:'column',alignItems:'center',gap:10 }}>
                      <div style={{ width:80,height:80,borderRadius:12,overflow:'hidden',background:'rgba(255,255,255,.05)',border:'2px solid rgba(255,255,255,.1)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0 }}>
                        {company.logo
                          ? <img src={company.logo} alt="Logo" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                          : <span style={{ fontSize:28,fontWeight:800,color:'#38bdf8' }}>{(company.name||'M')[0].toUpperCase()}</span>
                        }
                      </div>
                      <label style={{ cursor:'pointer',fontSize:11,color:'#60a5fa',fontWeight:600,textAlign:'center' }}>
                        {company.logo ? '🔄 Change Logo' : '📷 Upload Logo'}
                        <input type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{
                          const file = e.target.files?.[0]
                          if (!file) return
                          const reader = new FileReader()
                          reader.onload = ev => saveCompany({ ...company, logo: ev.target.result })
                          reader.readAsDataURL(file)
                        }} />
                      </label>
                      {company.logo && (
                        <button onClick={()=>saveCompany({...company,logo:null})}
                          style={{ background:'none',border:'none',color:'#f87171',fontSize:11,cursor:'pointer',fontFamily:'inherit' }}>
                          ✕ Remove
                        </button>
                      )}
                    </div>
                    {/* Fields */}
                    <div className="company-fields" style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
                      <div>
                        <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Company Name</label>
                        <input value={company.name||''} onChange={e=>setCompany(c=>({...c,name:e.target.value}))}
                          placeholder="MiiTV"
                          style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 11px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Tagline / Type</label>
                        <input value={company.tagline||''} onChange={e=>setCompany(c=>({...c,tagline:e.target.value}))}
                          placeholder="CRM"
                          style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 11px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Contact Email</label>
                        <input value={company.email||''} onChange={e=>setCompany(c=>({...c,email:e.target.value}))}
                          placeholder="hello@miitv.com"
                          style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 11px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Phone</label>
                        <input value={company.phone||''} onChange={e=>setCompany(c=>({...c,phone:e.target.value}))}
                          placeholder="+44 7700 000000"
                          style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 11px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Website</label>
                        <input value={company.website||''} onChange={e=>setCompany(c=>({...c,website:e.target.value}))}
                          placeholder="https://miitv.com"
                          style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 11px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }} />
                      </div>
                      <div>
                        <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Address</label>
                        <input value={company.address||''} onChange={e=>setCompany(c=>({...c,address:e.target.value}))}
                          placeholder="London, UK"
                          style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 11px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }} />
                      </div>
                      <div style={{ gridColumn:'1/-1' }}>
                        <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Email Signature <span style={{fontWeight:400,color:'#334155'}}>— appended to outgoing emails</span></label>
                        <input value={company.emailSignature||''} onChange={e=>setCompany(c=>({...c,emailSignature:e.target.value}))}
                          placeholder="The MiiTV Team"
                          style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'8px 11px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }} />
                      </div>
                      <div style={{ gridColumn:'1/-1',display:'flex',justifyContent:'flex-end',gap:8,marginTop:4 }}>
                        <Btn onClick={()=>saveCompany(company)} style={{ minWidth:120 }}>💾 Save Profile</Btn>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="card" style={{ gridColumn:'1/-1' }}>
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700,marginBottom:16 }}>👤 Your Account</h3>
                  <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:16 }} className="two-col">
                    <div>
                      <div style={{ padding:'10px 12px',background:'rgba(255,255,255,.03)',borderRadius:9,marginBottom:12 }}>
                        <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:3 }}>Logged in as</div>
                        <div style={{ fontSize:13,color:'#94a3b8' }}>{user?.email}</div>
                      </div>
                      <div style={{ padding:'10px 12px',background:'rgba(255,255,255,.03)',borderRadius:9,marginBottom:16 }}>
                        <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:3 }}>Account ID</div>
                        <div style={{ fontSize:11,color:'#334155',fontFamily:"'DM Mono',monospace",wordBreak:'break-all' }}>{user?.id}</div>
                      </div>
                      <Btn variant='danger' onClick={signOut} style={{ width:'100%' }}>🚪 Sign Out</Btn>
                    </div>
                    <div>
                      <div style={{ fontSize:12,color:'#475569',fontWeight:700,marginBottom:12 }}>🔑 Change Password</div>
                      <ChangePasswordForm />
                    </div>
                  </div>
                </div>

                <div className="card">
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700,marginBottom:6 }}>👥 Invite Team Member</h3>
                  <p style={{ fontSize:12,color:'#475569',marginBottom:14 }}>Send an invite so another person can log into this CRM.</p>
                  <InviteUserForm supabase={supabase} />
                </div>

                <div className="card">
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700,marginBottom:6 }}>🔄 Google Sheet Sync</h3>
                  <p style={{ fontSize:12,color:'#475569',marginBottom:14 }}>Pull the latest subscribers from your Google Sheet into the database.</p>
                  <div style={{ padding:'10px 12px',background:'rgba(255,255,255,.03)',borderRadius:9,marginBottom:14 }}>
                    <div style={{ fontSize:11,color:'#475569',fontWeight:700,marginBottom:3 }}>Sheet ID</div>
                    <div style={{ fontSize:11,color:'#334155',fontFamily:"'DM Mono',monospace",wordBreak:'break-all' }}>1PyK_0gHfe59Q9V0c2gSxX6FDgDaN4hFOITgtXN1WNzw</div>
                  </div>
                  <Btn onClick={syncSheet} disabled={syncing} style={{ width:'100%' }}>{syncing?'⟳ Syncing…':'⟳ Sync Now'}</Btn>
                  {syncMsg && <div style={{ marginTop:10,fontSize:12,color:syncMsg.startsWith('✓')?'#34d399':'#f87171',textAlign:'center' }}>{syncMsg}</div>}
                  <div style={{ marginTop:14,padding:'10px 12px',background:'rgba(96,165,250,.05)',border:'1px solid rgba(96,165,250,.12)',borderRadius:9,fontSize:12,color:'#60a5fa' }}>
                    💡 To auto-sync daily, add to <code style={{fontSize:11}}>vercel.json</code>:<br/>
                    <code style={{ fontSize:10,color:'#94a3b8',display:'block',marginTop:6 }}>{`{"crons":[{"path":"/api/sync-sheet","schedule":"0 6 * * *"}]}`}</code>
                  </div>
                </div>

                <div className="card" style={{ gridColumn:'1/-1' }}>
                  <h3 style={{ fontSize:13,color:'#64748b',fontWeight:700,marginBottom:6 }}>📧 Renewal Email Templates</h3>
                  <p style={{ fontSize:12,color:'#475569',marginBottom:16 }}>Ready-to-use templates for contacting subscribers whose subscriptions are expiring. Copy and paste into your email client.</p>
                  <EmailTemplates
                    urgent={urgent}
                    subscribers={contacts}
                    onSend={(emailData, bulk) => {
                      setForm({
                        ...emailData,
                        sendMode: bulk ? 'bulk' : 'individual',
                        bulkGroup: bulk ? emailData.bulkGroup : undefined,
                        bulkStatus: undefined, bulkDone: 0, bulkErrors: []
                      })
                      setView('subscribers') // switch back to main view
                      setTimeout(() => { setModal('send-email'); loadModalTemplates() }, 50)
                    }}
                  />
                </div>

              </div>
            </div>
          )}
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div style={{ width:282,borderLeft:'1px solid rgba(255,255,255,.07)',padding:18,overflow:'auto',background:'rgba(255,255,255,.01)',flexShrink:0 }}>
            <div style={{ display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16 }}>
              <span style={{ fontSize:11,fontWeight:700,color:'#475569',textTransform:'uppercase',letterSpacing:'.06em' }}>Subscriber</span>
              <Btn variant='ghost' size='sm' onClick={()=>setSelected(null)}>✕</Btn>
            </div>
            {(()=>{
              const [abg,atxt]=PALETTES[selected.pal]
              const sc=STATUS_COLOR[selected.status]
              return (
                <>
                  <div style={{ display:'flex',alignItems:'center',gap:11,marginBottom:18 }}>
                    <div style={{ width:48,height:48,borderRadius:'50%',background:abg,border:`2px solid ${atxt}44`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:17,fontWeight:700,color:atxt }}>{selected.avatar}</div>
                    <div>
                      <div style={{ fontSize:15,fontWeight:800 }}>{selected.username}</div>
                      <div style={{ fontSize:11,color:'#334155',marginTop:2,fontFamily:"'DM Mono',monospace" }}>#{selected.id}</div>
                      <span style={{ marginTop:5,display:'inline-block',fontSize:11,fontWeight:700,color:sc.text,background:sc.bg,border:`1px solid ${sc.border}`,padding:'2px 8px',borderRadius:5 }}>{selected.status}</span>
                    </div>
                  </div>
                  {[
                    ['Email',selected.email,true],
                    ['Expires',fmtDate(selected.expiration),false],
                    ['Time',selected.daysLeft<0?`Expired ${Math.abs(selected.daysLeft)}d ago`:`${selected.daysLeft} days remaining`,false],
                    ['Connections',String(selected.conns),false],
                    ['Cost',selected.cost ? '£' + Number(selected.cost).toFixed(2) : '—',false],
                    ['Profit',selected.profit ? '£' + Number(selected.profit).toFixed(2) : '—',false],
                  ].map(([l,v,mono])=>(
                    <div key={l} style={{ marginBottom:9,padding:'9px 11px',background:'rgba(255,255,255,.02)',borderRadius:8,border:'1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ fontSize:10.5,color:'#475569',fontWeight:700,marginBottom:3 }}>{l}</div>
                      <div style={{ fontSize:12,color:'#94a3b8',fontFamily:mono?"'DM Mono',monospace":'inherit',wordBreak:'break-all' }}>{v}</div>
                    </div>
                  ))}
                  {selected.notes && (
                    <div style={{ marginBottom:9,padding:'9px 11px',background:'rgba(255,255,255,.02)',borderRadius:8,border:'1px solid rgba(255,255,255,.05)' }}>
                      <div style={{ fontSize:10.5,color:'#475569',fontWeight:700,marginBottom:3 }}>Notes</div>
                      <div style={{ fontSize:12,color:'#94a3b8' }}>{selected.notes}</div>
                    </div>
                  )}
                  {/* ── Referral info ── */}
                  {(()=>{
                    // Who referred this subscriber?
                    const refBy = referrals.find(r => r.referred_email === selected.email || r.referred_id === selected.id)
                    const referrer = refBy ? contacts.find(c => c.id === refBy.referrer_id) : null
                    // Who has this subscriber referred?
                    const theyReferred = referrals.filter(r => r.referrer_id === selected.id)
                    if (!referrer && theyReferred.length === 0) return null
                    return (
                      <div style={{ marginBottom:9,padding:'9px 11px',background:'rgba(167,139,250,.05)',borderRadius:8,border:'1px solid rgba(167,139,250,.15)' }}>
                        <div style={{ fontSize:10.5,color:'#a78bfa',fontWeight:700,marginBottom:6 }}>🎁 Referrals</div>
                        {referrer && (
                          <div style={{ marginBottom:6 }}>
                            <div style={{ fontSize:10,color:'#475569',marginBottom:2 }}>Referred by</div>
                            <div style={{ fontSize:12,color:'#dde4f0',fontWeight:600,cursor:'pointer' }}
                              onClick={()=>setSelected(contacts.find(c=>c.id===referrer.id)||selected)}>
                              {referrer.username} <span style={{ color:'#475569',fontSize:10 }}>#{referrer.id}</span>
                            </div>
                          </div>
                        )}
                        {theyReferred.length > 0 && (
                          <div>
                            <div style={{ fontSize:10,color:'#475569',marginBottom:4 }}>Referred {theyReferred.length} subscriber{theyReferred.length!==1?'s':''}</div>
                            {theyReferred.map(r => {
                              const refContact = contacts.find(c => c.email === r.referred_email || c.id === r.referred_id)
                              const sc = r.status === 'rewarded' ? '#34d399' : r.status === 'signed_up' ? '#60a5fa' : '#f59e0b'
                              return (
                                <div key={r.id} style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'4px 0',borderTop:'1px solid rgba(255,255,255,.05)',cursor: refContact?'pointer':'default' }}
                                  onClick={()=>{ if(refContact) setSelected(refContact) }}>
                                  <div>
                                    <div style={{ fontSize:11,color:'#dde4f0' }}>{r.referred_name || r.referred_email}</div>
                                    <div style={{ fontSize:10,color:'#475569' }}>{r.referred_email}</div>
                                  </div>
                                  <span style={{ fontSize:9,fontWeight:700,color:sc,background:sc+'22',padding:'2px 6px',borderRadius:4,whiteSpace:'nowrap' }}>
                                    {r.status}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                  <div style={{ display:'flex',gap:8,marginTop:4,flexWrap:'wrap' }}>
                    <Btn onClick={()=>{ setForm({ type:'note' }); setModal('add-note') }} style={{ flex:1 }}>+ Note</Btn>
                    <Btn onClick={()=>{ setForm({ emailTo: selected.email, emailToName: selected.username, emailToSearch: selected.email }); setModal('send-email'); loadModalTemplates() }} style={{ flex:1, background:'rgba(56,189,248,.13)', color:'#38bdf8', border:'1px solid rgba(56,189,248,.25)' }}>✉️ Email</Btn>
                    <Btn onClick={()=>{ setForm({ refReferrerId: String(selected.id), refReferrerSearch: selected.username }); setModal('add-referral') }} style={{ flex:'1 1 100%', background:'rgba(167,139,250,.1)', color:'#a78bfa', border:'1px solid rgba(167,139,250,.25)', fontSize:11 }}>🎁 Link Referral</Btn>
                    <Btn variant='danger' onClick={()=>deleteSubscriber(selected)} style={{ flex:'1 1 100%', fontSize:11 }}>🗑️ Remove from CRM</Btn>
                  </div>
                </>
              )
            })()}
          </div>
        )}
      </div>

      {modal === 'send-email' && (() => {
        // ── Compute group lists ──
        const groupDefs = [
          { id:'expiring14', label:'⚠️ Expiring in 14 days',  color:'#f59e0b', subs: contacts.filter(c => c.daysLeft >= 0 && c.daysLeft <= 14) },
          { id:'expiring30', label:'🟡 Expiring in 30 days',  color:'#f59e0b', subs: contacts.filter(c => c.daysLeft >= 0 && c.daysLeft <= 30) },
          { id:'expired',    label:'❌ Expired subscribers',  color:'#f87171', subs: contacts.filter(c => c.status === 'Expired') },
          { id:'active',     label:'✅ All active',           color:'#34d399', subs: contacts.filter(c => c.status === 'Active') },
          { id:'all',        label:'👥 All subscribers',      color:'#60a5fa', subs: contacts },
        ]
        const isBulk = !!form.bulkGroup
        const bulkGroup = groupDefs.find(g => g.id === form.bulkGroup)
        const recipients = bulkGroup?.subs || []
        const bulkDone = form.bulkDone || 0
        const bulkTotal = form.bulkTotal || recipients.length
        const isSending = form.bulkStatus === 'sending'
        const isDone = form.bulkStatus === 'done' || form.bulkStatus === 'done-with-errors'

        return (
          <Modal title="✉️ Compose Email" onClose={()=>{ setModal(null); setForm({}); setModalTemplates([]) }} wide>

            {/* ── Mode toggle ── */}
            <div style={{ display:'flex', gap:6, marginBottom:16, background:'rgba(255,255,255,.03)', borderRadius:9, padding:4 }}>
              {[['individual','👤 Individual'],['bulk','👥 Group / Bulk'],['pick','✔️ Pick Users']].map(([mode,lbl]) => (
                <button key={mode}
                  onClick={() => { setForm(f => ({ ...f, sendMode: mode, bulkGroup: mode==='individual'?undefined:f.bulkGroup, bulkStatus:undefined, bulkDone:0 })); setSelectedSubs([]); setSubPickSearch('') }}
                  style={{ flex:1, cursor:'pointer', border:'none', borderRadius:7, padding:'8px 0', fontFamily:'inherit', fontSize:12, fontWeight:700,
                    background: (form.sendMode||'individual')===mode ? 'rgba(96,165,250,.18)' : 'none',
                    color: (form.sendMode||'individual')===mode ? '#60a5fa' : '#475569' }}>
                  {lbl}
                </button>
              ))}
            </div>

            {/* ── Individual: subscriber search ── */}
            {(form.sendMode||'individual') === 'individual' && (
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>To — Subscriber</label>
                <input
                  list="sub-email-list"
                  placeholder="Search by name or email…"
                  value={form.emailToSearch || form.emailTo || ''}
                  onChange={e => {
                    const val = e.target.value
                    setForm(f => ({ ...f, emailToSearch: val }))
                    const match = contacts.find(s =>
                      s.email?.toLowerCase() === val.toLowerCase() ||
                      s.username?.toLowerCase() === val.toLowerCase()
                    )
                    if (match) {
                      const daysLeft = match.daysLeft ?? Math.round((new Date(match.expiration) - new Date()) / 86400000)
                      const daysStr = daysLeft < 0 ? `${Math.abs(daysLeft)}` : `${daysLeft}`
                      setForm(f => {
                        const newForm = { ...f, emailTo: match.email, emailToName: match.username, emailToSearch: match.email }
                        // Re-apply template if already loaded — fill in [days]
                        if (f.emailBody) {
                          newForm.emailBody = f.emailBody
                            .replace(/\[Name\]/g, match.username || match.email)
                            .replace(/\[date\]/g, fmtDate(match.expiration) || '[date]')
                            .replace(/\[days\]/g, daysStr)
                        }
                        return newForm
                      })
                    }
                  }}
                  style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'9px 12px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }}
                />
                <datalist id="sub-email-list">
                  {subscribers.map(s => <option key={s.id} value={s.email} label={s.username} />)}
                </datalist>
                {form.emailTo && (
                  <div style={{ marginTop:6,padding:'6px 10px',background:'rgba(56,189,248,.07)',border:'1px solid rgba(56,189,248,.18)',borderRadius:7,fontSize:12,color:'#38bdf8',display:'flex',justifyContent:'space-between' }}>
                    <span>📬 <strong>{form.emailToName}</strong> &lt;{form.emailTo}&gt;</span>
                    <button onClick={()=>setForm(f=>({...f,emailTo:'',emailToName:'',emailToSearch:''}))}
                      style={{background:'none',border:'none',color:'#475569',cursor:'pointer',fontSize:12}}>✕</button>
                  </div>
                )}
              </div>
            )}

            {/* ── Bulk: group picker ── */}
            {form.sendMode === 'bulk' && (
              <div style={{ marginBottom:12 }}>
                <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:8 }}>Send to Group</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:7 }}>
                  {groupDefs.map(g => (
                    <button key={g.id}
                      onClick={() => setForm(f => ({ ...f, bulkGroup: g.id, bulkStatus: undefined, bulkDone: 0 }))}
                      style={{ cursor:'pointer', padding:'10px 12px', borderRadius:9, fontFamily:'inherit', fontSize:12, fontWeight:600,
                        textAlign:'left', border:'1px solid',
                        background: form.bulkGroup===g.id ? `rgba(${g.color==='#f59e0b'?'245,158,11':g.color==='#f87171'?'248,113,113':g.color==='#34d399'?'52,211,153':'96,165,250'},.1)` : 'rgba(255,255,255,.03)',
                        borderColor: form.bulkGroup===g.id ? g.color+'55' : 'rgba(255,255,255,.08)',
                        color: form.bulkGroup===g.id ? g.color : '#64748b' }}>
                      <div>{g.label}</div>
                      <div style={{ fontSize:11, opacity:.7, marginTop:2 }}>{g.subs.length} subscriber{g.subs.length!==1?'s':''}</div>
                    </button>
                  ))}
                </div>
                {bulkGroup && (
                  <div style={{ marginTop:10, padding:'8px 12px', background:'rgba(255,255,255,.03)', borderRadius:8, fontSize:12, color:'#475569' }}>
                    <strong style={{color:'#dde4f0'}}>{recipients.length}</strong> emails will be sent · <span style={{color:'#334155'}}>Use [Name] and [date] in body — personalised per recipient</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Pick Users: searchable checkbox list ── */}
            {form.sendMode === 'pick' && (
              <div style={{ marginBottom:12 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                  <label style={{ fontSize:11,color:'#475569',fontWeight:700 }}>Select Recipients <span style={{color:'#334155',fontWeight:400}}>(addresses hidden from each other)</span></label>
                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={()=>setSelectedSubs(contacts.map(c=>c.id))}
                      style={{ cursor:'pointer',background:'none',border:'1px solid rgba(255,255,255,.1)',borderRadius:6,padding:'3px 8px',fontSize:11,color:'#60a5fa',fontFamily:'inherit' }}>
                      Select All
                    </button>
                    <button onClick={()=>setSelectedSubs([])}
                      style={{ cursor:'pointer',background:'none',border:'1px solid rgba(255,255,255,.1)',borderRadius:6,padding:'3px 8px',fontSize:11,color:'#475569',fontFamily:'inherit' }}>
                      Clear
                    </button>
                  </div>
                </div>
                <input placeholder="🔍 Search subscribers…" value={subPickSearch} onChange={e=>setSubPickSearch(e.target.value)}
                  style={{ width:'100%',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.09)',borderRadius:8,padding:'8px 12px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none',marginBottom:8 }} />
                <div style={{ maxHeight:220, overflowY:'auto', border:'1px solid rgba(255,255,255,.07)', borderRadius:9, background:'rgba(255,255,255,.02)' }}>
                  {contacts.filter(c => {
                    const q = subPickSearch.toLowerCase()
                    return !q || c.username?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)
                  }).map(c => {
                    const checked = selectedSubs.includes(c.id)
                    const sc = STATUS_COLOR[c.status]
                    return (
                      <div key={c.id} onClick={()=>setSelectedSubs(prev => checked ? prev.filter(id=>id!==c.id) : [...prev, c.id])}
                        style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 12px', cursor:'pointer',
                          borderBottom:'1px solid rgba(255,255,255,.04)',
                          background: checked ? 'rgba(96,165,250,.07)' : 'transparent' }}>
                        <div style={{ width:16, height:16, borderRadius:4, flexShrink:0, border:`2px solid ${checked?'#60a5fa':'rgba(255,255,255,.2)'}`,
                          background: checked ? '#60a5fa' : 'transparent', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {checked && <span style={{ color:'#000', fontSize:10, fontWeight:900, lineHeight:1 }}>✓</span>}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:'#dde4f0', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{c.username}</div>
                          <div style={{ fontSize:11, color:'#475569', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                            {c.email.replace(/(.{2})(.*)(@.*)/, '$1***$3')}
                          </div>
                        </div>
                        <span style={{ fontSize:10, fontWeight:700, color:sc.text, background:sc.bg, border:`1px solid ${sc.border}`, padding:'2px 6px', borderRadius:5, flexShrink:0, whiteSpace:'nowrap' }}>{c.status}</span>
                        {c.daysLeft <= 30 && c.daysLeft >= 0 && <span style={{ fontSize:10, color:'#f59e0b' }}>⏳{c.daysLeft}d</span>}
                      </div>
                    )
                  })}
                </div>
                {selectedSubs.length > 0 && (
                  <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(96,165,250,.06)', border:'1px solid rgba(96,165,250,.18)', borderRadius:8, fontSize:12, color:'#60a5fa', display:'flex', justifyContent:'space-between' }}>
                    <span>✔️ <strong>{selectedSubs.length}</strong> subscriber{selectedSubs.length!==1?'s':''} selected</span>
                    <span style={{ color:'#334155' }}>📬 Sent individually · addresses hidden</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Template picker ── */}
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Load Template (optional)</label>
              <select
                value={form.emailTemplateId || ''}
                onChange={e => {
                  const val = e.target.value
                  setForm(f => ({ ...f, emailTemplateId: val }))
                  if (!val) return
                  const t = modalTemplates.find(t => t.id === val)
                  if (t) {
                    // Use contacts (enriched) so daysLeft is already calculated
                    const sub = contacts.find(s => s.email === form.emailTo)
                    const indDaysLeft = sub?.daysLeft !== undefined ? sub.daysLeft
                      : sub?.expiration ? Math.round((new Date(sub.expiration) - new Date()) / 86400000)
                      : null
                    const indDaysStr = indDaysLeft === null ? '[days]'
                      : indDaysLeft < 0 ? `${Math.abs(indDaysLeft)}`
                      : `${indDaysLeft}`
                    const body = t.body
                      .replace(/\[Name\]/g, sub?.username || form.emailToName || '[Name]')
                      .replace(/\[date\]/g, fmtDate(sub?.expiration) || '[date]')
                      .replace(/\[days\]/g, indDaysStr)
                    setForm(f => ({ ...f, emailTemplateId: val, emailSubject: t.subject, emailBody: form.sendMode==='bulk'?t.body:body }))
                  }
                }}
                style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'9px 12px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none' }}>
                <option value="">— Choose a template —</option>
                {modalTemplates.map(t=><option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
            </div>

            {/* ── Subject ── */}
            <Input label="Subject" placeholder="Email subject…" value={form.emailSubject||''} onChange={e=>setForm(f=>({...f,emailSubject:e.target.value}))} />

            {/* ── Body ── */}
            <div style={{ marginBottom:12 }}>
              <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>
                Message {form.sendMode==='bulk' && <span style={{color:'#334155',fontWeight:400}}>— [Name], [date] and [days] auto-filled per recipient</span>}
              </label>
              <textarea value={form.emailBody||''} onChange={e=>setForm(f=>({...f,emailBody:e.target.value}))} rows={8}
                style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'9px 12px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none',resize:'vertical' }} />
            </div>

            {/* ── Bulk progress ── */}
            {form.sendMode === 'bulk' && isSending && (
              <div style={{ marginBottom:12, padding:'12px', background:'rgba(56,189,248,.06)', border:'1px solid rgba(56,189,248,.15)', borderRadius:9 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, color:'#38bdf8', marginBottom:8 }}>
                  <span>⟳ Sending… {bulkDone} of {bulkTotal}</span>
                  <span>{bulkTotal > 0 ? Math.round((bulkDone/bulkTotal)*100) : 0}%</span>
                </div>
                <div style={{ height:6, background:'rgba(255,255,255,.08)', borderRadius:3 }}>
                  <div style={{ height:6, background:'#38bdf8', borderRadius:3, width:`${bulkTotal>0?(bulkDone/bulkTotal)*100:0}%`, transition:'width .3s' }} />
                </div>
              </div>
            )}
            {form.sendMode === 'bulk' && isDone && (
              <div style={{ marginBottom:12, padding:'12px', background: form.bulkErrors?.length ? 'rgba(248,113,113,.07)' : 'rgba(52,211,153,.07)', border:`1px solid ${form.bulkErrors?.length?'rgba(248,113,113,.2)':'rgba(52,211,153,.2)'}`, borderRadius:9 }}>
                <div style={{ fontSize:13, fontWeight:700, color: form.bulkErrors?.length ? '#f87171' : '#34d399', marginBottom:4 }}>
                  {form.bulkErrors?.length ? `⚠️ Sent ${bulkDone} of ${bulkTotal} — ${form.bulkErrors.length} failed` : `✓ All ${bulkDone} emails sent successfully!`}
                </div>
                {form.bulkErrors?.length > 0 && (
                  <div style={{ fontSize:11, color:'#f87171' }}>Failed: {form.bulkErrors.join(', ')}</div>
                )}
              </div>
            )}

            {/* ── Individual status ── */}
            {(form.sendMode||'individual') === 'individual' && form.emailStatus === 'sending' && (
              <div style={{ marginBottom:12,padding:'9px 12px',background:'rgba(56,189,248,.06)',border:'1px solid rgba(56,189,248,.15)',borderRadius:8,fontSize:13,color:'#38bdf8' }}>⟳ Sending…</div>
            )}
            {(form.sendMode||'individual') === 'individual' && form.emailStatus === 'sent' && (
              <div style={{ marginBottom:12,padding:'9px 12px',background:'rgba(52,211,153,.07)',border:'1px solid rgba(52,211,153,.2)',borderRadius:8,fontSize:13,color:'#34d399' }}>✓ Email sent!</div>
            )}
            {(form.sendMode||'individual') === 'individual' && form.emailStatus?.startsWith('error') && (
              <div style={{ marginBottom:12,padding:'9px 12px',background:'rgba(248,113,113,.07)',border:'1px solid rgba(248,113,113,.2)',borderRadius:8,fontSize:12,color:'#f87171' }}>✗ {form.emailStatus}</div>
            )}

            {/* ── Footer info ── */}
            {!form.emailStatus && !isSending && !isDone && (
              <div style={{ marginBottom:12,display:'flex',alignItems:'center',gap:8,padding:'8px 11px',background:'rgba(255,255,255,.03)',border:'1px solid rgba(255,255,255,.07)',borderRadius:8,fontSize:12,color:'#475569' }}>
                <span>📬</span>
                <span>From <strong style={{color:'#dde4f0'}}>{company.name||'MiiTV'}</strong> · via EmailJS</span>
              </div>
            )}

            <div style={{ display:'flex',gap:8 }}>
              <Btn variant='ghost' onClick={()=>{ setModal(null); setForm({}) }} style={{ flex:1 }}>{isDone ? 'Close' : 'Cancel'}</Btn>
              {!isDone && (form.sendMode||'individual') === 'individual' && (
                <Btn onClick={sendEmail}
                  disabled={saving || !form.emailTo || !form.emailSubject || !form.emailBody || form.emailStatus==='sent'}
                  style={{ flex:2, background:'rgba(56,189,248,.15)', color:'#38bdf8', border:'1px solid rgba(56,189,248,.3)' }}>
                  {saving ? '⟳ Sending…' : '✉️ Send Email'}
                </Btn>
              )}
              {!isDone && form.sendMode === 'bulk' && (
                <Btn onClick={()=>sendBulkEmail(recipients)}
                  disabled={saving || !form.bulkGroup || !form.emailSubject || !form.emailBody || recipients.length === 0}
                  style={{ flex:2, background:'rgba(167,139,250,.15)', color:'#a78bfa', border:'1px solid rgba(167,139,250,.3)' }}>
                  {saving ? `⟳ Sending ${bulkDone}/${bulkTotal}…` : `📨 Send to ${recipients.length} Subscriber${recipients.length!==1?'s':''}`}
                </Btn>
              )}
              {!isDone && form.sendMode === 'pick' && (
                <Btn onClick={()=>sendMultiEmail(contacts.filter(c=>selectedSubs.includes(c.id)))}
                  disabled={saving || selectedSubs.length===0 || !form.emailSubject || !form.emailBody}
                  style={{ flex:2, background:'rgba(96,165,250,.15)', color:'#60a5fa', border:'1px solid rgba(96,165,250,.3)' }}>
                  {saving ? `⟳ Sending ${form.bulkDone||0}/${selectedSubs.length}…` : `✔️ Send to ${selectedSubs.length} Selected`}
                </Btn>
              )}
            </div>
          </Modal>
        )
      })()}
      {modal === 'add-cost' && (
        <Modal title="Add Cost" onClose={()=>setModal(null)}>
          <Select label="Category" value={form.category||'Hosting'} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
            {COST_CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </Select>
          <Input label="Amount (£)" type="number" step="0.01" placeholder="0.00" value={form.amount||''} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />
          <Input label="Date" type="date" value={form.date||''} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
          <Input label="Description (optional)" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <Btn variant='ghost' onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={saveCost} disabled={saving} style={{ flex:2 }}>{saving?'Saving…':'Save Cost'}</Btn>
          </div>
        </Modal>
      )}

      {modal === 'add-revenue' && (
        <Modal title="Add Revenue" onClose={()=>setModal(null)}>
          <Select label="Plan" value={form.plan||'monthly'} onChange={e=>setForm(f=>({...f,plan:e.target.value}))}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="other">Other</option>
          </Select>
          <Input label="Amount (£)" type="number" step="0.01" placeholder="0.00" value={form.amount||''} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />
          <Input label="Date" type="date" value={form.date||''} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
          <Input label="Subscriber ID (optional)" type="number" value={form.subscriber_id||''} onChange={e=>setForm(f=>({...f,subscriber_id:e.target.value}))} />
          <Input label="Notes (optional)" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <Btn variant='ghost' onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={saveRevenue} disabled={saving} style={{ flex:2 }}>{saving?'Saving…':'Save Revenue'}</Btn>
          </div>
        </Modal>
      )}

      {modal === 'add-note' && (
        <Modal title={`Note for ${selected?.username}`} onClose={()=>setModal(null)}>
          <Select label="Type" value={form.type||'note'} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
            <option value="note">Note</option>
            <option value="contact">Contacted</option>
            <option value="renewal">Renewal</option>
          </Select>
          <div style={{ marginBottom:12 }}>
            <label style={{ display:'block',fontSize:11,color:'#475569',fontWeight:700,marginBottom:5 }}>Note</label>
            <textarea value={form.note||''} onChange={e=>setForm(f=>({...f,note:e.target.value}))} rows={4}
              style={{ width:'100%',background:'rgba(255,255,255,.05)',border:'1px solid rgba(255,255,255,.1)',borderRadius:8,padding:'9px 12px',color:'#dde4f0',fontFamily:'inherit',fontSize:13,outline:'none',resize:'vertical' }} />
          </div>
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <Btn variant='ghost' onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={saveNote} disabled={saving} style={{ flex:2 }}>{saving?'Saving…':'Save Note'}</Btn>
          </div>
        </Modal>
      )}

      {modal === 'edit-cost' && (
        <Modal title="Edit Cost" onClose={()=>setModal(null)}>
          <Select label="Category" value={form.category||'Hosting'} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
            {COST_CATEGORIES.map(c=><option key={c}>{c}</option>)}
          </Select>
          <Input label="Amount (£)" type="number" step="0.01" value={form.amount||''} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />
          <Input label="Date" type="date" value={form.date||''} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
          <Input label="Description (optional)" value={form.description||''} onChange={e=>setForm(f=>({...f,description:e.target.value}))} />
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <Btn variant='ghost' onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={updateCost} disabled={saving} style={{ flex:2 }}>{saving?'Saving…':'Save Changes'}</Btn>
          </div>
        </Modal>
      )}

      {modal === 'confirm-delete-cost' && (
        <Modal title="Delete Cost Entry" onClose={()=>setModal(null)}>
          <div style={{ padding:'14px',background:'rgba(248,113,113,.07)',borderRadius:10,marginBottom:16,fontSize:13,color:'#94a3b8' }}>
            <div style={{ fontWeight:700,color:'#f87171',marginBottom:6 }}>Are you sure?</div>
            <div><strong>{form.category}</strong> — {form.date}</div>
            <div style={{ fontSize:16,fontWeight:700,color:'#f87171',marginTop:4 }}>£{Number(form.amount).toFixed(2)}</div>
            {form.description && <div style={{ fontSize:12,color:'#475569',marginTop:4 }}>{form.description}</div>}
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <Btn variant='ghost' onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn variant='danger' onClick={()=>deleteCost(form.id)} style={{ flex:1 }}>Delete</Btn>
          </div>
        </Modal>
      )}

      {modal === 'edit-revenue' && (
        <Modal title="Edit Revenue" onClose={()=>setModal(null)}>
          <Select label="Plan" value={form.plan||'monthly'} onChange={e=>setForm(f=>({...f,plan:e.target.value}))}>
            <option value="monthly">Monthly</option>
            <option value="annual">Annual</option>
            <option value="other">Other</option>
          </Select>
          <Input label="Amount (£)" type="number" step="0.01" value={form.amount||''} onChange={e=>setForm(f=>({...f,amount:e.target.value}))} />
          <Input label="Date" type="date" value={form.date||''} onChange={e=>setForm(f=>({...f,date:e.target.value}))} />
          <Input label="Subscriber ID (optional)" type="number" value={form.subscriber_id||''} onChange={e=>setForm(f=>({...f,subscriber_id:e.target.value}))} />
          <Input label="Notes (optional)" value={form.notes||''} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} />
          <div style={{ display:'flex',gap:8,marginTop:8 }}>
            <Btn variant='ghost' onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn onClick={updateRevenue} disabled={saving} style={{ flex:2 }}>{saving?'Saving…':'Save Changes'}</Btn>
          </div>
        </Modal>
      )}

      {modal === 'confirm-delete-revenue' && (
        <Modal title="Delete Revenue Entry" onClose={()=>setModal(null)}>
          <div style={{ padding:'14px',background:'rgba(248,113,113,.07)',borderRadius:10,marginBottom:16,fontSize:13,color:'#94a3b8' }}>
            <div style={{ fontWeight:700,color:'#f87171',marginBottom:6 }}>Are you sure?</div>
            <div><strong>{form.plan || 'Payment'}</strong> — {form.date}</div>
            <div style={{ fontSize:16,fontWeight:700,color:'#34d399',marginTop:4 }}>£{Number(form.amount).toFixed(2)}</div>
            {form.notes && <div style={{ fontSize:12,color:'#475569',marginTop:4 }}>{form.notes}</div>}
          </div>
          <div style={{ display:'flex',gap:8 }}>
            <Btn variant='ghost' onClick={()=>setModal(null)} style={{ flex:1 }}>Cancel</Btn>
            <Btn variant='danger' onClick={()=>deleteRevenue(form.id)} style={{ flex:1 }}>Delete</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}

