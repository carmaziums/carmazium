"use client"

import { useState, type FormEvent } from "react"

import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Textarea } from "@/components/ui/Textarea"
import { MapPin, Phone, Mail } from "lucide-react"

export default function ContactPage() {
    const [emailDraftAttempted, setEmailDraftAttempted] = useState(false)

    // No public abuse-protected message API exists. Open the visitor's mail
    // application rather than implying that the website sent an enquiry.
    const openEmailDraft = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const name = String(form.get("fullName") ?? "").trim()
        const email = String(form.get("email") ?? "").trim()
        const subject = String(form.get("subject") ?? "").trim()
        const message = String(form.get("message") ?? "").trim()
        if (!name || !email || !subject || !message) return

        const emailSubject = encodeURIComponent("CarMazium enquiry: " + subject)
        const emailBody = encodeURIComponent(
            "Name: " + name + "\n" +
            "Reply-to email: " + email + "\n\n" +
            "Message:\n" + message
        )
        setEmailDraftAttempted(true)
        window.location.href = "mailto:info@carmazium.com?subject=" + emailSubject + "&body=" + emailBody
    }

    return (
        <div className="min-h-screen pt-20 pb-12">
            <div className="container mx-auto px-5">
                <h1 className="text-4xl md:text-5xl font-heading font-bold mb-12 text-center">Contact Us</h1>

                <div className="flex flex-col lg:flex-row gap-8">
                    {/* Contact Form */}
                    <div className="lg:w-2/3 glass-card p-8">
                        <h3 className="text-2xl font-bold mb-6">Send us a message</h3>
                        <form className="space-y-6" onSubmit={openEmailDraft}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label htmlFor="contact-full-name" className="text-[var(--text-muted)] text-sm">Full Name</label>
                                    <Input id="contact-full-name" name="fullName" autoComplete="name" maxLength={100} placeholder="Your name" required />
                                </div>
                                <div className="space-y-2">
                                    <label htmlFor="contact-email" className="text-[var(--text-muted)] text-sm">Email Address</label>
                                    <Input id="contact-email" name="email" type="email" autoComplete="email" maxLength={254} placeholder="you@example.com" required />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="contact-subject" className="text-[var(--text-muted)] text-sm">Subject</label>
                                <Input id="contact-subject" name="subject" maxLength={120} placeholder="Enquiry about..." required />
                            </div>
                            <div className="space-y-2">
                                <label htmlFor="contact-message" className="text-[var(--text-muted)] text-sm">Message</label>
                                <Textarea
                                    id="contact-message"
                                    name="message"
                                    required
                                    maxLength={1800}
                                    className="w-full min-h-[150px] resize-y"
                                    placeholder="How can we help you? Please do not include passwords or bank details."
                                />
                            </div>
                            <Button type="submit" className="w-full">Open email draft</Button>
                            <p className="text-sm leading-6 text-[var(--text-secondary)]">
                                This opens your email application with a prepared enquiry. Review it and press Send in your email app.
                                Nothing is sent from this website automatically.
                            </p>
                            {emailDraftAttempted && (
                                <p role="status" className="text-sm leading-6 text-[var(--text-secondary)]">
                                    If no email app opened, contact{" "}
                                    <a href="mailto:info@carmazium.com" className="font-bold text-primary underline">info@carmazium.com</a>
                                    {" "}directly. Your enquiry has not been sent by this page.
                                </p>
                            )}
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
                                <p className="text-[var(--text-faint)] text-xs mt-1">Mon – Fri, 9am – 6pm UK time</p>
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
