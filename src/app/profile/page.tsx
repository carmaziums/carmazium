"use client"

import * as React from "react"
import Link from "next/link"
import { apiClient } from "@/lib/apiClient"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { ThemeToggle } from "@/components/ui/ThemeToggle"
import { AlertCircle, Building2, Car, CheckCircle2, Loader2, Shield, User } from "lucide-react"
import { useRouter } from "next/navigation"

export default function ProfilePage() {
    const { profile, refreshProfile, loading: authLoading } = useAuth()
    const router = useRouter()
    const [loading, setLoading] = React.useState(false)
    const [success, setSuccess] = React.useState<string | null>(null)
    const [roleError, setRoleError] = React.useState<string | null>(null)
    const [businessLoading, setBusinessLoading] = React.useState(false)
    const [businessForm, setBusinessForm] = React.useState({
        companyName: profile?.dealerProfile?.companyName || "",
        vatNumber: profile?.dealerProfile?.vatNumber || "",
        businessAddress: profile?.dealerProfile?.businessAddress || "",
        phone: profile?.dealerProfile?.phone || "",
        website: profile?.dealerProfile?.website || "",
        description: profile?.dealerProfile?.description || "",
    })

    React.useEffect(() => {
        if (!profile?.dealerProfile) return
        setBusinessForm({
            companyName: profile.dealerProfile.companyName || "",
            vatNumber: profile.dealerProfile.vatNumber || "",
            businessAddress: profile.dealerProfile.businessAddress || "",
            phone: profile.dealerProfile.phone || "",
            website: profile.dealerProfile.website || "",
            description: profile.dealerProfile.description || "",
        })
    }, [profile])

    const handleUpdateBusiness = async () => {
        setBusinessLoading(true)
        setSuccess(null)
        setRoleError(null)
        try {
            await apiClient("/users/dealer-profile", {
                method: "PATCH",
                body: JSON.stringify(businessForm),
            })
            setSuccess("Partner business profile updated successfully.")
            await refreshProfile()
        } catch (error: any) {
            setRoleError(error?.message || "Could not update the Partner business profile.")
        } finally {
            setBusinessLoading(false)
        }
    }

    const handleRoleElevation = async (newRole: "BUYER" | "DEALER") => {
        setLoading(true)
        setSuccess(null)
        setRoleError(null)
        try {
            await apiClient("/users/elevate", {
                method: "POST",
                body: JSON.stringify({ newRole }),
            })
            await refreshProfile()
            if (newRole === "DEALER") {
                router.push("/dashboard/partner")
                return
            }
            setSuccess("Your account is now set up as a Personal Account.")
        } catch (error: any) {
            setRoleError(error?.message || "Could not change your account type. Please try again.")
        } finally {
            setLoading(false)
        }
    }

    if (authLoading) {
        return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>
    }

    const currentRole = profile?.role || ""
    const isPersonal = currentRole === "BUYER" || currentRole === "SELLER"
    // CONTRACTOR is the legacy service-provider account type. Treat it as a
    // Partner in the UI; the Partner dashboard offers a one-click migration to
    // the new additive business account without deleting its provider profile.
    const isPartner = currentRole === "DEALER" || currentRole === "CONTRACTOR"
    const accountLabel = isPersonal ? "Personal Account" : isPartner ? "Partner Account" : currentRole

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <div className="flex items-center justify-between mb-8">
                <h1 className="text-3xl font-bold font-heading">Manage Your Profile</h1>
            </div>

            <div className="glass-card p-8 mb-8">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
                        {profile?.firstName?.[0] || profile?.email?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{profile?.firstName} {profile?.lastName}</h2>
                        <p style={{ color: "var(--text-muted)" }}>{profile?.email}</p>
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                            <Shield size={12} /> {accountLabel}
                        </div>
                    </div>
                </div>
            </div>

            <section className="mb-12">
                <h3 className="text-xl font-bold mb-6">Appearance</h3>
                <div className="glass-card p-6 flex items-center justify-between">
                    <div>
                        <p className="font-semibold">Theme</p>
                        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Switch between light and dark mode</p>
                    </div>
                    <ThemeToggle />
                </div>
            </section>

            {isPartner && (
                <section className="mb-12">
                    <h3 className="text-xl font-bold mb-4 flex items-center gap-2"><Building2 className="text-primary" /> Partner Account</h3>
                    <div className="glass-card p-6 flex flex-col md:flex-row md:items-center justify-between gap-5">
                        <div>
                            <p className="font-bold">One business account, multiple add-ons</p>
                            <p className="text-sm mt-1" style={{ color: "var(--text-muted)" }}>
                                Add Vehicle Dealer, Delivery & Recovery and Vehicle Inspection services without replacing your account role.
                            </p>
                        </div>
                        <Link href="/dashboard/partner"><Button>Open Partner Dashboard</Button></Link>
                    </div>
                </section>
            )}

            {profile?.dealerProfile && (
                <section className="mb-12">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><Building2 className="text-primary" /> Partner Business Profile</h3>
                    <div className="glass-card p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Field label="Business / Trading Name *" value={businessForm.companyName} onChange={v => setBusinessForm({ ...businessForm, companyName: v })} />
                            <Field label="VAT Number" value={businessForm.vatNumber} onChange={v => setBusinessForm({ ...businessForm, vatNumber: v })} />
                            <Field label="Phone" value={businessForm.phone} onChange={v => setBusinessForm({ ...businessForm, phone: v })} />
                            <Field label="Website" type="url" value={businessForm.website} onChange={v => setBusinessForm({ ...businessForm, website: v })} />
                            <div className="md:col-span-2"><Field label="Business Address / Service Area" value={businessForm.businessAddress} onChange={v => setBusinessForm({ ...businessForm, businessAddress: v })} /></div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-bold uppercase" style={{ color: "var(--text-muted)" }}>Business Description</label>
                                <textarea value={businessForm.description} onChange={e => setBusinessForm({ ...businessForm, description: e.target.value })} rows={4} className="w-full border rounded-lg px-4 py-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none" style={{ background: "var(--bg-input)", borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
                            </div>
                        </div>
                        <div className="mt-6">
                            <Button onClick={handleUpdateBusiness} disabled={businessLoading}>
                                {businessLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : null} Save Business Profile
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            <section id="upgrade-role" className="scroll-mt-28">
                <h3 className="text-xl font-bold mb-3 flex items-center gap-2"><Car className="text-primary" /> Account Type</h3>
                <p className="mb-7" style={{ color: "var(--text-muted)" }}>
                    Personal accounts are for individual buyers and sellers. Businesses use one Partner Account and add the services they need from the Partner Dashboard.
                </p>

                {success && <div className="mb-6 p-4 bg-green-500/10 border border-green-500/50 rounded-xl text-green-700 dark:text-green-200 flex items-center gap-3"><CheckCircle2 size={18} /> {success}</div>}
                {roleError && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/40 rounded-xl text-red-600 dark:text-red-300 flex items-start gap-3"><AlertCircle size={18} className="mt-0.5 shrink-0" /> {roleError}</div>}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {!isPersonal && (
                        <AccountCard icon={User} label="Personal Account" sub="Buy and sell vehicles as an individual" button="Switch to Personal Account" loading={loading} onClick={() => handleRoleElevation("BUYER")} />
                    )}
                    {!isPartner && (
                        <AccountCard icon={Building2} label="Partner Account" sub="One business login with Vehicle Dealer, Delivery and Inspection add-ons" button="Create Partner Account" loading={loading} onClick={() => handleRoleElevation("DEALER")} />
                    )}
                </div>
            </section>
        </div>
    )
}

function Field({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-bold uppercase" style={{ color: "var(--text-muted)" }}>{label}</label>
            <input type={type} value={value} onChange={e => onChange(e.target.value)} className="w-full border rounded-lg px-4 py-3 focus:border-primary focus:ring-1 focus:ring-primary outline-none" style={{ background: "var(--bg-input)", borderColor: "var(--border-default)", color: "var(--text-primary)" }} />
        </div>
    )
}

function AccountCard({ icon: Icon, label, sub, button, loading, onClick }: { icon: React.ComponentType<{ size?: number; className?: string }>; label: string; sub: string; button: string; loading: boolean; onClick: () => void }) {
    return (
        <div className="glass-card p-6 hover:bg-primary/5 transition-colors flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-primary mb-4" style={{ background: "var(--bg-input)" }}><Icon size={24} /></div>
            <h4 className="font-bold mb-2">{label}</h4>
            <p className="text-xs mb-6" style={{ color: "var(--text-faint)" }}>{sub}</p>
            <Button variant="outline" size="sm" className="mt-auto w-full" disabled={loading} onClick={onClick}>
                {loading ? <Loader2 className="animate-spin" size={16} /> : button}
            </Button>
        </div>
    )
}
