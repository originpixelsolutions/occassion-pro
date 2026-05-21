'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useRegisterStore } from '@/store/register.store'
import { toast } from 'sonner'
import { Loader2, Zap, Mail, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react'

// ── Step indicator ──────────────────────────────────────────────────────────
function StepIndicator({ current }: { current: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: 'Account' },
    { n: 2, label: 'Workspace' },
    { n: 3, label: 'Plan' },
  ]
  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.n} className="flex items-center">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                s.n < current
                  ? 'bg-primary text-primary-foreground'
                  : s.n === current
                  ? 'bg-primary/20 border-2 border-primary text-primary'
                  : 'bg-muted text-muted-foreground'
              }`}
            >
              {s.n < current ? <CheckCircle2 className="w-4 h-4" /> : s.n}
            </div>
            <span
              className={`text-[10px] font-medium ${
                s.n === current ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div
              className={`w-16 h-px mb-5 mx-1 transition-all ${
                s.n < current ? 'bg-primary' : 'bg-border'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  )
}

// ── Email verification screen ────────────────────────────────────────────────
function VerifyEmailScreen({ email }: { email: string }) {
  const supabase = getSupabaseBrowserClient()
  const [resending, setResending] = useState(false)

  async function resend() {
    setResending(true)
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/register/workspace`,
        },
      })
      if (error) throw error
      toast.success('Verification email resent!')
    } catch (err: any) {
      toast.error(err.message ?? 'Failed to resend email')
    } finally {
      setResending(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6"
    >
      <div className="flex justify-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Mail className="w-8 h-8 text-primary" />
        </div>
      </div>
      <div className="space-y-2">
        <h2 className="text-xl font-bold">Check your email</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          We sent a verification link to{' '}
          <span className="text-foreground font-medium">{email}</span>. Click it
          to continue setting up your workspace.
        </p>
      </div>
      <div className="bg-card border border-border rounded-xl p-4 text-sm text-muted-foreground space-y-1">
        <p>Didn&apos;t receive it? Check your spam folder.</p>
        <button
          onClick={resend}
          disabled={resending}
          className="text-primary hover:underline font-medium disabled:opacity-50"
        >
          {resending ? 'Sending…' : 'Resend verification email'}
        </button>
      </div>
      <p className="text-xs text-muted-foreground">
        <Link href="/login" className="hover:underline">
          Back to sign in
        </Link>
      </p>
    </motion.div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const [form, setForm] = useState({ fullName: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [stage, setStage] = useState<'form' | 'verify'>('form')

  const router = useRouter()
  const supabase = getSupabaseBrowserClient()
  const { setAccountData, setCompletedStep } = useRegisterStore()

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const passwordStrength = (() => {
    const p = form.password
    if (p.length === 0) return null
    if (p.length < 6) return { level: 1, label: 'Too short', color: 'bg-red-500' }
    if (p.length < 8) return { level: 2, label: 'Weak', color: 'bg-orange-500' }
    if (/[A-Z]/.test(p) && /[0-9]/.test(p)) return { level: 4, label: 'Strong', color: 'bg-green-500' }
    return { level: 3, label: 'Good', color: 'bg-primary' }
  })()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.password.length < 8) {
      toast.error('Password must be at least 8 characters')
      return
    }

    setLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: { full_name: form.fullName },
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/register/workspace`,
        },
      })
      if (error) throw error

      setAccountData(form.email, form.fullName)
      setCompletedStep(1)

      // If session is immediately available (email confirmation disabled in Supabase project)
      if (data.session) {
        router.push('/register/workspace')
      } else {
        // Email confirmation required — show verify screen
        setStage('verify')
      }
    } catch (err: any) {
      toast.error(err.message ?? 'Sign up failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogle() {
    setAccountData('', '')
    setCompletedStep(1)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=/register/workspace`,
      },
    })
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background glow */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">OccasionPro</span>
          </div>
          <StepIndicator current={1} />
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/30"
        >
          <AnimatePresence mode="wait">
            {stage === 'verify' ? (
              <VerifyEmailScreen key="verify" email={form.email} />
            ) : (
              <motion.div
                key="form"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-6"
              >
                <div className="space-y-1">
                  <h1 className="text-xl font-bold">Create your account</h1>
                  <p className="text-sm text-muted-foreground">
                    Start your 14-day free trial — no credit card required
                  </p>
                </div>

                {/* Google */}
                <button
                  onClick={handleGoogle}
                  type="button"
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-border rounded-xl text-sm font-medium hover:bg-accent transition-colors"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs text-muted-foreground">
                    <span className="bg-card px-2">or sign up with email</span>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Full name */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Full name</label>
                    <input
                      type="text"
                      value={form.fullName}
                      onChange={(e) => set('fullName', e.target.value)}
                      placeholder="Aarav Sharma"
                      required
                      autoFocus
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/60"
                    />
                  </div>

                  {/* Email */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Work email</label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => set('email', e.target.value)}
                      placeholder="you@company.com"
                      required
                      className="w-full px-3 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/60"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium">Password</label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={form.password}
                        onChange={(e) => set('password', e.target.value)}
                        placeholder="8+ characters"
                        required
                        minLength={8}
                        className="w-full px-3 py-2.5 pr-10 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all placeholder:text-muted-foreground/60"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {/* Strength meter */}
                    {passwordStrength && (
                      <div className="space-y-1">
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map((i) => (
                            <div
                              key={i}
                              className={`h-1 flex-1 rounded-full transition-all ${
                                i <= passwordStrength.level
                                  ? passwordStrength.color
                                  : 'bg-border'
                              }`}
                            />
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{passwordStrength.label}</p>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-60 transition-all shadow-lg shadow-primary/20"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <ArrowRight className="w-4 h-4" />
                    )}
                    {loading ? 'Creating account…' : 'Continue'}
                  </button>

                  <p className="text-center text-xs text-muted-foreground">
                    By creating an account you agree to our{' '}
                    <Link href="/terms" className="text-primary hover:underline">Terms</Link>
                    {' '}and{' '}
                    <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>
                  </p>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link href="/login" className="text-primary font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
