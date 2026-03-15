import type { InstantiatedEntries } from "@babylonjs/core/assetContainer";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { DockedShipAnimationStrategyFactory } from "./dockedShipAnimationStrategyFactory";
import type { DockedShipAnimationStrategy } from "./dockedShipAnimationStrategies";
import type { LoadedDockedShipAsset } from "./dockedShipAsset";
import type { DockedShipProfile } from "./dockedShipProfiles";

export type DockedShipRig = {
  animationStrategy: DockedShipAnimationStrategy;
  dispose: () => void;
  root: TransformNode;
  visualSize: Vector3;
};

export class DockedShipProfileAdapter {
  public constructor(
    private readonly scene: Scene,
    private readonly shipRoot: TransformNode,
    private readonly profile: DockedShipProfile,
  ) {}

  public adapt(asset: LoadedDockedShipAsset): DockedShipRig {
    const root = new TransformNode("docked-ship-visual-root", this.scene);
    const modelRoot = new TransformNode("docked-ship-model-root", this.scene);
    modelRoot.parent = root;

    const instance = asset.prefab.instantiateModelsToScene(
      (sourceName) => `${sourceName}-${performance.now()}`,
      false,
      { doNotInstantiate: true },
    );

    for (const node of instance.rootNodes) {
      node.parent = modelRoot;
    }

    for (const mesh of root.getChildMeshes()) {
      const materialEntry = [...asset.materialsByMeshName.entries()].find(([sourceName]) =>
        hasImportedNodeName(mesh.name, sourceName)
      );
      mesh.material = materialEntry?.[1] ?? null;
    }

    const visualSize = fitToProfileExtent(modelRoot, this.profile.camera.targetExtent);
    const animationStrategy = DockedShipAnimationStrategyFactory.create(instance.animationGroups[0] ?? null, this.profile.animation);

    root.parent = this.shipRoot;
    root.setEnabled(false);

    return {
      animationStrategy,
      dispose: () => disposeRig(root, instance, animationStrategy),
      root,
      visualSize,
    };
  }
}

function disposeRig(
  root: TransformNode,
  instance: InstantiatedEntries,
  animationStrategy: DockedShipAnimationStrategy,
): void {
  animationStrategy.dispose();
  instance.dispose();
  root.dispose();
}

function fitToProfileExtent(modelRoot: TransformNode, targetExtent: number): Vector3 {
  const initialBounds = getHierarchyBounds(modelRoot);
  if (!initialBounds) {
    return new Vector3(targetExtent, 4.2, targetExtent);
  }

  const initialSize = initialBounds.max.subtract(initialBounds.min);
  const initialMaxExtent = Math.max(initialSize.x, initialSize.y, initialSize.z, 0.001);
  modelRoot.scaling.setAll(targetExtent / initialMaxExtent);

  const scaledBounds = getHierarchyBounds(modelRoot);
  if (!scaledBounds) {
    return new Vector3(targetExtent, 4.2, targetExtent);
  }

  const scaledCenter = scaledBounds.min.add(scaledBounds.max).scale(0.5);
  modelRoot.position.subtractInPlace(scaledCenter);

  const centeredBounds = getHierarchyBounds(modelRoot);
  if (!centeredBounds) {
    return new Vector3(targetExtent, 4.2, targetExtent);
  }

  return centeredBounds.max.subtract(centeredBounds.min);
}

function getHierarchyBounds(root: TransformNode): { max: Vector3; min: Vector3 } | null {
  const min = new Vector3(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY);
  const max = new Vector3(Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY);

  for (const mesh of root.getChildMeshes()) {
    if (!hasRenderableGeometry(mesh)) {
      continue;
    }

    mesh.computeWorldMatrix(true);
    mesh.refreshBoundingInfo({});
    const bounds = mesh.getBoundingInfo().boundingBox;
    min.minimizeInPlace(bounds.minimumWorld);
    max.maximizeInPlace(bounds.maximumWorld);
  }

  if (!Number.isFinite(min.x) || !Number.isFinite(max.x)) {
    return null;
  }

  return { min, max };
}

function hasImportedNodeName(nodeName: string, sourceName: string): boolean {
  return nodeName === sourceName || nodeName.startsWith(`${sourceName}-`);
}

function hasRenderableGeometry(mesh: AbstractMesh): boolean {
  return typeof mesh.getTotalVertices === "function" && mesh.getTotalVertices() > 0;
}
