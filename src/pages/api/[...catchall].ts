import { NextApiRequest, NextApiResponse } from 'next';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../backend/src/app.module';

// Use a singleton to persist the Nest app across hot-reloads and invocations
let app: any;

const bootstrap = async (req: NextApiRequest, res: NextApiResponse) => {
    // Ensure CORS headers are present and handle preflight quickly
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    // Diagnostics: log incoming requests so we can see the exact URL/method
    // This will appear in your Next.js server logs
    try {
        console.log(`[Next API Catchall] ${req.method} ${req.url} host=${req.headers.host}`);
    } catch (e) {
        // ignore logging errors
    }

    if (!app) {
        app = await NestFactory.create(AppModule);
        app.setGlobalPrefix('api'); // Match the route prefix

        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            transform: true,
        }));

        // Next.js handles CORS automatically, but we ensure Nest doesn't block
        app.enableCors();

        await app.init();
    }

    const instance = app.getHttpAdapter().getInstance();

    // Log diagnostics
    // console.log(`[API via Next.js] ${req.method} ${req.url}`);

    // Bridge Next.js req/res to NestJS adapter (Express)
    instance(req, res);
};

export const config = {
    api: {
        bodyParser: false, // Let NestJS handle body parsing
        externalResolver: true, // Prevents warnings for external handlers
    },
};

export default bootstrap;
