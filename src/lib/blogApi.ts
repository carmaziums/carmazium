import { apiClient } from './apiClient';
import {
    slugifyBlogTitle,
    stripCarMaziumBrandSuffix,
    stripTrackingParametersFromContent,
} from './blogValidation';

export type BlogPostStatus = 'DRAFT' | 'PUBLISHED';

export interface BlogPost {
    id: string;
    slug: string;
    title: string;
    excerpt: string;
    content: string;
    coverImage: string | null;
    authorName: string;
    tags: string[];
    status: BlogPostStatus;
    publishedAt: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    noIndex: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * Lightweight representation used by listing/card surfaces that do not need
 * the full article body. Keeping the content field out prevents entire blog
 * articles from being serialized into unrelated pages such as the homepage.
 */
export type BlogPostSummary = Pick<BlogPost, 'id' | 'slug' | 'title' | 'excerpt' | 'coverImage'>;

export interface CreateBlogPostInput {
    title: string;
    slug?: string;
    excerpt: string;
    content: string;
    coverImage?: string;
    authorName?: string;
    tags?: string[];
    status?: BlogPostStatus;
    metaTitle?: string;
    metaDescription?: string;
    noIndex?: boolean;
}

export type UpdateBlogPostInput = Partial<CreateBlogPostInput>;

interface Paginated<T> {
    data: T[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
}

function cleanTags(tags: string[] | undefined): string[] | undefined {
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

function cleanOptionalText(value: string | undefined): string | undefined {
    if (value === undefined) return undefined;
    const cleaned = value.trim();
    return cleaned || undefined;
}

function sanitizeBlogWriteInput<T extends CreateBlogPostInput | UpdateBlogPostInput>(
    input: T,
    options: { normalizeSlug: boolean },
): T {
    const next: CreateBlogPostInput | UpdateBlogPostInput = { ...input };

    if (typeof input.title === 'string') next.title = input.title.trim();
    if (typeof input.excerpt === 'string') next.excerpt = input.excerpt.trim();
    if (typeof input.content === 'string') {
        next.content = stripTrackingParametersFromContent(input.content.replace(/\r\n/g, '\n')).trim();
    }
    if (typeof input.authorName === 'string') next.authorName = cleanOptionalText(input.authorName);
    if (typeof input.coverImage === 'string') next.coverImage = cleanOptionalText(input.coverImage);
    if (input.tags) next.tags = cleanTags(input.tags);
    if (typeof input.metaTitle === 'string') {
        next.metaTitle = cleanOptionalText(stripCarMaziumBrandSuffix(input.metaTitle));
    }
    if (typeof input.metaDescription === 'string') next.metaDescription = cleanOptionalText(input.metaDescription);

    if (typeof input.slug === 'string') {
        // Existing article URLs are deliberately never auto-rewritten during an
        // update. Published slugs are SEO-sensitive and require an explicit
        // redirect strategy before they can safely change.
        next.slug = options.normalizeSlug ? slugifyBlogTitle(input.slug) : input.slug.trim();
    } else if (options.normalizeSlug && typeof input.title === 'string') {
        next.slug = slugifyBlogTitle(input.title);
    }

    return next as T;
}

// ─── Public ─────────────────────────────────────────────────────────────────

export async function getBlogPosts(page = 1, limit = 12, tag?: string): Promise<Paginated<BlogPost>> {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (tag) qs.set('tag', tag);
    return apiClient<Paginated<BlogPost>>(`/blog?${qs.toString()}`);
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPost> {
    const result = await apiClient<{ data: BlogPost }>(`/blog/${slug}`);
    return result.data;
}

export async function getRelatedBlogPosts(slug: string): Promise<BlogPost[]> {
    const result = await apiClient<{ data: BlogPost[] }>(`/blog/${slug}/related`);
    return result.data;
}

// ─── Admin ──────────────────────────────────────────────────────────────────

export async function getAdminBlogPosts(page = 1, limit = 20): Promise<Paginated<BlogPost>> {
    return apiClient<Paginated<BlogPost>>(`/blog/admin/all?page=${page}&limit=${limit}`);
}

export async function getAdminBlogPost(id: string): Promise<BlogPost> {
    const result = await apiClient<{ data: BlogPost }>(`/blog/admin/${id}`);
    return result.data;
}

export async function createBlogPost(input: CreateBlogPostInput): Promise<BlogPost> {
    const sanitizedInput = sanitizeBlogWriteInput(input, { normalizeSlug: true });
    const result = await apiClient<{ data: BlogPost }>('/blog', {
        method: 'POST',
        body: JSON.stringify(sanitizedInput),
    });
    return result.data;
}

export async function updateBlogPost(id: string, input: UpdateBlogPostInput): Promise<BlogPost> {
    const sanitizedInput = sanitizeBlogWriteInput(input, { normalizeSlug: false });
    const result = await apiClient<{ data: BlogPost }>(`/blog/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(sanitizedInput),
    });
    return result.data;
}

export async function deleteBlogPost(id: string): Promise<void> {
    await apiClient<{ data: BlogPost }>(`/blog/${id}`, { method: 'DELETE' });
}