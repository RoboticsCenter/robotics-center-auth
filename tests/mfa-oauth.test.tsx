import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

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

import ConsentPage from "@/app/oauth/consent/page";
import { POST } from "@/app/api/oauth/decision/route";
import { GET as callback } from "@/app/auth/callback/route";

const clientCallback = "https://website-preview.example/auth/sso/callback";
const challengeForConsent =
  "/mfa/challenge?return_to=%2Foauth%2Fconsent%3Fauthorization_id%3Dauthorization-id";

const pending = {
  authorization_id: "authorization-id",
  client: { id: "website-preview", name: "RCSV Website Preview" },
  redirect_uri: clientCallback,
  scope: "email profile",
};

function client(options: {
  aal?: string;
  factors?: unknown[] | null;
  details?: unknown;
}) {
  return {
    rpc: vi.fn().mockResolvedValue({ error: null }),
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: { claims: { sub: "user-1", aal: options.aal ?? "aal1" } },
      }),
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error: null }),
      mfa: {
        listFactors: vi.fn().mockResolvedValue(
          options.factors === null
            ? { data: null, error: new Error("network") }
            : { data: { all: options.factors ?? [] }, error: null },
        ),
      },
      oauth: {
        getAuthorizationDetails: vi
          .fn()
          .mockResolvedValue({ data: options.details ?? pending, error: null }),
        approveAuthorization: vi.fn().mockResolvedValue({
          data: { redirect_url: `${clientCallback}?code=approved&state=s` },
          error: null,
        }),
        denyAuthorization: vi.fn().mockResolvedValue({
          data: { redirect_url: `${clientCallback}?error=access_denied&state=s` },
          error: null,
        }),
      },
    },
  };
}

const verified = [{ id: "factor-1", status: "verified", factor_type: "totp" }];

function decision(value: "approve" | "deny") {
  return new Request("https://login-preview.example/api/oauth/decision", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      origin: "https://login-preview.example",
    },
    body: new URLSearchParams({
      authorization_id: "authorization-id",
      decision: value,
    }),
  });
}

beforeEach(() => {
  mocks.createServerSupabaseClient.mockReset();
  vi.stubEnv(
    "AUTH_ALLOWED_OAUTH_CLIENTS",
    JSON.stringify({ "website-preview": [clientCallback] }),
  );
  vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
  vi.stubEnv("AUTH_MFA_ATTEST_OAUTH", "true");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("consent with MFA on", () => {
  test("challenges an aal1 user with a factor before Supabase can auto-approve", async () => {
    const supabase = client({ factors: verified });
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:${challengeForConsent}`);
    expect(supabase.auth.oauth.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  test("fails closed when the factor list can't be read", async () => {
    const supabase = client({ factors: null });
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/error?reason=mfa_unavailable");
    expect(supabase.auth.oauth.getAuthorizationDetails).not.toHaveBeenCalled();
  });

  test("lets a user without a factor continue at aal1", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(client({ factors: [] }));
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).resolves.toBeTruthy();
  });

  test("attests an auto-approved request made from an aal2 session", async () => {
    const supabase = client({
      aal: "aal2",
      factors: verified,
      details: { redirect_url: `${clientCallback}?code=existing&state=s` },
    });
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:${clientCallback}?code=existing&state=s`);
    expect(supabase.rpc).toHaveBeenCalledWith("rc_attest_mfa_authorization", {
      p_authorization_id: "authorization-id",
    });
  });

  test("reads no factors and attests nothing while the flag is off", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "false");
    const supabase = client({
      factors: verified,
      details: { redirect_url: `${clientCallback}?code=existing&state=s` },
    });
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).rejects.toThrow(`NEXT_REDIRECT:${clientCallback}?code=existing&state=s`);
    expect(supabase.auth.mfa.listFactors).not.toHaveBeenCalled();
    expect(supabase.rpc).not.toHaveBeenCalled();
  });
});

describe("consent decision with MFA on", () => {
  test("sends an aal1 approval back through the challenge", async () => {
    const supabase = client({ factors: verified });
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);
    const response = await POST(decision("approve"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      `https://login-preview.example${challengeForConsent}`,
    );
    expect(supabase.auth.oauth.approveAuthorization).not.toHaveBeenCalled();
  });

  test("returns 503 instead of approving when factors can't be read", async () => {
    const supabase = client({ factors: null });
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);
    const response = await POST(decision("approve"));
    expect(response.status).toBe(503);
    expect(supabase.auth.oauth.approveAuthorization).not.toHaveBeenCalled();
  });

  test("lets an aal1 user cancel without a challenge", async () => {
    const supabase = client({ factors: verified });
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);
    const response = await POST(decision("deny"));
    expect(response.headers.get("location")).toContain("error=access_denied");
    expect(supabase.rpc).not.toHaveBeenCalled();
  });

  test("approves and attests from an aal2 session", async () => {
    const supabase = client({ aal: "aal2", factors: verified });
    mocks.createServerSupabaseClient.mockResolvedValue(supabase);
    const response = await POST(decision("approve"));
    expect(response.headers.get("location")).toContain("code=approved");
    expect(supabase.rpc).toHaveBeenCalledWith("rc_attest_mfa_authorization", {
      p_authorization_id: "authorization-id",
    });
  });
});

describe("sign-in callback with MFA on", () => {
  test("routes a Google sign-in with a factor through the challenge", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(client({ factors: verified }));
    const response = await callback(
      new Request(
        "https://login-preview.example/auth/callback?code=pkce&next=%2Flauncher",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "https://login-preview.example/mfa/challenge?return_to=%2Flauncher",
    );
  });

  test("falls through to next when factors can't be read", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(client({ factors: null }));
    const response = await callback(
      new Request(
        "https://login-preview.example/auth/callback?code=pkce&next=%2Flauncher",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "https://login-preview.example/launcher",
    );
  });
});
