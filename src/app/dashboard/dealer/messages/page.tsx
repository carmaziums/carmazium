"use client"

import * as React from "react"
import { MessageSquare, Loader2, Search, Send } from "lucide-react"
import { Input } from "@/components/ui/Input"
import { Button } from "@/components/ui/Button"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { useAuth } from "@/context/AuthContext"

export default function DealerMessagesPage() {
    const { user, profile, loading: authLoading } = useAuth()
    const [contacts, setContacts] = React.useState<any[]>([])
    const [loading, setLoading] = React.useState(true)
    const [activeChat, setActiveChat] = React.useState<string | null>(null)
    const [message, setMessage] = React.useState("")

    React.useEffect(() => {
        if (!authLoading && user) {
            setContacts([])
            setLoading(false)
        }
    }, [user, authLoading])

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 min-w-0">
                    <div className="flex flex-col md:flex-row h-[calc(100vh-160px)] border border-white/5 rounded-2xl overflow-hidden bg-white/5">
                        {/* Contact List */}
                        <div className="w-full md:w-80 border-r border-white/5 flex flex-col">
                            <div className="p-4 border-b border-white/5">
                                <h2 className="text-lg font-black font-heading uppercase tracking-tight mb-3">Messages</h2>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
                                    <Input
                                        placeholder="Search conversations..."
                                        className="pl-9 bg-white/5 border-white/10 text-white text-sm h-9 placeholder:text-gray-500"
                                    />
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto">
                                {loading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                                    </div>
                                ) : !contacts.length ? (
                                    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
                                        <MessageSquare className="h-10 w-10 text-gray-700 mb-3" />
                                        <p className="text-gray-500 text-sm font-bold">No conversations</p>
                                        <p className="text-gray-600 text-xs mt-1">Messages from buyers will appear here</p>
                                    </div>
                                ) : (
                                    contacts.map((contact: any) => (
                                        <div
                                            key={contact.id}
                                            onClick={() => setActiveChat(contact.id)}
                                            className={`p-4 cursor-pointer border-b border-white/5 hover:bg-white/5 transition-colors ${
                                                activeChat === contact.id ? 'bg-white/10' : ''
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center flex-shrink-0">
                                                    <span className="text-sm font-bold text-gray-400">{contact.name?.[0]}</span>
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-bold text-white text-sm truncate">{contact.name}</p>
                                                    <p className="text-xs text-gray-500 truncate">{contact.lastMessage}</p>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>

                        {/* Chat Area */}
                        <div className="flex-1 flex flex-col">
                            {!activeChat ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
                                    <MessageSquare className="h-16 w-16 text-gray-800 mb-4" />
                                    <h3 className="text-lg font-bold text-gray-500">Select a conversation</h3>
                                    <p className="text-gray-600 text-sm mt-1">Choose a contact from the left to start messaging</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex-1 p-6 overflow-y-auto">
                                        {/* Messages will render here */}
                                    </div>
                                    <div className="p-4 border-t border-white/5 flex gap-3">
                                        <Input
                                            placeholder="Type a message..."
                                            value={message}
                                            onChange={e => setMessage(e.target.value)}
                                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 flex-1"
                                        />
                                        <Button className="h-10 px-5 gap-2 shadow-neon" shape="default">
                                            <Send size={16} />
                                        </Button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}
