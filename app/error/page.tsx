import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { BackIcon, ShieldIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Sign-in problem",
};

export default function AuthErrorPage() {
  return (
    <AuthShell>
      <section className="auth-card auth-card-secondary error-card">
        <div className="error-symbol" aria-hidden="true">
          <ShieldIcon />
        </div>
        <div className="secondary-heading">
          <p className="eyebrow">We kept your account safe</p>
          <h1>We couldn’t complete sign in</h1>
          <p>
            The request may have expired or could not be verified. Return to the
            login screen and try again.
          </p>
        </div>
        <Link className="primary-button button-link" href="/">
          Return to sign in
        </Link>
        <Link className="back-link" href="/forgot-password">
          <BackIcon className="back-icon" />
          Reset your password
        </Link>
      </section>
    </AuthShell>
  );
}
