import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ConsentCard } from "@/components/consent-card";
import { ButtonPreview } from "./button-preview";
import styles from "./preview.module.css";

export const metadata: Metadata = {
  title: "Account design preview",
  robots: { index: false, follow: false },
};

const screens = [
  { title: "Sign in", route: "/", href: "/", description: "Email, password, Google, and password recovery." },
  { title: "Create account", route: "/?mode=signup", href: "/?mode=signup", description: "Name, email, password, and clear terms links." },
  { title: "Reset password", route: "/forgot-password", href: "/forgot-password", description: "Request a password reset email." },
  { title: "New password", route: "/update-password", href: "/update-password", description: "Choose and confirm a new password." },
  { title: "Application launcher", route: "/launcher", href: "/launcher", description: "Choose an application after signing in." },
  { title: "Connect an application", route: "/oauth/consent", href: "/design-preview?screen=consent", description: "Permission details and consent. Opens a visual sample." },
  { title: "Sign out", route: "/logout", href: "/logout", description: "Confirm sign out or keep the current session." },
  { title: "Sign-in problem", route: "/error", href: "/error", description: "A clear recovery path for expired or invalid requests." },
  { title: "Data Platform unavailable", route: "/?source=platform", href: "/?source=platform", description: "Explain availability and offer a useful next step." },
  { title: "CenterOS unavailable", route: "/?source=centeros", href: "/?source=centeros", description: "Explain availability and offer a useful next step." },
  { title: "Page not found", route: "Any unknown path", href: "/page-not-found-preview", description: "Help visitors return to the sign-in page." },
];

type Props = {
  searchParams: Promise<{ screen?: string | string[] }>;
};

export default async function DesignPreviewPage({ searchParams }: Props) {
  // This is a local review tool, never a production route or an auth bypass.
  if (process.env.NODE_ENV !== "development") notFound();

  const { screen } = await searchParams;
  if (screen === "buttons") return <ButtonPreview />;
  if (screen === "consent") {
    return (
      <>
        <div className={styles.sampleNotice}>
          <span>Visual sample · No authorization request · Buttons are inactive</span>
          <Link href="/design-preview">All screens</Link>
        </div>
        <AuthShell>
          <ConsentCard
            clientName="Robotics Center"
            scopes={["openid", "email", "profile"]}
          >
            <div className="consent-actions">
              <button className="primary-button" type="button" aria-disabled="true">
                Continue
              </button>
              <button className="quiet-button" type="button" aria-disabled="true">
                Cancel
              </button>
            </div>
          </ConsentCard>
        </AuthShell>
      </>
    );
  }
  if (screen !== undefined) notFound();

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Robotics Center · Local design review</p>
          <h1>Every account screen, in one place.</h1>
          <p>
            The shared theme covers these 11 screens, plus their inline success,
            error, and loading states. Select a screen to inspect it at full size.
          </p>
        </div>
        <nav className={styles.headingActions} aria-label="Design previews">
          <Link className="primary-button button-link" href="/?mode=signin">Open sign in</Link>
          <Link className="quiet-button" href="/design-preview?screen=buttons">Button states</Link>
        </nav>
      </header>

      <ul className={styles.grid} aria-label="Account screens">
        {screens.map((item, index) => (
          <li key={item.title}>
            <Link className={styles.card} href={item.href}>
              <span className={styles.number}>{String(index + 1).padStart(2, "0")}</span>
              <h2>{item.title}</h2>
              <p>{item.description}</p>
              <code>{item.route}</code>
              <span className={styles.open}>View screen <span aria-hidden="true">→</span></span>
            </Link>
          </li>
        ))}
      </ul>

      <section className={styles.feedback} aria-labelledby="feedback-title">
        <h2 id="feedback-title">Feedback stays readable, too.</h2>
        <p>Visual examples of the existing inline states. No email has been sent.</p>
        <div className={styles.feedbackGrid}>
          <div className="form-success">
            <strong>Check your email</strong>
            <span>Check your inbox and spam folder for a confirmation link.</span>
          </div>
          <div className="form-success">
            <strong>Reset email sent</strong>
            <span>Open the password reset link in this browser to continue.</span>
          </div>
          <p className="form-error">Email or password is incorrect. Please try again.</p>
        </div>
      </section>

      <footer className={styles.notes}>
        <p>
          DM Sans for forms · 28px headings · 16px inputs · 14px labels ·
          46–48px controls. Share Tech stays in the brand panel.
        </p>
        <p>
          References: <a href="https://dashboard.stripe.com/login">Stripe</a>,{" "}
          <a href="https://account.apple.com/sign-in">Apple</a>, and{" "}
          <a href="https://ryo.lu/journal/on-not-changing-for-the-sake-of-change">
            Ryo Lu on clarity and restraint
          </a>.
        </p>
      </footer>
    </main>
  );
}
