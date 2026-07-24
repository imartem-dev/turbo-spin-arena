import * as THREE from "three";

const spinnerNormalCreaseAngle = THREE.MathUtils.degToRad(20);
const spinnerNormalCreaseDot = Math.cos(spinnerNormalCreaseAngle);
const positionHashScale = 100_000;

type NormalContributionMap = Map<string, number[]>;

export function applySpinnerShadingNormals(geometry: THREE.BufferGeometry): void {
  const position = geometry.getAttribute("position");
  if (!(position instanceof THREE.BufferAttribute) || position.itemSize < 3 || position.count === 0) return;
  if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
  const sourceNormal = geometry.getAttribute("normal");
  if (!(sourceNormal instanceof THREE.BufferAttribute) || sourceNormal.itemSize < 3) return;

  const contributions: NormalContributionMap = new Map();
  const index = geometry.getIndex();
  const triangleVertexCount = index ? index.count : position.count;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  const edge1 = new THREE.Vector3();
  const edge2 = new THREE.Vector3();
  const cornerCross = new THREE.Vector3();
  const faceNormal = new THREE.Vector3();

  for (let offset = 0; offset + 2 < triangleVertexCount; offset += 3) {
    const indexA = index ? index.getX(offset) : offset;
    const indexB = index ? index.getX(offset + 1) : offset + 1;
    const indexC = index ? index.getX(offset + 2) : offset + 2;
    a.fromBufferAttribute(position, indexA);
    b.fromBufferAttribute(position, indexB);
    c.fromBufferAttribute(position, indexC);
    edge1.subVectors(b, a);
    edge2.subVectors(c, a);
    faceNormal.crossVectors(edge1, edge2);
    if (faceNormal.lengthSq() <= Number.EPSILON) continue;
    faceNormal.normalize();

    addCornerContribution(contributions, a, b, c, faceNormal, edge1, edge2, cornerCross);
    addCornerContribution(contributions, b, c, a, faceNormal, edge1, edge2, cornerCross);
    addCornerContribution(contributions, c, a, b, faceNormal, edge1, edge2, cornerCross);
  }

  const normalArray = new Float32Array(position.count * 3);
  const referenceNormal = new THREE.Vector3();
  const smoothedNormal = new THREE.Vector3();

  for (let vertexIndex = 0; vertexIndex < position.count; vertexIndex += 1) {
    referenceNormal.fromBufferAttribute(sourceNormal, vertexIndex);
    if (referenceNormal.lengthSq() > Number.EPSILON) referenceNormal.normalize();
    const key = hashPositionComponents(
      position.getX(vertexIndex),
      position.getY(vertexIndex),
      position.getZ(vertexIndex),
    );
    const candidates = contributions.get(key);
    smoothedNormal.set(0, 0, 0);

    if (candidates && referenceNormal.lengthSq() > Number.EPSILON) {
      for (let offset = 0; offset < candidates.length; offset += 4) {
        const normalX = candidates[offset];
        const normalY = candidates[offset + 1];
        const normalZ = candidates[offset + 2];
        const weight = candidates[offset + 3];
        const alignment = referenceNormal.x * normalX + referenceNormal.y * normalY + referenceNormal.z * normalZ;
        if (alignment >= spinnerNormalCreaseDot) {
          smoothedNormal.x += normalX * weight;
          smoothedNormal.y += normalY * weight;
          smoothedNormal.z += normalZ * weight;
        }
      }
    }

    if (smoothedNormal.lengthSq() <= Number.EPSILON) smoothedNormal.copy(referenceNormal);
    else smoothedNormal.normalize();
    const normalOffset = vertexIndex * 3;
    normalArray[normalOffset] = smoothedNormal.x;
    normalArray[normalOffset + 1] = smoothedNormal.y;
    normalArray[normalOffset + 2] = smoothedNormal.z;
  }

  geometry.setAttribute("normal", new THREE.BufferAttribute(normalArray, 3));
}

function addCornerContribution(
  contributions: NormalContributionMap,
  corner: THREE.Vector3,
  adjacentA: THREE.Vector3,
  adjacentB: THREE.Vector3,
  faceNormal: THREE.Vector3,
  edge1: THREE.Vector3,
  edge2: THREE.Vector3,
  cornerCross: THREE.Vector3,
): void {
  edge1.subVectors(adjacentA, corner);
  edge2.subVectors(adjacentB, corner);
  const weight = Math.atan2(cornerCross.crossVectors(edge1, edge2).length(), edge1.dot(edge2));
  if (!Number.isFinite(weight) || weight <= Number.EPSILON) return;
  const key = hashPositionComponents(corner.x, corner.y, corner.z);
  const values = contributions.get(key) ?? [];
  values.push(faceNormal.x, faceNormal.y, faceNormal.z, weight);
  contributions.set(key, values);
}

function hashPositionComponents(x: number, y: number, z: number): string {
  return `${Math.round(x * positionHashScale)},${Math.round(y * positionHashScale)},${Math.round(z * positionHashScale)}`;
}
