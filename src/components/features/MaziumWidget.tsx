"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { X, Send, Search, ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"
import Image from "next/image"

import { aiChat } from "@/lib/aiApi"

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
    role: "user" | "bot"
    text: string
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
    const messagesEndRef = React.useRef<HTMLDivElement>(null)
    const greetingIntervalRef = React.useRef<NodeJS.Timeout | null>(null)
    const [scrolled, setScrolled] = React.useState(false)

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

    React.useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > 400)
        window.addEventListener('scroll', onScroll, { passive: true })
        return () => window.removeEventListener('scroll', onScroll)
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
        if (!text) return
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
        <div className={cn(
            "fixed bottom-24 lg:bottom-6 right-4 sm:right-6 z-50 flex flex-col items-end transition-opacity duration-500",
            scrolled && !isOpen ? "opacity-30 hover:opacity-100" : "opacity-100"
        )}>
            {/* Chat Window */}
            <div
                className={cn(
                    "rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out border mb-4",
                    isOpen
                        ? "w-[380px] h-[540px] opacity-100 translate-y-0"
                        : "w-[380px] h-0 opacity-0 translate-y-10 pointer-events-none"
                )}
                style={{
                    background: "var(--bg-dropdown)",
                    borderColor: "var(--border-default)",
                }}
            >
                {/* Header */}
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden relative">
                            <Image src="/assets/images/mazium-bot.jpeg" alt="Mazium" width={40} height={40} className="w-full h-full object-cover" />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-slate-900" />
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Mazium AI</h3>
                            <p className="text-xs text-gray-400">
                                Car-buying assistant
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={() => setIsOpen(false)}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Messages */}
                <div className="h-[340px] overflow-y-auto p-4 space-y-4 custom-scrollbar"
                    style={{ background: "var(--bg-card)" }}
                >
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
                            </div>
                        </div>
                    ))}

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
                <div className="px-3 py-2 flex gap-2 overflow-x-auto border-t custom-scrollbar"
                    style={{ borderColor: "var(--border-default)" }}
                >
                    {quickReplies.map((chip) => (
                        <button
                            key={chip.label}
                            onClick={() => handleSend(chip.action)}
                            disabled={isThinking}
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
                    className="p-3 flex gap-2 border-t"
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
                        disabled={isThinking}
                    />
                    <Button
                        size="icon"
                        className="h-10 w-10 shrink-0 rounded-full shadow-neon"
                        onClick={() => handleSend()}
                        disabled={isThinking || !input.trim()}
                    >
                        <Send size={16} />
                    </Button>
                </div>
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
                        className="absolute bottom-20 right-0 px-5 py-3 rounded-2xl shadow-xl border flex items-center gap-3 z-40 mb-2 origin-bottom-right"
                        style={{
                            background: "var(--bg-dropdown)",
                            borderColor: "var(--border-default)",
                        }}
                    >
                        <div className="relative">
                            <div className="w-2 h-2 bg-green-500 rounded-full absolute -top-1 -right-1 animate-pulse z-10" />
                            <Image src="/assets/images/mazium-bot.jpeg" alt="Mazium" width={32} height={32} className="rounded-full" />
                        </div>
                        <div>
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
                onClick={handleToggle}
                className={cn(
                    "h-14 w-14 rounded-full shadow-[0_4px_20px_rgba(237,28,36,0.5)] flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 overflow-hidden",
                    isOpen ? "bg-slate-800" : "animate-float"
                )}
            >
                {isOpen ? (
                    <X size={24} className="text-white" />
                ) : (
                    <Image src="/assets/images/mazium-bot.jpeg" alt="Mazium AI" width={56} height={56} className="w-full h-full object-cover" />
                )}
            </button>
        </div>
    )
}
