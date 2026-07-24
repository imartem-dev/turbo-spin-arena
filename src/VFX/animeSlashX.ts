import * as THREE from "three";

export type AnimeSlashXTextures = {
  line?: THREE.Texture;
  circle?: THREE.Texture;
};

export type AnimeSlashXOptions = {
  duration?: number;
  color?: THREE.ColorRepresentation;
  material1Color?: THREE.ColorRepresentation;
  material2Color?: THREE.ColorRepresentation;
  lineLength?: number;
  lineWidth?: number;
  circleSize?: number;
  sharpness?: number;
};

const lineMaskUrl = `${import.meta.env.BASE_URL}assets/vfx/anime-slash-x/T_VFX_line_1.webp`;
const circleMaskUrl = `${import.meta.env.BASE_URL}assets/vfx/anime-slash-x/T_VFX_Circle_3.webp`;

/** A camera-facing crossed slash impact placed at a world-space cursor position. */
export class AnimeSlashX {
  readonly group = new THREE.Group();

  get isActive(): boolean {
    return this.active;
  }

  private readonly lineGeometry: THREE.PlaneGeometry;
  private readonly circleGeometry: THREE.PlaneGeometry;
  private readonly lineTexture: THREE.Texture;
  private readonly circleTexture: THREE.Texture;
  private readonly ownsLineTexture: boolean;
  private readonly ownsCircleTexture: boolean;
  private readonly duration: number;
  private readonly lineLength: number;
  private readonly circleSize: number;
  private readonly blackLine: THREE.Mesh;
  private readonly blackLineGlow: THREE.Mesh;
  private readonly blueLineCore: THREE.Mesh;
  private readonly blueLine: THREE.Mesh;
  private readonly blackRing: THREE.Mesh;
  private readonly blackRingGlow: THREE.Mesh;
  private readonly blueRingCore: THREE.Mesh;
  private readonly blueRing: THREE.Mesh;
  private readonly materials: THREE.ShaderMaterial[] = [];
  private blueRingStartDiameter = 0.3;
  private blueRingEndDiameter = 0.8;
  private blackRingStartDiameter = 0.3;
  private blackRingEndDiameter = 0.8;
  private elapsed = 0;
  private active = false;

  constructor(scene: THREE.Scene, customTextures: AnimeSlashXTextures = {}, options: AnimeSlashXOptions = {}) {
    this.duration = options.duration ?? 0.2;
    this.lineTexture = customTextures.line ?? loadMaskTexture(lineMaskUrl, "AnimeSlashX Line Mask");
    this.circleTexture = customTextures.circle ?? loadMaskTexture(circleMaskUrl, "AnimeSlashX Circle Mask");
    this.ownsLineTexture = !customTextures.line;
    this.ownsCircleTexture = !customTextures.circle;
    this.lineLength = options.lineLength ?? 3.2;
    this.circleSize = options.circleSize ?? 2.25;
    this.lineGeometry = new THREE.PlaneGeometry(this.lineLength, options.lineWidth ?? 0.52);
    this.circleGeometry = new THREE.PlaneGeometry(this.circleSize, this.circleSize);
    this.group.name = "Anime Slash X";
    this.group.visible = false;
    this.group.scale.setScalar(2.8);
    this.group.renderOrder = 1000;

    const material1Color = new THREE.Color(options.material1Color ?? options.color ?? "#4dbdff");
    const material1GlowColor = material1Color.clone().multiplyScalar(12.0);
    const material2Color = new THREE.Color(options.material2Color ?? "#05070c");
    const material2GlowColor = material2Color.clone().multiplyScalar(12.0);
    const sharpness = options.sharpness ?? 0.35;
    this.blackLine = this.createLineLayer(true, material2Color, sharpness, 1000, 0.22, 0.78);
    this.blackLineGlow = this.createLineLayer(false, material2GlowColor, sharpness, 1002, 0.22, 0.78);
    this.blueLineCore = this.createLineLayer(false, material1Color, sharpness, 1008, 0, 0.78, 1, THREE.NormalBlending);
    this.blueLine = this.createLineLayer(false, material1GlowColor, sharpness, 1009, 0, 0.78);
    this.blackRing = this.createCircleLayer(true, material2Color, 1001, 0.704, 0.296);
    this.blackRingGlow = this.createCircleLayer(false, material2GlowColor, 1003, 0.704, 0.296);
    this.blueRingCore = this.createCircleLayer(false, material1Color, 1010, 0.48, 0.52, 1, THREE.NormalBlending);
    this.blueRing = this.createCircleLayer(false, material1GlowColor, 1011, 0.48, 0.52);
    this.group.add(
      this.blackLine,
      this.blackRing,
      this.blackLineGlow,
      this.blackRingGlow,
      this.blueLineCore,
      this.blueLine,
      this.blueRingCore,
      this.blueRing,
    );
    scene.add(this.group);
  }

