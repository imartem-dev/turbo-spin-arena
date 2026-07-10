import * as THREE from "three";
import { BeamHitVfx } from "./beamHitVfx";
import { BeamVfx } from "./beamVfx";
import type { CombatSpinnerState } from "../simulation/combat";

export type LightningChainSettings = {
  chainRadius: number;
  maxChainTargets: number;
  chainDelay: number;
  beamHoldDuration: number;
  baseDamage: number;
  damageStep: number;
};

export type LightningDamageCommand<TSpinner extends CombatSpinnerState> = {
  source: TSpinner;
  target: TSpinner;
  amount: number;
  direction: THREE.Vector3;
};

export type LightningChainResult<TSpinner extends CombatSpinnerState> = {
  damageCommands: LightningDamageCommand<TSpinner>[];
};

type ActiveBeamSegment<TSpinner extends CombatSpinnerState> = {
  vfx: BeamVfx;
  from: TSpinner;
  to: TSpinner;
  fallbackStart: THREE.Vector3;
  fallbackEnd: THREE.Vector3;
  holdRemaining: number;
  active: boolean;
};

const lightningTargetOffset = 0.85;
const lightningGroundClearance = 1.4;

export class LightningChainVfx<TSpinner extends CombatSpinnerState> {
  private readonly segments: ActiveBeamSegment<TSpinner>[];
  private readonly hitVfx: BeamHitVfx[];
  private readonly hitTargets = new Set<TSpinner>();
  private readonly visualStart = new THREE.Vector3();
  private readonly visualEnd = new THREE.Vector3();
  private readonly hitPosition = new THREE.Vector3();
  private source: TSpinner | null = null;
  private currentTarget: TSpinner | null = null;
  private targetsHit = 0;
  private nextJumpDelay = 0;
  private canContinueChain = false;
  private nextHitVfx = 0;

  constructor(
    private readonly scene: THREE.Scene,
    private readonly settings: LightningChainSettings,
    private readonly isDamageable: (spinner: TSpinner) => boolean,
    private readonly getSurfaceHeight: (position: THREE.Vector3) => number,
  ) {
    this.segments = Array.from({ length: Math.max(1, settings.maxChainTargets - 1) }, () => {
      const vfx = new BeamVfx();
      vfx.group.visible = false;
      scene.add(vfx.group);
      return {
        vfx,
        from: null as unknown as TSpinner,
        to: null as unknown as TSpinner,
        fallbackStart: new THREE.Vector3(),
        fallbackEnd: new THREE.Vector3(),
        holdRemaining: 0,
        active: false,
      };
    });
    this.hitVfx = Array.from({ length: settings.maxChainTargets }, () => {
      const vfx = new BeamHitVfx();
      scene.add(vfx.group);
      return vfx;
    });
  }

  tryStart(source: TSpinner, firstTarget: TSpinner, candidates: readonly TSpinner[], reducedMotion = false): LightningChainResult<TSpinner> {
    if (!this.isDamageable(source) || !this.isDamageable(firstTarget) || !candidates.includes(firstTarget)) {
      return createEmptyLightningResult();
    }

    this.stopActiveChain();
    this.source = source;
    this.currentTarget = firstTarget;
    this.targetsHit = 0;
    this.nextJumpDelay = this.settings.chainDelay;
    this.canContinueChain = true;
    this.hitTargets.clear();
    return this.strikeTarget(source, firstTarget, source, false, reducedMotion);
  }

  advance(deltaTime: number, candidates: readonly TSpinner[], reducedMotion = false): LightningChainResult<TSpinner> {
    if (!this.source || !this.currentTarget || !this.canContinueChain) {
      return createEmptyLightningResult();
    }
    if (!this.isDamageable(this.source) || this.targetsHit >= this.settings.maxChainTargets) {
      this.canContinueChain = false;
      return createEmptyLightningResult();
    }

    this.nextJumpDelay -= deltaTime;
    if (this.nextJumpDelay > 0) {
      return createEmptyLightningResult();
    }

    const nextTarget = this.findNextTarget(this.currentTarget, candidates);
    if (!nextTarget) {
      this.canContinueChain = false;
      return createEmptyLightningResult();
    }

    const from = this.currentTarget;
    this.currentTarget = nextTarget;
    this.nextJumpDelay += this.settings.chainDelay;
    return this.strikeTarget(from, nextTarget, this.source, true, reducedMotion);
  }

