import * as THREE from "three";
import { FireballHead } from "./fireballHead";

export type DashVfxOptions = {
  character: THREE.Object3D;
  /** One shared hue for the ribbon, ground path, particles, and character glow. */
  color?: THREE.ColorRepresentation;
  tendrilCount?: number;
  particleCapacity?: number;
};

type ParticleLayer = {
  mesh: THREE.InstancedMesh;
  material: THREE.ShaderMaterial;
  origin: THREE.InstancedBufferAttribute;
  velocity: THREE.InstancedBufferAttribute;
  birth: THREE.InstancedBufferAttribute;
  lifetime: THREE.InstancedBufferAttribute;
  size: THREE.InstancedBufferAttribute;
  seed: THREE.InstancedBufferAttribute;
};

const INACTIVE = -1000;
const DEFAULT_DURATION = 0.24;
const TRAIL_LIFETIME = 1;
const EMIT_INTERVAL = 0.035;
const up = new THREE.Vector3(0, 1, 0);

/** Reusable, world-space VFX. Add group to a scene, call init(), update(delta), and dispose() on teardown. */
export class DashVfx {
  readonly group = new THREE.Group();
  private readonly energy = new THREE.Group();
  private readonly ground = new THREE.Group();
  private readonly character: THREE.Object3D;
  private readonly color = new THREE.Color();
  private readonly capacity: number;
  private readonly start = new THREE.Vector3();
  private readonly end = new THREE.Vector3();
  private readonly currentPosition = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly emissionCenter = new THREE.Vector3();
  private readonly emissionOffset = new THREE.Vector3();
  private readonly emissionOrigin = new THREE.Vector3();
  private readonly emissionVelocity = new THREE.Vector3();
  private readonly ribbons: THREE.Mesh[] = [];
  private readonly particleLayers: ParticleLayer[] = [];
  private readonly resources: Array<THREE.BufferGeometry | THREE.Material> = [];
  private mainMaterial: THREE.ShaderMaterial | null = null;
  private groundMaterial: THREE.ShaderMaterial | null = null;
  private fireballHead: FireballHead | null = null;
  private initialized = false;
  private active = false;
  private elapsed = 0;
  private nextEmission = 0;
  private cursor = 0;
  private finishTime: number | null = null;
  private autoFinishAt: number | null = null;

  constructor(options: DashVfxOptions) {
    this.character = options.character;
    this.color.set(options.color ?? "#ff7a18");
    this.capacity = options.particleCapacity ?? 72;
    this.group.name = "Dash VFX";
    this.group.visible = false;
    this.energy.name = "Dash Energy";
    this.ground.name = "Dash Ground Trail";
    this.createRibbons(options.tendrilCount ?? 12);
  }

  init(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.mainMaterial = createMainMaterial();
    const main = new THREE.Mesh(createTubeGeometry(28, 12), this.mainMaterial);
    main.name = "Dash Main Ribbon";
    main.frustumCulled = false;
    main.renderOrder = 7;
    this.energy.add(main);
    this.resources.push(main.geometry, this.mainMaterial);

    this.groundMaterial = createGroundMaterial();
    const path = new THREE.Mesh(createGroundGeometry(36), this.groundMaterial);
    path.name = "Dash Ground Path";
    path.frustumCulled = false;
    path.renderOrder = 2;
    this.ground.add(path);
    this.resources.push(path.geometry, this.groundMaterial);

    this.createParticleLayer(true);
    this.fireballHead = new FireballHead(this.group, { flameColor: this.color, size: 1.55 });
    this.group.add(this.energy, ...this.particleLayers.map((layer) => layer.mesh));
    this.applyColor();
  }

  setColor(color: THREE.ColorRepresentation): void {
    this.color.set(color);
    if (this.initialized) this.applyColor();
  }

  triggerDashVFX(startVector: THREE.Vector3, endVector: THREE.Vector3, duration = DEFAULT_DURATION): void {
    if (startVector.distanceToSquared(endVector) < 0.0001) return;
    this.end.copy(endVector);
    this.beginDashVFX(startVector);
    this.updateDashVFX(endVector);
    this.autoFinishAt = Math.max(0.05, duration);
  }

