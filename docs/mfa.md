# Two-step verification (TOTP) — design P9

Status: code is dark. Nothing here changes behaviour until the flags below are
set and a human has done the Supabase steps.

## Flags

| Variable | Where | Default | Effect |
|---|---|---|---|
| `NEXT_PUBLIC_AUTH_MFA_ENABLED` | Vercel `login-portal`, build time | off | `/mfa/*` pages; challenge after password and Google sign-in, before OAuth consent, and before a password change, for users who have a verified factor |
| `AUTH_MFA_ATTEST_OAUTH` | Vercel `login-portal`, server only | off | After an approval made from an aal2 session, call `rc_attest_mfa_authorization()` so OAuth clients receive `aal: aal2`. Needs `supabase/mfa-oauth-attestation.sql` applied first |

Both must be exactly `true`. Changing either needs a redeploy.

## Pages

- `/mfa` — list authenticators, remove one (asks to confirm), add another.
- `/mfa/enroll` — name, QR code (Supabase returns an SVG data URL, allowed by
  the existing `img-src 'self' data:` CSP) plus the text secret, then verify.
  Clears abandoned unverified TOTP factors first.
- `/mfa/challenge?return_to=/portal/path` — enter a code. `return_to` stays
  portal-local (`safePortalPath`).
- `/mfa/recovery` — what to do without a code.

Supabase rules the pages follow: adding a second factor, removing a verified
factor, and changing the password all need an aal2 session, so those pages
challenge first. Verifying a new factor signs out the user's other sessions.

## The OAuth consent flow

`/oauth/consent` asks for the second factor **before** it calls
`getAuthorizationDetails`. That ordering matters: for a client the user has
already consented to, that call approves the request on the spot and hands back
the code, so a check placed after it would be too late. A failed factor lookup
sends the user to `/error` (fail closed). `/api/oauth/decision` repeats the
check for "approve" (not for "cancel").

## What the portal cannot guarantee, and why the hook exists

Checked against the Supabase Auth server source (`supabase/auth`, main at
`ce9a8eee`, 2026-09-22):

1. **OAuth tokens are always `aal1`.** `internal/api/oauthserver/handlers.go`
   exchanges the code by calling `IssueRefreshToken(..., models.OAuthProviderAuthorizationCode, ...)`:
   a brand-new session whose only AMR claim is
   `oauth_provider/authorization_code`. `Session.CalculateAALAndAMR` only
   counts TOTP, phone, WebAuthn and recovery-code claims as aal2. The portal
   session's aal is not carried over. So **without a hook, `aal` in tokens sent
   to the website, platform, ops and ERP clients is never `aal2`**, whatever the
   portal did.
2. **Consent does not check aal.** `POST /auth/v1/oauth/authorizations/{id}/consent`
   (and the auto-approve inside `GET .../authorizations/{id}`) only require an
   authenticated session. Someone holding a staff password could approve with
   an aal1 session by calling the API directly, skipping the portal's
   challenge. The portal's check is a user-facing gate, not a security
   boundary.

`supabase/mfa-oauth-attestation.sql` (not applied) closes both: the portal
records an attestation from its aal2 session; the custom access token hook
binds it to the new OAuth session at the code exchange and writes
`aal: aal2`; refreshes find it by `session_id`. The database function refuses
unless the caller's own JWT is aal2, so a direct API caller at aal1 cannot
attest. The hook elevates only when the authorization being exchanged is the
user's only live approved one for that client, so a racing aal1 approval cannot
borrow an aal2 attestation. Any hook error leaves the token at aal1 rather than
breaking sign-in for every app.

## Steps a human must do (Supabase dashboard, project rcsv-backend)

1. **Authentication → Multi-Factor → TOTP: enroll and verify enabled.** On the
   current platform TOTP is on by default; confirm it. Leave phone MFA off.
2. **Do not enable "Limit duration of AAL1 sessions"** (Auth → Sessions). The
   server computes OAuth sessions as aal1 before the hook runs, so it would cut
   every OAuth session of an enrolled user to that limit.
3. Review and run `supabase/mfa-oauth-attestation.sql` in the SQL editor.
4. **Authentication → Hooks → Customize Access Token (JWT) Claims:** Postgres,
   `public.rc_custom_access_token_hook`. This hook runs for every token in the
   project (website, ERP, OAuth clients); test on a branch or preview project
   first if one exists.
5. Set `NEXT_PUBLIC_AUTH_MFA_ENABLED=true` on a portal Preview, test, then
   Production; then `AUTH_MFA_ATTEST_OAUTH=true` once step 3 and 4 are done.
6. Staff enroll at `https://login.roboticscenter.ai/mfa/enroll` (ideally two
   authenticators each) **before** any downstream app turns enforcement on.

## Live tests required (cannot be settled from docs or source alone)

- [ ] Without the hook: an OAuth client token for a user who passed TOTP at the
      portal has `aal: aal1` and `amr: [oauth_provider/authorization_code]`
      (confirms finding 1 on the hosted version).
- [ ] With the hook: the same flow yields `aal: aal2`; a refresh keeps it; a
      new sign-in that skips the challenge (aal1 API approval) does not get it.
- [ ] The hook sees the exchanged `auth.oauth_authorizations` row as
      `approved` inside the token transaction (the binding depends on it).
- [ ] The hook is allowed to `UPDATE public.rc_mfa_oauth_attestations`
      (Supabase's examples only read).
- [ ] `rc_attest_mfa_authorization` returns 42501 for an aal1 session.

## Recovery (admin runbook)

Supabase TOTP has no self-service recovery codes in the client library this
portal uses. When a user loses every authenticator:

1. Verify identity on a second channel (call or chat with a known contact;
   for staff, their manager). Never on the strength of the email alone.
2. Dashboard → Authentication → Users → the user → remove the factor, or with
   the service role: `supabase.auth.admin.mfa.deleteFactor({ userId, id })`.
3. Ask them to sign in and enroll again, with a backup authenticator.
4. Note the reset in the audit log / ERP.
