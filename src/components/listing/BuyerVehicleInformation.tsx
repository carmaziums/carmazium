"use client"

import * as React from "react"
import { AlertTriangle, CalendarDays, CheckCircle2, ClipboardList, Gauge, History, Info, Settings2 } from "lucide-react"
import type { Listing, ListingMotHistoryEntry } from "@/lib/listingApi"

type Fact = { label: string; value: React.ReactNode }
const present = (v: unknown): boolean =>
    v !== null && v !== undefined && v !== "" && !(typeof v === "number" && !Number.isFinite(v))
const humanize = (v: string): string => v.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
const ukDate = (date: string | null | undefined): string | null => {
    if (!date) return null
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (!match) return date
    const [, year, month, day] = match
    const parsed = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
    if (parsed.getUTCFullYear() !== Number(year) || parsed.getUTCMonth() !== Number(month) - 1
        || parsed.getUTCDate() !== Number(day)) return date
    return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(parsed)
}
const motMileage = (test: ListingMotHistoryEntry): string | null => {
    if (!present(test.odometerValue)) return null
    const reading = Number(test.odometerValue)
    if (!Number.isFinite(reading) || reading < 0) return null
    const unit = String(test.odometerUnit || "").toUpperCase()
    const suffix = unit === "KM" ? "km" : unit === "MI" || unit === "MILES" ? "miles" : "units (unspecified)"
    return reading.toLocaleString("en-GB") + " " + suffix
}
function FactGroup({ title, icon, facts }: { title: string; icon: React.ReactNode; facts: Fact[] }) {
    const valid = facts.filter(f => present(f.value))
    if (!valid.length) return null
    return (
        <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-5">
            <h4 className="mb-4 flex items-center gap-2 border-b border-[var(--border-default)] pb-3 text-sm font-extrabold text-[var(--text-primary)]">
                <span className="text-primary">{icon}</span>{title}
            </h4>
            <dl className="grid gap-2.5">
                {valid.map(f => (
                    <div key={f.label} className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-sm">
                        <dt className="text-[var(--text-muted)]">{f.label}</dt>
                        <dd className="min-w-0 max-w-full break-words text-right font-semibold text-[var(--text-primary)]">{f.value}</dd>
                    </div>
                ))}
            </dl>
        </section>
    )
}

