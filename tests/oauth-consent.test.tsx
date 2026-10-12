import {
  Children,
  isValidElement,
  type ElementType,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ConsentActions } from "@/components/consent-actions";
import { ConsentCard } from "@/components/consent-card";

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
}));

import ConsentPage from "@/app/oauth/consent/page";

const callback = "https://website-preview.example/auth/sso/callback";

function client(details: unknown, signedIn = true) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue({
        data: signedIn ? { claims: { sub: "test-user" } } : {},
      }),
      oauth: {
        getAuthorizationDetails: vi.fn().mockResolvedValue({
          data: details,
          error: null,
        }),
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

beforeEach(() => {
  mocks.createServerSupabaseClient.mockReset();
  mocks.redirect.mockClear();
  vi.stubEnv(
    "AUTH_ALLOWED_OAUTH_CLIENTS",
    JSON.stringify({ "website-preview": [callback] }),
  );
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("OAuth consent page", () => {
  test("rejects a missing authorization id before Supabase", async () => {
    await expect(
      ConsentPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/error?reason=missing_authorization");
    expect(mocks.createServerSupabaseClient).not.toHaveBeenCalled();
  });

  test("sends a signed-out user to login with only the local consent path", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(client({}, false));
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).rejects.toThrow(
      "NEXT_REDIRECT:/?return_to=%2Foauth%2Fconsent%3Fauthorization_id%3Dauthorization-id",
    );
  });

  test.each([
    {
      authorization_id: "authorization-id",
      client: { id: "untrusted-client", name: "Untrusted" },
      redirect_uri: callback,
      scope: "email profile",
    },
    {
      authorization_id: "authorization-id",
      client: { id: "website-preview", name: "Website" },
      redirect_uri: `${callback}/extra`,
      scope: "email profile",
    },
  ])("rejects a client or callback absent from the exact allowlists", async (details) => {
    mocks.createServerSupabaseClient.mockResolvedValue(client(details));
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/error?reason=untrusted_client");
  });

  test("renders a POST consent form for a trusted pending authorization", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(
      client({
        authorization_id: "authorization-id",
        client: { id: "website-preview", name: "RCSV Website Preview" },
        redirect_uri: callback,
        scope: "email profile",
      }),
    );
    const page = await ConsentPage({
      searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
    });
    const actions = findElement(page, ConsentActions);
    expect(actions?.props).toMatchObject({
      authorizationId: "authorization-id",
    });
  });

  test("allows only an allowlisted callback for an already-approved request", async () => {
    mocks.createServerSupabaseClient.mockResolvedValue(
      client({ redirect_url: `${callback}?code=existing&state=state` }),
    );
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).rejects.toThrow(
      `NEXT_REDIRECT:${callback}?code=existing&state=state`,
    );

    mocks.createServerSupabaseClient.mockResolvedValue(
      client({ redirect_url: "https://evil.example/steal?code=secret" }),
    );
    await expect(
      ConsentPage({
        searchParams: Promise.resolve({ authorization_id: "authorization-id" }),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/error?reason=untrusted_client");
  });

  test.each([
    ["production", "centeros://auth/callback"],
    ["staging", "centeros-staging://auth/callback"],
  ])(
    "requires a user gesture to reopen %s CenterOS for an already-approved request",
    async (_environment, centerOSCallback) => {
      const redirectUrl = `${centerOSCallback}?code=existing&state=state`;
      vi.stubEnv(
        "AUTH_ALLOWED_OAUTH_CLIENTS",
        JSON.stringify({ "centeros-preview": [centerOSCallback] }),
      );
      mocks.createServerSupabaseClient.mockResolvedValue(
        client({ redirect_url: redirectUrl }),
      );

      const page = await ConsentPage({
        searchParams: Promise.resolve({
          authorization_id: "authorization-id",
        }),
      });
      const consentCard = findElement(page, ConsentCard);
      const launch = findElement(page, "a") as ReactElement<{
        children?: ReactNode;
        className?: string;
        href?: string;
      }> | null;

      expect(launch?.props).toMatchObject({
        className: "primary-button button-link",
        href: redirectUrl,
      });
      expect(launch?.props.children).toBe("Open CenterOS");
      expect(consentCard?.props).toMatchObject({
        clientName: "CenterOS",
        scopes: [],
        title: "Open CenterOS",
      });
      expect(mocks.redirect).not.toHaveBeenCalled();
    },
  );
});
