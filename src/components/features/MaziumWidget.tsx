"use client"

import * as React from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { MessageSquare, X, Send, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

export function MaziumWidget() {
    const [isOpen, setIsOpen] = React.useState(false)
    const [messages, setMessages] = React.useState([
        { role: "bot", text: "Hello! I'm Mazium AI. How can I help you find your dream car today?" }
    ])
    const [input, setInput] = React.useState("")

    const handleSend = () => {
        if (!input.trim()) return
        setMessages(prev => [...prev, { role: "user", text: input }])
        setInput("")
        // Simulate response
        setTimeout(() => {
            setMessages(prev => [...prev, { role: "bot", text: "I'm just a demo UI right now, but I'll be smart soon!" }])
        }, 1000)
    }

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            <div
                className={cn(
                    "bg-white rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out border border-gray-200 mb-4",
                    isOpen ? "w-[350px] h-[500px] opacity-100 translate-y-0" : "w-[350px] h-0 opacity-0 translate-y-10 pointer-events-none"
                )}
            >
                {/* Header */}
                <div className="bg-slate-900 p-4 text-white flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center relative">
                            <Sparkles size={20} className="text-primary" />
                            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border border-slate-900"></span>
                        </div>
                        <div>
                            <h3 className="font-bold text-sm">Mazium AI</h3>
                            <p className="text-xs text-gray-400">Assistant</p>
                        </div>
                    </div>
                    <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-white"><X size={20} /></button>
                </div>

                {/* Messages */}
                <div className="h-[380px] overflow-y-auto p-4 space-y-4 bg-gray-50">
                    {messages.map((msg, i) => (
                        <div key={i} className={cn("flex", msg.role === 'user' ? "justify-end" : "justify-start")}>
                            <div
                                className={cn(
                                    "max-w-[80%] rounded-2xl px-4 py-2 text-sm",
                                    msg.role === 'user' ? "bg-primary text-white rounded-br-none" : "bg-white border border-gray-200 text-gray-700 rounded-bl-none shadow-sm"
                                )}
                            >
                                {msg.text}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Input */}
                <div className="p-3 bg-white border-t border-gray-100 flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="Ask anything..."
                        className="h-10 text-sm bg-gray-50 border-gray-200 focus:bg-white"
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                    />
                    <Button size="icon" className="h-10 w-10 shrink-0 rounded-full" onClick={handleSend} shape="pill">
                        <Send size={16} />
                    </Button>
                </div>
            </div>

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "h-14 w-14 rounded-full shadow-[0_4px_20px_rgba(237,28,36,0.5)] flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95",
                    isOpen ? "bg-slate-800 text-white" : "bg-gradient-to-r from-[#ed1c24] to-[#7f1d1d] text-white animate-float"
                )}
            >
                {isOpen ? <X size={24} /> : <Sparkles size={24} className="animate-pulse" />}
            </button>
        </div>
    )
}
