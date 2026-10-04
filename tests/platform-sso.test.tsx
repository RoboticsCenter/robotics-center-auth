import {
  Children,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from "react";
import { afterEach, describe, expect, test, vi } from "vitest";
import HomePage from "@/app/page";
import LauncherPage from "@/app/launcher/page";
import { ApplicationUnavailable } from "@/components/application-unavailable";
import { PlatformSignIn } from "@/components/platform-sign-in";
import {
  PLATFORM_SSO_START_URL,
  isAllowedPlatformSsoTarget,
  isPlatformSsoEnabled,
  platformSignInHref,
} from "@/lib/auth/platform-sso";

const START = "https://platform.roboticscenter.ai/api/auth/oidc/start?next=/data";

function elements(node: ReactNode, type: unknown): ReactElement[] {
  if (!isValidElement(node)) return [];
  const current = node.type === type ? [node] : [];
  const props = node.props as { children?: ReactNode };
  return [
    ...current,
    ...Children.toArray(props.children).flatMap((child) =>
      elements(child, type),
    ),
  ];
}

function hrefs(node: ReactNode): unknown[] {
  return elements(node, "a").map(
    (element) => (element.props as { href?: unknown }).href,
  );
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!isValidElement(node)) return "";
  return Children.toArray((node.props as { children?: ReactNode }).children)
    .map(textContent)
    .join(" ");
}

async function renderHome(
  searchParams: Record<string, string | string[] | undefined>,
): Promise<ReactElement<Record<string, unknown>>> {
  return (await HomePage({
    searchParams: Promise.resolve(searchParams),
  })) as ReactElement<Record<string, unknown>>;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("platform SSO flag", () => {
  test("is off unless NEXT_PUBLIC_PLATFORM_SSO_ENABLED is exactly true", () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_SSO_ENABLED", "");
    expect(isPlatformSsoEnabled()).toBe(false);
    expect(platformSignInHref()).toBeNull();
    for (const value of ["1", "TRUE", "yes", "false"]) {
      vi.stubEnv("NEXT_PUBLIC_PLATFORM_SSO_ENABLED", value);
      expect(isPlatformSsoEnabled()).toBe(false);
    }
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_SSO_ENABLED", "true");
    expect(platformSignInHref()).toBe(START);
  });

  test("allows only the exact Platform OIDC start URL", () => {
    expect(PLATFORM_SSO_START_URL).toBe(START);
    expect(isAllowedPlatformSsoTarget(START)).toBe(true);
    for (const value of [
      "https://platform.roboticscenter.ai/api/auth/oidc/start?next=//evil.example",
      "https://platform.roboticscenter.ai/api/auth/oidc/start?next=/data&x=1",
      "https://platform.roboticscenter.ai.evil.example/api/auth/oidc/start?next=/data",
      "http://platform.roboticscenter.ai/api/auth/oidc/start?next=/data",
      "https://platform.roboticscenter.ai/",
    ]) {
      expect(isAllowedPlatformSsoTarget(value)).toBe(false);
    }
  });
});

describe("launcher with platform SSO", () => {
  test("off: Platform stays disabled with the current copy", () => {
    const page = LauncherPage();
    expect(hrefs(page)).toEqual(["https://www.roboticscenter.ai/"]);
    expect(textContent(page)).toContain("Platform and CenterOS sign-in will be added separately");
  });

  test("on: Platform links to its OIDC start route; CenterOS stays disabled", () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_SSO_ENABLED", "true");
    const page = LauncherPage();
    expect(hrefs(page)).toEqual(["https://www.roboticscenter.ai/", START]);
    expect(
      elements(page, "div").filter(
        (item) => (item.props as Record<string, unknown>)["aria-disabled"] === "true",
      ),
    ).toHaveLength(1);
    const copy = textContent(page);
    expect(copy).toContain("Website and Data Platform access are available now");
    expect(copy).toContain("centeros.roboticscenter.ai · Sign-in not available yet");
  });
});

describe("legacy Platform landing with platform SSO", () => {
  test("off: ?redirect=https://platform… keeps the unavailable page", async () => {
    const page = await renderHome({ redirect: "https://platform.roboticscenter.ai/" });
    expect(page.type).toBe(ApplicationUnavailable);
  });

  test("on: ?redirect= and ?source=platform offer the fixed start URL, never the query value", async () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_SSO_ENABLED", "true");
    for (const params of [
      { redirect: "https://platform.roboticscenter.ai/data?next=https://evil.example" },
      { source: "platform" },
    ]) {
      const page = await renderHome(params);
      expect(page.type).toBe(PlatformSignIn);
      expect(page.props).toEqual({ href: START });
      expect(hrefs(PlatformSignIn({ href: START }))).toEqual([
        START,
        "https://www.roboticscenter.ai/",
      ]);
    }
  });

  test("on: CenterOS and look-alike origins are unaffected", async () => {
    vi.stubEnv("NEXT_PUBLIC_PLATFORM_SSO_ENABLED", "true");
    expect((await renderHome({ source: "centeros" })).type).toBe(ApplicationUnavailable);
    const lookalike = await renderHome({
      redirect: "https://platform.roboticscenter.ai.evil.example/",
    });
    expect(lookalike.type).not.toBe(PlatformSignIn);
    expect(lookalike.type).not.toBe(ApplicationUnavailable);
  });
});
