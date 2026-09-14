import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { installFakeStorage } from '@/test/fake-storage';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';

import { SUBMISSIONS_CHANGED_EVENT, SUBMISSIONS_STORAGE_KEY } from './submissions';
import { useSubmissions } from './use-submissions';

vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

/**
 * The `storage` event only fires on the documents that did *not* write, so a
 * tab has to be told about its own mutations another way. These cover that
 * path, and that both listeners are dropped on unmount.
 */

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.mocked(apiClient.get).mockRejectedValue(new Error('no registry in this test'));
  installFakeStorage();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function Probe({ label }: { label: string }) {
  const { records, remember } = useSubmissions();
  return (
    <div>
      <output data-testid={`records-${label}`}>
        {records.map((record) => record.strategyKey).join(',')}
      </output>
      <output data-testid={`outcomes-${label}`}>
        {records.map((record) => `${record.strategyKey}:${record.outcome}`).join(',')}
      </output>
      <button
        onClick={() =>
          remember({
            strategyKey: `strategy-${label}`,
            name: label,
            validationRunId: `run-${label}`,
          })
        }
      >
        remember {label}
      </button>
    </div>
  );
}

describe('useSubmissions same-tab sync', () => {
  it('refreshes every subscribed instance when one of them writes', async () => {
    renderWithProviders(
      <>
        <Probe label="a" />
        <Probe label="b" />
      </>,
    );

    await userEvent.click(screen.getByRole('button', { name: /remember a/i }));

    await waitFor(() => {
      expect(screen.getByTestId('records-b')).toHaveTextContent('strategy-a');
    });
    expect(screen.getByTestId('records-a')).toHaveTextContent('strategy-a');
  });

  it('still syncs from another tab through the storage event', async () => {
    renderWithProviders(<Probe label="a" />);

    localStorage.setItem(
      SUBMISSIONS_STORAGE_KEY,
      JSON.stringify([
        {
          strategyKey: 'strategy-other-tab',
          name: 'other tab',
          validationRunId: 'run-other',
          submittedAt: new Date().toISOString(),
          outcome: 'pending',
          errorMessage: null,
          acknowledged: false,
        },
      ]),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: SUBMISSIONS_STORAGE_KEY }));

    await waitFor(() => {
      expect(screen.getByTestId('records-a')).toHaveTextContent('strategy-other-tab');
    });
  });

  it('removes both listeners on unmount', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const { unmount } = renderWithProviders(<Probe label="a" />);

    unmount();

    const removedTypes = removeListener.mock.calls.map(([type]) => type);
    expect(removedTypes).toContain('storage');
    expect(removedTypes).toContain(SUBMISSIONS_CHANGED_EVENT);
  });
});

describe('useSubmissions outcome resolution', () => {
  function registryRow(validationState: string) {
    return {
      id: 'strategy-a',
      name: 'a',
      className: 'UserStrategy',
      description: '',
      status: 'draft',
      tags: ['user'],
      parameters: [],
      universe: ['AAPL'],
      runCount: 0,
      bestSharpe: null,
      bestReturn: null,
      lastRunAt: null,
      indicators: [],
      validationState,
      validationRunId: 'run-a',
    };
  }

  it('resolves an archived upload as failed instead of watching it forever', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(registryRow('archived'));
    renderWithProviders(<Probe label="a" />);

    await userEvent.click(screen.getByRole('button', { name: /remember a/i }));

    await waitFor(() => {
      expect(screen.getByTestId('outcomes-a')).toHaveTextContent('strategy-a:failed');
    });
  });

  it('resolves an active upload as passed', async () => {
    vi.mocked(apiClient.get).mockResolvedValue(registryRow('active'));
    renderWithProviders(<Probe label="a" />);

    await userEvent.click(screen.getByRole('button', { name: /remember a/i }));

    await waitFor(() => {
      expect(screen.getByTestId('outcomes-a')).toHaveTextContent('strategy-a:passed');
    });
  });
});
