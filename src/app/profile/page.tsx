"use client"

import * as React from "react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { Shield, Car, Wrench, CreditCard, Loader2, CheckCircle2, User } from "lucide-react"
import { supabase } from "@/lib/supabase"

export default function ProfilePage() {
    const { profile, refreshProfile, loading: authLoading } = useAuth()
    const [loading, setLoading] = React.useState(false)
    const [success, setSuccess] = React.useState<string | null>(null)
    const [dealerLoading, setDealerLoading] = React.useState(false)
    const [dealerForm, setDealerForm] = React.useState({
        companyName: profile?.dealerProfile?.companyName || '',
        vatNumber: profile?.dealerProfile?.vatNumber || '',
        businessAddress: profile?.dealerProfile?.businessAddress || '',
        phone: profile?.dealerProfile?.phone || '',
        website: profile?.dealerProfile?.website || '',
        description: profile?.dealerProfile?.description || '',
    })

    React.useEffect(() => {
        if (profile?.dealerProfile) {
            setDealerForm({
                companyName: profile.dealerProfile.companyName || '',
                vatNumber: profile.dealerProfile.vatNumber || '',
                businessAddress: profile.dealerProfile.businessAddress || '',
                phone: profile.dealerProfile.phone || '',
                website: profile.dealerProfile.website || '',
                description: profile.dealerProfile.description || '',
            })
        }
    }, [profile])

    const handleUpdateDealerProfile = async () => {
        setDealerLoading(true)
        setSuccess(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch(`${API_URL}/users/dealer-profile`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify(dealerForm)
            })

            if (response.ok) {
                setSuccess('Dealer profile updated successfully!')
                await refreshProfile()
            }
        } catch (error) {
            console.error('Update failed:', error)
        } finally {
            setDealerLoading(false)
        }
    }

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium-hjoh9w.fly.dev';

    const handleRoleElevation = async (newRole: string) => {
        setLoading(true)
        setSuccess(null)
        try {
            const { data: { session } } = await supabase.auth.getSession()
            const response = await fetch(`${API_URL}/users/elevate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session?.access_token}`
                },
                body: JSON.stringify({ newRole })
            })

            if (response.ok) {
                setSuccess(`Successfully requested elevation to ${newRole}!`)
                await refreshProfile()
            }
        } catch (error) {
            console.error('Elevation failed:', error)
        } finally {
            setLoading(false)
        }
    }

    if (authLoading) return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>

    // Unified roles — BUYER and SELLER are merged into a single "User" role
    const currentRole = profile?.role || ''
    const isUserRole = currentRole === 'BUYER' || currentRole === 'SELLER'
    const isDealerRole = currentRole === 'DEALER'

    const allRoles = [
        { id: 'BUYER', icon: User, label: 'User', sub: 'Buy and sell vehicles as an individual' },
        { id: 'DEALER', icon: Shield, label: 'Dealer', sub: 'For car dealerships and businesses' },
    ]
    // Show roles that the user is NOT currently on
    const availableRoles = allRoles.filter(r => {
        if (r.id === 'BUYER') return !isUserRole   // hide "User" if already BUYER or SELLER
        if (r.id === 'DEALER') return !isDealerRole // hide "Dealer" if already DEALER
        return true
    })

    return (
        <div className="max-w-4xl mx-auto py-12 px-4">
            <h1 className="text-3xl font-bold mb-8 font-heading">Manage Your Profile</h1>

            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 mb-8">
                <div className="flex items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold">
                        {profile?.firstName?.[0] || profile?.email?.[0]?.toUpperCase()}
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">{profile?.firstName} {profile?.lastName}</h2>
                        <p className="text-gray-400">{profile?.email}</p>
                        <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold uppercase tracking-wider">
                            <Shield size={12} />
                            {profile?.role === 'BUYER' || profile?.role === 'SELLER' ? 'User' : profile?.role === 'DEALER' ? 'Dealer' : profile?.role}
                        </div>
                    </div>
                </div>
            </div>

            
            {profile?.role === 'DEALER' && (
                <section className="mb-12">
                    <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                        <Shield className="text-primary" /> Dealer Profile Settings
                    </h3>
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Company Name *</label>
                                <input
                                    type="text"
                                    value={dealerForm.companyName}
                                    onChange={(e) => setDealerForm({...dealerForm, companyName: e.target.value})}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">VAT Number *</label>
                                <input
                                    type="text"
                                    value={dealerForm.vatNumber}
                                    onChange={(e) => setDealerForm({...dealerForm, vatNumber: e.target.value})}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Phone</label>
                                <input
                                    type="text"
                                    value={dealerForm.phone}
                                    onChange={(e) => setDealerForm({...dealerForm, phone: e.target.value})}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Website</label>
                                <input
                                    type="url"
                                    value={dealerForm.website}
                                    onChange={(e) => setDealerForm({...dealerForm, website: e.target.value})}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Business Address</label>
                                <input
                                    type="text"
                                    value={dealerForm.businessAddress}
                                    onChange={(e) => setDealerForm({...dealerForm, businessAddress: e.target.value})}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                                />
                            </div>
                            <div className="space-y-2 md:col-span-2">
                                <label className="text-sm font-bold uppercase text-gray-400">Dealership Description</label>
                                <textarea
                                    value={dealerForm.description}
                                    onChange={(e) => setDealerForm({...dealerForm, description: e.target.value})}
                                    rows={4}
                                    className="w-full bg-slate-900 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                                />
                            </div>
                        </div>
                        <div className="mt-6">
                            <Button onClick={handleUpdateDealerProfile} disabled={dealerLoading}>
                                {dealerLoading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
                                Save Dealer Profile
                            </Button>
                        </div>
                    </div>
                </section>
            )}

            <section>
                <h3 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Car className="text-primary" /> Elevate Your Account Role
                </h3>
                <p className="text-gray-400 mb-8">
                    Choose a specialized role to unlock more features across the platform. Some roles require verification.
                </p>

                {success && (
                    <div className="mb-8 p-4 bg-green-500/20 border border-green-500/50 rounded-xl text-green-200 flex items-center gap-3">
                        <CheckCircle2 size={18} />
                        {success}
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {availableRoles.map((role) => (
                        <div key={role.id} className="bg-white/5 border border-white/10 rounded-xl p-6 hover:bg-white/10 transition-colors flex flex-col items-center text-center">
                            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-primary mb-4">
                                <role.icon size={24} />
                            </div>
                            <h4 className="font-bold mb-2">{role.label}</h4>
                            <p className="text-xs text-gray-500 mb-6">{role.sub}</p>
                            <Button
                                variant="outline"
                                size="sm"
                                className="mt-auto w-full"
                                disabled={loading}
                                onClick={() => handleRoleElevation(role.id)}
                            >
                                {loading ? <Loader2 className="animate-spin" size={16} /> : `Become a ${role.label}`}
                            </Button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    )
}
