import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { MfaChallenge } from "@/components/mfa-challenge";
import { mfaChallengePath, needsMfaChallenge } from "@/lib/auth/mfa";
import { loadMfaPage } from "@/lib/auth/mfa-server";
import { safePortalPath } from "@/lib/auth/redirects";

export const metadata: Metadata = {
  title: "Two-step verification",
};

type Props = {
  searchParams: Promise<{ return_to?: string | string[] }>;
};

export default async function MfaChallengePage({ searchParams }: Props) {
  const { return_to: rawReturn } = await searchParams;
  const returnTo = safePortalPath(rawReturn);
  const { claims, status } = await loadMfaPage(mfaChallengePath(returnTo));
  if (!needsMfaChallenge(claims, status)) redirect(returnTo);

  return (
    <MfaChallenge
      factors={status.verified.filter((factor) => factor.factorType === "totp")}
      returnTo={returnTo}
    />
  );
}
