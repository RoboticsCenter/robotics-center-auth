import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");
const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map(([, selector, body]) => ({
  selector: selector.trim(),
  body: body ?? "",
}));

describe("auth aside layout", () => {
  test("anchors the brand content independently of the auth form height", () => {
    const visibleAsideRules = rules.filter(({ selector, body }) =>
      selector.includes(".auth-aside") && !/display\s*:\s*none/.test(body),
    );

    expect(visibleAsideRules.length).toBeGreaterThanOrEqual(2);
    expect(visibleAsideRules[0]?.body).toMatch(/justify-content\s*:\s*flex-start/);
    for (const { body } of visibleAsideRules) {
      expect(body).toMatch(/padding-block-start\s*:\s*clamp\(/);
    }
  });
});
