import * as THREE from "three";
import type { CombatDamageEvent, CombatSpinnerState } from "../simulation/combat";
import { ExplosionVfxPool } from "./explosionVfx";
import { FreezeShardVfxPool } from "./freezeVfx";
import { HitTargetVfxPool } from "./hitTargetVfx";
import { RockRippleVfxPool } from "./rockRippleVfx";

export class ElementalSkillVfx {
  private readonly normalHit = new HitTargetVfxPool();
  private readonly criticalHit = new HitTargetVfxPool({
    poolSize: 8,
    color: "#ff2020",
    hotColor: "#ffffff",
    intensity: 1.15,
  });
  private readonly explosion = new ExplosionVfxPool();
  private readonly rockRipple = new RockRippleVfxPool();
  private readonly freezeShards = new FreezeShardVfxPool();
  private readonly spawnPosition = new THREE.Vector3();

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getSurfaceHeight: (position: THREE.Vector3) => number,
  ) {
    scene.add(
      this.normalHit.group,
      this.criticalHit.group,
      this.explosion.group,
      this.rockRipple.group,
      this.freezeShards.group,
    );
  }

  spawnHit(event: CombatDamageEvent<CombatSpinnerState>, reducedMotion = false): void {
    const pool = event.critical ? this.criticalHit : this.normalHit;
    this.spawnPosition.copy(event.target.group.position);
    this.spawnPosition.y = Math.max(
      event.target.group.position.y + event.target.radius,
      this.getSurfaceHeight(this.spawnPosition) + 2.05,
    );
    pool.spawn(this.spawnPosition, event.direction, reducedMotion);
  }

  spawnExplosion(position: THREE.Vector3): void {
    this.spawnPosition.copy(position);
    this.spawnPosition.y = this.getSurfaceHeight(this.spawnPosition) + 0.02;
    this.explosion.spawn(this.spawnPosition);
  }

  spawnRockRipple(position: THREE.Vector3): void {
    this.spawnPosition.copy(position);
    this.spawnPosition.y = this.getSurfaceHeight(this.spawnPosition);
    this.rockRipple.spawn(this.spawnPosition);
  }

  spawnThawShards(position: THREE.Vector3, radius: number, reducedMotion = false): void {
    this.spawnPosition.copy(position);
    this.spawnPosition.y = Math.max(position.y + radius, this.getSurfaceHeight(this.spawnPosition) + radius);
    this.freezeShards.spawn(this.spawnPosition, radius, reducedMotion);
  }

  update(deltaTime: number, elapsedTime: number, camera: THREE.Camera): void {
    this.normalHit.update(deltaTime);
    this.criticalHit.update(deltaTime);
    this.explosion.update(deltaTime, elapsedTime, camera);
    this.rockRipple.update(deltaTime, elapsedTime);
    this.freezeShards.update(deltaTime);
  }

  dispose(): void {
    this.scene.remove(
      this.normalHit.group,
      this.criticalHit.group,
      this.explosion.group,
      this.rockRipple.group,
      this.freezeShards.group,
    );
    this.normalHit.dispose();
    this.criticalHit.dispose();
    this.explosion.dispose();
    this.rockRipple.dispose();
    this.freezeShards.dispose();
  }
}
