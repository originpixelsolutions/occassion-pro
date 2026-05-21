'use client'

/**
 * Vendor Portal — Profile
 * GET /vendor-portal/me
 * PUT /vendor-portal/me        { name, business_name, phone, website, category, bio }
 * PUT /vendor-portal/me/bank   { bank_name, account_number, ifsc_code, account_holder_name, upi_id }
 */

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  User, Building2, Phone, Globe, Tag, FileText,
  CreditCard, Save, Loader2, AlertCircle, CheckCircle2,
} from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/v1'

const CATEGORIES = [
  'Catering','Photography','Decor','AV','Transport',
  'Security','Entertainment','Venue','Floral','Cake',
  'Makeup','Invitations','Lighting','Staffing','Other',
]

interface VendorProfile {
  id: string
  name: string
  email: string
  business_name: string | null
  phone: string | null
  website: string | null
  category: string
  bio: string | null
  bank_details?: {
    bank_name: string | null
    account_number: string | null
    ifsc_code: string | null
    account_holder_name: string | null
    upi_id: string | null
  } | null
}

export default function VendorProfilePage() {
  const router = useRouter()

  const [profile, setProfile]       = useState<VendorProfile | null>(null)
  const [loading, setLoading]       = useState(true)
  const [saving, setSaving]         = useState(false)
  const [savingBank, setSavingBank] = useState(false)
  const [error, setError]           = useState('')
  const [bankError, setBankError]   = useState('')
  const [saved, setSaved]           = useState(false)
  const [bankSaved, setBankSaved]   = useState(false)

  // Profile fields
  const [name, setName]           = useState('')
  const [business, setBusiness]   = useState('')
  const [phone, setPhone]         = useState('')
  const [website, setWebsite]     = useState('')
  const [category, setCategory]   = useState('Other')
  const [bio, setBio]             = useState('')

  // Bank fields
  const [bankName, setBankName]         = useState('')
  const [accountNum, setAccountNum]     = useState('')
  const [ifsc, setIfsc]                 = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [upiId, setUpiId]               = useState('')

  useEffect(() => {
    const session = localStorage.getItem('vp_session')
    if (!session) { router.replace('/vendor/login'); return }

    fetch(`${API}/vendor-portal/me`, { headers: { 'X-Vendor-Session': session } })
      .then(r => {
        if (r.status === 401) { router.replace('/vendor/login'); return null }
        return r.json()
      })
      .then(data => {
        if (!data) return
        const v: VendorProfile = data.vendor ?? data
        setProfile(v)
        setName(v.name ?? '')
        setBusiness(v.business_name ?? '')
        setPhone(v.phone ?? '')
        setWebsite(v.website ?? '')
        setCategory(v.category ?? 'Other')
        setBio(v.bio ?? '')
        const b = v.bank_details
        if (b) {
          setBankName(b.bank_name ?? '')
          setAccountNum(b.account_number ?? '')
          setIfsc(b.ifsc_code ?? '')
          setAccountHolder(b.account_holder_name ?? '')
          setUpiId(b.upi_id ?? '')
        }
      })
      .catch(() => setError('Failed to load profile.'))
      .finally(() => setLoading(false))
  }, [router])

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    const session = localStorage.getItem('vp_session')
    if (!session) return
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch(`${API}/vendor-portal/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Vendor-Session': session },
        body: JSON.stringify({
          name: name.trim(),
          business_name: business.trim() || undefined,
          phone: phone.trim() || undefined,
          website: website.trim() || undefined,
          category,
          bio: bio.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.message ?? 'Failed to save.'); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      // Update localStorage name
      const vp = localStorage.getItem('vp_vendor')
      if (vp) {
        try {
          const v = JSON.parse(vp)
          localStorage.setItem('vp_vendor', JSON.stringify({ ...v, name: name.trim() }))
        } catch {}
      }
    } catch {
      setError('Network error.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveBank(e: React.FormEvent) {
    e.preventDefault()
    const session = localStorage.getItem('vp_session')
    if (!session) return
    setSavingBank(true); setBankError(''); setBankSaved(false)
    try {
      const res = await fetch(`${API}/vendor-portal/me/bank`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'X-Vendor-Session': session },
        body: JSON.stringify({
          bank_name: bankName.trim() || undefined,
          account_number: accountNum.trim() || undefined,
          ifsc_code: ifsc.trim() || undefined,
          account_holder_name: accountHolder.trim() || undefined,
          upi_id: upiId.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setBankError(data.message ?? 'Failed to save bank details.'); return }
      setBankSaved(true)
      setTimeout(() => setBankSaved(false), 3000)
    } catch {
      setBankError('Network error.')
    } finally {
      setSavingBank(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <Loader2 className="w-6 h-6 text-zinc-500 animate-spin" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Profile</h1>
        <p className="text-sm text-zinc-500 mt-1">Manage your vendor profile and payment details.</p>
      </div>

      {/* Profile Form */}
      <form onSubmit={handleSaveProfile} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-white">Business Information</h2>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Full Name *</label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                required
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="col-span-2">
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Business Name</label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={business}
                onChange={e => setBusiness(e.target.value)}
                placeholder="Your company or brand name"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Phone</label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={phone}
                onChange={e => setPhone(e.target.value)}
                placeholder="+91 99999 99999"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Website</label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <input
                value={website}
                onChange={e => setWebsite(e.target.value)}
                placeholder="https://yoursite.com"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="col-span-2">
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Category</label>
            <div className="relative">
              <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-zinc-300 focus:outline-none focus:border-cyan-500 appearance-none"
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          <div className="col-span-2">
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Bio / About</label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 w-4 h-4 text-zinc-500" />
              <textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Brief description of your services…"
                rows={3}
                className="w-full bg-zinc-800 border border-zinc-700 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-zinc-500 resize-none focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Email (read-only) */}
        {profile?.email && (
          <div>
            <label className="text-xs text-zinc-600 font-medium mb-1.5 block">Email (cannot change)</label>
            <input
              value={profile.email}
              disabled
              className="w-full bg-zinc-800/50 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-600 cursor-not-allowed"
            />
          </div>
        )}

        {error && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          {saving ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : saved ? (
            <><CheckCircle2 className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save Profile</>
          )}
        </button>
      </form>

      {/* Bank Details Form */}
      <form onSubmit={handleSaveBank} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-emerald-400" />
          <h2 className="text-sm font-semibold text-white">Payment / Bank Details</h2>
        </div>
        <p className="text-xs text-zinc-500">Used for processing event payments. Stored securely.</p>

        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Account Holder Name</label>
            <input
              value={accountHolder}
              onChange={e => setAccountHolder(e.target.value)}
              placeholder="Name as on bank account"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Bank Name</label>
            <input
              value={bankName}
              onChange={e => setBankName(e.target.value)}
              placeholder="e.g. HDFC Bank"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">IFSC Code</label>
            <input
              value={ifsc}
              onChange={e => setIfsc(e.target.value.toUpperCase())}
              placeholder="HDFC0001234"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">Account Number</label>
            <input
              value={accountNum}
              onChange={e => setAccountNum(e.target.value)}
              placeholder="Your bank account number"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500 font-mono"
            />
          </div>

          <div className="col-span-2">
            <label className="text-xs text-zinc-400 font-medium mb-1.5 block">UPI ID (optional)</label>
            <input
              value={upiId}
              onChange={e => setUpiId(e.target.value)}
              placeholder="yourname@upi"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {bankError && (
          <div className="flex items-center gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
            <p className="text-xs text-red-400">{bankError}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={savingBank}
          className="flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50 text-white font-medium text-sm px-5 py-2.5 rounded-xl transition-colors"
        >
          {savingBank ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
          ) : bankSaved ? (
            <><CheckCircle2 className="w-4 h-4" /> Saved!</>
          ) : (
            <><Save className="w-4 h-4" /> Save Bank Details</>
          )}
        </button>
      </form>
    </div>
  )
}
