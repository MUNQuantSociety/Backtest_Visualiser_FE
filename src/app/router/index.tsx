import { createBrowserRouter } from 'react-router';

import { RootLayout } from '@/app/root-layout';
import LoginPage from '@/pages/LoginPage';

import { paths } from '../paths';

/** Route patterns as react-router expects them (with `:params`). */
export const routePatterns = {
    dashboard: '/',
    backtests: '/backtests',
    backtestDetail: '/backtests/:backtestId',
    strategies: '/strategies',
    compare: '/compare',
    login: '/login',

    live: '/live',
    portfolios: '/live/portfolios',
    portfolioDetail: '/live/portfolios/:portfolioId',
    log: '/live/log',
    settings: '/live/settings',
} as const;

export const router = createBrowserRouter([
    {
        path: '/',
        element: <RootLayout />,
        children: [
            {
                index: true,
                lazy: async () => {
                    const DashboardPage = await import('@/pages/dashboard-page');
                    return { Component: DashboardPage.default };
                },
            },
            {
                path: routePatterns.backtests,
                lazy: async () => {
                    const BacktestsPage = await import('@/pages/backtests-page');
                    return { Component: BacktestsPage.default };
                },
            },
            {
                path: routePatterns.backtestDetail,
                lazy: async () => {
                    const BacktestDetailPage = await import('@/pages/backtest-detail-page');
                    return { Component: BacktestDetailPage.default };
                },
            },
            {
                path: routePatterns.compare,
                lazy: async () => {
                    const ComparePage = await import('@/pages/compare-page');
                    return { Component: ComparePage.default };
                },
            },
            {
                path: routePatterns.strategies,
                lazy: async () => {
                    const StrategiesPage = await import('@/pages/strategies-page');
                    return { Component: StrategiesPage.default };
                },
            },
            {
                path: routePatterns.live,
                lazy: async () => {
                    const LiveOverviewPage = await import('@/pages/live-overview-page');
                    return { Component: LiveOverviewPage.default };
                },
            },
            {
                path: routePatterns.portfolios,
                lazy: async () => {
                    const PortfoliosPage = await import('@/pages/portfolios-page');
                    return { Component: PortfoliosPage.default };
                },
            },
            {
                path: routePatterns.portfolioDetail,
                lazy: async () => {
                    const PortfolioDetailsPage = await import('@/pages/portfolio-detail-page');
                    return { Component: PortfolioDetailsPage.default };
                },
            },
            {
                path: routePatterns.log,
                lazy: async () => {
                    const LogPage = await import('@/pages/log-page');
                    return { Component: LogPage.default };
                },
            },
            {
                path: routePatterns.settings,
                lazy: async () => {
                    const SettingsPage = await import('@/pages/settings-page');
                    return { Component: SettingsPage.default };
                },
            },
        ],
    },
    {
        path: '*',
        lazy: async () => {
            const NotFoundPage = await import('@/pages/not-found-page');
            return { Component: NotFoundPage.default };
        },
    },
    {
        path: paths.login,
        element: <LoginPage />,
    },
]);
