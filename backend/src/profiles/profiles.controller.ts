import {
    Controller,
    DefaultValuePipe,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    ParseIntPipe,
    Post,
    Body,
    Query,
    UseGuards,
} from '@nestjs/common';
import {
    ApiCookieAuth,
    ApiOperation,
    ApiParam,
    ApiQuery,
    ApiTags,
} from '@nestjs/swagger';
import { SessionAuthGuard } from '../auth/guards/session-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ProfilesService } from './profiles.service';
import { CreateProfileReviewDto } from './dto/create-profile-review.dto';

@ApiTags('Profiles')
@Controller('profiles')
export class ProfilesController {
    constructor(private readonly profilesService: ProfilesService) { }

    @Get('me/reviews/given')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @ApiOperation({ summary: 'Get reviews written by the authenticated profile' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getMyReviewsGiven(
        @CurrentUser() user: any,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return {
            success: true,
            data: await this.profilesService.getReviewsGiven(user.id, page, Math.min(limit, 50)),
        };
    }

    @Get(':userId')
    @ApiOperation({ summary: 'Get a verified public CarMazium profile with rating and service badges' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    async getPublicProfile(@Param('userId') userId: string) {
        return {
            success: true,
            data: await this.profilesService.getPublicProfile(userId),
        };
    }

    @Get(':userId/reviews')
    @ApiOperation({ summary: 'Get reviews received by a verified public profile' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getReceivedReviews(
        @Param('userId') userId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        return {
            success: true,
            data: await this.profilesService.getReceivedReviews(userId, page, Math.min(limit, 50)),
        };
    }

    @Get(':userId/reviews/given')
    @ApiOperation({ summary: 'Get reviews written by a verified public profile' })
    @ApiParam({ name: 'userId', description: 'User ID' })
    @ApiQuery({ name: 'page', required: false, type: Number })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    async getPublicReviewsGiven(
        @Param('userId') userId: string,
        @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
        @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    ) {
        // Reuse the public profile verification + visibility gate before exposing
        // review history, then omit review targets that are themselves no longer
        // eligible to appear publicly.
        await this.profilesService.getPublicProfile(userId);
        return {
            success: true,
            data: await this.profilesService.getReviewsGiven(userId, page, Math.min(limit, 50), true),
        };
    }

    @Post(':userId/reviews')
    @UseGuards(SessionAuthGuard)
    @ApiCookieAuth()
    @HttpCode(HttpStatus.CREATED)
    @ApiOperation({ summary: 'Create or update a review after a completed CarMazium interaction' })
    async submitReview(
        @CurrentUser() user: any,
        @Param('userId') userId: string,
        @Body() dto: CreateProfileReviewDto,
    ) {
        return {
            success: true,
            data: await this.profilesService.submitReview(user.id, userId, dto),
        };
    }
}
