import Link from "next/link";
import { GlobeIcon, GoogleIcon, NavArrowIcon } from "@/components/icons";
import styles from "./preview.module.css";

const states = [
  { value: "default", label: "Normal" },
  { value: "hover", label: "Hover" },
  { value: "focus", label: "Keyboard focus" },
  { value: "pressed", label: "Pressed" },
  { value: "disabled", label: "Disabled" },
] as const;

const families = [
  { name: "Primary", className: "primary-button", label: "Sign in" },
  { name: "Google", className: "oauth-button", label: "Continue with Google" },
  { name: "Secondary", className: "quiet-button", label: "Cancel" },
];

const actions = [
  { label: "Sign in", className: "primary-button" },
  { label: "Create account", className: "primary-button" },
  { label: "Send reset link", className: "primary-button" },
  { label: "Update password", className: "primary-button" },
  { label: "Continue", className: "primary-button" },
  { label: "Sign out", className: "primary-button" },
  { label: "Resend confirmation email", className: "quiet-button" },
  { label: "Cancel", className: "quiet-button" },
  { label: "Continue with Google", className: "oauth-button" },
];

export function ButtonPreview() {
  return (
    <main className={`${styles.page} button-state-preview`}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Robotics Center · Local design review</p>
          <h1>Button states</h1>
          <p>
            Visual samples only. Hover, press, or use Tab to inspect the controls.
            No sign-in, email, or account actions run here.
          </p>
        </div>
        <Link className="quiet-button" href="/design-preview">All screens</Link>
      </header>

      <div className={styles.stateGrid}>
        {families.map((family) => (
          <section className={styles.stateCard} key={family.name} aria-label={`${family.name} button states`}>
            <h2>{family.name}</h2>
            <div className={styles.stateList}>
              {states.map((state) => (
                <div className={styles.stateSample} key={state.value}>
                  <span>{state.label}</span>
                  <button
                    type="button"
                    className={family.className}
                    data-preview-state={state.value}
                    aria-label={`${family.label} · ${state.label} sample`}
                    disabled={state.value === "disabled"}
                  >
                    {family.className === "oauth-button" && <GoogleIcon className="google-icon" />}
                    {family.label}
                  </button>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>

      <section className={styles.feedback} aria-labelledby="try-actions-title">
        <h2 id="try-actions-title">Try each action</h2>
        <p>These enabled samples show how the currently unavailable controls will feel.</p>
        <div className={styles.actionGrid}>
          {actions.map((action) => (
            <button className={action.className} type="button" key={action.label}>
              {action.className === "oauth-button" && <GoogleIcon className="google-icon" />}
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <section className={styles.feedback} aria-labelledby="launcher-interaction-title">
        <h2 id="launcher-interaction-title">Launcher arrow</h2>
        <p>The card stays still. Only the arrow slides in on hover or keyboard focus.</p>
        <button className={`app-card ${styles.launcherSample}`} type="button">
          <span className="app-icon"><GlobeIcon /></span>
          <span className="app-card-copy">
            <span className="app-card-title">
              <strong>Robotics Center</strong>
              <NavArrowIcon className="app-arrow" />
            </span>
            <span className="app-card-description">Shop products and manage orders.</span>
            <small>Visual sample · Does not navigate</small>
          </span>
        </button>
        <p><Link href="/launcher">Open the application launcher</Link></p>
      </section>
    </main>
  );
}
