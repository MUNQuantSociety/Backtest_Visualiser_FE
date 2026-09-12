import { type ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  description?: string | undefined;
  /** Right-aligned controls: filters, export buttons, etc. */
  actions?: ReactNode | undefined;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <header className="flex min-w-0 flex-wrap items-start justify-between gap-4 border-b pb-4 [overflow-wrap:anywhere]">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {actions ? (
        <div className="flex max-w-full min-w-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
