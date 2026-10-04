import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaEnroll } from "@/components/mfa-enroll";
import { mfaChallengePath, needsMfaChallenge } from "@/lib/auth/mfa";
import { loadMfaPage } from "@/lib/auth/mfa-server";
import { safePortalPath } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Set up two-step verification",
};

type Props = {
  searchParams: Promise<{ return_to?: string | string[] }>;
};

export default async function MfaEnrollPage({ searchParams }: Props) {
  const { return_to: rawReturn } = await searchParams;
  const returnTo = safePortalPath(rawReturn, "/mfa");
  const currentPath = `/mfa/enroll?return_to=${encodeURIComponent(returnTo)}`;
  const { claims, status } = await loadMfaPage(currentPath);
  // Supabase only lets an aal2 session add a factor once one is verified.
  if (needsMfaChallenge(claims, status)) redirect(mfaChallengePath(currentPath));

  return (
    <MfaEnroll
      returnTo={returnTo}
      staleFactorIds={status.unverifiedTotpIds}
      hasVerifiedFactor={status.verified.length > 0}
    />
  );
}
