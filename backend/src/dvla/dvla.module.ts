import { Module } from '@nestjs/common';
import { DvlaController } from './dvla.controller';
import { DvlaService } from './dvla.service';

@Module({
    controllers: [DvlaController],
    providers: [DvlaService],
    exports: [DvlaService],
})
export class DvlaModule { }
