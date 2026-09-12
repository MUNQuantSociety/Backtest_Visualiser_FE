import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';

import { SUBMISSIONS_CHANGED_EVENT, SUBMISSIONS_STORAGE_KEY } from './submissions';
import { useSubmissions } from './use-submissions';

/**
 * The `storage` event only fires on the documents that did *not* write, so a
 * tab has to be told about its own mutations another way. These cover that
 * path, and that both listeners are dropped on unmount.
 */

function installStorage(): void {
  const entries = new Map<string, string>();
  const storage: Storage = {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
    removeItem: (key: string) => {
      entries.delete(key);
    },
    clear: () => {
      entries.clear();
    },
    key: (index: number) => [...entries.keys()][index] ?? null,
    get length() {
      return entries.size;
    },
  };
  vi.stubGlobal('localStorage', storage);
}

beforeEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  installStorage();
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