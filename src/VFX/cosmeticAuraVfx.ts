import * as THREE from "three";
import critSpeedReadyAuraPreset from "./critSpeedReady_aura-preset.json";
import { AuraVfx2 } from "./auraVfx2";
import { AuraVfx3 } from "./auraVfx3";
import { TornadoVfx, type TornadoVfxPreset } from "../tornadoVfx";
import type { AuraStyleId } from "../progression/catalog";

type ArenaHeightSampler = (x: number, z: number) => number;

export interface CritReadyAuraVfx {
  readonly group: THREE.Group;
  setActive(active: boolean): void;
  setColor(color: THREE.ColorRepresentation): void;
  update(deltaTime: number, elapsedTime: number, camera: THREE.Camera, reducedMotion?: boolean): void;
  projectGroundToSurface(heightAt: ArenaHeightSampler, surfaceOffset: number, elapsedTime: number): void;
  setDepthContext?(texture: THREE.Texture, resolution: THREE.Vector2, cameraNear: number, cameraFar: number): void;
  isDepthEffectVisible?(): boolean;
  dispose(): void;
}

const baseAuraPreset = critSpeedReadyAuraPreset as TornadoVfxPreset;

export const cosmeticAuraRelativeScale: Readonly<Record<AuraStyleId, number>> = {
  aura_1: 1,
  aura_2: 0.72,
  aura_3: 1,
};

export function createTintedCritAuraPreset(color: THREE.ColorRepresentation): TornadoVfxPreset {
  const baseColor = new THREE.Color(color);
  const accentColor = baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.58);
  const rimColor = baseColor.clone().lerp(new THREE.Color("#ffffff"), 0.82);
  const colorHex = `#${baseColor.getHexString()}`;
  const accentHex = `#${accentColor.getHexString()}`;
  const rimHex = `#${rimColor.getHexString()}`;
  const layers = Object.fromEntries(Object.entries(baseAuraPreset.layers ?? {}).map(([name, layer]) => [
    name,
    { ...layer, color: colorHex, accentColor: accentHex, rimColor: rimHex },
  ]));
  return {
    ...baseAuraPreset,
    enabled: { ...baseAuraPreset.enabled },
    layers,
  };
}

export class TornadoCritReadyAuraVfx implements CritReadyAuraVfx {
  readonly group = new THREE.Group();
  private readonly tornado: TornadoVfx;
  private active = false;
  private colorHex: number;

  constructor(color: THREE.ColorRepresentation = "#ffd700") {
    this.colorHex = new THREE.Color(color).getHex();
    this.tornado = new TornadoVfx(createTintedCritAuraPreset(color));
    this.tornado.group.visible = false;
    this.group.add(this.tornado.group);
  }

  setActive(active: boolean): void {
    this.active = active;
    this.tornado.group.visible = active;
  }

  setColor(color: THREE.ColorRepresentation): void {
    const nextColorHex = new THREE.Color(color).getHex();
    if (nextColorHex === this.colorHex) return;
    this.colorHex = nextColorHex;
    this.tornado.applyPreset(createTintedCritAuraPreset(color));
  }

  update(deltaTime: number, elapsedTime: number): void {
    if (this.active) this.tornado.update(deltaTime, elapsedTime);
  }

  projectGroundToSurface(heightAt: ArenaHeightSampler, surfaceOffset: number, elapsedTime: number): void {
    if (this.active) this.tornado.projectGroundToSurface(heightAt, surfaceOffset, elapsedTime);
  }

  dispose(): void {
    this.tornado.dispose();
  }
}

export class SelectableCosmeticAuraVfx implements CritReadyAuraVfx {
  readonly group = new THREE.Group();
  private readonly tornado = new TornadoVfx(createTintedCritAuraPreset("#ffd700"));
  private readonly aura2 = new AuraVfx2({ baseColor: "#ffd700" });
  private readonly aura3 = new AuraVfx3({ baseColor: "#ffd700" });
  private style: AuraStyleId = "aura_1";
  private color: THREE.ColorRepresentation = "#ffd700";
  private active = false;

  constructor() {
    this.tornado.group.visible = false;
    this.aura2.group.scale.setScalar(cosmeticAuraRelativeScale.aura_2);
    this.group.add(this.tornado.group, this.aura2.group, this.aura3.group);
    void this.aura2.ready.catch((error: unknown) => console.error("Failed to initialize AuraVFX_2 textures", error));
    void this.aura3.ready.catch((error: unknown) => console.error("Failed to initialize AuraVFX_3 textures", error));
  }

  setStyle(style: AuraStyleId): void {
    if (style === this.style) return;
    this.hideAllImmediately();
    this.style = style;
    this.activateCurrent();
  }

  getStyle(): AuraStyleId {
    return this.style;
  }

  setActive(active: boolean): void {
    if (active === this.active) return;
    this.active = active;
    if (active) this.activateCurrent();
    else this.deactivateCurrent();
  }

  setColor(color: THREE.ColorRepresentation): void {
    this.color = color;
    this.tornado.applyPreset(createTintedCritAuraPreset(color));
    this.aura2.setColor(color);
    this.aura3.setColor(color);
  }

  update(deltaTime: number, elapsedTime: number, camera: THREE.Camera, reducedMotion = false): void {
    if (this.style === "aura_1") {
      if (this.active) this.tornado.update(deltaTime, elapsedTime);
      return;
    }
    if (this.style === "aura_2") this.aura2.update(deltaTime, elapsedTime, camera, reducedMotion);
    else this.aura3.update(deltaTime, elapsedTime, camera, reducedMotion);
  }

  projectGroundToSurface(heightAt: ArenaHeightSampler, surfaceOffset: number, elapsedTime: number): void {
    if (this.style === "aura_1" && this.active) {
      this.tornado.projectGroundToSurface(heightAt, surfaceOffset, elapsedTime);
    }
  }

  setDepthContext(texture: THREE.Texture, resolution: THREE.Vector2, cameraNear: number, cameraFar: number): void {
    this.aura2.setDepthContext(texture, resolution, cameraNear, cameraFar);
    this.aura3.setDepthContext(texture, resolution, cameraNear, cameraFar);
  }

  isDepthEffectVisible(): boolean {
    if (this.style === "aura_2") return this.aura2.group.visible;
    if (this.style === "aura_3") return this.aura3.group.visible;
    return false;
  }

  dispose(): void {
    this.tornado.dispose();
    this.aura2.dispose();
    this.aura3.dispose();
  }

  private activateCurrent(): void {
    this.tornado.group.visible = this.active && this.style === "aura_1";
    if (!this.active) return;
    if (this.style === "aura_2") this.aura2.start(this.color);
    if (this.style === "aura_3") this.aura3.start(this.color);
  }

  private deactivateCurrent(): void {
    this.tornado.group.visible = false;
    if (this.style === "aura_2") this.aura2.stop();
    if (this.style === "aura_3") this.aura3.stop();
  }

  private hideAllImmediately(): void {
    this.tornado.group.visible = false;
    this.aura2.setActiveImmediately(false);
    this.aura3.setActiveImmediately(false);
  }
}
