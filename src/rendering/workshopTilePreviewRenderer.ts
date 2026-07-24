import * as THREE from "three";
import { isAuraStyleId, modelCatalog, type AuraStyleId } from "../progression/catalog";
import { AuraVfx2 } from "../VFX/auraVfx2";
import { AuraVfx3 } from "../VFX/auraVfx3";
import { cosmeticAuraRelativeScale, TornadoCritReadyAuraVfx } from "../VFX/cosmeticAuraVfx";
import { createAnimeSpinnerVisual, type AnimeSpinnerVisual } from "./animeSpinnerMaterial";
import { isSpinnerModelAssetKey, type SpinnerModelLoader } from "./spinnerModelLoader";
import { computeWorkshopCanvasPixelRatio } from "../ui/workshopLayout";
import { maxSpinnerTrailPoints, SpinnerTrailVisual } from "../VFX/spinnerTrail";

const fixedThumbnailColors: [string, string, string] = ["#8A2BE2", "#FFD700", "#3F00FF"];
const thumbnailFillRatio = 0.84;
const orientedBoundsCorrection = 0.5;
export const auraThumbnailPresentation = Object.freeze({
  color: "#ffffff",
  deltaTime: 0,
  elapsedTime: 0.85,
  baseScale: 2.95,
});

export function getAuraThumbnailScale(style: AuraStyleId): number {
  return auraThumbnailPresentation.baseScale * cosmeticAuraRelativeScale[style];
}

type ThumbnailModel = {
  visual: AnimeSpinnerVisual;
  center: THREE.Vector3;
  size: THREE.Vector3;
};

export function computeThumbnailCameraDistance(
  size: Pick<THREE.Vector3, "x" | "y" | "z">,
  aspect: number,
  verticalFovDegrees = 32,
): number {
  const verticalFov = THREE.MathUtils.degToRad(verticalFovDegrees);
  const horizontalFov = 2 * Math.atan(Math.tan(verticalFov / 2) * Math.max(aspect, 0.01));
  const effectiveHeight = Math.min(size.y, size.z) + Math.max(size.y, size.z) * 0.22;
  const horizontalDistance = size.x / (2 * Math.tan(horizontalFov / 2) * thumbnailFillRatio);
  const verticalDistance = effectiveHeight / (2 * Math.tan(verticalFov / 2) * thumbnailFillRatio);
  return Math.max(horizontalDistance, verticalDistance) * orientedBoundsCorrection;
}

export class WorkshopTilePreviewRenderer {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(32, 1, 0.1, 30);
  private readonly models = new Map<string, ThumbnailModel>();
  private readonly aura1 = new TornadoCritReadyAuraVfx();
  private readonly aura2 = new AuraVfx2();
  private readonly aura3 = new AuraVfx3();
  private readonly modelCameraDirection = new THREE.Vector3(0, 0.22, 1).normalize();
  private readonly trailCameraDirection = new THREE.Vector3(0, 0.8, 1).normalize();
  private readonly trail = new SpinnerTrailVisual("#ffffff", {
    baseWidth: 0.14,
    tailWidth: 0.035,
    outlineExtraWidth: 0.022,
  });
  private readonly trailCenter = new THREE.Vector3();
  private readonly trailSize = new THREE.Vector3();
  private width = 1;
  private height = 1;
  private readonly mutationObserver: MutationObserver;
  private dirty = true;
  private visible = false;
  private pixelRatio = 0;

  constructor(loader: SpinnerModelLoader) {
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "workshop-tile-preview-canvas";
    this.canvas.hidden = true;
    this.camera.position.set(0, 3.4, 6.8);
    this.camera.lookAt(0, 0.55, 0);
    const stage = document.querySelector<HTMLElement>("[data-workshop-stage]");
    (stage ?? document.body).append(this.canvas);
    this.renderer.setSize(this.width, this.height, false);
    const content = document.querySelector<HTMLElement>("[data-workshop-content]");
    this.mutationObserver = new MutationObserver(() => this.invalidate());
    if (content) this.mutationObserver.observe(content, { childList: true, subtree: true, attributes: true });
    window.addEventListener("resize", this.invalidate);

    this.aura1.setActive(true);
    this.scene.add(this.aura1.group, this.aura2.group, this.aura3.group);
    void this.aura2.ready
      .then(this.invalidate)
      .catch((error: unknown) => console.error("Failed to initialize AuraVFX_2 thumbnail", error));
    void this.aura3.ready
      .then(this.invalidate)
      .catch((error: unknown) => console.error("Failed to initialize AuraVFX_3 thumbnail", error));
    const trailHead = new THREE.Vector3(1.2, 0.075, 0);
    const trailPoints = Array.from({ length: maxSpinnerTrailPoints }, (_, index) => {
      const ratio = (index + 1) / maxSpinnerTrailPoints;
      return new THREE.Vector3(1.2 - ratio * 2.4, 0.075, Math.sin(ratio * Math.PI * 2) * 0.55);
    });
    this.trail.update(trailHead, trailPoints, 1, false);
    this.trail.group.visible = false;
    this.trail.group.updateMatrixWorld(true);
    const trailBounds = new THREE.Box3().setFromObject(this.trail.group);
    trailBounds.getCenter(this.trailCenter);
    trailBounds.getSize(this.trailSize);
    this.scene.add(this.trail.group);
    void this.preloadModels(loader);
  }

