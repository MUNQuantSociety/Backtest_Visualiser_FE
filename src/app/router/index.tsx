import { lazy } from 'react';
import { createBrowserRouter } from 'react-router';

import { RootLayout } from '@/app/layouts/root-layout';

import { routePatterns } from './paths';

/**
 * Routes are lazy so each page ships as its own chunk — the detail page pulls
 * in lightweight-charts and Recharts, and the list view should not pay for them.
 */
const DashboardPage = lazy(async () => import('@/pages/dashboard-page'));
const BacktestsPage = lazy(async () => import('@/pages/backtests-page'));
const BacktestDetailPage = lazy(async () => import('@/pages/backtest-detail-page'));
const NotFoundPage = lazy(async () => import('@/pages/not-found-page'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: routePatterns.backtests, element: <BacktestsPage /> },
      { path: routePatterns.backtestDetail, element: <BacktestDetailPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
