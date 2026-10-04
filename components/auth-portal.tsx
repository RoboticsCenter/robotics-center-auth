"use client";

import Link from "next/link";
import { FormEvent, useEffect, useId, useState } from "react";
import {
  isAuthApiError,
  isAuthRetryableFetchError,
} from "@supabase/supabase-js";
import { AuthShell } from "@/components/auth-shell";
import { Brand } from "@/components/brand";
import { EyeIcon, GoogleIcon, ShieldIcon } from "@/components/icons";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { safePortalPath } from "@/lib/auth/redirects";
import {
  CONFIRMATION_RESEND_COOLDOWN_SECONDS,
  signupConfirmationResendParams,
} from "@/lib/auth/resend-confirmation";
import { stashPortalReturn } from "@/lib/auth/return-cookie";
import { isMfaEnabled, mfaChallengePath } from "@/lib/auth/mfa";

type AuthMode = "signin" | "signup";
type AuthAction = AuthMode | "resend";

function authErrorMessage(error: unknown, action: AuthAction): string {
  if (isAuthRetryableFetchError(error)) {
    return "We’re having trouble reaching the sign-in service. Check your connection and try again.";
  }

  if (isAuthApiError(error)) {
    switch (error.code) {
      case "invalid_credentials":
        return "Email or password is incorrect.";
      case "email_not_confirmed":
        return "Please confirm your email before signing in. Check your inbox and spam folder.";
      case "over_request_rate_limit":
        return "Too many sign-in attempts. Wait a few minutes and try again.";
      case "over_email_send_rate_limit":
        return "Too many emails were requested. Wait a few minutes before trying again.";
      case "request_timeout":
        return "We’re having trouble reaching the sign-in service. Check your connection and try again.";
      case "email_address_invalid":
        return "Enter a valid email address.";
      case "weak_password":
        return "Choose a stronger password with at least 8 characters.";
      case "signup_disabled":
      case "email_provider_disabled":
        return "New account creation is temporarily unavailable.";
      default:
        if (error.status === 429) {
          return "Too many attempts. Wait a few minutes and try again.";
        }
    }
  }

  if (action === "signin") {
    return "Sign in could not be completed. Try again.";
  }
  if (action === "resend") {
    return "Confirmation email could not be sent. Wait a moment and try again.";
  }
  return "Account creation could not be completed. Check your details and try again.";
}

