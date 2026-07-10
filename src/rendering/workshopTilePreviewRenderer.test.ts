import { describe, expect, it } from "vitest";
import { computeThumbnailCameraDistance } from "./workshopTilePreviewRenderer";

describe("workshop model thumbnail camera", () => {
  it("moves farther away for wider and taller model bounds", () => {
    const baseline = computeThumbnailCameraDistance({ x: 4, y: 1, z: 4 }, 2);
    expect(computeThumbnailCameraDistance({ x: 7, y: 1, z: 4 }, 2)).toBeGreaterThan(baseline);
    expect(computeThumbnailCameraDistance({ x: 4, y: 3, z: 4 }, 2)).toBeGreaterThan(baseline);
  });

  it("uses more distance in a narrower preview", () => {
    const size = { x: 4.25, y: 1.2, z: 4.25 };
    expect(computeThumbnailCameraDistance(size, 0.9)).toBeGreaterThan(
      computeThumbnailCameraDistance(size, 2.2),
    );
  });
});
