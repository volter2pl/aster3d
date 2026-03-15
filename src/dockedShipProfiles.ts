import type { Scene } from "@babylonjs/core/scene";
import { loadDockedShipAsset, type LoadedDockedShipAsset } from "./dockedShipAsset";

export type DockedShipCameraProfile = {
  distancePadding: number;
  distanceScale: number;
  liftMin: number;
  liftScale: number;
  minDistance: number;
  targetExtent: number;
  targetLiftMin: number;
  targetLiftScale: number;
};

export type DockedShipAnimationProfile = {
  animationFps: number;
  canopyOpenRangeFrames: {
    end: number;
    start: number;
  };
  canopyTargetPrefixes: string[];
  engineTargetPrefixes: string[];
};

export type DockedShipAssetLoader = (scene: Scene) => Promise<LoadedDockedShipAsset>;

export type DockedShipProfile = {
  camera: DockedShipCameraProfile;
  id: string;
  animation?: DockedShipAnimationProfile;
  loadAsset: DockedShipAssetLoader;
};

export const GOLDEN_VECTOR_DOCKED_SHIP_PROFILE: DockedShipProfile = {
  id: "golden-vector",
  loadAsset: loadDockedShipAsset,
  camera: {
    distancePadding: 1.5,
    distanceScale: 1.28,
    liftMin: 4.8,
    liftScale: 0.72,
    minDistance: 12,
    targetExtent: 11.5,
    targetLiftMin: 0.35,
    targetLiftScale: 0.02,
  },
  animation: {
    animationFps: 60,
    canopyOpenRangeFrames: {
      start: 160,
      end: 300,
    },
    canopyTargetPrefixes: ["open01", "open02"],
    engineTargetPrefixes: ["motor", "hidra", "Base hidra"],
  },
};
