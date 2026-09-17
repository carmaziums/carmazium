import { BadRequestException } from '@nestjs/common';
import { BlogService } from './blog.service';

const basePost = {
  id: 'post-1',
  title: 'UK Car Selling Guide',
  slug: 'uk-car-selling-guide',
  excerpt: 'A useful guide for UK car sellers.',
  content: '## Prepare the car\n\nDescribe it accurately.\n\n## Complete the sale\n\nKeep the required records.',
  coverImage: 'https://example.com/cover.jpg',
  authorName: 'CarMazium Team',
  tags: ['selling a car', 'UK'],
  status: 'DRAFT',
  publishedAt: null,
  metaTitle: 'UK Car Selling Guide',
  metaDescription: 'A useful guide for UK car sellers covering preparation, advertising and the final handover.',
  noIndex: false,
  createdAt: new Date('2026-09-01T00:00:00Z'),
  updatedAt: new Date('2026-09-01T00:00:00Z'),
  deletedAt: null,
};

describe('BlogService publication guardrails', () => {
  function setup(existing = basePost) {
    const prisma = {
      blogPost: {
        findFirst: jest.fn().mockResolvedValue(existing),
        update: jest.fn().mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ ...existing, ...data })),
        create: jest.fn(),
      },
    };

    return { service: new BlogService(prisma as never), prisma };
  }

  it('validates the merged stored article when a PATCH only publishes it', async () => {
    const { service, prisma } = setup({
      ...basePost,
      content: 'PHOTO IDEA: add a hero image\n\n## Real section\n\nBody copy.',
    });

    await expect(service.update('post-1', { status: 'PUBLISHED' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BLOG_PUBLISH_VALIDATION_FAILED' }),
    });
    expect(prisma.blogPost.update).not.toHaveBeenCalled();
  });

  it('locks the slug of an already published article', async () => {
    const { service, prisma } = setup({
      ...basePost,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-09-10T00:00:00Z'),
    });

    await expect(service.update('post-1', { slug: 'new-live-url' })).rejects.toMatchObject({
      response: expect.objectContaining({ code: 'BLOG_PUBLISHED_SLUG_LOCKED' }),
    });
    expect(prisma.blogPost.update).not.toHaveBeenCalled();
  });

  it('publishes a clean draft and stamps the first publish date', async () => {
    const { service, prisma } = setup();

    const result = await service.update('post-1', { status: 'PUBLISHED' });

    expect(prisma.blogPost.update).toHaveBeenCalledTimes(1);
    const updateCall = prisma.blogPost.update.mock.calls[0][0];
    expect(updateCall.data.status).toBe('PUBLISHED');
    expect(updateCall.data.slug).toBe(basePost.slug);
    expect(updateCall.data.publishedAt).toBeInstanceOf(Date);
    expect(result.status).toBe('PUBLISHED');
  });

  it('keeps the original publish date on later published edits', async () => {
    const publishedAt = new Date('2026-09-10T00:00:00Z');
    const { service, prisma } = setup({
      ...basePost,
      status: 'PUBLISHED',
      publishedAt,
    });

    await service.update('post-1', { title: 'Updated UK Car Selling Guide' });

    const updateCall = prisma.blogPost.update.mock.calls[0][0];
    expect(updateCall.data.publishedAt).toBe(publishedAt);
    expect(updateCall.data.title).toBe('Updated UK Car Selling Guide');
  });

  it('uses a structured bad request for a forbidden published slug change', async () => {
    const { service } = setup({
      ...basePost,
      status: 'PUBLISHED',
      publishedAt: new Date('2026-09-10T00:00:00Z'),
    });

    try {
      await service.update('post-1', { slug: 'changed-url' });
      throw new Error('expected slug lock to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('BLOG_PUBLISHED_SLUG_LOCKED');
    }
  });
});
