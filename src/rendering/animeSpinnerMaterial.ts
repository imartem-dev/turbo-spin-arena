import * as THREE from "three";
import { applySpinnerShadingNormals } from "./spinnerShadingNormals";

type SourceMaterial = THREE.Material & {
  color?: THREE.Color;
  map?: THREE.Texture | null;
  opacity?: number;
  transparent?: boolean;
  alphaTest?: number;
  vertexColors?: boolean;
};

export type AnimeFillMaterial = THREE.MeshBasicMaterial & {
  userData: {
    spinnerFill?: boolean;
    spinnerPaintable?: boolean;
    spinnerMatcapUniform?: THREE.IUniform<THREE.Texture>;
  };
};

export type PreparedSpinnerModel = {
  root: THREE.Group;
  diameter: number;
  hasPaintMarkers: boolean;
};

export type AnimeSpinnerVisual = {
  root: THREE.Group;
  setColors(colors: readonly [string, string, string]): void;
  setColor(color: string): void;
  dispose(): void;
};

export type InstancedAnimeOptions = {
  freezeMask: THREE.Texture;
  freezeDissolve: THREE.Texture;
};

export type AnimeToonParameters = {
  topBiasStart: number;
  topBiasEnd: number;
  shadowThreshold: number;
  shadowTopBiasWeight: number;
  lightThreshold: number;
  lightTopBiasWeight: number;
  shadeBase: number;
  shadeShadowWeight: number;
  shadeLightWeight: number;
  rimEdgeStart: number;
  rimEdgeEnd: number;
  rimLightStart: number;
  rimLightEnd: number;
  rimStrength: number;
  specularStart: number;
  specularEnd: number;
  specularExponent: number;
  specularStrength: number;
  matcapUvScale: number;
  matcapMinGain: number;
  matcapMaxGain: number;
};

export const animeToonDefaults: Readonly<AnimeToonParameters> = Object.freeze({
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

type AnimeToonParameterKey = keyof AnimeToonParameters;
type AnimeToonUniforms = { [Key in AnimeToonParameterKey]: THREE.IUniform<number> };

const animeToonParameters: AnimeToonParameters = { ...animeToonDefaults };
const animeToonUniforms = Object.fromEntries(
  (Object.keys(animeToonDefaults) as AnimeToonParameterKey[])
    .map((key) => [key, { value: animeToonDefaults[key] }]),
) as AnimeToonUniforms;

export function getAnimeToonParameters(): AnimeToonParameters {
  return { ...animeToonParameters };
}

export function setAnimeToonParameters(values: Partial<AnimeToonParameters>): void {
  for (const key of Object.keys(values) as AnimeToonParameterKey[]) {
    const value = values[key];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    animeToonParameters[key] = value;
    animeToonUniforms[key].value = value;
  }
}

export function resetAnimeToonParameters(): void {
  setAnimeToonParameters(animeToonDefaults);
}

const fallbackMatcap = new THREE.DataTexture(new Uint8Array([148, 136, 125, 255]), 1, 1);
fallbackMatcap.colorSpace = THREE.SRGBColorSpace;
fallbackMatcap.needsUpdate = true;
let spinnerMatcapTexture: THREE.Texture = fallbackMatcap;
const animeFillMaterials = new Set<AnimeFillMaterial>();

export function setAnimeSpinnerMatcapTexture(texture: THREE.Texture): void {
  spinnerMatcapTexture = texture;
  for (const material of animeFillMaterials) {
    if (material.userData.spinnerMatcapUniform) material.userData.spinnerMatcapUniform.value = texture;
  }
}

export function prepareSpinnerModel(
  source: THREE.Group,
  rotationX: number,
  targetDiameter: number,
): PreparedSpinnerModel {
  const content = source.clone(true);
  let hasPaintMarkers = false;
  content.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.geometry = object.geometry.clone();
    applySpinnerShadingNormals(object.geometry);
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    hasPaintMarkers ||= isPaintName(object.name) || materials.some((material) => isPaintName(material.name));
  });

  const oriented = new THREE.Group();
  oriented.rotation.x = rotationX;
  oriented.add(content);
  oriented.updateMatrixWorld(true);

  const bounds = new THREE.Box3().setFromObject(oriented);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const rawDiameter = Math.max(size.x, size.z, 0.001);
  oriented.position.set(-center.x, -bounds.min.y, -center.z);

  const root = new THREE.Group();
  root.scale.setScalar(targetDiameter / rawDiameter);
  root.add(oriented);
  return {
    root,
    diameter: targetDiameter,
    hasPaintMarkers,
  };
}

