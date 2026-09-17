import { BadRequestException } from '@nestjs/common';

export interface BlogPublicationCandidate {
    title?: string | null;
    slug?: string | null;
    excerpt?: string | null;
    content?: string | null;
    coverImage?: string | null;
    authorName?: string | null;
    tags?: string[] | null;
    status?: 'DRAFT' | 'PUBLISHED' | null;
    metaTitle?: string | null;
    metaDescription?: string | null;
    noIndex?: boolean | null;
}

export interface BlogPublicationIssue {
    code: string;
    field: 'title' | 'slug' | 'excerpt' | 'content' | 'coverImage' | 'metaTitle' | 'general';
    message: string;
}

const TRACKING_QUERY_PREFIX = 'utm_';
const TRACKING_QUERY_KEYS = new Set(['gclid', 'fbclid', 'msclkid']);

const EDITORIAL_ARTIFACT_PATTERNS: Array<{ code: string; pattern: RegExp; label: string }> = [
    { code: 'editorial-photo-idea', pattern: /^\s*(?:#+\s*)?photo\s+idea\b/im, label: 'PHOTO IDEA' },
    { code: 'editorial-image-instruction', pattern: /^\s*(?:#+\s*)?(?:insert|add|place)\s+(?:an?\s+)?(?:image|photo|graphic|infographic)\b/im, label: 'image-placement instruction' },
    { code: 'editorial-visual-instruction', pattern: /^\s*(?:#+\s*)?create\s+(?:an?\s+)?(?:visual|graphic|infographic)\b/im, label: 'visual-design instruction' },
    { code: 'editorial-note', pattern: /^\s*(?:#+\s*)?(?:editor|design|designer)\s+note\s*:/im, label: 'editor/design note' },
    { code: 'editorial-seo-keywords', pattern: /^\s*(?:seo\s+)?keywords?\s*:/im, label: 'raw SEO keyword list' },
];

function normalizeComparableText(value: string): string {
    return value
        .replace(/^#+\s*/, '')
        .replace(/[*_`~]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLocaleLowerCase('en-GB');
}

function firstMeaningfulContentLine(content: string): string {
    return content
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line && !/^<!--/.test(line)) || '';
}

function stripCarMaziumBrandSuffix(value: string): string {
    let next = value.trim();
    const suffixPattern = /\s*\|\s*carmazium\s*$/i;
    while (suffixPattern.test(next)) next = next.replace(suffixPattern, '').trim();
    return next;
}

function stripTrackingParametersFromUrl(value: string): string {
    try {
        const url = new URL(value);
        for (const key of Array.from(url.searchParams.keys())) {
            const lowerKey = key.toLowerCase();
            if (lowerKey.startsWith(TRACKING_QUERY_PREFIX) || TRACKING_QUERY_KEYS.has(lowerKey)) {
                url.searchParams.delete(key);
            }
        }
        return url.toString();
    } catch {
        return value;
    }
}

function stripTrackingParametersFromContent(content: string): string {
    return content.replace(/https?:\/\/[^\s<>"')\]]+/gi, (rawUrl) => stripTrackingParametersFromUrl(rawUrl));
}

function cleanTags(tags: string[] | null | undefined): string[] | undefined {
    if (!tags) return undefined;

    const seen = new Set<string>();
    const cleaned: string[] = [];
    for (const rawTag of tags) {
        const tag = rawTag.trim();
        if (!tag) continue;
        const key = tag.toLocaleLowerCase('en-GB');
        if (seen.has(key)) continue;
        seen.add(key);
        cleaned.push(tag);
    }
    return cleaned;
}

/**
 * Applies only deterministic, content-preserving cleanup. It deliberately does
 * not rewrite slugs: URL changes are handled explicitly by BlogService.
 */
export function sanitizeBlogWrite<T extends BlogPublicationCandidate>(input: T): T {
    const next: BlogPublicationCandidate = { ...input };

    if (typeof input.title === 'string') next.title = input.title.trim();
    if (typeof input.slug === 'string') next.slug = input.slug.trim();
    if (typeof input.excerpt === 'string') next.excerpt = input.excerpt.trim();
    if (typeof input.content === 'string') {
        next.content = stripTrackingParametersFromContent(input.content.replace(/\r\n/g, '\n')).trim();
    }
    if (typeof input.coverImage === 'string') next.coverImage = input.coverImage.trim();
    if (typeof input.authorName === 'string') next.authorName = input.authorName.trim();
    if (input.tags) next.tags = cleanTags(input.tags);
    if (typeof input.metaTitle === 'string') next.metaTitle = stripCarMaziumBrandSuffix(input.metaTitle);
    if (typeof input.metaDescription === 'string') next.metaDescription = input.metaDescription.trim();

    return next as T;
}

export function validateBlogPublication(candidate: BlogPublicationCandidate): BlogPublicationIssue[] {
    if (candidate.status !== 'PUBLISHED') return [];

    const issues: BlogPublicationIssue[] = [];
    const title = candidate.title?.trim() || '';
    const excerpt = candidate.excerpt?.trim() || '';
    const content = candidate.content?.trim() || '';
    const coverImage = candidate.coverImage?.trim() || '';

    if (!title) issues.push({ code: 'required-title', field: 'title', message: 'Title is required before publishing.' });
    if (!excerpt) issues.push({ code: 'required-excerpt', field: 'excerpt', message: 'Excerpt is required before publishing.' });
    if (!content) issues.push({ code: 'required-content', field: 'content', message: 'Article content is required before publishing.' });
    if (!coverImage) issues.push({ code: 'required-coverImage', field: 'coverImage', message: 'Cover image is required before publishing.' });

    if (title && content) {
        const firstLine = firstMeaningfulContentLine(content);
        if (firstLine && normalizeComparableText(firstLine) === normalizeComparableText(title)) {
            issues.push({
                code: 'duplicate-body-title',
                field: 'content',
                message: 'Remove the article title from the start of the body. The page already renders the title as its H1.',
            });
        }
    }

    if (/^#\s+.+$/m.test(content)) {
        issues.push({
            code: 'body-h1',
            field: 'content',
            message: 'Do not add H1 headings inside the article body. Use ## for sections and ### for subsections.',
        });
    }

    if (/\[object Object\]/i.test(content)) {
        issues.push({
            code: 'object-object-leak',
            field: 'content',
            message: 'The article contains [object Object], which indicates broken rendered content.',
        });
    }

    for (const artifact of EDITORIAL_ARTIFACT_PATTERNS) {
        if (artifact.pattern.test(content)) {
            issues.push({
                code: artifact.code,
                field: 'content',
                message: `Remove the ${artifact.label} before publishing.`,
            });
        }
    }

    if (/\]\(\s*(?:javascript|vbscript|data):/i.test(content)) {
        issues.push({
            code: 'unsafe-link-target',
            field: 'content',
            message: 'The article contains an unsafe link target. Use http(s) or an internal CarMazium path.',
        });
    }

    if (/\[[^\]]+\]\(\s*\)/.test(content)) {
        issues.push({
            code: 'empty-link-target',
            field: 'content',
            message: 'The article contains a Markdown link with no destination.',
        });
    }

    return issues;
}

export function assertBlogPublishable(candidate: BlogPublicationCandidate): void {
    const errors = validateBlogPublication(candidate);
    if (!errors.length) return;

    throw new BadRequestException({
        code: 'BLOG_PUBLISH_VALIDATION_FAILED',
        message: 'Blog post is not ready to publish.',
        errors,
    });
}
