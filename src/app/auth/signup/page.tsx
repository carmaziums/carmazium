"use client"

import Link from "next/link"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { ArrowLeft, Car, Wrench, CreditCard, Shield, Handshake } from "lucide-react"

export default function SignupPage() {
    return (
        <div className="min-h-screen pt-24 pb-12 flex items-center justify-center bg-[url('/assets/images/signup-bg.png')] bg-cover bg-center relative">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

            <div className="relative z-10 w-full max-w-md bg-white/10 backdrop-blur-md p-8 shadow-2xl border border-white/20 rounded-2xl text-white">
                <Link href="/" className="inline-flex items-center text-gray-300 hover:text-white mb-6 text-sm font-medium transition-colors">
                    <ArrowLeft size={16} className="mr-1" /> Back to Home
                </Link>

                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2 font-heading">Create Account</h1>
                    <p className="text-gray-300">Join CarMazium to buy, sell, and auction</p>
                </div>

                <form className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label htmlFor="fname" className="text-xs font-bold uppercase tracking-wide block text-gray-200">First Name</label>
                            <Input id="fname" type="text" placeholder="John" required className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30" />
                        </div>
                        <div className="space-y-2">
                            <label htmlFor="lname" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Last Name</label>
                            <Input id="lname" type="text" placeholder="Doe" required className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="email" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Email Address</label>
                        <Input id="email" type="email" placeholder="john@example.com" required className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30" />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="password" className="text-xs font-bold uppercase tracking-wide block text-gray-200">Password</label>
                        <Input id="password" type="password" placeholder="Create a password" required className="bg-white/20 border-white/10 text-white placeholder:text-gray-400 focus:bg-white/30" />
                    </div>

                    <div className="space-y-2 relative group-dropdown">
                        <label className="text-xs font-bold uppercase tracking-wide block text-gray-200">Join As</label>
                        <div className="relative">
                            <input type="checkbox" id="dropdown-toggle" className="peer hidden" />
                            <label htmlFor="dropdown-toggle" className="flex items-center justify-between w-full h-14 px-4 bg-slate-900/60 border border-white/10 rounded-xl cursor-pointer text-white hover:border-primary/50 transition-colors">
                                <span className="flex items-center gap-3">
                                    <span className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                                        <Car size={16} />
                                    </span>
                                    <span>Member - Buy & Sell Vehicles</span>
                                </span>
                                <ArrowLeft className="rotate-[-90deg] text-gray-400 peer-checked:rotate-90 transition-transform" size={16} />
                            </label>

                            {/* Dropdown Menu */}
                            <div className="absolute top-full left-0 w-full mt-2 bg-slate-900 border border-white/10 rounded-xl shadow-2xl overflow-hidden hidden peer-checked:block z-50 animate-in fade-in zoom-in-95 duration-200">
                                {[
                                    { id: 'member', icon: Car, label: 'Member - Buy & Sell Vehicles', sub: 'KYC verified trading' },
                                    { id: 'contractor', icon: Wrench, label: 'Contractor - Automotive services', sub: 'Vehicle Inspectors • Drivers' },
                                    { id: 'finance', icon: CreditCard, label: 'Finance Provider', sub: 'Vehicle financing services' },
                                    { id: 'insurance', icon: Shield, label: 'Insurance Provider', sub: 'Vehicle insurance services' },
                                    { id: 'partner', icon: Handshake, label: 'Partners Login', sub: 'Collaborate with us' }
                                ].map((role) => (
                                    <div key={role.id} className="flex items-center gap-4 p-4 hover:bg-white/5 cursor-pointer border-b border-white/5 last:border-0 transition-colors group">
                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${role.id === 'member' ? 'bg-primary/20 text-primary' : 'bg-slate-800 text-gray-400 group-hover:bg-primary/20 group-hover:text-primary'}`}>
                                            <role.icon size={20} />
                                        </div>
                                        <div>
                                            <p className="font-bold text-white text-sm">{role.label}</p>
                                            <p className="text-xs text-gray-500">{role.sub}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    <Button className="w-full h-12 text-lg shadow-[0_4px_15px_rgba(237,28,36,0.4)]" shape="default">Create Account</Button>
                </form>

                <div className="my-8 flex items-center gap-4 text-gray-400">
                    <div className="h-px bg-white/10 flex-1" />
                    <span className="text-sm">Or continue with</span>
                    <div className="h-px bg-white/10 flex-1" />
                </div>

                <div className="flex gap-4">
                    <Button variant="outline" className="flex-1 border-white/20 hover:bg-white/10 text-white h-12">
                        <span className="sr-only">Google</span>
                        <img src="/assets/images/google-icon.png" alt="Google" className="w-5 h-5 mx-auto" />
                    </Button>
                    <Button variant="outline" className="flex-1 border-white/20 hover:bg-white/10 text-white h-12">
                        <span className="sr-only">Apple</span>
                        <svg className="w-5 h-5 mx-auto fill-current" viewBox="0 0 24 24">
                            <path d="M17.05 20.28c-.98.95-2.05.88-3.08.38-1.09-.54-2.08-.55-3.18 0-1.15.58-1.95.5-3.04-.54-2.61-2.5-3.26-6.84-.75-10.42 1.48-2.11 3.53-2.3 4.96-.86.74.75 1.54.91 2.37.07 1.3-1.32 3.19-1.21 4.79-.18.15.65.3.93.42 1.13-2.19-1.57-2.9-4.22-1.77-5.91 2.5 1.7 3.25 4.79 1.48 7.08-1.07 1.41-2.08 2.44-3.56 3.9l1.36 5.35z" />
                        </svg>
                    </Button>
                </div>

                <div className="mt-8 text-center text-sm text-gray-300">
                    Already have an account? <Link href="/auth/login" className="text-primary font-bold hover:text-red-400 transition-colors">Log In</Link>
                </div>
            </div>
        </div>
    )
}
