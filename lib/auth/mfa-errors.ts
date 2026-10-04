import {
  isAuthApiError,
  isAuthRetryableFetchError,
} from "@supabase/supabase-js";

export function mfaErrorMessage(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return "We’re having trouble reaching the sign-in service. Check your connection and try again.";
  }
  if (isAuthApiError(error)) {
    switch (error.code) {
      case "mfa_verification_failed":
      case "mfa_verification_rejected":
        return "That code didn’t match. Check that your phone’s clock is set automatically and enter the newest code.";
      case "mfa_challenge_expired":
        return "That code expired. Enter the newest code from your authenticator app.";
      case "mfa_factor_not_found":
        return "That authenticator is no longer on your account. Reload the page and try again.";
      case "mfa_factor_name_conflict":
        return "An authenticator with that name already exists. Reload the page and try again.";
      case "too_many_enrolled_mfa_factors":
        return "Your account has the maximum number of authenticators. Remove one before adding another.";
      case "mfa_totp_enroll_not_enabled":
      case "mfa_totp_verify_not_enabled":
        return "Two-step verification is not available yet. Please contact Robotics Center support.";
      case "insufficient_aal":
        return "Verify with your current authenticator first, then try again.";
      default:
        if (error.status === 429) {
          return "Too many attempts. Wait a few minutes and try again.";
        }
    }
  }
  return "We couldn’t complete that request. Please try again.";
}

/** Six digits, spaces stripped, or null. */
export function normalizedTotpCode(value: FormDataEntryValue | null): string | null {
  const code = String(value ?? "").replace(/\s+/g, "");
  return /^\d{6}$/.test(code) ? code : null;
}
