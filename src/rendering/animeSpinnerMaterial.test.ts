import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { WebGLProgramParametersWithUniforms } from "three/src/renderers/webgl/WebGLPrograms.js";
import { modelCatalog } from "../progression/catalog";
import {
  animeToonDefaults,
  createAnimeFillMaterial,
  createInstancedAnimeFillMaterial,
  createAnimeSpinnerVisual,
  getAnimeToonParameters,
  isAnimeSpinnerOutline,
  prepareSpinnerModel,
  resetAnimeToonParameters,
  setAnimeToonParameters,
} from "./animeSpinnerMaterial";
import {
  AnimeOutlinePass,
  animeOutlineDefaults,
  getAnimeOutlineParameters,
  resetAnimeOutlineParameters,
  setAnimeOutlineParameters,
} from "./animeOutlinePass";
import { EnemySpinnerInstancedModel } from "./enemySpinnerInstancedModel";
import { spinnerModelAssets } from "./spinnerModelLoader";

describe("anime spinner rendering", () => {
  it("keeps the approved toon parameters as defaults", () => {
    expect(animeToonDefaults).toEqual({
      topBiasStart: 0.34,
      topBiasEnd: 0.35,
      shadowThreshold: 0.8,
      shadowTopBiasWeight: 0.33,
      lightThreshold: 0.85,
      lightTopBiasWeight: 0.11,
      shadeBase: 0.14,
      shadeShadowWeight: 0.38,
      shadeLightWeight: 0.25,
      rimEdgeStart: 0,
      rimEdgeEnd: 1,
      rimLightStart: 0,
      rimLightEnd: 0.85,
      rimStrength: 0.13,
      specularStart: 0.23,
      specularEnd: 0.66,
      specularExponent: 51,
      specularStrength: 0.06,
      matcapUvScale: 0.2,
      matcapMinGain: 0.9,
      matcapMaxGain: 1.7,
    });
  });

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
    expect(shader.fragmentShader).toContain("smoothstep(uAnimeTopBiasStart, uAnimeTopBiasEnd, animeNormal.y)");
    expect(shader.fragmentShader).toContain("step(uAnimeShadowThreshold, animeLight + animeTopBias * uAnimeShadowTopBiasWeight)");
    expect(shader.fragmentShader).toContain("step(uAnimeLightThreshold, animeLight + animeTopBias * uAnimeLightTopBiasWeight)");
    expect(shader.fragmentShader).toContain("uAnimeShadeBase + animeShadowBand * uAnimeShadeShadowWeight + animeLightBand * uAnimeShadeLightWeight");
    expect(shader.fragmentShader).toContain("animeRim");
    expect(shader.fragmentShader).toContain("animeSpecular");
    expect(shader.fragmentShader).toContain("uSpinnerMatcap");
    expect(shader.fragmentShader).toContain("diffuseColor.rgb *= mix(uAnimeMatcapMinGain, uAnimeMatcapMaxGain, animeMatcapLuma)");
    expect(shader.fragmentShader).not.toContain("uSpinnerThemeMix");
    expect(shader.fragmentShader).not.toContain("animeThemeColor");
    expect(shader.uniforms.uAnimeTopBiasStart.value).toBe(animeToonDefaults.topBiasStart);
    expect(shader.uniforms.uAnimeMatcapMaxGain.value).toBe(animeToonDefaults.matcapMaxGain);
    expect(material.customProgramCacheKey()).toBe("anime-spinner-static-v8");
    material.dispose();
  });

  it("updates shared toon uniforms for static and instanced materials without recompiling", () => {
    resetAnimeToonParameters();
    const staticMaterial = createAnimeFillMaterial(new THREE.MeshBasicMaterial());
    const freezeMask = new THREE.Texture();
    const freezeDissolve = new THREE.Texture();
    const instancedMaterial = createInstancedAnimeFillMaterial(
      new THREE.MeshBasicMaterial(),
      true,
      { freezeMask, freezeDissolve },
    );
    const compile = (material: import("./animeSpinnerMaterial").AnimeFillMaterial) => {
      const shader = {
        uniforms: {},
        vertexShader: "#include <common>\n#include <begin_vertex>\n#include <project_vertex>",
        fragmentShader: "#include <common>\n#include <color_fragment>",
      } as WebGLProgramParametersWithUniforms;
      material.onBeforeCompile(shader, {} as THREE.WebGLRenderer);
      return shader;
    };
    const staticShader = compile(staticMaterial);
    const instancedShader = compile(instancedMaterial);
    const staticMaterialVersion = staticMaterial.version;
    const instancedMaterialVersion = instancedMaterial.version;

    try {
      setAnimeToonParameters({ shadeBase: 0.73, specularExponent: 42 });

      expect(staticShader.uniforms.uAnimeShadeBase.value).toBe(0.73);
      expect(instancedShader.uniforms.uAnimeShadeBase.value).toBe(0.73);
      expect(staticShader.uniforms.uAnimeSpecularExponent.value).toBe(42);
      expect(instancedShader.uniforms.uAnimeSpecularExponent.value).toBe(42);
      expect(staticMaterial.version).toBe(staticMaterialVersion);
      expect(instancedMaterial.version).toBe(instancedMaterialVersion);
      expect(getAnimeToonParameters()).toMatchObject({ shadeBase: 0.73, specularExponent: 42 });

      resetAnimeToonParameters();
      expect(staticShader.uniforms.uAnimeShadeBase.value).toBe(animeToonDefaults.shadeBase);
      expect(instancedShader.uniforms.uAnimeSpecularExponent.value).toBe(animeToonDefaults.specularExponent);
    } finally {
      resetAnimeToonParameters();
      staticMaterial.dispose();
      instancedMaterial.dispose();
      freezeMask.dispose();
      freezeDissolve.dispose();
    }
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

  it("shares live outline parameters across existing and future passes", () => {
    const first = new AnimeOutlinePass();
    const second = new AnimeOutlinePass();
    let future: AnimeOutlinePass | null = null;

    try {
      expect(animeOutlineDefaults).toEqual({
        outerWidth: 3,
        outerOpacity: 1,
        innerWidth: 0.5,
        normalThreshold: 0.1,
        innerOpacity: 0.8,
      });

      setAnimeOutlineParameters({ innerOpacity: 0.72, normalThreshold: 0.81 });
      expect(getAnimeOutlineParameters()).toMatchObject({ innerOpacity: 0.72, normalThreshold: 0.81 });
      expect(first.getResourceSnapshot().compositeMaterial.uniforms.uInnerOpacity.value).toBe(0.72);
      expect(second.getResourceSnapshot().compositeMaterial.uniforms.uNormalThreshold.value).toBe(0.81);

      future = new AnimeOutlinePass();
      expect(future.getResourceSnapshot().compositeMaterial.uniforms.uInnerOpacity.value).toBe(0.72);

      resetAnimeOutlineParameters();
      expect(first.getResourceSnapshot().compositeMaterial.uniforms.uInnerOpacity.value).toBe(animeOutlineDefaults.innerOpacity);
      expect(second.getResourceSnapshot().compositeMaterial.uniforms.uNormalThreshold.value).toBe(animeOutlineDefaults.normalThreshold);
      expect(future.getResourceSnapshot().compositeMaterial.uniforms.uInnerOpacity.value).toBe(animeOutlineDefaults.innerOpacity);
    } finally {
      resetAnimeOutlineParameters();
      first.dispose();
      second.dispose();
      future?.dispose();
    }
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
    const fillMaterial = (targets[0] as THREE.InstancedMesh).material as import("./animeSpinnerMaterial").AnimeFillMaterial;
    expect(fillMaterial.customProgramCacheKey()).toBe("anime-spinner-instanced-freeze-v8");

    model.dispose();
    textureLoad.mockRestore();
  });

  it("hides one enemy instance without hiding the others", () => {
    const textureLoad = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());
    const scene = new THREE.Scene();
    const model = new EnemySpinnerInstancedModel(scene, 2);
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshBasicMaterial()));
    model.setModelSource(source, spinnerModelAssets.spinner2, 0.72);
    const hidden = { spinGroup: new THREE.Group(), modelColor: "#fff", modelTint: null, renderVisible: false };
    const visible = { spinGroup: new THREE.Group(), modelColor: "#fff", modelTint: null, renderVisible: true };
    visible.spinGroup.position.x = 4;

    model.sync([hidden, visible]);
    const mesh = model.getOutlineTargets()[0] as THREE.InstancedMesh;
    const matrix = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    mesh.getMatrixAt(0, matrix);
    matrix.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
    expect(scale.lengthSq()).toBe(0);
    mesh.getMatrixAt(1, matrix);
    expect(new THREE.Vector3().setFromMatrixPosition(matrix).x).toBe(4);

    model.dispose();
    textureLoad.mockRestore();
  });

  it("applies freeze coverage immediately and keeps thawing gradual", () => {
    const textureLoad = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());
    const scene = new THREE.Scene();
    const model = new EnemySpinnerInstancedModel(scene, 1);
    const source = new THREE.Group();
    source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), new THREE.MeshBasicMaterial()));
    model.setModelSource(source, spinnerModelAssets.spinner2, 0.72);
    const spinner = {
      spinGroup: new THREE.Group(),
      modelColor: "#fff",
      modelTint: null,
      renderVisible: true,
      modelAssetKey: "spinner2" as const,
    };

    model.setFrozen(spinner, true);
    model.sync([spinner], 1 / 60);
    const mesh = model.getOutlineTargets()[0] as THREE.InstancedMesh;
    const freezeAttribute = mesh.geometry.getAttribute("instanceFreeze") as THREE.InstancedBufferAttribute;
    expect(freezeAttribute.getX(0)).toBe(1);

    model.setFrozen(spinner, false);
    model.sync([spinner], 0.375);
    expect(freezeAttribute.getX(0)).toBeCloseTo(0.5);

    model.dispose();
    textureLoad.mockRestore();
  });

  it("groups enemies by model while preserving per-instance colors", () => {
    const textureLoad = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());
    const scene = new THREE.Scene();
    const model = new EnemySpinnerInstancedModel(scene, 2);
    for (const asset of [spinnerModelAssets.spinner2, spinnerModelAssets.spinner33]) {
      const source = new THREE.Group();
      const material = new THREE.MeshBasicMaterial();
      material.name = "M_Color_1";
      source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), material));
      model.setModelSource(source, asset, 0.72);
    }
    const first = { spinGroup: new THREE.Group(), modelColor: "#ff0000", modelTint: null, renderVisible: true, modelAssetKey: "spinner2" as const };
    const second = { spinGroup: new THREE.Group(), modelColor: "#00ff00", modelTint: null, renderVisible: true, modelAssetKey: "spinner33" as const };

    model.sync([first, second]);

    const meshes = model.getOutlineTargets() as THREE.InstancedMesh[];
    expect(meshes).toHaveLength(2);
    expect(meshes.every((mesh) => mesh.count === 1)).toBe(true);
    const color = new THREE.Color();
    meshes.find((mesh) => mesh.name.includes("spinner2"))!.getColorAt(0, color);
    expect(color.getHexString()).toBe("ff0000");
    meshes.find((mesh) => mesh.name.includes("spinner33"))!.getColorAt(0, color);
    expect(color.getHexString()).toBe("00ff00");

    model.dispose();
    textureLoad.mockRestore();
  });

  it("applies separate instance colors to all three paint slots", () => {
    const textureLoad = vi.spyOn(THREE.TextureLoader.prototype, "load").mockImplementation(() => new THREE.Texture());
    const scene = new THREE.Scene();
    const model = new EnemySpinnerInstancedModel(scene, 1);
    const source = new THREE.Group();
    for (const materialName of ["M_Color_1", "M_Color_2", "M_Base"]) {
      const material = new THREE.MeshBasicMaterial();
      material.name = materialName;
      source.add(new THREE.Mesh(new THREE.BoxGeometry(1, 0.2, 1), material));
    }
    model.setModelSource(source, spinnerModelAssets.spinner2, 0.72);
    model.sync([{
      spinGroup: new THREE.Group(),
      modelColor: "#ff0000",
      modelColors: ["#ff0000", "#00ff00", "#0000ff"],
      modelTint: null,
      renderVisible: true,
      modelAssetKey: "spinner2",
    }]);

    const colors = (model.getOutlineTargets() as THREE.InstancedMesh[]).map((mesh) => {
      const color = new THREE.Color();
      mesh.getColorAt(0, color);
      return color.getHexString();
    });
    expect(colors).toEqual(["ff0000", "00ff00", "0000ff"]);

    model.dispose();
    textureLoad.mockRestore();
  });
});
