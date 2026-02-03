"use client"

import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { Search, Send, MapPin, Phone, User, MoreVertical } from "lucide-react"
import { useState } from "react"
import Link from "next/link"
import Image from "next/image"

export default function ProviderMessagesPage() {
    // Mock Data
    const conversations = [
        { id: 1, name: "Michael Knight", lastMsg: "When will the parts arrive?", time: "2:30 PM", unread: 0, avatar: null, active: true },
        { id: 2, name: "Tony Stark", lastMsg: "Invoice paid. Thanks!", time: "Jan 18", unread: 0, avatar: null, active: false },
    ]

    const [messages, setMessages] = useState([
        { id: 1, text: "Hi, just checking on the status of my Trans Am.", sender: "them", time: "2:00 PM" },
        { id: 2, text: "Hello Michael. We've ordered the new intake manifold. It should be here by Friday.", sender: "me", time: "2:15 PM" },
        { id: 3, text: "Okay, sounds good. When will the parts arrive?", sender: "them", time: "2:30 PM" },
    ])

    const [newMessage, setNewMessage] = useState("")

    const handleSend = () => {
        if (!newMessage.trim()) return
        setMessages([...messages, { id: Date.now(), text: newMessage, sender: "me", time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }])
        setNewMessage("")
    }

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">

                <DashboardSidebar role="provider" />

                <main className="flex-1 h-[800px] flex gap-6">
                    {/* Chat List */}
                    <div className="w-1/3 glass-card flex flex-col hidden md:flex">
                        <div className="p-4 border-b border-white/10">
                            <h2 className="font-bold text-white mb-4">Messages</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                                <Input placeholder="Search messages..." className="pl-9 h-10 bg-slate-800/50 border-white/10" />
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {conversations.map(chat => (
                                <div key={chat.id} className={`p-4 border-b border-white/5 cursor-pointer hover:bg-white/5 transition-colors ${chat.active ? "bg-primary/5 border-l-2 border-l-primary" : ""}`}>
                                    <div className="flex justify-between items-start mb-1">
                                        <h3 className={`font-bold text-sm ${chat.active ? "text-primary" : "text-white"}`}>{chat.name}</h3>
                                        <span className="text-xs text-gray-500">{chat.time}</span>
                                    </div>
                                    <p className="text-xs text-gray-400 truncate max-w-[180px]">{chat.lastMsg}</p>
                                    {chat.unread > 0 && (
                                        <div className="mt-2 text-xs bg-primary text-white w-5 h-5 flex items-center justify-center rounded-full font-bold ml-auto">
                                            {chat.unread}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Chat Window */}
                    <div className="flex-1 glass-card flex flex-col overflow-hidden">
                        {/* Chat Header */}
                        <div className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-800/30">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                                    <User className="text-gray-400" size={20} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">Michael Knight</h3>
                                    <div className="flex items-center gap-2 text-xs text-emerald-400">
                                        <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span> Online
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white"><Phone size={18} /></Button>
                                <Button size="sm" variant="ghost" className="text-gray-400 hover:text-white"><MoreVertical size={18} /></Button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-900/20">
                            {messages.map((msg) => (
                                <div key={msg.id} className={`flex ${msg.sender === "me" ? "justify-end" : "justify-start"}`}>
                                    <div className={`max-w-[70%] p-4 rounded-2xl text-sm ${msg.sender === "me"
                                        ? "bg-primary text-white rounded-tr-none shadow-neon"
                                        : "bg-slate-800 text-gray-200 border border-white/10 rounded-tl-none"
                                        }`}>
                                        <p>{msg.text}</p>
                                        <p className={`text-[10px] mt-1 text-right ${msg.sender === "me" ? "text-white/70" : "text-gray-500"}`}>{msg.time}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Input Area */}
                        <div className="p-4 bg-slate-800/30 border-t border-white/10">
                            <div className="flex gap-2">
                                <Input
                                    className="bg-slate-900 border-white/10 text-white"
                                    placeholder="Type your message..."
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                                />
                                <Button onClick={handleSend} className="bg-primary hover:bg-primary/80 shadow-neon w-12 px-0 flex items-center justify-center">
                                    <Send size={18} />
                                </Button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
