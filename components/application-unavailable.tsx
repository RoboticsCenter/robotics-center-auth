import { AuthShell } from "@/components/auth-shell";
import { CenterOsIcon, PlatformIcon } from "@/components/icons";
import type { DeferredApplicationId } from "@/lib/auth/application-source";

type ApplicationDetails = {
  name: string;
  href: string;
  iconClassName: string;
  icon: typeof PlatformIcon;
};

const applications: Record<DeferredApplicationId, ApplicationDetails> = {
  platform: {
    name: "Data Platform",
    href: "https://platform.roboticscenter.ai/",
    iconClassName: "app-icon-violet",
    icon: PlatformIcon,
  },
  centeros: {
    name: "CenterOS",
    href: "https://centeros.roboticscenter.ai/",
    iconClassName: "app-icon-cyan",
    icon: CenterOsIcon,
  },
};

export function ApplicationUnavailable({
  application,
}: {
  application: DeferredApplicationId;
}) {
  const details = applications[application];
  const Icon = details.icon;

  return (
    <AuthShell>
      <section
        className="auth-card auth-card-secondary unavailable-card"
        aria-labelledby="unavailable-title"
      >
        <span
          className={["app-icon", details.iconClassName, "unavailable-app-icon"].join(
            " ",
          )}
          aria-hidden="true"
        >
          <Icon />
        </span>
        <div className="secondary-heading">
          <p className="eyebrow">Integration coming soon</p>
          <h1 id="unavailable-title">
            {details.name} sign-in isn’t available yet
          </h1>
          <p>
            The shared account connection for {details.name} has not been
            enabled. You can return to the application or continue to the
            Robotics Center website.
          </p>
        </div>
        <div className="unavailable-actions">
          <a className="primary-button button-link" href={details.href}>
            Return to {details.name}
          </a>
          <a
            className="quiet-button button-link"
            href="https://www.roboticscenter.ai/"
          >
            Go to Robotics Center Website
          </a>
        </div>
      </section>
    </AuthShell>
  );
}
