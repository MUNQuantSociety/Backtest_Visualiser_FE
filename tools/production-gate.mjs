import { execFileSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export const REPOSITORY = 'MUNQuantSociety/Backtest_Visualiser_FE';

export function validateCommit(commit, branch, checkout) {
  // Amplify reports HEAD for rebuilds. Check the exact local SHA, not a previous pass.
  if (commit === 'HEAD') commit = checkout;
  if (!/^[0-9a-f]{40}$/.test(commit || '') || !['main', 'dev'].includes(branch)) {
    throw new Error('A full AWS_COMMIT_ID and a main/dev AWS_BRANCH are required.');
  }
  if (commit !== checkout) throw new Error('Deployment commit does not match the checkout.');
  return commit;
}

export function ciDecision(payload, commit, branch) {
  if (!Array.isArray(payload?.workflow_runs)) throw new Error('Invalid GitHub CI response.');
  const run = payload.workflow_runs
    .filter(
      (item) =>
        item.head_sha === commit &&
        item.head_branch === branch &&
        item.event === 'push' &&
        item.head_repository?.full_name === REPOSITORY &&
        item.path === '.github/workflows/ci.yml',
    )
    .sort((a, b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
  if (!run || run.status !== 'completed') return 'wait';
  if (run.conclusion !== 'success') {
    throw new Error(`Frontend CI rejected this commit (${run.conclusion}). ${run.html_url}`);
  }
  return 'success';
}

export async function waitForCI({
  commit,
  branch,
  checkout,
  fetcher = fetch,
  sleep = delay,
  attempts = 20,
}) {
  commit = validateCommit(commit, branch, checkout);
  const url = new URL(`https://api.github.com/repos/${REPOSITORY}/actions/workflows/ci.yml/runs`);
  url.search = new URLSearchParams({
    head_sha: commit,
    branch,
    event: 'push',
    per_page: '100',
  }).toString();
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const response = await fetcher(url, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok)
      throw new Error(
        `Cannot verify frontend CI: GitHub HTTP ${response.status}. Deployment blocked.`,
      );
    if (ciDecision(await response.json(), commit, branch) === 'success') {
      console.log(`Production gate passed: ${branch} ${commit} has successful frontend CI.`);
      return;
    }
    console.log(
      `Waiting for frontend CI for ${commit} (${attempt}/${attempts}). Nothing will deploy until it passes.`,
    );
    if (attempt < attempts) await sleep(60_000);
  }
  throw new Error(
    'Timed out waiting for frontend CI. Deployment blocked; retry after CI succeeds.',
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await waitForCI({
      commit: process.env.AWS_COMMIT_ID,
      branch: process.env.AWS_BRANCH,
      checkout: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
    });
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'CI verification failed.');
    process.exitCode = 1;
  }
}
