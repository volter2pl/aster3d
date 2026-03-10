import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import {
  ENEMY_FRONT_ENGINE_LIGHT_OFFSETS,
  ENEMY_MODEL_ROTATION,
  ENEMY_MODEL_SCALE,
  ENEMY_REAR_EXHAUST_LIGHT_OFFSETS,
  ENEMY_REAR_ENGINE_LIGHT_OFFSETS,
  ENEMY_WEAPON_MOUNT_OFFSETS,
} from "./enemyConfig";
import { LoadedSpacecraftAsset } from "./spacecraftAsset";

export type EnemyEngineGlow = {
  mesh: ReturnType<typeof MeshBuilder.CreateSphere>;
  material: StandardMaterial;
  phase: number;
  baseScale: number;
  throttleResponse: number;
};

export type EnemyPresentation = {
  markerMeshes: Mesh[];
  visualRoot: TransformNode;
  weaponMounts: TransformNode[];
  engineGlows: EnemyEngineGlow[];
  dispose: () => void;
};

type EnemyPresentationOptions = {
  includeMarkers?: boolean;
  markerVisibility?: boolean;
};

type EnemyLocatorPositions = {
  rearEngine: Vector3[];
  rearExhaust: Vector3[];
  frontEngine: Vector3[];
  weaponMounts: Vector3[];
};

const WEAPON_NODE_NAMES = ["weapon_left", "weapon_right"] as const;
const FRONT_ENGINE_NODE_NAMES = ["engine_left_front", "engine_right_front"] as const;
const REAR_ENGINE_NODE_NAMES = ["engine_left_rear", "engine_right_rear"] as const;
const REAR_EXHAUST_NODE_NAMES = ["exhaust_left_rear", "exhaust_right_rear"] as const;

export function createEnemyPresentation(
  scene: Scene,
  root: TransformNode,
  asset: LoadedSpacecraftAsset | null,
  options: EnemyPresentationOptions = {},
): EnemyPresentation {
  const disposeCallbacks: Array<() => void> = [];
  const markerMeshes: Mesh[] = [];
  const visualRoot = new TransformNode(`enemy-visual-${performance.now()}`, scene);
  visualRoot.parent = root;
  visualRoot.rotation.copyFrom(ENEMY_MODEL_ROTATION);
  visualRoot.scaling.setAll(ENEMY_MODEL_SCALE);

  if (asset) {
    const instance = asset.prefab.instantiateModelsToScene(
      (sourceName) => `${sourceName}-${performance.now()}`,
      false,
      { doNotInstantiate: true },
    );

    for (const node of instance.rootNodes) {
      node.parent = visualRoot;
    }
    for (const mesh of visualRoot.getChildMeshes()) {
      mesh.material = asset.material;
    }
  } else {
    const fallbackMaterials = createProceduralEnemyVisual(scene, visualRoot);
    disposeCallbacks.push(() => {
      for (const material of fallbackMaterials) {
        material.dispose();
      }
    });
  }

  const locatorPositions = asset
    ? resolveEnemyLocatorPositions(root, visualRoot)
    : {
        weaponMounts: ENEMY_WEAPON_MOUNT_OFFSETS,
        frontEngine: ENEMY_FRONT_ENGINE_LIGHT_OFFSETS,
        rearEngine: ENEMY_REAR_ENGINE_LIGHT_OFFSETS,
        rearExhaust: ENEMY_REAR_EXHAUST_LIGHT_OFFSETS,
      };

  const weaponMounts = createEnemyWeaponMounts(scene, root, locatorPositions.weaponMounts);
  const engineGlows = createEnemyEngineGlows(
    scene,
    root,
    locatorPositions.frontEngine,
    locatorPositions.rearEngine,
    locatorPositions.rearExhaust,
  );
  disposeCallbacks.push(() => {
    for (const glow of engineGlows) {
      glow.material.dispose();
    }
  });

  if (options.includeMarkers) {
    const markerMaterials = createEnemyMarkerGroup(
      scene,
      root,
      markerMeshes,
      locatorPositions.weaponMounts,
      new Color3(0.34, 0.94, 1),
      0.18,
      "weapon",
    );
    markerMaterials.push(
      ...createEnemyMarkerGroup(
        scene,
        root,
        markerMeshes,
        locatorPositions.frontEngine,
        new Color3(0.34, 0.58, 1),
        0.15,
        "front-engine",
      ),
      ...createEnemyMarkerGroup(
        scene,
        root,
        markerMeshes,
        locatorPositions.rearEngine,
        new Color3(1, 0.56, 0.22),
        0.2,
        "rear-engine",
      ),
      ...createEnemyMarkerGroup(
        scene,
        root,
        markerMeshes,
        locatorPositions.rearExhaust,
        new Color3(1, 0.32, 0.18),
        0.16,
        "rear-exhaust",
      ),
    );
    const markersVisible = options.markerVisibility ?? false;
    for (const marker of markerMeshes) {
      marker.setEnabled(markersVisible);
    }
    disposeCallbacks.push(() => {
      for (const material of markerMaterials) {
        material.dispose();
      }
    });
  }

  return {
    markerMeshes,
    visualRoot,
    weaponMounts,
    engineGlows,
    dispose: () => {
      for (const dispose of disposeCallbacks) {
        dispose();
      }
    },
  };
}

