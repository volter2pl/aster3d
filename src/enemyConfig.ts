import { Vector3 } from "@babylonjs/core/Maths/math.vector";

// Fallback offsets for `src/assets/models/spacecraft.glb` when helper nodes are missing.
export const ENEMY_MODEL_SCALE = 7.8;
export const ENEMY_MODEL_ROTATION = Vector3.Zero();
export const ENEMY_WEAPON_MOUNT_OFFSETS = [
  new Vector3(-0.82, -0.1, -1.82),
  new Vector3(0.82, -0.1, -1.82),
];
export const ENEMY_FRONT_ENGINE_LIGHT_OFFSETS = [
  new Vector3(-0.56, -0.02, 1.36),
  new Vector3(0.56, -0.02, 1.36),
];
export const ENEMY_REAR_ENGINE_LIGHT_OFFSETS = [
  new Vector3(-0.78, -0.04, -1.96),
  new Vector3(0.78, -0.04, -1.96),
];
export const ENEMY_REAR_EXHAUST_LIGHT_OFFSETS = [
  new Vector3(-0.54, -0.04, -1.52),
  new Vector3(0.54, -0.04, -1.52),
];
