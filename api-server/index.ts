import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../backend/src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

let cachedApp: NestExpressApplication;

export default async function handler(req: any, res: any) {
    if (!cachedApp) {
        const app = await NestFactory.create<NestExpressApplication>(AppModule);
        // We handle prefix matching via manual URL manipulation below
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
    const originalUrl = req.url;
    // Strip /v1 from the beginning of the URL so NestJS matches its routes correctly
    req.url = req.url.replace(/^\/v1/, '') || '/';
    console.log(`[API Request] ${req.method} ${originalUrl} -> ${req.url}`);

    // Check if Database URL is present (diagnostic)
    if (!process.env.DATABASE_URL) {
        console.error('DATABASE_URL is missing from environment variables!');
    }

    instance(req, res);
}
