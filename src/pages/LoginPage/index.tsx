import { FaDiscord } from 'react-icons/fa';
import { FiLock, FiLogIn, FiMail } from 'react-icons/fi';
import './styles.css';
import { Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { useAuthCtx } from '@/app/providers/auth-provider.context';

// interface LoginCredentials {
//   email: string;
//   password: string;
// }

export default function LoginPage() {
    const { authState, login } = useAuthCtx();
    if (authState.isAuthenticated) {
        return <Navigate to={paths.dashboard} />;
    }
    function handleLogin(event: React.SubmitEvent<HTMLFormElement>) {
        event.preventDefault();
        login('access_token');

        // const formData = new FormData(event.currentTarget);
        //
        // const credentials: LoginCredentials = {
        //   email: String(formData.get("email") ?? ""),
        //   password: String(formData.get("password") ?? ""),
        // };

        // TODO: Connect to the login API.
        // if (ENV.DEBUG) {
        //   console.log("Login credentials:", credentials);
        // }
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
                            <FiMail aria-hidden="true" />

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
                            <FiLock aria-hidden="true" />

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
                        <FiLogIn aria-hidden="true" />
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
                        <FaDiscord aria-hidden="true" />
                        Register with Discord
                    </button>
                </div>
            </section>
        </main>
    );
}
