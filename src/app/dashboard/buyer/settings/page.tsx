"use client"

import * as React from "react"
import Image from "next/image"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"
import { updateProfile } from "@/lib/listingApi"
import { uploadImage } from "@/lib/supabase"
import { Loader2, Check, AlertCircle, Camera, User, Phone, Mail, Bell, Settings as SettingsIcon, MapPin, Hash } from "lucide-react"
import { DeleteAccountSection } from "@/components/dashboard/DeleteAccountSection"

export default function BuyerSettingsPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [firstName, setFirstName] = React.useState("")
    const [lastName, setLastName] = React.useState("")
    const [email, setEmail] = React.useState("")
    const [phone, setPhone] = React.useState("")
    const [location, setLocation] = React.useState("")
    const [postcode, setPostcode] = React.useState("")
    const [profileImage, setProfileImage] = React.useState("")
    const [saving, setSaving] = React.useState(false)
    const [uploadingImage, setUploadingImage] = React.useState(false)
    const [saveStatus, setSaveStatus] = React.useState<"idle" | "success" | "error">("idle")
    const [saveError, setSaveError] = React.useState("")
    const fileInputRef = React.useRef<HTMLInputElement>(null)

    React.useEffect(() => {
        if (profile) {
            setFirstName(profile.firstName || "")
            setLastName(profile.lastName || "")
            setEmail(profile.email || user?.email || "")
            setPhone(profile.phone || "")
            setLocation(profile.location || "")
            setPostcode(profile.postcode || "")
            setProfileImage(profile.profileImage || "")
        } else if (user) {
            setEmail(user.email || "")
            setProfileImage("")
        }
    }, [profile, user])

    const initials = React.useMemo(() => {
        if (firstName && lastName) return `${firstName[0]}${lastName[0]}`.toUpperCase()
        if (firstName) return firstName[0].toUpperCase()
        if (email) return email[0].toUpperCase()
        return "?"
    }, [firstName, lastName, email])

    const handleSave = async () => {
        if (!firstName.trim() || !lastName.trim()) {
            setSaveStatus("error")
            setSaveError("First and last name are required.")
            return
        }
        if (!phone.trim()) {
            setSaveStatus("error")
            setSaveError("A phone number is required — it's shown on your profile and listings.")
            return
        }
        if (!location.trim()) {
            setSaveStatus("error")
            setSaveError("Your location is required.")
            return
        }
        if (!postcode.trim()) {
            setSaveStatus("error")
            setSaveError("Your postal code is required.")
            return
        }
        try {
            setSaving(true)
            setSaveStatus("idle")
            setSaveError("")
            await updateProfile({ firstName, lastName, phone, location, postcode, profileImage })
            setSaveStatus("success")
            setTimeout(() => setSaveStatus("idle"), 3000)
        } catch (err: any) {
            console.error("Failed to save profile:", err)
            setSaveError(err.message || "Failed to save profile.")
            setSaveStatus("error")
        } finally {
            setSaving(false)
        }
    }

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return
        const file = e.target.files[0]
        try {
            setUploadingImage(true)
            const publicUrl = await uploadImage(file, 'listings', 'profiles')
            setProfileImage(publicUrl)
            // Auto-save immediately after upload
            await updateProfile({ profileImage: publicUrl })
        } catch (err) {
            console.error("Failed to upload image:", err)
            alert("Failed to upload image. Please try again.")
        } finally {
            setUploadingImage(false)
            if (fileInputRef.current) fileInputRef.current.value = ""
        }
    }

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Buyer"} />
                <main className="flex-1 space-y-6 max-w-3xl">
                    <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                            <SettingsIcon size={20} className="text-primary" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-black font-heading uppercase tracking-tight">Settings</h1>
                    </div>

                    {/* Profile card */}
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
                        <div className="flex flex-col md:flex-row gap-8">
                            <div className="md:w-1/3">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="w-32 h-32 rounded-full bg-[var(--bg-input)] mx-auto md:mx-0 flex items-center justify-center text-4xl font-bold text-[var(--text-muted)] mb-4 border-2 border-dashed border-[var(--border-default)] relative overflow-hidden group cursor-pointer hover:border-primary transition-colors"
                                >
                                    {uploadingImage ? (
                                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                    ) : profileImage ? (
                                        <Image src={profileImage} alt="Profile" fill sizes="128px" className="object-cover" />
                                    ) : (
                                        initials
                                    )}
                                    {!uploadingImage && (
                                        <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-xs text-white">
                                            <Camera size={20} className="mb-1" />
                                            <span>Upload</span>
                                        </div>
                                    )}
                                </div>
                                <input
                                    type="file"
                                    ref={fileInputRef}
                                    className="hidden"
                                    accept="image/*"
                                    onChange={handleImageUpload}
                                />
                                <p className="text-center md:text-left text-xs text-[var(--text-muted)] mt-2">Recommended: 256x256px JPG or PNG</p>
                            </div>
                            <div className="md:w-2/3 space-y-6">
                                <section>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2 mb-4">
                                        <User size={14} className="text-primary" /> Profile Information
                                    </h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase text-[var(--text-muted)]">First Name</label>
                                            <input type="text" value={firstName} onChange={e => setFirstName(e.target.value)} className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase text-[var(--text-muted)]">Last Name</label>
                                            <input type="text" value={lastName} onChange={e => setLastName(e.target.value)} className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                                <Mail size={11} /> Email Address
                                            </label>
                                            <input type="email" value={email} readOnly className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 text-[var(--text-muted)] cursor-not-allowed outline-none" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                                <Phone size={11} /> Phone Number <span className="text-primary">*</span>
                                            </label>
                                            <input type="tel" placeholder="07123 456789" value={phone} onChange={e => setPhone(e.target.value)} className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                                <MapPin size={11} /> Location <span className="text-primary">*</span>
                                            </label>
                                            <input type="text" placeholder="e.g. London" value={location} onChange={e => setLocation(e.target.value)} className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 focus:border-primary outline-none transition-colors" />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-bold uppercase text-[var(--text-muted)] flex items-center gap-1">
                                                <Hash size={11} /> Postal Code <span className="text-primary">*</span>
                                            </label>
                                            <input type="text" placeholder="e.g. E1 6AN" value={postcode} onChange={e => setPostcode(e.target.value)} className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 focus:border-primary outline-none transition-colors" />
                                        </div>
                                    </div>
                                    <p className="text-[11px] text-[var(--text-muted)] mt-3">
                                        Your phone number is shown on your profile and listings — hidden from visitors who aren't logged in.
                                    </p>
                                </section>
                            </div>
                        </div>
                    </div>

                    {/* Notifications card */}
                    <div className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-6 md:p-8">
                        <h3 className="text-sm font-black uppercase tracking-widest text-[var(--text-muted)] flex items-center gap-2 mb-4">
                            <Bell size={14} className="text-primary" /> Notifications
                        </h3>
                        <div className="space-y-3">
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-[var(--border-default)] text-primary focus:ring-primary bg-[var(--bg-input)]" />
                                <span className="text-sm text-[var(--text-secondary)] group-hover:text-primary dark:group-hover:text-white transition-colors">Email me when a bid is placed</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" defaultChecked className="w-5 h-5 rounded border-[var(--border-default)] text-primary focus:ring-primary bg-[var(--bg-input)]" />
                                <span className="text-sm text-[var(--text-secondary)] group-hover:text-primary dark:group-hover:text-white transition-colors">Email me about auction endings</span>
                            </label>
                            <label className="flex items-center gap-3 cursor-pointer group">
                                <input type="checkbox" className="w-5 h-5 rounded border-[var(--border-default)] text-primary focus:ring-primary bg-[var(--bg-input)]" />
                                <span className="text-sm text-[var(--text-secondary)] group-hover:text-primary dark:group-hover:text-white transition-colors">Marketing and newsletter</span>
                            </label>
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        <button onClick={handleSave} disabled={saving} className="bg-primary text-white font-bold py-3 px-8 rounded-lg shadow-neon hover:bg-red-600 transition-colors disabled:opacity-50 flex items-center gap-2">
                            {saving ? <><Loader2 size={16} className="animate-spin" /> Saving...</> : "Save Changes"}
                        </button>
                        {saveStatus === "success" && <span className="text-emerald-400 text-sm flex items-center gap-1"><Check size={16} /> Saved successfully</span>}
                        {saveStatus === "error" && <span className="text-red-400 text-sm flex items-center gap-1"><AlertCircle size={16} /> {saveError}</span>}
                    </div>

                    <DeleteAccountSection />
                </main>
            </div>
        </div>
    )
}
