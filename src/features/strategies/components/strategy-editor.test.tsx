import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

import { StrategyEditor } from './strategy-editor';

/**
 * Pinned so the suite does not inherit the developer's `.env.local`: with
 * `VITE_USE_FIXTURES=true` the check short-circuits to the "nothing was
 * checked" answer and never makes a request.
 */
vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));

/** Stubbed at the transport, so the Zod parse stays inside the tested path. */
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, post: vi.fn() } };
});

const post = vi.mocked(apiClient.post);

beforeEach(() => {
  vi.resetAllMocks();
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

  it('lists every problem with its line, and does not submit anything', async () => {
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

    renderWithProviders(<StrategyEditor />);
    await clickCheck();

    expect(await screen.findByText(/not compatible/i)).toBeInTheDocument();
    expect(screen.getByText("importing 'os' is not allowed.")).toBeInTheDocument();
    expect(screen.getByText('MyStrategy.on_data should be spelled OnData.')).toBeInTheDocument();
    expect(screen.getByText('L1')).toBeInTheDocument();
    expect(screen.getByText('L12')).toBeInTheDocument();

    // One request, to the check endpoint. A failed check must not create a draft.
    expect(post).toHaveBeenCalledTimes(1);
    expect(post.mock.calls[0]?.[0]).toBe('/strategies/check');
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
