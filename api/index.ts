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
        app.enableCors();
        await app.init();
        cachedApp = app;
    }

    const instance = cachedApp.getHttpAdapter().getInstance();

    // Log for debugging on Vercel
    console.log(`[API Request] ${req.method} ${req.url}`);

    // Ensure the URL matches what Nest expects if it was rewritten
    if (req.url && !req.url.startsWith('/api')) {
        req.url = `/api${req.url}`;
    }

    instance(req, res);
}
