export interface BlogHeadingInsight {
    level: 2 | 3
    text: string
}

export interface BlogContentInsights {
    headings: BlogHeadingInsight[]
    h2Count: number
    h3Count: number
    internalLinkCount: number
    externalLinkCount: number
    authoritySourceLinkCount: number
    imageCount: number
    imagesMissingAlt: number
    emptyLinkCount: number
    unsafeLinkCount: number
    hasSourceSection: boolean
    unlinkedAuthorityMentions: string[]
}

const SITE_HOSTS = new Set(["carmazium.com", "www.carmazium.com"])

const AUTHORITY_SOURCES = [
    {
        label: "GOV.UK / DVLA",
        mention: /\b(?:gov\.uk|dvla|driver and vehicle licensing agency)\b/i,
        domains: ["gov.uk"],
    },
    {
        label: "SMMT",
        mention: /\b(?:smmt|society of motor manufacturers and traders)\b/i,
        domains: ["smmt.co.uk"],
    },
    {
        label: "MoneyHelper",
        mention: /\bmoneyhelper\b/i,
        domains: ["moneyhelper.org.uk"],
    },
    {
        label: "Citizens Advice",
        mention: /\bcitizens advice\b/i,
        domains: ["citizensadvice.org.uk"],
    },
    {
        label: "RAC",
        mention: /\bRAC\b/,
        domains: ["rac.co.uk"],
    },
    {
        label: "Auto Trader",
        mention: /\bauto trader\b/i,
        domains: ["autotrader.co.uk"],
    },
]

function isSiteHost(hostname: string): boolean {
    return SITE_HOSTS.has(hostname.toLowerCase())
}

function getMarkdownLinks(content: string): Array<{ label: string; href: string }> {
    return Array.from(content.matchAll(/(?<!!)\[([^\]]+)\]\(([^)]*)\)/g)).map((match) => ({
        label: match[1].trim(),
        href: match[2].trim().replace(/\s+["'][^"']*["']\s*$/, ""),
    }))
}

function getMarkdownImages(content: string): Array<{ alt: string; src: string }> {
    return Array.from(content.matchAll(/!\[([^\]]*)\]\(([^)]*)\)/g)).map((match) => ({
        alt: match[1].trim(),
        src: match[2].trim(),
    }))
}

function hostnameMatches(hostname: string, expected: string): boolean {
    const normalized = hostname.toLowerCase()
    const target = expected.toLowerCase()
    return normalized === target || normalized.endsWith(`.${target}`)
}

export function extractBlogContentInsights(content: string): BlogContentInsights {
    const headings = Array.from(content.matchAll(/^(##|###)\s+(.+)$/gm)).map((match) => ({
        level: match[1] === "##" ? 2 as const : 3 as const,
        text: match[2].trim(),
    }))

    const links = getMarkdownLinks(content)
    let internalLinkCount = 0
    let externalLinkCount = 0
    let authoritySourceLinkCount = 0
    let emptyLinkCount = 0
    let unsafeLinkCount = 0

    const linkedHostnames: string[] = []

    for (const link of links) {
        const href = link.href.trim()
        if (!href) {
            emptyLinkCount += 1
            continue
        }

        if (/^(?:javascript|data|vbscript):/i.test(href)) {
            unsafeLinkCount += 1
            continue
        }

        if (href.startsWith("/")) {
            internalLinkCount += 1
            continue
        }

        if (/^https?:\/\//i.test(href)) {
            try {
                const hostname = new URL(href).hostname.toLowerCase()
                linkedHostnames.push(hostname)
                if (isSiteHost(hostname)) internalLinkCount += 1
                else externalLinkCount += 1
            } catch {
                // The publish validator handles definite malformed content separately.
            }
        }
    }

    for (const source of AUTHORITY_SOURCES) {
        if (linkedHostnames.some((hostname) => source.domains.some((domain) => hostnameMatches(hostname, domain)))) {
            authoritySourceLinkCount += 1
        }
    }

    const unlinkedAuthorityMentions = AUTHORITY_SOURCES
        .filter((source) => source.mention.test(content))
        .filter((source) => !linkedHostnames.some((hostname) => source.domains.some((domain) => hostnameMatches(hostname, domain))))
        .map((source) => source.label)

    const images = getMarkdownImages(content)
    const imagesMissingAlt = images.filter((image) => !image.alt || /^(?:image|photo|picture|article image)$/i.test(image.alt)).length

    return {
        headings,
        h2Count: headings.filter((heading) => heading.level === 2).length,
        h3Count: headings.filter((heading) => heading.level === 3).length,
        internalLinkCount,
        externalLinkCount,
        authoritySourceLinkCount,
        imageCount: images.length,
        imagesMissingAlt,
        emptyLinkCount,
        unsafeLinkCount,
        hasSourceSection: /^#{2,3}\s+(?:sources?|references?|sources?\s*&\s*further\s+reading|further\s+reading)\s*$/im.test(content),
        unlinkedAuthorityMentions,
    }
}
