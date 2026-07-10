import * as THREE from "three";
import { cosmeticAuraPresetById, previewAuraPresetByElement } from "../VFX/cosmeticAuraPresets";
import { SpinnerTrailVisual, maxSpinnerTrailPoints } from "../VFX/spinnerTrail";
import { TornadoVfx } from "../tornadoVfx";
import type { SpinnerElement } from "../simulation/elementalSkills";
import { createAnimeSpinnerVisual, type AnimeSpinnerVisual } from "./animeSpinnerMaterial";
import { AnimeOutlinePass } from "./animeOutlinePass";
import type { SpinnerModelAsset } from "./spinnerModelLoader";

const transientEffectDuration = 3;
const previewModelDiameter = 3.44;
const combatSpinnerDiameter = 0.72 * 2;
const previewAuraVerticalScale = 1.35;
const previewAuraLiftRatio = 0.12;

export class WorkshopPreview {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(34, 1, 0.1, 40);
  private readonly tiltRoot = new THREE.Group();
  private readonly spinRoot = new THREE.Group();
  private readonly effectRoot = new THREE.Group();
  private readonly outlinePass = new AnimeOutlinePass({
    outerWidth: 3,
    innerWidth: 1,
    normalThreshold: 0.5,
    depthThreshold: 0.012,
    innerOpacity: 0.68,
    outerOpacity: 1,
  });
  private readonly transientAura = new TornadoVfx(cosmeticAuraPresetById.aura_crit);
  private readonly trail = new SpinnerTrailVisual("#FFFFFF", {
    baseWidth: 0.14,
    tailWidth: 0.035,
    outlineExtraWidth: 0.022,
  });
  private readonly trailPoints = Array.from({ length: maxSpinnerTrailPoints }, () => new THREE.Vector3());
  private readonly trailCurrentPoint = new THREE.Vector3(0, 0.075, 0);
  private readonly clearColor = new THREE.Color();
  private readonly reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  private model: AnimeSpinnerVisual | null = null;
  private colors: [string, string, string] = ["#FFFFFF", "#808080", "#0B1F3A"];
  private width = 1;
  private height = 1;
  private viewportX = 0;
  private viewportY = 0;
  private manualRotation = 0;
  private transientAuraRemaining = 0;
  private transientAuraElapsed = 0;

  constructor() {
    this.configureCamera();
    this.tiltRoot.rotation.x = THREE.MathUtils.degToRad(12);
    this.effectRoot.add(this.transientAura.group);
    this.tiltRoot.add(this.spinRoot, this.effectRoot);
    this.scene.add(this.tiltRoot, this.trail.group);
    this.transientAura.group.visible = false;
  }

  setModelSource(source: THREE.Group, asset: SpinnerModelAsset): void {
    this.removeModel();
    this.model = createAnimeSpinnerVisual(source, asset.rotationX, previewModelDiameter, this.colors, asset.outline);
    this.spinRoot.add(this.model.root);
    this.fitEffectToModel();
  }

  setColors(colors: readonly [string, string, string]): void {
    this.colors = [...colors];
    this.model?.setColors(this.colors);
  }

  setTrailColor(color: string): void {
    this.trail.setColor(color);
  }

  flashElement(element: SpinnerElement): void {
    this.startTransientEffect(previewAuraPresetByElement[element]);
  }

  flashAura(auraId: string): void {
    const preset = cosmeticAuraPresetById[auraId];
    if (preset) this.startTransientEffect(preset);
  }

  rotateBy(deltaX: number): void {
    this.manualRotation += deltaX * 0.012;
  }

  resize(width: number, height: number, viewportX = 0, viewportY = 0): void {
    this.width = Math.max(1, Math.floor(width));
    this.height = Math.max(1, Math.floor(height));
    this.viewportX = Math.max(0, Math.floor(viewportX));
    this.viewportY = Math.max(0, Math.floor(viewportY));
    this.camera.aspect = this.width / this.height;
    const logicalScaleX = this.width / 264;
    const logicalScaleY = this.height / 232;
    this.camera.setViewOffset(
      this.width,
      this.height,
      -27 * logicalScaleX,
      -28 * logicalScaleY,
      this.width,
      this.height,
    );
    this.camera.updateProjectionMatrix();
  }

