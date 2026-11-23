import { redirect } from "next/navigation"
// Messages have no remaining specialist-only legacy UI. Preserve the room link.
export default async function LegacyMessagesPage({searchParams}: {searchParams: Promise<{room?:string}>}) {
    const {room}=await searchParams
    redirect("/dashboard/user?tab=messages" + (typeof room==="string" ? "&room="+encodeURIComponent(room) : ""))
}
