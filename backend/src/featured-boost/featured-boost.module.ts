import { Module } from '@nestjs/common';
import { FeaturedBoostService } from './featured-boost.service';
import { FeaturedBoostController } from './featured-boost.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
    imports: [PrismaModule],
    controllers: [FeaturedBoostController],
    providers: [FeaturedBoostService],
    exports: [FeaturedBoostService],
})
export class FeaturedBoostModule { }
