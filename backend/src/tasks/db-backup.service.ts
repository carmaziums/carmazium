import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createClient } from '@supabase/supabase-js';
import { execFileSync } from 'child_process';
import { gzipSync } from 'zlib';
import { EmailService } from '../email/email.service';
import { backupPgEnvironment } from './backup-connection';

@Injectable()
export class DbBackupService {
  private readonly logger = new Logger(DbBackupService.name);

  constructor(private readonly emailService: EmailService) {}

  // Every Sunday at 2 AM UTC
  @Cron('0 2 * * 0')
  async handleWeeklyBackup(): Promise<void> {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const filename = `db-backup-${date}.sql.gz`;

    try {
      // 1. Backups need a separately authorised, adequately privileged
      // connection BEFORE switching the application to a restricted DB login.
      // Preserve the legacy URL fallback until the cutover gate is enabled.
      const separateBackupUrl = process.env.BACKUP_DATABASE_URL;
      if (
        process.env.REQUIRE_SEPARATE_BACKUP_ROLE === 'true' &&
        !separateBackupUrl
      ) {
        throw new Error('BACKUP_ROLE_NOT_CONFIGURED');
      }
      const backupUrl = separateBackupUrl || process.env.DATABASE_URL;
      if (!backupUrl) {
        throw new Error('BACKUP_ROLE_NOT_CONFIGURED');
      }

      // Keep credentials out of command arguments, shell interpolation and
      // unrelated subprocess environment variables. PostgreSQL 17 pg_dump
      // receives only validated, supported libpq PG* connection parameters.
      const dumpBuffer = execFileSync('pg_dump', ['--format=plain'], {
        env: backupPgEnvironment(backupUrl),
        maxBuffer: 200 * 1024 * 1024, // 200 MB safety ceiling
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      // 2. gzip in-memory — avoids ephemeral disk writes (Fly.io restarts wipe disk)
      const compressed = gzipSync(dumpBuffer);

      // 3. Upload to private 'backups' bucket via service role key (bypasses RLS)
      const supabase = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!,
      );

      const { error } = await supabase.storage
        .from('backups')
        .upload(`backups/${filename}`, compressed, {
          contentType: 'application/gzip',
          upsert: false,
        });

      if (error) throw new Error('BACKUP_STORAGE_UPLOAD_FAILED');

      // 4. Retention cleanup: delete files older than 30 days
      await this.pruneOldBackups(supabase);

      this.logger.log(`[DbBackup] Weekly backup complete: ${filename}`);
    } catch (err: any) {
      // pg_dump/libpq failures may include network metadata; never echo
      // the exception's raw message (or a database URL) into logs or email.
      const diagnostic =
        err?.message === 'BACKUP_ROLE_NOT_CONFIGURED'
          ? 'Dedicated backup database connection not configured'
          : err?.message === 'BACKUP_STORAGE_UPLOAD_FAILED'
            ? 'Private storage upload failed'
            : 'Backup failed; investigate securely within the application host';
      this.logger.error(`[DbBackup] FAILED: ${diagnostic}`);
      await this.emailService.sendBrandedEmail({
        to: process.env.ADMIN_BACKUP_EMAIL || 'airafadil619@gmail.com',
        subject: 'ALERT: CarMazium weekly DB backup failed',
        bodyHtml: `<p>The weekly database backup cron failed at ${new Date().toISOString()}.</p>
                   <p><strong>Status:</strong> ${diagnostic}</p>`,
      });
    }
  }

  // `any` on purpose: supabase-js changed its client generics, so the instance
  // created above and ReturnType<typeof createClient> no longer unify. The
  // alternative is pinning a generic signature that breaks on the next bump.
  async pruneOldBackups(supabase: any): Promise<void> {
    const { data: files } = await supabase.storage
      .from('backups')
      .list('backups', { limit: 100 });

    if (!files) return;

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);

    const toDelete = files
      .filter((f: any) => new Date(f.created_at) < cutoff)
      .map((f: any) => `backups/${f.name}`);

    if (toDelete.length > 0) {
      await supabase.storage.from('backups').remove(toDelete);
      this.logger.log(`[DbBackup] Pruned ${toDelete.length} old backup(s)`);
    }
  }
}
