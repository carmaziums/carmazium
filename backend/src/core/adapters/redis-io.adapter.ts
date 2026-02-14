import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { Redis } from 'ioredis';
import { Logger } from '@nestjs/common';

const DEFAULT_SERVER_OPTIONS: Partial<ServerOptions> = {
    pingTimeout: 20000,
    connectTimeout: 45000,
    maxHttpBufferSize: 1e6,
};

export class RedisIoAdapter extends IoAdapter {
    private adapterConstructor: ReturnType<typeof createAdapter>;
    private pubClient: Redis | null = null;
    private subClient: Redis | null = null;
    private readonly logger = new Logger(RedisIoAdapter.name);
    private readonly serverOptions: Partial<ServerOptions>;

    constructor(app: any, serverOptions?: Partial<ServerOptions>) {
        super(app);
        this.serverOptions = { ...DEFAULT_SERVER_OPTIONS, ...serverOptions };
    }

    async connectToRedis(): Promise<void> {
        const redisUrl = process.env.REDIS_URL;
        if (!redisUrl) {
            this.logger.warn('REDIS_URL not found, falling back to default IoAdapter');
            return;
        }

        try {
            this.pubClient = new Redis(redisUrl, {
                maxRetriesPerRequest: 3,
                retryStrategy: (times) => (times <= 3 ? Math.min(times * 200, 2000) : null),
            });
            this.subClient = this.pubClient.duplicate();
            this.adapterConstructor = createAdapter(this.pubClient, this.subClient);
            this.logger.log('RedisIoAdapter connected and initialized');
        } catch (error) {
            this.logger.error('Failed to connect to Redis for WebSocket adapter', error.stack);
        }
    }

    createIOServer(port: number, options?: ServerOptions): any {
        const merged = { ...this.serverOptions, ...options };
        const server = super.createIOServer(port, merged);
        if (this.adapterConstructor) {
            server.adapter(this.adapterConstructor);
        }
        return server;
    }

    /**
     * Close Redis connections. Call this on graceful shutdown (e.g. SIGTERM) to avoid connection leaks.
     */
    async close(): Promise<void> {
        if (this.pubClient) {
            await this.pubClient.quit();
            this.pubClient = null;
        }
        if (this.subClient) {
            await this.subClient.quit();
            this.subClient = null;
        }
        this.adapterConstructor = null;
        this.logger.log('RedisIoAdapter connections closed');
    }
}