  trigger(position: THREE.Vector3, options: AnimeSlashXOptions = {}): void {
    const angleBetweenLines = THREE.MathUtils.degToRad(THREE.MathUtils.randFloat(20, 80));
    const blackAngle = Math.random() * Math.PI * 2;
    const blueAngle = blackAngle + angleBetweenLines;
    const material1Color = new THREE.Color(options.material1Color ?? options.color ?? "#4dbdff");
    const material1GlowColor = material1Color.clone().multiplyScalar(12.0);
    const material2Color = new THREE.Color(options.material2Color ?? "#05070c");
    const material2GlowColor = material2Color.clone().multiplyScalar(12.0);
    this.elapsed = 0;
    this.active = true;
    this.group.visible = true;
    this.group.position.copy(position);

    this.blackLine.rotation.z = blackAngle;
    this.blackLineGlow.rotation.z = blackAngle;
    this.blueLineCore.rotation.z = blueAngle;
    this.blueLine.rotation.z = blueAngle;
    const blackLineScale = THREE.MathUtils.randFloat(1.02, 1.07);
    this.blackLine.scale.setScalar(blackLineScale);
    this.blackLineGlow.scale.setScalar(blackLineScale);
    this.blueLineCore.scale.setScalar(1);
    this.blueLine.scale.setScalar(1);
    this.blackRing.rotation.z = blackAngle;
    this.blackRingGlow.rotation.z = blackAngle;
    this.blueRingCore.rotation.z = blueAngle;
    this.blueRing.rotation.z = blueAngle;
    this.blueRingStartDiameter = THREE.MathUtils.randFloat(0.3, 0.45);
    this.blueRingEndDiameter = THREE.MathUtils.randFloat(0.8, 0.9);
    this.blackRingStartDiameter = THREE.MathUtils.randFloat(0.3, 0.45);
    this.blackRingEndDiameter = THREE.MathUtils.randFloat(0.8, 0.9);
    this.setRingScale(this.blueRingCore, 0, this.blueRingStartDiameter, this.blueRingEndDiameter);
    this.setRingScale(this.blueRing, 0, this.blueRingStartDiameter, this.blueRingEndDiameter);
    this.setRingScale(this.blackRing, 0, this.blackRingStartDiameter, this.blackRingEndDiameter);
    this.setRingScale(this.blackRingGlow, 0, this.blackRingStartDiameter, this.blackRingEndDiameter);
    setMaterialColor(this.blueLineCore.material as THREE.ShaderMaterial, material1Color);
    setMaterialColor(this.blueRingCore.material as THREE.ShaderMaterial, material1Color);
    setMaterialColor(this.blueLine.material as THREE.ShaderMaterial, material1GlowColor);
    setMaterialColor(this.blueRing.material as THREE.ShaderMaterial, material1GlowColor);
    setMaterialColor(this.blackLine.material as THREE.ShaderMaterial, material2Color);
    setMaterialColor(this.blackLineGlow.material as THREE.ShaderMaterial, material2GlowColor);
    setMaterialColor(this.blackRing.material as THREE.ShaderMaterial, material2Color);
    setMaterialColor(this.blackRingGlow.material as THREE.ShaderMaterial, material2GlowColor);
    this.updateUniforms(0);
  }

  update(deltaTime: number, camera: THREE.Camera): void {
    if (!this.active) return;
    // The whole effect remains a billboarding 2D composition, while its child Z rotations stay in screen space.
    this.group.quaternion.copy(camera.quaternion);
    this.elapsed += deltaTime;
    const progress = THREE.MathUtils.clamp(this.elapsed / this.duration, 0, 1);
    const blueRingProgress = localProgress(progress, 0.48, 0.52);
    this.setRingScale(this.blueRingCore, blueRingProgress, this.blueRingStartDiameter, this.blueRingEndDiameter);
    this.setRingScale(this.blueRing, blueRingProgress, this.blueRingStartDiameter, this.blueRingEndDiameter);
    const blackRingProgress = localProgress(progress, 0.704, 0.296);
    this.setRingScale(this.blackRing, blackRingProgress, this.blackRingStartDiameter, this.blackRingEndDiameter);
    this.setRingScale(this.blackRingGlow, blackRingProgress, this.blackRingStartDiameter, this.blackRingEndDiameter);
    this.updateUniforms(progress);
    if (progress >= 1) {
      this.active = false;
      this.group.visible = false;
    }
  }

  dispose(): void {
    this.lineGeometry.dispose();
    this.circleGeometry.dispose();
    for (const material of this.materials) material.dispose();
    if (this.ownsLineTexture) this.lineTexture.dispose();
    if (this.ownsCircleTexture) this.circleTexture.dispose();
    this.group.removeFromParent();
  }

