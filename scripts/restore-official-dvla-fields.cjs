'use strict';
const { isDeepStrictEqual } = require('node:util');

// Owner-approved one-off repair. No AI, MOT-history guesses, or seller-field replacements.
const STATUSES = ['ACTIVE', 'PENDING_REVIEW', 'DRAFT'];
const CORE_FIELDS = ['make', 'year', 'color', 'engineSize', 'fuelType', 'co2Emissions',
  'markedForExport', 'motStatus', 'motExpiryDate', 'taxStatus', 'taxDueDate',
  'monthOfFirstRegistration', 'dateOfLastV5CIssued', 'wheelplan', 'typeApproval'];
const TEXT_FIELDS = ['make', 'color', 'motStatus', 'motExpiryDate', 'taxStatus', 'taxDueDate',
  'monthOfFirstRegistration', 'dateOfLastV5CIssued', 'wheelplan', 'typeApproval', 'firstUsedDate'];
const missing = v => v == null || (typeof v === 'string' && v.trim() === '');
const norm = v => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const plain = v => v != null && typeof v === 'object' && !Array.isArray(v);

function mergeMissing(current, official) {
  if (!plain(official)) return current;
  if (!missing(current) && !plain(current)) return current;
  const merged = { ...(plain(current) ? current : {}) };
  for (const [key, value] of Object.entries(official)) {
    if (['__proto__', 'constructor', 'prototype'].includes(key)) continue;
    if (plain(value)) merged[key] = mergeMissing(merged[key], value);
    else if (missing(merged[key]) && !missing(value)) merged[key] = value;
  }
  return merged;
}

function buildPatch(listing, official) {
  if (listing.deletedAt || !STATUSES.includes(listing.status)) return { reason: 'lifecycle' };
  const vrm = norm(listing.vrm);
  if (!/^[A-Z0-9]{2,7}$/.test(vrm)) return { reason: 'invalid_registration' };
  if (official?.dataSource !== 'DVLA' || norm(official.vrm) !== vrm || !official.make
    || (!missing(listing.make) && norm(listing.make) !== norm(official.make))
    || (listing.year && official.year && Math.abs(listing.year - official.year) > 2)) {
    return { reason: 'identity_mismatch' };
  }
  const values = { ...official, color: official.colour };
  const patch = {};
  for (const field of TEXT_FIELDS) {
    const value = values[field];
    if (missing(listing[field]) && typeof value === 'string' && value.trim() && value.length <= 100) patch[field] = value;
  }
  for (const field of ['year', 'engineSize', 'co2Emissions']) {
    const value = values[field];
    if (listing[field] == null && Number.isInteger(value) && value >= (field === 'co2Emissions' ? 0 : 1)
      && (field !== 'year' || (value >= 1900 && value <= 2035))) patch[field] = value;
  }
  const fuelTypes = ['PETROL', 'DIESEL', 'HYBRID', 'ELECTRIC', 'LPG', 'PLUGIN_HYBRID',
    'HYDROGEN_CELL', 'BI_FUEL', 'NATURAL_GAS', 'PETROL_HYBRID', 'DIESEL_HYBRID',
    'PETROL_PLUGIN_HYBRID', 'DIESEL_PLUGIN_HYBRID', 'UNLISTED'];
  if (listing.fuelType == null && fuelTypes.includes(official.fuelType)) patch.fuelType = official.fuelType;
  if (listing.euroStandard == null && ['EURO_4','EURO_5','EURO_6','EURO_6D'].includes(official.euroStandard)) patch.euroStandard = official.euroStandard;
  if (listing.markedForExport == null && typeof official.markedForExport === 'boolean') patch.markedForExport = official.markedForExport;
  const supplementary = mergeMissing(listing.officialVehicleData, official.officialVehicleData);
  if (supplementary && JSON.stringify(supplementary) !== JSON.stringify(listing.officialVehicleData)) patch.officialVehicleData = supplementary;
  return { patch };
}

function guardedWhere(listing) {
  return { id: listing.id, updatedAt: listing.updatedAt, deletedAt: null,
    status: listing.status, vrm: listing.vrm, make: listing.make, year: listing.year };
}

