#!/usr/bin/env node
/**
 * This test creates only disposable, local Git repos. It proves that one
 * squash-release revert restores ORIGINAL valuation sources without losing
 * unrelated post-release development. No remote or production writes.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const cliSource = fs.readFileSync(
    path.join(path.dirname(fileURLToPath(import.meta.url)), 'valuation-rollback.mjs'),
    'utf8',
);
const originalPath = 'backend/src/listings/vehicle-valuation.ts';
const manifestPath = 'backend/docs/valuation-release-manifest.json';
const scriptPath = 'scripts/valuation-rollback.mjs';

function git(repo, ...args) {
    return execFileSync('git', args, {
        cwd: repo, encoding: 'utf8',
        env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
    }).trim();
}
function write(repo, file, content) {
    const dest = path.join(repo, file);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, content);
}
function cli(repo, ...args) {
    return spawnSync(process.execPath, [path.join(repo, scriptPath), ...args], {
        cwd: repo, encoding: 'utf8',
    });
}
function loadFixture() {
    const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'carmazium-rollback-'));
    git(repo, 'init', '-b', 'main');
    git(repo, 'config', 'user.email', 'ci-valuation@example.invalid');
    git(repo, 'config', 'user.name', 'Valuation Rollback CI');
    write(repo, originalPath, 'export const valuationMethod = "LEGACY";\n');
    write(repo, 'README.md', 'Unrelated pre-programme application readme\n');
    git(repo, 'add', '.');
    git(repo, 'commit', '-m', 'Legacy application baseline');
    const baseline = git(repo, 'rev-parse', 'HEAD');
    const manifest = {
        preProgrammeSha: baseline,
        releaseTitlePrefix: 'CarMazium valuation release blocks 1-10',
        expectedRuntimePaths: [originalPath],
        legacySourceAnchors: [originalPath],
        allowedReleasePaths: [originalPath, manifestPath, scriptPath],
        releasePolicy: {
            mergeStrategy: 'SINGLE_SQUASH_COMMIT_ONLY',
            rollbackStrategy: 'ONE_COMMIT_GIT_REVERT_ON_REVIEW_BRANCH',
        },
    };
    const close = () => fs.rmSync(repo, { recursive: true, force: true });
    return { repo, baseline, manifest, close };
}
function addCandidateFiles(fixture) {
    const { repo, manifest } = fixture;
    write(repo, originalPath, 'export const valuationMethod = "ALL_TEN_BLOCKS";\n');
    write(repo, scriptPath, cliSource);
    write(repo, manifestPath, JSON.stringify(manifest, null, 2) + '\n');
}

test('entire ten-block programme is one validated release with reviewable exact legacy rollback', () => {
    const fixture = loadFixture();
    try {
        const { repo, baseline } = fixture;
        git(repo, 'switch', '-c', 'valuation-release-proposal');
        addCandidateFiles(fixture);
        git(repo, 'add', '.');
        git(repo, 'commit', '-m', 'Candidate all 10 blocks');
        const candidate = cli(repo, '--check-candidate', '--base-ref', 'main');
        assert.equal(candidate.status, 0, candidate.stderr);
        assert.match(candidate.stdout, /CANDIDATE_VALID/);

        // Future release manager makes ONE squash merge. This synthetic
        // single commit is exactly that target history shape.
        git(repo, 'reset', '--soft', baseline);
        git(repo, 'commit', '-m', 'CarMazium valuation release blocks 1-10: all changes in one commit');
        const release = git(repo, 'rev-parse', 'HEAD');
        git(repo, 'switch', 'main');
        git(repo, 'merge', '--ff-only', 'valuation-release-proposal');

        // User continues unrelated development after release.
        write(repo, 'README.md', 'Unrelated subsequent application fixes must survive\n');
        git(repo, 'add', 'README.md');
        git(repo, 'commit', '-m', 'Important unrelated post-release work');

        const verified = cli(repo, '--verify-release', release);
        assert.equal(verified.status, 0, verified.stderr);
        assert.match(verified.stdout, /SINGLE_SQUASH_RELEASE_VERIFIED/);

        // This operation is intentionally rejected on main.
        const unsafe = cli(repo, '--prepare-revert', release);
        assert.notEqual(unsafe.status, 0);
        assert.match(unsafe.stderr, /review branch/);
        assert.equal(fs.readFileSync(path.join(repo, originalPath), 'utf8'),
            'export const valuationMethod = "ALL_TEN_BLOCKS";\n');

        git(repo, 'switch', '-c', 'valuation-rollback/' + release.slice(0, 8));
        const rollback = cli(repo, '--prepare-revert', release);
        assert.equal(rollback.status, 0, rollback.stderr);
        assert.match(rollback.stdout, /WHOLE_TEN_BLOCK_ROLLBACK_PREPARED_NOT_COMMITTED/);
        assert.equal(fs.readFileSync(path.join(repo, originalPath), 'utf8'),
            'export const valuationMethod = "LEGACY";\n');
        assert.equal(fs.readFileSync(path.join(repo, 'README.md'), 'utf8'),
            'Unrelated subsequent application fixes must survive\n');
        const staged = git(repo, 'diff', '--cached', '--name-only');
        assert.match(staged, /vehicle-valuation.ts/);
        git(repo, 'commit', '-m', 'Controlled single-commit valuation rollback');
        assert.equal(git(repo, 'rev-parse', 'HEAD:' + originalPath),
            git(repo, 'rev-parse', baseline + ':' + originalPath));
        assert.equal(fs.readFileSync(path.join(repo, 'README.md'), 'utf8'),
            'Unrelated subsequent application fixes must survive\n');
    } finally {
        fixture.close();
    }
});

test('release guard rejects unmanifested side-effects; no accidental broad system rollback', () => {
    const fixture = loadFixture();
    try {
        const { repo } = fixture;
        git(repo, 'switch', '-c', 'valuation-release-proposal');
        addCandidateFiles(fixture);
        write(repo, 'README.md', 'Unexpectedly changed unrelated application code\n');
        git(repo, 'add', '.');
        git(repo, 'commit', '-m', 'Mixed release that should be rejected');
        const result = cli(repo, '--check-candidate', '--base-ref', 'main');
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /outside the ten-block release manifest/);
    } finally {
        fixture.close();
    }
});

test('rollback refuses to touch valuation files changed independently since release', () => {
    const fixture = loadFixture();
    try {
        const { repo, baseline } = fixture;
        addCandidateFiles(fixture);
        git(repo, 'add', '.');
        git(repo, 'commit', '-m', 'CarMazium valuation release blocks 1-10: all changes in one commit');
        const release = git(repo, 'rev-parse', 'HEAD');
        write(repo, originalPath, 'export const valuationMethod = "SECURITY_HARDENED_LATER";\n');
        git(repo, 'add', '.');
        git(repo, 'commit', '-m', 'Important post-release valuation security changes');
        git(repo, 'switch', '-c', 'valuation-rollback/' + release.slice(0, 8));
        const guarded = cli(repo, '--prepare-revert', release);
        assert.notEqual(guarded.status, 0);
        assert.match(guarded.stderr, /later commits touched valuation-release files/);
        assert.equal(git(repo, 'rev-parse', baseline + ':' + originalPath) !==
            git(repo, 'rev-parse', 'HEAD:' + originalPath), true);
        assert.equal(git(repo, 'status', '--porcelain'), '');
    } finally {
        fixture.close();
    }
});

test('non-squash merge releases cannot be advertised as automatically reversible', () => {
    const fixture = loadFixture();
    try {
        const { repo } = fixture;
        addCandidateFiles(fixture);
        git(repo, 'add', '.');
        git(repo, 'commit', '-m', 'CarMazium valuation release blocks 1-10: first non-squashed commit');
        git(repo, 'switch', '-c', 'unrelated');
        write(repo, 'unrelated.txt', 'unrelated branch update\n');
        git(repo, 'add', '.');
        git(repo, 'commit', '-m', 'Unrelated branch update');
        git(repo, 'switch', 'main');
        write(repo, 'README.md', 'Other main activity\n');
        git(repo, 'add', '.');
        git(repo, 'commit', '-m', 'Other main activity');
        git(repo, 'merge', '--no-ff', '-m',
            'CarMazium valuation release blocks 1-10: unsafe merge', 'unrelated');
        const result = cli(repo, '--verify-release', git(repo, 'rev-parse', 'HEAD'));
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /not one non-merge squash commit/);
    } finally {
        fixture.close();
    }
});

console.log('Whole-system rollback safety test suite defined; assertions run by node --test.');