export function createAnimeSpinnerVisual(
  source: THREE.Group,
  rotationX: number,
  targetDiameter: number,
  selectedColors: string | readonly [string, string, string],
  withOutline = true,
): AnimeSpinnerVisual {
  const prepared = prepareSpinnerModel(source, rotationX, targetDiameter);
  prepared.root.userData.spinnerScreenOutline = withOutline;
  const colors: readonly [string, string, string] = typeof selectedColors === "string"
    ? [selectedColors, selectedColors, selectedColors]
    : selectedColors;
  const paintMaterials: [AnimeFillMaterial[], AnimeFillMaterial[], AnimeFillMaterial[]] = [[], [], []];
  const fillMeshes: THREE.Mesh[] = [];
  prepared.root.traverse((object) => {
    if (object instanceof THREE.Mesh) fillMeshes.push(object);
  });

  for (const mesh of fillMeshes) {
    const sourceMaterials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const meshPaintable = !prepared.hasPaintMarkers || isPaintName(mesh.name);
    const fillMaterials = sourceMaterials.map((sourceMaterial) => {
      const paintable = meshPaintable || isPaintName(sourceMaterial.name);
      const slot = resolveSpinnerPaintSlot(sourceMaterial.name) ?? resolveSpinnerPaintSlot(mesh.name) ?? 0;
      const material = createAnimeFillMaterial(sourceMaterial, paintable ? colors[slot] : undefined);
      material.userData.spinnerFill = true;
      material.userData.spinnerPaintable = paintable;
      if (paintable) paintMaterials[slot].push(material);
      return material;
    });
    mesh.material = Array.isArray(mesh.material) ? fillMaterials : fillMaterials[0];
    mesh.renderOrder = 1;
    mesh.userData.spinnerFill = true;
  }

  return {
    root: prepared.root,
    setColors(nextColors: readonly [string, string, string]): void {
      paintMaterials.forEach((materials, index) => {
        for (const material of materials) material.color.set(nextColors[index]);
      });
    },
    setColor(color: string): void {
      for (const materials of paintMaterials) {
        for (const material of materials) material.color.set(color);
      }
    },
    dispose(): void {
      const geometries = new Set<THREE.BufferGeometry>();
      const materials = new Set<THREE.Material>();
      prepared.root.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        geometries.add(object.geometry);
        const objectMaterials = Array.isArray(object.material) ? object.material : [object.material];
        for (const material of objectMaterials) materials.add(material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
    },
  };
}

export function createAnimeFillMaterial(source: THREE.Material, selectedColor?: string): AnimeFillMaterial {
  const input = source as SourceMaterial;
  const material = new THREE.MeshBasicMaterial({
    color: selectedColor ?? input.color ?? "#ffffff",
    map: input.map ?? null,
    transparent: input.transparent ?? false,
    opacity: input.opacity ?? 1,
    alphaTest: input.alphaTest ?? 0,
    vertexColors: input.vertexColors ?? false,
    side: THREE.DoubleSide,
    toneMapped: false,
  }) as AnimeFillMaterial;
  installAnimeShader(material);
  animeFillMaterials.add(material);
  material.addEventListener("dispose", () => animeFillMaterials.delete(material));
  return material;
}

export function createInstancedAnimeFillMaterial(
  source: THREE.Material,
  paintable: boolean,
  options: InstancedAnimeOptions,
): AnimeFillMaterial {
  const material = createAnimeFillMaterial(source, paintable ? "#ffffff" : undefined);
  installAnimeShader(material, options);
  return material;
}

export function isSpinnerPaintName(name: string): boolean {
  return isPaintName(name);
}

export function isAnimeSpinnerOutline(object: THREE.Object3D): boolean {
  return object.userData.spinnerOutline === true;
}

export function isAnimeSpinnerFill(object: THREE.Object3D): boolean {
  return object.userData.spinnerFill === true;
}

function installAnimeShader(material: AnimeFillMaterial, instanced?: InstancedAnimeOptions): void {
  const matcapUniform = { value: spinnerMatcapTexture };
  material.userData.spinnerMatcapUniform = matcapUniform;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uSpinnerMatcap = matcapUniform;
    shader.uniforms.uAnimeTopBiasStart = animeToonUniforms.topBiasStart;
    shader.uniforms.uAnimeTopBiasEnd = animeToonUniforms.topBiasEnd;
    shader.uniforms.uAnimeShadowThreshold = animeToonUniforms.shadowThreshold;
    shader.uniforms.uAnimeShadowTopBiasWeight = animeToonUniforms.shadowTopBiasWeight;
    shader.uniforms.uAnimeLightThreshold = animeToonUniforms.lightThreshold;
    shader.uniforms.uAnimeLightTopBiasWeight = animeToonUniforms.lightTopBiasWeight;
    shader.uniforms.uAnimeShadeBase = animeToonUniforms.shadeBase;
    shader.uniforms.uAnimeShadeShadowWeight = animeToonUniforms.shadeShadowWeight;
    shader.uniforms.uAnimeShadeLightWeight = animeToonUniforms.shadeLightWeight;
    shader.uniforms.uAnimeRimEdgeStart = animeToonUniforms.rimEdgeStart;
    shader.uniforms.uAnimeRimEdgeEnd = animeToonUniforms.rimEdgeEnd;
    shader.uniforms.uAnimeRimLightStart = animeToonUniforms.rimLightStart;
    shader.uniforms.uAnimeRimLightEnd = animeToonUniforms.rimLightEnd;
    shader.uniforms.uAnimeRimStrength = animeToonUniforms.rimStrength;
    shader.uniforms.uAnimeSpecularStart = animeToonUniforms.specularStart;
    shader.uniforms.uAnimeSpecularEnd = animeToonUniforms.specularEnd;
    shader.uniforms.uAnimeSpecularExponent = animeToonUniforms.specularExponent;
    shader.uniforms.uAnimeSpecularStrength = animeToonUniforms.specularStrength;
    shader.uniforms.uAnimeMatcapUvScale = animeToonUniforms.matcapUvScale;
    shader.uniforms.uAnimeMatcapMinGain = animeToonUniforms.matcapMinGain;
    shader.uniforms.uAnimeMatcapMaxGain = animeToonUniforms.matcapMaxGain;
    if (instanced) {
      shader.uniforms.uFreezeMask = { value: instanced.freezeMask };
      shader.uniforms.uFreezeDissolve = { value: instanced.freezeDissolve };
    }
    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      varying vec3 vAnimeNormal;
      varying vec3 vAnimePosition;
      varying vec3 vAnimeViewPosition;
      ${instanced ? "attribute float instanceFreeze; varying float vInstanceFreeze;" : ""}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      vec3 animeObjectNormal = vec3(normal);
      #ifdef USE_BATCHING
        mat3 animeBatchMatrix = mat3(batchingMatrix);
        animeObjectNormal /= vec3(dot(animeBatchMatrix[0], animeBatchMatrix[0]), dot(animeBatchMatrix[1], animeBatchMatrix[1]), dot(animeBatchMatrix[2], animeBatchMatrix[2]));
        animeObjectNormal = animeBatchMatrix * animeObjectNormal;
      #endif
      #ifdef USE_INSTANCING
        mat3 animeInstanceMatrix = mat3(instanceMatrix);
        animeObjectNormal /= vec3(dot(animeInstanceMatrix[0], animeInstanceMatrix[0]), dot(animeInstanceMatrix[1], animeInstanceMatrix[1]), dot(animeInstanceMatrix[2], animeInstanceMatrix[2]));
        animeObjectNormal = animeInstanceMatrix * animeObjectNormal;
      #endif
      vAnimeNormal = normalize(normalMatrix * animeObjectNormal);
      vAnimePosition = position;
      ${instanced ? "vInstanceFreeze = instanceFreeze;" : ""}`,
    );
    shader.vertexShader = shader.vertexShader.replace(
      "#include <project_vertex>",
      `#include <project_vertex>
      vAnimeViewPosition = -mvPosition.xyz;`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <common>",
      `#include <common>
      varying vec3 vAnimeNormal;
      varying vec3 vAnimePosition;
      varying vec3 vAnimeViewPosition;
      uniform sampler2D uSpinnerMatcap;
      uniform float uAnimeTopBiasStart;
      uniform float uAnimeTopBiasEnd;
      uniform float uAnimeShadowThreshold;
      uniform float uAnimeShadowTopBiasWeight;
      uniform float uAnimeLightThreshold;
      uniform float uAnimeLightTopBiasWeight;
      uniform float uAnimeShadeBase;
      uniform float uAnimeShadeShadowWeight;
      uniform float uAnimeShadeLightWeight;
      uniform float uAnimeRimEdgeStart;
      uniform float uAnimeRimEdgeEnd;
      uniform float uAnimeRimLightStart;
      uniform float uAnimeRimLightEnd;
      uniform float uAnimeRimStrength;
      uniform float uAnimeSpecularStart;
      uniform float uAnimeSpecularEnd;
      uniform float uAnimeSpecularExponent;
      uniform float uAnimeSpecularStrength;
      uniform float uAnimeMatcapUvScale;
      uniform float uAnimeMatcapMinGain;
      uniform float uAnimeMatcapMaxGain;
      ${instanced ? "uniform sampler2D uFreezeMask; uniform sampler2D uFreezeDissolve; varying float vInstanceFreeze;" : ""}`,
    );
    shader.fragmentShader = shader.fragmentShader.replace(
      "#include <color_fragment>",
      `#include <color_fragment>
      vec3 animeNormal = normalize(vAnimeNormal);
      vec3 animeLightDirection = normalize(vec3(-0.32, 0.9, 0.42));
      vec3 animeViewDirection = normalize(vAnimeViewPosition);
      vec3 animeHalfDirection = normalize(animeLightDirection + animeViewDirection);
      float animeLight = clamp(dot(animeNormal, animeLightDirection) * 0.5 + 0.5, 0.0, 1.0);
      float animeTopBias = smoothstep(uAnimeTopBiasStart, uAnimeTopBiasEnd, animeNormal.y);
      float animeShadowBand = step(uAnimeShadowThreshold, animeLight + animeTopBias * uAnimeShadowTopBiasWeight);
      float animeLightBand = step(uAnimeLightThreshold, animeLight + animeTopBias * uAnimeLightTopBiasWeight);
      float animeShade = uAnimeShadeBase + animeShadowBand * uAnimeShadeShadowWeight + animeLightBand * uAnimeShadeLightWeight;
      float animeRim = smoothstep(uAnimeRimEdgeStart, uAnimeRimEdgeEnd, 1.0 - max(dot(animeNormal, animeViewDirection), 0.0)) * smoothstep(uAnimeRimLightStart, uAnimeRimLightEnd, animeLight);
      float animeSpecular = smoothstep(uAnimeSpecularStart, uAnimeSpecularEnd, pow(max(dot(animeNormal, animeHalfDirection), 0.0), uAnimeSpecularExponent)) * animeLightBand;
      diffuseColor.rgb *= animeShade;
      vec2 animeMatcapUv = animeNormal.xy * vec2(uAnimeMatcapUvScale, -uAnimeMatcapUvScale) + 0.5;
      vec3 animeMatcap = texture2D(uSpinnerMatcap, animeMatcapUv).rgb;
      float animeMatcapLuma = dot(animeMatcap, vec3(0.299, 0.587, 0.114));
      diffuseColor.rgb *= mix(uAnimeMatcapMinGain, uAnimeMatcapMaxGain, animeMatcapLuma);
      diffuseColor.rgb += diffuseColor.rgb * animeRim * uAnimeRimStrength;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), animeSpecular * uAnimeSpecularStrength);
      ${instanced ? `
      vec2 freezeUv = vAnimePosition.xz * 0.73 + vec2(0.31, 0.47);
      float freezeMaskValue = texture2D(uFreezeMask, freezeUv).r;
      float freezeDissolveValue = texture2D(uFreezeDissolve, freezeUv * 1.13 + vec2(0.071, 0.137)).r * 0.84 + 0.08;
      float freezeFactor = smoothstep(freezeDissolveValue - 0.045, freezeDissolveValue + 0.045, vInstanceFreeze);
      vec3 freezeBandColor = vec3(0.968, 0.992, 1.0);
      if (freezeMaskValue >= 0.24) freezeBandColor = vec3(0.663, 0.918, 1.0);
      if (freezeMaskValue >= 0.5) freezeBandColor = vec3(0.333, 0.741, 0.91);
      if (freezeMaskValue >= 0.76) freezeBandColor = vec3(0.122, 0.435, 0.659);
      diffuseColor.rgb = mix(diffuseColor.rgb, freezeBandColor, freezeFactor);` : ""}`,
    );
  };
  material.customProgramCacheKey = () => instanced ? "anime-spinner-instanced-freeze-v8" : "anime-spinner-static-v8";
  material.needsUpdate = true;
}

function isPaintName(name: string): boolean {
  return /^(?:paint(?:_|$)|m_(?:color_[12]|base)$)/i.test(name.trim());
}

export function resolveSpinnerPaintSlot(name: string): 0 | 1 | 2 | null {
  const normalized = name.trim();
  const paintMatch = /^paint[_ -]?([123])(?:\b|_)/i.exec(normalized);
  if (paintMatch) return (Number(paintMatch[1]) - 1) as 0 | 1 | 2;
  if (/^m_color_1$/i.test(normalized)) return 0;
  if (/^m_color_2$/i.test(normalized)) return 1;
  if (/^m_base$/i.test(normalized)) return 2;
  return null;
}
