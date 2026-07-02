"use client"

import * as React from "react"
import { MessageSquare, Sparkles, ShieldCheck, Activity, Shield } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { ChatRoomList } from "@/components/chat/ChatRoomList"
import dynamic from "next/dynamic"
const ChatWindow = dynamic(() => import("@/components/chat/ChatWindow").then(mod => mod.ChatWindow), { ssr: false })
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { useSearchParams } from "next/navigation"
import type { ChatRoom } from "@/lib/chatApi"
import { DEALER_ROUTE_CONFIG } from "@/config/dealerRouteConfig"

function MessagesContent() {
    const { user, profile, loading } = useAuth()
    const { rooms, refreshRooms } = useChat()
    const searchParams = useSearchParams()
    const targetRoomId = searchParams.get("room")
    const [selectedRoom, setSelectedRoom] = React.useState<ChatRoom | null>(null)
    const autoSelectedRef = React.useRef(false)

    React.useEffect(() => {
        if (!user) return
        refreshRooms()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    // Auto-select from ?room= exactly once — selectedRoom intentionally excluded
    // from deps to prevent manual clicks being overridden by this effect.
    React.useEffect(() => {
        if (!targetRoomId || autoSelectedRef.current) return
        const match = rooms.find(r => r.id === targetRoomId)
        if (match) {
            setSelectedRoom(match)
            autoSelectedRef.current = true
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [rooms, targetRoomId])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#0A0A0C]">
                <div className="relative">
                    <div className="h-20 w-20 rounded-full border-t-2 border-primary animate-spin opacity-50"></div>
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Activity className="text-primary animate-pulse" size={24} />
                    </div>
                </div>
            </div>
        )
    }

    const userName = profile?.firstName
        ? `${profile.firstName} ${profile.lastName || ""}`
        : (user?.email?.split('@')[0] || "Dealer")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="dealer" userName={userName} userType="Dealer Account" />

                <main className="flex-1 min-w-0">
                    <div className="dealer-glass-card overflow-hidden h-[calc(100vh-180px)] flex flex-col">
                        <div className="p-4 sm:p-6 border-b border-white/5 flex items-center justify-between bg-[#0A0A0C]/40 shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-black/60 rounded-xl border border-white/10 shadow-2xl">
                                    <MessageSquare className="text-white" size={20} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black font-heading text-white uppercase tracking-tighter metallic-foil">
                                        {DEALER_ROUTE_CONFIG[6].title}
                                    </h2>
                                    <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">
                                        {DEALER_ROUTE_CONFIG[6].subHeader}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <div className="flex flex-1 min-h-0 overflow-hidden">
                            {/* Room List */}
                            <div className={`w-full lg:w-80 border-r border-white/10 ${selectedRoom ? 'hidden lg:block' : ''}`}>
                                <ChatRoomList
                                    onSelectRoom={setSelectedRoom}
                                    selectedRoomId={selectedRoom?.id}
                                />
                            </div>

                            {/* Chat Window */}
                            <div className={`flex-1 ${!selectedRoom ? 'hidden lg:flex lg:items-center lg:justify-center' : ''}`}>
                                {selectedRoom ? (
                                    <ChatWindow
                                        room={selectedRoom}
                                        onBack={() => setSelectedRoom(null)}
                                    />
                                ) : (
                                    <div className="text-center p-12 bg-[#0A0A0C]/20 rounded-2xl border border-white/5 m-8 border-dashed">
                                        <div className="relative w-20 h-20 mx-auto mb-6">
                                            <div className="absolute inset-0 bg-primary/20 blur-3xl animate-pulse rounded-full" />
                                            <div className="relative z-10 w-20 h-20 bg-black/60 rounded-full flex items-center justify-center border border-white/10">
                                                <Sparkles className="w-8 h-8 text-primary opacity-50" />
                                            </div>
                                        </div>
                                        <p className="text-xl font-black text-white tracking-tight">Select a VIP Channel</p>
                                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-2">Initialize secure contact with prospects</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default function DealerMessagesPage() {
    return (
        <React.Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        }>
            <MessagesContent />
        </React.Suspense>
    )
}
