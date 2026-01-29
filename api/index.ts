import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../backend/src/app.module';
import { NestExpressApplication } from '@nestjs/platform-express';

let cachedApp: NestExpressApplication;

export default async function handler(req: any, res: any) {
    if (!cachedApp) {
        const app = await NestFactory.create<NestExpressApplication>(AppModule);
        // We set the global prefix to 'api' (standard NestJS practice)
        // But we handle the URL matching manually below effectively
        app.setGlobalPrefix('api');

        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            transform: true,
        }));

        app.enableCors({
            origin: '*',
            methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
            preflightContinue: false,
            optionsSuccessStatus: 204,
        });

        await app.init();
        cachedApp = app;
    }

    const instance = cachedApp.getHttpAdapter().getInstance();

    // Vercel Routing Debug Logic
    const originalUrl = req.url;

    // CASE 1: Request comes in as exactly "/api/listings" (Ideal)
    // NestJS with prefix 'api' expects "/api/listings". MATCH.

    // CASE 2: Vercel rewrites "/api/listings" -> "/api" (Function)
    // Sometimes Vercel passes the rewritten path.
    // Use manual fix just in case.

    // Log for debugging
    console.log(`[API Request] Method: ${req.method} | URL: ${req.url}`);

    if (req.method === 'OPTIONS') {
        res.status(204).send();
        return;
    }

    instance(req, res);
}
