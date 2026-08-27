import { type ReactNode } from 'react';

interface PageHeaderProps {
    title: string;
    description?: string | undefined;
    /** Right-aligned controls: filters, export buttons, etc. */
    actions?: ReactNode | undefined;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
    return (
        <header className="flex flex-wrap items-start justify-between gap-4 border-b pb-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
                {description ? (
                    <p className="text-muted-foreground mt-1 text-sm">{description}</p>
                ) : null}
            </div>
            {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
        </header>
    );
}
