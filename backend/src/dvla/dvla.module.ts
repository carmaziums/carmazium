import { Module } from '@nestjs/common';
import { DvlaController } from './dvla.controller';
import { DvlaService } from './dvla.service';
import { AiModule } from '../ai/ai.module';

@Module({
    imports: [AiModule],
    controllers: [DvlaController],
    providers: [DvlaService],
    exports: [DvlaService],
})
export class DvlaModule { }