  updateAndRender(_deltaTime: number, _elapsedTime: number, visible: boolean): void {
    if (visible !== this.visible) {
      this.visible = visible;
      this.canvas.hidden = !visible;
      if (visible) this.invalidate();
    }
    if (!visible) return;
    const canvasRect = this.canvas.getBoundingClientRect();
    const canvasScale = this.getCanvasScale(canvasRect);
    const nextPixelRatio = computeWorkshopCanvasPixelRatio(canvasScale, window.devicePixelRatio);
    if (Math.abs(nextPixelRatio - this.pixelRatio) >= 0.01) this.invalidate();
    if (!this.dirty) return;
    this.dirty = false;
    this.updateDrawingBuffer(canvasScale);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.clear(true, true, true);
    this.renderer.setScissorTest(true);

    const targets = document.querySelectorAll<HTMLElement>("[data-workshop-webgl-kind]");
    for (const target of targets) {
      const itemId = target.dataset.itemId;
      const kind = target.dataset.workshopWebglKind;
      if (!itemId || !["model", "model-slot", "material-mask", "aura-style", "trail-slot"].includes(kind ?? "")) continue;
      const rect = target.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) continue;
      const clipElement = target.closest<HTMLElement>(".workshop-category-scroll, .workshop-category-content");
      const viewport = clipElement?.getBoundingClientRect();
      const screenClip = this.intersect(rect, viewport, canvasRect);
      if (!screenClip || screenClip.width < 2 || screenClip.height < 2) continue;
      const localRect = this.toCanvasRect(rect, canvasRect);
      const localClip = this.toCanvasRect(screenClip, canvasRect);

      this.hideAll();
      if (kind === "model" || kind === "model-slot" || kind === "material-mask") {
        const model = this.models.get(itemId);
        if (!model) continue;
        if (kind === "material-mask") {
          const slot = Math.min(2, Math.max(0, Number(target.dataset.materialSlot) || 0));
          const colors: [string, string, string] = ["#050505", "#050505", "#050505"];
          colors[slot] = "#FFFFFF";
          model.visual.setColors(colors);
        } else {
          model.visual.setColors(fixedThumbnailColors);
        }
        model.visual.root.visible = true;
        this.fitModelCamera(
          model,
          Math.max(localRect.width, 1) / Math.max(localRect.height, 1),
          kind === "material-mask" ? 1.28 : kind === "model" ? 1.2 : 1,
        );
      } else if (kind === "trail-slot") {
        const trailColor = target.dataset.trailColor ?? "#ffffff";
        this.trail.setColor(trailColor.toLowerCase() === "#ffffff" ? "#ff3048" : trailColor);
        this.trail.group.visible = true;
        const distance = computeThumbnailCameraDistance(
          this.trailSize,
          Math.max(localRect.width, 1) / Math.max(localRect.height, 1),
          this.camera.fov,
        );
        this.camera.position.copy(this.trailCenter).addScaledVector(this.trailCameraDirection, distance);
        this.camera.near = Math.max(0.01, distance - 4);
        this.camera.far = distance + 14;
        this.camera.lookAt(this.trailCenter);
      } else {
        const style = isAuraStyleId(itemId) ? itemId : null;
        const model = this.models.get(target.dataset.modelId ?? "model_default");
        if (!style || !model) continue;
        model.visual.setColors(fixedThumbnailColors);
        model.visual.root.visible = true;
        this.fitModelCamera(model, Math.max(localRect.width, 1) / Math.max(localRect.height, 1), 2.05);
        this.showAura(style);
      }

      this.camera.aspect = Math.max(localRect.width, 1) / Math.max(localRect.height, 1);
      this.camera.updateProjectionMatrix();
      const viewportX = localRect.left;
      const viewportY = this.height - localRect.bottom;
      this.renderer.setViewport(viewportX, viewportY, localRect.width, localRect.height);
      this.renderer.setScissor(localClip.left, this.height - localClip.bottom, localClip.width, localClip.height);
      this.renderer.render(this.scene, this.camera);
    }
    this.hideAll();
    this.renderer.setScissorTest(false);
  }

  hide(): void {
    this.visible = false;
    this.canvas.hidden = true;
    this.hideAll();
  }

  private async preloadModels(loader: SpinnerModelLoader): Promise<void> {
    await Promise.all(modelCatalog.map(async (item) => {
      if (!isSpinnerModelAssetKey(item.assetKey)) return;
      try {
        const loaded = await loader.load(item.assetKey);
        const visual = createAnimeSpinnerVisual(loaded.source, loaded.asset.rotationX, 4.25, fixedThumbnailColors, loaded.asset.outline);
        visual.root.rotation.x = THREE.MathUtils.degToRad(10);
        visual.root.rotation.y = THREE.MathUtils.degToRad(-22);
        visual.root.visible = false;
        visual.root.updateMatrixWorld(true);
        const bounds = new THREE.Box3().setFromObject(visual.root);
        this.models.set(item.id, {
          visual,
          center: bounds.getCenter(new THREE.Vector3()),
          size: bounds.getSize(new THREE.Vector3()),
        });
        this.scene.add(visual.root);
        this.invalidate();
      } catch (error) {
        console.error(`Failed to load workshop thumbnail ${item.assetKey}`, error);
      }
    }));
  }

  private hideAll(): void {
    for (const model of this.models.values()) model.visual.root.visible = false;
    this.aura1.group.visible = false;
    this.aura2.group.visible = false;
    this.aura3.group.visible = false;
    this.trail.group.visible = false;
  }

  readonly invalidate = (): void => {
    this.dirty = true;
  };

  private showAura(style: AuraStyleId): void {
    const scale = getAuraThumbnailScale(style);
    const { color, deltaTime, elapsedTime } = auraThumbnailPresentation;
    if (style === "aura_1") {
      this.aura1.setColor(color);
      this.aura1.group.scale.setScalar(scale);
      this.aura1.group.visible = true;
      this.aura1.update(deltaTime, elapsedTime);
      return;
    }
    if (style === "aura_2") {
      this.aura2.setColor(color);
      this.aura2.group.scale.setScalar(scale);
      this.aura2.setActiveImmediately(true);
      this.aura2.update(deltaTime, elapsedTime, this.camera, false);
      return;
    }
    this.aura3.setColor(color);
    this.aura3.group.scale.setScalar(scale);
    this.aura3.setActiveImmediately(true);
    this.aura3.update(deltaTime, elapsedTime, this.camera, false);
  }

  private fitModelCamera(model: ThumbnailModel, aspect: number, distanceMultiplier: number): void {
    const distance = computeThumbnailCameraDistance(model.size, aspect, this.camera.fov) * distanceMultiplier;
    this.camera.position.copy(model.center).addScaledVector(this.modelCameraDirection, distance);
    this.camera.near = Math.max(0.01, distance - model.size.z * 2.5);
    this.camera.far = distance + model.size.z * 3.5 + 10;
    this.camera.lookAt(model.center);
  }

  private updateDrawingBuffer(canvasScale: number): void {
    const width = Math.max(1, Math.floor(this.canvas.clientWidth));
    const height = Math.max(1, Math.floor(this.canvas.clientHeight));
    const pixelRatio = computeWorkshopCanvasPixelRatio(canvasScale, window.devicePixelRatio);
    if (width === this.width && height === this.height && Math.abs(pixelRatio - this.pixelRatio) < 0.01) return;
    this.width = width;
    this.height = height;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
  }

  private getCanvasScale(canvasRect: DOMRect): number {
    const widthScale = canvasRect.width / Math.max(1, this.canvas.clientWidth);
    const heightScale = canvasRect.height / Math.max(1, this.canvas.clientHeight);
    return Math.max(0.01, Math.min(widthScale, heightScale));
  }

  private toCanvasRect(rect: DOMRect, canvasRect: DOMRect): DOMRect {
    const scaleX = this.width / Math.max(1, canvasRect.width);
    const scaleY = this.height / Math.max(1, canvasRect.height);
    return DOMRect.fromRect({
      x: (rect.left - canvasRect.left) * scaleX,
      y: (rect.top - canvasRect.top) * scaleY,
      width: rect.width * scaleX,
      height: rect.height * scaleY,
    });
  }

  private intersect(rect: DOMRect, viewport: DOMRect | undefined, canvasRect: DOMRect): DOMRect | null {
    const left = Math.max(rect.left, viewport?.left ?? canvasRect.left, canvasRect.left);
    const top = Math.max(rect.top, viewport?.top ?? canvasRect.top, canvasRect.top);
    const right = Math.min(rect.right, viewport?.right ?? canvasRect.right, canvasRect.right);
    const bottom = Math.min(rect.bottom, viewport?.bottom ?? canvasRect.bottom, canvasRect.bottom);
    if (right <= left || bottom <= top) return null;
    return DOMRect.fromRect({ x: left, y: top, width: right - left, height: bottom - top });
  }
}
