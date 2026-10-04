/**
 * Data Platform sign-in via its own BFF (fearless-backend behind
 * platform.roboticscenter.ai's same-origin /api rewrite). The portal only
 * links to the Platform's OIDC start route; the Platform is a registered OAuth
 * client whose callback is
 * https://platform.roboticscenter.ai/api/auth/oidc/callback.
 *
 * Off unless NEXT_PUBLIC_PLATFORM_SSO_ENABLED is exactly "true" (inlined at
 * build time, so flipping it needs a redeploy).
 */

export const PLATFORM_SSO_START_URL =
  "https://platform.roboticscenter.ai/api/auth/oidc/start?next=/data";

// Exact allow-list. Nothing from the request (redirect=, source=, return_to=)
// ever contributes to the destination.
const ALLOWED_PLATFORM_SSO_TARGETS: ReadonlySet<string> = new Set([
  PLATFORM_SSO_START_URL,
]);

export function isPlatformSsoEnabled(): boolean {
  return process.env.NEXT_PUBLIC_PLATFORM_SSO_ENABLED?.trim() === "true";
}

export function isAllowedPlatformSsoTarget(value: string): boolean {
  return ALLOWED_PLATFORM_SSO_TARGETS.has(value);
}

/** The Platform sign-in link, or null while the integration is switched off. */
export function platformSignInHref(): string | null {
  if (!isPlatformSsoEnabled()) return null;
  return isAllowedPlatformSsoTarget(PLATFORM_SSO_START_URL)
    ? PLATFORM_SSO_START_URL
    : null;
}
