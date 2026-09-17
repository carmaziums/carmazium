import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { assertBlogPublishable, sanitizeBlogWrite } from './blog-publication.validator';

@Injectable()
export class BlogService {
    constructor(private readonly prisma: PrismaService) { }

    private slugify(title: string): string {
        return title
            .toLowerCase()
            .trim()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    /** Appends -2, -3, ... until the slug is free (excluding `excludeId` on updates). */
    private async uniqueSlug(base: string, excludeId?: string): Promise<string> {
        let candidate = base;
        let suffix = 2;
        while (true) {
            const existing = await this.prisma.blogPost.findFirst({
                where: { slug: candidate, ...(excludeId && { id: { not: excludeId } }) },
                select: { id: true },
            });
            if (!existing) return candidate;
            candidate = `${base}-${suffix++}`;
        }
    }

    // ── Public ────────────────────────────────────────────────────────────────

    async findAllPublished(page = 1, limit = 12, tag?: string) {
        const skip = (page - 1) * limit;
        const where = {
            status: 'PUBLISHED' as const,
            deletedAt: null,
            publishedAt: { lte: new Date() },
            ...(tag && { tags: { has: tag } }),
        };
        const [data, total] = await Promise.all([
            this.prisma.blogPost.findMany({
                where,
                skip,
                take: limit,
                orderBy: { publishedAt: 'desc' },
            }),
            this.prisma.blogPost.count({ where }),
        ]);
        return { data, total };
    }

    async findPublishedBySlug(slug: string) {
        const post = await this.prisma.blogPost.findFirst({
            where: { slug, status: 'PUBLISHED', deletedAt: null, publishedAt: { lte: new Date() } },
        });
        if (!post) throw new NotFoundException('Blog post not found');
        return post;
    }

    /**
     * Other published posts sharing at least one tag, newest first; backfilled
     * with the most recent other posts if there aren't enough tag matches.
     */
    async findRelated(currentId: string, tags: string[], limit = 3) {
        const baseWhere = { id: { not: currentId }, status: 'PUBLISHED' as const, deletedAt: null, publishedAt: { lte: new Date() } };

        const byTag = tags.length
            ? await this.prisma.blogPost.findMany({
                where: { ...baseWhere, tags: { hasSome: tags } },
                orderBy: { publishedAt: 'desc' },
                take: limit,
            })
            : [];

        if (byTag.length >= limit) return byTag;

        const fallback = await this.prisma.blogPost.findMany({
            where: { ...baseWhere, id: { notIn: [currentId, ...byTag.map(p => p.id)] } },
            orderBy: { publishedAt: 'desc' },
            take: limit - byTag.length,
        });

        return [...byTag, ...fallback];
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    async findAllAdmin(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const where = { deletedAt: null };
        const [data, total] = await Promise.all([
            this.prisma.blogPost.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
            }),
            this.prisma.blogPost.count({ where }),
        ]);
        return { data, total };
    }

    async findOneAdmin(id: string) {
        const post = await this.prisma.blogPost.findFirst({ where: { id, deletedAt: null } });
        if (!post) throw new NotFoundException('Blog post not found');
        return post;
    }

    async create(dto: CreateBlogPostDto) {
        const sanitized = sanitizeBlogWrite(dto);
        const base = this.slugify(sanitized.slug || sanitized.title);
        const slug = await this.uniqueSlug(base);
        const status = sanitized.status ?? 'DRAFT';

        assertBlogPublishable({ ...sanitized, slug, status });

        return this.prisma.blogPost.create({
            data: {
                title: sanitized.title,
                slug,
                excerpt: sanitized.excerpt,
                content: sanitized.content,
                coverImage: sanitized.coverImage,
                authorName: sanitized.authorName || 'CarMazium Team',
                tags: sanitized.tags ?? [],
                status,
                publishedAt: status === 'PUBLISHED' ? new Date() : null,
                metaTitle: sanitized.metaTitle,
                metaDescription: sanitized.metaDescription,
                noIndex: sanitized.noIndex ?? false,
            },
        });
    }

    async update(id: string, dto: UpdateBlogPostDto) {
        const existing = await this.findOneAdmin(id);
        const sanitized = sanitizeBlogWrite(dto);

        let slug = existing.slug;
        if (sanitized.slug && sanitized.slug !== existing.slug) {
            if (existing.status === 'PUBLISHED') {
                throw new BadRequestException({
                    code: 'BLOG_PUBLISHED_SLUG_LOCKED',
                    message: 'A published blog URL cannot be changed without a permanent redirect strategy.',
                    errors: [{
                        code: 'published-slug-locked',
                        field: 'slug',
                        message: 'This article is already published. Keep its existing slug unless the old URL will permanently redirect to the new one.',
                    }],
                });
            }
            slug = await this.uniqueSlug(this.slugify(sanitized.slug), id);
        }

        const nextStatus = sanitized.status ?? existing.status;
        assertBlogPublishable({
            title: sanitized.title ?? existing.title,
            slug,
            excerpt: sanitized.excerpt ?? existing.excerpt,
            content: sanitized.content ?? existing.content,
            coverImage: sanitized.coverImage ?? existing.coverImage,
            authorName: sanitized.authorName ?? existing.authorName,
            tags: sanitized.tags ?? existing.tags,
            status: nextStatus,
            metaTitle: sanitized.metaTitle ?? existing.metaTitle,
            metaDescription: sanitized.metaDescription ?? existing.metaDescription,
            noIndex: sanitized.noIndex ?? existing.noIndex,
        });

        // Stamp publishedAt the first time a post transitions to PUBLISHED;
        // leave it untouched on subsequent edits so the original publish date sticks.
        let publishedAt = existing.publishedAt;
        if (sanitized.status === 'PUBLISHED' && !existing.publishedAt) {
            publishedAt = new Date();
        } else if (sanitized.status === 'DRAFT') {
            publishedAt = null;
        }

        return this.prisma.blogPost.update({
            where: { id },
            data: {
                ...(sanitized.title !== undefined && { title: sanitized.title }),
                slug,
                ...(sanitized.excerpt !== undefined && { excerpt: sanitized.excerpt }),
                ...(sanitized.content !== undefined && { content: sanitized.content }),
                ...(sanitized.coverImage !== undefined && { coverImage: sanitized.coverImage }),
                ...(sanitized.authorName !== undefined && { authorName: sanitized.authorName }),
                ...(sanitized.tags !== undefined && { tags: sanitized.tags }),
                ...(sanitized.status !== undefined && { status: sanitized.status }),
                publishedAt,
                ...(sanitized.metaTitle !== undefined && { metaTitle: sanitized.metaTitle }),
                ...(sanitized.metaDescription !== undefined && { metaDescription: sanitized.metaDescription }),
                ...(sanitized.noIndex !== undefined && { noIndex: sanitized.noIndex }),
            },
        });
    }

    async remove(id: string) {
        await this.findOneAdmin(id);
        return this.prisma.blogPost.update({
            where: { id },
            data: { deletedAt: new Date() },
        });
    }
}
