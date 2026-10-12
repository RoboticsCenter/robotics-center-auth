import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, test } from "vitest";
import LauncherPage from "@/app/launcher/page";
import { NavArrowIcon } from "@/components/icons";

function elements(node: ReactNode, type: ReactElement["type"]): ReactElement[] {
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

function props(element: ReactElement): Record<string, unknown> {
  return element.props as Record<string, unknown>;
}

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (!isValidElement(node)) return "";
  return Children.toArray(
    (node.props as { children?: ReactNode }).children,
  )
    .map(textContent)
    .join(" ");
}

describe("application launcher", () => {
  test("links the website and Data Platform; CenterOS waits for its SSO integration", () => {
    const page = LauncherPage();
    expect(elements(page, "a").map((item) => props(item).href)).toEqual([
      "https://www.roboticscenter.ai/",
      "https://platform.roboticscenter.ai/",
    ]);
    expect(
      elements(page, "div").filter(
        (item) => props(item)["aria-disabled"] === "true",
      ),
    ).toHaveLength(1);
  });

  test("uses same-origin POST for launcher sign out", () => {
    const [form] = elements(LauncherPage(), "form");
    expect(form?.props).toMatchObject({
      action: "/api/logout",
      method: "post",
    });
  });

  test("uses production-ready application availability copy", () => {
    const copy = textContent(LauncherPage());
    expect(copy).toContain("Choose an app");
    expect(copy).toContain("Website and Data Platform sign-in are available now.");
    expect(copy).toContain("Sign-in coming soon");
    expect(copy).not.toContain("access or refresh tokens");
    expect(copy).not.toContain("Authentication preview");
    expect(copy).not.toContain("being tested");
  });

  test("shows the navbar arrow only on the available application link", () => {
    const page = LauncherPage();
    const availableCards = elements(page, "a").filter(
      (item) => props(item).className === "app-card",
    );
    const unavailableCards = elements(page, "div").filter(
      (item) => props(item)["aria-disabled"] === "true",
    );

    expect(availableCards.map((card) => props(card).href)).toEqual([
      "https://www.roboticscenter.ai/",
      "https://platform.roboticscenter.ai/",
    ]);
    for (const card of availableCards) {
      expect(elements(card, NavArrowIcon)).toHaveLength(1);
    }
    expect(unavailableCards).toHaveLength(1);
    expect(unavailableCards.flatMap((card) => elements(card, NavArrowIcon))).toHaveLength(0);
  });
});
