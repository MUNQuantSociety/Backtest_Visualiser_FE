import assert from 'node:assert/strict';
import { test } from 'node:test';

import { ciDecision, REPOSITORY, validateCommit, waitForCI } from './production-gate.mjs';

const commit = 'a'.repeat(40);
const run = {
  head_sha: commit,
  head_branch: 'main',
  event: 'push',
  head_repository: { full_name: REPOSITORY },
  path: '.github/workflows/ci.yml',
  run_number: 1,
  run_attempt: 1,
  status: 'completed',
  conclusion: 'success',
};
const payload = (...runs) => ({ workflow_runs: runs });

test('only the exact checkout and deployment branch may be checked', () => {
  assert.doesNotThrow(() => validateCommit(commit, 'main', commit));
  assert.equal(validateCommit('HEAD', 'main', commit), commit);
  for (const [sha, branch, checkout] of [
    [undefined, 'main', commit],
    ['HEAD', 'main', 'HEAD'],
    [commit, 'feature', commit],
    [commit, 'main', 'b'.repeat(40)],
  ]) {
    assert.throws(() => validateCommit(sha, branch, checkout));
  }
});

test('only a successful push of the exact SHA, repository, branch and workflow passes', () => {
  assert.equal(ciDecision(payload(run), commit, 'main'), 'success');
  for (const changes of [
    { head_sha: 'b'.repeat(40) },
    { head_branch: 'dev' },
    { event: 'pull_request' },
    { head_repository: { full_name: 'fork/repo' } },
    { path: '.github/workflows/other.yml' },
  ]) {
    assert.equal(ciDecision(payload({ ...run, ...changes }), commit, 'main'), 'wait');
  }
});

test('failed, cancelled, skipped and newer reruns cannot inherit an earlier success', () => {
  for (const conclusion of ['failure', 'cancelled', 'skipped', 'timed_out', null]) {
    assert.throws(() =>
      ciDecision(payload(run, { ...run, run_attempt: 2, conclusion }), commit, 'main'),
    );
  }
  assert.equal(
    ciDecision(payload(run, { ...run, run_attempt: 2, status: 'in_progress' }), commit, 'main'),
    'wait',
  );
  assert.equal(ciDecision(payload(), commit, 'main'), 'wait');
  assert.throws(() => ciDecision({}, commit, 'main'));
});

test('unavailable CI, no run, and timeout fail closed', async () => {
  const options = { commit, branch: 'main', checkout: commit, attempts: 1, sleep: async () => {} };
  await assert.rejects(
    waitForCI({ ...options, fetcher: async () => ({ ok: false, status: 403 }) }),
    /Deployment blocked/,
  );
  await assert.rejects(
    waitForCI({ ...options, fetcher: async () => ({ ok: true, json: async () => payload() }) }),
    /Timed out/,
  );
});

test('queued CI is polled until this exact run succeeds', async () => {
  let requests = 0;
  await waitForCI({
    commit,
    branch: 'main',
    checkout: commit,
    attempts: 2,
    sleep: async () => {},
    fetcher: async () => ({
      ok: true,
      json: async () => payload({ ...run, status: ++requests === 1 ? 'queued' : 'completed' }),
    }),
  });
  assert.equal(requests, 2);
});
