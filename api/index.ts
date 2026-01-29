import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../backend/src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

let cachedApp: NestExpressApplication;

export default async function handler(req: any, res: any) {
    if (!cachedApp) {
        const app = await NestFactory.create<NestExpressApplication>(AppModule);
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            transform: true,
        }));
        await app.init();
        cachedApp = app;
    }

    const instance = cachedApp.getHttpAdapter().getInstance();
    instance(req, res);
}
