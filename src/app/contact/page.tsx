"use client"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { MapPin, Phone, Mail } from "lucide-react"

export default function ContactPage() {
    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5">
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-12 text-center">Contact Us</h1>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Contact Form */}
                    <div className="lg:w-2/3 glass-card p-8">
                        <h3 className="text-2xl font-bold mb-6">Send us a message</h3>
                        <form className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[var(--text-muted)] text-sm">Full Name</label>
                                    <Input placeholder="John Doe" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[var(--text-muted)] text-sm">Email Address</label>
                                    <Input placeholder="john@example.com" />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[var(--text-muted)] text-sm">Subject</label>
                                <Input placeholder="Inquiry about..." />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[var(--text-muted)] text-sm">Message</label>
                                <Textarea
                                    className="w-full min-h-[150px] resize-y"
                                    placeholder="How can we help you?"
                                />
                            </div>
                            <Button className="w-full">Send Message</Button>
                        </form>
                    </div>

                    {/* Contact Info */}
                    <div className="lg:w-1/3 space-y-6">
                        <div className="glass-card p-6 flex items-start gap-4">
                            <MapPin className="text-primary shrink-0" />
                            <div>
                                <h4 className="font-bold mb-1">Visit Us</h4>
                                <p className="text-[var(--text-muted)] text-sm">181-187 Hunters Rd<br />Lozells, Birmingham<br />B19 1ES, United Kingdom</p>
                            </div>
                        </div>
                        <div className="glass-card p-6 flex items-start gap-4">
                            <Phone className="text-primary shrink-0" />
                            <div>
                                <h4 className="font-bold mb-1">Call Us</h4>
                                <p className="text-[var(--text-muted)] text-sm"><a href="tel:+441218385040" className="hover:text-primary transition-colors">0121 838 5040</a></p>
                                <p className="text-[var(--text-faint)] text-xs mt-1">Mon - Fri: 9am - 6pm</p>
                            </div>
                        </div>
                        <div className="glass-card p-6 flex items-start gap-4">
                            <Mail className="text-primary shrink-0" />
                            <div>
                                <h4 className="font-bold mb-1">Email Us</h4>
                                <p className="text-[var(--text-muted)] text-sm"><a href="mailto:info@carmazium.com" className="hover:text-primary transition-colors">info@carmazium.com</a></p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
