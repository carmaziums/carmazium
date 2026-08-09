import { apiClient } from './apiClient';

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
    const result = await apiClient<{ data: BlogPost }>('/blog', {
        method: 'POST',
        body: JSON.stringify(input),
    });
    return result.data;
}

export async function updateBlogPost(id: string, input: UpdateBlogPostInput): Promise<BlogPost> {
    const result = await apiClient<{ data: BlogPost }>(`/blog/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
    });
    return result.data;
}

export async function deleteBlogPost(id: string): Promise<void> {
    await apiClient<{ data: BlogPost }>(`/blog/${id}`, { method: 'DELETE' });
}
