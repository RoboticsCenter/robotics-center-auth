import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth-shell";
import { ConsentCard } from "@/components/consent-card";
import { ConsentActions } from "@/components/consent-actions";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isCenterOSDesktopRedirectUrl,
  isAllowedOAuthRedirectUrl,
  isAllowedOAuthRequest,
} from "@/lib/auth/redirects";

type Props = {
  searchParams: Promise<{ authorization_id?: string }>;
};

export default async function ConsentPage({ searchParams }: Props) {
  const { authorization_id: authorizationId } = await searchParams;
  if (!authorizationId) redirect("/error?reason=missing_authorization");

  const supabase = await createServerSupabaseClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) {
    redirect(
      `/?return_to=${encodeURIComponent(
        `/oauth/consent?authorization_id=${authorizationId}`,
      )}`,
    );
  }

  const { data, error } =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !data) redirect("/error?reason=invalid_authorization");

  if (!("authorization_id" in data)) {
    if (!isAllowedOAuthRedirectUrl(data.redirect_url)) {
      redirect("/error?reason=untrusted_client");
    }
    if (isCenterOSDesktopRedirectUrl(new URL(data.redirect_url))) {
      return (
        <AuthShell>
          <section className="auth-card auth-card-secondary consent-card">
            <div className="card-highlight" aria-hidden="true" />
            <Brand />
            <div className="secondary-heading">
              <p className="eyebrow">Secure connection</p>
              <h1>Open CenterOS</h1>
              <p>
                Your account is approved. Return to CenterOS to finish signing
                in.
              </p>
            </div>
            <a
              className="primary-button button-link"
              href={data.redirect_url}
            >
              Open CenterOS
            </a>
          </section>
        </AuthShell>
      );
    }
    redirect(data.redirect_url);
  }

  if (
    !isAllowedOAuthRequest({
      clientId: data.client.id,
      redirectUri: data.redirect_uri,
    })
  ) {
    redirect("/error?reason=untrusted_client");
  }

  const scopes = data.scope.split(" ").filter(Boolean);
  return (
    <AuthShell>
      <ConsentCard clientName={data.client.name} scopes={scopes}>
        <ConsentActions authorizationId={authorizationId} />
      </ConsentCard>
    </AuthShell>
  );
}
