'use client'

import { useEffect, useState, FormEvent } from 'react'

interface VendorProfile {
  id: string
  name: string
  business_name?: string
  email: string
  phone?: string
  category: string
  website?: string
  bio?: string
  avatar_url?: string
  gstin?: string
  city?: string
  state?: string
  country?: string
}

interface BankDetails {
  bank_account_name?: string
  bank_account_number?: string
  bank_ifsc?: string
  bank_name?: string
  upi_id?: string
}

type Tab = 'profile' | 'bank'

const VENDOR_CATEGORIES = [
  'Catering', 'Photography', 'Videography', 'Decoration', 'Music & DJ',
  'Lighting', 'Sound & AV', 'Venue', 'Transportation', 'Security',
  'Florist', 'Wedding Planner', 'Event Host / MC', 'Artist Management',
  'Costume & Styling', 'Printing & Stationery', 'Tech & Streaming', 'Other',
]

function InputField({
  label, name, value, onChange, type = 'text', placeholder, required, hint,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean; hint?: string
}) {
  return (
    <div>
      <label className="block text-zinc-300 text-xs font-medium mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors"
      />
      {hint && <p className="text-zinc-600 text-[10px] mt-1">{hint}</p>}
    </div>
  )
}

function TextAreaField({
  label, name, value, onChange, placeholder, rows = 3,
}: {
  label: string; name: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-zinc-300 text-xs font-medium mb-1.5">{label}</label>
      <textarea
        name={name}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-violet-500 transition-colors resize-none"
      />
    </div>
  )
}

