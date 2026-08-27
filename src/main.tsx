import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';

import { AppProviders } from '@/app/providers';
import { router } from '@/app/router';

import './app/styles.css';

const container = document.getElementById('root');
if (!container) {
    throw new Error('Root element #root is missing from index.html');
}

createRoot(container).render(
    <StrictMode>
        <AppProviders>
            <RouterProvider router={router} />
        </AppProviders>
    </StrictMode>,
);