  /** Starts visual emission. The game keeps ownership of character movement. */
  beginDashVFX(startVector: THREE.Vector3): void {
    this.init();
    this.start.copy(startVector);
    this.currentPosition.copy(startVector);
    this.direction.set(0, 0, 1);
    this.elapsed = 0;
    this.nextEmission = 0;
    this.cursor = 0;
    this.active = true;
    this.finishTime = null;
    this.autoFinishAt = null;

    this.syncTrailTransform();
    for (const layer of this.particleLayers) {
      for (let index = 0; index < this.capacity; index += 1) layer.birth.setX(index, INACTIVE);
      layer.birth.needsUpdate = true;
    }
    this.group.visible = true;
    this.fireballHead!.setVisible(true);
  }

  /** Call once per frame after the game has moved the character. */
  updateDashVFX(currentPosition: THREE.Vector3): void {
    if (!this.active) return;
    this.currentPosition.copy(currentPosition);
    this.syncTrailTransform();
  }

  /** Stops emitting new particles; existing trail elements fade naturally. */
  finishDashVFX(): void {
    if (!this.active) return;
    this.active = false;
    this.finishTime = this.elapsed;
    this.autoFinishAt = null;
  }

  update(delta: number): void {
    if (!this.initialized || !this.group.visible) return;
    this.elapsed += Math.max(0, delta);
    const fadeStart = this.finishTime ?? this.elapsed;
    const energyOpacity = this.active ? 1 : 1 - smoothstep(this.elapsed, fadeStart, fadeStart + 0.22);
    this.mainMaterial!.uniforms.uTime.value = this.elapsed;
    this.mainMaterial!.uniforms.uOpacity.value = energyOpacity;
    this.groundMaterial!.uniforms.uTime.value = this.elapsed;
    this.groundMaterial!.uniforms.uOpacity.value = this.active
      ? 1
      : 1 - smoothstep(this.elapsed, fadeStart, fadeStart + TRAIL_LIFETIME);
    for (const ribbon of this.ribbons) {
      const material = ribbon.material as THREE.ShaderMaterial;
      material.uniforms.uTime.value = this.elapsed;
      material.uniforms.uOpacity.value = energyOpacity;
    }
    for (const layer of this.particleLayers) layer.material.uniforms.uTime.value = this.elapsed;
    this.fireballHead!.update(delta, this.active ? 0.42 : energyOpacity * 0.16);
    this.fireballHead!.setVisible(this.active || energyOpacity > 0.02);

    if (this.active) {
      while (this.nextEmission <= this.elapsed) {
        this.emit(this.nextEmission);
        this.nextEmission += EMIT_INTERVAL;
      }
      if (this.autoFinishAt !== null && this.elapsed >= this.autoFinishAt) this.finishDashVFX();
    }
    if (!this.active && !this.hasParticles() && this.finishTime !== null && this.elapsed > this.finishTime + TRAIL_LIFETIME) {
      this.group.visible = false;
      this.fireballHead!.setVisible(false);
    }
  }

  /** Supplies an existing scene-depth prepass; this class never changes camera settings. */
  setDepthContext(depthTexture: THREE.Texture, resolution: THREE.Vector2, near: number, far: number): void {
    this.init();
    this.groundMaterial!.uniforms.uSceneDepth.value = depthTexture;
    this.groundMaterial!.uniforms.uResolution.value.copy(resolution);
    this.groundMaterial!.uniforms.uCameraNear.value = near;
    this.groundMaterial!.uniforms.uCameraFar.value = far;
    this.groundMaterial!.uniforms.uUseDepthFade.value = 1;
  }

  dispose(): void {
    for (const resource of this.resources) resource.dispose();
    this.group.clear();
    this.fireballHead?.dispose();
    this.active = false;
    this.initialized = false;
  }

  private createRibbons(count: number): void {
    for (let index = 0; index < count; index += 1) {
      const material = createTendrilMaterial(index / count);
      const ribbon = new THREE.Mesh(createTendrilGeometry(index), material);
      ribbon.name = `Dash Tendril ${index + 1}`;
      ribbon.rotation.y = (index / count) * Math.PI * 2;
      ribbon.frustumCulled = false;
      ribbon.renderOrder = 8;
      this.ribbons.push(ribbon);
      this.energy.add(ribbon);
      this.resources.push(ribbon.geometry, material);
    }
  }

