import { PageHeader } from '@/components/common/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LIVE_REFETCH_MS } from '@/config/constants';
import { env } from '@/config/env';
import { useSetTheme, useTheme, type Theme } from '@/stores/ui-store';

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

/**
 * The prototype's Settings route was an empty file. What belongs here is the
 * handful of preferences the client actually owns — anything that changes how
 * the *engine* behaves is a config change in the trading repo, not a toggle in
 * a browser.
 */
export default function SettingsPage() {
  const theme = useTheme();
  const setTheme = useSetTheme();

  return (
    <>
      <PageHeader title="Settings" description="Client-side preferences and build information." />

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>
            Chart palettes follow this setting — both chart libraries resolve the same tokens.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {THEMES.map((option) => (
            <Button
              key={option.value}
              variant={option.value === theme ? 'secondary' : 'outline'}
              size="sm"
              aria-pressed={option.value === theme}
              onClick={() => {
                setTheme(option.value);
              }}
            >
              {option.label}
            </Button>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Connection</CardTitle>
          <CardDescription>
            Read-only. These come from build-time environment variables and are validated at startup
            by <code className="font-mono">src/config/env.ts</code>.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">API base URL</dt>
              <dd className="font-mono">{env.apiBaseUrl}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Request timeout</dt>
              <dd className="tabular font-mono">{env.apiTimeout} ms</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Live refresh interval</dt>
              <dd className="tabular font-mono">{LIVE_REFETCH_MS} ms</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Data source</dt>
              <dd>
                {env.useFixtures ? (
                  <Badge variant="destructive">Fixtures — not live data</Badge>
                ) : (
                  <Badge variant="secondary">Live API</Badge>
                )}
              </dd>
            </div>
          </dl>

          {env.useFixtures ? (
            <p className="mt-4 rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Every figure in the MQS Master views is generated demo data. Set{' '}
              <code className="font-mono">VITE_USE_FIXTURES=false</code> and point{' '}
              <code className="font-mono">DEV_API_PROXY_TARGET</code> at a running API to see real
              numbers.
            </p>
          ) : null}
        </CardContent>
      </Card>
    </>
  );
}
