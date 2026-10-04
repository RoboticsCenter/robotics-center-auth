import { notFound, redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { isMfaEnabled, readMfaStatus, type MfaStatus } from "@/lib/auth/mfa";

/**
 * Shared entry for the signed-in /mfa pages: 404 while the flag is off, the
 * sign-in screen (returning to `currentPath`) when signed out, and the error
 * page if the factor list can't be read.
 */
export async function loadMfaPage(currentPath: string): Promise<{
  claims: { aal?: unknown };
  status: MfaStatus;
}> {
  if (!isMfaEnabled()) notFound();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) {
    redirect(`/?return_to=${encodeURIComponent(currentPath)}`);
  }
  let status: MfaStatus;
  try {
    status = await readMfaStatus(supabase);
  } catch {
    redirect("/error?reason=mfa_unavailable");
  }
  return { claims: data.claims, status };
}
