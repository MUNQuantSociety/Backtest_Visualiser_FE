import { useState, type FormEvent } from 'react';
import { FaDiscord, FaGoogle } from 'react-icons/fa';
import {
  FiAlertCircle,
  FiLoader,
  FiLock,
  FiLogIn,
  FiMail,
} from 'react-icons/fi';
import { Link, Navigate } from 'react-router';

import { paths } from '@/app/paths';
import { useAuthCtx } from '@/app/providers/auth-provider.context';

import { apiLogin } from './api';

export default function LoginPage() {
  const { authState, login } = useAuthCtx();

  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (authState.isAuthenticated) {
    return <Navigate to={paths.dashboard} replace />;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) {
      return;
    }

    setErrorMsg('');

    const formData = new FormData(event.currentTarget);

    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
      setErrorMsg('Please enter your email and password.');
      return;
    }

    try {
      setIsLoading(true);

      const response = await apiLogin({
        email,
        password,
      });

      login(response.access);
    } catch (error) {
      if (error instanceof Error) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg('Unable to sign in. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleThirdPartyLogin(provider: 'discord' | 'google') {
    if (isLoading) {
      return;
    }

    // TODO: Connect third-party login flow.
    console.log(`Continue with ${provider}`);
  }

  async function registerWithDiscord() {
    if (isLoading) {
      return;
    }

  }

  function clearError() {
    if (errorMsg) {
      setErrorMsg('');
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0b0f12] px-4 text-white">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <div className="mb-2 text-lg font-semibold tracking-tight">
            MQS Backtest Engine
          </div>

          <p className="text-sm text-zinc-500">
            Sign in to continue to your dashboard.
          </p>
        </div>

        <section className="rounded-xl border border-white/[0.07] bg-[#111518] p-7 shadow-2xl shadow-black/20">
          <header className="mb-7">
            <h1 className="text-2xl font-semibold tracking-tight">
              Welcome back
            </h1>

            <p className="mt-2 text-sm text-zinc-500">
              Enter your details to sign in to your account.
            </p>
          </header>

          <form
            className="space-y-5"
            onSubmit={handleLogin}
            aria-busy={isLoading}
          >
            {/* Email */}
            <label className="block">
              <span className="mb-2 block text-sm font-medium text-zinc-300">
                Email
              </span>

              <div
                className={`
                  flex items-center gap-3 rounded-lg border bg-[#0c1013] px-3
                  transition-colors
                  ${
                    errorMsg
                      ? 'border-red-400/25'
                      : 'border-white/[0.08] focus-within:border-sky-400/35'
                  }
                  ${isLoading ? 'opacity-60' : ''}
                `}
              >
                <FiMail
                  className="shrink-0 text-zinc-500"
                  aria-hidden="true"
                />

                <input
                  type="email"
                  name="email"
                  placeholder="you@example.com"
                  autoComplete="email"
                  required
                  disabled={isLoading}
                  onChange={clearError}
                  aria-invalid={Boolean(errorMsg)}
                  className="
                    h-11 w-full bg-transparent text-sm text-zinc-200
                    outline-none placeholder:text-zinc-600
                    disabled:cursor-not-allowed
                    [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_#0c1013_inset]
                    [&:-webkit-autofill]:[-webkit-text-fill-color:#e4e4e7]
                  "
                />
              </div>
            </label>

            {/* Password */}
            <label className="block">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium text-zinc-300">
                  Password
                </span>

                <Link
                  to={paths.forgotPassword}
                  className="text-xs font-medium text-sky-300 transition-colors hover:text-sky-200"
                >
                  Forgot password?
                </Link>
              </div>

              <div
                className={`
                  flex items-center gap-3 rounded-lg border bg-[#0c1013] px-3
                  transition-colors
                  ${
                    errorMsg
                      ? 'border-red-400/25'
                      : 'border-white/[0.08] focus-within:border-sky-400/35'
                  }
                  ${isLoading ? 'opacity-60' : ''}
                `}
              >
                <FiLock
                  className="shrink-0 text-zinc-500"
                  aria-hidden="true"
                />

                <input
                  type="password"
                  name="password"
                  placeholder="Enter your password"
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  onChange={clearError}
                  aria-invalid={Boolean(errorMsg)}
                  className="
                    h-11 w-full bg-transparent text-sm text-zinc-200
                    outline-none placeholder:text-zinc-600
                    disabled:cursor-not-allowed
                    [&:-webkit-autofill]:[-webkit-box-shadow:0_0_0_1000px_#0c1013_inset]
                    [&:-webkit-autofill]:[-webkit-text-fill-color:#e4e4e7]
                  "
                />
              </div>
            </label>

            {/* Error */}
            <div aria-live="polite">
              {errorMsg && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-400/15 bg-red-400/[0.06] px-3 py-2.5 text-sm text-red-300"
                >
                  <FiAlertCircle
                    className="mt-0.5 shrink-0"
                    aria-hidden="true"
                  />

                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Login */}
            <button
              type="submit"
              disabled={isLoading}
              className="
                flex h-11 w-full items-center justify-center gap-2
                rounded-lg bg-[#8cc9ef] text-sm font-semibold text-[#091117]
                transition-colors
                hover:bg-[#a0d4f4]
                disabled:cursor-not-allowed disabled:opacity-60
                disabled:hover:bg-[#8cc9ef]
              "
            >
              {isLoading ? (
                <>
                  <FiLoader
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Signing in...
                </>
              ) : (
                <>
                  <FiLogIn aria-hidden="true" />
                  Sign in
                </>
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-4">
            <div className="h-px flex-1 bg-white/[0.07]" />

            <span className="text-xs text-zinc-600">
              OR CONTINUE WITH
            </span>

            <div className="h-px flex-1 bg-white/[0.07]" />
          </div>

          {/* Third-party login */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleThirdPartyLogin('discord')}
              className="
                flex h-11 items-center justify-center gap-2 rounded-lg
                border border-white/[0.08] bg-[#0c1013]
                text-sm font-medium text-zinc-300
                transition-colors
                hover:border-white/[0.14] hover:bg-[#151a1e]
                disabled:cursor-not-allowed disabled:opacity-50
                disabled:hover:border-white/[0.08]
                disabled:hover:bg-[#0c1013]
              "
            >
              <FaDiscord
                className="text-base"
                aria-hidden="true"
              />
              Discord
            </button>

            <button
              type="button"
              disabled={isLoading}
              onClick={() => handleThirdPartyLogin('google')}
              className="
                flex h-11 items-center justify-center gap-2 rounded-lg
                border border-white/[0.08] bg-[#0c1013]
                text-sm font-medium text-zinc-300
                transition-colors
                hover:border-white/[0.14] hover:bg-[#151a1e]
                disabled:cursor-not-allowed disabled:opacity-50
                disabled:hover:border-white/[0.08]
                disabled:hover:bg-[#0c1013]
              "
            >
              <FaGoogle
                className="text-sm"
                aria-hidden="true"
              />
              Google
            </button>
          </div>

          {/* Register */}
          <div className="mt-7 border-t border-white/[0.07] pt-6 text-center">
            <p className="text-sm text-zinc-500">
              Don&apos;t have an account?{' '}
              <button
                type="button"
                disabled={isLoading}
                onClick={registerWithDiscord}
                className="
                  font-medium text-sky-300 transition-colors
                  hover:text-sky-200
                  disabled:cursor-not-allowed disabled:opacity-50
                "
              >
                Register via Discord
              </button>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
