"use client"

import * as React from "react"
import { X, Send, User, Mail, Phone, MessageSquare, Loader2, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/Button"
import { apiClient } from "@/lib/apiClient"

interface EnquireModalProps {
    listingId: string
    dealerProfileId: string
    isOpen: boolean
    onClose: () => void
    sellerName?: string
    carTitle?: string
}

export function EnquireModal({ listingId, dealerProfileId, isOpen, onClose, sellerName, carTitle }: EnquireModalProps) {
    const [status, setStatus] = React.useState<"idle" | "loading" | "success" | "error">("idle")
    const [errorMsg, setErrorMsg] = React.useState("")
    const [formData, setFormData] = React.useState({
        buyerName: "",
        buyerEmail: "",
        buyerPhone: "",
        notes: "",
    })

    if (!isOpen) return null

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setStatus("loading")
        setErrorMsg("")

        try {
            await apiClient('/dealers/leads', {
                method: 'POST',
                body: JSON.stringify({
                    dealerProfileId,
                    listingId,
                    buyerName: formData.buyerName,
                    buyerEmail: formData.buyerEmail,
                    buyerPhone: formData.buyerPhone,
                    notes: formData.notes,
                    source: "listing_enquiry"
                })
            })
            setStatus("success")
            setTimeout(() => {
                onClose()
                setStatus("idle")
                setFormData({ buyerName: "", buyerEmail: "", buyerPhone: "", notes: "" })
            }, 2000)
        } catch (err: any) {
            console.error('Lead error:', err)
            setStatus("error")
            setErrorMsg(err.message || "Failed to send enquiry. Please try again.")
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex justify-center overflow-y-auto p-4 sm:p-5" onClick={onClose}>
            <div className="glass-card p-6 sm:p-8 max-w-md w-full relative my-auto h-fit border border-white/10 rounded-2xl bg-[#0A0A0C]" onClick={(e) => e.stopPropagation()}>
                <button 
                    onClick={onClose} 
                    className="absolute top-4 right-4 text-gray-500 hover:text-white transition-colors disabled:opacity-50"
                >
                    <X size={24} />
                </button>

                <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary shadow-neon">
                    <MessageSquare size={32} />
                </div>
                
                <h2 className="text-2xl font-bold font-heading mb-2 text-white text-center tracking-tight">
                    {sellerName ? `Contact ${sellerName}` : 'Contact Seller'}
                </h2>
                {carTitle && (
                    <p className="text-xs text-primary font-semibold text-center mb-1 truncate px-4">{carTitle}</p>
                )}
                <p className="text-gray-400 mb-6 text-center text-sm">Send an enquiry and the seller will get back to you.</p>

                {status === "success" ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center animate-in fade-in zoom-in duration-300">
                        <CheckCircle className="text-emerald-500 w-16 h-16 mb-4" />
                        <h3 className="text-xl font-bold text-white mb-2">Enquiry Sent!</h3>
                        <p className="text-gray-400">The seller will get back to you shortly.</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {status === "error" && (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm text-center">
                                {errorMsg}
                            </div>
                        )}
                        
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Your Name *</label>
                            <div className="relative">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                                <input 
                                    type="text" 
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="John Doe"
                                    value={formData.buyerName}
                                    onChange={(e) => setFormData({...formData, buyerName: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Email Address *</label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                                <input 
                                    type="email" 
                                    required
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="john@example.com"
                                    value={formData.buyerEmail}
                                    onChange={(e) => setFormData({...formData, buyerEmail: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Phone Number (Optional)</label>
                            <div className="relative">
                                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 w-5 h-5" />
                                <input 
                                    type="tel" 
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-10 pr-4 text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
                                    placeholder="07123 456789"
                                    value={formData.buyerPhone}
                                    onChange={(e) => setFormData({...formData, buyerPhone: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider ml-1">Message</label>
                            <textarea 
                                className="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 text-white placeholder-gray-500 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all h-24 resize-none"
                                placeholder="I'm interested in this vehicle. Is it still available?"
                                value={formData.notes}
                                onChange={(e) => setFormData({...formData, notes: e.target.value})}
                            />
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full h-12 shadow-neon mt-2 font-bold text-[15px]"
                            disabled={status === "loading" || !formData.buyerName || !formData.buyerEmail}
                        >
                            {status === "loading" ? (
                                <><Loader2 className="animate-spin mr-2" size={18} /> Sending...</>
                            ) : (
                                <><Send className="mr-2" size={18} /> Send Enquiry</>
                            )}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    )
}
