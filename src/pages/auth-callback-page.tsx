import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';

import { paths } from '@/app/paths';
import { useAuthCtx } from '@/app/providers/auth-provider.context';

export default function AuthCallbackPage() {
  const { completeSignIn } = useAuthCtx();
  const navigate = useNavigate();
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let active = true;
    void completeSignIn()
      .then((returnTo) => {
        if (active) void navigate(returnTo, { replace: true });
      })
      .catch(() => {
        window.history.replaceState(window.history.state, '', paths.authCallback);
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [completeSignIn, navigate]);
  return (
    <main className="login-page">
      <section className="login-card">
        {failed ? (
          <>
            <h1>Sign-in could not be completed</h1>
            <p role="alert">Please start again from the sign-in page.</p>
            <Link to={paths.login}>Back to sign in</Link>
          </>
        ) : (
          <p role="status">Completing secure sign-in…</p>
        )}
      </section>
    </main>
  );
}
