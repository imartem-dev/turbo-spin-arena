import * as THREE from "three";

const beamTextureUrl = `${import.meta.env.BASE_URL}assets/vfx/beam/T_VFX_lightning.webp`;
const growDuration = 0.12;
const releaseDuration = 0.18;
const flashDuration = 0.1;
const sparkCount = 10;
const localBeamAxis = new THREE.Vector3(1, 0, 0);

type BeamState = "idle" | "growing" | "active" | "releasing";

type BeamSpark = {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  active: boolean;
};

type BeamMaterialOptions = {
  color: string;
  hotColor: string;
  opacity: number;
  scrollSpeed: number;
  threshold: number;
  warpStrength: number;
  blending: THREE.Blending;
};

export class BeamVfx {
  readonly group = new THREE.Group();

  private readonly beamGroup = new THREE.Group();
  private readonly beamGeometry: THREE.PlaneGeometry;
  private readonly texture: THREE.Texture;
  private readonly maskTexture: THREE.DataTexture;
  private readonly darkMaterial: THREE.ShaderMaterial;
  private readonly glowMaterial: THREE.ShaderMaterial;
  private readonly coreMaterial: THREE.ShaderMaterial;
  private readonly electricMaterial: THREE.ShaderMaterial;
  private readonly beamMaterials: THREE.ShaderMaterial[];
  private readonly flashGeometry = new THREE.PlaneGeometry(1, 1);
  private readonly flashMaterial: THREE.ShaderMaterial;
  private readonly flashMesh: THREE.Mesh;
  private readonly sparkGeometry = new THREE.BoxGeometry(1, 1, 1);
  private readonly sparkMaterial = new THREE.MeshBasicMaterial({
    color: "#ffe45c",
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
    depthTest: true,
    blending: THREE.AdditiveBlending,
  });
  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly sparks: BeamSpark[];
  private readonly startPoint = new THREE.Vector3();
  private readonly endPoint = new THREE.Vector3(1, 0, 0);
  private readonly direction = new THREE.Vector3(1, 0, 0);
  private readonly midpoint = new THREE.Vector3();
  private readonly cameraFacing = new THREE.Vector3(0, 0, 1);
  private readonly billboardUp = new THREE.Vector3(0, 1, 0);
  private readonly rotationMatrix = new THREE.Matrix4();
  private readonly sparkObject = new THREE.Object3D();
  private readonly sparkDirection = new THREE.Vector3();
  private readonly sparkOffset = new THREE.Vector3();
  private readonly sparkQuaternion = new THREE.Quaternion();
  private state: BeamState = "idle";
  private phaseAge = 0;
  private flashAge = flashDuration;
  private releaseStartStrength = 1;
  private strength = 0;
  private growth = 0;
  private sparkEmissionTimer = 0;

