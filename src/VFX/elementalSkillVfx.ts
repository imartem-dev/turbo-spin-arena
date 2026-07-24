import * as THREE from "three";
import type { CombatDamageEvent, CombatSpinnerState } from "../simulation/combat";
import { ExplosionVfxPool } from "./explosionVfx";
import { FreezeShardVfxPool } from "./freezeVfx";
import { HitVfxPool } from "./hitVfx";
import { RockRippleVfxPool } from "./rockRippleVfx";
import { AnimeSlashX } from "./animeSlashX";

const normalHitColor = "#fced65";
const criticalHitColor = "#ff2020";
const hitRingColor = "#ffffff";
const animeSlashDuration = 0.2;
const animeSlashRepeatCount = 2;
const pendingAnimeSlashCapacity = 64;

type PendingAnimeSlash = {
  active: boolean;
  delay: number;
  position: THREE.Vector3;
  material1Color: THREE.Color;
  material2Color: THREE.Color;
};

export class ElementalSkillVfx {
  private readonly hit = new HitVfxPool({ poolSize: 24 });
  private readonly animeSlashX: AnimeSlashX[];
  private readonly explosion = new ExplosionVfxPool();
  private readonly rockRipple = new RockRippleVfxPool();
  private readonly freezeShards = new FreezeShardVfxPool();
  private readonly spawnPosition = new THREE.Vector3();
  private readonly pendingAnimeSlashes: PendingAnimeSlash[];
  private hitReady = false;
  private nextAnimeSlashX = 0;
  private nextPendingAnimeSlash = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly getSurfaceHeight: (position: THREE.Vector3) => number,
  ) {
    this.animeSlashX = Array.from({ length: 24 }, () => new AnimeSlashX(scene));
    this.pendingAnimeSlashes = Array.from({ length: pendingAnimeSlashCapacity }, () => ({
      active: false,
      delay: 0,
      position: new THREE.Vector3(),
      material1Color: new THREE.Color(),
      material2Color: new THREE.Color(),
    }));
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

  spawnHit(
    event: CombatDamageEvent<CombatSpinnerState>,
    reducedMotion = false,
    scale = 1,
    sparkCount = 16,
  ): void {
    if (!this.hitReady) {
      return;
    }

    this.spawnPosition.copy(event.position);
    this.spawnPosition.y = Math.max(
      event.position.y + event.target.radius,
      this.getSurfaceHeight(this.spawnPosition) + 2.05,
    );
    this.hit.spawn(this.spawnPosition, event.direction, {
      edgeColor: event.critical ? criticalHitColor : normalHitColor,
      ringColor: hitRingColor,
      reducedMotion,
      scale,
      sparkCount,
    });
  }

  spawnPlayerHitSlash(
    event: CombatDamageEvent<CombatSpinnerState>,
    material1Color: THREE.ColorRepresentation,
    material2Color: THREE.ColorRepresentation,
  ): void {
    this.spawnPosition.copy(event.position);
    this.triggerAnimeSlash(this.spawnPosition, material1Color, material2Color);
    for (let repeatIndex = 1; repeatIndex < animeSlashRepeatCount; repeatIndex += 1) {
      this.queueAnimeSlash(this.spawnPosition, material1Color, material2Color, animeSlashDuration * repeatIndex);
    }
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
    for (const slash of this.animeSlashX) slash.update(deltaTime, camera);
    this.updatePendingAnimeSlashes(deltaTime);
    this.explosion.update(deltaTime, elapsedTime, camera);
    this.rockRipple.update(deltaTime, elapsedTime);
    this.freezeShards.update(deltaTime);
  }

  reset(camera: THREE.Camera): void {
    const expirationDelta = 100;
    this.hit.update(expirationDelta, camera);
    for (const slash of this.animeSlashX) slash.update(expirationDelta, camera);
    for (const pendingSlash of this.pendingAnimeSlashes) pendingSlash.active = false;
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
    for (const slash of this.animeSlashX) slash.dispose();
    this.explosion.dispose();
    this.rockRipple.dispose();
    this.freezeShards.dispose();
  }

  private triggerAnimeSlash(
    position: THREE.Vector3,
    material1Color: THREE.ColorRepresentation,
    material2Color: THREE.ColorRepresentation,
  ): boolean {
    for (let offset = 0; offset < this.animeSlashX.length; offset += 1) {
      const index = (this.nextAnimeSlashX + offset) % this.animeSlashX.length;
      const slash = this.animeSlashX[index];
      if (!slash.isActive) {
        slash.trigger(position, { material1Color, material2Color });
        this.nextAnimeSlashX = (index + 1) % this.animeSlashX.length;
        return true;
      }
    }
    return false;
  }

  private queueAnimeSlash(
    position: THREE.Vector3,
    material1Color: THREE.ColorRepresentation,
    material2Color: THREE.ColorRepresentation,
    delay: number,
  ): void {
    for (let offset = 0; offset < this.pendingAnimeSlashes.length; offset += 1) {
      const index = (this.nextPendingAnimeSlash + offset) % this.pendingAnimeSlashes.length;
      const pendingSlash = this.pendingAnimeSlashes[index];
      if (!pendingSlash.active) {
        pendingSlash.active = true;
        pendingSlash.delay = delay;
        pendingSlash.position.copy(position);
        pendingSlash.material1Color.set(material1Color);
        pendingSlash.material2Color.set(material2Color);
        this.nextPendingAnimeSlash = (index + 1) % this.pendingAnimeSlashes.length;
        return;
      }
    }
  }

  private updatePendingAnimeSlashes(deltaTime: number): void {
    for (const pendingSlash of this.pendingAnimeSlashes) {
      if (!pendingSlash.active) continue;
      pendingSlash.delay -= deltaTime;
      if (pendingSlash.delay <= 0 && this.triggerAnimeSlash(
        pendingSlash.position,
        pendingSlash.material1Color,
        pendingSlash.material2Color,
      )) {
        pendingSlash.active = false;
      }
    }
  }
}
