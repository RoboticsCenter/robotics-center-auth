"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthShell } from "@/components/auth-shell";
import { Brand } from "@/components/brand";
import { MfaCodeField } from "@/components/mfa-code-field";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { mfaErrorMessage, normalizedTotpCode } from "@/lib/auth/mfa-errors";
import type { MfaFactor } from "@/lib/auth/mfa";

export function MfaChallenge({
  factors,
  returnTo,
}: {
  factors: MfaFactor[];
  returnTo: string;
}) {
  const [factorId, setFactorId] = useState(factors[0]?.id ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
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
        factorId,
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
          <h1>Enter your verification code</h1>
          <p>
            Open your authenticator app and enter the current code for your
            Robotics Center account.
          </p>
        </div>

        {factors.length ? (
          <form className="auth-form" onSubmit={handleSubmit}>
            {factors.length > 1 ? (
              <label className="field-label">
                <span>Authenticator</span>
                <select
                  className="text-input"
                  name="factor"
                  value={factorId}
                  onChange={(event) => setFactorId(event.target.value)}
                >
                  {factors.map((factor) => (
                    <option key={factor.id} value={factor.id}>
                      {factor.friendlyName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <MfaCodeField autoFocus />
            <button className="primary-button" type="submit" disabled={busy}>
              {busy ? "Verifying…" : "Verify"}
            </button>
            {error ? (
              <p className="form-error" role="alert">
                {error}
              </p>
            ) : null}
          </form>
        ) : (
          <p className="form-error" role="alert">
            Your account uses a verification method this page can’t check.
            Use the recovery steps below.
          </p>
        )}

        <Link className="back-link" href="/mfa/recovery">
          Lost access to your authenticator?
        </Link>
        <form className="mfa-signout" action="/api/logout" method="post">
          <button className="quiet-button" type="submit">
            Sign out
          </button>
        </form>
      </section>
    </AuthShell>
  );
}
