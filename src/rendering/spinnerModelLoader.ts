import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export type SpinnerModelAssetKey = "spinner2" | "spinner33" | "spinner44" | "spinner5";

export type SpinnerModelAsset = {
  key: SpinnerModelAssetKey;
  url: string;
  rotationX: number;
  outline: boolean;
};

const baseUrl = import.meta.env.BASE_URL;

export const spinnerModelAssets: Record<SpinnerModelAssetKey, SpinnerModelAsset> = {
  spinner2: {
    key: "spinner2",
    url: `${baseUrl}assets/models/spiner2.glb`,
    rotationX: -Math.PI / 2,
    outline: true,
  },
  spinner33: {
    key: "spinner33",
    url: `${baseUrl}assets/models/spiner33.glb`,
    rotationX: -Math.PI / 2,
    outline: true,
  },
  spinner44: {
    key: "spinner44",
    url: `${baseUrl}assets/models/spiner44.glb`,
    rotationX: -Math.PI / 2,
    outline: true,
  },
  spinner5: {
    key: "spinner5",
    url: `${baseUrl}assets/models/spiner5.glb`,
    rotationX: -Math.PI / 2,
    outline: true,
  },
};

export type LoadedSpinnerModel = {
  asset: SpinnerModelAsset;
  source: THREE.Group;
};

export class SpinnerModelLoader {
  private readonly cache = new Map<SpinnerModelAssetKey, Promise<LoadedSpinnerModel>>();
  private readonly gltfLoader = new GLTFLoader();

  load(assetKey: SpinnerModelAssetKey): Promise<LoadedSpinnerModel> {
    const cached = this.cache.get(assetKey);
    if (cached) return cached;

    const asset = spinnerModelAssets[assetKey];
    const request = this.gltfLoader.loadAsync(asset.url).then((gltf) => ({ asset, source: gltf.scene }));
    this.cache.set(assetKey, request);
    request.catch(() => this.cache.delete(assetKey));
    return request;
  }
}

export function isSpinnerModelAssetKey(value: string | undefined): value is SpinnerModelAssetKey {
  return value === "spinner2" || value === "spinner33" || value === "spinner44" || value === "spinner5";
}
