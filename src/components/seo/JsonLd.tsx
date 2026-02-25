/**
 * JSON-LD structured data components for SEO.
 * Renders <script type="application/ld+json"> tags for Google rich results.
 */

interface AutoDealerJsonLdProps {
    name?: string
    url?: string
    city?: string
}

/**
 * Site-wide AutoDealer JSON-LD — add to root layout.
 */
export function AutoDealerJsonLd({
    name = "CarMazium",
    url = "https://carmazium.co.uk",
    city = "London",
}: AutoDealerJsonLdProps = {}) {
    const schema = {
        "@context": "https://schema.org",
        "@type": "AutoDealer",
        name,
        url,
        description:
            "London's trusted car marketplace. Browse verified vehicles, sell for free, transparent pricing.",
        address: {
            "@type": "PostalAddress",
            addressLocality: city,
            addressCountry: "GB",
        },
        areaServed: {
            "@type": "City",
            name: city,
        },
        priceRange: "££",
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
 * Per-listing Vehicle JSON-LD — add to vehicle detail pages.
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
            seller: {
                "@type": "AutoDealer",
                name: "CarMazium",
                url: "https://carmazium.co.uk",
            },
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
