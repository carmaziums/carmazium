import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_RETENTION_HOURS = 7 * 24;
const MIN_RETENTION_HOURS = 24;

export interface UnverifiedCleanupResult {
    scanned: number;
    deleted: number;
    reconciledVerified: number;
    skipped: number;
    failed: number;
}

/**
 * Removes abandoned signups that never confirmed their email.
 *
 * Safety rules:
 * - local account must still be marked unverified;
 * - local account must be older than the configured retention period;
 * - ADMIN accounts are never candidates;
 * - Supabase Auth is the source of truth for confirmation status;
 * - if Supabase says the email is confirmed, we repair the local flag instead
 *   of deleting the account;
 * - deletion is performed through Supabase Admin. A database trigger installed
 *   by the matching manual migration removes the local row in the same auth
 *   deletion transaction. If local FK constraints prevent deletion, Supabase's
 *   delete fails rather than leaving half an account behind.
 *
 * Default retention is 7 days. It can be changed without code by setting
 * UNVERIFIED_ACCOUNT_RETENTION_HOURS (minimum 24 hours).
 */
@Injectable()
export class UnverifiedAccountCleanupService {
    private readonly logger = new Logger(UnverifiedAccountCleanupService.name);
    private readonly supabaseAdmin: SupabaseClient | null;
    private readonly retentionHours: number;

    constructor(
        private readonly prisma: PrismaService,
        private readonly config: ConfigService,
    ) {
        this.retentionHours = this.resolveRetentionHours();

        const supabaseUrl =
            this.config.get<string>('SUPABASE_URL') ||
            this.config.get<string>('NEXT_PUBLIC_SUPABASE_URL');
        const serviceKey = this.config.get<string>('SUPABASE_SERVICE_KEY');

        if (!supabaseUrl || !serviceKey) {
            this.supabaseAdmin = null;
            this.logger.warn(
                'Unverified account cleanup disabled: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing.',
            );
            return;
        }

        this.supabaseAdmin = createClient(supabaseUrl, serviceKey, {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
            },
        });
    }

    private resolveRetentionHours(): number {
        const configured = Number(
            this.config.get<string>('UNVERIFIED_ACCOUNT_RETENTION_HOURS') ?? DEFAULT_RETENTION_HOURS,
        );

        if (!Number.isFinite(configured) || configured < MIN_RETENTION_HOURS) {
            return DEFAULT_RETENTION_HOURS;
        }

        return Math.floor(configured);
    }

    /** Runs once per day at 03:30 UTC. */
    @Cron('30 3 * * *')
    async handleCleanup(): Promise<void> {
        try {
            const result = await this.cleanup();
            this.logger.log(
                `Unverified account cleanup complete: scanned=${result.scanned}, deleted=${result.deleted}, ` +
                `reconciled=${result.reconciledVerified}, skipped=${result.skipped}, failed=${result.failed}`,
            );
        } catch (error: any) {
            this.logger.error(
                `Unverified account cleanup failed: ${error?.message || error}`,
                error?.stack,
            );
        }
    }

    async cleanup(now = new Date()): Promise<UnverifiedCleanupResult> {
        const result: UnverifiedCleanupResult = {
            scanned: 0,
            deleted: 0,
            reconciledVerified: 0,
            skipped: 0,
            failed: 0,
        };

        if (!this.supabaseAdmin) {
            return result;
        }

        const cutoff = new Date(now.getTime() - this.retentionHours * 60 * 60 * 1000);

        const candidates = await this.prisma.user.findMany({
            where: {
                isEmailVerified: false,
                deletedAt: null,
                createdAt: { lt: cutoff },
                role: { not: 'ADMIN' },
            },
            select: {
                id: true,
                email: true,
                createdAt: true,
            },
            orderBy: { createdAt: 'asc' },
            take: 250,
        });

        result.scanned = candidates.length;

        for (const candidate of candidates) {
            try {
                const { data, error } = await this.supabaseAdmin.auth.admin.getUserById(candidate.id);

                if (error || !data?.user) {
                    // Legacy/local-only accounts are deliberately left alone. We only
                    // auto-delete when Supabase Auth independently proves the signup
                    // exists and is still unconfirmed.
                    result.skipped += 1;
                    this.logger.warn(
                        `Skipping unverified local user ${candidate.id}: no matching Supabase Auth user.`,
                    );
                    continue;
                }

                const authUser = data.user;
                const authEmail = authUser.email?.toLowerCase().trim();
                const localEmail = candidate.email.toLowerCase().trim();

                if (!authEmail || authEmail !== localEmail) {
                    result.skipped += 1;
                    this.logger.warn(
                        `Skipping unverified user ${candidate.id}: local and Supabase emails do not match.`,
                    );
                    continue;
                }

                // Supabase is authoritative. If confirmation happened but the local
                // flag missed its sync, repair the flag and preserve the account.
                if (authUser.email_confirmed_at) {
                    await this.prisma.user.updateMany({
                        where: { id: candidate.id, isEmailVerified: false },
                        data: { isEmailVerified: true },
                    });
                    result.reconciledVerified += 1;
                    continue;
                }

                const authCreatedAt = new Date(authUser.created_at);
                if (Number.isNaN(authCreatedAt.getTime()) || authCreatedAt >= cutoff) {
                    result.skipped += 1;
                    continue;
                }

                const { error: deleteError } = await this.supabaseAdmin.auth.admin.deleteUser(
                    candidate.id,
                    false,
                );

                if (deleteError) {
                    result.failed += 1;
                    this.logger.error(
                        `Failed deleting stale unverified user ${candidate.id}: ${deleteError.message}`,
                    );
                    continue;
                }

                result.deleted += 1;
            } catch (error: any) {
                result.failed += 1;
                this.logger.error(
                    `Error processing stale unverified user ${candidate.id}: ${error?.message || error}`,
                    error?.stack,
                );
            }
        }

        return result;
    }
}
