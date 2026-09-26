"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { X, Send, Search, ArrowRight, Flag, ShieldCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

import { aiChat, reportAiResponse, type AiReportReason } from "@/lib/aiApi"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
    role: "user" | "bot"
    text: string
    prompt?: string
    reportable?: boolean
    /** Optional filter card attached to a bot message */
    filterCard?: {
        label: string
        params: Record<string, string>
    }
}

/** Quick-reply chip displayed below the chat */
interface QuickReply {
    label: string
    action: string // the message text to send
}

const ALL_QUICK_REPLIES: QuickReply[] = [
    { label: "Show SUVs", action: "Show me SUVs" },
    { label: "Under £15k", action: "Cars under £15,000" },
    { label: "Diesel only", action: "Diesel cars" },
    { label: "Electric", action: "Electric vehicles" },
    { label: "2020+", action: "Cars from 2020 onwards" },
    { label: "ULEZ", action: "ULEZ compliant cars" },
    { label: "Hatchbacks", action: "Show me hot hatchbacks" },
    { label: "Sports Cars", action: "Show me sports cars" },
    { label: "Family Cars", action: "Spacious family cars" },
    { label: "First Cars", action: "Good cars for new drivers" },
    { label: "Low CO2", action: "Cars with low CO2 emissions" },
    { label: "Executive", action: "Executive saloons" }
]

// ─── Component ────────────────────────────────────────────────────────────────

