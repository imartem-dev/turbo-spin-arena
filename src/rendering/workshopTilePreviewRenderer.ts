import * as THREE from "three";
import { auraCatalog, modelCatalog } from "../progression/catalog";
import { cosmeticAuraPresetById } from "../VFX/cosmeticAuraPresets";
import { TornadoVfx } from "../tornadoVfx";
import { createAnimeSpinnerVisual, type AnimeSpinnerVisual } from "./animeSpinnerMaterial";
import { AnimeOutlinePass } from "./animeOutlinePass";
import { isSpinnerModelAssetKey, type SpinnerModelLoader } from "./spinnerModelLoader";
import { computeWorkshopCanvasPixelRatio } from "../ui/workshopLayout";

const fixedThumbnailColors: [string, string, string] = ["#8A2BE2", "#FFD700", "#3F00FF"];
const thumbnailFillRatio = 0.84;
const orientedBoundsCorrection = 0.5;

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
  private readonly outlinePass = new AnimeOutlinePass({
    outerWidth: 2,
    innerWidth: 0.75,
    normalThreshold: 0.58,
    depthThreshold: 0.014,
    innerOpacity: 0.5,
    outerOpacity: 1,
  });
  private readonly models = new Map<string, ThumbnailModel>();
  private readonly auras = new Map<string, TornadoVfx>();
  private readonly modelCameraDirection = new THREE.Vector3(0, 0.22, 1).normalize();
  private readonly width = 720;
  private readonly height = 360;
  private frameAccumulator = 0;
  private pixelRatio = 0;

  constructor(loader: SpinnerModelLoader) {
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.canvas = this.renderer.domElement;
    this.canvas.className = "workshop-tile-preview-canvas";
    this.camera.position.set(0, 3.4, 6.8);
    this.camera.lookAt(0, 0.55, 0);
    const stage = document.querySelector<HTMLElement>("[data-workshop-stage]");
    (stage ?? document.body).append(this.canvas);
    this.renderer.setSize(this.width, this.height, false);

    for (const item of auraCatalog) {
      const preset = cosmeticAuraPresetById[item.id];
      if (!preset) continue;
      const aura = new TornadoVfx(preset);
      aura.group.visible = false;
      aura.group.scale.setScalar(1.45);
      aura.update(0, 0.85);
      this.auras.set(item.id, aura);
      this.scene.add(aura.group);
    }
    void this.preloadModels(loader);
  }

  updateAndRender(deltaTime: number, elapsedTime: number, visible: boolean): void {
    this.canvas.hidden = !visible;
    if (!visible) return;
    this.frameAccumulator += deltaTime;
    if (this.frameAccumulator < 1 / 30) return;
    const previewDelta = this.frameAccumulator;
    this.frameAccumulator = 0;
    const stage = document.querySelector<HTMLElement>("[data-workshop-stage]");
    const stageRect = stage?.getBoundingClientRect();
    if (!stageRect || stageRect.width <= 0) return;
    const stageScale = stageRect.width / this.width;
    this.updateDrawingBuffer(stageScale);
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, this.width, this.height);
    this.renderer.clear(true, true, true);
    this.renderer.setScissorTest(true);

    const targets = document.querySelectorAll<HTMLElement>("[data-workshop-webgl-kind]");
    for (const target of targets) {
      const itemId = target.dataset.itemId;
      const kind = target.dataset.workshopWebglKind;
      if (!itemId || !["model", "model-slot", "material-mask", "aura", "aura-slot"].includes(kind ?? "")) continue;
      const rect = this.toLogicalRect(target.getBoundingClientRect(), stageRect, stageScale);
      const clipElement = target.closest<HTMLElement>(".workshop-category-scroll, .workshop-category-content");
      const viewport = clipElement ? this.toLogicalRect(clipElement.getBoundingClientRect(), stageRect, stageScale) : undefined;
      const clip = this.intersect(rect, viewport);
      if (!clip || clip.width < 2 || clip.height < 2) continue;

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
          Math.max(rect.width, 1) / Math.max(rect.height, 1),
          kind === "material-mask" ? 1.28 : kind === "model" ? 1.2 : 1,
        );
      } else {
        const aura = this.auras.get(itemId);
        if (!aura) continue;
        aura.group.visible = true;
        if (kind === "aura" && target.dataset.active === "true") aura.update(previewDelta, elapsedTime);
        this.camera.position.set(0, 3.4, 6.8);
        this.camera.lookAt(0, 0.55, 0);
      }

      this.camera.aspect = Math.max(rect.width, 1) / Math.max(rect.height, 1);
      this.camera.updateProjectionMatrix();
      const viewportX = rect.left;
      const viewportY = this.height - rect.bottom;
      this.renderer.setViewport(viewportX, viewportY, rect.width, rect.height);
      this.renderer.setScissor(clip.left, this.height - clip.bottom, clip.width, clip.height);
      this.renderer.render(this.scene, this.camera);
      if ((kind === "model" || kind === "model-slot") && itemId) {
        const model = this.models.get(itemId);
        if (model?.visual.root.userData.spinnerScreenOutline === true) {
          this.outlinePass.render(
            this.renderer,
            this.scene,
            this.camera,
            [model.visual.root],
            { x: viewportX, y: viewportY, width: rect.width, height: rect.height },
            { x: clip.left, y: this.height - clip.bottom, width: clip.width, height: clip.height },
          );
        }
      }
    }
    this.hideAll();
    this.renderer.setScissorTest(false);
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
      } catch (error) {
        console.error(`Failed to load workshop thumbnail ${item.assetKey}`, error);
      }
    }));
  }

  private hideAll(): void {
    for (const model of this.models.values()) model.visual.root.visible = false;
    for (const aura of this.auras.values()) aura.group.visible = false;
  }

  private fitModelCamera(model: ThumbnailModel, aspect: number, distanceMultiplier: number): void {
    const distance = computeThumbnailCameraDistance(model.size, aspect, this.camera.fov) * distanceMultiplier;
    this.camera.position.copy(model.center).addScaledVector(this.modelCameraDirection, distance);
    this.camera.near = Math.max(0.01, distance - model.size.z * 2.5);
    this.camera.far = distance + model.size.z * 3.5 + 10;
    this.camera.lookAt(model.center);
  }

  private updateDrawingBuffer(stageScale: number): void {
    const pixelRatio = computeWorkshopCanvasPixelRatio(stageScale, window.devicePixelRatio);
    if (Math.abs(pixelRatio - this.pixelRatio) < 0.01) return;
    this.pixelRatio = pixelRatio;
    this.renderer.setPixelRatio(pixelRatio);
    this.renderer.setSize(this.width, this.height, false);
  }

  private toLogicalRect(rect: DOMRect, stage: DOMRect, scale: number): DOMRect {
    return DOMRect.fromRect({
      x: (rect.left - stage.left) / scale,
      y: (rect.top - stage.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale,
    });
  }

  private intersect(rect: DOMRect, viewport?: DOMRect): DOMRect | null {
    const left = Math.max(rect.left, viewport?.left ?? 0, 0);
    const top = Math.max(rect.top, viewport?.top ?? 0, 0);
    const right = Math.min(rect.right, viewport?.right ?? this.width, this.width);
    const bottom = Math.min(rect.bottom, viewport?.bottom ?? this.height, this.height);
    if (right <= left || bottom <= top) return null;
    return DOMRect.fromRect({ x: left, y: top, width: right - left, height: bottom - top });
  }
}
