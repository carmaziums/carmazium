"use client"

import { Button } from "@/components/ui/Button"
import { CheckCircle, Loader2, Mail, MapPin, Heart, ArrowRight, Car, Zap, Gauge, RefreshCw, LayoutDashboard } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { useRouter } from "next/navigation"
import { useState, useEffect, useRef } from "react"
import { Input } from "@/components/ui/Input"
import { BODY_TYPE_LABELS, BODY_TYPE_KEYS } from "@/components/icons/BodyTypeIcons"
import { updateProfile } from "@/lib/listingApi"

const FUEL_PREFS = [
    { value: 'PETROL', label: 'Petrol' },
    { value: 'DIESEL', label: 'Diesel' },
    { value: 'ELECTRIC', label: 'Electric' },
    { value: 'HYBRID', label: 'Hybrid' },
    { value: 'PLUGIN_HYBRID', label: 'Plug-in Hybrid' },
]

const BUDGET_RANGES = [
    { value: '0-5000', label: 'Under £5k' },
    { value: '5000-10000', label: '£5k – £10k' },
    { value: '10000-20000', label: '£10k – £20k' },
    { value: '20000-40000', label: '£20k – £40k' },
    { value: '40000+', label: '£40k+' },
]

export default function OnboardingPage() {
    const { user, profile, loading } = useAuth()
    const router = useRouter()
    const [resending, setResending] = useState(false)
    const [resendSuccess, setResendSuccess] = useState(false)
    const [resendCooldown, setResendCooldown] = useState(0)
    const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
    const [isVerified, setIsVerified] = useState(false)

    // Post-verification steps
    const [step, setStep] = useState<'verify' | 'location' | 'preferences' | 'done'>('verify')
    const [location, setLocation] = useState('')
    const [selectedBodyTypes, setSelectedBodyTypes] = useState<string[]>([])
    const [selectedFuels, setSelectedFuels] = useState<string[]>([])
    const [selectedBudget, setSelectedBudget] = useState('')
    const [saving, setSaving] = useState(false)

    useEffect(() => {
        if (user) {
            const verified = !!user.email_confirmed_at
            setIsVerified(verified)
            if (verified && step === 'verify') setStep('location')
        }
    }, [user])

    const getBaseUrl = () => {
        if (typeof window !== 'undefined') return window.location.origin
        return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    }

    const startCooldown = (seconds = 60) => {
        setResendCooldown(seconds)
        if (cooldownRef.current) clearInterval(cooldownRef.current)
        cooldownRef.current = setInterval(() => {
            setResendCooldown(prev => {
                if (prev <= 1) { clearInterval(cooldownRef.current!); return 0 }
                return prev - 1
            })
        }, 1000)
    }

    useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

    const handleResendEmail = async () => {
        if (!user?.email || resendCooldown > 0) return
        setResending(true)
        setResendSuccess(false)
        try {
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev').replace(/\/$/, '')
            const res = await fetch(`${apiBase}/auth/send-verification`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: user.email,
                    redirectTo: `${getBaseUrl()}/auth/callback?redirect_to=/auth/onboarding`,
                }),
            })
            if (!res.ok) {
                const data = await res.json().catch(() => ({}))
                alert(`Failed to resend email: ${data?.message || res.statusText}`)
            } else {
                setResendSuccess(true)
                startCooldown(60)
                setTimeout(() => setResendSuccess(false), 6000)
            }
        } catch (err: any) {
            alert(`Failed to resend email: ${err.message}`)
        } finally {
            setResending(false)
        }
    }

    const handleSaveLocation = async () => {
        setSaving(true)
        try {
            if (location.trim()) {
                await updateProfile({ location: location.trim() })
                localStorage.setItem('carmazium_user_location', location.trim())
            }
            setStep('preferences')
        } catch (err: any) {
            console.error('Failed to save location:', err)
            // Still proceed — don't block the user
            setStep('preferences')
        } finally {
            setSaving(false)
        }
    }

    const handleSavePreferences = async () => {
        setSaving(true)
        try {
            const prefs = {
                bodyTypes: selectedBodyTypes,
                fuelTypes: selectedFuels,
                budget: selectedBudget,
            }
            await updateProfile({ preferences: prefs })
            localStorage.setItem('carmazium_user_preferences', JSON.stringify(prefs))
            setStep('done')
        } catch (err: any) {
            console.error('Failed to save preferences:', err)
            setStep('done')
        } finally {
            setSaving(false)
        }
    }

    const toggleArr = (arr: string[], setArr: (v: string[]) => void, val: string) => {
        setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <Loader2 className="animate-spin text-primary h-12 w-12" />
            </div>
        )
    }

    const stepIndex = step === 'verify' ? 1 : step === 'location' ? 2 : step === 'preferences' ? 3 : 4
    const steps = ['Verify Email', 'Your Location', 'Preferences', 'All Done']

    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-slate-900 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-1/2 h-full bg-[url('/assets/images/hero-bg.png')] bg-cover opacity-20" />

            <div className="relative z-10 w-full max-w-xl px-5">
                {/* Step indicator */}
                <div className="flex items-center justify-center gap-2 mb-10">
                    {steps.map((s, i) => (
                        <div key={i} className="flex items-center gap-2">
                            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border transition-all ${i + 1 < stepIndex ? 'bg-emerald-500 border-emerald-500 text-white' : i + 1 === stepIndex ? 'bg-primary border-primary text-white' : 'bg-slate-800 border-white/10 text-gray-500'}`}>
                                {i + 1 < stepIndex ? <CheckCircle size={14} /> : i + 1}
                            </div>
                            <span className={`text-xs font-semibold hidden sm:block ${i + 1 === stepIndex ? 'text-white' : 'text-gray-500'}`}>{s}</span>
                            {i < steps.length - 1 && <div className={`w-6 h-0.5 ${i + 1 < stepIndex ? 'bg-emerald-500' : 'bg-white/10'}`} />}
                        </div>
                    ))}
                </div>

                <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-8">

                    {/* ── Step 1: Verify Email ── */}
                    {step === 'verify' && (
                        <div className="text-center space-y-6">
                            {/* Icon */}
                            <div className="relative inline-flex items-center justify-center">
                                <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/25 flex items-center justify-center">
                                    <Mail className="text-primary h-9 w-9" />
                                </div>
                                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-50" />
                                    <span className="relative inline-flex rounded-full h-5 w-5 bg-primary items-center justify-center">
                                        <span className="text-white text-[9px] font-black">1</span>
                                    </span>
                                </span>
                            </div>

                            <div>
                                <h1 className="text-2xl font-black font-heading text-white tracking-tight">Check your inbox</h1>
                                <p className="text-gray-400 text-sm mt-2 leading-relaxed">
                                    We've sent a verification link to
                                </p>
                                <p className="text-white font-semibold text-sm mt-0.5">{user?.email}</p>
                            </div>

                            {/* Steps hint */}
                            <div className="bg-slate-900/60 border border-white/5 rounded-xl p-4 text-left space-y-2">
                                {[
                                    'Open the email from CarMazium',
                                    'Click the "Verify My Email" button',
                                    'You\'ll be brought back here automatically',
                                ].map((step, i) => (
                                    <div key={i} className="flex items-center gap-3">
                                        <div className="w-5 h-5 rounded-full bg-primary/15 border border-primary/30 flex items-center justify-center shrink-0">
                                            <span className="text-primary text-[10px] font-black">{i + 1}</span>
                                        </div>
                                        <span className="text-gray-300 text-xs">{step}</span>
                                    </div>
                                ))}
                            </div>

                            {/* Success banner */}
                            {resendSuccess && (
                                <div className="flex items-center gap-2 p-3 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm">
                                    <CheckCircle size={16} className="shrink-0" />
                                    Email sent! Check your inbox (and spam folder).
                                </div>
                            )}

                            {/* Primary: Resend */}
                            <Button
                                size="lg"
                                className="w-full gap-2"
                                onClick={handleResendEmail}
                                disabled={resending || resendCooldown > 0}
                            >
                                {resending ? (
                                    <><Loader2 className="animate-spin h-4 w-4" /> Sending…</>
                                ) : resendCooldown > 0 ? (
                                    <><RefreshCw size={16} /> Resend in {resendCooldown}s</>
                                ) : (
                                    <><RefreshCw size={16} /> Resend Verification Email</>
                                )}
                            </Button>

                            {/* Secondary: skip to dashboard */}
                            <Button
                                variant="outline"
                                className="w-full gap-2 border-white/10 text-gray-400 hover:text-white"
                                onClick={() => router.push('/dashboard')}
                            >
                                <LayoutDashboard size={15} /> Go to Dashboard anyway
                            </Button>

                            <p className="text-[11px] text-gray-600">
                                Wrong email? <button onClick={() => router.push('/auth/signup')} className="text-primary hover:underline">Sign up again</button>
                            </p>
                        </div>
                    )}

                    {/* ── Step 2: Location ── */}
                    {step === 'location' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 bg-blue-500/20 rounded-xl border border-blue-500/20">
                                    <MapPin className="text-blue-400 h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Where are you based?</h2>
                                    <p className="text-gray-400 text-sm">Helps show nearby listings and sellers</p>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">City or Postcode</label>
                                <Input
                                    placeholder="e.g. London, Birmingham, B1 1AA…"
                                    value={location}
                                    onChange={e => setLocation(e.target.value)}
                                    className="h-12 bg-slate-900/50 border-white/10 text-white placeholder:text-gray-600 focus:border-primary"
                                    onKeyDown={e => e.key === 'Enter' && handleSaveLocation()}
                                    autoFocus
                                />
                                <p className="text-xs text-gray-600">This is saved locally on your device and can be changed in your profile settings.</p>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white" onClick={() => setStep('preferences')}>
                                    Skip
                                </Button>
                                <Button className="flex-1" onClick={handleSaveLocation} disabled={saving}>
                                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <>Continue <ArrowRight size={16} className="ml-1" /></>}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 3: Preferences ── */}
                    {step === 'preferences' && (
                        <div className="space-y-6">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2.5 bg-primary/20 rounded-xl border border-primary/20">
                                    <Heart className="text-primary h-6 w-6" />
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">What are you looking for?</h2>
                                    <p className="text-gray-400 text-sm">Personalise your CarMazium experience</p>
                                </div>
                            </div>

                            {/* Budget */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1.5"><Gauge size={11} /> Budget Range</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {BUDGET_RANGES.map(b => (
                                        <button key={b.value} type="button"
                                            onClick={() => setSelectedBudget(selectedBudget === b.value ? '' : b.value)}
                                            className={`py-2 rounded-lg border text-xs font-semibold transition-all ${selectedBudget === b.value ? 'border-primary bg-primary/15 text-white' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
                                        >{b.label}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Body types */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1.5"><Car size={11} /> Vehicle Type</label>
                                <div className="grid grid-cols-3 gap-2">
                                    {BODY_TYPE_KEYS.slice(0, 9).map(key => (
                                        <button key={key} type="button"
                                            onClick={() => toggleArr(selectedBodyTypes, setSelectedBodyTypes, key)}
                                            className={`py-2 rounded-lg border text-xs font-semibold transition-all ${selectedBodyTypes.includes(key) ? 'border-primary bg-primary/15 text-white' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
                                        >{BODY_TYPE_LABELS[key]}</button>
                                    ))}
                                </div>
                            </div>

                            {/* Fuel type */}
                            <div className="space-y-2">
                                <label className="text-xs font-bold uppercase text-gray-400 flex items-center gap-1.5"><Zap size={11} /> Fuel Preference</label>
                                <div className="flex flex-wrap gap-2">
                                    {FUEL_PREFS.map(f => (
                                        <button key={f.value} type="button"
                                            onClick={() => toggleArr(selectedFuels, setSelectedFuels, f.value)}
                                            className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition-all ${selectedFuels.includes(f.value) ? 'border-primary bg-primary/15 text-white' : 'border-white/10 text-gray-400 hover:border-white/20'}`}
                                        >{f.label}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <Button variant="outline" className="flex-1 border-white/10 text-gray-400 hover:text-white" onClick={() => setStep('done')}>
                                    Skip
                                </Button>
                                <Button className="flex-1" onClick={handleSavePreferences} disabled={saving}>
                                    {saving ? <Loader2 className="animate-spin h-4 w-4" /> : <>Finish Setup <CheckCircle size={16} className="ml-1" /></>}
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── Step 4: Done ── */}
                    {step === 'done' && (
                        <div className="text-center space-y-5">
                            <div className="inline-block p-3 bg-emerald-500/20 rounded-full mb-2">
                                <CheckCircle className="text-emerald-400 h-8 w-8" />
                            </div>
                            <h2 className="text-2xl font-bold text-white">You're all set!</h2>
                            <p className="text-gray-400 text-sm">
                                Welcome to CarMazium, <strong className="text-white">{profile?.firstName || 'there'}</strong>. Your account is ready to use.
                            </p>
                            <Button size="lg" className="w-full" onClick={() => router.push('/dashboard')}>
                                Go to Dashboard <ArrowRight size={16} className="ml-2" />
                            </Button>
                            <Button size="lg" variant="outline" className="w-full border-white/10 text-gray-400 hover:text-white" onClick={() => router.push('/buy-cars')}>
                                Browse Cars
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
