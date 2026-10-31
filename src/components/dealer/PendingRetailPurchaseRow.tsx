"use client"

import * as React from "react"
import Image from "next/image"
import Link from "next/link"
import { createPortal } from "react-dom"
import { ChevronRight, Clock, FileText, MoreHorizontal, User } from "lucide-react"
import type { Offer } from "@/lib/listingApi"
import { CompletePurchaseButton } from "@/components/purchases/CompletePurchaseButton"

const OFFER_DESTINATION = "/dashboard/buyer/offers"

/**
 * Accepted retail offers are NOT Sale records yet. Match PipelineRow's visual
 * layout without giving them purchase details, buyer-fee checkout, or a Sale
 * cancellation action that cannot exist until the seller records the sale.
 */
export function PendingRetailPurchaseRow({ offer, onCompleted }: { offer: Offer; onCompleted?: () => void }) {
    const [menuOpen, setMenuOpen] = React.useState(false)
    const menuRef = React.useRef<HTMLDivElement>(null)
    const popupRef = React.useRef<HTMLDivElement>(null)
    const [menuPosition, setMenuPosition] = React.useState({ top: 0, left: 0 })
    const listing = offer.listing
    const vehicleTitle = listing?.title || "Retail vehicle"
    const imageUrl = listing?.images?.find(Boolean)
    const subtitle = [listing?.make, listing?.model, listing?.year]
        .filter(value => value !== null && value !== undefined && value !== "")
        .join(" · ")
    const acceptedPrice = Number(offer.finalAmount ?? offer.counterAmount ?? offer.amount)
    const formattedPrice = Number.isFinite(acceptedPrice) ? acceptedPrice.toLocaleString("en-GB") : "—"

    const updateMenuPosition = React.useCallback(() => {
        const anchor = menuRef.current?.getBoundingClientRect()
        if (!anchor) return
        const width = Math.min(256, window.innerWidth - 24)
        const height = 120
        const top = anchor.bottom + height + 8 <= window.innerHeight
            ? anchor.bottom + 4
            : Math.max(12, anchor.top - height - 4)
        setMenuPosition({
            top: Math.max(12, Math.min(top, window.innerHeight - height - 12)),
            left: Math.max(12, Math.min(anchor.right - width, window.innerWidth - width - 12)),
        })
    }, [])

    React.useEffect(() => {
        if (!menuOpen) return
        updateMenuPosition()
        const onOutsideClick = (event: MouseEvent) => {
            if (!menuRef.current?.contains(event.target as Node)
                && !popupRef.current?.contains(event.target as Node)) {
                setMenuOpen(false)
            }
        }
        document.addEventListener("mousedown", onOutsideClick)
        window.addEventListener("resize", updateMenuPosition)
        window.addEventListener("scroll", updateMenuPosition, true)
        return () => {
            document.removeEventListener("mousedown", onOutsideClick)
            window.removeEventListener("resize", updateMenuPosition)
            window.removeEventListener("scroll", updateMenuPosition, true)
        }
    }, [menuOpen, updateMenuPosition])

    return (
        <article className="dealer-glass-card p-0 group hover:border-white/8">
            <div className="flex flex-wrap items-start gap-3 p-4 md:flex-nowrap md:items-center md:gap-4 md:p-5">
                {/* Identical thumbnail dimensions to recorded purchase cards. */}
                <div className="w-16 h-16 md:w-20 md:h-16 rounded-xl overflow-hidden bg-[var(--bg-input)] shrink-0 border border-[var(--border-default)] relative">
                    {imageUrl ? (
                        <Image src={imageUrl} alt={vehicleTitle} fill sizes="80px" className="object-cover" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center">
                            <FileText size={20} className="text-[var(--text-muted)]" aria-hidden="true" />
                        </div>
                    )}
                </div>

                <div className="min-w-0 flex-1 basis-[calc(100%-6rem)] md:basis-auto">
                    <h3 className="text-sm font-black tracking-tight break-words md:truncate group-hover:text-primary transition-colors">
                        {vehicleTitle}
                    </h3>
                    {subtitle && (
                        <p className="text-xs text-[var(--text-muted)] font-medium mt-0.5 break-words md:truncate">{subtitle}</p>
                    )}
                    <p className="text-xs text-[var(--text-muted)] mt-1 font-medium">
                        Accepted {new Date(offer.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    <Link href={OFFER_DESTINATION}
                        className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded">
                        View accepted offer <ChevronRight size={13} aria-hidden="true" />
                    </Link>
                    <div>
                        <Link href={OFFER_DESTINATION}
                            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary rounded">
                            Seller: Contact through accepted offer <ChevronRight size={13} aria-hidden="true" />
                        </Link>
                    </div>
                    {/* Either party can complete the sale once paid (owner rule). */}
                    <CompletePurchaseButton listingId={offer.listingId} onCompleted={onCompleted} className="mt-2" />
                </div>

                <div className="order-2 w-full md:order-none md:block md:w-auto text-left md:text-right shrink-0">
                    <span className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)] block">Price</span>
                    <span className="text-lg font-black tabular-nums">£{formattedPrice}</span>
                </div>

                <div className="order-3 md:order-none flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest border shrink-0 bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                    <Clock size={12} aria-hidden="true" />
                    <span>Sale Pending</span>
                </div>

                {/* Same portal positioning as PipelineRow: no clipped mobile menu. */}
                <div className="relative order-4 ml-auto shrink-0 md:order-none md:ml-0" ref={menuRef}>
                    <button
                        type="button"
                        onClick={() => { updateMenuPosition(); setMenuOpen(value => !value) }}
                        aria-label={`Purchase actions for ${vehicleTitle}`}
                        aria-expanded={menuOpen}
                        aria-haspopup="menu"
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card)] transition-colors text-[var(--text-muted)] hover:text-primary dark:hover:text-white"
                    >
                        <MoreHorizontal size={16} aria-hidden="true" />
                    </button>
                    {menuOpen && createPortal(
                        <div ref={popupRef} role="menu"
                            style={{ top: menuPosition.top, left: menuPosition.left, width: Math.min(256, typeof window !== "undefined" ? window.innerWidth - 24 : 256) }}
                            className="fixed z-[200] bg-[var(--bg-dropdown)] backdrop-blur-xl border border-[var(--border-default)] rounded-xl shadow-2xl shadow-black/60 overflow-hidden">
                            <div className="py-1">
                                <Link role="menuitem" href={OFFER_DESTINATION} onClick={() => setMenuOpen(false)}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-secondary)] hover:text-primary dark:hover:text-white hover:bg-[var(--bg-card)]">
                                    <FileText size={14} className="text-[var(--text-muted)]" />
                                    View accepted offer <ChevronRight size={12} className="ml-auto" />
                                </Link>
                                <Link role="menuitem" href={OFFER_DESTINATION} onClick={() => setMenuOpen(false)}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-sm text-[var(--text-secondary)] hover:text-primary dark:hover:text-white hover:bg-[var(--bg-card)]">
                                    <User size={14} className="text-[var(--text-muted)]" />
                                    Contact seller <ChevronRight size={12} className="ml-auto" />
                                </Link>
                            </div>
                        </div>,
                        document.body,
                    )}
                </div>
            </div>
        </article>
    )
}