export function updateEnemyEngineGlows(engineGlows: EnemyEngineGlow[], engineThrottle: number, timeMs: number): void {
  const glowPulseTime = timeMs * 0.01;
  for (const glow of engineGlows) {
    const pulse = 0.9 + Math.sin(glowPulseTime + glow.phase) * 0.14;
    const throttleScale = 1 + engineThrottle * glow.throttleResponse;
    glow.mesh.scaling.setAll(glow.baseScale * throttleScale * pulse);
    glow.material.alpha = 0.72 + engineThrottle * 0.18;
  }
}

export function getEnemyWeaponForward(root: TransformNode, mounts: TransformNode[]): Vector3 {
  if (mounts.length === 0) {
    return root.getDirection(Vector3.Forward(root.getScene().useRightHandedSystem)).normalize();
  }

  const averageMountPosition = new Vector3(0, 0, 0);
  for (const mount of mounts) {
    averageMountPosition.addInPlace(mount.getAbsolutePosition());
  }
  averageMountPosition.scaleInPlace(1 / mounts.length);

  const forward = averageMountPosition.subtract(root.getAbsolutePosition());
  if (forward.lengthSquared() < 0.0001) {
    return root.getDirection(Vector3.Forward(root.getScene().useRightHandedSystem)).normalize();
  }

  return forward.normalize();
}

