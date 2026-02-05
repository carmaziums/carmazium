import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class ImageCleanupService {
    private readonly logger = new Logger(ImageCleanupService.name);
    private supabase: any;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        const supabaseUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');
        const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && supabaseServiceKey) {
            this.supabase = createClient(supabaseUrl, supabaseServiceKey);
        } else {
            this.logger.warn('Supabase credentials missing. Cleanup task will not run effectively.');
        }
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleCron() {
        this.logger.log('Starting scheduled image cleanup...');
        if (!this.supabase) {
            this.logger.warn('Supabase client not initialized. Skipping cleanup.');
            return;
        }

        try {
            // 1. Get all image URLs from database
            const listings = await this.prisma.listing.findMany({
                select: { images: true },
            });

            const activeImages = new Set<string>();
            listings.forEach(l => {
                if (Array.isArray(l.images)) {
                    l.images.forEach((img: any) => {
                        if (typeof img === 'string') activeImages.add(img);
                    });
                }
            });

            this.logger.log(`Found ${activeImages.size} active images in database.`);

            // 2. List files in storage bucket
            const BUCKET_NAME = 'listings';

            const { data: files, error } = await this.supabase
                .storage
                .from(BUCKET_NAME)
                .list('', { limit: 1000, offset: 0 });

            if (error) {
                this.logger.error(`Failed to list files: ${error.message}`);
                return;
            }

            if (!files || files.length === 0) {
                this.logger.log('No files found in storage.');
                return;
            }

            // 3. Find orphans
            const orphans: string[] = [];
            const projectUrl = this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');

            files.forEach((file: any) => {
                // Approximate public URL
                const publicUrl = `${projectUrl}/storage/v1/object/public/${BUCKET_NAME}/${file.name}`;

                if (!activeImages.has(publicUrl)) {
                    // Check age (exclude files created < 24h ago)
                    const created = new Date(file.created_at);
                    const now = new Date();
                    const ageHours = (now.getTime() - created.getTime()) / (1000 * 60 * 60);

                    if (ageHours > 24) {
                        orphans.push(file.name);
                    }
                }
            });

            this.logger.log(`Found ${orphans.length} orphaned files to delete.`);

            // 4. Delete orphans
            if (orphans.length > 0) {
                const { error: deleteError } = await this.supabase
                    .storage
                    .from(BUCKET_NAME)
                    .remove(orphans);

                if (deleteError) {
                    this.logger.error(`Failed to delete orphans: ${deleteError.message}`);
                } else {
                    this.logger.log(`Successfully deleted ${orphans.length} orphaned images.`);
                }
            }

        } catch (err) {
            this.logger.error('Error during image cleanup:', err);
        }
    }
}
