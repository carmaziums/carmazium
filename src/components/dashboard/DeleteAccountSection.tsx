"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import { AlertTriangle, Loader2, X } from "lucide-react"
import { useAuth } from "@/context/AuthContext"
import { deleteAccount } from "@/lib/userApi"

/**
 * Self-contained "Danger Zone" card — drop into any settings page. Deleting
 * is a soft-delete + anonymize on the backend, not a hard delete, but from
 * the user's side it's final: no undo, no re-login after this.
 */
export function DeleteAccountSection() {
    const router = useRouter()
    const { signOut } = useAuth()
    const [modalOpen, setModalOpen] = React.useState(false)
    const [confirmText, setConfirmText] = React.useState("")
    const [deleting, setDeleting] = React.useState(false)
    const [error, setError] = React.useState<string | null>(null)

    const handleDelete = async () => {
        setDeleting(true)
        setError(null)
        try {
            await deleteAccount(confirmText)
            await signOut()
            router.push("/")
        } catch (e: any) {
            setError(e?.message || "Failed to delete account. Please try again.")
            setDeleting(false)
        }
    }

    return (
        <>
            <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-6 md:p-8">
                <h3 className="text-sm font-black uppercase tracking-widest text-red-400 flex items-center gap-2 mb-2">
                    <AlertTriangle size={14} /> Danger Zone
                </h3>
                <p className="text-sm text-[var(--text-secondary)] mb-4">
                    Permanently delete your account. This cannot be undone — your listings will be withdrawn and your
                    personal details removed.
                </p>
                <button
                    onClick={() => setModalOpen(true)}
                    className="px-5 py-2.5 rounded-lg border border-red-500/40 text-red-400 text-sm font-bold hover:bg-red-500/10 transition-colors"
                >
                    Delete Account
                </button>
            </div>

            {modalOpen && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
                    onClick={(e) => { if (e.target === e.currentTarget && !deleting) setModalOpen(false) }}
                >
                    <div className="relative w-full max-w-md bg-[var(--bg-dropdown)] border border-[var(--border-default)] rounded-2xl shadow-2xl p-6">
                        <button
                            onClick={() => setModalOpen(false)}
                            disabled={deleting}
                            className="absolute top-4 right-4 text-[var(--text-muted)] hover:text-primary dark:hover:text-white transition-colors disabled:opacity-40"
                        >
                            <X size={18} />
                        </button>

                        <div className="w-11 h-11 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-4">
                            <AlertTriangle size={20} className="text-red-400" />
                        </div>
                        <h2 className="font-bold text-lg text-[var(--text-primary)] mb-2">Delete your account?</h2>
                        <p className="text-sm text-[var(--text-secondary)] mb-4">
                            This is permanent. Your active listings will be withdrawn and your personal details removed.
                            Type <strong className="text-red-400">DELETE</strong> below to confirm.
                        </p>

                        <input
                            type="text"
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder="Type DELETE"
                            disabled={deleting}
                            className="w-full h-11 bg-[var(--bg-input)] border border-[var(--border-default)] rounded-lg px-4 mb-3 focus:border-red-500 outline-none transition-colors"
                        />

                        {error && <p className="text-sm text-red-400 mb-3">{error}</p>}

                        <div className="flex gap-3">
                            <button
                                onClick={() => setModalOpen(false)}
                                disabled={deleting}
                                className="flex-1 py-2.5 rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] text-sm font-bold hover:bg-[var(--bg-card)] transition-colors disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleDelete}
                                disabled={deleting || confirmText.trim().toUpperCase() !== "DELETE"}
                                className="flex-1 py-2.5 rounded-lg bg-red-600 text-white text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {deleting ? <Loader2 size={16} className="animate-spin" /> : null}
                                {deleting ? "Deleting…" : "Delete Account"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    )
}