function createProceduralEnemyVisual(scene: Scene, root: TransformNode): StandardMaterial[] {
  const hullMaterial = new StandardMaterial(`enemy-hull-${performance.now()}`, scene);
  hullMaterial.diffuseColor = new Color3(0.2, 0.23, 0.3);
  hullMaterial.emissiveColor = new Color3(0.04, 0.05, 0.08);
  hullMaterial.specularColor = new Color3(0.08, 0.08, 0.08);

  const accentMaterial = new StandardMaterial(`enemy-accent-${performance.now()}`, scene);
  accentMaterial.disableLighting = true;
  accentMaterial.emissiveColor = new Color3(1, 0.16, 0.12);
  accentMaterial.diffuseColor = new Color3(0.95, 0.22, 0.18);

  const engineMaterial = new StandardMaterial(`enemy-engine-${performance.now()}`, scene);
  engineMaterial.disableLighting = true;
  engineMaterial.emissiveColor = new Color3(0.26, 0.88, 1);
  engineMaterial.diffuseColor = new Color3(0.16, 0.56, 0.88);

  const hull = MeshBuilder.CreateBox(
    `enemy-hull-${performance.now()}`,
    { width: 1.35, height: 0.72, depth: 2.9 },
    scene,
  );
  hull.parent = root;
  hull.position.z = 0.08;
  hull.material = hullMaterial;

  const canopy = MeshBuilder.CreateBox(
    `enemy-canopy-${performance.now()}`,
    { width: 0.76, height: 0.24, depth: 0.78 },
    scene,
  );
  canopy.parent = root;
  canopy.position.set(0, 0.34, 0.86);
  canopy.material = accentMaterial;

  const nose = MeshBuilder.CreateCylinder(
    `enemy-nose-${performance.now()}`,
    { height: 1.28, diameterTop: 0.12, diameterBottom: 0.72, tessellation: 4 },
    scene,
  );
  nose.parent = root;
  nose.rotation.x = Math.PI * 0.5;
  nose.position.set(0, 0.02, 2.02);
  nose.material = accentMaterial;

  const leftWing = MeshBuilder.CreateBox(
    `enemy-wing-l-${performance.now()}`,
    { width: 1.9, height: 0.12, depth: 0.9 },
    scene,
  );
  leftWing.parent = root;
  leftWing.position.set(-1.55, -0.02, -0.2);
  leftWing.rotation.z = 0.1;
  leftWing.material = hullMaterial;

  const rightWing = MeshBuilder.CreateBox(
    `enemy-wing-r-${performance.now()}`,
    { width: 1.9, height: 0.12, depth: 0.9 },
    scene,
  );
  rightWing.parent = root;
  rightWing.position.set(1.55, -0.02, -0.2);
  rightWing.rotation.z = -0.1;
  rightWing.material = hullMaterial;

  const leftPylon = MeshBuilder.CreateBox(
    `enemy-pylon-l-${performance.now()}`,
    { width: 0.28, height: 0.3, depth: 2.1 },
    scene,
  );
  leftPylon.parent = root;
  leftPylon.position.set(-1.02, 0, 0.08);
  leftPylon.material = hullMaterial;

  const rightPylon = MeshBuilder.CreateBox(
    `enemy-pylon-r-${performance.now()}`,
    { width: 0.28, height: 0.3, depth: 2.1 },
    scene,
  );
  rightPylon.parent = root;
  rightPylon.position.set(1.02, 0, 0.08);
  rightPylon.material = hullMaterial;

  const dorsalFin = MeshBuilder.CreateBox(
    `enemy-fin-${performance.now()}`,
    { width: 0.18, height: 0.78, depth: 1.1 },
    scene,
  );
  dorsalFin.parent = root;
  dorsalFin.position.set(0, 0.54, -0.92);
  dorsalFin.material = hullMaterial;

  const gunLeft = MeshBuilder.CreateCylinder(
    `enemy-gun-l-${performance.now()}`,
    { height: 1.05, diameter: 0.16, tessellation: 6 },
    scene,
  );
  gunLeft.parent = root;
  gunLeft.rotation.x = Math.PI * 0.5;
  gunLeft.position.set(-0.86, -0.12, 1.58);
  gunLeft.material = accentMaterial;

  const gunRight = MeshBuilder.CreateCylinder(
    `enemy-gun-r-${performance.now()}`,
    { height: 1.05, diameter: 0.16, tessellation: 6 },
    scene,
  );
  gunRight.parent = root;
  gunRight.rotation.x = Math.PI * 0.5;
  gunRight.position.set(0.86, -0.12, 1.58);
  gunRight.material = accentMaterial;

  const engineLeft = MeshBuilder.CreateCylinder(
    `enemy-engine-l-${performance.now()}`,
    { height: 0.82, diameter: 0.52, tessellation: 8 },
    scene,
  );
  engineLeft.parent = root;
  engineLeft.rotation.x = Math.PI * 0.5;
  engineLeft.position.set(-0.84, -0.02, -1.88);
  engineLeft.material = engineMaterial;

  const engineRight = MeshBuilder.CreateCylinder(
    `enemy-engine-r-${performance.now()}`,
    { height: 0.82, diameter: 0.52, tessellation: 8 },
    scene,
  );
  engineRight.parent = root;
  engineRight.rotation.x = Math.PI * 0.5;
  engineRight.position.set(0.84, -0.02, -1.88);
  engineRight.material = engineMaterial;

  return [hullMaterial, accentMaterial, engineMaterial];
}

function createEnemyWeaponMounts(scene: Scene, root: TransformNode, positions: Vector3[]): TransformNode[] {
  return positions.map((position, index) => {
    const mount = new TransformNode(`enemy-weapon-mount-${index}-${performance.now()}`, scene);
    mount.parent = root;
    mount.position.copyFrom(position);
    return mount;
  });
}

function createEnemyEngineGlows(
  scene: Scene,
  root: TransformNode,
  frontEnginePositions: Vector3[],
  rearEnginePositions: Vector3[],
  rearExhaustPositions: Vector3[],
): EnemyEngineGlow[] {
  const frontColor = new Color3(0.32, 0.88, 1);
  const rearColor = new Color3(1, 0.32, 0.18);
  const glows: EnemyEngineGlow[] = [];

  for (const [index, position] of frontEnginePositions.entries()) {
    glows.push(
      createEnemyEngineGlow(
        scene,
        root,
        `enemy-engine-front-${index}-${performance.now()}`,
        position,
        frontColor,
        0.2,
        index * 0.7,
        0.22,
      ),
    );
  }

  for (const [index, position] of rearEnginePositions.entries()) {
    glows.push(
      createEnemyEngineGlow(
        scene,
        root,
        `enemy-engine-rear-${index}-${performance.now()}`,
        position,
        rearColor,
        0.32,
        1.4 + index * 0.7,
        0.46,
      ),
    );
  }

  for (const [index, position] of rearExhaustPositions.entries()) {
    glows.push(
      createEnemyEngineGlow(
        scene,
        root,
        `enemy-exhaust-rear-${index}-${performance.now()}`,
        position,
        rearColor,
        0.16,
        2.1 + index * 0.7,
        0.18,
      ),
    );
  }

  return glows;
}

