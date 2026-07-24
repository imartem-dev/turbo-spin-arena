import { describe, expect, it } from "vitest";
import { resolveHitSparkCount } from "./hitVfx";

describe("hit VFX spark count", () => {
  it("keeps ordinary hits at 16 sparks and allows 40 for lethal hits", () => {
    expect(resolveHitSparkCount(undefined)).toBe(16);
    expect(resolveHitSparkCount(40)).toBe(40);
    expect(resolveHitSparkCount(80)).toBe(40);
  });
});
