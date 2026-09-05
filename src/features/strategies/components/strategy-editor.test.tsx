import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';

import { StrategyEditor } from './strategy-editor';

/**
 * Pinned so the suite does not inherit the developer's `.env.local`: with
 * `VITE_USE_FIXTURES=true` the check short-circuits to the "nothing was
 * checked" answer and never makes a request.
 */
/*
 * `isDev` is mutable because the panel shows different things to a member and
 * to a developer, and both halves of that rule are worth pinning.
 */
/* `vi.hoisted` because `vi.mock` is lifted above ordinary declarations. */
const testEnv = vi.hoisted(() => ({
  apiBaseUrl: '/api',
  apiTimeout: 30_000,
  useFixtures: false,
  isDev: false,
  isProd: true,
}));

vi.mock('@/config/env', () => ({ env: testEnv }));

/** Stubbed at the transport, so the Zod parse stays inside the tested path. */
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn(), post: vi.fn() } };
});

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);

const SERVED_TEMPLATE = [
  'from engine.strategies.portfolio_BASE.strategy import BasePortfolio',
  '',
  '',
  'class ServedByTheBackend(BasePortfolio):',
  '    def OnData(self, context):',
  '        pass',
  '',
].join('\n');

beforeEach(() => {
  vi.resetAllMocks();
  testEnv.isDev = false;
  get.mockResolvedValue({ filename: 'strategy.py', source: SERVED_TEMPLATE });
});

async function clickCheck() {
  await userEvent.click(screen.getByRole('button', { name: /check compatibility/i }));
}

describe('StrategyEditor compatibility check', () => {
  it('sends the source to the check endpoint and reports a pass', async () => {
    post.mockResolvedValue({
      status: 'compatible',
      ok: true,
      className: 'MyStrategy',
      issues: [],
      warnings: [],
      message: 'MyStrategy is compatible with the engine.',
    });

    renderWithProviders(<StrategyEditor />);
    await clickCheck();

    // Anchored: "Check compatibility" and the message sentence both contain
    // the word, and only the panel's label is exactly it.
    expect(await screen.findByText(/^Compatible$/)).toBeInTheDocument();
    expect(screen.getByText('· MyStrategy')).toBeInTheDocument();

    const [url, body] = post.mock.calls[0] ?? [];
    expect(url).toBe('/strategies/check');
    // The template is what is in the box, and it is sent verbatim: no name or
    // description, because a check creates nothing.
    expect(body).toMatchObject({ filename: null });
    expect((body as { source: string }).source).toContain('def OnData(self, context');
  });

  function mockIncompatible() {
    post.mockResolvedValue({
      status: 'incompatible',
      ok: false,
      className: 'MyStrategy',
      issues: [
        { line: 1, message: "importing 'os' is not allowed." },
        { line: 12, message: 'MyStrategy.on_data should be spelled OnData.' },
      ],
      warnings: [],
      message: '2 problems to fix before this can run here.',
    });
  }

  it('gives a member the verdict and none of the diagnostics', async () => {
    mockIncompatible();

    renderWithProviders(<StrategyEditor />);
    await clickCheck();

    expect(await screen.findByText(/not compatible/i)).toBeInTheDocument();

    // The per-line detail names internals and reads as instructions. A member
    // who gets "not compatible" should ask a dev, not edit to satisfy a scanner.
    expect(screen.queryByText("importing 'os' is not allowed.")).not.toBeInTheDocument();
    expect(screen.queryByText('L1')).not.toBeInTheDocument();

    // One request, to the check endpoint. A failed check must not create a draft.
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toBe('/strategies/check');
  });

  it('gives a developer every problem with its line', async () => {
    testEnv.isDev = true;
    mockIncompatible();

    renderWithProviders(<StrategyEditor />);
    await clickCheck();

    expect(await screen.findByText(/not compatible/i)).toBeInTheDocument();
    expect(screen.getByText("importing 'os' is not allowed.")).toBeInTheDocument();
    expect(screen.getByText('MyStrategy.on_data should be spelled OnData.')).toBeInTheDocument();
    expect(screen.getByText('L1')).toBeInTheDocument();
    expect(screen.getByText('L12')).toBeInTheDocument();
  });

  it('shows a warning without calling the file incompatible', async () => {
    post.mockResolvedValue({
      status: 'compatible',
      ok: true,
      className: 'MyStrategy',
      issues: [],
      warnings: [{ line: 9, message: 'MyStrategy.__init__ never calls super().__init__(...).' }],
      message: 'MyStrategy is compatible with the engine. 1 warning worth reading.',
    });

    testEnv.isDev = true;
    renderWithProviders(<StrategyEditor />);
    await clickCheck();

    expect(await screen.findByText(/^Compatible$/)).toBeInTheDocument();
    expect(screen.getByText(/never calls super/)).toBeInTheDocument();
  });

  it('retires the verdict as soon as the source is edited', async () => {
    post.mockResolvedValue({
      status: 'compatible',
      ok: true,
      className: 'MyStrategy',
      issues: [],
      warnings: [],
      message: 'MyStrategy is compatible with the engine.',
    });

    renderWithProviders(<StrategyEditor />);
    await clickCheck();
    expect(await screen.findByText(/^Compatible$/)).toBeInTheDocument();

    // A green tick above code that has changed since it was checked is the one
    // way this could actively mislead someone.
    await userEvent.type(screen.getByLabelText(/strategy source code/i), '# edited');
    expect(screen.queryByText(/^Compatible$/)).not.toBeInTheDocument();
  });

  it('says the check could not run when the request fails', async () => {
    post.mockRejectedValue(new ApiError('Could not reach the server.', 0, 'NETWORK_ERROR'));

    renderWithProviders(<StrategyEditor />);
    await clickCheck();

    expect(await screen.findByText(/could not run/i)).toBeInTheDocument();
  });
});