async function runBatch(input) {
  if (input.apply && Date.now() > Date.parse('2026-11-09T00:00:00Z')) throw new Error('One-off repair authorization window expired');
  const { createRequire } = require('node:module');
  const appRequire = createRequire('/app/package.json');
  const { Logger } = appRequire('@nestjs/common');
  Logger.overrideLogger(false); // No registrations or raw upstream errors in public CI output.
  const { PrismaClient } = appRequire('@prisma/client');
  const { ConfigService } = appRequire('@nestjs/config');
  const { DvlaService } = appRequire('/app/dist/dvla/dvla.service.js');
  const databaseUrl = new URL(process.env.DATABASE_URL);
  if (!(databaseUrl.hostname + decodeURIComponent(databaseUrl.username)).includes('bwtnzmevjlowwronylxm')) throw new Error('Unexpected database; repair stopped');
  if (!process.env.DVLA_API_KEY) throw new Error('DVLA access unavailable');
  const config = new ConfigService();
  const dvla = new DvlaService(config, {});
  if (dvla.baseUrl !== 'https://driver-vehicle-licensing.api.gov.uk/vehicle-enquiry/v1/vehicles') throw new Error('Unexpected DVLA endpoint');
  if (typeof dvla.dvlaWithRetry !== 'function') throw new Error('DVLA implementation changed; review required');
  const prisma = new PrismaClient({ log: [] });
  const report = { visited: 0, lookedUp: 0, changed: 0, verified: 0, noNewData: 0,
    invalidRegistration: 0, identityMismatch: 0, lookupFailure: 0, concurrentEdit: 0,
    verificationConflict: 0, fieldCounts: {}, statusCounts: {}, cursor: input.cursor || null, done: false };
  const started = Date.now();
  try {
    const or = CORE_FIELDS.flatMap(field => TEXT_FIELDS.includes(field) ? [{ [field]: null }, { [field]: '' }] : [{ [field]: null }]);
    const rows = await prisma.listing.findMany({
      where: { deletedAt: null, status: { in: STATUSES }, createdAt: { lte: new Date(input.cutoff) },
        ...(input.cursor ? { id: { gt: input.cursor } } : {}), OR: or },
      orderBy: { id: 'asc' }, take: 20,
      select: Object.fromEntries(['id', 'vrm', 'status', 'deletedAt', 'updatedAt', ...CORE_FIELDS,
        'firstUsedDate', 'euroStandard', 'officialVehicleData'].map(key => [key, true])),
    });
    const cache = new Map();
    for (const row of rows) {
      if (Date.now() - started > 25000) break;
      const vrm = norm(row.vrm);
      report.visited++;
      report.cursor = row.id;
      if (!/^[A-Z0-9]{2,7}$/.test(vrm)) { report.invalidRegistration++; continue; }
      let official;
      try {
        if (cache.has(vrm)) official = cache.get(vrm);
        else {
          // Reuse deployed DVLA parsing/retry logic; do not invoke the unavailable MOT service or AI.
          official = await dvla.dvlaWithRetry(vrm);
          cache.set(vrm, official);
          report.lookedUp++;
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch { report.lookupFailure++; continue; }
      const result = buildPatch(row, official);
      if (result.reason) { report.identityMismatch++; continue; }
      if (!Object.keys(result.patch).length) { report.noNewData++; continue; }
      if (input.apply) {
        const saved = await prisma.listing.updateMany({ where: guardedWhere(row), data: result.patch });
        if (!saved.count) { report.concurrentEdit++; continue; }
        const fresh = await prisma.listing.findUnique({ where: { id: row.id }, select: Object.fromEntries(Object.keys(result.patch).map(key => [key, true])) });
        if (fresh && Object.entries(result.patch).every(([k, v]) => isDeepStrictEqual(fresh[k], v))) report.verified++;
        else report.verificationConflict++;
      }
      report.changed++;
      report.statusCounts[row.status] = (report.statusCounts[row.status] || 0) + 1;
      for (const key of Object.keys(result.patch)) report.fieldCounts[key] = (report.fieldCounts[key] || 0) + 1;
    }
    report.done = rows.length < 20 && report.visited === rows.length;
    return report;
  } finally { await prisma.$disconnect(); }
}

module.exports = { buildPatch, guardedWhere, mergeMissing, runBatch };
