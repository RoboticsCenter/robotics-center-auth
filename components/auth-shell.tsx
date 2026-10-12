import Image from "next/image";
import { ArrowIcon, NavArrowIcon } from "@/components/icons";

type AuthShellProps = {
  children: React.ReactNode;
  wide?: boolean;
};

export function AuthShell({ children, wide = false }: AuthShellProps) {
  return (
    <div className="auth-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a
            className="header-logo"
            href="https://www.roboticscenter.ai/"
            aria-label="Robotics Center home"
          >
            <Image
              className="header-wordmark"
              src="/rc-wordmark-white.png"
              alt="Robotics Center"
              width={1273}
              height={130}
              priority
            />
          </a>
          <a className="header-back" href="https://www.roboticscenter.ai/">
            <NavArrowIcon className="header-back-arrow" reverse />
            <span>Back to website</span>
          </a>
        </div>
      </header>

      <main className="auth-main" id="main-content" tabIndex={-1}>
        <div
          className={wide ? "shell-content shell-content-wide" : "shell-content"}
        >
          {!wide && (
            <aside className="auth-aside" aria-label="About Robotics Center">
              <div className="aside-facets" aria-hidden="true" />
              <p className="aside-eyebrow">Robotics Center</p>
              <h2 className="aside-title">
                Your home for
                <span>physical AI.</span>
              </h2>
              <p className="aside-description">
                Robotics hardware, real-world data, and the tools to move your
                ideas forward. Start with your Robotics Center account.
              </p>
              <div className="aside-path">
                <span>Hardware</span>
                <ArrowIcon className="arrow-icon" />
                <span>Data</span>
                <ArrowIcon className="arrow-icon" />
                <span>Evaluation</span>
              </div>
              <p className="aside-caption">
                From the first robot to what comes next.
              </p>
            </aside>
          )}
          {wide ? children : <div className="shell-form-area">{children}</div>}
        </div>
      </main>

      <footer className="site-footer">
        <span>© {new Date().getFullYear()} Robotics Center</span>
        <nav className="footer-links" aria-label="Account support and legal">
          <a href="https://www.roboticscenter.ai/privacy-policy">Privacy</a>
          <a href="https://www.roboticscenter.ai/terms">Terms</a>
          <a href="https://www.roboticscenter.ai/contact">Get help</a>
        </nav>
      </footer>
    </div>
  );
}
