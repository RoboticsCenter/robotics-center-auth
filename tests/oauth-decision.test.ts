import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createServerSupabaseClient: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createServerSupabaseClient: mocks.createServerSupabaseClient,
}));

import { POST } from "@/app/api/oauth/decision/route";

const callback = "https://website-preview.example/auth/sso/callback";

function request(input?: {
  decision?: string;
  authorizationId?: string;
  origin?: string;
}) {
  const body = new URLSearchParams();
  if (input?.authorizationId !== undefined) {
    body.set("authorization_id", input.authorizationId);
  }
  if (input?.decision !== undefined) body.set("decision", input.decision);
  const headers = new Headers({
    "content-type": "application/x-www-form-urlencoded",
  });
  if (input?.origin !== undefined) headers.set("origin", input.origin);
  return new Request("https://login-preview.example/api/oauth/decision", {
    method: "POST",
    headers,
    body,
  });
}

function trustedDetails(overrides?: { clientId?: string; redirectUri?: string }) {
  return {
    data: {
      authorization_id: "authorization-id",
      client: {
        id: overrides?.clientId ?? "website-preview",
        name: "RCSV Website Preview",
      },
      redirect_uri: overrides?.redirectUri ?? callback,
      scope: "email profile",
    },
    error: null,
  };
}

function authClient(options?: { details?: ReturnType<typeof trustedDetails> }) {
  return {
    auth: {
      oauth: {
        getAuthorizationDetails: vi
          .fn()
          .mockResolvedValue(options?.details ?? trustedDetails()),
        approveAuthorization: vi.fn().mockResolvedValue({
          data: { redirect_url: `${callback}?code=approved&state=state` },
          error: null,
        }),
        denyAuthorization: vi.fn().mockResolvedValue({
          data: { redirect_url: `${callback}?error=access_denied&state=state` },
          error: null,
        }),
      },
    },
  };
}

