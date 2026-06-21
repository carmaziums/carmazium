import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { createClient } from '@supabase/supabase-js';
import { execSync } from 'child_process';
import { gzipSync } from 'zlib';
import { EmailService } from '../email/email.service';

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
      // 1. Run pg_dump (DATABASE_URL is set on Fly.io at runtime)
      const dumpBuffer = execSync(`pg_dump "${process.env.DATABASE_URL}"`, {
        maxBuffer: 200 * 1024 * 1024, // 200 MB safety ceiling
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

      if (error) throw new Error(`Storage upload failed: ${error.message}`);

      // 4. Retention cleanup: delete files older than 30 days
      await this.pruneOldBackups(supabase);

      this.logger.log(`[DbBackup] Weekly backup complete: ${filename}`);
    } catch (err: any) {
      this.logger.error(`[DbBackup] FAILED: ${err.message}`);
      await this.emailService.sendBrandedEmail({
        to: process.env.ADMIN_BACKUP_EMAIL || 'airafadil619@gmail.com',
        subject: 'ALERT: CarMazium weekly DB backup failed',
        bodyHtml: `<p>The weekly database backup cron failed at ${new Date().toISOString()}.</p>
                   <p><strong>Error:</strong> ${err.message}</p>`,
      });
    }
  }

  async pruneOldBackups(supabase: ReturnType<typeof createClient>): Promise<void> {
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
