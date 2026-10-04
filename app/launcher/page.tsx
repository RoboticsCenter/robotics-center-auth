import type { Metadata } from "next";
import Link from "next/link";
import { AuthShell } from "@/components/auth-shell";
import { Brand } from "@/components/brand";
import {
  ArrowIcon,
  CenterOsIcon,
  GlobeIcon,
  PlatformIcon,
} from "@/components/icons";
import { isMfaEnabled } from "@/lib/auth/mfa";

export const metadata: Metadata = {
  title: "Choose an application",
};

const applications = [
  {
    name: "Robotics Center",
    description:
      "Shop robotics products, manage orders, and access your customer account.",
    href: "https://www.roboticscenter.ai/",
    domain: "roboticscenter.ai",
    className: "app-icon-blue",
    icon: GlobeIcon,
    available: true,
  },
  {
    name: "Data Platform",
    description:
      "Manage robotics data, deployments, analytics, and connected operations.",
    href: "https://platform.roboticscenter.ai/",
    domain: "platform.roboticscenter.ai",
    className: "app-icon-violet",
    icon: PlatformIcon,
    available: false,
  },
  {
    name: "CenterOS",
    description:
      "Open the operating workspace for teams, robots, workflows, and automation.",
    href: "https://centeros.roboticscenter.ai/",
    domain: "centeros.roboticscenter.ai",
    className: "app-icon-cyan",
    icon: CenterOsIcon,
    available: false,
  },
];

export default function LauncherPage() {
  return (
    <AuthShell wide>
      <section className="launcher-panel" aria-labelledby="launcher-title">
        <header className="launcher-header">
          <Brand compact />
          <form action="/api/logout" method="post">
            <button className="quiet-button" type="submit">
              Sign out
            </button>
          </form>
        </header>

        <div className="launcher-intro">
          <span className="preview-pill">Central account</span>
          <h1 id="launcher-title">Where would you like to go?</h1>
          <p>
            Use your Robotics Center account across connected applications.
            Website access is available now; Platform and CenterOS sign-in will
            be added separately.
          </p>
        </div>

        <div className="app-grid">
          {applications.map((application) => {
            const Icon = application.icon;
            const content = (
              <>
                <span className={`app-icon ${application.className}`}>
                  <Icon />
                </span>
                <span className="app-card-copy">
                  <strong>{application.name}</strong>
                  <span>{application.description}</span>
                  <small>
                    {application.available
                      ? application.domain
                      : `${application.domain} · Sign-in not available yet`}
                  </small>
                </span>
                {application.available ? (
                  <ArrowIcon className="app-arrow" />
                ) : null}
              </>
            );

            return application.available ? (
              <a
                className="app-card"
                href={application.href}
                key={application.name}
              >
                {content}
              </a>
            ) : (
              <div
                aria-disabled="true"
                className="app-card app-card-disabled"
                key={application.name}
              >
                {content}
              </div>
            );
          })}
        </div>

        <p className="launcher-note">
          Available application links never carry access or refresh tokens in
          the URL.
        </p>
        {isMfaEnabled() ? (
          <Link className="back-link" href="/mfa">
            Two-step verification
          </Link>
        ) : null}
      </section>
    </AuthShell>
  );
}
