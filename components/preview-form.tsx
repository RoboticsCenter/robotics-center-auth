"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { BackIcon, EyeIcon } from "@/components/icons";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { stashPortalReturn } from "@/lib/auth/return-cookie";

type PreviewFormProps = {
  mode: "forgot" | "update";
  returnTo?: string;
};

export function PreviewForm({ mode, returnTo = "/launcher" }: PreviewFormProps) {
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const isForgot = mode === "forgot";
  // Server recovery pages validate this against the private origin allowlist.
  const next = returnTo;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || (isForgot && notice)) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = new FormData(event.currentTarget);
      const supabase = createBrowserSupabaseClient();
      if (isForgot) {
        stashPortalReturn(`/update-password?return_to=${encodeURIComponent(next)}`);
        const { error: resetError } =
          await supabase.auth.resetPasswordForEmail(
            String(data.get("email") ?? "").trim(),
            { redirectTo: `${window.location.origin}/auth/callback` },
          );
        if (resetError) throw resetError;
        setNotice(
          "Check your inbox and spam folder for a secure password reset link. Open it in this browser to continue.",
        );
        return;
      }

      const password = String(data.get("password") ?? "");
      const confirmation = String(data.get("confirm-password") ?? "");
      if (password !== confirmation) {
        setError("The passwords do not match.");
        return;
      }
      const { error: updateError } =
        await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      window.location.assign(next);
    } catch {
      setError("We couldn’t complete that request. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <section className="auth-card auth-card-secondary">
        <div className="secondary-heading">
          <p className="eyebrow">
            {isForgot ? "Account recovery" : "Secure your account"}
          </p>
          <h1>{isForgot ? "Reset your password" : "Choose a new password"}</h1>
          <p>
            {isForgot
              ? "Enter your email and we’ll send you a secure reset link."
              : "Use at least eight characters and choose a password you haven’t used before."}
          </p>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          {isForgot ? (
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
          ) : (
            <>
              <label className="field-label">
                <span>New password</span>
                <span className="password-field">
                  <input
                    className="text-input"
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="new-password"
                    placeholder="8+ characters"
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
              <label className="field-label">
                <span>Confirm new password</span>
                <input
                  className="text-input"
                  type={showPassword ? "text" : "password"}
                  name="confirm-password"
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                  minLength={8}
                  required
                />
              </label>
            </>
          )}

          <button
            className="primary-button"
            type="submit"
            disabled={
              busy ||
              !isSupabaseConfigured() ||
              (isForgot && Boolean(notice))
            }
          >
            {busy
              ? "Please wait…"
              : isForgot && notice
                ? "Reset email sent"
              : isForgot
                ? "Send reset link"
                : "Update password"}
          </button>
          {notice ? (
            <div className="form-success" role="status" aria-live="polite">
              <strong>Reset email sent</strong>
              <span>{notice}</span>
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

        <Link
          className="back-link"
          href={`/?return_to=${encodeURIComponent(next)}`}
        >
          <BackIcon className="back-icon" />
          Back to sign in
        </Link>
      </section>
    </AuthShell>
  );
}
