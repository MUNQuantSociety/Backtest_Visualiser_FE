import { Lock, LogIn, Mail } from 'lucide-react';
import { Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { useAuthCtx } from '@/app/providers/auth-provider.context';

import './styles.css';

/**
 * Discord's wordless mark, inline.
 *
 * lucide-react carries no brand logos — it dropped them rather than track
 * every company's trademark guidelines — and this is the only brand glyph the
 * app needs. Pulling in a second icon package for one path would mean two
 * libraries answering the same question, which is the thing the icon choice
 * was made once to avoid. `currentColor` keeps it on the button's own colour,
 * and the sizing comes from `.login-button svg` like every other icon here.
 */
function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M20.317 4.3698a19.7913 19.7913 0 0 0-4.8851-1.5152.0741.0741 0 0 0-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 0 0-.0785-.037 19.7363 19.7363 0 0 0-4.8852 1.515.0699.0699 0 0 0-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 0 0 .0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 0 0 .0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 0 0-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 0 1-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 0 1 .0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 0 1 .0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 0 1-.0066.1276 12.2986 12.2986 0 0 1-1.873.8914.0766.0766 0 0 0-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 0 0 .0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 0 0 .0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 0 0-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export default function LoginPage() {
  const { authState, login } = useAuthCtx();
  if (authState.isAuthenticated) {
    return <Navigate to={paths.dashboard} replace />;
  }
  function handleLogin(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    // TODO: Replace local sign-in with a validated backend session.
    login();
  }

  function registerWithDiscord() {
    const state = crypto.randomUUID();

    /*
     * The callback page should compare the returned state
     * with this stored value.
     */
    sessionStorage.setItem('discord_register_state', state);

    const redirectUri = new URL(
      'adfasdfasf',
      // paths.DISCORD_CALLBACK,
      window.location.origin,
    ).toString();

    const searchParams = new URLSearchParams({
      response_type: 'code',
      // client_id: ENV.DISCORD_CLIENT_ID,
      client_id: 'adfadfasdfas',
      scope: 'identify guilds.join',
      state,
      redirect_uri: redirectUri,
      prompt: 'consent',
      integration_type: '0',
    });

    const authorizationUrl = `https://discord.com/oauth2/authorize?${searchParams.toString()}`;

    window.location.assign(authorizationUrl);
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <header className="login-card__header">
          <h1>Welcome back</h1>

          <p>Enter your details to sign in to your account.</p>
        </header>

        <form className="login-form" onSubmit={handleLogin}>
          <label className="login-field">
            <span>Email address</span>

            <div className="login-field__input">
              <Mail aria-hidden="true" />

              <input
                type="email"
                name="email"
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="login-field">
            <span>Password</span>

            <div className="login-field__input">
              <Lock aria-hidden="true" />

              <input
                type="password"
                name="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
              />
            </div>
          </label>

          <button type="submit" className="login-button login-button--primary">
            <LogIn aria-hidden="true" />
            Sign in
          </button>
        </form>

        <div className="login-divider">
          <span>New here?</span>
        </div>

        <div className="login-register">
          <p>Don&apos;t have an account?</p>

          <button
            type="button"
            className="login-button login-button--discord"
            onClick={registerWithDiscord}
          >
            <DiscordIcon />
            Register with Discord
          </button>
        </div>
      </section>
    </main>
  );
}
