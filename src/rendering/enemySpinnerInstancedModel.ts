import * as THREE from "three";

export type InstancedEnemySpinner = {
  spinGroup: THREE.Group;
  modelColor: string;
  modelTint: string | null;
};

export class EnemySpinnerInstancedModel {
  private readonly material = new THREE.MeshStandardMaterial({
    color: "#ffffff",
    roughness: 0.38,
    metalness: 0.22,
    vertexColors: true,
  });
  private readonly freezeOutlineMaterial = createFreezeOutlineMaterial();
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly colorKeys: string[] = [];
  private readonly freezeTargets = new WeakMap<InstancedEnemySpinner, boolean>();
  private readonly freezeCoverages: Float32Array;
  private readonly freezeAttributes: THREE.InstancedBufferAttribute[] = [];
  private readonly freezeMask: THREE.Texture;
  private readonly freezeDissolve: THREE.Texture;
  private meshes: THREE.InstancedMesh[] = [];
  private outlineMeshes: THREE.InstancedMesh[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly capacity: number,
  ) {
    this.freezeCoverages = new Float32Array(capacity);
    const loader = new THREE.TextureLoader();
    const base = `${import.meta.env.BASE_URL}assets/vfx/freeze/`;
    this.freezeMask = loader.load(`${base}T_Noise_Wo14.webp`);
    this.freezeDissolve = loader.load(`${base}T_VFX_exp_dissapear.webp`);
    for (const texture of [this.freezeMask, this.freezeDissolve]) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.colorSpace = THREE.NoColorSpace;
    }
    this.installFreezeShader();
  }

  setModelSource(source: THREE.Group, radius: number): void {
    this.disposeMeshes();

    const model = source.clone(true);
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const diameter = Math.max(size.x, size.y);
    const height = size.z;
    const scale = diameter > 0 ? (radius * 1.65) / diameter : 1;

    model.position.sub(center);

    const modelRoot = new THREE.Group();
    modelRoot.rotation.x = -Math.PI / 2;
    modelRoot.position.y = (height * scale) / 2;
    modelRoot.scale.setScalar(scale);
    modelRoot.add(model);
    modelRoot.updateMatrixWorld(true);

    modelRoot.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) {
        return;
      }

      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      geometry.computeVertexNormals();
      const freezeAttribute = new THREE.InstancedBufferAttribute(this.freezeCoverages, 1);
      freezeAttribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("instanceFreeze", freezeAttribute);
      this.freezeAttributes.push(freezeAttribute);

      const mesh = new THREE.InstancedMesh(geometry, this.material, this.capacity);
      mesh.name = `Enemy Spinner Instanced ${this.meshes.length + 1}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.count = 0;
      for (let i = 0; i < this.capacity; i += 1) {
        mesh.setMatrixAt(i, this.hiddenMatrix);
        mesh.setColorAt(i, this.color.set("#ffffff"));
      }
      mesh.instanceMatrix.needsUpdate = true;
      mesh.instanceColor!.needsUpdate = true;
      this.meshes.push(mesh);
      this.scene.add(mesh);

      const outlineMesh = new THREE.InstancedMesh(geometry, this.freezeOutlineMaterial, this.capacity);
      outlineMesh.name = `Enemy Spinner Freeze Outline ${this.outlineMeshes.length + 1}`;
      outlineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      outlineMesh.frustumCulled = false;
      outlineMesh.renderOrder = 2;
      outlineMesh.count = 0;
      for (let i = 0; i < this.capacity; i += 1) {
        outlineMesh.setMatrixAt(i, this.hiddenMatrix);
      }
      outlineMesh.instanceMatrix.needsUpdate = true;
      this.outlineMeshes.push(outlineMesh);
      this.scene.add(outlineMesh);
    });

    this.colorKeys.length = this.capacity;
    this.colorKeys.fill("");
  }

  setFrozen(spinner: InstancedEnemySpinner, frozen: boolean): void {
    this.freezeTargets.set(spinner, frozen);
  }

  sync(spinners: InstancedEnemySpinner[], deltaTime = 0): void {
    if (this.meshes.length === 0) {
      return;
    }

    const count = Math.min(spinners.length, this.capacity);
    let colorNeedsUpdate = false;
    for (let i = 0; i < count; i += 1) {
      const spinner = spinners[i];
      spinner.spinGroup.updateWorldMatrix(true, false);
      this.matrix.copy(spinner.spinGroup.matrixWorld);
      const colorKey = spinner.modelTint ?? spinner.modelColor;
      const freezeTarget = this.freezeTargets.get(spinner) === true ? 1 : 0;
      const freezeDuration = freezeTarget > this.freezeCoverages[i] ? 0.45 : 0.75;
      const freezeStep = freezeDuration > 0 ? deltaTime / freezeDuration : 1;
      this.freezeCoverages[i] = THREE.MathUtils.clamp(
        this.freezeCoverages[i] + Math.sign(freezeTarget - this.freezeCoverages[i]) * freezeStep,
        0,
        1,
      );

      for (const mesh of this.meshes) {
        mesh.setMatrixAt(i, this.matrix);
      }
      for (const mesh of this.outlineMeshes) {
        mesh.setMatrixAt(i, this.matrix);
      }

      if (this.colorKeys[i] !== colorKey) {
        this.colorKeys[i] = colorKey;
        this.color.set(colorKey);
        for (const mesh of this.meshes) {
          mesh.setColorAt(i, this.color);
        }
        colorNeedsUpdate = true;
      }
    }

    for (let i = count; i < this.capacity; i += 1) {
      for (const mesh of this.meshes) {
        mesh.setMatrixAt(i, this.hiddenMatrix);
      }
      for (const mesh of this.outlineMeshes) {
        mesh.setMatrixAt(i, this.hiddenMatrix);
      }
      if (this.colorKeys[i] !== "") {
        this.colorKeys[i] = "";
      }
    }

    for (const mesh of this.meshes) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
      if (colorNeedsUpdate && mesh.instanceColor) {
        mesh.instanceColor.needsUpdate = true;
      }
    }
    for (const mesh of this.outlineMeshes) {
      mesh.count = count;
      mesh.instanceMatrix.needsUpdate = true;
    }
    for (const attribute of this.freezeAttributes) {
      attribute.needsUpdate = true;
    }
  }

  dispose(): void {
    this.disposeMeshes();
    this.material.dispose();
    this.freezeOutlineMaterial.dispose();
    this.freezeMask.dispose();
    this.freezeDissolve.dispose();
  }

  private disposeMeshes(): void {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    for (const mesh of this.outlineMeshes) {
      this.scene.remove(mesh);
    }
    this.meshes = [];
    this.outlineMeshes = [];
    this.freezeAttributes.length = 0;
    this.colorKeys.length = 0;
  }

  private installFreezeShader(): void {
    const material = this.material as THREE.MeshStandardMaterial & { defines?: Record<string, string> };
    material.defines = { ...material.defines, USE_UV: "" };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uFreezeMask = { value: this.freezeMask };
      shader.uniforms.uFreezeDissolve = { value: this.freezeDissolve };
      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
        attribute float instanceFreeze;
        varying float vInstanceFreeze;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `vInstanceFreeze = instanceFreeze;
        #include <begin_vertex>`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uFreezeMask;
        uniform sampler2D uFreezeDissolve;
        varying float vInstanceFreeze;
        float freezeVfxFactor = 0.0;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float freezeMaskValue = texture2D(uFreezeMask, vUv).r;
        float freezeDissolveValue = texture2D(uFreezeDissolve, vUv * 1.13 + vec2(0.071, 0.137)).r * 0.84 + 0.08;
        freezeVfxFactor = smoothstep(freezeDissolveValue - 0.045, freezeDissolveValue + 0.045, vInstanceFreeze);
        vec3 freezeBandColor = vec3(0.968, 0.992, 1.0);
        if (freezeMaskValue >= 0.24) freezeBandColor = vec3(0.663, 0.918, 1.0);
        if (freezeMaskValue >= 0.5) freezeBandColor = vec3(0.333, 0.741, 0.91);
        if (freezeMaskValue >= 0.76) freezeBandColor = vec3(0.122, 0.435, 0.659);
        diffuseColor.rgb = mix(diffuseColor.rgb, freezeBandColor, freezeVfxFactor);`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <opaque_fragment>",
        `#include <opaque_fragment>
        float freezeLuma = max(dot(gl_FragColor.rgb, vec3(0.2126, 0.7152, 0.0722)), 0.001);
        float freezeLumaBand = 0.34;
        if (freezeLuma >= 0.28) freezeLumaBand = 0.58;
        if (freezeLuma >= 0.56) freezeLumaBand = 0.82;
        vec3 freezeSteppedLight = gl_FragColor.rgb * (freezeLumaBand / freezeLuma);
        gl_FragColor.rgb = mix(gl_FragColor.rgb, freezeSteppedLight, freezeVfxFactor);`,
      );
    };
    material.customProgramCacheKey = () => "enemy-spinner-freeze-v1";
    material.needsUpdate = true;
  }
}

function createFreezeOutlineMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: `
      attribute float instanceFreeze;
      varying float vFreezeCoverage;
      void main() {
        vFreezeCoverage = instanceFreeze;
        vec3 expanded = position + normal * 0.045 * instanceFreeze;
        gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(expanded, 1.0);
      }
    `,
    fragmentShader: `
      varying float vFreezeCoverage;
      void main() {
        if (vFreezeCoverage <= 0.01) discard;
        gl_FragColor = vec4(vec3(0.02, 0.05, 0.075), vFreezeCoverage);
      }
    `,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
    depthTest: true,
  });
}
