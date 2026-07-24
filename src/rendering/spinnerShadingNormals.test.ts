import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { applySpinnerShadingNormals } from "./spinnerShadingNormals";

describe("spinner shading normals", () => {
  it("smooths duplicated vertices across a shallow fold", () => {
    const geometry = createFoldGeometry(10);
    const normalBefore = geometry.getAttribute("normal");
    const beforeA = readNormal(normalBefore, 1);
    const beforeB = readNormal(normalBefore, 3);
    expect(beforeA.angleTo(beforeB)).toBeGreaterThan(THREE.MathUtils.degToRad(9));

    applySpinnerShadingNormals(geometry);

    const normalAfter = geometry.getAttribute("normal");
    const afterA = readNormal(normalAfter, 1);
    const afterB = readNormal(normalAfter, 3);
    expect(afterA.angleTo(afterB)).toBeCloseTo(0, 5);
    expect(readNormal(normalAfter, 0).angleTo(afterA)).toBeGreaterThan(0.01);
  });

  it("preserves duplicated normals across a hard fold", () => {
    const geometry = createFoldGeometry(40);

    applySpinnerShadingNormals(geometry);

    const normal = geometry.getAttribute("normal");
    expect(readNormal(normal, 1).angleTo(readNormal(normal, 3)))
      .toBeCloseTo(THREE.MathUtils.degToRad(40), 5);
  });

  it("changes only the normal attribute", () => {
    const geometry = new THREE.PlaneGeometry(2, 2, 2, 2);
    const position = geometry.getAttribute("position");
    const uv = geometry.getAttribute("uv");
    const index = geometry.getIndex();
    const normal = geometry.getAttribute("normal");
    const positionValues = Array.from(position.array);
    const uvValues = Array.from(uv.array);
    const indexValues = index ? Array.from(index.array) : null;

    applySpinnerShadingNormals(geometry);

    expect(geometry.getAttribute("position")).toBe(position);
    expect(geometry.getAttribute("uv")).toBe(uv);
    expect(geometry.getIndex()).toBe(index);
    expect(geometry.getAttribute("normal")).not.toBe(normal);
    expect(geometry.getAttribute("normal").count).toBe(normal.count);
    expect(Array.from(position.array)).toEqual(positionValues);
    expect(Array.from(uv.array)).toEqual(uvValues);
    expect(index ? Array.from(index.array) : null).toEqual(indexValues);
  });
});

function createFoldGeometry(angleDegrees: number): THREE.BufferGeometry {
  const height = Math.tan(THREE.MathUtils.degToRad(angleDegrees)) / Math.SQRT2;
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute([
    0, 0, 0,
    1, 0, 0,
    0, 1, 0,
    1, 0, 0,
    1, 1, height,
    0, 1, 0,
  ], 3));
  geometry.computeVertexNormals();
  return geometry;
}

function readNormal(attribute: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, index: number): THREE.Vector3 {
  return new THREE.Vector3().fromBufferAttribute(attribute, index);
}
