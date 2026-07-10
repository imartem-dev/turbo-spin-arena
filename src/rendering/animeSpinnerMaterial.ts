import * as THREE from "three";

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
    if (!object.geometry.getAttribute("normal")) object.geometry.computeVertexNormals();
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
      const slot = resolvePaintSlot(sourceMaterial.name) ?? resolvePaintSlot(mesh.name) ?? 0;
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
  material.onBeforeCompile = (shader) => {
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
      float animeTopBias = smoothstep(0.08, 0.72, animeNormal.y);
      float animeShadowBand = step(0.28, animeLight + animeTopBias * 0.12);
      float animeLightBand = step(0.68, animeLight);
      float animeShade = 0.68 + animeShadowBand * 0.2 + animeLightBand * 0.12;
      float animeRim = smoothstep(0.62, 0.84, 1.0 - max(dot(animeNormal, animeViewDirection), 0.0)) * smoothstep(0.2, 0.72, animeLight);
      float animeSpecular = smoothstep(0.9, 0.98, pow(max(dot(animeNormal, animeHalfDirection), 0.0), 28.0)) * animeLightBand;
      diffuseColor.rgb *= animeShade;
      diffuseColor.rgb += diffuseColor.rgb * animeRim * 0.16;
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(1.0), animeSpecular * 0.08);
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
  material.customProgramCacheKey = () => instanced ? "anime-spinner-instanced-freeze-v3" : "anime-spinner-static-v3";
  material.needsUpdate = true;
}

function isPaintName(name: string): boolean {
  return /^(?:paint(?:_|$)|m_(?:color_[12]|base)$)/i.test(name.trim());
}

function resolvePaintSlot(name: string): 0 | 1 | 2 | null {
  const normalized = name.trim();
  const paintMatch = /^paint[_ -]?([123])(?:\b|_)/i.exec(normalized);
  if (paintMatch) return (Number(paintMatch[1]) - 1) as 0 | 1 | 2;
  if (/^m_color_1$/i.test(normalized)) return 0;
  if (/^m_color_2$/i.test(normalized)) return 1;
  if (/^m_base$/i.test(normalized)) return 2;
  return null;
}
