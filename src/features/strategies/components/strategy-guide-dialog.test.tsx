import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiClient } from '@/lib/api-client';
import type * as ApiClientModule from '@/lib/api-client';
import { act, renderWithProviders, screen, userEvent, waitFor, within } from '@/test/test-utils';

import { STARTER_TEMPLATE_FALLBACK } from '../starter-template';

import { StrategyGuideDialog, type StrategyGuideHandle } from './strategy-guide-dialog';

vi.mock('@/config/env', () => ({
  env: { apiBaseUrl: '/api', apiTimeout: 30_000, useFixtures: false, isDev: false, isProd: true },
}));
vi.mock('@/lib/api-client', async (importOriginal) => {
  const actual = await importOriginal<typeof ApiClientModule>();
  return { ...actual, apiClient: { ...actual.apiClient, get: vi.fn() } };
});

const get = vi.mocked(apiClient.get);
const SERVED_SOURCE = 'class ServedStrategy(BasePortfolio):\n    def OnData(self, context): ...';

function renderGuide() {
  const ref = createRef<StrategyGuideHandle>();
  renderWithProviders(<StrategyGuideDialog ref={ref} />);
  // jsdom has the element but not the browser's showModal/close methods.
  const dialog = document.querySelector('dialog')!;
  dialog.showModal = () => {
    dialog.open = true;
  };
  dialog.close = () => {
    dialog.open = false;
    dialog.dispatchEvent(new Event('close'));
  };
  return { ref, dialog };
}

beforeEach(() => {
  vi.clearAllMocks();
  get.mockImplementation((url) =>
    url === '/strategies/template'
      ? Promise.resolve({ filename: 'strategy.py', source: SERVED_SOURCE })
      : Promise.reject(new Error(`Unexpected request: ${url}`)),
  );
});

describe('StrategyGuideDialog', () => {
  it('fetches nothing until it is opened', () => {
    renderGuide();

    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByRole('navigation', { name: 'Guide contents' })).not.toBeInTheDocument();
  });

  it('opens on request with a contents list linking to every section', () => {
    const { ref, dialog } = renderGuide();

    act(() => {
      ref.current?.open();
    });

    expect(dialog.open).toBe(true);
    const contents = within(screen.getByRole('navigation', { name: 'Guide contents' }));
    for (const link of contents.getAllByRole('link')) {
      const target = link.getAttribute('href')!.slice(1);
      expect(document.getElementById(target)).not.toBeNull();
    }
    expect(contents.getAllByRole('link')).toHaveLength(12);
  });

  it('shows the starter strategy the backend serves', async () => {
    const { ref } = renderGuide();

    act(() => {
      ref.current?.open();
    });

    // The fallback shows first; the served file replaces it once fetched.
    await waitFor(() => {
      expect(screen.getByLabelText('Starter strategy')).toHaveTextContent(
        'class ServedStrategy(BasePortfolio)',
      );
    });
  });

  it('falls back to the built-in starter when the template cannot be fetched', () => {
    get.mockRejectedValue(new Error('Network Error'));
    const { ref } = renderGuide();

    act(() => {
      ref.current?.open();
    });

    expect(screen.getByLabelText('Starter strategy').textContent).toBe(STARTER_TEMPLATE_FALLBACK);
  });

  it('warns that sell() never opens a short', () => {
    const { ref } = renderGuide();

    act(() => {
      ref.current?.open();
    });

    expect(screen.getByText('It never opens a short.')).toBeInTheDocument();
  });

  it('closes from its close button', async () => {
    const { ref, dialog } = renderGuide();
    act(() => {
      ref.current?.open();
    });

    await userEvent.click(screen.getByRole('button', { name: 'Close guide' }));

    expect(dialog.open).toBe(false);
    expect(screen.queryByRole('navigation', { name: 'Guide contents' })).not.toBeInTheDocument();
  });
});
