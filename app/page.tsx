import { AuthPortal } from "@/components/auth-portal";
import { ApplicationUnavailable } from "@/components/application-unavailable";
import { PlatformSignIn } from "@/components/platform-sign-in";
import { deferredApplicationFromQuery } from "@/lib/auth/application-source";
import { platformSignInHref } from "@/lib/auth/platform-sso";
import { safePortalPath } from "@/lib/auth/redirects";

type Props = {
  searchParams: Promise<{
    mode?: string | string[];
    redirect?: string | string[];
    return_to?: string | string[];
    source?: string | string[];
  }>;
};

export default async function HomePage({ searchParams }: Props) {
  const params = await searchParams;
  const deferredApplication = deferredApplicationFromQuery(params);
  const platformHref =
    deferredApplication === "platform" ? platformSignInHref() : null;
  if (platformHref) {
    return <PlatformSignIn href={platformHref} />;
  }
  if (deferredApplication) {
    return <ApplicationUnavailable application={deferredApplication} />;
  }

  return (
    <AuthPortal
      initialMode={params.mode === "signup" ? "signup" : "signin"}
      returnTo={safePortalPath(params.return_to)}
    />
  );
}
