import { AuthShell } from "@/components/auth-shell";
import { Brand } from "@/components/brand";
import { PlatformIcon } from "@/components/icons";

/**
 * Shown for the Platform's legacy `?redirect=https://platform…` /
 * `?source=platform` landings once NEXT_PUBLIC_PLATFORM_SSO_ENABLED is on.
 * `href` is always the allow-listed PLATFORM_SSO_START_URL.
 */
export function PlatformSignIn({ href }: { href: string }) {
  return (
    <AuthShell>
      <section
        className="auth-card auth-card-secondary unavailable-card"
        aria-labelledby="platform-sign-in-title"
      >
        <div className="card-highlight" aria-hidden="true" />
        <Brand />
        <span
          className="app-icon app-icon-violet unavailable-app-icon"
          aria-hidden="true"
        >
          <PlatformIcon />
        </span>
        <div className="secondary-heading">
          <p className="eyebrow">Central account</p>
          <h1 id="platform-sign-in-title">Sign in to Data Platform</h1>
          <p>
            Data Platform uses your Robotics Center account. Continue to sign in
            and return to the platform.
          </p>
        </div>
        <div className="unavailable-actions">
          <a className="primary-button button-link" href={href}>
            Continue to Data Platform
          </a>
          <a
            className="quiet-button button-link"
            href="https://www.roboticscenter.ai/"
          >
            Go to Robotics Center Website
          </a>
        </div>
        <p className="launcher-note">
          The Data Platform starts the sign-in itself; no tokens are passed in
          the URL.
        </p>
      </section>
    </AuthShell>
  );
}
