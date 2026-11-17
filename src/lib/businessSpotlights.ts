/**
 * Public editorial partner directory. Add future partners here so each
 * business has an evergreen profile in the Business Spotlight directory.
 *
 * Only publish verified, authorised promotional copy and contact details.
 */
export type BusinessSpotlight = {
  slug: string
  name: string
  category: string
  strapline: string
  summary: string
  email: string
  priceNote?: string
  highlights: string[]
  featured: boolean
}

export const businessSpotlights: BusinessSpotlight[] = [
  {
    slug: "resolve-automotive",
    name: "Resolve Automotive",
    category: "After-sales support",
    strapline: "You sell the cars. We'll handle the complaints.",
    summary:
      "Resolve Automotive provides outsourced customer complaints-handling support specifically for the motor trade, helping participating dealers manage after-sales enquiries and disputes.",
    email: "contact@resolveautomotive.co.uk",
    priceNote: "Subscription packages advertised from £125 per month. Confirm current prices, VAT and terms directly with the provider.",
    highlights: [
      "End-to-end customer complaints handling for participating motor dealers",
      "Dedicated case portal and customer communication",
      "Case history and progress updates",
      "Specialist support focused on fair complaint outcomes",
    ],
    featured: true,
  },
  {
    slug: "simpledms",
    name: "SimpleDMS",
    category: "Dealer management software",
    strapline: "Your dealership in your pocket.",
    summary:
      "SimpleDMS is a mobile-first dealer management platform for UK independent used-car dealers, bringing stock, leads, customer records, deals and invoicing into one workspace.",
    email: "info@simpledms.co.uk",
    highlights: [
      "Vehicle stock, leads and customer records",
      "Sales deals and invoicing workflows",
      "Connected dealer website options",
      "Mobile-friendly dealership management",
    ],
    featured: true,
  },
]

export function featuredBusinessSpotlight(): BusinessSpotlight | undefined {
  return businessSpotlights.find((business) => business.featured)
}
