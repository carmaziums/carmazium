/**
 * Page-level JSON-LD for public, indexable pages.
 * Keep IDs stable so page entities connect to the root OnlineBusiness/WebSite.
 */
export const SEO_SITE = "https://www.carmazium.com"
export const SEO_ORG = SEO_SITE + "/#organization"
export const SEO_WEBSITE = SEO_SITE + "/#website"
export const SEO_TRADEXCHANGE = SEO_SITE + "/#tradexchange"

export type SchemaNode = Record<string, unknown>
type Crumb = { label: string; path: string }

export function JsonLdScript({ graph }: { graph: SchemaNode[] }) {
    if (!graph.length) return null
    const data = { "@context": "https://schema.org", "@graph": graph }
    return <script type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, "\\u003c") }} />
}

export function PageJsonLd({
    path, title, description, type = "WebPage", crumbs, mainEntity, nodes, about,
}: {
    path: string
    title: string
    description?: string
    type?: string
    crumbs?: Crumb[]
    mainEntity?: SchemaNode
    nodes?: SchemaNode[]
    about?: string
}) {
    const url = SEO_SITE + (path === "/" ? "" : path)
    const trail = crumbs || (path === "/" ? [] : [
        { label: "Home", path: "/" }, { label: title, path },
    ])
    const crumbId = url + "#breadcrumb"
    const page: SchemaNode = {
        "@type": type, "@id": url + "#webpage", url, name: title,
        ...(description ? { description } : {}),
        isPartOf: { "@id": SEO_WEBSITE },
        about: { "@id": about || SEO_ORG },
        ...(trail.length ? { breadcrumb: { "@id": crumbId } } : {}),
        ...(mainEntity?.["@id"] ? { mainEntity: { "@id": mainEntity["@id"] } } : {}),
        inLanguage: "en-GB",
    }
    const breadcrumb: SchemaNode[] = trail.length ? [{
        "@type": "BreadcrumbList", "@id": crumbId,
        itemListElement: trail.map((item, i) => ({
            "@type": "ListItem", position: i + 1, name: item.label,
            item: SEO_SITE + (item.path === "/" ? "" : item.path),
        })),
    }] : []
    return <JsonLdScript graph={[page, ...breadcrumb, ...(mainEntity ? [mainEntity] : []), ...(nodes || [])]} />
}
