import type { InstantiatedEntries } from "@babylonjs/core/assetContainer";
import { Quaternion } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { LoadedSpaceStationAsset } from "./spaceStationAsset";

export const SPACE_STATION_BLOCK_ROTATION_SPEED = 0.04;

const SPACE_STATION_DOCK_NODE_NAMES = ["dock_1", "dock_2"];
const SPACE_STATION_ROTATING_NODE_NAMES = ["Blocks01_block_0"];

export type SpaceStationVisual = {
  collisionMeshes: AbstractMesh[];
  dispose: () => void;
  dockNodes: TransformNode[];
  root: TransformNode;
  rotatingNodes: TransformNode[];
};

export function instantiateSpaceStationVisual(
  scene: Scene,
  parent: TransformNode,
  asset: LoadedSpaceStationAsset,
  rootName: string,
): SpaceStationVisual {
  const root = new TransformNode(rootName, scene);
  root.parent = parent;

  const instance = asset.prefab.instantiateModelsToScene(
    (sourceName) => `${sourceName}-${performance.now()}`,
    false,
    { doNotInstantiate: true },
  );

  for (const node of instance.rootNodes) {
    node.parent = root;
  }

  for (const mesh of root.getChildMeshes()) {
    const materialEntry = [...asset.materialsByMeshName.entries()].find(([sourceName]) =>
      hasImportedNodeName(mesh.name, sourceName)
    );
    mesh.material = materialEntry?.[1] ?? null;
  }

  const childTransformNodes = root.getChildTransformNodes(false);

  return {
    collisionMeshes: root.getChildMeshes().filter((mesh) => hasRenderableGeometry(mesh)),
    dispose: () => disposeSpaceStationVisual(root, instance),
    dockNodes: SPACE_STATION_DOCK_NODE_NAMES
      .map((dockName) => childTransformNodes.find((node) => hasImportedNodeName(node.name, dockName)) ?? null)
      .filter((node): node is TransformNode => node !== null),
    root,
    rotatingNodes: childTransformNodes.filter((node) =>
      SPACE_STATION_ROTATING_NODE_NAMES.some((sourceName) => hasImportedNodeName(node.name, sourceName)),
    ),
  };
}

export function updateSpaceStationRotatingNodes(rotatingNodes: TransformNode[], dt: number): void {
  for (const rotatingNode of rotatingNodes) {
    const currentRotation = rotatingNode.rotationQuaternion ?? Quaternion.FromEulerAngles(
      rotatingNode.rotation.x,
      rotatingNode.rotation.y,
      rotatingNode.rotation.z,
    );
    const deltaRotation = Quaternion.FromEulerAngles(0, 0, SPACE_STATION_BLOCK_ROTATION_SPEED * dt);
    rotatingNode.rotationQuaternion = currentRotation.multiply(deltaRotation).normalize();
  }
}

function disposeSpaceStationVisual(root: TransformNode, instance: InstantiatedEntries): void {
  instance.dispose();
  root.dispose();
}

function hasImportedNodeName(nodeName: string, sourceName: string): boolean {
  return nodeName === sourceName || nodeName.startsWith(`${sourceName}-`);
}

function hasRenderableGeometry(mesh: AbstractMesh): boolean {
  return typeof mesh.getTotalVertices === "function" && mesh.getTotalVertices() > 0;
}
