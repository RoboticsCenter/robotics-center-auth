import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { Brand } from "@/components/brand";
import { BackIcon } from "@/components/icons";
import { isMfaEnabled } from "@/lib/auth/mfa";

export const metadata: Metadata = {
  title: "Two-step verification recovery",
};

const SUPPORT_EMAIL = "contact@roboticscenter.ai";

export default function MfaRecoveryPage() {
  if (!isMfaEnabled()) notFound();
  return (
    <AuthShell>
      <section className="auth-card auth-card-secondary mfa-card">
        <div className="card-highlight" aria-hidden="true" />
        <Brand />
        <div className="secondary-heading">
          <p className="eyebrow">Two-step verification</p>
          <h1>Can’t get a code?</h1>
          <p>Try these in order. We never ask for your password or a code.</p>
        </div>
        <ol className="mfa-recovery-steps">
          <li>
            <strong>Use a backup authenticator.</strong> If you added a second
            phone or a password manager, choose it on the verification screen.
          </li>
          <li>
            <strong>Check your phone’s clock.</strong> Codes fail when the time
            is off. Turn on automatic date and time, then use the newest code.
          </li>
          <li>
            <strong>Restore your authenticator app.</strong> Apps with cloud
            backup (1Password, Google Authenticator, Microsoft Authenticator,
            Authy) restore your codes when you sign in on a new phone.
          </li>
          <li>
            <strong>Ask for a reset.</strong> Email{" "}
            <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> from the
            address on your account. A Robotics Center administrator confirms
            who you are by a second channel before removing your
            authenticator; then sign in and set up a new one. Staff should also
            tell their manager.
          </li>
        </ol>
        <Link className="back-link" href="/">
          <BackIcon className="back-icon" />
          Back to sign in
        </Link>
      </section>
    </AuthShell>
  );
}
