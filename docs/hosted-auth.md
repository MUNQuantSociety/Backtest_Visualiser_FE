# Hosted sign-in

The frontend uses a Cognito public app client through `oidc-client-ts`, with authorization code + S256 PKCE. Credentials, account creation, confirmation, and password recovery are handled by Cognito's managed sign-in page. The application does not collect passwords or accept a local sign-in marker as authentication.

Set these public build variables in Amplify, or in the ignored project-root `.env` for local development:

| Variable | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://api.munquantsociety.com/api` |
| `VITE_API_TIMEOUT` | `30000` milliseconds |
| `VITE_USE_FIXTURES` | `false` |
| `VITE_AUTH_AUTHORITY` | Cognito user-pool issuer URL |
| `VITE_AUTH_CLIENT_ID` | Public app-client ID, without a client secret |
| `VITE_AUTH_DOMAIN` | Cognito managed-login HTTPS origin |

The default callback is the frontend origin plus `/auth/callback`. Logout returns to that origin plus `/auth/login`. Register the exact hosted URLs and `http://localhost:5173/auth/callback` / `http://localhost:5173/auth/login` on the app client. Optional `VITE_AUTH_REDIRECT_URI` and `VITE_AUTH_LOGOUT_REDIRECT_URI` overrides must use those paths on the current frontend origin. Configure only the code grant and the `openid email profile` scopes. Hosting must rewrite deep links, including `/auth/callback`, to the SPA entry document. Build-time environment changes require a new frontend build.

OIDC transaction state and tokens are stored in `sessionStorage`, scoped to a browser tab. The library handles state, nonce, and PKCE checks. Requests renew an expiring access token using its refresh token; concurrent requests share a renewal. A rejected API token receives at most one refresh/retry. No iframe-based silent login is used. Logout clears local state, attempts refresh-token revocation, then uses Cognito's `/logout` endpoint with `client_id` and `logout_uri` to clear managed-login cookies.

Only access tokens go in `Authorization: Bearer` headers, limited to the configured API origin and path. ID tokens and the old development user ID are not production API credentials. After session restoration or callback processing, `/api/auth/me` must verify the token and return `{id, email, displayName}` before private pages render. The backend-generated `id` identifies the application account; nullable profile fields are accepted. The old temporary account's reports do not automatically belong to a new real account.

Each verified account gets a separate query cache. Logout, expiry, and account changes remove the old private UI and cancel/clear its cached requests. Tokens, authorization codes, and provider error details must not be logged or placed in Vite environment variables. As with any browser SPA, session storage is accessible to JavaScript running on this origin; maintain the application's XSS protections and keep the identity client dependency current.

Before release, verify hosted sign-in, callback success, reload on a private route, logout, expired-session recovery, and isolation between two accounts. Unit coverage also checks malformed callback state, off-origin header exclusion, retry bounds, and a previous account's late response.
