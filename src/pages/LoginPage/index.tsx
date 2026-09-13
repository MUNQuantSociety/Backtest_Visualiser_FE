import { Lock, LogIn } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router';

import { useAuthCtx } from '@/app/providers/auth-provider.context';
import { authIsConfigured, safeReturnPath } from '@/lib/auth-session';

import './styles.css';

export default function LoginPage() {
  const { authState, login } = useAuthCtx();
  const [search] = useSearchParams();
  const returnTo = safeReturnPath(search.get('returnTo'));
  if (authState.isAuthenticated) return <Navigate to={returnTo} replace />;
  return (
    <main className="login-page">
      <section className="login-card">
        <header className="login-card__header">
          <h1>Sign in to MQS</h1>
          <p>Use your account to save strategies and view your backtests.</p>
        </header>
        {authState.error && <p role="alert">{authState.error}</p>}
        {authState.status === 'loading' ? (
          <p role="status">Checking your session…</p>
        ) : (
          <button
            className="login-button"
            type="button"
            disabled={!authIsConfigured()}
            onClick={() => login(returnTo)}
          >
            <LogIn aria-hidden="true" /> Continue to secure sign-in
          </button>
        )}
        <p className="mt-5 text-sm text-muted-foreground">
          <Lock className="mr-1 inline size-4" aria-hidden="true" />
          Sign in, create an account, or reset your password on our secure sign-in page.
        </p>
      </section>
    </main>
  );
}
