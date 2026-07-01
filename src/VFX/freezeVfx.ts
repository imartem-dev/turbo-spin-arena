import * as THREE from "three";

const textureBase = `${import.meta.env.BASE_URL}assets/vfx/freeze/`;
const freezeDuration = 0.45;
const thawDuration = 0.75;
const shardLifetime = 0.55;
const shardCount = 14;

type FreezeTextures = {
  iceMask: THREE.Texture;
  dissolve: THREE.Texture;
};

type MaterialBinding = {
  mesh: THREE.Mesh;
  original: THREE.Material | THREE.Material[];
  frozen: THREE.Material | THREE.Material[];
};

type CoverageUniform = { value: number };

type ShardState = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  axis: THREE.Vector3;
  scale: number;
  spin: number;
  delay: number;
};

const palette = ["#f7fdff", "#a9eaff", "#55bde8", "#1f6fa8"];
const zeroMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

export class FreezeVfx {
  readonly group = new THREE.Group();

  private readonly target: THREE.Object3D;
  private readonly textures: FreezeTextures;
  private readonly outlineMaterial: THREE.ShaderMaterial;
  private readonly shardGeometry: THREE.TetrahedronGeometry;
  private readonly shardMaterial: THREE.ShaderMaterial;
  private readonly shardOutlineMaterial: THREE.MeshBasicMaterial;
  private readonly shardMesh: THREE.InstancedMesh;
  private readonly shardOutlineMesh: THREE.InstancedMesh;
  private readonly bindings: MaterialBinding[] = [];
  private readonly outlineShells: THREE.Mesh[] = [];
  private readonly coverageUniforms: CoverageUniform[] = [];
  private readonly shardStates: ShardState[] = [];
  private readonly bounds = new THREE.Box3();
  private readonly sphere = new THREE.Sphere();
  private readonly matrix = new THREE.Matrix4();
  private readonly outlineMatrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scaleVector = new THREE.Vector3();
  private coverage = 0;
  private targetCoverage = 0;
  private shardAge = shardLifetime;

