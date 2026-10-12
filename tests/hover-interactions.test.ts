import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selector: selector.trim(),
  body: body ?? "",
}));

describe("static hover interactions", () => {
  test("buttons change color or border without lifting or bouncing", () => {
    const buttonRules = rules.filter(({ selector }) =>
      selector.includes(":hover") &&
      [".primary-button", ".oauth-button", ".quiet-button"].some((name) =>
        selector.includes(`${name}:hover`),
      ),
    );
    expect(buttonRules.length).toBeGreaterThanOrEqual(3);
    for (const { body } of buttonRules) {
      expect(body).not.toMatch(/\b(?:transform|box-shadow)\s*:/);
    }
  });

  test("launcher cards stay still while the navbar-style arrow animates", () => {
    const cardRules = rules.filter(({ selector }) =>
      selector.includes(".app-card") &&
      selector.includes(":hover") &&
      !selector.includes(".app-arrow"),
    );
    expect(cardRules.length).toBeGreaterThan(0);
    for (const { body } of cardRules) {
      expect(body).not.toMatch(/\b(?:transform|box-shadow)\s*:/);
    }
    expect(css).toContain(".app-card:hover .app-arrow");
    expect(css).toContain("transform: translateX(var(--arrow-offset, -5px))");
    expect(css).toContain("transform 220ms cubic-bezier(0.22, 1, 0.36, 1)");
  });
});
