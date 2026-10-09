-- MFA attestation for OAuth-server tokens (design P9). NOT APPLIED.
-- Review, then run by a human in the rcsv-backend SQL editor, and register
-- public.rc_custom_access_token_hook under Authentication → Hooks →
-- Customize Access Token (JWT) Claims. See docs/mfa.md for why this exists
-- and the live tests that must pass before any app enforces aal2.
--
-- Why: Supabase's OAuth server mints a NEW session at the code exchange whose
-- only AMR entry is oauth_provider/authorization_code, so `aal` is always
-- aal1 in tokens issued to OAuth clients, even when the user passed TOTP at
-- the portal. And POST /oauth/authorizations/{id}/consent does not check aal,
-- so the portal's challenge alone cannot be trusted downstream.
--
-- How: the portal, from an aal2 session, calls rc_attest_mfa_authorization()
-- right after approving. At the code exchange the hook binds that attestation
-- to the new session and sets aal = aal2; on refresh it finds it by session.

create table if not exists public.rc_mfa_oauth_attestations (
  authorization_id text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  session_id uuid unique references auth.sessions (id) on delete cascade,
  bound_at timestamptz
);

alter table public.rc_mfa_oauth_attestations enable row level security;
revoke all on public.rc_mfa_oauth_attestations from anon, authenticated, public;
grant select, update on public.rc_mfa_oauth_attestations to supabase_auth_admin;
drop policy if exists rc_mfa_attestations_auth_admin on public.rc_mfa_oauth_attestations;
create policy rc_mfa_attestations_auth_admin on public.rc_mfa_oauth_attestations
  as permissive for all to supabase_auth_admin using (true) with check (true);

-- Called by the portal (anon key + the user's session) after an approval.
-- Refuses unless the caller's own token is aal2 and the authorization is the
-- caller's, approved and unexpired.
create or replace function public.rc_attest_mfa_authorization(p_authorization_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2' then
    raise exception 'aal2 session required' using errcode = '42501';
  end if;
  if not exists (
    select 1 from auth.oauth_authorizations a
     where a.authorization_id = p_authorization_id
       and a.user_id = auth.uid()
       and a.status = 'approved'
       and a.expires_at > now()
  ) then
    raise exception 'unknown authorization' using errcode = '42501';
  end if;
  insert into public.rc_mfa_oauth_attestations (authorization_id, user_id)
  values (p_authorization_id, auth.uid())
  on conflict (authorization_id) do nothing;
end;
$$;

revoke all on function public.rc_attest_mfa_authorization(text) from public, anon;
grant execute on function public.rc_attest_mfa_authorization(text) to authenticated;

-- Custom access token hook. If another hook (e.g. the D4 entitlement claims)
-- is added later, merge it into this one function: Supabase runs one hook.
create or replace function public.rc_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  claims jsonb := event -> 'claims';
  v_user uuid;
  v_session uuid;
  v_client uuid;
  v_candidates integer;
  v_attested boolean := false;
begin
  -- First-party portal/website sessions already carry their real aal.
  if claims is null
     or claims ->> 'aal' = 'aal2'
     or claims ->> 'client_id' is null
     or claims ->> 'session_id' is null then
    return event;
  end if;
  v_user := (event ->> 'user_id')::uuid;
  v_session := (claims ->> 'session_id')::uuid;
  v_client := (claims ->> 'client_id')::uuid;

  -- Refresh of a session bound at its code exchange.
  select true into v_attested
    from public.rc_mfa_oauth_attestations t
   where t.session_id = v_session and t.user_id = v_user;

  if not coalesce(v_attested, false)
     and event ->> 'authentication_method' = 'oauth_provider/authorization_code' then
    -- The authorization being exchanged is still 'approved' inside this
    -- transaction (it is deleted after the tokens are issued). Elevate only
    -- if it is the user's ONLY live approved authorization for this client:
    -- otherwise an aal1 approval racing an aal2 one could borrow its
    -- attestation. Ambiguity fails closed (token stays aal1).
    select count(*) into v_candidates
      from auth.oauth_authorizations a
     where a.user_id = v_user and a.client_id = v_client
       and a.status = 'approved' and a.expires_at > now();
    if v_candidates = 1 then
      update public.rc_mfa_oauth_attestations t
         set session_id = v_session, bound_at = now()
       where t.session_id is null
         and t.user_id = v_user
         and t.created_at > now() - interval '5 minutes'
         and t.authorization_id = (
           select a.authorization_id from auth.oauth_authorizations a
            where a.user_id = v_user and a.client_id = v_client
              and a.status = 'approved' and a.expires_at > now()
         )
      returning true into v_attested;
    end if;
  end if;

  if coalesce(v_attested, false) then
    event := jsonb_set(event, '{claims}', jsonb_set(claims, '{aal}', '"aal2"'));
  end if;
  return event;
exception when others then
  -- Never break sign-in for every app: on any error the token keeps aal1.
  return event;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.rc_custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.rc_custom_access_token_hook(jsonb) from authenticated, anon, public;
grant select on auth.oauth_authorizations to supabase_auth_admin;