describe('StrategyEditor starter code', () => {
  it('opens with the template the backend serves', async () => {
    renderWithProviders(<StrategyEditor />);

    const editor = await screen.findByLabelText(/strategy source code/i);
    await waitFor(() => {
      expect(editor).toHaveValue(SERVED_TEMPLATE);
    });
    expect(get).toHaveBeenCalledWith('/strategies/template');
  });

  it('falls back to the bundled copy when the request fails', async () => {
    // An empty editor is worse than a slightly stale example.
    get.mockRejectedValue(new ApiError('Could not reach the server.', 0, 'NETWORK_ERROR'));

    renderWithProviders(<StrategyEditor />);

    const editor = await screen.findByLabelText(/strategy source code/i);
    await waitFor(() => {
      expect((editor as HTMLTextAreaElement).value).toContain('def OnData(self, context');
    });
  });

  it('does not overwrite an edit when the template arrives late', async () => {
    let release: (value: unknown) => void = () => undefined;
    get.mockReturnValue(new Promise((resolve) => (release = resolve)));

    renderWithProviders(<StrategyEditor />);
    const editor = await screen.findByLabelText(/strategy source code/i);

    await userEvent.clear(editor);
    await userEvent.type(editor, '# mine');

    release({ filename: 'strategy.py', source: SERVED_TEMPLATE });
    await waitFor(() => {
      expect(get).toHaveBeenCalled();
    });

    // The whole reason the source is derived rather than synced in an effect.
    expect(editor).toHaveValue('# mine');
  });

  it('resets back to the served template, not the fallback', async () => {
    renderWithProviders(<StrategyEditor />);
    const editor = await screen.findByLabelText(/strategy source code/i);
    await waitFor(() => {
      expect(editor).toHaveValue(SERVED_TEMPLATE);
    });

    await userEvent.type(editor, '# scribble');
    await userEvent.click(screen.getByRole('button', { name: /reset to template/i }));

    expect(editor).toHaveValue(SERVED_TEMPLATE);
  });
});
