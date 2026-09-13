import { Lock, LogIn, Mail, UserPlus } from 'lucide-react';
import { Navigate, useSearchParams } from 'react-router';

import { useAuthCtx } from '@/app/providers/auth-provider.context';
import { authIsConfigured, safeReturnPath } from '@/lib/auth-session';

import './styles.css';

export default function LoginPage() {
  const { authState, login } = useAuthCtx();
  const [search] = useSearchParams();
  const returnTo = safeReturnPath(search.get('returnTo'));
  const loading = authState.status === 'loading';
  const unavailable = loading || !authIsConfigured();
  if (authState.isAuthenticated) return <Navigate to={returnTo} replace />;
  return (
    <main className="login-page">
      <section className="login-card" aria-labelledby="login-title">
        <header className="login-card__header">
          <span className="login-card__brand">MQS · Backtest Visualiser</span>
          <h1 id="login-title">Welcome back</h1>
          <p>Sign in to your account to save strategies and view your backtests.</p>
        </header>
        {authState.error && (
          <p className="login-alert" role="alert">
            {authState.error}
          </p>
        )}
        <div className="login-form">
          <div className="login-method">
            <Mail aria-hidden="true" />
            <div>
              <strong>Sign in with your email</strong>
              <p>Enter your email and password on the secure sign-in page.</p>
            </div>
          </div>
          {loading ? (
            <p className="login-status" role="status">
              Checking your session…
            </p>
          ) : (
            <button
              className="login-button login-button--primary"
              type="button"
              disabled={unavailable}
              onClick={() => login(returnTo)}
            >
              <LogIn aria-hidden="true" /> Continue to secure sign-in
            </button>
          )}
          <button
            className="login-link"
            type="button"
            disabled={unavailable}
            aria-describedby="login-help"
            onClick={() => login(returnTo)}
          >
            Forgot your password?
          </button>
        </div>
        <div className="login-divider">
          <span>New here?</span>
        </div>
        <div className="login-register">
          <p>Don&apos;t have an account?</p>
          <button
            className="login-button login-button--register"
            type="button"
            disabled={unavailable}
            aria-describedby="login-help"
            onClick={() => login(returnTo)}
          >
            <UserPlus aria-hidden="true" /> Create an account
          </button>
        </div>
        <p className="login-note" id="login-help">
          <Lock aria-hidden="true" />
          Account creation and password recovery are available on the secure sign-in page.
        </p>
      </section>
    </main>
  );
}
