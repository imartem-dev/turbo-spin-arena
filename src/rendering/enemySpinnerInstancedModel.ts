import * as THREE from "three";
import {
  createInstancedAnimeFillMaterial,
  isSpinnerPaintName,
  prepareSpinnerModel,
} from "./animeSpinnerMaterial";
import type { SpinnerModelAsset } from "./spinnerModelLoader";

export type InstancedEnemySpinner = {
  spinGroup: THREE.Group;
  modelColor: string;
  modelTint: string | null;
};

type InstancedFill = {
  mesh: THREE.InstancedMesh;
  material: THREE.MeshBasicMaterial;
  paintable: boolean;
};

export class EnemySpinnerInstancedModel {
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly colorKeys: string[] = [];
  private readonly freezeTargets = new WeakMap<InstancedEnemySpinner, boolean>();
  private readonly freezeCoverages: Float32Array;
  private readonly freezeAttributes: THREE.InstancedBufferAttribute[] = [];
  private readonly freezeMask: THREE.Texture;
  private readonly freezeDissolve: THREE.Texture;
  private fills: InstancedFill[] = [];

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
  }

  setModelSource(source: THREE.Group, asset: SpinnerModelAsset, radius: number): void {
    this.disposeMeshes();
    const targetDiameter = radius * 1.65;
    const prepared = prepareSpinnerModel(source, asset.rotationX, targetDiameter);
    prepared.root.updateMatrixWorld(true);

    prepared.root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      const freezeAttribute = new THREE.InstancedBufferAttribute(this.freezeCoverages, 1);
      freezeAttribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("instanceFreeze", freezeAttribute);
      this.freezeAttributes.push(freezeAttribute);

      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const paintable = !prepared.hasPaintMarkers
        || isSpinnerPaintName(child.name)
        || sourceMaterials.some((material) => isSpinnerPaintName(material.name));
      const material = createInstancedAnimeFillMaterial(sourceMaterials[0], paintable, {
        freezeMask: this.freezeMask,
        freezeDissolve: this.freezeDissolve,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
      mesh.name = `Enemy Spinner Instanced ${this.fills.length + 1}`;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.renderOrder = 1;
      mesh.count = 0;
      for (let index = 0; index < this.capacity; index += 1) {
        mesh.setMatrixAt(index, this.hiddenMatrix);
        if (paintable) mesh.setColorAt(index, this.color.set("#ffffff"));
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      this.fills.push({ mesh, material, paintable });
      this.scene.add(mesh);
    });

    this.colorKeys.length = this.capacity;
    this.colorKeys.fill("");
    prepared.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }

  setFrozen(spinner: InstancedEnemySpinner, frozen: boolean): void {
    this.freezeTargets.set(spinner, frozen);
  }

  getOutlineTargets(): readonly THREE.Object3D[] {
    return this.fills.map((fill) => fill.mesh);
  }

  sync(spinners: InstancedEnemySpinner[], deltaTime = 0): void {
    if (this.fills.length === 0) return;

    const count = Math.min(spinners.length, this.capacity);
    let colorNeedsUpdate = false;
    for (let index = 0; index < count; index += 1) {
      const spinner = spinners[index];
      spinner.spinGroup.updateWorldMatrix(true, false);
      this.matrix.copy(spinner.spinGroup.matrixWorld);
      const colorKey = spinner.modelTint ?? spinner.modelColor;
      const freezeTarget = this.freezeTargets.get(spinner) === true ? 1 : 0;
      const freezeDuration = freezeTarget > this.freezeCoverages[index] ? 0.45 : 0.75;
      const freezeStep = freezeDuration > 0 ? deltaTime / freezeDuration : 1;
      this.freezeCoverages[index] = THREE.MathUtils.clamp(
        this.freezeCoverages[index] + Math.sign(freezeTarget - this.freezeCoverages[index]) * freezeStep,
        0,
        1,
      );

      for (const { mesh } of this.fills) mesh.setMatrixAt(index, this.matrix);

      if (this.colorKeys[index] !== colorKey) {
        this.colorKeys[index] = colorKey;
        this.color.set(colorKey);
        for (const fill of this.fills) {
          if (fill.paintable) fill.mesh.setColorAt(index, this.color);
        }
        colorNeedsUpdate = true;
      }
    }

    for (let index = count; index < this.capacity; index += 1) {
      for (const { mesh } of this.fills) mesh.setMatrixAt(index, this.hiddenMatrix);
      this.colorKeys[index] = "";
      this.freezeCoverages[index] = 0;
    }

    for (const fill of this.fills) {
      fill.mesh.count = count;
      fill.mesh.instanceMatrix.needsUpdate = true;
      if (colorNeedsUpdate && fill.mesh.instanceColor) fill.mesh.instanceColor.needsUpdate = true;
    }
    for (const attribute of this.freezeAttributes) attribute.needsUpdate = true;
  }

  dispose(): void {
    this.disposeMeshes();
    this.freezeMask.dispose();
    this.freezeDissolve.dispose();
  }

  private disposeMeshes(): void {
    for (const fill of this.fills) {
      this.scene.remove(fill.mesh);
      fill.mesh.geometry.dispose();
      fill.material.dispose();
    }
    this.fills = [];
    this.freezeAttributes.length = 0;
    this.colorKeys.length = 0;
    this.freezeCoverages.fill(0);
  }
}
