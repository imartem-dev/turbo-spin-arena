import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { WebGLProgramParametersWithUniforms } from "three/src/renderers/webgl/WebGLPrograms.js";
import { modelCatalog } from "../progression/catalog";
import {
  createAnimeFillMaterial,
  createAnimeSpinnerVisual,
  isAnimeSpinnerOutline,
  prepareSpinnerModel,
} from "./animeSpinnerMaterial";
import { AnimeOutlinePass } from "./animeOutlinePass";
import { EnemySpinnerInstancedModel } from "./enemySpinnerInstancedModel";
import { spinnerModelAssets } from "./spinnerModelLoader";

describe("anime spinner rendering", () => {
  it("normalizes a model to the requested horizontal diameter and ground level", () => {
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(4, 1, 2), new THREE.MeshBasicMaterial()));
    const prepared = prepareSpinnerModel(source, 0, 2);
    prepared.root.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(prepared.root);
    const size = bounds.getSize(new THREE.Vector3());
    expect(Math.max(size.x, size.z)).toBeCloseTo(2, 5);
    expect(bounds.min.y).toBeCloseTo(0, 5);
  });

  it("uses the selected color without adding a geometry outline mesh", () => {
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(2, 0.4, 2), new THREE.MeshBasicMaterial({ color: "#ffffff" })));
    const visual = createAnimeSpinnerVisual(source, 0, 2, "#8d3fd1");
    const meshes: THREE.Mesh[] = [];
    visual.root.traverse((object) => {
      if (object instanceof THREE.Mesh) meshes.push(object);
    });
    const fill = meshes.find((mesh) => mesh.userData.spinnerFill === true)?.material as THREE.MeshBasicMaterial;
    expect(fill?.color.getHexString()).toBe("8d3fd1");
    expect(meshes.some((mesh) => isAnimeSpinnerOutline(mesh))).toBe(false);
    expect(visual.root.userData.spinnerScreenOutline).toBe(true);
    visual.dispose();
  });

  it("does not create geometry outline shells for a model with multiple material slots", () => {
    const materials = ["M_Color_1", "M_Color_2", "M_Base"].map((name) => {
      const material = new THREE.MeshBasicMaterial();
      material.name = name;
      return material;
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), materials);
    const source = new THREE.Group();
    source.add(mesh);

    const visual = createAnimeSpinnerVisual(source, 0, 2, ["#ff0000", "#00ff00", "#0000ff"]);
    const outlines: THREE.Mesh[] = [];
    visual.root.traverse((object) => {
      if (object instanceof THREE.Mesh && isAnimeSpinnerOutline(object)) outlines.push(object);
    });

    expect(outlines).toHaveLength(0);
    visual.dispose();
  });

  it("maps the four catalog slots to the shipped GLB assets", () => {
    expect(modelCatalog.map((item) => item.assetKey)).toEqual(["spinner2", "spinner33", "spinner44", "spinner5"]);
    expect(modelCatalog.every((item) => item.available === true)).toBe(true);
    expect(Object.values(spinnerModelAssets).every((asset) => asset.outline === true)).toBe(true);
  });

  it("maps Paint_1, Paint_2 and Paint_3 to independent colors", () => {
    const source = new THREE.Group();
    for (const name of ["Paint_1", "Paint_2", "Paint_3"]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshBasicMaterial());
      mesh.name = name;
      source.add(mesh);
    }
    const visual = createAnimeSpinnerVisual(source, 0, 2, ["#ff0000", "#00ff00", "#0000ff"]);
    const colors = new Map<string, string>();
    visual.root.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object.userData.spinnerFill !== true) return;
      colors.set(object.name, (object.material as THREE.MeshBasicMaterial).color.getHexString());
    });
    expect(colors.get("Paint_1")).toBe("ff0000");
    expect(colors.get("Paint_2")).toBe("00ff00");
    expect(colors.get("Paint_3")).toBe("0000ff");
    visual.dispose();
  });

  it("maps M_Color_1, M_Color_2 and M_Base to independent colors", () => {
    const materials = ["M_Color_1", "M_Color_2", "M_Base"].map((name) => {
      const material = new THREE.MeshBasicMaterial();
      material.name = name;
      return material;
    });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), materials);
    const source = new THREE.Group();
    source.add(mesh);
    const visual = createAnimeSpinnerVisual(source, 0, 2, ["#ff0000", "#00ff00", "#0000ff"]);
    const visualMeshes: THREE.Mesh[] = [];
    visual.root.traverse((object) => {
      if (object instanceof THREE.Mesh && object.userData.spinnerFill === true) visualMeshes.push(object);
    });
    expect((visualMeshes[0].material as THREE.MeshBasicMaterial[]).map((material) => material.color.getHexString()))
      .toEqual(["ff0000", "00ff00", "0000ff"]);
    visual.dispose();
  });

  it("installs visible anime bands, rim light and highlight shader code", () => {
    const material = createAnimeFillMaterial(new THREE.MeshBasicMaterial());
    const shader = {
      uniforms: {},
      vertexShader: `
        #include <common>
        void main() {
          #include <begin_vertex>
          #include <project_vertex>
        }
      `,
      fragmentShader: `
        #include <common>
        void main() {
          vec4 diffuseColor = vec4(1.0);
          #include <color_fragment>
        }
      `,
    } as WebGLProgramParametersWithUniforms;

    material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);

    expect(shader.vertexShader).toContain("vAnimeViewPosition");
    expect(shader.fragmentShader).toContain("animeShadowBand");
    expect(shader.fragmentShader).toContain("animeTopBias");
    expect(shader.fragmentShader).toContain("animeRim");
    expect(shader.fragmentShader).toContain("animeSpecular");
    expect(material.customProgramCacheKey()).toBe("anime-spinner-static-v3");
    material.dispose();
  });

  it("reuses anime outline pass resources across resizes", () => {
    const pass = new AnimeOutlinePass({ outerWidth: 3, innerWidth: 1 });
    const resources = pass.getResourceSnapshot();

    expect(pass.setSize(128, 64)).toBe(true);
    expect(pass.setSize(128, 64)).toBe(false);
    expect(pass.getResourceSnapshot().maskTarget).toBe(resources.maskTarget);
    expect(pass.getResourceSnapshot().maskMaterial).toBe(resources.maskMaterial);
    expect(pass.getResourceSnapshot().compositeMaterial).toBe(resources.compositeMaterial);

    pass.dispose();
  });

  it("uses large normal jumps for screen-space inner anime outline edges", () => {
    const pass = new AnimeOutlinePass();
    const shader = pass.getResourceSnapshot().compositeMaterial.fragmentShader;

    expect(shader).toContain("outerEdge");
    expect(shader).toContain("innerEdge");
    expect(shader).toContain("normalDelta");
    expect(shader).toContain("normalEdge");
    expect(shader).not.toContain("depthEdge");
    expect(shader).not.toContain("oppositePair");

    pass.dispose();
  });

  it("returns enemy instanced fill meshes as outline targets after setting a model", () => {
    const textureLoad = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());
    const scene = new THREE.Scene();
    const model = new EnemySpinnerInstancedModel(scene, 2);
    const source = new THREE.Group();
    const material = new THREE.MeshBasicMaterial();
    material.name = "M_Color_1";
    source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), material));

    model.setModelSource(source, spinnerModelAssets.spinner2, 0.72);

    const targets = model.getOutlineTargets();
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((target) => target instanceof THREE.InstancedMesh)).toBe(true);

    model.dispose();
    textureLoad.mockRestore();
  });
});