function createEnemyEngineGlow(
  scene: Scene,
  root: TransformNode,
  name: string,
  position: Vector3,
  color: Color3,
  diameter: number,
  phase: number,
  throttleResponse: number,
): EnemyEngineGlow {
  const material = new StandardMaterial(`${name}-mat`, scene);
  material.disableLighting = true;
  material.emissiveColor = color;
  material.diffuseColor = color.scale(0.45);
  material.alpha = 0.9;

  const mesh = MeshBuilder.CreateSphere(name, { diameter, segments: 8 }, scene);
  mesh.parent = root;
  mesh.position.copyFrom(position);
  mesh.material = material;
  mesh.isPickable = false;

  return {
    mesh,
    material,
    phase,
    baseScale: 1,
    throttleResponse,
  };
}

function resolveEnemyLocatorPositions(root: TransformNode, visualRoot: TransformNode): EnemyLocatorPositions {
  const nodes = visualRoot.getChildTransformNodes(false);
  return {
    weaponMounts: resolveNamedLocatorPositions(root, nodes, WEAPON_NODE_NAMES, ENEMY_WEAPON_MOUNT_OFFSETS),
    frontEngine: resolveNamedLocatorPositions(root, nodes, FRONT_ENGINE_NODE_NAMES, ENEMY_FRONT_ENGINE_LIGHT_OFFSETS),
    rearEngine: resolveNamedLocatorPositions(root, nodes, REAR_ENGINE_NODE_NAMES, ENEMY_REAR_ENGINE_LIGHT_OFFSETS),
    rearExhaust: resolveNamedLocatorPositions(root, nodes, REAR_EXHAUST_NODE_NAMES, ENEMY_REAR_EXHAUST_LIGHT_OFFSETS),
  };
}

function resolveNamedLocatorPositions(
  root: TransformNode,
  nodes: TransformNode[],
  names: readonly string[],
  fallbackOffsets: Vector3[],
): Vector3[] {
  return names.map((name, index) => {
    const node = findNamedTransformNode(nodes, name);
    if (!node) {
      return fallbackOffsets[index].clone();
    }

    return getNodePositionInRootSpace(root, node);
  });
}

function findNamedTransformNode(nodes: TransformNode[], targetName: string): TransformNode | null {
  const normalizedTarget = targetName.toLowerCase();
  return (
    nodes.find((node) => {
      const normalizedName = node.name.toLowerCase();
      return normalizedName === normalizedTarget || normalizedName.startsWith(`${normalizedTarget}-`);
    }) ?? null
  );
}

function getNodePositionInRootSpace(root: TransformNode, node: TransformNode): Vector3 {
  root.computeWorldMatrix(true);
  node.computeWorldMatrix(true);

  const inverseRootWorld = Matrix.Invert(root.getWorldMatrix());
  return Vector3.TransformCoordinates(node.getAbsolutePosition(), inverseRootWorld);
}

function createEnemyMarkerGroup(
  scene: Scene,
  root: TransformNode,
  markerMeshes: Mesh[],
  offsets: Vector3[],
  color: Color3,
  diameter: number,
  name: string,
): StandardMaterial[] {
  const materials: StandardMaterial[] = [];
  for (const [index, offset] of offsets.entries()) {
    const material = new StandardMaterial(`enemy-marker-${name}-${index}-mat`, scene);
    material.disableLighting = true;
    material.emissiveColor = color;
    material.diffuseColor = color.scale(0.48);
    materials.push(material);

    const marker = MeshBuilder.CreateSphere(
      `enemy-marker-${name}-${index}`,
      { diameter, segments: 8 },
      scene,
    );
    marker.parent = root;
    marker.position.copyFrom(offset);
    marker.material = material;
    marker.isPickable = false;
    markerMeshes.push(marker);
  }

  return materials;
}
