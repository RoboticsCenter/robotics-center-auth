# Robotics Center Auth

Standalone authentication frontend for the Robotics Center product family:

- [roboticscenter.ai](https://www.roboticscenter.ai)
- [platform.roboticscenter.ai](https://platform.roboticscenter.ai)
- [centeros.roboticscenter.ai](https://centeros.roboticscenter.ai)

## Current phase

The `codex/central-auth-integration` branch connects the portal UI to the same
Supabase Auth project as the website. It implements email/password sign in,
signup, Google, password recovery, password updates, server-side callbacks,
logout, and the Supabase OAuth 2.1 consent UI.

OAuth clients and callback destinations are deny-by-default. Configure the
server-only `AUTH_ALLOWED_OAUTH_CLIENTS` variable as an exact JSON map from each
client ID to its permitted callback URI array. Invalid maps deny all requests,
and a callback assigned to one client cannot be used by another client.
The only supported private-use callbacks are the exact CenterOS desktop URIs
`centeros://auth/callback` and `centeros-staging://auth/callback`. Map each URI
only to its environment-specific client ID.

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Routes

- `/` — sign in and sign up
- `/forgot-password` — password reset request with an allowlisted post-update return
- `/update-password` — password update, then a validated portal or first-party return
- `/launcher` — post-login application chooser
- `/error` — safe authentication error state
- `/auth/callback` — Supabase login/recovery callback
- `/oauth/consent` — first-party OAuth authorization screen
- `/logout` — global portal signout with allowlisted return

Sign-in, sign-up, Google, and OAuth consent `return_to` values remain restricted
to portal-local paths. Only password recovery may carry an absolute post-update
URL, and its origin must be listed in `AUTH_ALLOWED_RETURN_ORIGINS` (or be one
of the built-in Robotics Center website origins). The email callback always
returns to the portal's internal `/update-password` route first.

## Deployment boundary

Deploy this branch only as a Vercel Preview until the website Preview test
matrix passes. Do not move `login.roboticscenter.ai`, change the Supabase Site
URL, or enable this flow in the website Production environment during Preview
testing. Only the public Supabase URL and anon/publishable key belong in the
browser bundle; OAuth client secrets stay in the website's server-only Vercel
environment.

For a zero-downtime Preview migration, the previous
`AUTH_ALLOWED_OAUTH_CLIENT_IDS` and `AUTH_ALLOWED_OAUTH_REDIRECT_URIS` variables
remain compatible only when they contain exactly one client and one callback.
Multiple legacy entries deny all OAuth requests. Add
`AUTH_ALLOWED_OAUTH_CLIENTS` to the Preview branch scope and redeploy before
removing the legacy variables. Changing this map requires a redeploy because
its callback origins are also compiled into the portal's CSP `form-action`.
