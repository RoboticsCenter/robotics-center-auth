import { safePortalPath } from "./redirects.ts";

/**
 * TOTP two-step verification (design P9). Off unless
 * NEXT_PUBLIC_AUTH_MFA_ENABLED is exactly "true" (inlined at build time, so
 * flipping it needs a redeploy). While off, /mfa/* 404s and sign-in, consent
 * and password updates behave exactly as before.
 *
 * The portal can only *ask* for the second factor: Supabase's consent endpoint
 * does not itself require aal2, and tokens issued by its OAuth server start a
 * new session whose `aal` is always aal1. Downstream apps that require MFA
 * therefore rely on the custom access token hook in docs/mfa.md, which reads
 * the attestation this portal records after an aal2 approval
 * (AUTH_MFA_ATTEST_OAUTH, server-only, default off).
 */
export function isMfaEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_MFA_ENABLED?.trim() === "true";
}

export function isOAuthAttestationEnabled(): boolean {
  return (
    isMfaEnabled() && process.env.AUTH_MFA_ATTEST_OAUTH?.trim() === "true"
  );
}

export type MfaFactor = {
  id: string;
  friendlyName: string;
  factorType: string;
  createdAt: string;
};

type RawFactor = {
  id: string;
  status: string;
  factor_type: string;
  friendly_name?: string | null;
  created_at?: string;
};

export type MfaAuthClient = {
  auth: {
    mfa: {
      listFactors(): Promise<{
        data: { all: RawFactor[] } | null;
        error: unknown;
      }>;
    };
  };
};

export type MfaStatus = {
  verified: MfaFactor[];
  unverifiedTotpIds: string[];
};

function toFactor(factor: RawFactor): MfaFactor {
  return {
    id: factor.id,
    friendlyName: factor.friendly_name?.trim() || "Authenticator app",
    factorType: factor.factor_type,
    createdAt: factor.created_at ?? "",
  };
}

/**
 * The user's factors, read from the Auth server (getUser) rather than the
 * session cookie, so a factor added or removed in another browser counts.
 * Throws when the lookup fails: callers must not treat "unknown" as "none".
 */
export async function readMfaStatus(
  supabase: MfaAuthClient,
): Promise<MfaStatus> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error || !data) throw new Error("Could not read two-step factors");
  return {
    verified: data.all
      .filter((factor) => factor.status === "verified")
      .map(toFactor),
    unverifiedTotpIds: data.all
      .filter(
        (factor) =>
          factor.status !== "verified" && factor.factor_type === "totp",
      )
      .map((factor) => factor.id),
  };
}

/** True when the session is aal1 but the user has a verified factor. */
export function needsMfaChallenge(
  claims: { aal?: unknown } | null | undefined,
  status: MfaStatus,
): boolean {
  return claims?.aal !== "aal2" && status.verified.length > 0;
}

export function mfaChallengePath(returnTo: string): string {
  return `/mfa/challenge?return_to=${encodeURIComponent(
    safePortalPath(returnTo),
  )}`;
}

/**
 * Where to send a signed-in user before `returnTo`, or null when no challenge
 * is needed (MFA off, already aal2, or no verified factor).
 */
export async function mfaStepUpRedirect(
  supabase: MfaAuthClient,
  claims: { aal?: unknown } | null | undefined,
  returnTo: string,
): Promise<string | null> {
  if (!isMfaEnabled() || claims?.aal === "aal2") return null;
  const status = await readMfaStatus(supabase);
  return needsMfaChallenge(claims, status) ? mfaChallengePath(returnTo) : null;
}

export type AttestClient = {
  rpc(
    fn: string,
    args: Record<string, unknown>,
  ): PromiseLike<{ error: unknown }>;
};

/**
 * Record that this authorization was approved from an aal2 session, for the
 * access token hook (docs/mfa.md). The database function checks aal2 and
 * ownership itself; the portal only calls it. Never blocks the redirect: a
 * missing attestation means the client gets an aal1 token and asks again.
 */
export async function attestMfaAuthorization(
  supabase: AttestClient,
  claims: { aal?: unknown } | null | undefined,
  authorizationId: string,
): Promise<boolean> {
  if (!isOAuthAttestationEnabled() || claims?.aal !== "aal2") return false;
  try {
    const { error } = await supabase.rpc("rc_attest_mfa_authorization", {
      p_authorization_id: authorizationId,
    });
    return !error;
  } catch {
    return false;
  }
}
