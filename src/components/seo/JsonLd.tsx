/**
 * JSON-LD structured data components for SEO.
 * Renders <script type="application/ld+json"> tags for search engines.
 */

// Canonical SEO origin. The apex domain permanently redirects to www.
const DEFAULT_SITE_URL = "https://www.carmazium.com"

function canonicaliseCarMaziumUrl(url: string): string {
    return url.replace(/^https:\/\/carmazium\.com(?=\/|$)/, DEFAULT_SITE_URL)
}

interface MarketplaceJsonLdProps {
    name?: string
    url?: string
}

/**
 * Site-wide Organization + WebSite JSON-LD for the CarMazium marketplace.
 * CarMazium is a marketplace, not the dealer or seller of every listed vehicle.
 */
export function MarketplaceJsonLd({
    name = "CarMazium",
    url = DEFAULT_SITE_URL,
}: MarketplaceJsonLdProps = {}) {
    const canonicalUrl = canonicaliseCarMaziumUrl(url).replace(/\/$/, "")
    const organizationId = `${canonicalUrl}/#organization`
    const websiteId = `${canonicalUrl}/#website`
    const logoUrl = `${canonicalUrl}/icon.png`

    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "OnlineBusiness",
                "@id": organizationId,
                name,
                legalName: "CARMAZIUM LTD",
                identifier: {
                    "@type": "PropertyValue",
                    propertyID: "UK Companies House company number",
                    value: "17053307",
                },
                sameAs: ["https://find-and-update.company-information.service.gov.uk/company/17053307"],
                url: canonicalUrl,
                logo: {
                    "@type": "ImageObject",
                    "@id": `${canonicalUrl}/#logo`,
                    url: logoUrl,
                    width: 192,
                    height: 192,
                },
                image: { "@id": `${canonicalUrl}/#logo` },
                email: "info@carmazium.com",
                telephone: "+441218385040",
                address: {
                    "@type": "PostalAddress",
                    streetAddress: "181-187 Hunters Road",
                    addressLocality: "Birmingham",
                    postalCode: "B19 1ES",
                    addressCountry: "GB",
                },
                contactPoint: [{
                    "@type": "ContactPoint",
                    contactType: "customer support",
                    telephone: "+441218385040",
                    email: "info@carmazium.com",
                    areaServed: "GB",
                    availableLanguage: ["en-GB"],
                    hoursAvailable: {
                        "@type": "OpeningHoursSpecification",
                        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
                        opens: "09:00", closes: "18:00",
                    },
                }],
                description:
                    "CarMazium is a UK online marketplace for selling vehicles via dealer auction or retail adverts; buyers pay sellers directly.",
                brand: { "@id": `${canonicalUrl}/#tradexchange` },
                areaServed: {
                    "@type": "Country",
                    name: "United Kingdom",
                },
            },
            {
                "@type": "Brand",
                "@id": `${canonicalUrl}/#tradexchange`,
                name: "TradeXchange",
                url: `${canonicalUrl}/auctions`,
                description: "CarMazium dealer auctions and approved-provider automotive services.",
            },
            {
                "@type": "WebSite",
                "@id": websiteId,
                url: canonicalUrl,
                name,
                alternateName: ["Car Mazium", "carmazium.com"],
                potentialAction: {
                    "@type": "SearchAction",
                    target: { "@type": "EntryPoint", urlTemplate: `${canonicalUrl}/search?search={search_term_string}` },
                    "query-input": "required name=search_term_string",
                },
                publisher: {
                    "@id": organizationId,
                },
                inLanguage: "en-GB",
            },
        ],
    }

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema).replace(/</g, "\\u003c") }}
        />
    )
}

interface VehicleJsonLdProps {
    name: string
    description: string
    image?: string
    url: string
    make: string
    model: string
    year: number
    mileage?: number
    fuelType?: string
    transmission?: string
    color?: string
    price: number
    currency?: string
    condition?: string
    vin?: string
    engineSize?: number
}

/**
 * Per-listing Vehicle JSON-LD for vehicle detail pages.
 */
export function VehicleJsonLd({
    name,
    description,
    image,
    url,
    make,
    model,
    year,
    mileage,
    fuelType,
    transmission,
    color,
    price,
    currency = "GBP",
    condition,
    vin,
    engineSize,
}: VehicleJsonLdProps) {
    const canonicalVehicleUrl = canonicaliseCarMaziumUrl(url)
    const schema: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Vehicle",
        name,
        description,
        url: canonicalVehicleUrl,
        manufacturer: { "@type": "Organization", name: make },
        ...(make?.trim() ? { brand: { "@type": "Brand", name: make.trim() } } : {}),
        model,
        vehicleModelDate: String(year),
        offers: {
            "@type": "Offer",
            price,
            priceCurrency: currency,
            availability: "https://schema.org/InStock",
        },
    }

    if (image) schema.image = image
    if (mileage) schema.mileageFromOdometer = { "@type": "QuantitativeValue", value: mileage, unitCode: "SMI" }
    if (fuelType) schema.fuelType = fuelType
    if (transmission) schema.vehicleTransmission = transmission
    if (color) schema.color = color
    if (condition) schema.itemCondition = condition === "NEW" ? "https://schema.org/NewCondition" : "https://schema.org/UsedCondition"
    if (vin) schema.vehicleIdentificationNumber = vin
    if (engineSize) schema.vehicleEngine = { "@type": "EngineSpecification", engineDisplacement: { "@type": "QuantitativeValue", value: engineSize, unitCode: "CMQ" } }

    return (
        <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    )
}
