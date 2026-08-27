import { AlertTriangle } from 'lucide-react';
import { Component, type ErrorInfo, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';

interface Props {
    children: ReactNode;
    /** Rendered instead of the default panel when provided. */
    fallback?: ReactNode;
    /** Hook for Sentry/logging. */
    onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
    error: Error | null;
}

/**
 * Error boundaries must be class components — React has no hook equivalent.
 * Wrap each route and each chart so one bad data shape cannot blank the app.
 */
export class ErrorBoundary extends Component<Props, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    override componentDidCatch(error: Error, info: ErrorInfo): void {
        this.props.onError?.(error, info);
        console.error('Uncaught render error:', error, info.componentStack);
    }

    private readonly reset = (): void => {
        this.setState({ error: null });
    };

    override render(): ReactNode {
        const { error } = this.state;
        if (!error) return this.props.children;
        if (this.props.fallback) return this.props.fallback;

        return (
            <div
                role="alert"
                className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center"
            >
                <AlertTriangle className="text-destructive size-8" aria-hidden />
                <div>
                    <p className="font-medium">Something went wrong</p>
                    <p className="text-muted-foreground mt-1 max-w-md text-sm">{error.message}</p>
                </div>
                <Button variant="outline" size="sm" onClick={this.reset}>
                    Try again
                </Button>
            </div>
        );
    }
}
