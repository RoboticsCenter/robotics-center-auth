import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { Brand } from "@/components/brand";
import {
  NavArrowIcon,
  CenterOsIcon,
  GlobeIcon,
  PlatformIcon,
} from "@/components/icons";

export const metadata: Metadata = {
  title: "Choose an application",
};

const applications = [
  {
    name: "Robotics Center",
    description:
      "Shop products and manage orders.",
    href: "https://www.roboticscenter.ai/",
    domain: "roboticscenter.ai",
    className: "app-icon-blue",
    icon: GlobeIcon,
    available: true,
  },
  {
    name: "Data Platform",
    description:
      "Manage robotics data and deployments.",
    href: "https://platform.roboticscenter.ai/",
    domain: "platform.roboticscenter.ai",
    className: "app-icon-violet",
    icon: PlatformIcon,
    available: true,
  },
  {
    name: "CenterOS",
    description:
      "Manage robots and workflows.",
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
          <h1 id="launcher-title">Choose an app</h1>
          <p>Website and Data Platform sign-in are available now.</p>
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
                  <span className="app-card-title">
                    <strong>{application.name}</strong>
                    {application.available ? <NavArrowIcon className="app-arrow" /> : null}
                  </span>
                  <span className="app-card-description">{application.description}</span>
                  <small>
                    {application.available
                      ? application.domain
                      : "Sign-in coming soon"}
                  </small>
                </span>
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
      </section>
    </AuthShell>
  );
}