beforeEach(() => {
  mocks.createServerSupabaseClient.mockReset();
  vi.stubEnv(
    "AUTH_ALLOWED_OAUTH_CLIENTS",
    JSON.stringify({ "website-preview": [callback] }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OAuth consent decision", () => {
  test.each([undefined, "https://evil.example"])(
    "rejects missing or cross-origin Origin %s before Supabase",
    async (origin) => {
      const response = await POST(
        request({
          origin,
          authorizationId: "authorization-id",
          decision: "approve",
        }),
      );
      expect(response.status).toBe(403);
      expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
    },
  );

  test.each([
    { authorizationId: "", decision: "approve" },
    { authorizationId: "authorization-id", decision: "unexpected" },
  ])("rejects malformed form input before Supabase: $decision", async (input) => {
    const response = await POST(
      request({ ...input, origin: "https://login-preview.example" }),
    );
    expect(response.status).toBe(400);
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  test.each([
    trustedDetails({ clientId: "other-client" }),
    trustedDetails({ redirectUri: `${callback}/extra` }),
  ])("requires exact client and callback allowlist matches", async (details) => {
    mocks.createServerSupabaseClient.mockResolvedValue(
      authClient({ details }),
    );
    const response = await POST(
      request({
        origin: "https://login-preview.example",
        authorizationId: "authorization-id",
        decision: "approve",
      }),
    );
    expect(response.status).toBe(403);
  });

  test.each([
    ["approve", "approveAuthorization", "code=approved"],
    ["deny", "denyAuthorization", "error=access_denied"],
  ] as const)(
    "%s calls the matching Supabase operation and preserves auth headers",
    async (decision, method, query) => {
      const client = authClient();
      mocks.createServerSupabaseClient.mockImplementation(
        async (responseHeaders: Headers) => {
          responseHeaders.set("Cache-Control", "private, no-store");
          return client;
        },
      );
      const response = await POST(
        request({
          origin: "https://login-preview.example",
          authorizationId: "authorization-id",
          decision,
        }),
      );
      expect(client.auth.oauth[method]).toHaveBeenCalledWith(
        "authorization-id",
        { skipBrowserRedirect: true },
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toContain(query);
      expect(response.headers.get("cache-control")).toBe("private, no-store");
    },
  );

  test.each([
    ["production", "centeros-desktop", "centeros://auth/callback"],
    [
      "staging",
      "centeros-staging-desktop",
      "centeros-staging://auth/callback",
    ],
  ])(
    "redirects an approved %s CenterOS client to its exact private-use callback",
    async (_environment, clientId, centerOsCallback) => {
      vi.stubEnv(
        "AUTH_ALLOWED_OAUTH_CLIENTS",
        JSON.stringify({ [clientId]: [centerOsCallback] }),
      );
      const client = authClient({
        details: trustedDetails({
          clientId,
          redirectUri: centerOsCallback,
        }),
      });
      client.auth.oauth.approveAuthorization.mockResolvedValue({
        data: {
          redirect_url: `${centerOsCallback}?code=approved&state=state`,
        },
        error: null,
      });
      mocks.createServerSupabaseClient.mockResolvedValue(client);

      const response = await POST(
        request({
          origin: "https://login-preview.example",
          authorizationId: "authorization-id",
          decision: "approve",
        }),
      );

      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe(
        `${centerOsCallback}?code=approved&state=state`,
      );
    },
  );

  test.each([
    [
      "production",
      "centeros-desktop",
      "centeros://auth/callback",
      "centeros-staging://auth/callback",
    ],
    [
      "staging",
      "centeros-staging-desktop",
      "centeros-staging://auth/callback",
      "centeros://auth/callback",
    ],
  ])(
    "rejects a provider redirect from the other CenterOS environment for a %s request",
    async (_environment, clientId, expectedCallback, returnedCallback) => {
      vi.stubEnv(
        "AUTH_ALLOWED_OAUTH_CLIENTS",
        JSON.stringify({
          "centeros-desktop": ["centeros://auth/callback"],
          "centeros-staging-desktop": [
            "centeros-staging://auth/callback",
          ],
        }),
      );
      const client = authClient({
        details: trustedDetails({
          clientId,
          redirectUri: expectedCallback,
        }),
      });
      client.auth.oauth.approveAuthorization.mockResolvedValue({
        data: {
          redirect_url: `${returnedCallback}?code=approved&state=state`,
        },
        error: null,
      });
      mocks.createServerSupabaseClient.mockResolvedValue(client);

      const response = await POST(
        request({
          origin: "https://login-preview.example",
          authorizationId: "authorization-id",
          decision: "approve",
        }),
      );

      expect(response.status).toBe(400);
      await expect(response.json()).resolves.toEqual({
        error: "Authorization failed",
      });
    },
  );

  test("rejects a provider redirect outside the callback allowlist", async () => {
    const client = authClient();
    client.auth.oauth.approveAuthorization.mockResolvedValue({
      data: { redirect_url: "https://evil.example/steal?code=secret" },
      error: null,
    });
    mocks.createServerSupabaseClient.mockResolvedValue(client);
    const response = await POST(
      request({
        origin: "https://login-preview.example",
        authorizationId: "authorization-id",
        decision: "approve",
      }),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Authorization failed",
    });
  });

  test("rejects a provider redirect assigned to a different trusted client", async () => {
    const centerosCallback =
      "https://centeros-preview.example/auth/sso/callback";
    vi.stubEnv(
      "AUTH_ALLOWED_OAUTH_CLIENTS",
      JSON.stringify({
        "website-preview": [callback],
        "centeros-preview": [centerosCallback],
      }),
    );
    const client = authClient();
    client.auth.oauth.approveAuthorization.mockResolvedValue({
      data: { redirect_url: `${centerosCallback}?code=secret` },
      error: null,
    });
    mocks.createServerSupabaseClient.mockResolvedValue(client);

    const response = await POST(
      request({
        origin: "https://login-preview.example",
        authorizationId: "authorization-id",
        decision: "approve",
      }),
    );
    expect(response.status).toBe(400);
  });
});
