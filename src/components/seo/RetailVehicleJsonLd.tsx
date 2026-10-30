import type { Listing } from "@/lib/listingApi"

const SITE = "https://www.carmazium.com"
export const indexableRetail = (l: Listing) =>
    l.type === "CLASSIFIED" && l.status === "ACTIVE" &&
    !/(^|-)(undefined|test\d*|aaa|qqq|www)(-|$)/i.test(l.slug || "")

export function retailDescription(l: Listing): string {
    const specs = [
        l.year, l.make, l.model, l.bodyType, l.fuelType, l.transmission,
        typeof l.mileage === "number" ? l.mileage.toLocaleString("en-GB") + " miles" : null,
    ].filter(Boolean).join(" · ")
    const amount = Number(l.price)
    return (specs + (Number.isFinite(amount) && amount > 0 ? " — £" + amount.toLocaleString("en-GB") : "") +
        (l.location ? " in " + l.location : "") + ". Used vehicle listing on CarMazium.").slice(0, 160)
}

export function RetailVehicleJsonLd({ listing: l }: { listing: Listing }) {
    const price = Number(l.price)
    if (!indexableRetail(l) || !Number.isFinite(price) || price <= 0) return null

    const url = SITE + "/buy-cars/" + encodeURIComponent(l.slug)
    const photos = [...new Set((l.images || []).filter(Boolean).filter(s => !s.includes("example.com")).flatMap(s => {
        try {
            const u = new URL(s, SITE)
            if (u.protocol !== "https:" || u.username || u.password) return []
            u.hash = ""
            return [u.toString()]
        } catch { return [] }
    }))]
    const notes = [l.mechanicalIssues, l.electricalIssues]
        .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    const dealerName = l.seller?.dealerProfile?.companyName?.trim()
    const engine = Number(l.engineSize)
    const drive: Record<string, string> = {
        FWD: "FrontWheelDriveConfiguration", RWD: "RearWheelDriveConfiguration",
        AWD: "AllWheelDriveConfiguration", "4WD": "FourWheelDriveConfiguration",
        "4X4": "FourWheelDriveConfiguration",
    }
    const driveKey = (l.driveType || "").trim().toUpperCase()
    const details = [
        ...(l.motExpiryDate ? [{ "@type": "PropertyValue", name: "MOT expiry", value: l.motExpiryDate }] : []),
        ...(l.serviceHistory ? [{ "@type": "PropertyValue", name: "Service history", value: l.serviceHistory }] : []),
        ...(l.writeOffCategory && l.writeOffCategory !== "NONE"
            ? [{ "@type": "PropertyValue", name: "Insurance write-off category", value: l.writeOffCategory }] : []),
    ]

    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "ItemPage", "@id": url + "#webpage", url, name: l.title,
                description: retailDescription(l), inLanguage: "en-GB",
                isPartOf: { "@id": SITE + "/#website" },
                breadcrumb: { "@id": url + "#breadcrumb" },
                mainEntity: { "@id": url + "#vehicle" },
            },
            {
                "@type": "BreadcrumbList", "@id": url + "#breadcrumb",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Home", item: SITE },
                    { "@type": "ListItem", position: 2, name: "Buy Cars", item: SITE + "/search" },
                    { "@type": "ListItem", position: 3, name: l.title, item: url },
                ],
            },
            {
                "@type": l.vehicleType === "MOTORCYCLE" || l.vehicleType === "HGV"
                    ? ["Vehicle", "Product"] : ["Car", "Product"],
                "@id": url + "#vehicle", name: l.title, url,
                description: retailDescription(l), sku: l.slug,
                ...(photos.length ? { image: photos } : {}),
                ...(l.make ? { brand: { "@type": "Brand", name: l.make }, manufacturer: { "@type": "Organization", name: l.make } } : {}),
                ...(l.model ? { model: l.model } : {}),
                ...(l.variant ? { vehicleConfiguration: l.variant } : {}),
                ...(l.year ? { vehicleModelDate: String(l.year) } : {}),
                ...(l.bodyType ? { bodyType: l.bodyType } : {}),
                ...(l.mileage != null ? { mileageFromOdometer: { "@type": "QuantitativeValue", value: l.mileage, unitCode: "SMI" } } : {}),
                ...(l.fuelType ? { fuelType: l.fuelType } : {}),
                ...(l.transmission ? { vehicleTransmission: l.transmission } : {}),
                ...(l.color ? { color: l.color } : {}),
                ...(l.doors != null ? { numberOfDoors: l.doors } : {}),
                ...(l.seats != null ? { seatingCapacity: l.seats } : {}),
                ...(drive[driveKey] ? { driveWheelConfiguration: "https://schema.org/" + drive[driveKey] } : {}),
                ...(l.monthOfFirstRegistration && /^\d{4}-\d{2}$/.test(l.monthOfFirstRegistration)
                    ? { dateVehicleFirstRegistered: l.monthOfFirstRegistration } : {}),
                ...(engine > 0 && Number.isFinite(engine) ? { vehicleEngine: { "@type": "EngineSpecification",
                    engineDisplacement: { "@type": "QuantitativeValue", value: engine, unitCode: engine <= 10 ? "LTR" : "CMQ" } } } : {}),
                ...(notes.length ? { knownVehicleDamages: notes.join("; ") } : {}),
                itemCondition: "https://schema.org/UsedCondition",
                ...(details.length ? { additionalProperty: details } : {}),
                offers: {
                    "@type": "Offer", "@id": url + "#offer", url,
                    price: price.toFixed(2), priceCurrency: "GBP",
                    availability: "https://schema.org/InStock",
                    itemCondition: "https://schema.org/UsedCondition",
                    businessFunction: "http://purl.org/goodrelations/v1#Sell",
                    areaServed: { "@type": "Country", name: "United Kingdom" },
                    ...(l.location ? { availableAtOrFrom: {
                        "@type": "Place", address: { "@type": "PostalAddress",
                            addressLocality: l.location, addressCountry: "GB" } } } : {}),
                    ...(dealerName ? { seller: { "@type": "AutoDealer", name: dealerName } } : {}),
                },
                isRelatedTo: { "@id": SITE + "/#organization" },
            },
        ],
    }
    return <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }} />
}