/** Both buyer routes render only fields saved with the listing; no public API calls or inferred values. */
export function BuyerVehicleInformation({ listing }: { listing: Listing }) {
    const [showAllMot, setShowAllMot] = React.useState(false)
    const official = listing.officialVehicleData
    const mot = (Array.isArray(listing.motHistory) ? listing.motHistory : [])
        .filter((item): item is ListingMotHistoryEntry =>
            Boolean(item && typeof item === "object" && typeof item.completedDate === "string"
                && (item.testResult === "PASSED" || item.testResult === "FAILED")))
        .sort((a, b) => b.completedDate.localeCompare(a.completedDate))
    const latestRecorded = mot.find(t => motMileage(t) !== null)
    const visible = showAllMot ? mot : mot.slice(0, 5)

    const vehicleFacts: Fact[] = [
        { label: "Make", value: listing.make },
        { label: "Model", value: listing.model },
        { label: "Variant / trim", value: listing.variant },
        { label: "Year", value: listing.year },
        { label: "Registration", value: listing.vrm },
        { label: "First registered", value: listing.monthOfFirstRegistration },
        { label: "First registered with DVLA", value: official?.dvla?.monthOfFirstDvlaRegistration },
        { label: "MOT vehicle registration date", value: ukDate(official?.mot?.registrationDate) },
        { label: "MOT manufacturing date", value: ukDate(official?.mot?.manufactureDate ?? official?.dvla?.manufactureDate) },
        { label: "Secondary colour (MOT)", value: official?.mot?.secondaryColour },
        { label: "Primary colour (MOT)", value: !listing.color ? official?.mot?.primaryColour : null },
        { label: "First used", value: ukDate(listing.firstUsedDate) },
        { label: "Body style", value: listing.bodyType ? humanize(listing.bodyType) : null },
        { label: "Exterior colour", value: listing.color },
        { label: "Advertised mileage (seller)", value: present(listing.mileage) ? Number(listing.mileage).toLocaleString("en-GB") + " miles" : null },
        { label: "Previous owners (seller)", value: listing.owners },
        { label: "Imported (seller)", value: listing.isImported === true ? "Yes" : null },
        { label: "Vehicle category", value: listing.vehicleType ? humanize(listing.vehicleType) : null },
        { label: "Collection area", value: listing.location },
    ]
    const technicalFacts: Fact[] = [
        { label: "Fuel type", value: listing.fuelType ? humanize(listing.fuelType) : official?.dvla?.rawFuelType },
        { label: "Transmission", value: listing.transmission ? humanize(listing.transmission) : null },
        { label: "Engine displacement", value: present(listing.engineSize) ? String(listing.engineSize) + " cc" : null },
        { label: "Power", value: present(listing.bhp) ? String(listing.bhp) + " bhp" : null },
        { label: "Drive", value: listing.driveType },
        { label: "Euro emission standard", value: listing.euroStandard ? humanize(listing.euroStandard) : official?.dvla?.rawEuroStatus },
        { label: "CO₂ emissions", value: present(listing.co2Emissions) ? String(listing.co2Emissions) + " g/km" : null },
        { label: "ULEZ (listing indication)", value: listing.ulezCompliant == null ? null : listing.ulezCompliant ? "Indicated compliant" : "Indicated non-compliant" },
        { label: "Combined economy", value: present(listing.combinedMpg) ? String(listing.combinedMpg) + " mpg" : null },
        { label: "Extra-urban economy", value: present(listing.extraUrbanMpg) ? String(listing.extraUrbanMpg) + " mpg" : null },
        { label: "Torque", value: present(listing.torqueNm) ? String(listing.torqueNm) + " Nm" : null },
        { label: "Top speed", value: present(listing.topSpeedMph) ? String(listing.topSpeedMph) + " mph" : null },
        { label: "0–60 mph", value: present(listing.zeroTo60Mph) ? String(listing.zeroTo60Mph) + " seconds" : null },
        { label: "Doors", value: listing.doors },
        { label: "Seats", value: listing.seats },
        { label: "Wheelplan", value: listing.wheelplan },
        { label: "Type approval", value: listing.typeApproval },
        { label: "Revenue weight", value: official?.dvla?.revenueWeight != null ? official.dvla.revenueWeight + " kg" : null },
        { label: "Real-driving emissions category", value: official?.dvla?.realDrivingEmissions },
        { label: "Automated vehicle (DVLA)", value: official?.dvla?.automatedVehicle == null ? null : official.dvla.automatedVehicle ? "Yes" : "No" },
    ]
    const conditionFacts: Fact[] = [
        { label: "Condition (seller)", value: listing.condition ? humanize(listing.condition) : null },
        { label: "Service history (seller)", value: listing.serviceHistory },
        { label: "Keys (seller)", value: listing.numberOfKeys },
        { label: "Write-off category (seller)", value: listing.writeOffCategory && listing.writeOffCategory !== "NONE" ? humanize(listing.writeOffCategory) : null },
        { label: "Mechanical issues (seller)", value: listing.mechanicalIssues },
        { label: "Electrical issues (seller)", value: listing.electricalIssues },
        { label: "Stolen or recovered (seller)", value: listing.stolenRecovered == null ? null : listing.stolenRecovered ? "Seller says Yes" : "Seller says No" },
        { label: "Outstanding finance (seller)", value: listing.hasOutstandingFinance == null ? null : listing.hasOutstandingFinance ? "Seller says Yes" : "Seller says No" },
        { label: "Registered keeper (seller)", value: listing.isLegalRegisteredKeeper == null ? null : listing.isLegalRegisteredKeeper ? "Seller says Yes" : "Seller says No" },
        // Owner decision (31 Oct 2026): when the seller is not the registered
        // keeper, buyers see the seller's own explanation of their relationship
        // to the vehicle owner, so they can make an informed decision.
        { label: "Seller's relationship to the owner (seller)", value: listing.isLegalRegisteredKeeper === false ? listing.notOwnerRelationship : null },
        { label: "Estate sale (seller)", value: listing.isDepartedSale === true ? "Yes" : null },
    ]
    const deliveryFacts: Fact[] = listing.deliveryAvailable === true ? [
        { label: "Delivery offered", value: "Yes, subject to seller terms" },
        { label: "Maximum delivery distance", value: listing.deliveryMaxMiles != null ? listing.deliveryMaxMiles + " miles" : "Ask seller about coverage" },
        { label: "Advertised delivery rate", value: listing.deliveryPricePerMile != null ? "£" + Number(listing.deliveryPricePerMile).toFixed(2) + " per mile" : null },
    ] : []
    const governmentFacts: Fact[] = [
        { label: "MOT status (saved)", value: listing.motStatus },
        { label: "MOT expiry (saved)", value: ukDate(listing.motExpiryDate) },
        { label: "Vehicle tax status (saved)", value: listing.taxStatus },
        { label: "Tax due date (saved)", value: ukDate(listing.taxDueDate) },
        { label: "Last V5C issue date", value: ukDate(listing.dateOfLastV5CIssued) },
        { label: "Additional vehicle tax rate end", value: ukDate(official?.dvla?.artEndDate) },
        { label: "Last MOT test date", value: ukDate(official?.mot?.lastMotTestDate) },
        { label: "First MOT due date", value: ukDate(official?.mot?.motTestDueDate) },
        { label: "Marked for export (saved)", value: listing.markedForExport == null ? null : listing.markedForExport ? "Yes" : "No" },
    ]

    return (
        <section className="space-y-5" aria-labelledby="buyer-vehicle-information-heading">
            <div className="rounded-2xl border border-blue-500/25 bg-gradient-to-r from-blue-500/10 via-[var(--bg-card)] to-emerald-500/5 p-4 sm:p-6">
                <h3 id="buyer-vehicle-information-heading" className="flex items-center gap-2 text-xl font-extrabold text-[var(--text-primary)]">
                    <ClipboardList className="text-blue-500" size={22} /> Full Vehicle Information
                </h3>
                <p className="mt-2 text-xs leading-5 text-[var(--text-muted)]">
                    Available information saved with this listing from vehicle registration checks and the seller.
                    Only known fields are shown. This is not a live DVLA/DVSA refresh or an independent vehicle history check.
                </p>
                {latestRecorded && (
                    <div className="mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3">
                        <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Latest recorded MOT odometer</p>
                        <p className="mt-1 text-lg font-black text-[var(--text-primary)]">{motMileage(latestRecorded)}</p>
                        <p className="text-xs text-[var(--text-muted)]">
                            Recorded {ukDate(latestRecorded.completedDate)} — historical MOT reading, not the vehicle&apos;s current mileage.
                        </p>
                    </div>
                )}
            </div>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <FactGroup title="Vehicle identity" icon={<ClipboardList size={18} />} facts={vehicleFacts} />
                <FactGroup title="Engine & technical specifications" icon={<Settings2 size={18} />} facts={technicalFacts} />
                <FactGroup title="Condition & seller details" icon={<Gauge size={18} />} facts={conditionFacts} />
                <FactGroup title="DVLA status snapshot" icon={<CalendarDays size={18} />} facts={governmentFacts} />
                <FactGroup title="Seller delivery options" icon={<ClipboardList size={18} />} facts={deliveryFacts} />
            </div>
            <section className="rounded-2xl border border-[var(--border-default)] bg-[var(--bg-card)] p-4 sm:p-6" aria-labelledby="buyer-mot-history-heading">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                        <h4 id="buyer-mot-history-heading" className="flex items-center gap-2 text-lg font-extrabold text-[var(--text-primary)]">
                            <History className="text-emerald-500" size={20} /> MOT test history
                        </h4>
                        <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">
                            Historical test results, odometer readings, failures and advisories saved with this listing.
                            Results may have changed since they were recorded.
                        </p>
                    </div>
                    {mot.length > 0 && <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                        {mot.length} saved test{mot.length === 1 ? "" : "s"}
                    </span>}
                </div>
                {!mot.length ? (
                    <div className="mt-4 flex items-start gap-2 rounded-xl bg-[var(--bg-input)] p-4 text-sm text-[var(--text-muted)]">
                        <Info size={16} className="mt-0.5 shrink-0" />
                        <p>No MOT test history was saved with this listing. This does not mean the vehicle has no MOT records.</p>
                    </div>
                ) : (
                    <div className="mt-4 space-y-3">
                        {visible.map((test, index) => {
                            const defects = Array.isArray(test.defects)
                                ? test.defects.filter(d => d && typeof d.text === "string" && d.text.trim())
                                : []
                            const passed = test.testResult === "PASSED"
                            return (
                                <details key={String(test.motTestNumber || test.completedDate) + "-" + index}
                                    className="group rounded-xl border border-[var(--border-default)] bg-[var(--bg-input)] p-3 sm:p-4">
                                    <summary className="cursor-pointer list-none">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <span className="flex flex-wrap items-center gap-2">
                                                {passed ? <CheckCircle2 size={17} className="text-emerald-500" /> : <AlertTriangle size={17} className="text-red-500" />}
                                                <span className={"text-sm font-extrabold " + (passed ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                                                    {passed ? "Passed" : "Failed"}
                                                </span>
                                                <span className="text-sm font-semibold text-[var(--text-primary)]">{ukDate(test.completedDate)}</span>
                                            </span>
                                            <span className="text-xs font-semibold text-[var(--text-muted)]">{motMileage(test) || "Mileage not supplied"} · View details <span aria-hidden="true" className="inline-block transition-transform group-open:rotate-180">⌄</span></span>
                                        </div>
                                        {defects.length > 0 && <p className="mt-2 text-xs font-medium text-amber-700 dark:text-amber-300">
                                            {defects.length} advisory/defect item{defects.length === 1 ? "" : "s"} recorded
                                        </p>}
                                    </summary>
                                    <div className="mt-3 space-y-2 border-t border-[var(--border-default)] pt-3">
                                        {test.expiryDate && <p className="text-xs text-[var(--text-muted)]">Expiry recorded for this test: {ukDate(test.expiryDate)}</p>}
                                        {test.odometerResultType && <p className="text-xs text-[var(--text-muted)]">Odometer reading status: {test.odometerResultType}</p>}
                                        {test.motTestNumber && <p className="break-all text-xs text-[var(--text-muted)]">MOT test reference: {test.motTestNumber}</p>}
                                        {defects.length ? (
                                            <ul className="space-y-2">
                                                {defects.map((defect, i) => (
                                                    <li key={i} className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 text-sm text-[var(--text-primary)]">
                                                        <span className={"mr-2 font-bold " + (defect.type === "DANGEROUS" || defect.type === "MAJOR" ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-300")}>
                                                            {humanize(String(defect.type || "Recorded"))}:
                                                        </span>
                                                        {defect.text}
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : <p className="text-xs text-[var(--text-muted)]">No defect or advisory details were supplied for this test.</p>}
                                    </div>
                                </details>
                            )
                        })}
                        {mot.length > 5 && (
                            <button type="button" onClick={() => setShowAllMot(v => !v)}
                                className="min-h-11 w-full rounded-xl border border-blue-500/30 bg-blue-500/5 px-4 py-2 text-sm font-bold text-blue-700 hover:bg-blue-500/10 dark:text-blue-300">
                                {showAllMot ? "Show recent 5 tests" : "Show all " + mot.length + " recorded MOT tests"}
                            </button>
                        )}
                    </div>
                )}
                <p className="mt-4 flex items-start gap-2 text-xs leading-5 text-[var(--text-muted)]">
                    <Info size={14} className="mt-0.5 shrink-0" />
                    Tax and MOT status may have changed. Check the official GOV.UK MOT service before buying.
                </p>
                <a href="https://www.gov.uk/check-mot-history" target="_blank" rel="noopener noreferrer"
                    className="mt-2 inline-flex min-h-10 items-center gap-2 text-xs font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-500 dark:text-blue-400">
                    Check current MOT history on GOV.UK
                </a>
            </section>
        </section>
    )
}
