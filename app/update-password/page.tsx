import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PreviewForm } from "@/components/preview-form";
import { safeRecoveryReturnTarget } from "@/lib/auth/redirects";
import { isMfaEnabled, mfaStepUpRedirect } from "@/lib/auth/mfa";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Choose a new password",
};

type Props = {
  searchParams: Promise<{ return_to?: string | string[] }>;
};

export default async function UpdatePasswordPage({ searchParams }: Props) {
  const { return_to: returnTo } = await searchParams;
  const safeReturn = safeRecoveryReturnTarget(returnTo);
  if (isMfaEnabled()) {
    // Supabase refuses a password change from an aal1 session once a factor
    // is verified, so answer the challenge first instead of failing on submit.
    const supabase = await createServerSupabaseClient();
    const { data } = await supabase.auth.getClaims();
    let stepUp: string | null = null;
    if (data?.claims) {
      try {
        stepUp = await mfaStepUpRedirect(
          supabase,
          data.claims,
          `/update-password?return_to=${encodeURIComponent(safeReturn)}`,
        );
      } catch {
        stepUp = null;
      }
    }
    if (stepUp) redirect(stepUp);
  }
  return (
    <PreviewForm
      mode="update"
      returnTo={safeReturn}
    />
  );
}
