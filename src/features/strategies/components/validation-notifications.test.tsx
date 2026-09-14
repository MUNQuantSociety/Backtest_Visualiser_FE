import { act, cleanup } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { installFakeStorage } from '@/test/fake-storage';
import { renderWithProviders, screen, userEvent } from '@/test/test-utils';

import { rememberSubmission, resolveSubmission } from '../submissions';

import { PASSED_NOTICE_MS, ValidationNotifications } from './validation-notifications';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

/**
 * A pass is good news that needs no action, so its notice leaves on its own.
 * A failure is the only account of why the strategy cannot be run, so it
 * stays until the author dismisses it.
 */

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  installFakeStorage();
  vi.mocked(apiClient.get).mockRejectedValue(new Error('no registry in this test'));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function remembered(strategyKey: string, outcome: 'passed' | 'failed' | 'pending') {
  rememberSubmission({
    strategyKey,
    name: strategyKey,
    validationRunId: `run-${strategyKey}`,
    submittedAt: new Date().toISOString(),
  });
  if (outcome !== 'pending')
    resolveSubmission(strategyKey, outcome, outcome === 'failed' ? 'boom' : null);
}

describe('ValidationNotifications', () => {
  it('closes a passed notice on its own after a short while', async () => {
    remembered('user-a', 'passed');
    renderWithProviders(<ValidationNotifications />);
    expect(screen.getByRole('status')).toHaveTextContent('passed validation');

    // Halfway, not one tick short: `shouldAdvanceTime` also lets real time
    // move the fake clock, so a 1 ms margin is not a margin.
    await act(() => vi.advanceTimersByTimeAsync(PASSED_NOTICE_MS / 2));
    expect(screen.getByRole('status')).toBeInTheDocument();

    await act(() => vi.advanceTimersByTimeAsync(PASSED_NOTICE_MS / 2));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('keeps a failed notice until it is dismissed', async () => {
    remembered('user-a', 'failed');
    renderWithProviders(<ValidationNotifications />);

    await act(() => vi.advanceTimersByTimeAsync(PASSED_NOTICE_MS * 3));
    expect(screen.getByRole('alert')).toHaveTextContent('failed validation');

    await userEvent.click(screen.getByRole('button', { name: /dismiss the notice for user-a/i }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps a pending notice while the run is still going', async () => {
    remembered('user-a', 'pending');
    renderWithProviders(<ValidationNotifications />);

    await act(() => vi.advanceTimersByTimeAsync(PASSED_NOTICE_MS * 3));
    expect(screen.getByRole('status')).toHaveTextContent('Validating');
  });

  it('starts the clock when the notice turns from validating to passed', async () => {
    remembered('user-a', 'pending');
    renderWithProviders(<ValidationNotifications />);
    await act(() => vi.advanceTimersByTimeAsync(PASSED_NOTICE_MS * 3));

    // The store announces its own change on a later tick.
    await act(async () => {
      resolveSubmission('user-a', 'passed');
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(screen.getByRole('status')).toHaveTextContent('passed validation');

    await act(() => vi.advanceTimersByTimeAsync(PASSED_NOTICE_MS));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