  constructor(target: THREE.Object3D) {
    this.target = target;
    this.group.name = "Freeze VFX";
    this.textures = loadTextures();
    this.outlineMaterial = createOutlineMaterial(this.textures);

    this.shardGeometry = new THREE.TetrahedronGeometry(1, 0);
    this.shardMaterial = createShardMaterial();
    this.shardOutlineMaterial = new THREE.MeshBasicMaterial({
      color: "#05090d",
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.shardMesh = new THREE.InstancedMesh(this.shardGeometry, this.shardMaterial, shardCount);
    this.shardOutlineMesh = new THREE.InstancedMesh(
      this.shardGeometry,
      this.shardOutlineMaterial,
      shardCount,
    );
    this.shardMesh.name = "Freeze Shards";
    this.shardOutlineMesh.name = "Freeze Shard Outlines";
    this.shardMesh.renderOrder = 5;
    this.shardOutlineMesh.renderOrder = 6;
    this.shardMesh.frustumCulled = false;
    this.shardOutlineMesh.frustumCulled = false;
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardOutlineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);

    for (let index = 0; index < shardCount; index += 1) {
      this.shardMesh.setMatrixAt(index, zeroMatrix);
      this.shardOutlineMesh.setMatrixAt(index, zeroMatrix);
      this.shardMesh.setColorAt(index, new THREE.Color(palette[index % palette.length]));
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardOutlineMesh.instanceMatrix.needsUpdate = true;
    if (this.shardMesh.instanceColor) {
      this.shardMesh.instanceColor.needsUpdate = true;
    }
    this.group.add(this.shardOutlineMesh, this.shardMesh);
  }

  get frozen(): boolean {
    return this.targetCoverage > 0.5;
  }

  toggle(reducedMotion = false): boolean {
    if (this.targetCoverage > 0.5) {
      this.targetCoverage = 0;
      if (reducedMotion) {
        this.clearShards();
      } else {
        this.spawnShards();
      }
    } else {
      if (this.bindings.length === 0) {
        this.installMaterials();
      }
      this.targetCoverage = 1;
      this.clearShards();
    }
    return this.frozen;
  }

  update(deltaTime: number, reducedMotion = false): void {
    if (this.coverage !== this.targetCoverage) {
      const duration = reducedMotion
        ? this.targetCoverage > this.coverage
          ? 0.08
          : 0.14
        : this.targetCoverage > this.coverage
          ? freezeDuration
          : thawDuration;
      const direction = Math.sign(this.targetCoverage - this.coverage);
      this.coverage = THREE.MathUtils.clamp(this.coverage + (deltaTime / duration) * direction, 0, 1);
      this.setCoverage(this.coverage);

      if (this.coverage === 0 && this.targetCoverage === 0) {
        this.restoreMaterials();
      }
    }

    this.updateShards(deltaTime);
  }

  dispose(): void {
    this.targetCoverage = 0;
    this.coverage = 0;
    this.restoreMaterials();
    this.clearShards();
    this.outlineMaterial.dispose();
    this.shardGeometry.dispose();
    this.shardMaterial.dispose();
    this.shardOutlineMaterial.dispose();
    this.textures.iceMask.dispose();
    this.textures.dissolve.dispose();
  }

  private installMaterials(): void {
    const meshes: THREE.Mesh[] = [];
    this.target.traverse((child) => {
      if (
        child instanceof THREE.Mesh &&
        !child.userData.freezeVfxOutline &&
        child.geometry.getAttribute("uv")
      ) {
        meshes.push(child);
      }
    });

    this.coverageUniforms.length = 0;
    for (const mesh of meshes) {
      const original = mesh.material;
      const frozen = Array.isArray(original)
        ? original.map((material) => this.createFrozenMaterial(material))
        : this.createFrozenMaterial(original);
      mesh.material = frozen;
      this.bindings.push({ mesh, original, frozen });

      const shell = new THREE.Mesh(mesh.geometry, this.outlineMaterial);
      shell.name = `${mesh.name || "Mesh"} Freeze Outline`;
      shell.userData.freezeVfxOutline = true;
      shell.frustumCulled = mesh.frustumCulled;
      shell.renderOrder = Math.max(mesh.renderOrder + 1, 2);
      shell.raycast = () => undefined;
      mesh.add(shell);
      this.outlineShells.push(shell);
    }

    this.setCoverage(this.coverage);
  }

  private createFrozenMaterial(original: THREE.Material): THREE.Material {
    const material = original.clone();
    const previousHook = material.onBeforeCompile.bind(material);
    const previousCacheKey = material.customProgramCacheKey.bind(material);
    const programmableMaterial = material as THREE.Material & {
      defines?: Record<string, string>;
    };
    programmableMaterial.defines = { ...programmableMaterial.defines, USE_UV: "" };

    material.onBeforeCompile = (shader, renderer) => {
      previousHook(shader, renderer);
      shader.uniforms.uFreezeMask = { value: this.textures.iceMask };
      shader.uniforms.uFreezeDissolve = { value: this.textures.dissolve };
      shader.uniforms.uFreezeCoverage = { value: this.coverage };
      this.coverageUniforms.push(shader.uniforms.uFreezeCoverage as CoverageUniform);

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
        uniform sampler2D uFreezeMask;
        uniform sampler2D uFreezeDissolve;
        uniform float uFreezeCoverage;
        float freezeVfxFactor = 0.0;`,
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        `#include <color_fragment>
        float freezeMaskValue = texture2D(uFreezeMask, vUv).r;
        float freezeDissolveValue = texture2D(uFreezeDissolve, vUv * 1.13 + vec2(0.071, 0.137)).r * 0.84 + 0.08;
        freezeVfxFactor = smoothstep(
          freezeDissolveValue - 0.045,
          freezeDissolveValue + 0.045,
          uFreezeCoverage
        );
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
    material.customProgramCacheKey = () => `${previousCacheKey()}|freeze-vfx-v1`;
    material.name = `${original.name || original.type} Freeze Material`;
    material.needsUpdate = true;
    return material;
  }

  private restoreMaterials(): void {
    for (const binding of this.bindings) {
      binding.mesh.material = binding.original;
      const materials = Array.isArray(binding.frozen) ? binding.frozen : [binding.frozen];
      for (const material of materials) {
        material.dispose();
      }
    }
    this.bindings.length = 0;
    this.coverageUniforms.length = 0;

    for (const shell of this.outlineShells) {
      shell.removeFromParent();
    }
    this.outlineShells.length = 0;
  }

  private setCoverage(value: number): void {
    this.outlineMaterial.uniforms.uCoverage.value = value;
    for (const uniform of this.coverageUniforms) {
      uniform.value = value;
    }
  }

  private spawnShards(): void {
    this.target.updateWorldMatrix(true, true);
    this.bounds.setFromObject(this.target);
    if (this.bounds.isEmpty()) {
      return;
    }
    this.bounds.getBoundingSphere(this.sphere);
    const radius = Math.max(this.sphere.radius, 0.25);
    this.shardStates.length = 0;
    this.shardAge = 0;

    for (let index = 0; index < shardCount; index += 1) {
      const direction = seededDirection(index);
      const position = this.sphere.center
        .clone()
        .addScaledVector(direction, radius * THREE.MathUtils.lerp(0.28, 0.62, seededRandom(index, 1)));
      const velocity = direction
        .clone()
        .multiplyScalar(radius * THREE.MathUtils.lerp(1.8, 3.0, seededRandom(index, 2)));
      velocity.y += radius * THREE.MathUtils.lerp(1.4, 2.5, seededRandom(index, 3));
      this.shardStates.push({
        position,
        velocity,
        axis: seededDirection(index + 41),
        scale: radius * THREE.MathUtils.lerp(0.075, 0.145, seededRandom(index, 4)),
        spin: THREE.MathUtils.lerp(4, 10, seededRandom(index, 5)),
        delay: seededRandom(index, 6) * 0.09,
      });
    }
  }

  private updateShards(deltaTime: number): void {
    if (this.shardAge >= shardLifetime) {
      return;
    }
    this.shardAge = Math.min(shardLifetime, this.shardAge + deltaTime);

    for (let index = 0; index < shardCount; index += 1) {
      const shard = this.shardStates[index];
      const age = shard ? Math.max(0, this.shardAge - shard.delay) : 0;
      if (!shard || age <= 0 || age >= shardLifetime) {
        this.shardMesh.setMatrixAt(index, zeroMatrix);
        this.shardOutlineMesh.setMatrixAt(index, zeroMatrix);
        continue;
      }

      const life = age / shardLifetime;
      const position = shard.position.clone().addScaledVector(shard.velocity, age);
      position.y -= 2.8 * this.sphere.radius * age * age;
      this.quaternion.setFromAxisAngle(shard.axis, shard.spin * age);
      const scale = shard.scale * (1 - smoothStep(0.68, 1, life));
      this.scaleVector.set(scale * 0.72, scale * 1.8, scale * 0.72);
      this.matrix.compose(position, this.quaternion, this.scaleVector);
      this.scaleVector.multiplyScalar(1.14);
      this.outlineMatrix.compose(position, this.quaternion, this.scaleVector);
      this.shardMesh.setMatrixAt(index, this.matrix);
      this.shardOutlineMesh.setMatrixAt(index, this.outlineMatrix);
    }

    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardOutlineMesh.instanceMatrix.needsUpdate = true;
    if (this.shardAge >= shardLifetime) {
      this.clearShards();
    }
  }

  private clearShards(): void {
    this.shardAge = shardLifetime;
    this.shardStates.length = 0;
    for (let index = 0; index < shardCount; index += 1) {
      this.shardMesh.setMatrixAt(index, zeroMatrix);
      this.shardOutlineMesh.setMatrixAt(index, zeroMatrix);
    }
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.shardOutlineMesh.instanceMatrix.needsUpdate = true;
  }
}

function loadTextures(): FreezeTextures {
  const loader = new THREE.TextureLoader();
  const iceMask = loader.load(`${textureBase}T_Noise_Wo14.webp`);
  const dissolve = loader.load(`${textureBase}T_VFX_exp_dissapear.webp`);
  for (const texture of [iceMask, dissolve]) {
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.colorSpace = THREE.NoColorSpace;
    texture.needsUpdate = true;
  }
  return { iceMask, dissolve };
}

function createOutlineMaterial(textures: FreezeTextures): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDissolveTex: { value: textures.dissolve },
      uCoverage: { value: 0 },
      uThickness: { value: 0.028 },
      uColor: { value: new THREE.Color("#05090d") },
    },
    vertexShader: `
      uniform float uThickness;
      varying vec2 vUv;
      void main() {
        vUv = uv;
        vec3 expanded = position + normal * uThickness;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(expanded, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uDissolveTex;
      uniform float uCoverage;
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float dissolve = texture2D(uDissolveTex, vUv * 1.13 + vec2(0.071, 0.137)).r * 0.84 + 0.08;
        float coverage = smoothstep(dissolve - 0.045, dissolve + 0.045, uCoverage);
        if (coverage < 0.5) discard;
        gl_FragColor = vec4(uColor, 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: true,
    depthTest: true,
  });
}

function createShardMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: `
      varying vec3 vColor;
      varying vec3 vNormal;
      void main() {
        vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
        vColor = instanceColor;
        vNormal = normalize(mat3(modelMatrix * instanceMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * worldPosition;
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying vec3 vNormal;
      void main() {
        float lightValue = dot(normalize(vNormal), normalize(vec3(-0.35, 0.82, 0.45))) * 0.5 + 0.5;
        float lightBand = 0.58;
        if (lightValue >= 0.42) lightBand = 0.82;
        if (lightValue >= 0.72) lightBand = 1.08;
        gl_FragColor = vec4(vColor * lightBand, 1.0);
      }
    `,
    depthWrite: true,
    depthTest: true,
  });
}

function seededRandom(index: number, channel: number): number {
  return THREE.MathUtils.seededRandom(991 + index * 173 + channel * 79);
}

function seededDirection(index: number): THREE.Vector3 {
  const angle = seededRandom(index, 7) * Math.PI * 2;
  const y = THREE.MathUtils.lerp(-0.15, 0.85, seededRandom(index, 8));
  const radius = Math.sqrt(Math.max(0.01, 1 - y * y));
  return new THREE.Vector3(Math.cos(angle) * radius, y, Math.sin(angle) * radius).normalize();
}

function smoothStep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

type PooledFreezeShard = {
  active: boolean;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  axis: THREE.Vector3;
  delay: number;
  age: number;
  scale: number;
  spin: number;
};

export class FreezeShardVfxPool {
  readonly group = new THREE.Group();

  private readonly geometry = new THREE.TetrahedronGeometry(1, 0);
  private readonly material = createShardMaterial();
  private readonly outlineMaterial = new THREE.MeshBasicMaterial({ color: "#05090d", side: THREE.BackSide, depthWrite: false });
  private readonly mesh: THREE.InstancedMesh;
  private readonly outlineMesh: THREE.InstancedMesh;
  private readonly shards: PooledFreezeShard[];
  private readonly matrix = new THREE.Matrix4();
  private readonly outlineMatrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();
  private nextBurst = 0;

  constructor(private readonly burstCount = 6, private readonly shardsPerBurst = shardCount) {
    const capacity = burstCount * shardsPerBurst;
    this.group.name = "Freeze Shard VFX Pool";
    this.mesh = new THREE.InstancedMesh(this.geometry, this.material, capacity);
    this.outlineMesh = new THREE.InstancedMesh(this.geometry, this.outlineMaterial, capacity);
    this.mesh.frustumCulled = false;
    this.outlineMesh.frustumCulled = false;
    this.mesh.renderOrder = 5;
    this.outlineMesh.renderOrder = 6;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.outlineMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shards = Array.from({ length: capacity }, () => ({
      active: false,
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      axis: new THREE.Vector3(0, 1, 0),
      delay: 0,
      age: shardLifetime,
      scale: 0,
      spin: 0,
    }));
    for (let index = 0; index < capacity; index += 1) {
      this.mesh.setMatrixAt(index, zeroMatrix);
      this.outlineMesh.setMatrixAt(index, zeroMatrix);
      this.mesh.setColorAt(index, new THREE.Color(palette[index % palette.length]));
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.outlineMesh.instanceMatrix.needsUpdate = true;
    this.mesh.instanceColor!.needsUpdate = true;
    this.group.add(this.outlineMesh, this.mesh);
  }

  spawn(position: THREE.Vector3, radius: number, reducedMotion = false): void {
    if (reducedMotion) {
      return;
    }
    const start = this.nextBurst * this.shardsPerBurst;
    this.nextBurst = (this.nextBurst + 1) % this.burstCount;
    for (let localIndex = 0; localIndex < this.shardsPerBurst; localIndex += 1) {
      const shard = this.shards[start + localIndex];
      const angle = (localIndex / this.shardsPerBurst) * Math.PI * 2 + (Math.random() - 0.5) * 0.35;
      const outward = 0.45 + Math.random() * 0.7;
      shard.active = true;
      shard.age = 0;
      shard.delay = Math.random() * 0.12;
      shard.scale = radius * (0.13 + Math.random() * 0.1);
      shard.spin = (Math.random() - 0.5) * 8;
      shard.position.set(position.x + Math.cos(angle) * radius * 0.45, position.y + radius * (0.2 + Math.random() * 0.55), position.z + Math.sin(angle) * radius * 0.45);
      shard.velocity.set(Math.cos(angle) * outward, 1.2 + Math.random() * 1.4, Math.sin(angle) * outward);
      shard.axis.set(Math.random() - 0.5, Math.random(), Math.random() - 0.5).normalize();
    }
  }

  update(deltaTime: number): void {
    for (let index = 0; index < this.shards.length; index += 1) {
      const shard = this.shards[index];
      if (!shard.active) {
        continue;
      }
      shard.age += deltaTime;
      if (shard.age < shard.delay) {
        continue;
      }
      const life = shard.age - shard.delay;
      if (life >= shardLifetime) {
        shard.active = false;
        this.mesh.setMatrixAt(index, zeroMatrix);
        this.outlineMesh.setMatrixAt(index, zeroMatrix);
        continue;
      }
      shard.velocity.y -= 5.5 * deltaTime;
      shard.position.addScaledVector(shard.velocity, deltaTime);
      this.quaternion.setFromAxisAngle(shard.axis, shard.spin * life);
      const visibleScale = shard.scale * (1 - life / shardLifetime);
      this.scale.setScalar(visibleScale);
      this.matrix.compose(shard.position, this.quaternion, this.scale);
      this.scale.setScalar(visibleScale * 1.18);
      this.outlineMatrix.compose(shard.position, this.quaternion, this.scale);
      this.mesh.setMatrixAt(index, this.matrix);
      this.outlineMesh.setMatrixAt(index, this.outlineMatrix);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    this.outlineMesh.instanceMatrix.needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    this.material.dispose();
    this.outlineMaterial.dispose();
    this.group.clear();
  }
}
