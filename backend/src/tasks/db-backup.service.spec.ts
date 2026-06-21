import { Test, TestingModule } from '@nestjs/testing';

// Speculative import — will fail until Wave 2 creates this file (intended RED state)
// eslint-disable-next-line @typescript-eslint/no-var-requires
let DbBackupService: any;
let EmailService: any;

const mockEmailService = {
  sendBrandedEmail: jest.fn().mockResolvedValue(undefined),
};

const mockSupabaseStorage = {
  from: jest.fn().mockReturnThis(),
  upload: jest.fn().mockResolvedValue({ error: null }),
  list: jest.fn().mockResolvedValue({ data: [] }),
  remove: jest.fn().mockResolvedValue({ error: null }),
};

jest.mock('child_process', () => ({
  execSync: jest.fn().mockReturnValue(Buffer.from('-- SQL dump --')),
}));

jest.mock('zlib', () => ({
  gzipSync: jest.fn().mockReturnValue(Buffer.from('compressed')),
}));

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    storage: mockSupabaseStorage,
  })),
}));

describe('DbBackupService', () => {
  beforeAll(() => {
    try {
      DbBackupService = require('./db-backup.service').DbBackupService;
      EmailService = require('../email/email.service').EmailService;
    } catch {
      // File does not exist yet — tests will be skipped via conditional
      DbBackupService = null;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('BACKUP-01: handleWeeklyBackup calls pg_dump and uploads to Supabase Storage', async () => {
    if (!DbBackupService) throw new Error('DbBackupService not found — implement backend/src/tasks/db-backup.service.ts');
    const { execSync } = require('child_process');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbBackupService,
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();
    const service = module.get(DbBackupService);
    await service.handleWeeklyBackup();
    expect(execSync).toHaveBeenCalledWith(expect.stringContaining('pg_dump'), expect.any(Object));
    expect(mockSupabaseStorage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/db-backup-\d{4}-\d{2}-\d{2}\.sql\.gz/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/gzip' })
    );
  });

  it('BACKUP-02: handleWeeklyBackup calls sendBrandedEmail on pg_dump failure', async () => {
    if (!DbBackupService) throw new Error('DbBackupService not found — implement backend/src/tasks/db-backup.service.ts');
    const { execSync } = require('child_process');
    (execSync as jest.Mock).mockImplementationOnce(() => { throw new Error('pg_dump not found'); });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbBackupService,
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();
    const service = module.get(DbBackupService);
    await service.handleWeeklyBackup();
    expect(mockEmailService.sendBrandedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining('backup failed') })
    );
  });

  it('BACKUP-03: pruneOldBackups calls storage.list and removes files older than 30 days', async () => {
    if (!DbBackupService) throw new Error('DbBackupService not found — implement backend/src/tasks/db-backup.service.ts');
    const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const recentDate = new Date().toISOString();
    (mockSupabaseStorage.list as jest.Mock).mockResolvedValueOnce({
      data: [
        { name: 'db-backup-old.sql.gz', created_at: oldDate },
        { name: 'db-backup-recent.sql.gz', created_at: recentDate },
      ],
    });
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbBackupService,
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();
    const service = module.get(DbBackupService);
    await (service as any).pruneOldBackups({ storage: mockSupabaseStorage });
    expect(mockSupabaseStorage.remove).toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('db-backup-old.sql.gz')])
    );
    expect(mockSupabaseStorage.remove).not.toHaveBeenCalledWith(
      expect.arrayContaining([expect.stringContaining('db-backup-recent.sql.gz')])
    );
  });
});
