import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Brand } from "@/components/brand";
import { BackIcon } from "@/components/icons";
import { MfaFactorList } from "@/components/mfa-factor-list";
import { mfaChallengePath, needsMfaChallenge } from "@/lib/auth/mfa";
import { loadMfaPage } from "@/lib/auth/mfa-server";

export const metadata: Metadata = {
  title: "Two-step verification",
};

export default async function MfaSettingsPage() {
  const { claims, status } = await loadMfaPage("/mfa");
  // Removing a verified factor needs aal2, so step up before showing the list.
  if (needsMfaChallenge(claims, status)) redirect(mfaChallengePath("/mfa"));
  const enrolled = status.verified.length > 0;

  return (
    <AuthShell>
      <section className="auth-card auth-card-secondary mfa-card">
        <div className="card-highlight" aria-hidden="true" />
        <Brand />
        <div className="secondary-heading">
          <p className="eyebrow">Account security</p>
          <h1>Two-step verification</h1>
          <p>
            {enrolled
              ? "Each sign-in asks for a code from one of these authenticators."
              : "Protect your account with a code from an authenticator app. Staff and admin accounts need this for internal tools."}
          </p>
        </div>
        <MfaFactorList factors={status.verified} />
        <Link className="primary-button button-link" href="/mfa/enroll">
          {enrolled ? "Add a backup authenticator" : "Set up an authenticator app"}
        </Link>
        {enrolled && status.verified.length === 1 ? (
          <p className="launcher-note">
            Add a second authenticator (another phone or a password manager)
            so losing one device doesn’t lock you out.
          </p>
        ) : null}
        <Link className="back-link" href="/mfa/recovery">
          Recovery options
        </Link>
        <Link className="back-link" href="/launcher">
          <BackIcon className="back-icon" />
          Back to applications
        </Link>
      </section>
    </AuthShell>
  );
}