export default function ProfilePage() {
  const [tab, setTab] = useState<Tab>('profile')
  const [profile, setProfile] = useState<VendorProfile | null>(null)
  const [bank, setBank] = useState<BankDetails>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savingBank, setSavingBank] = useState(false)
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [bankMsg, setBankMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  // Profile form state
  const [form, setForm] = useState({
    name: '', business_name: '', phone: '', category: '',
    website: '', bio: '', avatar_url: '', gstin: '', city: '', state: '', country: '',
  })

  // Bank form state
  const [bankForm, setBankForm] = useState({
    bank_account_name: '', bank_account_number: '', bank_ifsc: '',
    bank_name: '', upi_id: '',
  })

  useEffect(() => {
    const token = localStorage.getItem('vendor_session_token')
    if (!token) return
    fetch('/api/v1/vendor-portal/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then((data: VendorProfile & BankDetails) => {
        setProfile(data)
        setForm({
          name: data.name ?? '',
          business_name: data.business_name ?? '',
          phone: data.phone ?? '',
          category: data.category ?? '',
          website: data.website ?? '',
          bio: data.bio ?? '',
          avatar_url: data.avatar_url ?? '',
          gstin: data.gstin ?? '',
          city: data.city ?? '',
          state: data.state ?? '',
          country: data.country ?? '',
        })
        setBankForm({
          bank_account_name: data.bank_account_name ?? '',
          bank_account_number: data.bank_account_number ?? '',
          bank_ifsc: data.bank_ifsc ?? '',
          bank_name: data.bank_name ?? '',
          upi_id: data.upi_id ?? '',
        })
        setBank(data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleProfileSave(e: FormEvent) {
    e.preventDefault()
    setSaving(true)
    setProfileMsg(null)
    const token = localStorage.getItem('vendor_session_token')
    try {
      const res = await fetch('/api/v1/vendor-portal/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      setProfileMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch {
      setProfileMsg({ type: 'error', text: 'Failed to save profile. Please try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function handleBankSave(e: FormEvent) {
    e.preventDefault()
    setSavingBank(true)
    setBankMsg(null)
    const token = localStorage.getItem('vendor_session_token')
    try {
      const res = await fetch('/api/v1/vendor-portal/me/bank', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(bankForm),
      })
      if (!res.ok) throw new Error()
      setBankMsg({ type: 'success', text: 'Bank details updated successfully.' })
    } catch {
      setBankMsg({ type: 'error', text: 'Failed to save bank details. Please try again.' })
    } finally {
      setSavingBank(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-xl font-semibold text-white">Profile</h1>
          <p className="text-zinc-400 text-sm mt-0.5">Your vendor profile and bank details</p>
        </div>
        <div className="space-y-4">
          {[1,2,3,4].map(i => <div key={i} className="h-12 bg-zinc-900/60 border border-zinc-800 rounded-lg animate-pulse" />)}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        {/* Avatar */}
        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-violet-500/30 to-indigo-500/30 flex items-center justify-center flex-shrink-0">
          {form.avatar_url ? (
            <img src={form.avatar_url} alt={form.name} className="w-14 h-14 rounded-full object-cover" />
          ) : (
            <span className="text-violet-300 font-bold text-xl">{(form.name || '?').charAt(0).toUpperCase()}</span>
          )}
        </div>
        <div>
          <h1 className="text-xl font-semibold text-white">{form.business_name || form.name || 'Your Profile'}</h1>
          <p className="text-zinc-400 text-sm">{profile?.email}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-zinc-900/50 border border-zinc-800 rounded-lg p-1 w-fit">
        {(['profile', 'bank'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium capitalize transition-colors ${
              tab === t
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {t === 'bank' ? 'Bank Details' : 'Profile'}
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <form onSubmit={handleProfileSave} className="space-y-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs font-medium text-zinc-300 uppercase tracking-wide">Personal Information</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Full name" name="name" value={form.name} onChange={v => setForm(f => ({ ...f, name: v }))} required placeholder="Your name" />
              <InputField label="Business name" name="business_name" value={form.business_name} onChange={v => setForm(f => ({ ...f, business_name: v }))} placeholder="Your company or trade name" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Phone number" name="phone" value={form.phone} type="tel" onChange={v => setForm(f => ({ ...f, phone: v }))} placeholder="+91 98765 43210" />
              <div>
                <label className="block text-zinc-300 text-xs font-medium mb-1.5">Category <span className="text-red-400">*</span></label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  required
                  className="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:border-violet-500 transition-colors"
                >
                  <option value="" className="bg-zinc-900">Select category</option>
                  {VENDOR_CATEGORIES.map(c => (
                    <option key={c} value={c} className="bg-zinc-900">{c}</option>
                  ))}
                </select>
              </div>
            </div>

            <TextAreaField
              label="Bio / About"
              name="bio"
              value={form.bio}
              onChange={v => setForm(f => ({ ...f, bio: v }))}
              placeholder="Brief description of your services, experience, and specialities…"
              rows={3}
            />
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs font-medium text-zinc-300 uppercase tracking-wide">Business Details</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField label="Website" name="website" value={form.website} type="url" onChange={v => setForm(f => ({ ...f, website: v }))} placeholder="https://yourwebsite.com" />
              <InputField label="GSTIN" name="gstin" value={form.gstin} onChange={v => setForm(f => ({ ...f, gstin: v }))} placeholder="22AAAAA0000A1Z5" hint="15-digit GST Identification Number" />
            </div>

            <InputField label="Avatar URL" name="avatar_url" value={form.avatar_url} type="url" onChange={v => setForm(f => ({ ...f, avatar_url: v }))} placeholder="https://..." hint="Link to your profile photo" />
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs font-medium text-zinc-300 uppercase tracking-wide">Location</p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <InputField label="City" name="city" value={form.city} onChange={v => setForm(f => ({ ...f, city: v }))} placeholder="Mumbai" />
              <InputField label="State" name="state" value={form.state} onChange={v => setForm(f => ({ ...f, state: v }))} placeholder="Maharashtra" />
              <InputField label="Country" name="country" value={form.country} onChange={v => setForm(f => ({ ...f, country: v }))} placeholder="India" />
            </div>
          </div>

          {profileMsg && (
            <div className={`px-4 py-3 rounded-lg text-sm ${
              profileMsg.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {profileMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              {saving && <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />}
              {saving ? 'Saving…' : 'Save profile'}
            </button>
          </div>
        </form>
      )}

      {/* Bank details tab */}
      {tab === 'bank' && (
        <form onSubmit={handleBankSave} className="space-y-5">
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
            <svg className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-2.194-.833-2.964 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-amber-300 text-xs">Keep your bank details accurate. Payments are disbursed to the account details on file. Changes take effect for future disbursements only.</p>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs font-medium text-zinc-300 uppercase tracking-wide">Bank Account Details</p>

            <InputField
              label="Account holder name"
              name="bank_account_name"
              value={bankForm.bank_account_name}
              onChange={v => setBankForm(f => ({ ...f, bank_account_name: v }))}
              placeholder="Name as on bank account"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <InputField
                label="Account number"
                name="bank_account_number"
                value={bankForm.bank_account_number}
                onChange={v => setBankForm(f => ({ ...f, bank_account_number: v }))}
                placeholder="XXXX XXXX XXXX"
                hint="Your savings or current account number"
              />
              <InputField
                label="IFSC code"
                name="bank_ifsc"
                value={bankForm.bank_ifsc}
                onChange={v => setBankForm(f => ({ ...f, bank_ifsc: v.toUpperCase() }))}
                placeholder="SBIN0001234"
                hint="11-character IFSC code"
              />
            </div>

            <InputField
              label="Bank name"
              name="bank_name"
              value={bankForm.bank_name}
              onChange={v => setBankForm(f => ({ ...f, bank_name: v }))}
              placeholder="State Bank of India"
            />
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-5 space-y-4">
            <p className="text-xs font-medium text-zinc-300 uppercase tracking-wide">UPI (Optional)</p>
            <InputField
              label="UPI ID"
              name="upi_id"
              value={bankForm.upi_id}
              onChange={v => setBankForm(f => ({ ...f, upi_id: v }))}
              placeholder="yourname@upi"
              hint="For instant payment via UPI"
            />
          </div>

          {bankMsg && (
            <div className={`px-4 py-3 rounded-lg text-sm ${
              bankMsg.type === 'success'
                ? 'bg-green-500/10 border border-green-500/30 text-green-400'
                : 'bg-red-500/10 border border-red-500/30 text-red-400'
            }`}>
              {bankMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={savingBank}
              className="px-5 py-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-sm font-medium transition-colors flex items-center gap-2"
            >
              {savingBank && <div className="w-3.5 h-3.5 border border-white/30 border-t-white rounded-full animate-spin" />}
              {savingBank ? 'Saving…' : 'Save bank details'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
