import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: ReturnType<typeof createAdapter>;
    private readonly logger = new Logger(RedisIoAdapter.name);

    async connectToRedis(): Promise<void> {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            this.logger.warn('REDIS_URL not found, falling back to default IoAdapter');
            return;
        }

        try {
            const pubClient = new Redis(redisUrl);
            const subClient = pubClient.duplicate();

            this.adapterConstructor = createAdapter(pubClient, subClient);
            this.logger.log('RedisIoAdapter connected and initialized');
        } catch (error) {
            this.logger.error('Failed to connect to Redis for WebSocket adapter', error.stack);
        }
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const server = super.createIOServer(port, options);
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }
}
