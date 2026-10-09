"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Brand } from "@/components/brand";
import { BackIcon } from "@/components/icons";
import { MfaCodeField } from "@/components/mfa-code-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { mfaErrorMessage, normalizedTotpCode } from "@/lib/auth/mfa-errors";

type Enrollment = { id: string; qrCode: string; secret: string };

export function MfaEnroll({
  returnTo,
  staleFactorIds,
  hasVerifiedFactor,
}: {
  returnTo: string;
  staleFactorIds: string[];
  hasVerifiedFactor: boolean;
}) {
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleStart(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const name =
      String(new FormData(event.currentTarget).get("friendly-name") ?? "")
        .trim()
        .slice(0, 60) || "Authenticator app";
    setBusy(true);
    setError("");
    try {
      const supabase = createBrowserSupabaseClient();
      // An abandoned setup leaves an unverified factor behind; clear it so
      // its name and the factor limit don't block a fresh attempt.
      for (const factorId of staleFactorIds) {
        await supabase.auth.mfa.unenroll({ factorId });
      }
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: `${name} · ${new Date().toISOString().slice(0, 10)}`,
      });
      if (enrollError) throw enrollError;
      setEnrollment({
        id: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      });
    } catch (caught) {
      setError(mfaErrorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !enrollment) return;
    const code = normalizedTotpCode(new FormData(event.currentTarget).get("code"));
    if (!code) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId: enrollment.id,
        code,
      });
      if (verifyError) throw verifyError;
      window.location.assign(returnTo);
    } catch (caught) {
      setError(mfaErrorMessage(caught));
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <section className="auth-card auth-card-secondary mfa-card">
        <div className="card-highlight" aria-hidden="true" />
        <Brand />
        <div className="secondary-heading">
          <p className="eyebrow">Two-step verification</p>
          <h1>
            {hasVerifiedFactor
              ? "Add a backup authenticator"
              : "Set up an authenticator app"}
          </h1>
          <p>
            Use an app such as 1Password, Google Authenticator, Microsoft
            Authenticator or Authy. You’ll enter a code from it each time you
            sign in.
          </p>
        </div>

        {enrollment ? (
          <form className="auth-form" onSubmit={handleVerify}>
            <div className="mfa-qr">
              {/* Supabase returns the QR code as an SVG data URL. */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={enrollment.qrCode}
                alt="QR code for your authenticator app"
                width={176}
                height={176}
              />
            </div>
            <p className="mfa-secret">
              Can’t scan? Enter this key instead:
              <code>{enrollment.secret}</code>
            </p>
            <MfaCodeField autoFocus />
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify and turn on"}
            </button>
            <p className="launcher-note">
              Turning this on signs out your other devices.
            </p>
          </form>
        ) : (
          <form className="auth-form" onSubmit={handleStart}>
            <label className="field-label">
              <span>Name this authenticator</span>
              <input
                className="text-input"
                type="text"
                name="friendly-name"
                maxLength={60}
                placeholder="Work phone"
              />
            </label>
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Please wait…" : "Show QR code"}
            </button>
          </form>
        )}
        {error ? (
          <p className="form-error" role="alert">
            {error}
          </p>
        ) : null}

        <Link className="back-link" href="/mfa">
          <BackIcon className="back-icon" />
          Back to two-step verification
        </Link>
      </section>
    </AuthShell>
  );
}
