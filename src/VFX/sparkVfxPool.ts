import * as THREE from "three";

type SparkKind = "shard" | "round";

type SparkState = {
  active: boolean;
  kind: SparkKind;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  rotation: THREE.Euler;
  spin: number;
  baseScale: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
  life: number;
  maxLife: number;
};

const sparkCapacity = 160;
const hiddenMatrix = new THREE.Matrix4().makeScale(0, 0, 0);

export class SparkVfxPool {
  private readonly shardGeometry = new THREE.BoxGeometry(0.12, 0.04, 0.12);
  private readonly roundGeometry = new THREE.BoxGeometry(0.035, 0.035, 0.24);
  private readonly shardMaterial = createSparkMaterial("#ff5a8a");
  private readonly roundMaterial = createSparkMaterial("#fff2a8");
  private readonly shardMesh = new THREE.InstancedMesh(this.shardGeometry, this.shardMaterial, sparkCapacity);
  private readonly roundMesh = new THREE.InstancedMesh(this.roundGeometry, this.roundMaterial, sparkCapacity);
  private readonly states: SparkState[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly quaternion = new THREE.Quaternion();
  private readonly scale = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly reducedMotionQuery: MediaQueryList,
  ) {
    this.shardMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.roundMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.shardMesh.frustumCulled = false;
    this.roundMesh.frustumCulled = false;
    this.shardMesh.renderOrder = 30;
    this.roundMesh.renderOrder = 30;

    for (let i = 0; i < sparkCapacity; i += 1) {
      this.states.push({
        active: false,
        kind: "round",
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        rotation: new THREE.Euler(),
        spin: 0,
        baseScale: 1,
        scaleX: 1,
        scaleY: 1,
        scaleZ: 1,
        life: 0,
        maxLife: 1,
      });
      this.shardMesh.setMatrixAt(i, hiddenMatrix);
      this.roundMesh.setMatrixAt(i, hiddenMatrix);
    }

    this.shardMesh.count = 0;
    this.roundMesh.count = 0;
    this.scene.add(this.shardMesh, this.roundMesh);
  }

  spawnImpact(
    origin: THREE.Vector3,
    normal: THREE.Vector3,
    critical: boolean,
    playerColor: string,
    enemyColor: string,
  ): void {
    void playerColor;
    void enemyColor;
    const count = critical ? (this.reducedMotionQuery.matches ? 14 : 34) : this.reducedMotionQuery.matches ? 8 : 20;
    for (let i = 0; i < count; i += 1) {
      const spark = this.acquireSpark();
      const side = i % 2 === 0 ? 1 : -1;
      const tangent = new THREE.Vector3(-normal.z, 0, normal.x).multiplyScalar((Math.random() - 0.5) * 3.2);
      const velocity = normal
        .clone()
        .multiplyScalar(side * (1.8 + Math.random() * 2.7))
        .add(tangent)
        .add(new THREE.Vector3(0, 0.8 + Math.random() * 1.8, 0));
      const isShard = i % 3 === 0;

      spark.active = true;
      spark.kind = isShard ? "shard" : "round";
      spark.position.copy(origin);
      spark.position.y += 0.39 + Math.random() * 0.25;
      spark.velocity.copy(velocity);
      spark.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
      spark.spin = (Math.random() - 0.5) * 12;
      spark.baseScale = (critical ? 1.35 : 0.95) + Math.random() * 0.75;
      spark.scaleX = isShard ? 1 : 0.7;
      spark.scaleY = isShard ? 1 : 0.7;
      spark.scaleZ = isShard ? 1 : 2.8;
      spark.life = isShard ? (critical ? 0.82 : 0.62) : (critical ? 0.42 : 0.3);
      spark.maxLife = spark.life;
    }
    this.updateInstanceMeshes();
  }

  update(deltaTime: number): void {
    let changed = false;
    for (const spark of this.states) {
      if (!spark.active) {
        continue;
      }

      spark.life -= deltaTime;
      if (spark.life <= 0) {
        spark.active = false;
        changed = true;
        continue;
      }

      spark.velocity.y -= 5.4 * deltaTime;
      spark.position.addScaledVector(spark.velocity, deltaTime);
      spark.rotation.x += spark.spin * deltaTime;
      spark.rotation.z -= spark.spin * 0.7 * deltaTime;
      changed = true;
    }

    if (changed) {
      this.updateInstanceMeshes();
    }
  }

  dispose(): void {
    this.scene.remove(this.shardMesh, this.roundMesh);
    this.shardGeometry.dispose();
    this.roundGeometry.dispose();
    this.shardMaterial.dispose();
    this.roundMaterial.dispose();
  }

  private acquireSpark(): SparkState {
    const idle = this.states.find((spark) => !spark.active);
    if (idle) {
      return idle;
    }

    return this.states.reduce((oldest, spark) => (spark.life < oldest.life ? spark : oldest), this.states[0]);
  }

  private updateInstanceMeshes(): void {
    let shardIndex = 0;
    let roundIndex = 0;

    for (const spark of this.states) {
      if (!spark.active) {
        continue;
      }

      const alpha = Math.max(spark.life / spark.maxLife, 0);
      const scale = spark.baseScale * alpha;
      if (spark.kind === "round" && spark.velocity.lengthSq() > 0.0001) {
        this.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), spark.velocity.clone().normalize());
      } else {
        this.quaternion.setFromEuler(spark.rotation);
      }
      this.scale.set(scale * spark.scaleX, scale * spark.scaleY, scale * spark.scaleZ);
      this.matrix.compose(spark.position, this.quaternion, this.scale);

      if (spark.kind === "shard") {
        this.shardMesh.setMatrixAt(shardIndex, this.matrix);
        shardIndex += 1;
      } else {
        this.roundMesh.setMatrixAt(roundIndex, this.matrix);
        roundIndex += 1;
      }
    }

    this.shardMesh.count = shardIndex;
    this.roundMesh.count = roundIndex;
    this.shardMesh.instanceMatrix.needsUpdate = true;
    this.roundMesh.instanceMatrix.needsUpdate = true;
  }
}

function createSparkMaterial(color: string): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    depthTest: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    toneMapped: false,
  });
}
