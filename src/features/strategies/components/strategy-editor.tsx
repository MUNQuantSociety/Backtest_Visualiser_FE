import { FileUp, Loader2, PencilLine } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent, type FormEvent } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { useSubmitStrategy } from '../strategies-api';
import { MAX_SOURCE_BYTES, strategySubmissionSchema } from '../types';

/**
 * Starter code, in MQSMaster's own idiom rather than generic pseudocode.
 *
 * A blank textarea makes the author guess the contract — which base class, what
 * `on_data` returns, where the tickers come from. This answers all three, and
 * it is the fastest way to teach the shape of a strategy to a new member.
 */
const TEMPLATE = `from mqs.base import BasePortfolio


class MyStrategy(BasePortfolio):
    """One sentence on what edge this is trying to capture."""

    TICKERS = ["AAPL", "MSFT", "NVDA"]
    INTERVAL = 60          # bar size in minutes
    LOOKBACK_DAYS = 90     # history loaded before the first bar

    def on_data(self, bars):
        """Called once per bar. Return target weights keyed by ticker.

        Weights should sum to <= 1.0; the remainder is held as cash.
        """
        weight = 1 / len(self.TICKERS)
        return {ticker: weight for ticker in self.TICKERS}
`;

const ACCEPTED_EXTENSIONS = ['.py'];

type Mode = 'write' | 'upload';

export function StrategyEditor() {
    const [mode, setMode] = useState<Mode>('write');
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [source, setSource] = useState(TEMPLATE);
    const [filename, setFilename] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const submit = useSubmitStrategy();

    const nameId = useId();
    const descriptionId = useId();
    const sourceId = useId();
    const errorId = useId();

    function handleFile(event: ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        if (!file) return;

        setError(null);

        if (!ACCEPTED_EXTENSIONS.some((extension) => file.name.toLowerCase().endsWith(extension))) {
            setError(`${file.name} is not a Python file. Strategies must be .py.`);
            return;
        }

        // Checked before reading, so an enormous file is rejected rather than
        // pulled into memory first.
        if (file.size > MAX_SOURCE_BYTES) {
            setError('That file is too large — strategies are capped at 256 KB.');
            return;
        }

        const reader = new FileReader();
        reader.onerror = () => {
            setError(`Could not read ${file.name}.`);
        };
        reader.onload = () => {
            setSource(typeof reader.result === 'string' ? reader.result : '');
            setFilename(file.name);
            // Uploading drops you into the editor rather than submitting blind, so
            // the author sees what is about to be sent under their name.
            setMode('write');
            if (!name) setName(file.name.replace(/\.py$/i, ''));
        };
        reader.readAsText(file);
    }

    function handleSubmit(event: FormEvent) {
        event.preventDefault();
        setError(null);

        const parsed = strategySubmissionSchema.safeParse({ name, description, source, filename });
        if (!parsed.success) {
            setError(parsed.error.issues[0]?.message ?? 'Check the form and try again.');
            return;
        }

        submit.mutate(parsed.data);
    }

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                    <label htmlFor={nameId} className="text-sm font-medium">
                        Strategy name
                    </label>
                    <input
                        id={nameId}
                        value={name}
                        onChange={(event) => {
                            setName(event.target.value);
                        }}
                        placeholder="Volatility Momentum"
                        className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
                    />
                </div>

                <div className="space-y-1.5">
                    <label htmlFor={descriptionId} className="text-sm font-medium">
                        Description <span className="text-muted-foreground">(optional)</span>
                    </label>
                    <input
                        id={descriptionId}
                        value={description}
                        onChange={(event) => {
                            setDescription(event.target.value);
                        }}
                        placeholder="What edge is this trying to capture?"
                        className="border-input bg-background focus-visible:ring-ring h-9 w-full rounded-md border px-3 text-sm outline-none focus-visible:ring-2"
                    />
                </div>
            </div>

            {/* Two ways in, one payload out — upload reads into the same editor. */}
            <div className="flex flex-wrap items-center gap-2">
                <div className="flex rounded-md border p-0.5">
                    <ModeTab
                        active={mode === 'write'}
                        onClick={() => {
                            setMode('write');
                        }}
                        icon={PencilLine}
                    >
                        Write code
                    </ModeTab>
                    <ModeTab
                        active={mode === 'upload'}
                        onClick={() => {
                            setMode('upload');
                        }}
                        icon={FileUp}
                    >
                        Upload file
                    </ModeTab>
                </div>

                {filename ? (
                    <span className="text-muted-foreground text-xs">
                        Loaded from <span className="font-mono">{filename}</span>
                    </span>
                ) : null}
            </div>

            {mode === 'write' ? (
                <div className="space-y-1.5">
                    <label htmlFor={sourceId} className="sr-only">
                        Strategy source code
                    </label>
                    <textarea
                        id={sourceId}
                        value={source}
                        onChange={(event) => {
                            setSource(event.target.value);
                            setFilename(null);
                        }}
                        spellCheck={false}
                        rows={20}
                        // Off by default in textareas, and mandatory for code.
                        className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-md border p-3 font-mono text-xs leading-relaxed whitespace-pre outline-none focus-visible:ring-2"
                    />
                </div>
            ) : (
                <div
                    onClick={() => fileInputRef.current?.click()}
                    className="hover:bg-accent/40 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed p-10 text-center transition-colors"
                >
                    <FileUp className="text-muted-foreground size-7" aria-hidden />
                    <p className="text-sm font-medium">Choose a .py file</p>
                    <p className="text-muted-foreground text-xs">
                        Up to 256 KB. It opens in the editor so you can check it before submitting.
                    </p>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".py,text/x-python"
                        onChange={handleFile}
                        className="sr-only"
                    />
                </div>
            )}

            {error ? (
                <p id={errorId} role="alert" className="text-sm text-[var(--loss)]">
                    {error}
                </p>
            ) : null}

            {submit.isSuccess ? (
                <p role="status" className="text-sm text-[var(--profit)]">
                    {submit.data.message || `Saved "${submit.data.name}".`}
                </p>
            ) : null}

            {submit.isError ? (
                <p role="alert" className="text-sm text-[var(--loss)]">
                    {submit.error.message}
                </p>
            ) : null}

            <div className="flex items-center gap-2">
                <Button type="submit" disabled={submit.isPending}>
                    {submit.isPending ? (
                        <Loader2 className="mr-2 size-4 animate-spin" aria-hidden />
                    ) : null}
                    Save strategy
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    onClick={() => {
                        setSource(TEMPLATE);
                        setFilename(null);
                        setError(null);
                    }}
                >
                    Reset to template
                </Button>
            </div>
        </form>
    );
}

function ModeTab({
    active,
    onClick,
    icon: Icon,
    children,
}: {
    active: boolean;
    onClick: () => void;
    icon: typeof FileUp;
    children: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-pressed={active}
            className={cn(
                'flex items-center gap-1.5 rounded px-3 py-1.5 text-sm transition-colors',
                active
                    ? 'bg-accent text-accent-foreground font-medium'
                    : 'text-muted-foreground hover:text-foreground',
            )}
        >
            <Icon className="size-4" aria-hidden />
            {children}
        </button>
    );
}
