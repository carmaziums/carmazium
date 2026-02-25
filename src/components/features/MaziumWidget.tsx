"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { MessageSquare, X, Send, Sparkles, Search, ArrowRight, Car } from "lucide-react"
import { cn } from "@/lib/utils"
import { motion, AnimatePresence } from "framer-motion"

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

const QUICK_REPLIES: QuickReply[] = [
    { label: "🚗 Show SUVs", action: "Show me SUVs" },
    { label: "💷 Under £15k", action: "Cars under £15,000" },
    { label: "⛽ Diesel only", action: "Diesel cars" },
    { label: "⚡ Electric", action: "Electric vehicles" },
    { label: "📅 2020+", action: "Cars from 2020 onwards" },
    { label: "🏙️ ULEZ", action: "ULEZ compliant cars" },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function MaziumWidget() {
    const router = useRouter()
    const [isOpen, setIsOpen] = React.useState(false)
    const [messages, setMessages] = React.useState<ChatMessage[]>([
        {
            role: "bot",
            text: "Hello! I'm Mazium AI — your car-buying assistant. Tell me what you're looking for and I'll find it for you!",
        },
    ])
    const [input, setInput] = React.useState("")
    const [showGreeting, setShowGreeting] = React.useState(false)
    const [isThinking, setIsThinking] = React.useState(false)
    const messagesEndRef = React.useRef<HTMLDivElement>(null)

    // Auto-scroll to latest message
    React.useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }, [messages, isThinking])

    // Show greeting bubble after 30s
    React.useEffect(() => {
        const timer = setTimeout(() => setShowGreeting(true), 30000)
        return () => clearTimeout(timer)
    }, [])

    const handleToggle = () => {
        setIsOpen(!isOpen)
        if (!isOpen) setShowGreeting(false)
    }

    /**
     * Process user message — currently a placeholder.
     * Replace this function body with your LLM API call.
     * Return value should include `text` (the bot reply) and optionally a `filterCard`.
     */
    const processMessage = async (
        userMessage: string
    ): Promise<ChatMessage> => {
        // ──────────────────────────────────────────────────────────────────
        // 🔌 LLM HOOK — Replace this with your API call
        // Example return shape:
        //   {
        //     role: "bot",
        //     text: "Here are BMWs under £20k!",
        //     filterCard: { label: "BMW · Under £20,000", params: { make: "BMW", maxPrice: "20000" } }
        //   }
        // ──────────────────────────────────────────────────────────────────
        await new Promise((r) => setTimeout(r, 1200)) // simulate latency

        return {
            role: "bot",
            text: "I'm getting smarter soon! For now, try the quick-reply chips below or use the search filters on the left. 🔍",
        }
    }

    const handleSend = async (message?: string) => {
        const text = (message || input).trim()
        if (!text) return
        setInput("")

        // Add user message
        setMessages((prev) => [...prev, { role: "user", text }])
        setIsThinking(true)

        try {
            const reply = await processMessage(text)
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

    const handleApplyFilterCard = (params: Record<string, string>) => {
        const qs = new URLSearchParams(params).toString()
        router.push(`/search?${qs}`)
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
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
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center relative">
                            <Sparkles size={20} className="text-primary" />
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
                    {QUICK_REPLIES.map((chip) => (
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
                {!isOpen && showGreeting && (
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
                            <div className="w-2 h-2 bg-green-500 rounded-full absolute -top-1 -right-1 animate-pulse" />
                            <Sparkles className="text-primary w-5 h-5" />
                        </div>
                        <div>
                            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>
                                Hi there! 👋
                            </p>
                            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                                Need help looking for a car?
                            </p>
                        </div>

                        <button
                            onClick={(e) => {
                                e.stopPropagation()
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
                    "h-14 w-14 rounded-full shadow-[0_4px_20px_rgba(237,28,36,0.5)] flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95",
                    isOpen
                        ? "bg-slate-800 text-white"
                        : "bg-gradient-to-r from-[#ed1c24] to-[#7f1d1d] text-white animate-float"
                )}
            >
                {isOpen ? (
                    <X size={24} />
                ) : (
                    <Sparkles size={24} className="animate-pulse" />
                )}
            </button>
        </div>
    )
}