  updateVisuals(deltaTime: number, elapsedTime: number, camera: THREE.Camera, reducedMotion = false): void {
    for (const segment of this.segments) {
      if (segment.active) {
        segment.holdRemaining = Math.max(0, segment.holdRemaining - deltaTime);
        const start = this.getSegmentAnchor(segment.from, segment.fallbackStart, this.visualStart);
        const end = this.getSegmentAnchor(segment.to, segment.fallbackEnd, this.visualEnd);
        segment.vfx.setEndpoints(start, end);
        if (segment.holdRemaining <= 0) {
          segment.active = false;
          segment.vfx.stop();
        }
      }
      segment.vfx.update(deltaTime, elapsedTime, camera, reducedMotion);
    }
    for (const vfx of this.hitVfx) {
      vfx.update(deltaTime, elapsedTime, camera);
    }

    if (this.source && !this.canContinueChain && !this.segments.some((segment) => segment.active)) {
      this.resetChain();
    }
  }

  cancelForSpinner(spinner: TSpinner): void {
    if (this.source === spinner || this.currentTarget === spinner || this.hitTargets.has(spinner)) {
      this.stopActiveChain();
    }
  }

  reset(camera: THREE.Camera): void {
    this.stopActiveChain();
    for (const segment of this.segments) {
      segment.vfx.update(100, 0, camera, true);
    }
    for (const vfx of this.hitVfx) {
      vfx.update(100, 0, camera);
    }
  }

  dispose(): void {
    this.stopActiveChain();
    for (const segment of this.segments) {
      this.scene.remove(segment.vfx.group);
      segment.vfx.dispose();
    }
    for (const vfx of this.hitVfx) {
      this.scene.remove(vfx.group);
      vfx.dispose();
    }
  }

  private strikeTarget(
    from: TSpinner,
    target: TSpinner,
    damageSource: TSpinner,
    showBeam: boolean,
    reducedMotion: boolean,
  ): LightningChainResult<TSpinner> {
    this.hitTargets.add(target);
    const hitIndex = this.targetsHit;
    this.targetsHit += 1;
    if (showBeam) {
      this.acquireSegment(from, target);
    }
    this.getLightningAnchor(target, this.hitPosition);
    this.hitVfx[this.nextHitVfx].spawn(this.hitPosition, reducedMotion);
    this.nextHitVfx = (this.nextHitVfx + 1) % this.hitVfx.length;

    const direction = target.group.position.clone().sub(from.group.position);
    direction.y = 0;
    return {
      damageCommands: [{
        source: damageSource,
        target,
        amount: this.settings.baseDamage + this.settings.damageStep * hitIndex,
        direction,
      }],
    };
  }

  private acquireSegment(from: TSpinner, to: TSpinner): void {
    const segment = this.segments.find((candidate) => !candidate.active) ?? this.segments[0];
    const start = this.getLightningAnchor(from, segment.fallbackStart);
    const end = this.getLightningAnchor(to, segment.fallbackEnd);
    segment.from = from;
    segment.to = to;
    segment.holdRemaining = this.settings.beamHoldDuration;
    segment.active = true;
    segment.vfx.start(start, end);
  }

  private findNextTarget(from: TSpinner, candidates: readonly TSpinner[]): TSpinner | null {
    let nearestTarget: TSpinner | null = null;
    let nearestDistanceSq = this.settings.chainRadius * this.settings.chainRadius;
    for (const candidate of candidates) {
      if (candidate === this.source || this.hitTargets.has(candidate) || !this.isDamageable(candidate)) {
        continue;
      }
      const distanceSq = getPlanarDistanceSq(from.group.position, candidate.group.position);
      if (distanceSq <= nearestDistanceSq) {
        nearestDistanceSq = distanceSq;
        nearestTarget = candidate;
      }
    }
    return nearestTarget;
  }

  private getSegmentAnchor(spinner: TSpinner, fallback: THREE.Vector3, target: THREE.Vector3): THREE.Vector3 {
    return this.isDamageable(spinner) ? this.getLightningAnchor(spinner, target) : target.copy(fallback);
  }

  private getLightningAnchor(spinner: CombatSpinnerState, target: THREE.Vector3): THREE.Vector3 {
    target.copy(spinner.group.position);
    target.y = Math.max(
      spinner.group.position.y + lightningTargetOffset,
      this.getSurfaceHeight(target) + lightningGroundClearance,
    );
    return target;
  }

  private stopActiveChain(): void {
    for (const segment of this.segments) {
      if (segment.active) {
        segment.active = false;
        segment.holdRemaining = 0;
        segment.vfx.stop();
      }
    }
    this.resetChain();
  }

  private resetChain(): void {
    this.source = null;
    this.currentTarget = null;
    this.targetsHit = 0;
    this.nextJumpDelay = 0;
    this.canContinueChain = false;
    this.hitTargets.clear();
  }
}

function createEmptyLightningResult<TSpinner extends CombatSpinnerState>(): LightningChainResult<TSpinner> {
  return { damageCommands: [] };
}

function getPlanarDistanceSq(a: THREE.Vector3, b: THREE.Vector3): number {
  const x = a.x - b.x;
  const z = a.z - b.z;
  return x * x + z * z;
}
