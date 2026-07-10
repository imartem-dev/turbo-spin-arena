import * as THREE from "three";

export type AnimeOutlineViewport = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type AnimeOutlinePassResources = {
  maskTarget: THREE.WebGLRenderTarget;
  maskMaterial: THREE.Material;
  compositeMaterial: THREE.ShaderMaterial;
  quad: THREE.Mesh;
};

export type AnimeOutlinePassOptions = {
  outerWidth?: number;
  innerWidth?: number;
  normalThreshold?: number;
  depthThreshold?: number;
  innerOpacity?: number;
  outerOpacity?: number;
};

const outlineColor = new THREE.Color("#06070a");
const defaultOutlineOptions = {
  outerWidth: 3,
  innerWidth: 1,
  normalThreshold: 0.52,
  depthThreshold: 0.012,
  innerOpacity: 0.68,
  outerOpacity: 1,
} satisfies Required<AnimeOutlinePassOptions>;

export class AnimeOutlinePass {
  private readonly maskTarget = new THREE.WebGLRenderTarget(1, 1, {
    depthBuffer: true,
    stencilBuffer: false,
  });
  private readonly maskDepthTexture = new THREE.DepthTexture(1, 1, THREE.UnsignedIntType);
  private readonly maskMaterial = new THREE.MeshNormalMaterial({
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
  });
  private readonly compositeMaterial = createCompositeMaterial();
  private readonly quadScene = new THREE.Scene();
  private readonly quadCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.compositeMaterial);
  private readonly previousClearColor = new THREE.Color();
  private readonly previousViewport = new THREE.Vector4();
  private readonly previousScissor = new THREE.Vector4();
  private readonly drawingBufferSize = new THREE.Vector2();
  private width = 1;
  private height = 1;
  private readonly options: Required<AnimeOutlinePassOptions>;

  constructor(options: AnimeOutlinePassOptions | number = defaultOutlineOptions) {
    this.options = typeof options === "number"
      ? { ...defaultOutlineOptions, outerWidth: options }
      : { ...defaultOutlineOptions, ...options };
    this.maskTarget.depthTexture = this.maskDepthTexture;
    this.maskTarget.texture.name = "Anime Outline Normal Mask";
    this.maskTarget.texture.colorSpace = THREE.NoColorSpace;
    this.maskTarget.texture.minFilter = THREE.NearestFilter;
    this.maskTarget.texture.magFilter = THREE.NearestFilter;
    this.maskTarget.texture.generateMipmaps = false;
    this.maskDepthTexture.name = "Anime Outline Depth Mask";
    this.maskDepthTexture.minFilter = THREE.NearestFilter;
    this.maskDepthTexture.magFilter = THREE.NearestFilter;
    this.quad.frustumCulled = false;
    this.quadScene.add(this.quad);
  }

  render(
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    targets: readonly THREE.Object3D[],
    viewport: AnimeOutlineViewport,
    scissor = viewport,
  ): void {
    const visibleTargets = targets.filter((target) => target.visible);
    if (visibleTargets.length === 0 || viewport.width <= 0 || viewport.height <= 0) return;

    const pixelRatio = renderer.getPixelRatio();
    renderer.getDrawingBufferSize(this.drawingBufferSize);
    const targetWidth = Math.max(1, Math.ceil(this.drawingBufferSize.x));
    const targetHeight = Math.max(1, Math.ceil(this.drawingBufferSize.y));
    const maskViewport = {
      x: Math.round(viewport.x * pixelRatio),
      y: Math.round(viewport.y * pixelRatio),
      width: Math.max(1, Math.round(viewport.width * pixelRatio)),
      height: Math.max(1, Math.round(viewport.height * pixelRatio)),
    };
    this.setSize(targetWidth, targetHeight);

    const previousState = this.captureRendererState(renderer);
    const previousOverrideMaterial = scene.overrideMaterial;
    const visibilityRecords = this.applyTargetVisibility(scene, camera, visibleTargets);

    scene.overrideMaterial = this.maskMaterial;
    renderer.setRenderTarget(this.maskTarget);
    renderer.setViewport(maskViewport.x, maskViewport.y, maskViewport.width, maskViewport.height);
    renderer.setScissorTest(false);
    renderer.setClearColor(0x000000, 0);
    renderer.clear(true, true, true);
    renderer.render(scene, camera);
    scene.overrideMaterial = previousOverrideMaterial;
    this.restoreVisibility(visibilityRecords);

    this.compositeMaterial.uniforms.uMask.value = this.maskTarget.texture;
    this.compositeMaterial.uniforms.uDepth.value = this.maskDepthTexture;
    this.compositeMaterial.uniforms.uTexelSize.value.set(1 / targetWidth, 1 / targetHeight);
    this.compositeMaterial.uniforms.uUvOrigin.value.set(maskViewport.x / targetWidth, maskViewport.y / targetHeight);
    this.compositeMaterial.uniforms.uUvScale.value.set(maskViewport.width / targetWidth, maskViewport.height / targetHeight);
    this.compositeMaterial.uniforms.uOuterWidth.value = this.options.outerWidth * pixelRatio;
    this.compositeMaterial.uniforms.uInnerWidth.value = this.options.innerWidth * pixelRatio;
    this.compositeMaterial.uniforms.uNormalThreshold.value = this.options.normalThreshold;
    this.compositeMaterial.uniforms.uDepthThreshold.value = this.options.depthThreshold;
    this.compositeMaterial.uniforms.uInnerOpacity.value = this.options.innerOpacity;
    this.compositeMaterial.uniforms.uOuterOpacity.value = this.options.outerOpacity;
    renderer.setRenderTarget(previousState.renderTarget);
    renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
    renderer.setScissor(scissor.x, scissor.y, scissor.width, scissor.height);
    renderer.setScissorTest(true);
    renderer.autoClear = false;
    renderer.render(this.quadScene, this.quadCamera);

    this.restoreRendererState(renderer, previousState);
  }

  setSize(width: number, height: number): boolean {
    const nextWidth = Math.max(1, Math.floor(width));
    const nextHeight = Math.max(1, Math.floor(height));
    if (nextWidth === this.width && nextHeight === this.height) return false;
    this.width = nextWidth;
    this.height = nextHeight;
    this.maskTarget.setSize(this.width, this.height);
    return true;
  }

  getResourceSnapshot(): AnimeOutlinePassResources {
    return {
      maskTarget: this.maskTarget,
      maskMaterial: this.maskMaterial,
      compositeMaterial: this.compositeMaterial,
      quad: this.quad,
    };
  }

  dispose(): void {
    this.maskTarget.dispose();
    this.maskDepthTexture.dispose();
    this.maskMaterial.dispose();
    this.compositeMaterial.dispose();
    this.quad.geometry.dispose();
  }

  private captureRendererState(renderer: THREE.WebGLRenderer) {
    return {
      renderTarget: renderer.getRenderTarget(),
      viewport: renderer.getViewport(this.previousViewport).clone(),
      scissor: renderer.getScissor(this.previousScissor).clone(),
      scissorTest: renderer.getScissorTest(),
      clearColor: renderer.getClearColor(this.previousClearColor).clone(),
      clearAlpha: renderer.getClearAlpha(),
      autoClear: renderer.autoClear,
    };
  }

  private restoreRendererState(
    renderer: THREE.WebGLRenderer,
    state: ReturnType<AnimeOutlinePass["captureRendererState"]>,
  ): void {
    renderer.setRenderTarget(state.renderTarget);
    renderer.setViewport(state.viewport);
    renderer.setScissor(state.scissor);
    renderer.setScissorTest(state.scissorTest);
    renderer.setClearColor(state.clearColor, state.clearAlpha);
    renderer.autoClear = state.autoClear;
  }

  private applyTargetVisibility(
    scene: THREE.Scene,
    camera: THREE.Camera,
    targets: readonly THREE.Object3D[],
  ): Array<{ object: THREE.Object3D; visible: boolean }> {
    const keepVisible = new Set<THREE.Object3D>([scene, camera]);
    for (const target of targets) {
      target.traverse((object) => keepVisible.add(object));
      for (let object: THREE.Object3D | null = target; object; object = object.parent) keepVisible.add(object);
    }

    const records: Array<{ object: THREE.Object3D; visible: boolean }> = [];
    scene.traverse((object) => {
      records.push({ object, visible: object.visible });
      object.visible = object.visible && keepVisible.has(object);
    });
    return records;
  }

  private restoreVisibility(records: Array<{ object: THREE.Object3D; visible: boolean }>): void {
    for (const { object, visible } of records) object.visible = visible;
  }
}

function createCompositeMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uMask: { value: null },
      uDepth: { value: null },
      uTexelSize: { value: new THREE.Vector2(1, 1) },
      uUvOrigin: { value: new THREE.Vector2(0, 0) },
      uUvScale: { value: new THREE.Vector2(1, 1) },
      uOutlineColor: { value: outlineColor.clone() },
      uOuterWidth: { value: defaultOutlineOptions.outerWidth },
      uInnerWidth: { value: defaultOutlineOptions.innerWidth },
      uNormalThreshold: { value: defaultOutlineOptions.normalThreshold },
      uDepthThreshold: { value: defaultOutlineOptions.depthThreshold },
      uInnerOpacity: { value: defaultOutlineOptions.innerOpacity },
      uOuterOpacity: { value: defaultOutlineOptions.outerOpacity },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uMask;
      uniform sampler2D uDepth;
      uniform vec2 uTexelSize;
      uniform vec2 uUvOrigin;
      uniform vec2 uUvScale;
      uniform vec3 uOutlineColor;
      uniform float uOuterWidth;
      uniform float uInnerWidth;
      uniform float uNormalThreshold;
      uniform float uDepthThreshold;
      uniform float uInnerOpacity;
      uniform float uOuterOpacity;
      varying vec2 vUv;

      bool isInOutlineViewport(vec2 uv) {
        vec2 localUv = (uv - uUvOrigin) / uUvScale;
        return localUv.x >= 0.0 && localUv.x <= 1.0 && localUv.y >= 0.0 && localUv.y <= 1.0;
      }

      vec4 sampleMask(vec2 offset) {
        vec2 uv = uUvOrigin + vUv * uUvScale + offset;
        if (!isInOutlineViewport(uv)) return vec4(0.0);
        return texture2D(uMask, uv);
      }

      vec3 decodeNormal(vec4 encoded) {
        return normalize(encoded.rgb * 2.0 - 1.0);
      }

      float normalDelta(vec4 centerData, vec4 neighborData) {
        return 1.0 - clamp(dot(decodeNormal(centerData), decodeNormal(neighborData)), -1.0, 1.0);
      }

      void main() {
        vec4 centerData = sampleMask(vec2(0.0));
        float centerMask = step(0.08, centerData.a);

        vec2 outerStep = uTexelSize * uOuterWidth;
        float outerNeighbor = 0.0;
        outerNeighbor = max(outerNeighbor, sampleMask(vec2(outerStep.x, 0.0)).a);
        outerNeighbor = max(outerNeighbor, sampleMask(vec2(-outerStep.x, 0.0)).a);
        outerNeighbor = max(outerNeighbor, sampleMask(vec2(0.0, outerStep.y)).a);
        outerNeighbor = max(outerNeighbor, sampleMask(vec2(0.0, -outerStep.y)).a);
        outerNeighbor = max(outerNeighbor, sampleMask(vec2(outerStep.x, outerStep.y) * 0.72).a);
        outerNeighbor = max(outerNeighbor, sampleMask(vec2(-outerStep.x, outerStep.y) * 0.72).a);
        outerNeighbor = max(outerNeighbor, sampleMask(vec2(outerStep.x, -outerStep.y) * 0.72).a);
        outerNeighbor = max(outerNeighbor, sampleMask(vec2(-outerStep.x, -outerStep.y) * 0.72).a);
        float outerEdge = (1.0 - centerMask) * step(0.08, outerNeighbor);

        vec2 innerStep = uTexelSize * uInnerWidth;
        float maxNormalDelta = 0.0;

        vec4 right = sampleMask(vec2(innerStep.x, 0.0));
        float rightMask = step(0.08, right.a);
        maxNormalDelta = max(maxNormalDelta, normalDelta(centerData, right) * rightMask);

        vec4 left = sampleMask(vec2(-innerStep.x, 0.0));
        float leftMask = step(0.08, left.a);
        maxNormalDelta = max(maxNormalDelta, normalDelta(centerData, left) * leftMask);

        vec4 up = sampleMask(vec2(0.0, innerStep.y));
        float upMask = step(0.08, up.a);
        maxNormalDelta = max(maxNormalDelta, normalDelta(centerData, up) * upMask);

        vec4 down = sampleMask(vec2(0.0, -innerStep.y));
        float downMask = step(0.08, down.a);
        maxNormalDelta = max(maxNormalDelta, normalDelta(centerData, down) * downMask);

        vec4 upRight = sampleMask(vec2(innerStep.x, innerStep.y) * 0.72);
        float upRightMask = step(0.08, upRight.a);
        maxNormalDelta = max(maxNormalDelta, normalDelta(centerData, upRight) * upRightMask);

        vec4 upLeft = sampleMask(vec2(-innerStep.x, innerStep.y) * 0.72);
        float upLeftMask = step(0.08, upLeft.a);
        maxNormalDelta = max(maxNormalDelta, normalDelta(centerData, upLeft) * upLeftMask);

        vec4 downRight = sampleMask(vec2(innerStep.x, -innerStep.y) * 0.72);
        float downRightMask = step(0.08, downRight.a);
        maxNormalDelta = max(maxNormalDelta, normalDelta(centerData, downRight) * downRightMask);

        vec4 downLeft = sampleMask(vec2(-innerStep.x, -innerStep.y) * 0.72);
        float downLeftMask = step(0.08, downLeft.a);
        maxNormalDelta = max(maxNormalDelta, normalDelta(centerData, downLeft) * downLeftMask);

        float normalEdge = smoothstep(uNormalThreshold, uNormalThreshold + 0.16, maxNormalDelta);
        float innerEdge = centerMask * normalEdge;
        float edgeAlpha = max(outerEdge * uOuterOpacity, innerEdge * uInnerOpacity);
        if (edgeAlpha <= 0.01) discard;
        gl_FragColor = vec4(uOutlineColor, edgeAlpha);
      }
    `,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false,
  });
}
