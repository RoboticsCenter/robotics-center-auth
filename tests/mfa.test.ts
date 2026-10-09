import { afterEach, describe, expect, test, vi } from "vitest";
import {
  attestMfaAuthorization,
  isMfaEnabled,
  isOAuthAttestationEnabled,
  mfaChallengePath,
  mfaStepUpRedirect,
  needsMfaChallenge,
  readMfaStatus,
} from "@/lib/auth/mfa";
import { normalizedTotpCode } from "@/lib/auth/mfa-errors";

function factorsClient(all: unknown[] | null, error: unknown = null) {
  return {
    auth: {
      mfa: {
        listFactors: vi
          .fn()
          .mockResolvedValue({ data: all ? { all } : null, error }),
      },
    },
  };
}

const verifiedTotp = {
  id: "factor-1",
  status: "verified",
  factor_type: "totp",
  friendly_name: "Work phone",
  created_at: "2026-10-01T00:00:00Z",
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MFA flags", () => {
  test("are off unless set to exactly true", () => {
    expect(isMfaEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "TRUE");
    expect(isMfaEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
    expect(isMfaEnabled()).toBe(true);
  });

  test("OAuth attestation also needs MFA itself on", () => {
    vi.stubEnv("AUTH_MFA_ATTEST_OAUTH", "true");
    expect(isOAuthAttestationEnabled()).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
    expect(isOAuthAttestationEnabled()).toBe(true);
  });
});

describe("MFA status", () => {
  test("splits verified factors from abandoned TOTP setups", async () => {
    const status = await readMfaStatus(
      factorsClient([
        verifiedTotp,
        { id: "stale", status: "unverified", factor_type: "totp" },
        { id: "phone", status: "unverified", factor_type: "phone" },
      ]),
    );
    expect(status.verified).toEqual([
      {
        id: "factor-1",
        friendlyName: "Work phone",
        factorType: "totp",
        createdAt: "2026-10-01T00:00:00Z",
      },
    ]);
    expect(status.unverifiedTotpIds).toEqual(["stale"]);
  });

  test("throws rather than reporting no factors when the lookup fails", async () => {
    await expect(
      readMfaStatus(factorsClient(null, new Error("network"))),
    ).rejects.toThrow();
  });

  test("needs a challenge only for aal1 sessions with a verified factor", () => {
    const enrolled = { verified: [{ id: "f" }], unverifiedTotpIds: [] } as never;
    const none = { verified: [], unverifiedTotpIds: [] };
    expect(needsMfaChallenge({ aal: "aal1" }, enrolled)).toBe(true);
    expect(needsMfaChallenge({}, enrolled)).toBe(true);
    expect(needsMfaChallenge({ aal: "aal2" }, enrolled)).toBe(false);
    expect(needsMfaChallenge({ aal: "aal1" }, none)).toBe(false);
  });

  test("challenge path keeps only a portal-local return", () => {
    expect(mfaChallengePath("/oauth/consent?authorization_id=a")).toBe(
      "/mfa/challenge?return_to=%2Foauth%2Fconsent%3Fauthorization_id%3Da",
    );
    expect(mfaChallengePath("https://evil.example/")).toBe(
      "/mfa/challenge?return_to=%2Flauncher",
    );
    expect(mfaChallengePath("//evil.example")).toBe(
      "/mfa/challenge?return_to=%2Flauncher",
    );
  });
});

describe("MFA step-up", () => {
  test("does nothing and reads nothing while the flag is off", async () => {
    const client = factorsClient([verifiedTotp]);
    await expect(
      mfaStepUpRedirect(client, { aal: "aal1" }, "/launcher"),
    ).resolves.toBeNull();
    expect(client.auth.mfa.listFactors).not.toHaveBeenCalled();
  });

  test("sends an aal1 session with a verified factor to the challenge", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
    await expect(
      mfaStepUpRedirect(factorsClient([verifiedTotp]), { aal: "aal1" }, "/launcher"),
    ).resolves.toBe("/mfa/challenge?return_to=%2Flauncher");
    await expect(
      mfaStepUpRedirect(factorsClient([]), { aal: "aal1" }, "/launcher"),
    ).resolves.toBeNull();
  });

  test("skips the factor lookup for an aal2 session", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
    const client = factorsClient([verifiedTotp]);
    await expect(
      mfaStepUpRedirect(client, { aal: "aal2" }, "/launcher"),
    ).resolves.toBeNull();
    expect(client.auth.mfa.listFactors).not.toHaveBeenCalled();
  });
});

describe("OAuth MFA attestation", () => {
  function rpcClient(error: unknown = null) {
    return { rpc: vi.fn().mockResolvedValue({ error }) };
  }

  test("is not sent while either flag is off", async () => {
    const client = rpcClient();
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
    await expect(
      attestMfaAuthorization(client, { aal: "aal2" }, "authorization-id"),
    ).resolves.toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();
  });

  test("is sent only from an aal2 session", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
    vi.stubEnv("AUTH_MFA_ATTEST_OAUTH", "true");
    const client = rpcClient();
    await expect(
      attestMfaAuthorization(client, { aal: "aal1" }, "authorization-id"),
    ).resolves.toBe(false);
    expect(client.rpc).not.toHaveBeenCalled();

    await expect(
      attestMfaAuthorization(client, { aal: "aal2" }, "authorization-id"),
    ).resolves.toBe(true);
    expect(client.rpc).toHaveBeenCalledWith("rc_attest_mfa_authorization", {
      p_authorization_id: "authorization-id",
    });
  });

  test("reports a database refusal without throwing", async () => {
    vi.stubEnv("NEXT_PUBLIC_AUTH_MFA_ENABLED", "true");
    vi.stubEnv("AUTH_MFA_ATTEST_OAUTH", "true");
    await expect(
      attestMfaAuthorization(rpcClient({ code: "42501" }), { aal: "aal2" }, "a"),
    ).resolves.toBe(false);
    const throwing = { rpc: vi.fn().mockRejectedValue(new Error("down")) };
    await expect(
      attestMfaAuthorization(throwing, { aal: "aal2" }, "a"),
    ).resolves.toBe(false);
  });
});

describe("TOTP code input", () => {
  test.each([
    ["123456", "123456"],
    ["123 456", "123456"],
    [" 123456 ", "123456"],
    ["12345", null],
    ["1234567", null],
    ["12345a", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(normalizedTotpCode(input)).toBe(expected);
  });
});
