import * as THREE from "three";

export type GroundShadowSpinner = {
  group: THREE.Group;
  radius: number;
  heightOffset: number;
  renderVisible: boolean;
};

export class SpinnerGroundShadows {
  readonly mesh: THREE.InstancedMesh;

  private readonly matrix = new THREE.Matrix4();
  private readonly basis = new THREE.Matrix4();
  private readonly scale = new THREE.Matrix4();
  private readonly normal = new THREE.Vector3();
  private readonly tangent = new THREE.Vector3();
  private readonly bitangent = new THREE.Vector3();
  private readonly position = new THREE.Vector3();
  private readonly shadowDirection = new THREE.Vector3(0.68, 0, 0.74).normalize();
  private readonly opacityAttribute: THREE.InstancedBufferAttribute;

  constructor(scene: THREE.Scene, spinnerCapacity: number) {
    const geometry = new THREE.PlaneGeometry(2, 2);
    geometry.rotateX(-Math.PI / 2);
    this.opacityAttribute = new THREE.InstancedBufferAttribute(new Float32Array(spinnerCapacity * 2), 1);
    this.opacityAttribute.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("instanceOpacity", this.opacityAttribute);

    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      vertexShader: `
        attribute float instanceOpacity;
        varying vec2 vShadowUv;
        varying float vShadowOpacity;
        void main() {
          vShadowUv = uv;
          vShadowOpacity = instanceOpacity;
          vec4 worldPosition = modelMatrix * instanceMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * viewMatrix * worldPosition;
        }
      `,
      fragmentShader: `
        varying vec2 vShadowUv;
        varying float vShadowOpacity;
        void main() {
          vec2 centered = vShadowUv * 2.0 - 1.0;
          float fade = 1.0 - smoothstep(0.18, 1.0, dot(centered, centered));
          gl_FragColor = vec4(0.19, 0.105, 0.12, fade * vShadowOpacity);
        }
      `,
    });

    this.mesh = new THREE.InstancedMesh(geometry, material, spinnerCapacity * 2);
    this.mesh.name = "Deathmatch Spinner Ground Shadows";
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
    scene.add(this.mesh);
  }

  sync(
    spinners: readonly GroundShadowSpinner[],
    getHeightAt: (x: number, z: number) => number,
    enabled: boolean,
  ): void {
    if (!enabled) {
      this.mesh.count = 0;
      return;
    }

    let instanceIndex = 0;
    for (const spinner of spinners) {
      if (!spinner.renderVisible || instanceIndex + 1 >= this.mesh.instanceMatrix.count) continue;
      const groundY = getHeightAt(spinner.group.position.x, spinner.group.position.z);
      const height = Math.max(0, spinner.group.position.y - groundY - spinner.heightOffset);
      const heightFade = THREE.MathUtils.clamp(1 - height / 3.2, 0.16, 1);
      this.writeShadow(instanceIndex, spinner.group.position.x, spinner.group.position.z, spinner.radius, 0.08, 1.12, 0.68, 0.26 * heightFade, getHeightAt);
      instanceIndex += 1;
      this.writeShadow(instanceIndex, spinner.group.position.x, spinner.group.position.z, spinner.radius, 0.74, 2.7, 0.62, 0.14 * heightFade, getHeightAt);
      instanceIndex += 1;
    }

    this.mesh.count = instanceIndex;
    this.mesh.instanceMatrix.needsUpdate = true;
    this.opacityAttribute.needsUpdate = true;
  }

  dispose(scene: THREE.Scene): void {
    scene.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }

  private writeShadow(
    index: number,
    centerX: number,
    centerZ: number,
    radius: number,
    offset: number,
    lengthScale: number,
    widthScale: number,
    opacity: number,
    getHeightAt: (x: number, z: number) => number,
  ): void {
    const x = centerX + this.shadowDirection.x * radius * offset;
    const z = centerZ + this.shadowDirection.z * radius * offset;
    this.sampleSurfaceNormal(x, z, getHeightAt, this.normal);
    this.tangent.copy(this.shadowDirection).addScaledVector(this.normal, -this.shadowDirection.dot(this.normal)).normalize();
    this.bitangent.crossVectors(this.tangent, this.normal).normalize();
    this.basis.makeBasis(this.tangent, this.normal, this.bitangent);
    this.scale.makeScale(radius * lengthScale, 1, radius * widthScale);
    this.matrix.multiplyMatrices(this.basis, this.scale);
    this.position.set(x, getHeightAt(x, z), z).addScaledVector(this.normal, 0.035);
    this.matrix.setPosition(this.position);
    this.mesh.setMatrixAt(index, this.matrix);
    this.opacityAttribute.setX(index, opacity);
  }

  private sampleSurfaceNormal(
    x: number,
    z: number,
    getHeightAt: (x: number, z: number) => number,
    target: THREE.Vector3,
  ): void {
    const step = 0.12;
    const dx = getHeightAt(x - step, z) - getHeightAt(x + step, z);
    const dz = getHeightAt(x, z - step) - getHeightAt(x, z + step);
    target.set(dx, step * 2, dz).normalize();
  }
}
