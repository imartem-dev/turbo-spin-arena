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
  private readonly matrix = new THREE.Matrix4();
  private readonly color = new THREE.Color();
  private readonly hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);
  private readonly colorKeys: string[] = [];
  private meshes: THREE.InstancedMesh[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly capacity: number,
  ) {}

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
    });

    this.colorKeys.length = this.capacity;
    this.colorKeys.fill("");
  }

  sync(spinners: InstancedEnemySpinner[]): void {
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

      for (const mesh of this.meshes) {
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
  }

  dispose(): void {
    this.disposeMeshes();
    this.material.dispose();
  }

  private disposeMeshes(): void {
    for (const mesh of this.meshes) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes = [];
    this.colorKeys.length = 0;
  }
}
