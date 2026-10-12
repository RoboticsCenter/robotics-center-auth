import { Children, isValidElement, type ReactElement, type ReactNode } from "react";
import { afterEach, describe, expect, test, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => { throw new Error("NOT_FOUND"); },
}));

import DesignPreviewPage from "@/app/design-preview/page";
import { ButtonPreview } from "@/app/design-preview/button-preview";

function buttons(node: ReactNode): ReactElement[] {
  if (!isValidElement(node)) return [];
  const props = node.props as { children?: ReactNode };
  return [
    ...(node.type === "button" ? [node] : []),
    ...Children.toArray(props.children).flatMap(buttons),
  ];
}

function countForms(node: ReactNode): number {
  if (!isValidElement(node)) return 0;
  const props = node.props as { children?: ReactNode };
  return (node.type === "form" ? 1 : 0) +
    Children.toArray(props.children).reduce<number>(
      (total, child) => total + countForms(child), 0,
    );
}

afterEach(() => vi.unstubAllEnvs());

describe("local design preview boundary", () => {
  test.each([undefined, "consent", "buttons"])("is unavailable in production for %s", async (screen) => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(DesignPreviewPage({
      searchParams: Promise.resolve({ screen }),
    })).rejects.toThrow("NOT_FOUND");
  });

  test("does not render a submitting form for the consent sample", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const page = await DesignPreviewPage({
      searchParams: Promise.resolve({ screen: "consent" }),
    });
    expect(countForms(page)).toBe(0);
  });

  test("rejects unknown samples", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(DesignPreviewPage({
      searchParams: Promise.resolve({ screen: "unknown" }),
    })).rejects.toThrow("NOT_FOUND");
  });

  test("button samples have no forms, submissions, or account handlers", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const page = await DesignPreviewPage({
      searchParams: Promise.resolve({ screen: "buttons" }),
    });
    expect(page.type).toBe(ButtonPreview);
    const preview = ButtonPreview();
    expect(countForms(preview)).toBe(0);
    const controls = buttons(preview);
    expect(controls).toHaveLength(25);
    for (const control of controls) {
      const props = control.props as Record<string, unknown>;
      expect(props.type).toBe("button");
      expect(props.formAction).toBeUndefined();
      expect(props.onClick).toBeUndefined();
    }
    expect(controls.filter((control) => (control.props as Record<string, unknown>).disabled)).toHaveLength(3);
  });
});
