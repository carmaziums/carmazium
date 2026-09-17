export type BlogValidationSeverity = "error" | "warning"

export type BlogValidationField =
    | "title"
    | "slug"
    | "excerpt"
    | "content"
    | "coverImage"
    | "tags"
    | "metaTitle"
    | "metaDescription"
    | "noIndex"
    | "general"

export interface BlogValidationIssue {
    code: string
    severity: BlogValidationSeverity
    field: BlogValidationField
    message: string
}

export interface BlogValidationInput {
    title: string
    slug?: string
    excerpt: string
    content: string
    coverImage?: string | null
    tags?: string[]
    status?: "DRAFT" | "PUBLISHED"
    metaTitle?: string | null
    metaDescription?: string | null
    noIndex?: boolean
}

export interface SanitizedBlogInput extends BlogValidationInput {
    slug: string
    tags: string[]
    metaTitle?: string
    metaDescription?: string
}

export interface BlogValidationResult {
    errors: BlogValidationIssue[]
    warnings: BlogValidationIssue[]
    all: BlogValidationIssue[]
    canPublish: boolean
    metrics: {
        wordCount: number
        readingMinutes: number
        h1Count: number
        h2Count: number
        h3Count: number
        internalLinkCount: number
        imageCount: number
        imagesMissingAlt: number
        renderedMetaTitle: string
        renderedMetaTitleLength: number
        metaDescriptionLength: number
    }
}

const BRAND = "CarMazium"
const BRAND_SUFFIX = ` | ${BRAND}`
const SITE_HOSTS = new Set(["carmazium.com", "www.carmazium.com"])
const TRACKING_QUERY_PREFIX = "utm_"
const TRACKING_QUERY_KEYS = new Set(["gclid", "fbclid", "msclkid"])