  private createParticleLayer(spark: boolean): void {
    const origin = attribute(this.capacity * 3, 3);
    const velocity = attribute(this.capacity * 3, 3);
    const birth = attribute(this.capacity, 1, INACTIVE);
    const lifetime = attribute(this.capacity, 1);
    const size = attribute(this.capacity, 1);
    const seed = attribute(this.capacity, 1);
    const geometry = new THREE.IcosahedronGeometry(spark ? 1 : 0.8, 1);
    geometry.setAttribute("instanceOrigin", origin);
    geometry.setAttribute("instanceVelocity", velocity);
    geometry.setAttribute("instanceBirth", birth);
    geometry.setAttribute("instanceLifetime", lifetime);
    geometry.setAttribute("instanceSize", size);
    geometry.setAttribute("instanceSeed", seed);
    const material = createParticleMaterial(spark);
    const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
    mesh.name = spark ? "Dash Sparks" : "Dash Smoke";
    mesh.frustumCulled = false;
    mesh.renderOrder = spark ? 9 : 3;
    const identity = new THREE.Matrix4();
    for (let index = 0; index < this.capacity; index += 1) mesh.setMatrixAt(index, identity);
    mesh.instanceMatrix.needsUpdate = true;
    this.particleLayers.push({ mesh, material, origin, velocity, birth, lifetime, size, seed });
    this.resources.push(geometry, material);
  }

  private emit(birthTime: number): void {
    this.emissionCenter.copy(this.currentPosition);
    this.side.crossVectors(this.direction, up);
    if (this.side.lengthSq() < 0.001) this.side.set(1, 0, 0); else this.side.normalize();
    for (let index = 0; index < 3; index += 1) {
      const seed = this.cursor * 23.7 + birthTime * 91 + index * 5.9;
      const angle = random(seed) * Math.PI * 2;
      this.emissionOffset.copy(this.side).multiplyScalar(Math.cos(angle) * (0.08 + random(seed + 1) * 0.42));
      this.emissionOffset.y = Math.sin(angle) * 0.25 + 0.32;
      this.emissionOrigin.copy(this.emissionCenter).add(this.emissionOffset);
      this.emissionVelocity.copy(this.emissionOffset).multiplyScalar(3.2).addScaledVector(this.direction, 0.6 + random(seed + 2));
      this.write(0, this.emissionOrigin, this.emissionVelocity, birthTime, 0.28 + random(seed + 3) * 0.4, 0.03 + random(seed + 4) * 0.055, seed);
    }
  }

  private write(layerIndex: number, origin: THREE.Vector3, velocity: THREE.Vector3, birthTime: number, lifetime: number, size: number, seed: number): void {
    const layer = this.particleLayers[layerIndex];
    const slot = this.cursor % this.capacity;
    layer.origin.setXYZ(slot, origin.x, origin.y, origin.z);
    layer.velocity.setXYZ(slot, velocity.x, velocity.y, velocity.z);
    layer.birth.setX(slot, birthTime);
    layer.lifetime.setX(slot, lifetime);
    layer.size.setX(slot, size);
    layer.seed.setX(slot, random(seed));
    for (const item of [layer.origin, layer.velocity, layer.birth, layer.lifetime, layer.size, layer.seed]) item.needsUpdate = true;
    this.cursor += 1;
  }

  private hasParticles(): boolean {
    return this.particleLayers.some((layer) => {
      for (let index = 0; index < this.capacity; index += 1) {
        if (layer.birth.getX(index) > INACTIVE && this.elapsed < layer.birth.getX(index) + layer.lifetime.getX(index)) return true;
      }
      return false;
    });
  }

  private syncTrailTransform(): void {
    const distance = this.start.distanceTo(this.currentPosition);
    if (distance < 0.001) {
      this.energy.visible = false;
      this.ground.visible = false;
      return;
    }
    this.direction.subVectors(this.currentPosition, this.start).normalize();
    this.rotation.setFromUnitVectors(up, this.direction);
    this.energy.visible = true;
    this.energy.position.copy(this.start);
    this.energy.quaternion.copy(this.rotation);
    // Let the taper overlap the fireball base instead of ending at the model silhouette.
    this.energy.scale.set(2.8, distance + 0.28, 2.8);
    this.ground.visible = true;
    this.ground.position.copy(this.start).addScaledVector(up, 0.028);
    this.ground.quaternion.copy(this.rotation);
    this.ground.scale.set(2.6, distance, 2.6);
    this.fireballHead!.setPosition(
      this.currentPosition.x + this.direction.x * 0.08,
      this.currentPosition.y + 0.48,
      this.currentPosition.z + this.direction.z * 0.08,
    );
    this.fireballHead!.setDirection(this.direction);
  }

