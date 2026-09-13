/**
 * JSON-LD structured data components for SEO.
 * Renders <script type="application/ld+json"> tags for search engines.
 */

// Canonical SEO origin. The apex domain permanently redirects to www.
const DEFAULT_SITE_URL = "https://www.carmazium.com"

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
    const canonicalUrl = url.replace(/\/$/, "")
    const organizationId = `${canonicalUrl}/#organization`
    const websiteId = `${canonicalUrl}/#website`

    const schema = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "Organization",
                "@id": organizationId,
                name,
                url: canonicalUrl,
                description:
                    "CarMazium is a UK online car marketplace for buying, selling and auctioning vehicles.",
                areaServed: {
                    "@type": "Country",
                    name: "United Kingdom",
                },
            },
            {
                "@type": "WebSite",
                "@id": websiteId,
                url: canonicalUrl,
                name,
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
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
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
    const schema: Record<string, unknown> = {
        "@context": "https://schema.org",
        "@type": "Vehicle",
        name,
        description,
        url,
        manufacturer: { "@type": "Organization", name: make },
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