  update(deltaTime: number, elapsedTime: number): void {
    this.spinRoot.rotation.y += deltaTime * 0.55;
    this.tiltRoot.rotation.y = this.manualRotation;
    const waveTime = this.reducedMotion.matches ? 0 : elapsedTime * 2.4;
    for (let index = 0; index < this.trailPoints.length; index += 1) {
      const ratio = (index + 1) / this.trailPoints.length;
      const wave = Math.sin(ratio * Math.PI * 4 - waveTime) * 0.1 * Math.sin(ratio * Math.PI);
      this.trailPoints[index].set(-ratio * 2.45 + wave * 0.4, 0.075, -ratio * 1.75 - wave * 0.7);
    }
    this.trail.update(this.trailCurrentPoint, this.trailPoints, 1, this.reducedMotion.matches);
    if (this.transientAuraRemaining > 0) {
      this.transientAuraRemaining = Math.max(0, this.transientAuraRemaining - deltaTime);
      this.transientAuraElapsed += deltaTime;
      this.transientAura.update(deltaTime, this.transientAuraElapsed);
      if (this.transientAuraRemaining === 0) this.transientAura.group.visible = false;
    }
  }

  render(renderer: THREE.WebGLRenderer): void {
    renderer.getClearColor(this.clearColor);
    const clearAlpha = renderer.getClearAlpha();
    const autoClear = renderer.autoClear;
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    renderer.autoClear = true;
    renderer.clear(true, true, true);
    renderer.setScissorTest(true);
    renderer.setViewport(this.viewportX, this.viewportY, this.width, this.height);
    renderer.setScissor(this.viewportX, this.viewportY, this.width, this.height);
    renderer.autoClear = false;
    renderer.render(this.scene, this.camera);
    if (this.model?.root.userData.spinnerScreenOutline === true) {
      this.outlinePass.render(renderer, this.scene, this.camera, [this.model.root], {
        x: this.viewportX,
        y: this.viewportY,
        width: this.width,
        height: this.height,
      });
    }
    renderer.autoClear = autoClear;
    renderer.setClearColor(this.clearColor, clearAlpha);
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
  }

  dispose(): void {
    this.removeModel();
    this.outlinePass.dispose();
    this.transientAura.dispose();
    this.trail.dispose();
  }

  private configureCamera(): void {
    const aspect = 264 / 232;
    const verticalFov = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * aspect);
    const distance = previewModelDiameter / (2 * Math.tan(horizontalFov / 2) * 0.72);
    const target = new THREE.Vector3(0, 0.5, 0);
    const direction = new THREE.Vector3(0, 0.5, 1).normalize();
    this.camera.position.copy(target).addScaledVector(direction, distance);
    this.camera.lookAt(target);
  }

  private fitEffectToModel(): void {
    if (!this.model) return;
    this.model.root.updateWorldMatrix(true, true);
    const bounds = new THREE.Box3().setFromObject(this.model.root);
    const size = bounds.getSize(new THREE.Vector3());
    const visibleDiameter = Math.max(size.x, size.z, previewModelDiameter);
    const horizontalScale = visibleDiameter / combatSpinnerDiameter;
    this.effectRoot.position.set(0, Math.max(0, size.y * previewAuraLiftRatio), 0);
    this.transientAura.group.scale.set(horizontalScale, previewAuraVerticalScale, horizontalScale);
  }

  private startTransientEffect(preset: Parameters<TornadoVfx["applyPreset"]>[0]): void {
    this.transientAura.applyPreset(preset);
    this.transientAuraRemaining = transientEffectDuration;
    this.transientAuraElapsed = 0;
    this.transientAura.group.visible = true;
    this.transientAura.update(0, 0);
  }

  private removeModel(): void {
    if (!this.model) return;
    this.spinRoot.remove(this.model.root);
    this.model.dispose();
    this.model = null;
  }
}
