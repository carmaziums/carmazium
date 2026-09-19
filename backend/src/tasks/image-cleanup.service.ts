import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';

const BUCKET_NAME = 'listings';
const OWNER_FOLDER_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VEHICLE_MEDIA_FOLDERS = ['vehicle', 'exterior', 'interior', 'damage'] as const;
const ORPHAN_GRACE_HOURS = 24;
const LIST_PAGE_SIZE = 1000;
const DELETE_BATCH_SIZE = 100;

@Injectable()
export class ImageCleanupService {
    private readonly logger = new Logger(ImageCleanupService.name);
    private supabase: any;

    constructor(
        private prisma: PrismaService,
        private configService: ConfigService,
    ) {
        const supabaseUrl = this.configService.get<string>('SUPABASE_URL')
            || this.configService.get<string>('NEXT_PUBLIC_SUPABASE_URL');
        const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY');

        if (supabaseUrl && supabaseServiceKey) {
            this.supabase = createClient(supabaseUrl, supabaseServiceKey, {
                auth: {
                    persistSession: false,
                    autoRefreshToken: false,
                },
            });
        } else {
            this.logger.warn('Supabase credentials missing. Cleanup task will not run effectively.');
        }
    }

    private async listAll(path: string) {
        const files: any[] = [];
        let offset = 0;

        while (true) {
            const { data, error } = await this.supabase
                .storage
                .from(BUCKET_NAME)
                .list(path, {
                    limit: LIST_PAGE_SIZE,
                    offset,
                    sortBy: { column: 'name', order: 'asc' },
                });

            if (error) {
                throw new Error(`Failed to list ${path || 'bucket root'}: ${error.message}`);
            }

            const page = data ?? [];
            files.push(...page);
            if (page.length < LIST_PAGE_SIZE) break;
            offset += page.length;
        }

        return files;
    }

    private publicUrlFor(objectPath: string): string {
        return this.supabase.storage.from(BUCKET_NAME).getPublicUrl(objectPath).data.publicUrl;
    }

    /**
     * Only owner-scoped vehicle media is eligible for automatic cleanup.
     * KYC, handover, profile, blog and marketing media share this public bucket
     * but have different retention/access rules and are intentionally excluded.
     */
    private async findOwnerScopedVehicleObjects() {
        const root = await this.listAll('');
        const owners = root
            .map((entry: any) => String(entry?.name ?? ''))
            .filter((name: string) => OWNER_FOLDER_PATTERN.test(name));

        const objects: Array<{ path: string; createdAt: string }> = [];

        for (const ownerId of owners) {
            for (const folder of VEHICLE_MEDIA_FOLDERS) {
                const prefix = `${ownerId}/${folder}`;
                try {
                    const files = await this.listAll(prefix);
                    for (const file of files) {
                        // Storage folders have no object id/created_at. Category
                        // paths are expected to contain files, but fail closed if
                        // another nested directory is ever introduced.
                        if (!file?.id || !file?.created_at || !file?.name) continue;
                        objects.push({
                            path: `${prefix}/${file.name}`,
                            createdAt: file.created_at,
                        });
                    }
                } catch (error: any) {
                    this.logger.warn(`Skipping cleanup folder ${prefix}: ${error?.message || error}`);
                }
            }
        }

        return objects;
    }

    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async handleCron() {
        this.logger.log('Starting scheduled owner-scoped vehicle image cleanup...');
        if (!this.supabase) {
            this.logger.warn('Supabase client not initialized. Skipping cleanup.');
            return;
        }

        try {
            const listings = await this.prisma.listing.findMany({
                select: { images: true },
            });

            // URL fragments hold CarMazium photo presentation/category metadata
            // and are never part of the Storage object URL. Strip them before
            // matching references or a valid live listing could be mistaken for
            // an orphan after photo categorisation/repositioning.
            const referencedImages = new Set<string>();
            listings.forEach((listing) => {
                if (!Array.isArray(listing.images)) return;
                listing.images.forEach((image: unknown) => {
                    if (typeof image === 'string' && image) {
                        referencedImages.add(image.split('#')[0]);
                    }
                });
            });

            const objects = await this.findOwnerScopedVehicleObjects();
            const cutoff = Date.now() - ORPHAN_GRACE_HOURS * 60 * 60 * 1000;
            const orphans = objects
                .filter((object) => {
                    const createdAt = new Date(object.createdAt).getTime();
                    if (!Number.isFinite(createdAt) || createdAt > cutoff) return false;
                    return !referencedImages.has(this.publicUrlFor(object.path));
                })
                .map((object) => object.path);

            this.logger.log(
                `Scanned ${objects.length} owner-scoped vehicle objects; found ${orphans.length} unreferenced objects older than ${ORPHAN_GRACE_HOURS}h.`,
            );

            for (let offset = 0; offset < orphans.length; offset += DELETE_BATCH_SIZE) {
                const batch = orphans.slice(offset, offset + DELETE_BATCH_SIZE);
                const { error } = await this.supabase
                    .storage
                    .from(BUCKET_NAME)
                    .remove(batch);

                if (error) {
                    this.logger.error(
                        `Failed to delete vehicle-image orphan batch ${offset / DELETE_BATCH_SIZE + 1}: ${error.message}`,
                    );
                }
            }
        } catch (error: any) {
            this.logger.error(`Error during image cleanup: ${error?.message || error}`);
        }
    }
}
