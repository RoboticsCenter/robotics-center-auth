import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  isAllowedOAuthRedirectUrl,
  isAllowedOAuthRequest,
} from "@/lib/auth/redirects";
import { hasSameOrigin } from "@/lib/auth/request";
import {
  attestMfaAuthorization,
  isMfaEnabled,
  mfaStepUpRedirect,
} from "@/lib/auth/mfa";

export async function POST(request: Request) {
  if (!hasSameOrigin(request)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  const formData = await request.formData();
  const authorizationId = String(formData.get("authorization_id") ?? "");
  const decision = formData.get("decision");
  if (!authorizationId || (decision !== "approve" && decision !== "deny")) {
    return NextResponse.json({ error: "Invalid authorization decision" }, { status: 400 });
  }

  const responseHeaders = new Headers();
  const supabase = await createServerSupabaseClient(responseHeaders);
  let claims: { aal?: unknown } | undefined;
  if (decision === "approve" && isMfaEnabled()) {
    const { data: claimData } = await supabase.auth.getClaims();
    claims = claimData?.claims;
    let stepUp: string | null;
    try {
      stepUp = await mfaStepUpRedirect(
        supabase,
        claims,
        `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`,
      );
    } catch {
      return NextResponse.json(
        { error: "Two-step verification is unavailable" },
        { status: 503, headers: responseHeaders },
      );
    }
    if (stepUp) {
      return NextResponse.redirect(new URL(stepUp, request.url), {
        status: 303,
        headers: responseHeaders,
      });
    }
  }
  const details =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (
    details.error ||
    !details.data ||
    !("authorization_id" in details.data) ||
    !isAllowedOAuthRequest({
      clientId: details.data.client.id,
      redirectUri: details.data.redirect_uri,
    })
  ) {
    return NextResponse.json(
      { error: "Untrusted OAuth client" },
      { status: 403, headers: responseHeaders },
    );
  }

  const result =
    decision === "approve"
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        });

  if (
    result.error ||
    !result.data?.redirect_url ||
    !isAllowedOAuthRedirectUrl(
      result.data.redirect_url,
      details.data.redirect_uri,
    )
  ) {
    return NextResponse.json(
      { error: "Authorization failed" },
      { status: 400, headers: responseHeaders },
    );
  }
  if (decision === "approve") {
    await attestMfaAuthorization(supabase, claims, authorizationId);
  }
  return NextResponse.redirect(result.data.redirect_url, {
    status: 303,
    headers: responseHeaders,
  });
}
