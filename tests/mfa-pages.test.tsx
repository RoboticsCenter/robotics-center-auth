import {
  Children,
  isValidElement,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { MfaChallenge } from "@/components/mfa-challenge";
import { MfaEnroll } from "@/components/mfa-enroll";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
  redirect: vi.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import MfaChallengePage from "@/app/mfa/challenge/page";
import MfaEnrollPage from "@/app/mfa/enroll/page";
import MfaSettingsPage from "@/app/mfa/page";
import MfaRecoveryPage from "@/app/mfa/recovery/page";
import UpdatePasswordPage from "@/app/update-password/page";

function client(options: { signedIn?: boolean; aal?: string; factors?: unknown[] }) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data:
          options.signedIn === false
            ? {}
            : { claims: { sub: "user-1", aal: options.aal ?? "aal1" } },
      }),
      mfa: {
        listFactors: vi
          .fn()
          .mockResolvedValue({ data: { all: options.factors ?? [] }, error: null }),
      },
    },
  };
}

function findElement(node: ReactNode, type: ElementType): ReactElement | null {
  if (!isValidElement(node)) return null;
  if (node.type === type) return node;
  const props = node.props as { children?: ReactNode };
  for (const child of Children.toArray(props.children)) {
    const match = findElement(child, type);
    if (match) return match;
  }
  return null;
}

const totp = { id: "totp-1", status: "verified", factor_type: "totp", friendly_name: "Phone" };
const phone = { id: "phone-1", status: "verified", factor_type: "phone" };
const params = (value: Record<string, string>) => ({
  searchParams: Promise.resolve(value),
});

beforeEach(() => {
  mocks.createServerSupabaseClient.mockReset();
  vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MFA pages while the flag is off", () => {
  test.each([
    () => MfaChallengePage(params({})),
    () => MfaEnrollPage(params({})),
    () => MfaSettingsPage(),
    async () => MfaRecoveryPage(),
  ])("404 without touching Supabase", async (render) => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "");
    await expect(render()).rejects.toThrow("NEXT_NOT_FOUND");
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  test("update-password does not look up factors", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "");
    await UpdatePasswordPage(params({}));
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });
});

describe("MFA challenge page", () => {
  test("sends a signed-out visitor to sign in, then back to the challenge", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(client({ signedIn: false }));
    await expect(
      MfaChallengePage(params({ return_to: "/launcher" })),
    ).rejects.toThrow(
      `NEXT_REDIRECT:/?return_to=${encodeURIComponent("/mfa/challenge?return_to=%2Flauncher")}`,
    );
  });

  test("continues to a safe return when no challenge is needed", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(
      client({ aal: "aal2", factors: [totp] }),
    );
    await expect(
      MfaChallengePage(params({ return_to: "https://evil.example/" })),
    ).rejects.toThrow("NEXT_REDIRECT:/launcher");
  });

  test("offers only TOTP factors", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(
      client({ factors: [totp, phone] }),
    );
    const page = await MfaChallengePage(
      params({ return_to: "/oauth/consent?authorization_id=a" }),
    );
    expect(findElement(page, MfaChallenge)?.props).toMatchObject({
      returnTo: "/oauth/consent?authorization_id=a",
      factors: [{ id: "totp-1", friendlyName: "Phone", factorType: "totp" }],
    });
  });
});

describe("MFA enroll and settings pages", () => {
  test("require aal2 once a factor is verified", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(client({ factors: [totp] }));
    await expect(MfaEnrollPage(params({}))).rejects.toThrow(
      `NEXT_REDIRECT:/mfa/challenge?return_to=${encodeURIComponent(
        "/mfa/enroll?return_to=%2Fmfa",
      )}`,
    );
    await expect(MfaSettingsPage()).rejects.toThrow(
      "NEXT_REDIRECT:/mfa/challenge?return_to=%2Fmfa",
    );
  });

  test("first enrollment works at aal1 and clears abandoned setups", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(
      client({
        factors: [{ id: "stale", status: "unverified", factor_type: "totp" }],
      }),
    );
    const page = await MfaEnrollPage(params({ return_to: "/launcher" }));
    expect(findElement(page, MfaEnroll)?.props).toEqual({
      returnTo: "/launcher",
      staleFactorIds: ["stale"],
      hasVerifiedFactor: false,
    });
  });
});

describe("update-password with MFA on", () => {
  test("steps up first so Supabase accepts the password change", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(client({ factors: [totp] }));
    await expect(
      UpdatePasswordPage(params({ return_to: "https://www.roboticscenter.ai/account" })),
    ).rejects.toThrow(
      `NEXT_REDIRECT:/mfa/challenge?return_to=${encodeURIComponent(
        `/update-password?return_to=${encodeURIComponent("https://www.roboticscenter.ai/account")}`,
      )}`,
    );
  });
});
