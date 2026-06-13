"use client"

import * as React from "react"
import { MessageSquare } from "lucide-react"
import { DashboardSidebar } from "@/components/dashboard/DashboardSidebar"
import { ChatRoomList } from "@/components/chat/ChatRoomList"
import dynamic from "next/dynamic"
const ChatWindow = dynamic(() => import("@/components/chat/ChatWindow").then(mod => mod.ChatWindow), { ssr: false })
import { useAuth } from "@/context/AuthContext"
import { useChat } from "@/context/ChatContext"
import { useSearchParams } from "next/navigation"
import type { ChatRoom } from "@/lib/chatApi"

function MessagesContent() {
    const { user, profile, loading } = useAuth()
    const { rooms, refreshRooms } = useChat()
    const searchParams = useSearchParams()
    const targetRoomId = searchParams.get("room")
    const [selectedRoom, setSelectedRoom] = React.useState<ChatRoom | null>(null)

    // On mount (or when a ?room= param is present), refresh the room list
    // so a newly-created room appears without a manual page reload
    React.useEffect(() => {
        if (!user) return
        refreshRooms()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user])

    // Auto-select the room specified via ?room= query param.
    // Runs whenever rooms updates (including after upsertRoom from the vehicle page).
    React.useEffect(() => {
        if (!targetRoomId) return
        if (selectedRoom?.id === targetRoomId) return
        const match = rooms.find(r => r.id === targetRoomId)
        if (match) setSelectedRoom(match)
    }, [rooms, targetRoomId, selectedRoom])

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-slate-900">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        )
    }

    const userName = profile?.firstName ? `${profile.firstName} ${profile.lastName || ""}` : (user?.email?.split('@')[0] || "User")

    return (
        <div className="min-h-screen pt-20 pb-12 bg-slate-900 text-white">
            <div className="container mx-auto px-5 flex flex-col lg:flex-row gap-8">
                <DashboardSidebar role="buyer" userName={userName} userType={profile?.role ? `${profile.role} Account` : "Buyer"} />

                <main className="flex-1">
                    <div className="glass-card overflow-hidden h-[calc(100vh-180px)]">
                        <div className="p-6 border-b border-white/10 flex items-center gap-3">
                            <MessageSquare className="text-primary" />
                            <h2 className="text-xl font-bold font-heading text-white">Messages</h2>
                        </div>

                        <div className="flex h-[calc(100%-80px)]">
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
                                    <div className="text-center text-gray-500">
                                        <MessageSquare className="w-16 h-16 mx-auto mb-4 opacity-30" />
                                        <p className="text-lg">Select a conversation</p>
                                        <p className="text-sm mt-1">Choose from your existing conversations</p>
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

export default function BuyerMessagesPage() {
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
