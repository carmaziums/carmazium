"use client"

import * as React from "react"
import Image from "next/image"
import { Camera, ClipboardList, History, ShieldAlert } from "lucide-react"
import { ImageLightbox } from "@/components/features/ImageLightbox"
import { parseVehicleImagePresentation } from "@/lib/vehicleImagePresentation"
import type { PurchaseListingRecord } from "@/lib/dealerPurchaseDetail"

const yesNo = (v: boolean | null) => v == null ? "Not provided" : v ? "Yes" : "No"
const fmtDate = (v: string | null) => v ? new Date(v).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null

function Row({ label, value }: { label: string; value: React.ReactNode }) {
    if (value == null || value === "") return null
    return (
        <div className="flex justify-between gap-4 border-b border-[var(--border-default)] py-2 text-sm last:border-0">
            <span className="text-[var(--text-muted)]">{label}</span>
            <span className="text-right font-semibold text-[var(--text-primary)] break-words">{value}</span>
        </div>
    )
}

/**
 * The advert a dealer bought against: every photo (full screen, zoomable via
 * the lightbox), the seller's description, specification, history, seller
 * declarations and declared damage. Used during physical inspection.
 * Listing evidence only: seller contact details are never shown here.
 */
export function PurchaseVehicleRecord({ record, title }: { record: PurchaseListingRecord; title: string }) {
    const photos = React.useMemo(
        () => record.images.filter(Boolean).map(raw => ({ raw, src: parseVehicleImagePresentation(raw).src })),
        [record.images])
    const damagePhotos = React.useMemo(
        () => record.damage.map(d => d.imageUrl).filter((u): u is string => !!u), [record.damage])
    const [lightbox, setLightbox] = React.useState<{ images: string[]; index: number } | null>(null)
    const d = record.sellerDeclarations
    const features = Array.isArray(record.features) ? (record.features as unknown[]).filter(f => typeof f === "string") as string[] : []

    return (
        <section id="original-listing" className="dealer-glass-card p-5 md:p-7 space-y-5">
            <div>
                <h2 className="flex items-center gap-2 text-lg font-black"><ClipboardList size={20} className="text-primary" /> Listing record</h2>
                {/* Honest provenance: no purchase-time snapshot exists yet. */}
                <p className="mt-2 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs leading-relaxed text-[var(--text-secondary)]">
                    <History size={15} className="mt-0.5 shrink-0 text-amber-500" />
                    {record.source === "PURCHASE_SNAPSHOT"
                        ? "Saved when you bought this vehicle."
                        : <>Current listing{record.lastUpdatedAt ? `, last updated ${fmtDate(record.lastUpdatedAt)}` : ""}. The seller may have changed it since you bought the vehicle.{record.removedFromSaleAt ? ` Removed from sale ${fmtDate(record.removedFromSaleAt)}.` : ""}</>}
                </p>
            </div>

            {photos.length > 0 ? (
                <div>
                    <p className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]"><Camera size={14} /> {photos.length} photos</p>
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {photos.map((p, i) => (
                            <button key={`${p.raw}-${i}`} type="button" onClick={() => setLightbox({ images: photos.map(x => x.src), index: i })}
                                className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[var(--border-default)]"
                                aria-label={`Open photo ${i + 1} of ${photos.length}`}>
                                <Image src={p.src} alt="" fill sizes="(max-width: 640px) 33vw, 160px" className="object-cover" loading="lazy" />
                            </button>
                        ))}
                    </div>
                </div>
            ) : <p className="text-sm text-[var(--text-muted)]">No photos are stored for this listing.</p>}

            {record.description && (
                <div>
                    <h3 className="mb-1 text-sm font-black">Seller&apos;s description</h3>
                    <p className="whitespace-pre-line text-sm leading-relaxed text-[var(--text-secondary)]">{record.description}</p>
                </div>
            )}

            <div>
                <h3 className="mb-1 text-sm font-black">Specification and history</h3>
                <Row label="Variant" value={record.variant} />
                <Row label="First registered" value={record.firstRegistered} />
                <Row label="Fuel" value={record.fuelType} />
                <Row label="Transmission" value={record.transmission} />
                <Row label="Body" value={record.bodyType} />
                <Row label="Drive" value={record.driveType} />
                <Row label="Engine" value={record.engineSize ? `${record.engineSize} cc` : null} />
                <Row label="Power" value={record.bhp ? `${record.bhp} bhp` : null} />
                <Row label="Colour" value={record.color} />
                <Row label="Doors / seats" value={record.doors || record.seats ? `${record.doors ?? "–"} / ${record.seats ?? "–"}` : null} />
                <Row label="VIN" value={record.vin} />
                <Row label="Previous owners" value={record.owners} />
                <Row label="Keys" value={record.numberOfKeys} />
                <Row label="Service history" value={record.serviceHistory} />
                <Row label="MOT" value={[record.motStatus, record.motExpiryDate ? `expires ${fmtDate(record.motExpiryDate)}` : null].filter(Boolean).join(", ")} />
                <Row label="Condition grade" value={record.exteriorGrade ? `Grade ${record.exteriorGrade}` : null} />
                <Row label="Insurance write-off" value={record.writeOffCategory && record.writeOffCategory !== "NONE" ? record.writeOffCategory : null} />
                {features.length > 0 && <Row label="Features" value={features.join(", ")} />}
            </div>

            <div>
                <h3 className="mb-1 flex items-center gap-2 text-sm font-black"><ShieldAlert size={16} className="text-primary" /> Seller declarations</h3>
                <Row label="Known mechanical issues" value={d.mechanicalIssues || "None declared"} />
                <Row label="Known electrical issues" value={d.electricalIssues || "None declared"} />
                <Row label="Outstanding finance" value={yesNo(d.hasOutstandingFinance)} />
                <Row label="Stolen and recovered" value={yesNo(d.stolenRecovered)} />
                <Row label="Seller is registered keeper" value={yesNo(d.isLegalRegisteredKeeper)} />
            </div>

            <div>
                <h3 className="mb-2 text-sm font-black">Declared damage ({record.damage.length})</h3>
                {record.damage.length === 0 ? <p className="text-sm text-[var(--text-muted)]">No damage was declared on the listing.</p> : (
                    <ul className="space-y-2">
                        {record.damage.map(item => (
                            <li key={item.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-default)] p-2">
                                {item.imageUrl ? (
                                    <button type="button" onClick={() => setLightbox({ images: damagePhotos, index: damagePhotos.indexOf(item.imageUrl!) })}
                                        className="relative h-14 w-20 shrink-0 overflow-hidden rounded-lg" aria-label={`Open damage photo: ${item.part}`}>
                                        <Image src={item.imageUrl} alt="" fill sizes="80px" className="object-cover" />
                                    </button>
                                ) : <span className="h-14 w-20 shrink-0 rounded-lg bg-[var(--bg-input)]" aria-hidden />}
                                <span className="text-sm"><span className="font-bold">{item.part}</span><br /><span className="text-[var(--text-muted)]">{item.type} · {item.size}</span></span>
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {lightbox && <ImageLightbox images={lightbox.images} alt={title} startIndex={Math.max(0, lightbox.index)} open onClose={() => setLightbox(null)} />}
        </section>
    )
}
