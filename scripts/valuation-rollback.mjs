#!/usr/bin/env node
/**
 * CarMazium 10-block valuation programme: whole-upgrade release and rollback.
 *
 * No destructive default. In particular, this NEVER force-resets main,
 * deletes historical data, deploys an application, or commits a revert.
 * A future release MUST be one squash commit; only then can ALL 10 blocks
 * be reverted together while preserving unrelated subsequent commits.
 *
 * Usage:
 *   node scripts/valuation-rollback.mjs --check-candidate --base-ref origin/main
 *   node scripts/valuation-rollback.mjs --verify-release <40-char-squash-SHA>
 *   git switch -c valuation-rollback/<release-short-SHA> origin/main
 *   node scripts/valuation-rollback.mjs --prepare-revert <40-char-squash-SHA>
 *
 * After prepare, run full tests and review the staged diff before creating
 * an audited rollback PR and redeploying its approved builds.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = path.join(root, 'backend/docs/valuation-release-manifest.json');

function die(message) {
    console.error('VALUATION RELEASE SAFETY GATE: ' + message);
    process.exit(2);
}

function git(args) {
    try {
        return execFileSync('git', args, {
            cwd: root, encoding: 'utf8',
            stdio: ['ignore', 'pipe', 'pipe'],
            maxBuffer: 4 * 1024 * 1024,
        }).trim();
    } catch (error) {
        die('git ' + args[0] + ' failed: '
            + String(error.stderr ?? error.message ?? 'unknown error').trim().slice(0, 500));
    }
}

function loadManifest() {
    if (!fs.existsSync(manifestPath)) die('the independent release manifest is missing');
    const m = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    const sha = m.preProgrammeSha;
    if (!/^[0-9a-f]{40}$/i.test(sha)) die('manifest baseline must be a full immutable SHA');
    if (m.releasePolicy?.mergeStrategy !== 'SINGLE_SQUASH_COMMIT_ONLY'
        || m.releasePolicy?.rollbackStrategy !== 'ONE_COMMIT_GIT_REVERT_ON_REVIEW_BRANCH') {
        die('unsafe or missing whole-programme release/rollback policy');
    }
    for (const field of ['allowedReleasePaths', 'expectedRuntimePaths', 'legacySourceAnchors']) {
        if (!Array.isArray(m[field]) || !m[field].length
            || new Set(m[field]).size !== m[field].length) {
            die('manifest has empty or duplicate ' + field);
        }
        if (m[field].some((p) =>
            typeof p !== 'string' || p.startsWith('/') || p.includes('..')
            || p.includes('\\') || p.includes('\n'))) {
            die('manifest contains invalid repository paths');
        }
    }
    for (const required of [...m.expectedRuntimePaths, ...m.legacySourceAnchors]) {
        if (!m.allowedReleasePaths.includes(required)) die('undeclared critical runtime path: ' + required);
    }
    return m;
}

function ancestor(a, b) {
    try {
        execFileSync('git', ['merge-base', '--is-ancestor', a, b],
            { cwd: root, stdio: 'ignore' });
        return true;
    } catch {
        return false;
    }
}

function listPaths(args) {
    const raw = execFileSync('git', [...args, '-z'],
        { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    return raw.split('\0').filter(Boolean);
}

function assertOnlyAllowed(changed, manifest) {
    const allowed = new Set(manifest.allowedReleasePaths);
    const unknown = changed.filter((name) => !allowed.has(name));
    if (unknown.length) {
        die('upgrade unexpectedly modifies files outside the ten-block release manifest: '
            + unknown.join(', '));
    }
    const missing = manifest.expectedRuntimePaths.filter((name) => !changed.includes(name));
    if (missing.length) die('upgrade is missing required runtime changes: ' + missing.join(', '));
}

function baselineBlob(commit, file) {
    return git(['rev-parse', commit + ':' + file]);
}

function assertLegacyUntouched(base, manifest) {
    for (const file of manifest.legacySourceAnchors) {
        if (baselineBlob(base, file) !== baselineBlob(manifest.preProgrammeSha, file)) {
            die('legacy ' + file + ' changed since the preserved programme baseline. '
                + 'Review/rebase the consolidated release; do not claim automatic exact rollback.');
        }
    }
}

function assertClean() {
    if (git(['status', '--porcelain', '--untracked-files=all'])) {
        die('working tree must be clean; commit or stash changes before preparing rollback');
    }
}

function checkCandidate(base, manifest) {
    const head = git(['rev-parse', 'HEAD']);
    const resolvedBase = git(['rev-parse', base]);
    if (!ancestor(manifest.preProgrammeSha, resolvedBase)) {
        die('the pre-programme baseline is not an ancestor of the current release target');
    }
    if (!ancestor(resolvedBase, head)) {
        die('candidate does not descend from the target main branch; rebase and rerun full CI');
    }
    assertLegacyUntouched(resolvedBase, manifest);
    const changed = listPaths(['diff', '--name-only', '--no-renames', resolvedBase, head]);
    assertOnlyAllowed(changed, manifest);
    console.log(JSON.stringify({
        status: 'CANDIDATE_VALID',
        baseline: manifest.preProgrammeSha,
        candidate: head,
        candidateChangedPaths: changed.length,
        mergePolicy: manifest.releasePolicy.mergeStrategy,
        securityReview: 'REQUIRED_BEFORE_MERGE',
        stagingValidation: 'REQUIRED_BEFORE_MERGE',
        productionDeploy: 'NOT_AUTHORIZED',
    }));
}

function verifyRelease(sha, manifest) {
    if (!/^[a-f0-9]{40}$/i.test(sha)) die('release must be a full 40-character squash-commit SHA');
    const parents = git(['rev-list', '--parents', '-n', '1', sha]).split(/\s+/);
    if (parents.length !== 2) {
        die('release was not one non-merge squash commit: a one-commit reversal is not verified');
    }
    const title = git(['show', '-s', '--format=%s', sha]);
    if (!title.startsWith(manifest.releaseTitlePrefix)) {
        die('release commit title does not prove it belongs to the approved ten-block bundle');
    }
    const parent = parents[1];
    if (!ancestor(manifest.preProgrammeSha, parent)) {
        die('the original system baseline is not an ancestor of this release');
    }
    assertLegacyUntouched(parent, manifest);
    const changed = listPaths(['diff-tree', '--no-commit-id', '--name-only', '-r', sha]);
    assertOnlyAllowed(changed, manifest);
    const head = git(['rev-parse', 'HEAD']);
    if (!ancestor(sha, head)) die('this release is not an ancestor of the current checkout');
    console.log(JSON.stringify({
        status: 'SINGLE_SQUASH_RELEASE_VERIFIED',
        release: sha, parent,
        touchedPaths: changed.length,
        originalBaseline: manifest.preProgrammeSha,
        originalValuationBlobsMatched: manifest.legacySourceAnchors.length,
    }));
    return { changed, parent };
}

function prepareRevert(sha, manifest) {
    assertClean();
    const branch = git(['branch', '--show-current']);
    if (!branch.startsWith('valuation-rollback/')) {
        die('run prepare-revert ONLY on a new valuation-rollback/<release> review branch; never main');
    }
    const verified = verifyRelease(sha, manifest);
    const later = listPaths([
        'diff', '--name-only', '--no-renames', sha, 'HEAD', '--', ...verified.changed,
    ]);
    if (later.length) {
        die('later commits touched valuation-release files: ' + later.join(', ')
            + '. Manual reconciliation required; do not automatically revert security fixes.');
    }
    // Equivalent to "git revert <release-squash-SHA>" but does NOT commit.
    // The rollback remains reviewable/testable in one staged patch.
    git(['revert', '--no-commit', sha]);
    for (const anchor of manifest.legacySourceAnchors) {
        const current = git(['hash-object', '--', anchor]);
        if (current !== baselineBlob(manifest.preProgrammeSha, anchor)) {
            die('rollback left original valuation source mismatched: ' + anchor
                + '. Do not commit or deploy until the difference is understood.');
        }
    }
    console.log(JSON.stringify({
        status: 'WHOLE_TEN_BLOCK_ROLLBACK_PREPARED_NOT_COMMITTED',
        release: sha,
        restoredLegacyAnchors: manifest.legacySourceAnchors.length,
        instruction: 'Review staged revert, run six CI suites plus rollback tests, '
            + 'open a rollback PR and deploy approved web/backend/native builds together.',
    }));
}

const [command, value, extra] = process.argv.slice(2);
const m = loadManifest();
if (command === '--check-candidate') {
    if (value !== '--base-ref' || !extra) die('usage: --check-candidate --base-ref origin/main');
    checkCandidate(extra, m);
} else if (command === '--verify-release') {
    verifyRelease(value ?? '', m);
} else if (command === '--prepare-revert') {
    prepareRevert(value ?? '', m);
} else {
    die('expected --check-candidate --base-ref <main>, --verify-release <sha>, '
        + 'or --prepare-revert <sha>');
}
