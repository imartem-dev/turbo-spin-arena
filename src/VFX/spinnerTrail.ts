import * as THREE from "three";

export const maxSpinnerTrailPoints = 28;
const maxRibbonPoints = (maxSpinnerTrailPoints + 1) * 2;
const maxVertices = maxRibbonPoints * 2;
const maxIndices = (maxRibbonPoints - 1) * 6;
type SpinnerTrailVisualOptions = {
  baseWidth?: number;
  tailWidth?: number;
  outlineExtraWidth?: number;
};

const rawPoints = Array.from({ length: maxSpinnerTrailPoints + 1 }, () => new THREE.Vector3());
const smoothedPoints = Array.from({ length: maxRibbonPoints }, () => new THREE.Vector3());

function createRibbonGeometry(): { geometry: THREE.BufferGeometry; positions: Float32Array } {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(maxVertices * 3);
  const indices = new Uint16Array(maxIndices);
  for (let index = 0; index < maxRibbonPoints - 1; index += 1) {
    const vertex = index * 2;
    const offset = index * 6;
    indices[offset] = vertex;
    indices[offset + 1] = vertex + 2;
    indices[offset + 2] = vertex + 1;
    indices[offset + 3] = vertex + 1;
    indices[offset + 4] = vertex + 2;
    indices[offset + 5] = vertex + 3;
  }
  const positionAttribute = new THREE.BufferAttribute(positions, 3);
  positionAttribute.setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute("position", positionAttribute);
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setDrawRange(0, 0);
  return { geometry, positions };
}

export class SpinnerTrailVisual {
  readonly group = new THREE.Group();
  private readonly fillGeometry: THREE.BufferGeometry;
  private readonly outlineGeometry: THREE.BufferGeometry;
  private readonly fillPositions: Float32Array;
  private readonly outlinePositions: Float32Array;
  private readonly fillMaterial: THREE.MeshBasicMaterial;
  private readonly outlineMaterial: THREE.MeshBasicMaterial;
  private readonly baseWidth: number;
  private readonly tailWidth: number;
  private readonly outlineExtraWidth: number;

  constructor(color: string, options: SpinnerTrailVisualOptions = {}) {
    const fill = createRibbonGeometry();
    const outline = createRibbonGeometry();
    this.fillGeometry = fill.geometry;
    this.outlineGeometry = outline.geometry;
    this.fillPositions = fill.positions;
    this.outlinePositions = outline.positions;
    this.baseWidth = options.baseWidth ?? 0.34;
    this.tailWidth = options.tailWidth ?? 0.02;
    this.outlineExtraWidth = options.outlineExtraWidth ?? 0.035;
    this.fillMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: false,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    this.outlineMaterial = new THREE.MeshBasicMaterial({
      color: 0x050505,
      transparent: false,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
    });
    const outlineMesh = new THREE.Mesh(this.outlineGeometry, this.outlineMaterial);
    const fillMesh = new THREE.Mesh(this.fillGeometry, this.fillMaterial);
    outlineMesh.renderOrder = 1;
    fillMesh.renderOrder = 2;
    outlineMesh.frustumCulled = false;
    fillMesh.frustumCulled = false;
    outlineMesh.position.y = -0.002;
    this.group.add(outlineMesh, fillMesh);
  }

  setColor(color: string): void {
    this.fillMaterial.color.set(color);
  }

  update(
    currentPoint: THREE.Vector3,
    trailPoints: readonly THREE.Vector3[],
    visibleStrength: number,
    reducedMotion: boolean,
  ): void {
    let rawCount = 1;
    rawPoints[0].copy(currentPoint);
    for (const point of trailPoints) {
      if (rawCount >= rawPoints.length || point.distanceTo(rawPoints[rawCount - 1]) <= 0.025) continue;
      rawPoints[rawCount].copy(point);
      rawCount += 1;
    }
    if (rawCount < 3 || visibleStrength < 0.02) {
      this.clear();
      return;
    }

    let ribbonCount = 0;
    if (rawCount < 4) {
      for (let index = 0; index < rawCount; index += 1) smoothedPoints[ribbonCount++].copy(rawPoints[index]);
    } else {
      smoothedPoints[ribbonCount++].copy(rawPoints[0]);
      for (let index = 0; index < rawCount - 1; index += 1) {
        smoothedPoints[ribbonCount++].lerpVectors(rawPoints[index], rawPoints[index + 1], 0.35);
        smoothedPoints[ribbonCount++].lerpVectors(rawPoints[index], rawPoints[index + 1], 0.7);
      }
      smoothedPoints[ribbonCount++].copy(rawPoints[rawCount - 1]);
    }

    const baseWidth = (reducedMotion ? this.baseWidth * 0.55 : this.baseWidth) * THREE.MathUtils.clamp(visibleStrength, 0, 1);
    const tailWidth = (reducedMotion ? this.tailWidth * 0.7 : this.tailWidth) * THREE.MathUtils.clamp(visibleStrength, 0, 1);
    let positionOffset = 0;
    for (let index = 0; index < ribbonCount; index += 1) {
      const previous = smoothedPoints[Math.max(index - 1, 0)];
      const next = smoothedPoints[Math.min(index + 1, ribbonCount - 1)];
      let tangentX = previous.x - next.x;
      let tangentZ = previous.z - next.z;
      const tangentLength = Math.hypot(tangentX, tangentZ);
      if (tangentLength < 0.0001) {
        tangentX = 1;
        tangentZ = 0;
      } else {
        tangentX /= tangentLength;
        tangentZ /= tangentLength;
      }
      const ratio = ribbonCount === 1 ? 0 : index / (ribbonCount - 1);
      const fillWidth = THREE.MathUtils.lerp(baseWidth, tailWidth, ratio);
      this.writePair(this.fillPositions, positionOffset, smoothedPoints[index], tangentX, tangentZ, fillWidth);
      this.writePair(this.outlinePositions, positionOffset, smoothedPoints[index], tangentX, tangentZ, fillWidth + this.outlineExtraWidth);
      positionOffset += 6;
    }
    const drawCount = Math.max(ribbonCount - 1, 0) * 6;
    this.fillGeometry.getAttribute("position").needsUpdate = true;
    this.outlineGeometry.getAttribute("position").needsUpdate = true;
    this.fillGeometry.setDrawRange(0, drawCount);
    this.outlineGeometry.setDrawRange(0, drawCount);
  }

  clear(): void {
    this.fillGeometry.setDrawRange(0, 0);
    this.outlineGeometry.setDrawRange(0, 0);
  }

  dispose(): void {
    this.fillGeometry.dispose();
    this.outlineGeometry.dispose();
    this.fillMaterial.dispose();
    this.outlineMaterial.dispose();
  }

  private writePair(
    positions: Float32Array,
    offset: number,
    point: THREE.Vector3,
    tangentX: number,
    tangentZ: number,
    width: number,
  ): void {
    const normalX = -tangentZ * width;
    const normalZ = tangentX * width;
    positions[offset] = point.x + normalX;
    positions[offset + 1] = point.y;
    positions[offset + 2] = point.z + normalZ;
    positions[offset + 3] = point.x - normalX;
    positions[offset + 4] = point.y;
    positions[offset + 5] = point.z - normalZ;
  }
}
