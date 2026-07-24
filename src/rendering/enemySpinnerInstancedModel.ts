import * as THREE from "three";
import {
  createInstancedAnimeFillMaterial,
  isSpinnerPaintName,
  prepareSpinnerModel,
  resolveSpinnerPaintSlot,
} from "./animeSpinnerMaterial";
import type { SpinnerModelAsset, SpinnerModelAssetKey } from "./spinnerModelLoader";

export type InstancedEnemySpinner = {
  spinGroup: THREE.Group;
  modelColor: string;
  modelColors?: [string, string, string];
  modelTint: string | null;
  renderVisible: boolean;
  modelAssetKey?: SpinnerModelAssetKey;
};

type InstancedFill = {
  mesh: THREE.InstancedMesh;
  material: THREE.MeshBasicMaterial;
  paintable: boolean;
  colorSlot: 0 | 1 | 2;
};

type ModelBatch = {
  fills: InstancedFill[];
  colorKeys: string[];
  freezeCoverages: Float32Array;
  freezeAttributes: THREE.InstancedBufferAttribute[];
};

export class EnemySpinnerInstancedModel {
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly freezeTargets = new WeakMap<InstancedEnemySpinner, boolean>();
  private readonly freezeMask: THREE.Texture;
  private readonly freezeDissolve: THREE.Texture;
  private readonly batches = new Map<SpinnerModelAssetKey, ModelBatch>();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly capacity: number,
  ) {
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
    this.disposeBatch(asset.key);
    const batch: ModelBatch = {
      fills: [],
      colorKeys: Array(this.capacity).fill(""),
      freezeCoverages: new Float32Array(this.capacity),
      freezeAttributes: [],
    };
    const targetDiameter = radius * 1.65;
    const prepared = prepareSpinnerModel(source, asset.rotationX, targetDiameter);
    prepared.root.updateMatrixWorld(true);

    prepared.root.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const geometry = child.geometry.clone();
      geometry.applyMatrix4(child.matrixWorld);
      if (!geometry.getAttribute("normal")) geometry.computeVertexNormals();
      const freezeAttribute = new THREE.InstancedBufferAttribute(batch.freezeCoverages, 1);
      freezeAttribute.setUsage(THREE.DynamicDrawUsage);
      geometry.setAttribute("instanceFreeze", freezeAttribute);
      batch.freezeAttributes.push(freezeAttribute);

      const sourceMaterials = Array.isArray(child.material) ? child.material : [child.material];
      const paintable = !prepared.hasPaintMarkers
        || isSpinnerPaintName(child.name)
        || sourceMaterials.some((material) => isSpinnerPaintName(material.name));
      const colorSlot = resolveSpinnerPaintSlot(sourceMaterials[0].name)
        ?? resolveSpinnerPaintSlot(child.name)
        ?? 0;
      const material = createInstancedAnimeFillMaterial(sourceMaterials[0], paintable, {
        freezeMask: this.freezeMask,
        freezeDissolve: this.freezeDissolve,
      });
      const mesh = new THREE.InstancedMesh(geometry, material, this.capacity);
      mesh.name = `Enemy Spinner ${asset.key} Instanced ${batch.fills.length + 1}`;
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
      batch.fills.push({ mesh, material, paintable, colorSlot });
      this.scene.add(mesh);
    });
    this.batches.set(asset.key, batch);
    prepared.root.traverse((object) => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }

  setFrozen(spinner: InstancedEnemySpinner, frozen: boolean): void {
    this.freezeTargets.set(spinner, frozen);
  }

  getOutlineTargets(): readonly THREE.Object3D[] {
    return [...this.batches.values()].flatMap((batch) => batch.fills.map((fill) => fill.mesh));
  }

  sync(spinners: InstancedEnemySpinner[], deltaTime = 0): void {
    for (const [assetKey, batch] of this.batches) {
      const matching = spinners.filter((spinner) => (spinner.modelAssetKey ?? "spinner2") === assetKey);
      const count = Math.min(matching.length, this.capacity);
      let colorNeedsUpdate = false;
      for (let index = 0; index < count; index += 1) {
        const spinner = matching[index];
        if (spinner.renderVisible) {
          spinner.spinGroup.updateWorldMatrix(true, false);
          this.matrix.copy(spinner.spinGroup.matrixWorld);
        } else {
          this.matrix.copy(this.hiddenMatrix);
        }
        const colors = spinner.modelTint
          ? [spinner.modelTint, spinner.modelTint, spinner.modelTint]
          : spinner.modelColors ?? [spinner.modelColor, spinner.modelColor, spinner.modelColor];
        const colorKey = colors.join("|");
        const freezeTarget = this.freezeTargets.get(spinner) === true ? 1 : 0;
        if (freezeTarget === 1) {
          batch.freezeCoverages[index] = 1;
        } else {
          const thawStep = deltaTime / 0.75;
          batch.freezeCoverages[index] = Math.max(0, batch.freezeCoverages[index] - thawStep);
        }

        for (const { mesh } of batch.fills) mesh.setMatrixAt(index, this.matrix);

        if (batch.colorKeys[index] !== colorKey) {
          batch.colorKeys[index] = colorKey;
          for (const fill of batch.fills) {
            if (fill.paintable) fill.mesh.setColorAt(index, this.color.set(colors[fill.colorSlot]));
          }
          colorNeedsUpdate = true;
        }
      }

      for (let index = count; index < this.capacity; index += 1) {
        for (const { mesh } of batch.fills) mesh.setMatrixAt(index, this.hiddenMatrix);
        batch.colorKeys[index] = "";
        batch.freezeCoverages[index] = 0;
      }

      for (const fill of batch.fills) {
        fill.mesh.count = count;
        fill.mesh.instanceMatrix.needsUpdate = true;
        if (colorNeedsUpdate && fill.mesh.instanceColor) fill.mesh.instanceColor.needsUpdate = true;
      }
      for (const attribute of batch.freezeAttributes) attribute.needsUpdate = true;
    }
  }

  dispose(): void {
    this.disposeMeshes();
    this.freezeMask.dispose();
    this.freezeDissolve.dispose();
  }

  private disposeMeshes(): void {
    for (const key of [...this.batches.keys()]) this.disposeBatch(key);
  }

  private disposeBatch(key: SpinnerModelAssetKey): void {
    const batch = this.batches.get(key);
    if (!batch) return;
    for (const fill of batch.fills) {
      this.scene.remove(fill.mesh);
      fill.mesh.geometry.dispose();
      fill.material.dispose();
    }
    this.batches.delete(key);
  }
}
