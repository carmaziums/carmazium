import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';

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

    async findAllPublished(page = 1, limit = 12) {
        const skip = (page - 1) * limit;
        const where = { status: 'PUBLISHED' as const, deletedAt: null, publishedAt: { lte: new Date() } };
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
        const base = this.slugify(dto.slug || dto.title);
        const slug = await this.uniqueSlug(base);
        const status = dto.status ?? 'DRAFT';

        return this.prisma.blogPost.create({
            data: {
                title: dto.title,
                slug,
                excerpt: dto.excerpt,
                content: dto.content,
                coverImage: dto.coverImage,
                authorName: dto.authorName || 'CarMazium Team',
                tags: dto.tags ?? [],
                status,
                publishedAt: status === 'PUBLISHED' ? new Date() : null,
                metaTitle: dto.metaTitle,
                metaDescription: dto.metaDescription,
            },
        });
    }

    async update(id: string, dto: UpdateBlogPostDto) {
        const existing = await this.findOneAdmin(id);

        let slug = existing.slug;
        if (dto.slug && dto.slug !== existing.slug) {
            slug = await this.uniqueSlug(this.slugify(dto.slug), id);
        }

        // Stamp publishedAt the first time a post transitions to PUBLISHED;
        // leave it untouched on subsequent edits so the original publish date sticks.
        let publishedAt = existing.publishedAt;
        if (dto.status === 'PUBLISHED' && !existing.publishedAt) {
            publishedAt = new Date();
        } else if (dto.status === 'DRAFT') {
            publishedAt = null;
        }

        return this.prisma.blogPost.update({
            where: { id },
            data: {
                ...(dto.title !== undefined && { title: dto.title }),
                slug,
                ...(dto.excerpt !== undefined && { excerpt: dto.excerpt }),
                ...(dto.content !== undefined && { content: dto.content }),
                ...(dto.coverImage !== undefined && { coverImage: dto.coverImage }),
                ...(dto.authorName !== undefined && { authorName: dto.authorName }),
                ...(dto.tags !== undefined && { tags: dto.tags }),
                ...(dto.status !== undefined && { status: dto.status }),
                publishedAt,
                ...(dto.metaTitle !== undefined && { metaTitle: dto.metaTitle }),
                ...(dto.metaDescription !== undefined && { metaDescription: dto.metaDescription }),
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
