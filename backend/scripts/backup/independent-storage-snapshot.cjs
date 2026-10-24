#!/usr/bin/env node
'use strict';

/**
 * OFFLINE release-held runner for independently encrypted Supabase Storage
 * snapshots. It does NOT belong in the NestJS runtime or any scheduled job.
 *
 * No automated or production transfer without all release/approval switches.
 * Source and destination are configured outside GitHub; never add keys here.
 */
const { spawnSync } = require('node:child_process');

const INVENTORY = Object.freeze([
  'admin-broadcasts',
  'auction-handover-documents',
  'chat-attachments',
  'dealer-kyc-documents',
  'listings',
  'sale-cancellation-evidence',
  'tradexchange-documents',
]);

function requireRemote(raw) {
  if (typeof raw !== 'string' || !/^[a-z][a-z0-9_-]{1,48}$/i.test(raw)) {
    throw new Error('REMOTE_CONFIGURATION_REQUIRED');
  }
  return raw;
}

function makePlan(env = process.env) {
  const source = requireRemote(env.CM_OFFSITE_SOURCE_REMOTE);
  const target = requireRemote(env.CM_OFFSITE_CRYPT_REMOTE);
  if (source.toLowerCase() === target.toLowerCase()) throw new Error('DESTINATION_MUST_BE_SEPARATE');
  const snapshot = env.CM_OFFSITE_SNAPSHOT || new Date().toISOString()
    .replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  if (!/^\d{8}T\d{6}Z$/.test(snapshot)) throw new Error('INVALID_SNAPSHOT');
  const mode = env.CM_OFFSITE_MODE || 'plan';
  if (!['plan', 'execute'].includes(mode)) throw new Error('INVALID_MODE');
  const allowed = mode === 'execute' &&
    env.CM_OFFSITE_OWNER_APPROVED === 'true' &&
    env.CM_OFFSITE_POSTPILOT_RELEASE_APPROVED === 'true' &&
    env.CM_OFFSITE_INDEPENDENT_DESTINATION_CONFIRMED === 'true';
  if (mode === 'execute' && !allowed) throw new Error('POSTPILOT_RELEASE_NOT_APPROVED');
  const actions = INVENTORY.flatMap((bucket) => {
    const from = source + ':' + bucket;
    const to = target + ':carmazium-storage/' + snapshot + '/' + bucket;
    return [
      ['copy', from, to, '--immutable', '--transfers', '3', '--checkers', '4'],
      ['check', from, to, '--one-way'],
    ];
  });
  return { mode, source, target, snapshot, actions, bucketCount: INVENTORY.length };
}

function execute(env = process.env, spawn = spawnSync, log = console.log) {
  const plan = makePlan(env);
  if (plan.mode === 'plan') {
    log('OFFSITE PLAN ONLY — no customer files read or copied; all seven bucket names included.');
    return { executed: false, bucketCount: plan.bucketCount, snapshot: plan.snapshot };
  }
  // Check encrypted destination *without printing* the rclone configuration;
  // source must be read-only and the target remote must be type=crypt.
  const cfg = spawn('rclone', ['config', 'show', plan.target], {
    encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (cfg.status !== 0 || !new RegExp('(^|\\n)\\s*type\\s*=\\s*crypt\\s*($|\\n)', 'm').test(cfg.stdout || '')) {
    throw new Error('ENCRYPTED_DESTINATION_NOT_VERIFIED');
  }
  let verified = 0;
  for (const args of plan.actions) {
    const result = spawn('rclone', args, {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (result.status !== 0) {
      // rclone output can contain local paths, remote descriptions or secret
      // metadata, so never relay stderr/stdout into ordinary logs.
      throw new Error(args[0] === 'copy' ? 'OFFSITE_COPY_FAILED' : 'OFFSITE_CHECK_FAILED');
    }
    if (args[0] === 'check') verified++;
  }
  log('Encrypted storage snapshot copy and remote consistency checks finished; isolated recovery drill remains mandatory.');
  return { executed: true, bucketCount: verified, snapshot: plan.snapshot };
}

if (require.main === module) {
  try { execute(); }
  catch (error) { console.error(error instanceof Error ? error.message : 'BACKUP_FAILED'); process.exitCode = 1; }
}

module.exports = { INVENTORY, makePlan, execute };
