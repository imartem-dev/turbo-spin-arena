import * as THREE from "three";
import type { CombatDamageEvent, CombatSpinnerState } from "../simulation/combat";
import { ExplosionVfxPool } from "./explosionVfx";
import { FreezeShardVfxPool } from "./freezeVfx";
import { HitVfxPool } from "./hitVfx";
import { RockRippleVfxPool } from "./rockRippleVfx";

const normalHitColor = "#fced65";
const criticalHitColor = "#ff2020";
const hitRingColor = "#ffffff";

export class ElementalSkillVfx {
  private readonly hit = new HitVfxPool({ poolSize: 24 });
  private readonly explosion = new ExplosionVfxPool();
  private readonly rockRipple = new RockRippleVfxPool();
  private readonly freezeShards = new FreezeShardVfxPool();
  private readonly spawnPosition = new THREE.Vector3();
  private hitReady = false;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getSurfaceHeight: (position: THREE.Vector3) => number,
  ) {
    scene.add(
      this.hit.group,
      this.explosion.group,
      this.rockRipple.group,
      this.freezeShards.group,
    );
    void this.hit.ready
      .then(() => {
        this.hitReady = true;
      })
      .catch((error) => {
        console.warn("HitVfxPool failed to load textures", error);
      });
  }

  spawnHit(event: CombatDamageEvent<CombatSpinnerState>, reducedMotion = false): void {
    if (!this.hitReady) {
      return;
    }

    this.spawnPosition.copy(event.target.group.position);
    this.spawnPosition.y = Math.max(
      event.target.group.position.y + event.target.radius,
      this.getSurfaceHeight(this.spawnPosition) + 2.05,
    );
    this.hit.spawn(this.spawnPosition, event.direction, {
      edgeColor: event.critical ? criticalHitColor : normalHitColor,
      ringColor: hitRingColor,
      reducedMotion,
    });
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
    this.hit.update(deltaTime, camera);
    this.explosion.update(deltaTime, elapsedTime, camera);
    this.rockRipple.update(deltaTime, elapsedTime);
    this.freezeShards.update(deltaTime);
  }

  reset(camera: THREE.Camera): void {
    const expirationDelta = 100;
    this.hit.update(expirationDelta, camera);
    this.explosion.update(expirationDelta, 0, camera);
    this.rockRipple.update(expirationDelta, 0);
    this.freezeShards.update(expirationDelta);
  }

  dispose(): void {
    this.scene.remove(
      this.hit.group,
      this.explosion.group,
      this.rockRipple.group,
      this.freezeShards.group,
    );
    this.hit.dispose();
    this.explosion.dispose();
    this.rockRipple.dispose();
    this.freezeShards.dispose();
  }
}
