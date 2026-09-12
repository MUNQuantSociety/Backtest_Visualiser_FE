import { CircleAlert, Pencil, Play, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';

import { paths } from '@/app/paths';

import { useDeleteStrategy } from '../strategies-api';
import type { Strategy } from '../types';
import { useSubmissions } from '../use-submissions';

import { StrategyMenu, StrategyMenuItem } from './strategy-menu';

/**
 * The three-dot menu on a strategy card.
 *
 * Everything here is an action the API can actually perform, which is why
 * there is no "rename" or "duplicate": the registry has no update endpoint,
 * only create and delete. Editing therefore means loading the saved source
 * into the editor and saving it as a new strategy — the editor says so — and
 * the old one is removed with Delete once the replacement passes.
 */
export function StrategyActions({
  strategy,
  onEdit,
  onRun,
}: {
  strategy: Strategy;
  onEdit: (strategy: Strategy) => void;
  onRun: (strategy: Strategy) => void;
}) {
  const navigate = useNavigate();
  const remove = useDeleteStrategy();
  const { forget } = useSubmissions();

  const validationRunId = strategy.validationRunId;
  // Built-ins were never uploaded, so there is no stored source to edit and
  // nothing of theirs to delete. The endpoints answer 404 either way; saying
  // so on a disabled item is better than a failed request.
  const uploaded = strategy.tags.includes('user');

  return (
    <StrategyMenu label={`Actions for ${strategy.name}`}>
      <StrategyMenuItem
        icon={<Pencil aria-hidden />}
        disabled={!uploaded}
        title={
          uploaded
            ? 'Open this strategy’s saved source in the editor'
            : 'Built-in strategies have no stored source to edit'
        }
        onSelect={() => {
          onEdit(strategy);
        }}
      >
        Edit source
      </StrategyMenuItem>

      <StrategyMenuItem
        icon={<Play aria-hidden />}
        disabled={strategy.status !== 'active'}
        title={
          strategy.status === 'active'
            ? undefined
            : 'Only a strategy that has passed validation can be run'
        }
        onSelect={() => {
          onRun(strategy);
        }}
      >
        Run backtest
      </StrategyMenuItem>

      <StrategyMenuItem
        icon={<CircleAlert aria-hidden />}
        disabled={!validationRunId}
        title={validationRunId ? undefined : 'No validation run was recorded for this strategy'}
        onSelect={() => {
          if (validationRunId) void navigate(paths.backtestDetail(validationRunId));
        }}
      >
        Open validation run
      </StrategyMenuItem>

      <div className="my-1 border-t" role="separator" />

      <StrategyMenuItem
        icon={<Trash2 aria-hidden />}
        tone="danger"
        disabled={!uploaded || remove.isPending}
        title={uploaded ? 'Remove this strategy and its stored source' : 'Built-ins cannot be removed'}
        onSelect={() => {
          // Confirmed before it happens: this deletes stored source that
          // exists nowhere else once it is gone. Its runs are kept.
          const confirmed = window.confirm(
            `Delete “${strategy.name}”?\n\nIts stored source is removed and cannot be recovered. Backtests already run with it are kept.`,
          );
          if (!confirmed) return;
          remove.mutate(strategy.id, {
            onSuccess: () => {
              // Also drop it from this browser's draft list, or the row would
              // linger with nothing behind it.
              forget(strategy.id);
            },
          });
        }}
      >
        {remove.isPending ? 'Deleting…' : 'Delete strategy'}
      </StrategyMenuItem>
    </StrategyMenu>
  );
}