export function AuthPortal({
  initialMode = "signin",
  returnTo = "/launcher",
}: {
  initialMode?: AuthMode;
  returnTo?: string;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupSubmitted, setSignupSubmitted] = useState(false);
  const [signupEmail, setSignupEmail] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const formId = useId();
  const next = safePortalPath(returnTo);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timeout = window.setTimeout(
      () => setResendCooldown((seconds) => Math.max(0, seconds - 1)),
      1000,
    );
    return () => window.clearTimeout(timeout);
  }, [resendCooldown]);

  function selectMode(nextMode: AuthMode) {
    setMode(nextMode);
    setNotice("");
    setError("");
    setShowPassword(false);
    setSignupSubmitted(false);
    setSignupEmail("");
    setResendCooldown(0);
  }

  function finish() {
    window.location.assign(next);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (mode === "signup" && signupSubmitted)) return;

    const form = event.currentTarget;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = new FormData(event.currentTarget);
      const email = String(data.get("email") ?? "").trim();
      const password = String(data.get("password") ?? "");
      const supabase = createBrowserSupabaseClient();

      if (mode === "signin") {
        const { error: signInError } =
          await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        if (isMfaEnabled()) {
          const { data: assurance } =
            await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
          if (
            assurance?.nextLevel === "aal2" &&
            assurance.currentLevel !== "aal2"
          ) {
            window.location.assign(mfaChallengePath(next));
            return;
          }
        }
        finish();
        return;
      }

      const firstName = String(data.get("given-name") ?? "").trim();
      const lastName = String(data.get("family-name") ?? "").trim();
      stashPortalReturn(next);
      const { data: signup, error: signupError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: {
            first_name: firstName,
            last_name: lastName,
            full_name: `${firstName} ${lastName}`.trim(),
          },
        },
      });
      if (signupError) throw signupError;
      if (signup.session) {
        finish();
        return;
      }
      form.reset();
      setSignupSubmitted(true);
      setSignupEmail(email);
      setResendCooldown(CONFIRMATION_RESEND_COOLDOWN_SECONDS);
      setNotice(
        "If this email can be registered, you’ll receive a confirmation link. Check your inbox and spam folder, then open it in this browser within 10 minutes.",
      );
    } catch (caught) {
      setError(authErrorMessage(caught, mode));
    } finally {
      setBusy(false);
    }
  }

  async function handleResendConfirmation() {
    if (busy || !signupEmail || resendCooldown > 0) return;
    setBusy(true);
    setError("");
    try {
      stashPortalReturn(next);
      const supabase = createBrowserSupabaseClient();
      const { error: resendError } = await supabase.auth.resend(
        signupConfirmationResendParams(signupEmail, window.location.origin),
      );
      if (resendError) throw resendError;
      setResendCooldown(CONFIRMATION_RESEND_COOLDOWN_SECONDS);
      setNotice(
        "If this email can be confirmed, another confirmation link is on the way. Check your inbox and spam folder, then use the newest link.",
      );
    } catch (caught) {
      if (
        isAuthApiError(caught) &&
        (caught.code === "over_email_send_rate_limit" ||
          caught.code === "over_request_rate_limit" ||
          caught.status === 429)
      ) {
        setResendCooldown(CONFIRMATION_RESEND_COOLDOWN_SECONDS);
      }
      setError(authErrorMessage(caught, "resend"));
    } finally {
      setBusy(false);
    }
  }

  async function handleGoogle() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      stashPortalReturn(next);
      const supabase = createBrowserSupabaseClient();
      const { error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
          queryParams: { prompt: "select_account" },
        },
      });
      if (oauthError) throw oauthError;
    } catch {
      setError("Google sign in could not be started. Please try again.");
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="card-highlight" aria-hidden="true" />
        <Brand />

        <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
          <button
            className={mode === "signin" ? "auth-tab active" : "auth-tab"}
            type="button"
            role="tab"
            aria-selected={mode === "signin"}
            aria-controls={formId}
            onClick={() => selectMode("signin")}
          >
            Sign In
          </button>
          <button
            className={mode === "signup" ? "auth-tab active" : "auth-tab"}
            type="button"
            role="tab"
            aria-selected={mode === "signup"}
            aria-controls={formId}
            onClick={() => selectMode("signup")}
          >
            Sign Up
          </button>
        </div>

        <div id={formId} role="tabpanel">
          <h1 id="auth-title" className="sr-only">
            {mode === "signin"
              ? "Sign in to Robotics Center of Silicon Valley"
              : "Create your Robotics Center of Silicon Valley account"}
          </h1>

          <button
            className="oauth-button"
            type="button"
            disabled={busy || !isSupabaseConfigured()}
            onClick={() => void handleGoogle()}
          >
            <GoogleIcon className="google-icon" />
            Continue with Google
          </button>

          <div className="divider" aria-hidden="true">
            <span>or</span>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {mode === "signup" ? (
              <div className="field-row">
                <label className="field-label">
                  <span>First name</span>
                  <input
                    className="text-input"
                    type="text"
                    name="given-name"
                    autoComplete="given-name"
                    placeholder="Ada"
                    required
                  />
                </label>
                <label className="field-label">
                  <span>Last name</span>
                  <input
                    className="text-input"
                    type="text"
                    name="family-name"
                    autoComplete="family-name"
                    placeholder="Lovelace"
                    required
                  />
                </label>
              </div>
            ) : null}

            <label className="field-label">
              <span>Email address</span>
              <input
                className="text-input"
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                placeholder="you@company.com"
                required
              />
            </label>

            <label className="field-label">
              <span>Password</span>
              <span className="password-field">
                <input
                  className="text-input"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete={
                    mode === "signin" ? "current-password" : "new-password"
                  }
                  placeholder={
                    mode === "signin" ? "Enter your password" : "8+ characters"
                  }
                  minLength={8}
                  required
                />
                <button
                  className="password-toggle"
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  <EyeIcon className="eye-icon" />
                </button>
              </span>
            </label>

            {mode === "signin" ? (
              <div className="form-options form-options-end">
                <Link
                  href={`/forgot-password?return_to=${encodeURIComponent(next)}`}
                >
                  Forgot password?
                </Link>
              </div>
            ) : (
              <p className="form-assurance">
                By creating an account, you agree to the Robotics Center terms
                and privacy policy.
              </p>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={
                busy ||
                !isSupabaseConfigured() ||
                (mode === "signup" && signupSubmitted)
              }
            >
              {busy
                ? "Please wait…"
                : mode === "signin"
                  ? "Sign In"
                  : signupSubmitted
                    ? "Check Your Email"
                    : "Create Account"}
            </button>

            {notice ? (
              <div className="form-success" role="status" aria-live="polite">
                <strong>Check your email</strong>
                <span>{notice}</span>
                {mode === "signup" && signupSubmitted && signupEmail ? (
                  <button
                    className="quiet-button resend-confirmation-button"
                    type="button"
                    disabled={busy || resendCooldown > 0}
                    onClick={() => void handleResendConfirmation()}
                  >
                    {busy
                      ? "Sending…"
                      : resendCooldown > 0
                        ? `Resend available in ${resendCooldown}s`
                        : "Resend confirmation email"}
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="preview-notice" aria-live="polite">
                {!isSupabaseConfigured()
                  ? "Authentication is temporarily unavailable. Please try again later."
                  : ""}
              </p>
            )}
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        </div>

        <div className="security-note">
          <ShieldIcon className="security-icon" />
          <span>Protected by secure, encrypted authentication</span>
        </div>
      </section>
    </AuthShell>
  );
}