  private createLineLayer(
    isDarkLayer: boolean,
    color: THREE.Color,
    sharpness: number,
    renderOrder: number,
    start: number,
    duration: number,
    opacity = isDarkLayer ? 0.82 : 6,
    blending = isDarkLayer ? THREE.NormalBlending : THREE.AdditiveBlending,
  ): THREE.Mesh {
    const material = createLineMaterial(this.lineTexture, color, sharpness, isDarkLayer, start, duration);
    material.uniforms.uOpacity.value = opacity;
    material.blending = blending;
    this.materials.push(material);
    const mesh = new THREE.Mesh(this.lineGeometry, material);
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    return mesh;
  }

  private createCircleLayer(
    isDarkLayer: boolean,
    color: THREE.Color,
    renderOrder: number,
    start: number,
    duration: number,
    opacity = isDarkLayer ? 0.82 : 6,
    blending = isDarkLayer ? THREE.NormalBlending : THREE.AdditiveBlending,
  ): THREE.Mesh {
    const material = createCircleMaterial(this.circleTexture, color, isDarkLayer, start, duration);
    material.uniforms.uOpacity.value = opacity;
    material.blending = blending;
    this.materials.push(material);
    const mesh = new THREE.Mesh(this.circleGeometry, material);
    mesh.renderOrder = renderOrder;
    mesh.frustumCulled = false;
    return mesh;
  }

  private updateUniforms(progress: number): void {
    for (const material of this.materials) material.uniforms.uProgress.value = progress;
  }

  private setRingScale(ring: THREE.Mesh, progress: number, startDiameter: number, endDiameter: number): void {
    const growth = smoothStep01(Math.min(progress / 0.78, 1));
    const diameter = THREE.MathUtils.lerp(startDiameter, endDiameter, growth) * this.lineLength;
    const horizontalScale = diameter / this.circleSize;
    ring.scale.set(horizontalScale, horizontalScale * 0.58, 1);
  }
}

function createLineMaterial(mask: THREE.Texture, color: THREE.Color, sharpness: number, isDarkLayer: boolean, start: number, duration: number): THREE.ShaderMaterial {
  return createMaskMaterial(mask, color, sharpness, isDarkLayer, start, duration, `
    float wedge = localProgress - abs(vUv.y - 0.5) * uSharpness;
    float tail = smoothstep(0.62, 0.94, localProgress) * 0.72;
    float visible = step(tail, vUv.x) * step(vUv.x, wedge);
    alpha *= visible * (1.0 - smoothstep(0.84, 1.0, localProgress));
  `);
}

function createCircleMaterial(mask: THREE.Texture, color: THREE.Color, isDarkLayer: boolean, start: number, duration: number): THREE.ShaderMaterial {
  return createMaskMaterial(mask, color, 0.35, isDarkLayer, start, duration, `
    alpha *= 1.0 - smoothstep(0.56, 1.0, localProgress);
  `);
}

function createMaskMaterial(mask: THREE.Texture, color: THREE.Color, sharpness: number, isDarkLayer: boolean, start: number, duration: number, animation: string): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uProgress: { value: 0 }, uMask: { value: mask }, uColor: { value: color.clone() }, uSharpness: { value: sharpness },
      uStart: { value: start }, uDuration: { value: duration }, uOpacity: { value: isDarkLayer ? 0.82 : 6 },
    },
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uProgress; uniform sampler2D uMask; uniform vec3 uColor; uniform float uSharpness; uniform float uStart; uniform float uDuration; uniform float uOpacity;
      void main() {
        vec4 mask = texture2D(uMask, vUv); float alpha = max(max(mask.r, mask.g), mask.b) * mask.a;
        float layerVisibility = step(uStart, uProgress); float localProgress = clamp((uProgress - uStart) / uDuration, 0.0, 1.0);
        ${animation}
        alpha *= layerVisibility; if (alpha < 0.01) discard;
        gl_FragColor = vec4(uColor, alpha * uOpacity);
      }
    `,
    transparent: true, depthTest: false, depthWrite: false,
    blending: isDarkLayer ? THREE.NormalBlending : THREE.AdditiveBlending,
    side: THREE.DoubleSide, toneMapped: false,
  });
}

function loadMaskTexture(url: string, name: string): THREE.Texture {
  const texture = new THREE.TextureLoader().load(url);
  texture.name = name;
  texture.colorSpace = THREE.NoColorSpace;
  texture.wrapS = THREE.ClampToEdgeWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = false;
  return texture;
}

function setMaterialColor(material: THREE.ShaderMaterial, color: THREE.Color): void {
  material.uniforms.uColor.value.copy(color);
}

function localProgress(progress: number, start: number, duration: number): number {
  return THREE.MathUtils.clamp((progress - start) / duration, 0, 1);
}

function smoothStep01(value: number): number {
  const t = THREE.MathUtils.clamp(value, 0, 1);
  return t * t * (3 - 2 * t);
}