  constructor() {
    this.group.name = "Beam VFX";
    this.group.visible = false;
    this.beamGroup.name = "Beam Layers";
    this.group.add(this.beamGroup);

    this.texture = loadBeamTexture();
    this.maskTexture = createBeamMaskTexture();
    this.beamGeometry = new THREE.PlaneGeometry(1, 1, 1, 1);
    this.beamGeometry.translate(0.5, 0, 0);

    this.darkMaterial = createBeamMaterial(this.texture, this.maskTexture, {
      color: "#0c0603",
      hotColor: "#0f0501",
      opacity: 0.82,
      scrollSpeed: 1.96,
      threshold: 0.55,
      warpStrength: 0.04,
      blending: THREE.NormalBlending,
    });
    this.glowMaterial = createBeamMaterial(this.texture, this.maskTexture, {
      color: "#ff9d00",
      hotColor: "#fff06a",
      opacity: 0.38,
      scrollSpeed: 0.92,
      threshold: 0.025,
      warpStrength: 0.08,
      blending: THREE.AdditiveBlending,
    });
    this.coreMaterial = createBeamMaterial(this.texture, this.maskTexture, {
      color: "#ffd51f",
      hotColor: "#fffbd2",
      opacity: 0.94,
      scrollSpeed: 0.82,
      threshold: 0.16,
      warpStrength: 0.06,
      blending: THREE.AdditiveBlending,
    });
    this.electricMaterial = createBeamMaterial(this.texture, this.maskTexture, {
      color: "#fff238",
      hotColor: "#ffffff",
      opacity: 1,
      scrollSpeed: 2.4,
      threshold: 0.62,
      warpStrength: 0.12,
      blending: THREE.AdditiveBlending,
    });
    this.beamMaterials = [this.darkMaterial, this.glowMaterial, this.coreMaterial, this.electricMaterial];

    this.addBeamLayer("Dark Backing", this.darkMaterial, 0.85, 5);
    this.addBeamLayer("Beam Glow", this.glowMaterial, 0.95, 6);
    this.addBeamLayer("Beam Core", this.coreMaterial, 0.45, 7);
    this.addBeamLayer("Electric Filaments", this.electricMaterial, 0.9, 8);

    this.flashMaterial = createFlashMaterial();
    this.flashMesh = new THREE.Mesh(this.flashGeometry, this.flashMaterial);
    this.flashMesh.name = "Beam Source Flash";
    this.flashMesh.frustumCulled = false;
    this.flashMesh.renderOrder = 9;
    this.flashMesh.visible = false;
    this.group.add(this.flashMesh);

    this.sparkMesh = new THREE.InstancedMesh(this.sparkGeometry, this.sparkMaterial, sparkCount);
    this.sparkMesh.name = "Beam Sparks";
    this.sparkMesh.frustumCulled = false;
    this.sparkMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.sparkMesh);
    this.sparks = Array.from({ length: sparkCount }, () => ({
      position: new THREE.Vector3(),
      velocity: new THREE.Vector3(),
      life: 0,
      maxLife: 0,
      active: false,
    }));
    this.hideAllSparks();
  }

  start(start: THREE.Vector3, end: THREE.Vector3): void {
    this.startPoint.copy(start);
    this.endPoint.copy(end);
    this.state = "growing";
    this.phaseAge = 0;
    this.flashAge = 0;
    this.strength = 0;
    this.growth = 0;
    this.sparkEmissionTimer = 0;
    this.group.visible = true;
    this.flashMesh.visible = true;
    this.resetSparks();
  }

  setEndpoints(start: THREE.Vector3, end: THREE.Vector3): void {
    this.startPoint.copy(start);
    this.endPoint.copy(end);
  }

  stop(): void {
    if (this.state === "idle" || this.state === "releasing") {
      return;
    }
    this.state = "releasing";
    this.phaseAge = 0;
    this.releaseStartStrength = this.strength;
  }

  update(deltaTime: number, elapsedTime: number, camera: THREE.Camera, reducedMotion: boolean): void {
    if (this.state === "idle") {
      return;
    }

    if (!this.updatePhase(deltaTime, reducedMotion)) {
      return;
    }

    const distance = this.updateBeamTransform(camera);
    const visible = distance >= 0.001;
    this.beamGroup.visible = visible;
    this.updateMaterials(elapsedTime, distance, reducedMotion);
    this.updateFlash(deltaTime, camera, reducedMotion);
    this.updateSparks(deltaTime, distance, reducedMotion);
  }

  dispose(): void {
    this.beamGeometry.dispose();
    this.texture.dispose();
    this.maskTexture.dispose();
    for (const material of this.beamMaterials) {
      material.dispose();
    }
    this.flashGeometry.dispose();
    this.flashMaterial.dispose();
    this.sparkGeometry.dispose();
    this.sparkMaterial.dispose();
  }

  private addBeamLayer(name: string, material: THREE.ShaderMaterial, width: number, renderOrder: number): void {
    const mesh = new THREE.Mesh(this.beamGeometry, material);
    mesh.name = name;
    mesh.scale.y = width;
    mesh.frustumCulled = false;
    mesh.renderOrder = renderOrder;
    this.beamGroup.add(mesh);
  }

  private updatePhase(deltaTime: number, reducedMotion: boolean): boolean {
    this.phaseAge += deltaTime;

    if (this.state === "growing") {
      const duration = reducedMotion ? 0.06 : growDuration;
      const progress = THREE.MathUtils.clamp(this.phaseAge / duration, 0, 1);
      this.growth = easeOutCubic(progress);
      this.strength = easeOutCubic(progress);
      if (progress >= 1) {
        this.state = "active";
        this.phaseAge = 0;
      }
      return true;
    }

    if (this.state === "active") {
      this.growth = 1;
      this.strength = 1;
      return true;
    }

    const progress = THREE.MathUtils.clamp(this.phaseAge / releaseDuration, 0, 1);
    this.strength = this.releaseStartStrength * (1 - easeInCubic(progress));
    if (progress >= 1) {
      this.state = "idle";
      this.strength = 0;
      this.group.visible = false;
      this.flashMesh.visible = false;
      this.hideAllSparks();
      return false;
    }
    return true;
  }

  private updateBeamTransform(camera: THREE.Camera): number {
    const distance = this.startPoint.distanceTo(this.endPoint);
    if (distance < 0.001) {
      return distance;
    }

    this.direction.subVectors(this.endPoint, this.startPoint).normalize();
    this.midpoint.copy(this.startPoint).addScaledVector(this.direction, distance * 0.5);
    this.cameraFacing.subVectors(camera.position, this.midpoint);
    this.cameraFacing.addScaledVector(this.direction, -this.cameraFacing.dot(this.direction));
    if (this.cameraFacing.lengthSq() < 0.0001) {
      camera.getWorldDirection(this.cameraFacing).negate();
      this.cameraFacing.addScaledVector(this.direction, -this.cameraFacing.dot(this.direction));
    }
    if (this.cameraFacing.lengthSq() < 0.0001) {
      const useWorldUp = Math.abs(this.direction.y) < 0.9;
      this.cameraFacing.set(0, useWorldUp ? 1 : 0, useWorldUp ? 0 : 1);
      this.cameraFacing.addScaledVector(this.direction, -this.cameraFacing.dot(this.direction));
    }
    this.cameraFacing.normalize();
    this.billboardUp.crossVectors(this.cameraFacing, this.direction).normalize();
    this.cameraFacing.crossVectors(this.direction, this.billboardUp).normalize();

    this.rotationMatrix.makeBasis(this.direction, this.billboardUp, this.cameraFacing);
    this.beamGroup.position.copy(this.startPoint);
    this.beamGroup.quaternion.setFromRotationMatrix(this.rotationMatrix);
    this.beamGroup.scale.set(distance * this.growth, 1, 1);
    return distance;
  }

  private updateMaterials(elapsedTime: number, distance: number, reducedMotion: boolean): void {
    const pulse = reducedMotion ? 1 : 0.94 + Math.sin(elapsedTime * 28) * 0.06;
    const repeat = THREE.MathUtils.clamp(distance / 2.2, 1, 3.5);
    const opacities = [0.82, 0.38, 0.94, 1];
    const warps = [0.04, 0.08, 0.06, 0.32];

    for (let index = 0; index < this.beamMaterials.length; index += 1) {
      const material = this.beamMaterials[index];
      material.uniforms.uTime.value = elapsedTime;
      material.uniforms.uOpacity.value = opacities[index] * this.strength * pulse;
      material.uniforms.uRepeat.value = repeat;
      material.uniforms.uWarpStrength.value = reducedMotion ? 0 : warps[index];
    }
  }

  private updateFlash(deltaTime: number, camera: THREE.Camera, reducedMotion: boolean): void {
    this.flashAge += deltaTime;
    if (this.flashAge >= flashDuration || this.strength <= 0) {
      this.flashMesh.visible = false;
      return;
    }

    const progress = this.flashAge / flashDuration;
    const scale = THREE.MathUtils.lerp(0.16, reducedMotion ? 0.42 : 0.78, easeOutCubic(progress));
    this.flashMesh.visible = true;
    this.flashMesh.position.copy(this.startPoint);
    this.flashMesh.quaternion.copy(camera.quaternion);
    this.flashMesh.scale.setScalar(scale);
    this.flashMaterial.uniforms.uOpacity.value = (1 - progress) * this.strength;
  }

  private updateSparks(deltaTime: number, distance: number, reducedMotion: boolean): void {
    if (reducedMotion) {
      if (this.sparkMesh.visible) {
        this.sparkMesh.visible = false;
        this.resetSparks();
      }
      return;
    }

    this.sparkMesh.visible = true;
    if ((this.state === "growing" || this.state === "active") && distance >= 0.001) {
      this.sparkEmissionTimer -= deltaTime;
      while (this.sparkEmissionTimer <= 0) {
        this.emitSpark(distance);
        this.sparkEmissionTimer += 0.045;
      }
    }

    for (let index = 0; index < this.sparks.length; index += 1) {
      const spark = this.sparks[index];
      if (!spark.active) {
        this.setHiddenSparkMatrix(index);
        continue;
      }

      spark.life -= deltaTime;
      if (spark.life <= 0) {
        spark.active = false;
        this.setHiddenSparkMatrix(index);
        continue;
      }

      spark.position.addScaledVector(spark.velocity, deltaTime);
      const lifeProgress = spark.life / spark.maxLife;
      const length = THREE.MathUtils.lerp(0.08, 0.34, lifeProgress);
      const thickness = 0.018 * lifeProgress;
      this.sparkDirection.copy(spark.velocity).normalize();
      this.sparkQuaternion.setFromUnitVectors(localBeamAxis, this.sparkDirection);
      this.sparkObject.position.copy(spark.position);
      this.sparkObject.quaternion.copy(this.sparkQuaternion);
      this.sparkObject.scale.set(length, thickness, thickness);
      this.sparkObject.updateMatrix();
      this.sparkMesh.setMatrixAt(index, this.sparkObject.matrix);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  private emitSpark(distance: number): void {
    const spark = this.sparks.find((candidate) => !candidate.active);
    if (!spark) {
      return;
    }

    const along = Math.random() * Math.min(distance * this.growth, 1.1);
    const lateral = (Math.random() - 0.5) * 0.18;
    spark.position.copy(this.startPoint).addScaledVector(this.direction, along).addScaledVector(this.billboardUp, lateral);

    const speed = THREE.MathUtils.lerp(3.2, 6.8, Math.random());
    spark.velocity.copy(this.direction).multiplyScalar(speed);
    this.sparkOffset
      .copy(this.billboardUp)
      .multiplyScalar((Math.random() - 0.5) * 1.8)
      .addScaledVector(this.cameraFacing, (Math.random() - 0.5) * 0.7);
    spark.velocity.add(this.sparkOffset);
    spark.maxLife = THREE.MathUtils.lerp(0.16, 0.34, Math.random());
    spark.life = spark.maxLife;
    spark.active = true;
  }

  private resetSparks(): void {
    for (const spark of this.sparks) {
      spark.active = false;
      spark.life = 0;
    }
    this.hideAllSparks();
  }

  private hideAllSparks(): void {
    for (let index = 0; index < sparkCount; index += 1) {
      this.setHiddenSparkMatrix(index);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
  }

  private setHiddenSparkMatrix(index: number): void {
    this.sparkObject.position.set(0, 0, 0);
    this.sparkObject.quaternion.identity();
    this.sparkObject.scale.set(0, 0, 0);
    this.sparkObject.updateMatrix();
    this.sparkMesh.setMatrixAt(index, this.sparkObject.matrix);
  }
}

function loadBeamTexture(): THREE.Texture {
  const texture = new THREE.TextureLoader().load(beamTextureUrl);
  texture.name = "Beam Lightning Texture";
  texture.wrapS = THREE.MirroredRepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

function createBeamMaskTexture(): THREE.DataTexture {
  const width = 256;
  const data = new Uint8Array(width * 4);
  for (let index = 0; index < width; index += 1) {
    const t = index / (width - 1);
    const fadeIn = smoothstep(0, 0.075, t);
    const fadeOut = 1 - smoothstep(0.88, 1, t);
    const value = Math.round(255 * fadeIn * fadeOut);
    const offset = index * 4;
    data[offset] = value;
    data[offset + 1] = value;
    data[offset + 2] = value;
    data[offset + 3] = 255;
  }

  const texture = new THREE.DataTexture(data, width, 1, THREE.RGBAFormat);
  texture.name = "Beam End Mask";
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.needsUpdate = true;
  return texture;
}

function createBeamMaterial(
  texture: THREE.Texture,
  maskTexture: THREE.Texture,
  options: BeamMaterialOptions,
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTexture: { value: texture },
      uMaskTexture: { value: maskTexture },
      uTime: { value: 0 },
      uRepeat: { value: 1 },
      uOpacity: { value: options.opacity },
      uScrollSpeed: { value: options.scrollSpeed },
      uThreshold: { value: options.threshold },
      uWarpStrength: { value: options.warpStrength },
      uColor: { value: new THREE.Color(options.color) },
      uHotColor: { value: new THREE.Color(options.hotColor) },
    },
    vertexShader: beamVertexShader,
    fragmentShader: beamFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: options.blending,
    toneMapped: false,
  });
}

function createFlashMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uOpacity: { value: 0 },
    },
    vertexShader: flashVertexShader,
    fragmentShader: flashFragmentShader,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(value: number): number {
  return 1 - Math.pow(1 - value, 3);
}

function easeInCubic(value: number): number {
  return value * value * value;
}

const beamVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const beamFragmentShader = `
  uniform sampler2D uTexture;
  uniform sampler2D uMaskTexture;
  uniform float uTime;
  uniform float uRepeat;
  uniform float uOpacity;
  uniform float uScrollSpeed;
  uniform float uThreshold;
  uniform float uWarpStrength;
  uniform vec3 uColor;
  uniform vec3 uHotColor;
  varying vec2 vUv;

  float hash21(vec2 point) {
    point = fract(point * vec2(123.34, 456.21));
    point += dot(point, point + 45.32);
    return fract(point.x * point.y);
  }

  float valueNoise(vec2 point) {
    vec2 cell = floor(point);
    vec2 local = fract(point);
    local = local * local * (3.0 - 2.0 * local);
    float a = hash21(cell);
    float b = hash21(cell + vec2(1.0, 0.0));
    float c = hash21(cell + vec2(0.0, 1.0));
    float d = hash21(cell + vec2(1.0, 1.0));
    return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);
  }

  void main() {
    float travel = vUv.x * uRepeat - uTime * uScrollSpeed;
    float mirrored = abs(mod(travel, 2.0) - 1.0);
    vec2 textureUv = vec2(mirrored, vUv.y);

    float warpA = valueNoise(vec2(vUv.x * 30.0 - uTime * 3.7, vUv.y * 8.0 + uTime * 1.9));
    float warpB = valueNoise(vec2(vUv.x * 17.0 + uTime * 2.2, vUv.y * 15.0 - uTime * 2.8));
    textureUv.y += ((warpA - 0.5) * 0.72 + (warpB - 0.5) * 0.28) * uWarpStrength;
    textureUv.y = clamp(textureUv.y, 0.0, 1.0);

    vec3 textureColor = texture2D(uTexture, textureUv).rgb;
    float luminance = max(textureColor.r, max(textureColor.g, textureColor.b));
    float endMask = texture2D(uMaskTexture, vec2(vUv.x, 0.5)).r;
    float alpha = smoothstep(uThreshold, min(1.0, uThreshold + 0.24), luminance) * endMask * uOpacity;
    float heat = smoothstep(0.42, 0.92, luminance);
    vec3 color = mix(uColor, uHotColor, heat);

    if (alpha <= 0.002) {
      discard;
    }
    gl_FragColor = vec4(color, alpha);
  }
`;

const flashVertexShader = `
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const flashFragmentShader = `
  uniform float uOpacity;
  varying vec2 vUv;

  void main() {
    float distanceToCenter = length(vUv - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.0, 0.34, distanceToCenter);
    float glow = 1.0 - smoothstep(0.05, 1.0, distanceToCenter);
    float alpha = (core + glow * 0.72) * uOpacity;
    vec3 color = mix(vec3(1.0, 0.66, 0.05), vec3(1.0, 1.0, 0.88), core);
    if (alpha <= 0.002) {
      discard;
    }
    gl_FragColor = vec4(color, alpha);
  }
`;
