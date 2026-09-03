/**
 * Marks a panel whose numbers come from fixture data rather than the API.
 *
 * Several panels were built ahead of their endpoints. Without a visible mark
 * the demo figures are indistinguishable from real ones, and a plausible fake
 * RSI is exactly the kind of number someone acts on.
 */
export function DemoBadge({ reason = 'endpoint not built yet' }: { reason?: string | undefined }) {
  return (
    <span
      title={`Fixture data — ${reason}.`}
      className="tabular inline-flex items-center rounded border border-border px-1.5 py-0.5 text-[10px] font-medium tracking-[0.06em] text-muted-foreground uppercase"
    >
      Demo data
    </span>
  );
}
