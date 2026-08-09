import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiTags } from '@nestjs/swagger';
import { BlogService } from './blog.service';
import { CreateBlogPostDto } from './dto/create-blog-post.dto';
import { UpdateBlogPostDto } from './dto/update-blog-post.dto';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { StandardResponse, PaginatedResponse } from '../listings/dto/response.dto';

@ApiTags('Blog')
@Controller('blog')
export class BlogController {
    constructor(private readonly blogService: BlogService) { }

    // ── Public ────────────────────────────────────────────────────────────────

    @Get()
    @ApiOperation({ summary: 'List published blog posts' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    @ApiQuery({ name: 'tag', required: false })
    async findAllPublished(
        @Query('page') page = '1',
        @Query('limit') limit = '12',
        @Query('tag') tag?: string,
    ) {
        const { data, total } = await this.blogService.findAllPublished(Number(page), Number(limit), tag);
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Get(':slug/related')
    @ApiOperation({ summary: 'Get posts related to a published post by tag overlap' })
    @ApiParam({ name: 'slug' })
    async findRelated(@Param('slug') slug: string) {
        const post = await this.blogService.findPublishedBySlug(slug);
        const related = await this.blogService.findRelated(post.id, post.tags);
        return new StandardResponse(related);
    }

    @Get(':slug')
    @ApiOperation({ summary: 'Get a published blog post by slug' })
    @ApiParam({ name: 'slug' })
    async findPublishedBySlug(@Param('slug') slug: string) {
        const post = await this.blogService.findPublishedBySlug(slug);
        return new StandardResponse(post);
    }

    // ── Admin ─────────────────────────────────────────────────────────────────

    @Get('admin/all')
    @ApiCookieAuth()
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'List all blog posts regardless of status (admin only)' })
    @ApiQuery({ name: 'page', required: false })
    @ApiQuery({ name: 'limit', required: false })
    async findAllAdmin(
        @Query('page') page = '1',
        @Query('limit') limit = '20',
    ) {
        const { data, total } = await this.blogService.findAllAdmin(Number(page), Number(limit));
        return new PaginatedResponse(data, total, Number(page), Number(limit));
    }

    @Get('admin/:id')
    @ApiCookieAuth()
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Get a blog post by id, any status (admin only)' })
    @ApiParam({ name: 'id' })
    async findOneAdmin(@Param('id') id: string) {
        const post = await this.blogService.findOneAdmin(id);
        return new StandardResponse(post);
    }

    @Post()
    @ApiCookieAuth()
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Create a blog post (admin only)' })
    async create(@Body() dto: CreateBlogPostDto) {
        const post = await this.blogService.create(dto);
        return new StandardResponse(post);
    }

    @Patch(':id')
    @ApiCookieAuth()
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Update a blog post (admin only)' })
    @ApiParam({ name: 'id' })
    async update(@Param('id') id: string, @Body() dto: UpdateBlogPostDto) {
        const post = await this.blogService.update(id, dto);
        return new StandardResponse(post);
    }

    @Delete(':id')
    @ApiCookieAuth()
    @UseGuards(SessionAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @ApiOperation({ summary: 'Soft-delete a blog post (admin only)' })
    @ApiParam({ name: 'id' })
    async remove(@Param('id') id: string) {
        const post = await this.blogService.remove(id);
        return new StandardResponse(post);
    }
}
