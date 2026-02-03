"use client"

import * as React from "react"
import { useAuth } from "@/context/AuthContext"
import { Button } from "@/components/ui/Button"
import { Shield, Car, Wrench, CreditCard, Loader2, CheckCircle2 } from "lucide-react"

export default function ProfilePage() {
    const { profile, refreshProfile, loading: authLoading } = useAuth()
    const [loading, setLoading] = React.useState(false)
    const [success, setSuccess] = React.useState<string | null>(null)

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'https://carmazium.onrender.com'

    const handleRoleElevation = async (newRole: string) => {
        setLoading(true)
        setSuccess(null)
        try {
            const { data: { session } } = await (window as any).supabase.auth.getSession()
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

    const availableRoles = [
        { id: 'DEALER', icon: Shield, label: 'Dealer', sub: 'For car dealerships and businesses' },
        { id: 'CONTRACTOR', icon: Wrench, label: 'Contractor', sub: 'For inspectors and drivers' },
        { id: 'FINANCE_PARTNER', icon: CreditCard, label: 'Finance Partner', sub: 'For lending institutions' },
    ].filter(r => r.id !== profile?.role)

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
                            {profile?.role}
                        </div>
                    </div>
                </div>
            </div>

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