export function MaziumWidget() {
    const router = useRouter()
    const [isOpen, setIsOpen] = React.useState(false)
    const [messages, setMessages] = React.useState<ChatMessage[]>([
        {
            role: "bot",
            text: "Hi! I'm Mazium, your AI car-buying assistant. Tell me what you're looking for and I'll find it!",
        },
    ])
    const [input, setInput] = React.useState("")
    // showGreeting: null = not yet determined (SSR-safe), true = visible, false = hidden
    const [showGreeting, setShowGreeting] = React.useState<boolean | null>(null)
    const [isThinking, setIsThinking] = React.useState(false)
    const [quickReplies, setQuickReplies] = React.useState<QuickReply[]>([])
    const [hasAiConsent, setHasAiConsent] = React.useState<boolean | null>(null)
    const [reportTarget, setReportTarget] = React.useState<ChatMessage | null>(null)
    const [reportReason, setReportReason] = React.useState<AiReportReason | "">("")
    const [reportDetails, setReportDetails] = React.useState("")
    const [isReporting, setIsReporting] = React.useState(false)
    const [reportedResponses, setReportedResponses] = React.useState<Set<string>>(new Set())
    const messagesEndRef = React.useRef<HTMLDivElement>(null)
    const greetingIntervalRef = React.useRef<NodeJS.Timeout | null>(null)

    React.useEffect(() => {
        setHasAiConsent(localStorage.getItem("mazium_ai_consent_v1") === "accepted")
    }, [])

    // Set daily dynamic quick replies on mount
    React.useEffect(() => {
        // Deterministic day index
        const dayIndex = Math.floor(Date.now() / 86400000)
        const startIndex = (dayIndex * 4) % ALL_QUICK_REPLIES.length
        
        const replies = []
        for (let i = 0; i < 4; i++) {
            replies.push(ALL_QUICK_REPLIES[(startIndex + i) % ALL_QUICK_REPLIES.length])
        }
        setQuickReplies(replies)
    }, [])

    // Auto-scroll to latest message
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isThinking])

    // On mount: respect permanent dismissal stored in localStorage
    React.useEffect(() => {
        const dismissed = localStorage.getItem('mazium_greeting_dismissed') === 'true'
        if (dismissed) {
            setShowGreeting(false)
            return
        }
        // Show greeting initially, then toggle every 20s (show 20s, hide 20s)
        setShowGreeting(true)
        greetingIntervalRef.current = setInterval(() => {
            setShowGreeting(prev => !prev)
        }, 20000)
        return () => {
            if (greetingIntervalRef.current) clearInterval(greetingIntervalRef.current)
        }
    }, [])

    const handleToggle = () => {
        setIsOpen(!isOpen)
        if (!isOpen) setShowGreeting(false)
    }

    /**
     * Process user message via OpenAI-powered backend.
     * Sends the conversation history and returns AI response with optional filter card.
     */
    const processMessage = async (
        userMessage: string,
        currentMessages: ChatMessage[]
    ): Promise<ChatMessage> => {
        try {
            // Build conversation history for the API (last 10 messages)
            const history = [...currentMessages, { role: "user" as const, text: userMessage }]
                .slice(-10)
                .map((m) => ({
                    role: (m.role === "bot" ? "assistant" : "user") as "user" | "assistant",
                    content: m.text,
                }))

            const result = await aiChat(history)

            return {
                role: "bot",
                text: result.text,
                prompt: userMessage,
                reportable: true,
                filterCard: result.filterCard || undefined,
            }
        } catch (error) {
            console.error("AI chat error:", error)
            return {
                role: "bot",
                text: "Something went wrong. Please try again! 🔄",
            }
        }
    }

    const handleSend = async (message?: string) => {
        const text = (message || input).trim()
        if (!text || hasAiConsent !== true) return
        setInput("")

        // Add user message
        const updatedMessages = [...messages, { role: "user" as const, text }]
        setMessages(updatedMessages)
        setIsThinking(true)

        try {
            const reply = await processMessage(text, updatedMessages)
            setMessages((prev) => [...prev, reply])
        } catch {
            setMessages((prev) => [
                ...prev,
                { role: "bot", text: "Something went wrong. Please try again!" },
            ])
        } finally {
            setIsThinking(false)
        }
    }

    const acceptAiConsent = () => {
        localStorage.setItem("mazium_ai_consent_v1", "accepted")
        setHasAiConsent(true)
    }

    const withdrawAiConsent = () => {
        localStorage.removeItem("mazium_ai_consent_v1")
        setHasAiConsent(false)
        setInput("")
    }

    const submitAiReport = async () => {
        if (!reportTarget || !reportReason || isReporting) return
        try {
            setIsReporting(true)
            await reportAiResponse({
                prompt: reportTarget.prompt,
                response: reportTarget.text,
                reason: reportReason,
                details: reportDetails.trim() || undefined,
            })
            setReportedResponses(prev => {
                const next = new Set(prev)
                next.add(reportTarget.text)
                return next
            })
            setReportTarget(null)
            setReportReason("")
            setReportDetails("")
        } finally {
            setIsReporting(false)
        }
    }

    const handleApplyFilterCard = (params: Record<string, any>) => {
        const cleanParams: Record<string, string> = {}
        for (const [key, value] of Object.entries(params)) {
            if (value !== null && value !== undefined && value !== '') {
                cleanParams[key] = String(value)
            }
        }
        const qs = new URLSearchParams(cleanParams).toString()
        router.push(`/search?${qs}`)
    }
    return (
        <>
            {/* Mobile backdrop — tap outside to close (desktop widget is small enough not to need one) */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
                    onClick={() => setIsOpen(false)}
                />
            )}
            <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] lg:bottom-24 right-4 sm:right-6 z-[60] flex flex-col items-end opacity-100">
            {/* Chat Window */}
            <div
                className={cn(
                    "rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out border flex flex-col",
                    isOpen
                        ? "w-[min(340px,calc(100vw_-_2rem))] h-[min(540px,calc(100dvh_-_16rem_-_env(safe-area-inset-bottom)))] lg:h-[min(540px,calc(100dvh_-_16.5rem))] opacity-100 translate-y-0 mb-4"
                        : "w-0 h-0 opacity-0 translate-y-10 pointer-events-none mb-0"
                )}
                style={{
                    background: "var(--bg-dropdown)",
                    borderColor: "var(--border-default)",
                }}
            >
                {/* Header */}
                <div className="shrink-0 bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 relative">
                            <Image src="/assets/images/mazium-bot-3d.png" alt="Mazium" width={40} height={40} className="w-full h-full object-contain" unoptimized />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Mazium AI</h3>
                            <p className="text-xs text-gray-300">
                                Car-buying assistant
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-gray-300 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4 custom-scrollbar"
                    style={{ background: "var(--bg-card)" }}
                >
                    {hasAiConsent === false && (
                        <div className="rounded-xl border p-3 text-xs leading-relaxed"
                            style={{ background: "var(--bg-input)", borderColor: "var(--border-default)", color: "var(--text-secondary)" }}
                        >
                            <div className="flex items-center gap-2 font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                                <ShieldCheck size={14} className="text-primary" />
                                Before you use Mazium AI
                            </div>
                            <p>Your message and recent Mazium chat context are sent to OpenAI to generate a response. AI can make mistakes, so verify important vehicle or finance information. Do not include passwords, payment credentials or unnecessary sensitive personal information.</p>
                            <div className="mt-3 flex items-center gap-2">
                                <button
                                    onClick={acceptAiConsent}
                                    className="rounded-lg bg-primary px-3 py-2 font-bold text-white"
                                >
                                    I understand & continue
                                </button>
                                <button
                                    onClick={() => router.push("/privacy-policy")}
                                    className="rounded-lg border px-3 py-2 font-bold"
                                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                                >
                                    Privacy
                                </button>
                            </div>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div
                            key={i}
                            className={cn(
                                "flex",
                                msg.role === "user"
                                    ? "justify-end"
                                    : "justify-start"
                            )}
                        >
                            <div className="max-w-[85%] space-y-2">
                                <div
                                    className={cn(
                                        "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                                        msg.role === "user"
                                            ? "bg-primary text-white rounded-br-none"
                                            : "rounded-bl-none border shadow-sm"
                                    )}
                                    style={
                                        msg.role === "bot"
                                            ? {
                                                background: "var(--bg-input)",
                                                borderColor: "var(--border-default)",
                                                color: "var(--text-primary)",
                                            }
                                            : undefined
                                    }
                                >
                                    {msg.text}
                                </div>

                                {/* Filter Confirmation Card */}
                                {msg.filterCard && (
                                    <button
                                        onClick={() =>
                                            handleApplyFilterCard(
                                                msg.filterCard!.params
                                            )
                                        }
                                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border transition-all hover:scale-[1.02] group cursor-pointer"
                                        style={{
                                            background: "var(--bg-card)",
                                            borderColor: "var(--border-default)",
                                        }}
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                            <Search
                                                size={14}
                                                className="text-primary"
                                            />
                                        </div>
                                        <div className="text-left flex-1">
                                            <p className="text-xs font-bold uppercase tracking-wider"
                                                style={{ color: "var(--text-muted)" }}
                                            >
                                                Apply Filters
                                            </p>
                                            <p className="text-sm font-semibold"
                                                style={{ color: "var(--text-primary)" }}
                                            >
                                                {msg.filterCard.label}
                                            </p>
                                        </div>
                                        <ArrowRight
                                            size={14}
                                            className="text-primary group-hover:translate-x-1 transition-transform"
                                        />
                                    </button>
                                )}

                                {msg.role === "bot" && msg.reportable && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setReportTarget(msg)
                                            setReportReason("")
                                            setReportDetails("")
                                        }}
                                        disabled={reportedResponses.has(msg.text)}
                                        className="inline-flex items-center gap-1.5 text-[11px] font-semibold disabled:opacity-60"
                                        style={{ color: "var(--text-muted)" }}
                                    >
                                        <Flag size={12} />
                                        {reportedResponses.has(msg.text) ? "Reported" : "Report AI response"}
                                    </button>
                                )}
                            </div>
                        </div>
                    ))}

                    {reportTarget && (
                        <div className="rounded-xl border p-3 space-y-3"
                            style={{ background: "var(--bg-input)", borderColor: "var(--border-default)" }}
                        >
                            <div className="flex items-center justify-between">
                                <p className="text-xs font-black" style={{ color: "var(--text-primary)" }}>Report this AI response</p>
                                <button
                                    type="button"
                                    onClick={() => setReportTarget(null)}
                                    disabled={isReporting}
                                    aria-label="Close AI report"
                                    style={{ color: "var(--text-muted)" }}
                                >
                                    <X size={14} />
                                </button>
                            </div>
                            <select
                                value={reportReason}
                                onChange={e => setReportReason(e.target.value as AiReportReason | "")}
                                className="w-full rounded-lg border px-3 py-2 text-xs"
                                style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                            >
                                <option value="">Choose a reason</option>
                                <option value="UNSAFE_OFFENSIVE">Unsafe or offensive</option>
                                <option value="INACCURATE_MISLEADING">Inaccurate or misleading</option>
                                <option value="SCAM_DISHONEST">Scam or dishonest guidance</option>
                                <option value="OTHER">Other</option>
                            </select>
                            <textarea
                                value={reportDetails}
                                onChange={e => setReportDetails(e.target.value.slice(0, 1000))}
                                placeholder="Optional details"
                                maxLength={1000}
                                className="min-h-16 w-full resize-none rounded-lg border px-3 py-2 text-xs"
                                style={{ background: "var(--bg-card)", borderColor: "var(--border-default)", color: "var(--text-primary)" }}
                            />
                            <button
                                type="button"
                                onClick={() => void submitAiReport()}
                                disabled={!reportReason || isReporting}
                                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-black text-white disabled:opacity-50"
                            >
                                {isReporting ? "Submitting…" : "Submit report"}
                            </button>
                        </div>
                    )}

                    {/* Thinking Indicator */}
                    {isThinking && (
                        <div className="flex justify-start">
                            <div
                                className="rounded-2xl rounded-bl-none px-4 py-3 border shadow-sm"
                                style={{
                                    background: "var(--bg-input)",
                                    borderColor: "var(--border-default)",
                                }}
                            >
                                <div className="flex gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                                </div>
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Quick-Reply Chips */}
                <div className="shrink-0 px-3 py-2 flex gap-2 overflow-x-auto border-t custom-scrollbar"
                    style={{ borderColor: "var(--border-default)" }}
                >
                    {quickReplies.map((chip) => (
                        <button
                            key={chip.label}
                            onClick={() => handleSend(chip.action)}
                            disabled={isThinking || hasAiConsent !== true}
                            className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all hover:scale-105 disabled:opacity-50 cursor-pointer"
                            style={{
                                borderColor: "var(--border-default)",
                                color: "var(--text-secondary)",
                            }}
                        >
                            {chip.label}
                        </button>
                    ))}
                </div>

                {/* Input */}
                <div
                    className="shrink-0 p-3 flex gap-2 border-t"
                    style={{ borderColor: "var(--border-default)" }}
                >
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="e.g. Show me BMWs under £20k..."
                        className="h-10 text-sm"
                        style={{
                            background: "var(--bg-input)",
                            borderColor: "var(--border-default)",
                            color: "var(--text-primary)",
                        }}
                        onKeyDown={(e) =>
                            e.key === "Enter" && !isThinking && handleSend()
                        }
                        disabled={isThinking || hasAiConsent !== true}
                    />
                    <Button
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full shadow-neon"
                        onClick={() => handleSend()}
                        disabled={isThinking || hasAiConsent !== true || !input.trim()}
                    >
                        <Send size={16} />
                    </Button>
                </div>

                {hasAiConsent === true && (
                    <div
                        className="shrink-0 flex items-center justify-center gap-3 border-t px-3 py-1.5 text-[10px]"
                        style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}
                    >
                        <button type="button" onClick={() => router.push("/privacy-policy")} className="hover:underline">
                            AI privacy
                        </button>
                        <span aria-hidden="true">·</span>
                        <button type="button" onClick={withdrawAiConsent} className="hover:underline">
                            Stop AI sharing
                        </button>
                    </div>
                )}
            </div>

            {/* Greeting Pop-up */}
            <AnimatePresence>
                {!isOpen && showGreeting === true && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.9 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{
                            opacity: 0,
                            scale: 0.9,
                            transition: { duration: 0.2 },
                        }}
                        className="absolute bottom-20 right-0 px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 z-40 mb-2 origin-bottom-right w-max max-w-[min(260px,calc(100vw_-_2rem))]"
                        style={{
                            background: "var(--bg-dropdown)",
                            borderColor: "var(--border-default)",
                        }}
                    >
                        <div className="relative shrink-0">
                            <div className="w-2 h-2 bg-green-500 rounded-full absolute -top-1 -right-1 animate-pulse z-10" />
                            <Image src="/assets/images/mazium-bot-3d.png" alt="Mazium" width={32} height={32} className="object-contain" unoptimized />
                        </div>
                        <div className="min-w-0">
                            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                                Hi, I&apos;m Mazium! 👋
                            </p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                How can I help you today?
                            </p>
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation()
                                // Permanently dismiss — never show again
                                localStorage.setItem('mazium_greeting_dismissed', 'true')
                                if (greetingIntervalRef.current) clearInterval(greetingIntervalRef.current)
                                setShowGreeting(false)
                            }}
                            className="ml-2 p-1 hover:bg-primary/10 rounded-full transition-colors"
                            style={{ color: "var(--text-muted)" }}
                        >
                            <X size={14} />
                        </button>

                        {/* Speech Bubble Arrow */}
                        <div
                            className="absolute -bottom-2 right-6 w-4 h-4 rotate-45 border-b border-r"
                            style={{
                                background: "var(--bg-dropdown)",
                                borderColor: "var(--border-default)",
                            }}
                        />
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <button
                type="button"
                aria-label={isOpen ? "Close Mazium AI assistant" : "Open Mazium AI assistant"}
                onClick={handleToggle}
                className={cn(
                    "flex items-center justify-center p-0 border-0",
                    isOpen
                        ? "h-14 w-14 rounded-full bg-slate-800 shadow-[0_4px_20px_rgba(237,28,36,0.5)] transition-all duration-300 hover:scale-105 active:scale-95"
                        : "h-16 w-16 rounded-none bg-transparent shadow-none overflow-visible"
                )}
                style={!isOpen ? { backgroundColor: "transparent", boxShadow: "none" } : undefined}
            >
                {isOpen ? (
                    <X size={24} className="text-white" />
                ) : (
                    <Image
                        src="/assets/images/mazium-bot-3d.png"
                        alt="Mazium AI"
                        width={64}
                        height={64}
                        className="block h-16 w-16 object-contain drop-shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                        priority
                        unoptimized
                        draggable={false}
                    />
                )}
            </button>
            </div>
        </>
    )
}
