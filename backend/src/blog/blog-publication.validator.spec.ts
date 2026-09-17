import { BadRequestException } from '@nestjs/common';
import {
  assertBlogPublishable,
  sanitizeBlogWrite,
  validateBlogPublication,
} from './blog-publication.validator';

const validPublishedPost = {
  title: 'Selling Your Car Privately in the UK',
  slug: 'selling-your-car-privately-in-the-uk',
  excerpt: 'A practical UK guide to preparing, advertising and completing a private vehicle sale.',
  content: '## Prepare the car\n\nGive buyers accurate information.\n\n## Complete the sale\n\nKeep the required records.',
  coverImage: 'https://example.com/cover.jpg',
  authorName: 'CarMazium Team',
  tags: ['selling a car', 'UK car market'],
  status: 'PUBLISHED' as const,
  metaTitle: 'Selling Your Car Privately in the UK',
  metaDescription: 'A practical UK guide to preparing, advertising and completing a private vehicle sale safely and clearly.',
  noIndex: false,
};

describe('blog publication validation', () => {
  it('allows a clean published article', () => {
    expect(validateBlogPublication(validPublishedPost)).toEqual([]);
    expect(() => assertBlogPublishable(validPublishedPost)).not.toThrow();
  });

  it('keeps incomplete drafts saveable', () => {
    expect(validateBlogPublication({ status: 'DRAFT', title: 'Working title' })).toEqual([]);
  });

  it('rejects missing required publish fields and invalid slugs', () => {
    const issues = validateBlogPublication({
      status: 'PUBLISHED',
      title: '',
      slug: 'Bad Slug',
      excerpt: '',
      content: '',
      coverImage: '',
    });

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'required-title',
      'slug-format',
      'required-excerpt',
      'required-content',
      'required-coverImage',
    ]));
  });

  it('rejects duplicate titles, body H1s and editorial artefacts', () => {
    const issues = validateBlogPublication({
      ...validPublishedPost,
      content: [
        validPublishedPost.title,
        '',
        '# Another H1',
        '',
        'PHOTO IDEA: add a dashboard image',
        '',
        '[object Object]',
      ].join('\n'),
    });

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'duplicate-body-title',
      'body-h1',
      'editorial-photo-idea',
      'object-object-leak',
    ]));
  });

  it('rejects unsafe and empty markdown links', () => {
    const issues = validateBlogPublication({
      ...validPublishedPost,
      content: '## Links\n\n[Unsafe](javascript:alert(1))\n\n[Empty]()',
    });

    expect(issues.map((issue) => issue.code)).toEqual(expect.arrayContaining([
      'unsafe-link-target',
      'empty-link-target',
    ]));
  });

  it('sanitizes deterministic write noise without changing the slug', () => {
    const sanitized = sanitizeBlogWrite({
      title: '  Test article  ',
      slug: 'existing-live-slug',
      excerpt: '  Summary  ',
      content: '  [Source](https://example.com/page?utm_source=chatgpt.com&gclid=123&keep=yes)  ',
      authorName: '  CarMazium Team  ',
      tags: [' Guide ', 'guide', '', ' UK '],
      metaTitle: 'Test Article | CarMazium | CarMazium',
      metaDescription: '  Useful description  ',
    });

    expect(sanitized).toMatchObject({
      title: 'Test article',
      slug: 'existing-live-slug',
      excerpt: 'Summary',
      authorName: 'CarMazium Team',
      tags: ['Guide', 'UK'],
      metaTitle: 'Test Article',
      metaDescription: 'Useful description',
    });
    expect(sanitized.content).toContain('keep=yes');
    expect(sanitized.content).not.toContain('utm_source');
    expect(sanitized.content).not.toContain('gclid');
  });

  it('returns structured BadRequestException details for publish failures', () => {
    try {
      assertBlogPublishable({ ...validPublishedPost, content: '# Invalid H1' });
      throw new Error('expected validation to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      const response = (error as BadRequestException).getResponse() as Record<string, unknown>;
      expect(response.code).toBe('BLOG_PUBLISH_VALIDATION_FAILED');
      expect(response.errors).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'body-h1', field: 'content' }),
      ]));
    }
  });
});
