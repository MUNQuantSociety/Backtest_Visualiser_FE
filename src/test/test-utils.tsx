import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';
import { type ReactElement, type ReactNode } from 'react';
import { MemoryRouter } from 'react-router';

/**
 * Renders a component with the providers it needs in production.
 *
 * Import `renderWithProviders` from here instead of Testing Library's bare
 * `render` — anything using a query hook or a <Link> needs this context.
 */

interface Options extends Omit<RenderOptions, 'wrapper'> {
    /** Initial history entries for MemoryRouter. */
    routes?: string[];
}

function createTestQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            // Retries would make a failure test wait through the backoff, and the
            // logger noise obscures real assertion failures.
            queries: { retry: false, gcTime: Number.POSITIVE_INFINITY },
            mutations: { retry: false },
        },
    });
}

export function renderWithProviders(ui: ReactElement, options: Options = {}): RenderResult {
    const { routes = ['/'], ...renderOptions } = options;
    const queryClient = createTestQueryClient();

    function Wrapper({ children }: { children: ReactNode }) {
        return (
            <QueryClientProvider client={queryClient}>
                <MemoryRouter initialEntries={routes}>{children}</MemoryRouter>
            </QueryClientProvider>
        );
    }

    return render(ui, { wrapper: Wrapper, ...renderOptions });
}

export * from '@testing-library/react';
export { default as userEvent } from '@testing-library/user-event';