  private applyColor(): void {
    for (const resource of this.resources) {
      if (resource instanceof THREE.ShaderMaterial && resource.uniforms.uColor) {
        resource.uniforms.uColor.value.copy(this.color);
      }
    }
    this.fireballHead?.setColor(this.color);
  }
}

function createTubeGeometry(lengthSegments: number, radialSegments: number): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let y = 0; y <= lengthSegments; y += 1) {
    const t = y / lengthSegments;
    const bodyWidth = THREE.MathUtils.lerp(0.05, 0.43, THREE.MathUtils.clamp(t / 0.78, 0, 1));
    const headTaper = THREE.MathUtils.lerp(1, 0.38, THREE.MathUtils.clamp((t - 0.78) / 0.22, 0, 1));
    const radius = bodyWidth * headTaper;
    for (let x = 0; x <= radialSegments; x += 1) {
      const angle = (x / radialSegments) * Math.PI * 2;
      positions.push(Math.cos(angle) * radius, t, Math.sin(angle) * radius); uvs.push(x / radialSegments, t);
    }
  }
  for (let y = 0; y < lengthSegments; y += 1) for (let x = 0; x < radialSegments; x += 1) {
    const a = y * (radialSegments + 1) + x, b = a + radialSegments + 1;
    indices.push(a, b, a + 1, a + 1, b, b + 1);
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)).setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)).setIndex(indices);
}

function createTendrilGeometry(index: number): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [], segments = 12, seed = index * 7.1;
  for (let y = 0; y <= segments; y += 1) {
    const t = y / segments, width = THREE.MathUtils.lerp(0.002, 0.035, t);
    const center = Math.sin(t * 9 + seed) * (0.06 + t * 0.08) + (0.09 + random(seed) * 0.33) * t;
    positions.push(center - width, t, 0, center + width, t, 0); uvs.push(0, t, 1, t);
    if (y < segments) { const a = y * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)).setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)).setIndex(indices);
}

function createGroundGeometry(segments: number): THREE.BufferGeometry {
  const positions: number[] = [], uvs: number[] = [], indices: number[] = [];
  for (let y = 0; y <= segments; y += 1) {
    const t = y / segments, width = THREE.MathUtils.lerp(0.1, 0.78, t);
    positions.push(-width, 0, t, width, 0, t); uvs.push(0, t, 1, t);
    if (y < segments) { const a = y * 2; indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return new THREE.BufferGeometry().setAttribute("position", new THREE.Float32BufferAttribute(positions, 3)).setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2)).setIndex(indices);
}

function createMainMaterial(): THREE.ShaderMaterial {
  return shader(`
    uniform float uTime; uniform float uOpacity; uniform vec3 uColor; varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float noise(vec2 p) { vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y); }
    void main() { float n=noise(vec2(vUv.x*8.+uTime*2.,vUv.y*24.-uTime*10.)); float edge=pow(1.-abs(vUv.x*2.-1.),1.8); float a=min(1.,edge*smoothstep(.08,1.,vUv.y)*(.42+n*.82)*uOpacity*1.2); if(a<.01) discard; gl_FragColor=vec4(uColor*mix(3.5,10.,n)*(.75+edge*.55),a); }
  `, THREE.NormalBlending);
}