const EDITORIAL_ARTIFACT_PATTERNS: Array<{ code: string; pattern: RegExp; label: string }> = [
    { code: "editorial-photo-idea", pattern: /^\s*(?:#+\s*)?photo\s+idea\b/im, label: "PHOTO IDEA" },
    { code: "editorial-image-instruction", pattern: /^\s*(?:#+\s*)?(?:insert|add|place)\s+(?:an?\s+)?(?:image|photo|graphic|infographic)\b/im, label: "image-placement instruction" },
    { code: "editorial-visual-instruction", pattern: /^\s*(?:#+\s*)?create\s+(?:an?\s+)?(?:visual|graphic|infographic)\b/im, label: "visual-design instruction" },
    { code: "editorial-note", pattern: /^\s*(?:#+\s*)?(?:editor|design|designer)\s+note\s*:/im, label: "editor/design note" },
    { code: "editorial-seo-keywords", pattern: /^\s*(?:seo\s+)?keywords?\s*:/im, label: "raw SEO keyword list" },
]

function normalizeComparableText(value: string): string {
    return value
        .replace(/^#+\s*/, "")
        .replace(/[*_`~]/g, "")
        .replace(/\s+/g, " ")
        .trim()
        .toLocaleLowerCase("en-GB")
}

export function slugifyBlogTitle(value: string): string {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^\w\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
}

export function stripCarMaziumBrandSuffix(value: string): string {
    let next = value.trim()
    const suffixPattern = /\s*\|\s*carmazium\s*$/i
    while (suffixPattern.test(next)) next = next.replace(suffixPattern, "").trim()
    return next
}

export function stripTrackingParametersFromUrl(value: string): string {
    try {
        const url = new URL(value)
        const keys = Array.from(url.searchParams.keys())
        for (const key of keys) {
            const lowerKey = key.toLowerCase()
            if (lowerKey.startsWith(TRACKING_QUERY_PREFIX) || TRACKING_QUERY_KEYS.has(lowerKey)) {
                url.searchParams.delete(key)
            }
        }
        return url.toString()
    } catch {
        return value
    }
}

export function stripTrackingParametersFromContent(content: string): string {
    return content.replace(/https?:\/\/[^\s<>"')\]]+/gi, (rawUrl) => stripTrackingParametersFromUrl(rawUrl))
}

export function sanitizeBlogInput(input: BlogValidationInput): SanitizedBlogInput {
    const title = input.title.trim()
    const cleanedMetaTitle = stripCarMaziumBrandSuffix(input.metaTitle?.trim() || "")
    const cleanedMetaDescription = input.metaDescription?.trim() || ""
    const slug = slugifyBlogTitle(input.slug?.trim() || title)
    const tags = Array.from(new Set((input.tags || []).map((tag) => tag.trim()).filter(Boolean)))

    return {
        ...input,
        title,
        slug,
        excerpt: input.excerpt.trim(),
        content: stripTrackingParametersFromContent(input.content.replace(/\r\n/g, "\n")).trim(),
        coverImage: input.coverImage?.trim() || undefined,
        tags,
        metaTitle: cleanedMetaTitle || undefined,
        metaDescription: cleanedMetaDescription || undefined,
    }
}

function plainMarkdown(content: string): string {
    return content
        .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
        .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
        .replace(/<[^>]*>/g, " ")
        .replace(/[#>*_`~|-]/g, " ")
}

function countWords(content: string): number {
    const text = plainMarkdown(content).trim()
    return text ? text.split(/\s+/).filter(Boolean).length : 0
}

function firstMeaningfulContentLine(content: string): string {
    return content
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line && !/^<!--/.test(line)) || ""
}

function countInternalLinks(content: string): number {
    const markdownUrls = Array.from(content.matchAll(/\[[^\]]*\]\((https?:\/\/[^)]+|\/[^)]+)\)/gi)).map((match) => match[1])
    return markdownUrls.filter((href) => {
        if (href.startsWith("/")) return true
        try {
            return SITE_HOSTS.has(new URL(href).hostname.toLowerCase())
        } catch {
            return false
        }
    }).length
}

function inspectImages(content: string): { count: number; missingAlt: number } {
    const images = Array.from(content.matchAll(/!\[([^\]]*)\]\(([^)]+)\)/g))
    return {
        count: images.length,
        missingAlt: images.filter((match) => !match[1].trim() || /^(?:image|photo|picture|article image)$/i.test(match[1].trim())).length,
    }
}

function repeatedParagraphCount(content: string): number {
    const paragraphs = content
        .split(/\n\s*\n/)
        .map((paragraph) => normalizeComparableText(paragraph))
        .filter((paragraph) => paragraph.length >= 80 && !paragraph.startsWith("##"))
    return paragraphs.length - new Set(paragraphs).size
}

function addIssue(issues: BlogValidationIssue[], issue: BlogValidationIssue): void {
    if (!issues.some((existing) => existing.code === issue.code && existing.field === issue.field)) {
        issues.push(issue)
    }
}

export function validateBlogPost(input: BlogValidationInput): BlogValidationResult {
    const sanitized = sanitizeBlogInput(input)
    const issues: BlogValidationIssue[] = []
    const isPublishing = sanitized.status === "PUBLISHED"

    const requireForPublish = (value: string | undefined | null, field: BlogValidationField, label: string) => {
        if (isPublishing && !value?.trim()) {
            addIssue(issues, {
                code: `required-${field}`,
                severity: "error",
                field,
                message: `${label} is required before publishing.`,
            })
        }
    }

    requireForPublish(sanitized.title, "title", "Title")
    requireForPublish(sanitized.excerpt, "excerpt", "Excerpt")
    requireForPublish(sanitized.content, "content", "Article content")
    requireForPublish(sanitized.coverImage, "coverImage", "Cover image")

    if (sanitized.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(sanitized.slug)) {
        addIssue(issues, {
            code: "slug-format",
            severity: "error",
            field: "slug",
            message: "The URL slug must contain only lowercase letters, numbers and single hyphens.",
        })
    }

    const firstLine = firstMeaningfulContentLine(sanitized.content)
    if (sanitized.title && firstLine && normalizeComparableText(firstLine) === normalizeComparableText(sanitized.title)) {
        addIssue(issues, {
            code: "duplicate-body-title",
            severity: "error",
            field: "content",
            message: "Remove the article title from the start of the body. The page already renders the title as its H1.",
        })
    }

    const h1Matches = sanitized.content.match(/^#\s+.+$/gm) || []
    if (h1Matches.length > 0) {
        addIssue(issues, {
            code: "body-h1",
            severity: "error",
            field: "content",
            message: "Do not add H1 headings inside the article body. Use ## for sections and ### for subsections.",
        })
    }

    if (/\[object Object\]/i.test(sanitized.content)) {
        addIssue(issues, {
            code: "object-object-leak",
            severity: "error",
            field: "content",
            message: "The article contains [object Object], which indicates broken rendered content.",
        })
    }

    for (const artifact of EDITORIAL_ARTIFACT_PATTERNS) {
        if (artifact.pattern.test(sanitized.content)) {
            addIssue(issues, {
                code: artifact.code,
                severity: "error",
                field: "content",
                message: `Remove the ${artifact.label} before publishing.`,
            })
        }
    }

    const originalMetaTitle = input.metaTitle?.trim() || ""
    if (/\|\s*carmazium\s*$/i.test(originalMetaTitle)) {
        addIssue(issues, {
            code: "meta-title-brand-suffix",
            severity: "warning",
            field: "metaTitle",
            message: "CarMazium is added to browser titles automatically. It will be removed from the stored SEO title.",
        })
    }

    if (/\b(?:utm_[a-z0-9_]+|gclid|fbclid|msclkid)=/i.test(input.content)) {
        addIssue(issues, {
            code: "tracking-parameters",
            severity: "warning",
            field: "content",
            message: "Tracking parameters were found in article links and will be removed automatically.",
        })
    }

    const effectiveMetaTitle = sanitized.metaTitle || sanitized.title || ""
    const renderedMetaTitle = effectiveMetaTitle ? `${effectiveMetaTitle}${BRAND_SUFFIX}` : BRAND
    if (effectiveMetaTitle && renderedMetaTitle.length > 65) {
        addIssue(issues, {
            code: "meta-title-too-long",
            severity: "warning",
            field: "metaTitle",
            message: `The final browser title is ${renderedMetaTitle.length} characters. Aim for 65 or fewer including “${BRAND_SUFFIX}”.`,
        })
    } else if (effectiveMetaTitle && renderedMetaTitle.length < 30) {
        addIssue(issues, {
            code: "meta-title-too-short",
            severity: "warning",
            field: "metaTitle",
            message: `The final browser title is ${renderedMetaTitle.length} characters. Consider making it more descriptive.`,
        })
    }

    const effectiveMetaDescription = sanitized.metaDescription || sanitized.excerpt || ""
    if (effectiveMetaDescription && (effectiveMetaDescription.length < 120 || effectiveMetaDescription.length > 160)) {
        addIssue(issues, {
            code: "meta-description-length",
            severity: "warning",
            field: "metaDescription",
            message: `The meta description is ${effectiveMetaDescription.length} characters. Aim roughly for 120–160.`,
        })
    }

    const wordCount = countWords(sanitized.content)
    if (sanitized.content && wordCount < 600) {
        addIssue(issues, {
            code: "thin-content",
            severity: "warning",
            field: "content",
            message: `The article is ${wordCount} words. Consider adding more useful depth if the topic warrants it.`,
        })
    }

    const h2Count = (sanitized.content.match(/^##\s+.+$/gm) || []).length
    const h3Count = (sanitized.content.match(/^###\s+.+$/gm) || []).length
    if (sanitized.content && h2Count === 0) {
        addIssue(issues, {
            code: "missing-h2",
            severity: "warning",
            field: "content",
            message: "Add H2 section headings (##) so readers and search engines can understand the article structure.",
        })
    }

    const firstH2Index = sanitized.content.search(/^##\s+.+$/m)
    const firstH3Index = sanitized.content.search(/^###\s+.+$/m)
    if (firstH3Index >= 0 && (firstH2Index < 0 || firstH3Index < firstH2Index)) {
        addIssue(issues, {
            code: "heading-hierarchy",
            severity: "warning",
            field: "content",
            message: "An H3 appears before any H2. Use H2 for main sections and H3 only beneath an H2.",
        })
    }

    const internalLinkCount = countInternalLinks(sanitized.content)
    if (sanitized.content && internalLinkCount === 0) {
        addIssue(issues, {
            code: "missing-internal-link",
            severity: "warning",
            field: "content",
            message: "Consider adding at least one relevant internal CarMazium link.",
        })
    }

    const imageStats = inspectImages(sanitized.content)
    if (imageStats.missingAlt > 0) {
        addIssue(issues, {
            code: "image-alt-text",
            severity: "warning",
            field: "content",
            message: `${imageStats.missingAlt} inline image${imageStats.missingAlt === 1 ? " has" : "s have"} missing or generic alt text.`,
        })
    }

    const repeatedParagraphs = repeatedParagraphCount(sanitized.content)
    if (repeatedParagraphs > 0) {
        addIssue(issues, {
            code: "duplicate-paragraphs",
            severity: "warning",
            field: "content",
            message: `${repeatedParagraphs} repeated long paragraph${repeatedParagraphs === 1 ? " was" : "s were"} detected. Check for duplicated copy.`,
        })
    }

    if (isPublishing && sanitized.noIndex) {
        addIssue(issues, {
            code: "published-noindex",
            severity: "warning",
            field: "noIndex",
            message: "This published article is set to noindex, so search engines are being asked not to index it.",
        })
    }

    if ((sanitized.tags || []).length < 2) {
        addIssue(issues, {
            code: "few-topics",
            severity: "warning",
            field: "tags",
            message: "Add 2–5 specific topics so the article is easier to organise and relate to similar content.",
        })
    }

    const errors = issues.filter((issue) => issue.severity === "error")
    const warnings = issues.filter((issue) => issue.severity === "warning")

    return {
        errors,
        warnings,
        all: issues,
        canPublish: errors.length === 0,
        metrics: {
            wordCount,
            readingMinutes: Math.max(1, Math.ceil(wordCount / 220)),
            h1Count: h1Matches.length,
            h2Count,
            h3Count,
            internalLinkCount,
            imageCount: imageStats.count,
            imagesMissingAlt: imageStats.missingAlt,
            renderedMetaTitle,
            renderedMetaTitleLength: renderedMetaTitle.length,
            metaDescriptionLength: effectiveMetaDescription.length,
        },
    }
}
