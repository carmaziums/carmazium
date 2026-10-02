import { Test, TestingModule } from '@nestjs/testing';

// Speculative import — will fail until Wave 2 creates this file (intended RED state)
// eslint-disable-next-line @typescript-eslint/no-var-requires
let DbBackupService: any;
let EmailService: any;

const mockEmailService = {
  sendBrandedEmail: jest.fn().mockResolvedValue(undefined),
};

const mockSupabaseStorage = {
  listBuckets: jest.fn().mockResolvedValue({ data: [{ id: 'backups', public: false }], error: null }),
  from: jest.fn().mockReturnThis(),
  upload: jest.fn().mockResolvedValue({ error: null }),
  list: jest.fn().mockResolvedValue({ data: [] }),
  remove: jest.fn().mockResolvedValue({ error: null }),
};

jest.mock('child_process', () => ({
  execFileSync: jest.fn().mockReturnValue(Buffer.from('-- SQL dump --')),
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

  const previousDbUrl = process.env.DATABASE_URL;
  const previousBackupUrl = process.env.BACKUP_DATABASE_URL;
  const previousRequireBackupRole = process.env.REQUIRE_SEPARATE_BACKUP_ROLE;
  const previousSupabaseUrl = process.env.SUPABASE_URL;
  const previousSupabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const previousBackupEnabled = process.env.BACKUP_JOB_ENABLED;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabaseStorage.listBuckets.mockResolvedValue({ data: [{ id: 'backups', public: false }], error: null });
    process.env.SUPABASE_URL = 'https://synthetic-project.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'SYNTHETIC-ONLY-KEY';
    delete process.env.BACKUP_JOB_ENABLED;
    process.env.DATABASE_URL = 'postgresql://synthetic-user:synthetic-pass@synthetic-app.invalid/test';
    delete process.env.BACKUP_DATABASE_URL;
    delete process.env.REQUIRE_SEPARATE_BACKUP_ROLE;
  });

  afterAll(() => {
    if (previousDbUrl === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = previousDbUrl;
    if (previousBackupUrl === undefined) delete process.env.BACKUP_DATABASE_URL;
    else process.env.BACKUP_DATABASE_URL = previousBackupUrl;
    if (previousRequireBackupRole === undefined) delete process.env.REQUIRE_SEPARATE_BACKUP_ROLE;
    else process.env.REQUIRE_SEPARATE_BACKUP_ROLE = previousRequireBackupRole;
    if (previousSupabaseUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousSupabaseUrl;
    if (previousSupabaseServiceKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousSupabaseServiceKey;
    if (previousBackupEnabled === undefined) delete process.env.BACKUP_JOB_ENABLED;
    else process.env.BACKUP_JOB_ENABLED = previousBackupEnabled;
  });

  it('BACKUP-01: handleWeeklyBackup calls pg_dump and uploads to Supabase Storage', async () => {
    if (!DbBackupService) throw new Error('DbBackupService not found — implement backend/src/tasks/db-backup.service.ts');
    const { execFileSync } = require('child_process');
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DbBackupService,
        { provide: EmailService, useValue: mockEmailService },
      ],
    }).compile();
    const service = module.get(DbBackupService);
    await service.handleWeeklyBackup();
    expect(execFileSync).toHaveBeenCalledWith(
      'pg_dump',
      ['--format=plain'],
      expect.objectContaining({
        env: expect.objectContaining({
          PGHOST: 'synthetic-app.invalid',
          PGUSER: 'synthetic-user',
          PGDATABASE: 'test',
        }),
        stdio: ['ignore', 'pipe', 'pipe'],
      }),
    );
    expect(mockSupabaseStorage.upload).toHaveBeenCalledWith(
      expect.stringMatching(/db-backup-\d{4}-\d{2}-\d{2}\.sql\.gz/),
      expect.any(Buffer),
      expect.objectContaining({ contentType: 'application/gzip' })
    );
  });

  it('BACKUP-02: handleWeeklyBackup calls sendBrandedEmail on pg_dump failure', async () => {
    if (!DbBackupService) throw new Error('DbBackupService not found — implement backend/src/tasks/db-backup.service.ts');
    const { execFileSync } = require('child_process');
    (execFileSync as jest.Mock).mockImplementationOnce(() => { throw new Error('pg_dump not found'); });
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
  it('BACKUP-04: uses separately configured backup URI without placing secrets in the command arguments', async () => {
    process.env.BACKUP_DATABASE_URL = 'postgresql://synthetic-backup-user:synthetic-backup-pass@synthetic-backup-credential.invalid/test';
    process.env.REQUIRE_SEPARATE_BACKUP_ROLE = 'true';
    const { execFileSync } = require('child_process');
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbBackupService, { provide: EmailService, useValue: mockEmailService }],
    }).compile();
    await module.get(DbBackupService).handleWeeklyBackup();
    const args = (execFileSync as jest.Mock).mock.calls[0];
    expect(args[0]).toBe('pg_dump');
    expect(args[1]).toEqual(['--format=plain']);
    expect(args[2].env.PGHOST).toBe('synthetic-backup-credential.invalid');
    expect(args[2].env.PGDATABASE).toBe('test');
    expect(args[2].env.BACKUP_DATABASE_URL).toBeUndefined();
    expect(JSON.stringify(args[1])).not.toContain('synthetic-backup-credential');
  });

  it('BACKUP-05: refuses a restricted-role cutover if separate backup URL is missing', async () => {
    process.env.REQUIRE_SEPARATE_BACKUP_ROLE = 'true';
    const { execFileSync } = require('child_process');
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbBackupService, { provide: EmailService, useValue: mockEmailService }],
    }).compile();
    await module.get(DbBackupService).handleWeeklyBackup();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(mockEmailService.sendBrandedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: expect.stringContaining('backup failed'),
        bodyHtml: expect.stringContaining('Dedicated backup database connection not configured'),
      }),
    );
  });

  it('BACKUP-06: strips subprocess details from backup failure alerts', async () => {
    const { execFileSync } = require('child_process');
    (execFileSync as jest.Mock).mockImplementationOnce(
      () => { throw new Error('postgresql://super-secret-should-not-leak'); },
    );
    const module: TestingModule = await Test.createTestingModule({
      providers: [DbBackupService, { provide: EmailService, useValue: mockEmailService }],
    }).compile();
    await module.get(DbBackupService).handleWeeklyBackup();
    const sent = mockEmailService.sendBrandedEmail.mock.calls[0][0];
    expect(sent.bodyHtml).not.toContain('super-secret-should-not-leak');
    expect(sent.bodyHtml).toContain('investigate securely');
  });


  it('BACKUP-07: refuses to dump without private upload credentials', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { execFileSync } = require('child_process');
    const module = await Test.createTestingModule({
      providers: [DbBackupService, { provide: EmailService, useValue: mockEmailService }],
    }).compile();
    await module.get(DbBackupService).handleWeeklyBackup();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(mockSupabaseStorage.listBuckets).not.toHaveBeenCalled();
    expect(mockEmailService.sendBrandedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ bodyHtml: expect.stringContaining('Private backup upload credentials unavailable') }),
    );
  });

  it('BACKUP-08: refuses to dump when private backup bucket does not exist', async () => {
    mockSupabaseStorage.listBuckets.mockResolvedValueOnce({ data: [], error: null });
    const { execFileSync } = require('child_process');
    const module = await Test.createTestingModule({
      providers: [DbBackupService, { provide: EmailService, useValue: mockEmailService }],
    }).compile();
    await module.get(DbBackupService).handleWeeklyBackup();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(mockEmailService.sendBrandedEmail).toHaveBeenCalledWith(
      expect.objectContaining({ bodyHtml: expect.stringContaining('Private backup bucket unavailable') }),
    );
  });

  it('BACKUP-09: never uploads a backup into a public bucket with the right name', async () => {
    mockSupabaseStorage.listBuckets.mockResolvedValueOnce({
      data: [{ id: 'backups', public: true }], error: null,
    });
    const { execFileSync } = require('child_process');
    const module = await Test.createTestingModule({
      providers: [DbBackupService, { provide: EmailService, useValue: mockEmailService }],
    }).compile();
    await module.get(DbBackupService).handleWeeklyBackup();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(mockSupabaseStorage.upload).not.toHaveBeenCalled();
  });

  it('BACKUP-10: disables the legacy in-process cron only with explicit opt-out', async () => {
    process.env.BACKUP_JOB_ENABLED = 'false';
    const { execFileSync } = require('child_process');
    const module = await Test.createTestingModule({
      providers: [DbBackupService, { provide: EmailService, useValue: mockEmailService }],
    }).compile();
    await module.get(DbBackupService).handleWeeklyBackup();
    expect(execFileSync).not.toHaveBeenCalled();
    expect(mockSupabaseStorage.listBuckets).not.toHaveBeenCalled();
    expect(mockEmailService.sendBrandedEmail).not.toHaveBeenCalled();
  });

});