function createTendrilMaterial(seed: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uSeed: { value: seed }, uColor: { value: new THREE.Color() } },
    vertexShader: `uniform float uTime,uSeed; varying vec2 vUv; void main(){vUv=uv;vec3 p=position;p.x+=sin(p.y*19.+uTime*24.+uSeed*20.)*(.025+p.y*.07);p.z+=cos(p.y*13.-uTime*18.+uSeed*27.)*.09;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,
    fragmentShader: `uniform float uOpacity;uniform vec3 uColor; varying vec2 vUv; void main(){float a=min(1.,(1.-abs(vUv.x*2.-1.))*vUv.y*uOpacity*.85);if(a<.01)discard;gl_FragColor=vec4(uColor*(3.0+vUv.y*2.0),a);}`,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.NormalBlending, toneMapped: false,
  });
}

function createGroundMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color() }, uSceneDepth: { value: null },
      uResolution: { value: new THREE.Vector2(1, 1) }, uCameraNear: { value: 0.1 },
      uCameraFar: { value: 100 }, uUseDepthFade: { value: 0 },
    },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `
      uniform float uTime,uOpacity,uCameraNear,uCameraFar,uUseDepthFade; uniform vec3 uColor; uniform sampler2D uSceneDepth; uniform vec2 uResolution; varying vec2 vUv;
      float hash(vec2 p){return fract(sin(dot(p,vec2(41.3,289.1)))*43758.5453);}
      float viewZ(float depth){return (uCameraNear*uCameraFar)/((uCameraFar-uCameraNear)*depth-uCameraFar);}
      void main(){float broken=hash(floor(vec2(vUv.x*11.+uTime*3.,vUv.y*38.-uTime*6.)));float edge=smoothstep(0.,.24,vUv.x)*smoothstep(1.,.76,vUv.x);float a=min(1.,edge*(.38+broken*.62)*uOpacity*smoothstep(.2,1.,vUv.y)*2.1);if(uUseDepthFade>.5){float sceneZ=viewZ(texture2D(uSceneDepth,gl_FragCoord.xy/uResolution).x);float surfaceFade=smoothstep(.008,.08,abs(sceneZ-viewZ(gl_FragCoord.z)));a*=surfaceFade;}if(a<.008)discard;gl_FragColor=vec4(uColor*1.8,a);}
    `,
    transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending: THREE.NormalBlending, toneMapped: false,
  });
}

function shader(fragmentShader: string, blending: THREE.Blending): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 }, uOpacity: { value: 0 }, uColor: { value: new THREE.Color() } }, vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`, fragmentShader, transparent: true, depthWrite: false, depthTest: false, side: THREE.DoubleSide, blending, toneMapped: false });
}

function attribute(length: number, itemSize: number, fill?: number): THREE.InstancedBufferAttribute {
  const values = new Float32Array(length); if (fill !== undefined) values.fill(fill);
  const result = new THREE.InstancedBufferAttribute(values, itemSize); result.setUsage(THREE.DynamicDrawUsage); return result;
}

function createParticleMaterial(spark: boolean): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uColor: { value: new THREE.Color() } },
    vertexShader: `uniform float uTime;attribute vec3 instanceOrigin,instanceVelocity;attribute float instanceBirth,instanceLifetime,instanceSize,instanceSeed;varying float vLife,vSeed;vec3 curl(vec3 p){return vec3(sin(p.y*4.3+p.z*2.1),sin(p.z*3.7+p.x*4.9),sin(p.x*2.9+p.y*5.1))*.22;}void main(){float age=uTime-instanceBirth;vLife=age/max(instanceLifetime,.001);vSeed=instanceSeed;vec3 center=instanceOrigin+instanceVelocity*max(age,0.);center+=curl(center+instanceSeed*7.+age*1.9)*age;float s=instanceSize*2.4*mix(1.,${spark ? ".08" : "1.7"},clamp(vLife,0.,1.));gl_Position=projectionMatrix*viewMatrix*vec4(center+position*s,1.);}`,
    fragmentShader: `uniform vec3 uColor;varying float vLife,vSeed;void main(){if(vLife<0.||vLife>=1.)discard;float fade=pow(1.-vLife,${spark ? "1.8" : "1.15"});vec3 color=uColor*${spark ? "mix(4.,10.,vSeed)" : "mix(.8,1.8,vSeed)"};gl_FragColor=vec4(color,min(1.,fade*${spark ? ".6" : ".5"}));}`,
    transparent: true, depthWrite: false, depthTest: false, blending: THREE.NormalBlending, toneMapped: false,
  });
}


function random(seed: number): number { return THREE.MathUtils.seededRandom(Math.floor(seed * 997)); }
function smoothstep(value: number, edge0: number, edge1: number): number { const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1); return t * t * (3 - 2 * t); }
