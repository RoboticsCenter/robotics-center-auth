"use client";

import { useState } from "react";
import { createBrowserSupabaseClient } from "@/lib/supabase/browser";
import { mfaErrorMessage } from "@/lib/auth/mfa-errors";
import type { MfaFactor } from "@/lib/auth/mfa";

export function MfaFactorList({ factors }: { factors: MfaFactor[] }) {
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove(factorId: string) {
    if (busy) return;
    if (confirming !== factorId) {
      setConfirming(factorId);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const supabase = createBrowserSupabaseClient();
      const { error: unenrollError } = await supabase.auth.mfa.unenroll({
        factorId,
      });
      if (unenrollError) throw unenrollError;
      // The current token still says aal2; refresh so it matches the account.
      await supabase.auth.refreshSession();
      window.location.reload();
    } catch (caught) {
      setError(mfaErrorMessage(caught));
      setBusy(false);
      setConfirming(null);
    }
  }

  if (!factors.length) {
    return (
      <p className="mfa-empty">
        Two-step verification is off. Add an authenticator app to turn it on.
      </p>
    );
  }

  return (
    <>
      <ul className="mfa-factors">
        {factors.map((factor) => (
          <li key={factor.id}>
            <span>
              <strong>{factor.friendlyName}</strong>
              <small>
                {factor.factorType === "totp" ? "Authenticator app" : factor.factorType}
                {factor.createdAt
                  ? ` · added ${factor.createdAt.slice(0, 10)}`
                  : ""}
              </small>
            </span>
            <button
              className="quiet-button"
              type="button"
              disabled={busy}
              onClick={() => void remove(factor.id)}
            >
              {confirming === factor.id
                ? factors.length === 1
                  ? "Turn off two-step?"
                  : "Confirm remove"
                : "Remove"}
            </button>
          </li>
        ))}
      </ul>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}
