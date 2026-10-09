import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { safePortalPath } from "@/lib/auth/redirects";
import { isMfaEnabled, mfaStepUpRedirect } from "@/lib/auth/mfa";
import {
  clearPortalReturn,
  readPortalReturn,
} from "@/lib/auth/return-cookie";

/**
 * Google and email-link sign-ins land here at aal1. With MFA on, a user who
 * has a verified factor answers the challenge before `next`. A failed factor
 * lookup falls through to `next`: consent re-checks and fails closed there.
 */
async function stepUpDestination(
  supabase: Awaited<ReturnType<typeof createServerSupabaseClient>>,
  next: string,
): Promise<string> {
  if (!isMfaEnabled()) return next;
  try {
    const { data } = await supabase.auth.getClaims();
    return (await mfaStepUpRedirect(supabase, data?.claims, next)) ?? next;
  } catch {
    return next;
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safePortalPath(
    url.searchParams.get("next") ||
      readPortalReturn(request.headers.get("cookie")),
  );

  if (code) {
    const responseHeaders = new Headers();
    const supabase = await createServerSupabaseClient(responseHeaders);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const destination = await stepUpDestination(supabase, next);
      const response = NextResponse.redirect(new URL(destination, url.origin), {
        headers: responseHeaders,
      });
      clearPortalReturn(response);
      return response;
    }

    const failure = new URL("/error", url.origin);
    failure.searchParams.set("reason", "callback");
    const response = NextResponse.redirect(failure, {
      headers: responseHeaders,
    });
    clearPortalReturn(response);
    return response;
  }

  const failure = new URL("/error", url.origin);
  failure.searchParams.set("reason", "callback");
  const response = NextResponse.redirect(failure);
  clearPortalReturn(response);
  return response;
}
