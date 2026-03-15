import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { PreviewFactoryContext, PreviewHandle } from "../objectPreviewTypes";
import { instantiateSpaceStationVisual, updateSpaceStationRotatingNodes } from "../spaceStationPresentation";
import { loadSpaceStationAsset } from "../spaceStationAsset";

const PREVIEW_BASE_TARGET_EXTENT = 44;

export async function createBasePreview(context: PreviewFactoryContext): Promise<PreviewHandle> {
  context.root.rotation.y = Math.PI * 0.14;

  const shieldMaterial = new StandardMaterial("preview-base-shield-mat", context.scene);
  shieldMaterial.disableLighting = true;
  shieldMaterial.emissiveColor = new Color3(0.46, 0.62, 0.92);
  shieldMaterial.diffuseColor = new Color3(0.14, 0.2, 0.38);
  shieldMaterial.specularColor = Color3.Black();
  shieldMaterial.alpha = 0.13;
  shieldMaterial.backFaceCulling = false;

  const shield = MeshBuilder.CreateSphere("preview-base-shield", { diameter: 92 * 2, segments: 20 }, context.scene);
  shield.parent = context.root;
  shield.material = shieldMaterial;

  let asset = null;
  let importedRoot: TransformNode | null = null;
  let importedVisualDispose: (() => void) | null = null;
  let rotatingNodes: TransformNode[] = [];
  let ringsEnabled = true;
  let shieldEnabled = true;
  let spinEnabled = true;
  let fallbackHandle: PreviewHandle | null = null;

  try {
    asset = await loadSpaceStationAsset(context.scene);
    const stationVisual = instantiateSpaceStationVisual(context.scene, context.root, asset, "preview-base-station-root");
    importedRoot = stationVisual.root;
    importedVisualDispose = stationVisual.dispose;
    rotatingNodes = stationVisual.rotatingNodes;
    fitImportedStation(importedRoot, PREVIEW_BASE_TARGET_EXTENT);
  } catch (error) {
    console.warn("Failed to load station preview model, using procedural fallback.", error);
    fallbackHandle = createFallbackBasePreview(context);
  }

  return {
    actions: () => [
      { id: "spin", label: "Spin", kind: "toggle", active: spinEnabled },
      { id: "rings", label: "Rings", kind: "toggle", active: ringsEnabled },
      { id: "shield", label: "Shield", kind: "toggle", active: shieldEnabled },
    ],
    invoke: (actionId, nextActive) => {
      if (actionId === "spin") {
        spinEnabled = nextActive ?? !spinEnabled;
        return;
      }

      if (actionId === "rings") {
        ringsEnabled = nextActive ?? !ringsEnabled;
        return;
      }

      if (actionId !== "shield") {
        fallbackHandle?.invoke(actionId, nextActive);
        return;
      }

      shieldEnabled = nextActive ?? !shieldEnabled;
      shield.setEnabled(shieldEnabled);
    },
    update: (dt, timeMs) => {
      fallbackHandle?.update(dt, timeMs);
      if (importedRoot && spinEnabled) {
        context.root.rotation.y += dt * 0.08;
        context.root.rotation.x = Math.sin(timeMs * 0.00018) * 0.03;
        context.root.position.y = Math.sin(timeMs * 0.00042) * 0.5;
      }
      if (ringsEnabled && rotatingNodes.length > 0) {
        updateSpaceStationRotatingNodes(rotatingNodes, dt);
      }
    },
    dispose: () => {
      fallbackHandle?.dispose();
      importedVisualDispose?.();
      asset?.dispose();
      shield.dispose();
      shieldMaterial.dispose();
      context.root.rotation.setAll(0);
      context.root.position.copyFrom(Vector3.Zero());
    },
  };
}

function createFallbackBasePreview(context: PreviewFactoryContext): PreviewHandle {
  context.root.scaling.setAll(0.12);

  const materials: StandardMaterial[] = [];
  const meshes: Mesh[] = [];

  const trackMaterial = (material: StandardMaterial): StandardMaterial => {
    materials.push(material);
    return material;
  };

  const hullMaterial = trackMaterial(new StandardMaterial("preview-base-hull-mat", context.scene));
  hullMaterial.diffuseColor = new Color3(0.36, 0.37, 0.43);
  hullMaterial.emissiveColor = new Color3(0.05, 0.05, 0.08);
  hullMaterial.specularColor = new Color3(0.1, 0.1, 0.1);

  const accentMaterial = trackMaterial(new StandardMaterial("preview-base-accent-mat", context.scene));
  accentMaterial.disableLighting = true;
  accentMaterial.emissiveColor = new Color3(1, 0.78, 0.34);
  accentMaterial.diffuseColor = new Color3(0.82, 0.58, 0.22);

  const beaconMaterial = trackMaterial(new StandardMaterial("preview-base-beacon-mat", context.scene));
  beaconMaterial.disableLighting = true;
  beaconMaterial.emissiveColor = new Color3(1, 0.95, 0.86);
  beaconMaterial.diffuseColor = new Color3(0.84, 0.76, 0.62);

  const trackMesh = (mesh: Mesh): Mesh => {
    meshes.push(mesh);
    mesh.parent = context.root;
    return mesh;
  };

  const core = trackMesh(
    MeshBuilder.CreateCylinder(
      "preview-base-core",
      { height: 12, diameter: 8.6, tessellation: 10 },
      context.scene,
    ),
  );
  core.rotation.x = Math.PI * 0.5;
  core.material = hullMaterial;

  const spine = trackMesh(MeshBuilder.CreateBox("preview-base-spine", { width: 3.4, height: 3.4, depth: 26 }, context.scene));
  spine.material = hullMaterial;

  const hangar = trackMesh(MeshBuilder.CreateBox("preview-base-hangar", { width: 10, height: 5.4, depth: 6 }, context.scene));
  hangar.position.z = 16;
  hangar.material = hullMaterial;

  const dock = trackMesh(
    MeshBuilder.CreateCylinder("preview-base-dock", { height: 5.6, diameter: 12.5, tessellation: 12 }, context.scene),
  );
  dock.rotation.x = Math.PI * 0.5;
  dock.position.z = 21.5;
  dock.material = accentMaterial;

  const dishLeft = trackMesh(MeshBuilder.CreateBox("preview-base-wing-l", { width: 16, height: 1, depth: 4 }, context.scene));
  dishLeft.position.set(-11.5, 0, -3.5);
  dishLeft.rotation.z = 0.1;
  dishLeft.material = hullMaterial;

  const dishRight = trackMesh(MeshBuilder.CreateBox("preview-base-wing-r", { width: 16, height: 1, depth: 4 }, context.scene));
  dishRight.position.set(11.5, 0, -3.5);
  dishRight.rotation.z = -0.1;
  dishRight.material = hullMaterial;

  const beacon = trackMesh(MeshBuilder.CreateSphere("preview-base-beacon", { diameter: 2.4, segments: 8 }, context.scene));
  beacon.position.set(0, 0, 27.5);
  beacon.material = beaconMaterial;

  for (let index = 0; index < 4; index += 1) {
    const chevronMaterial = trackMaterial(new StandardMaterial(`preview-base-chevron-${index}`, context.scene));
    chevronMaterial.disableLighting = true;
    chevronMaterial.emissiveColor = new Color3(0.78, 0.54, 0.14);
    chevronMaterial.diffuseColor = new Color3(0.82, 0.58, 0.18);
    chevronMaterial.alpha = 0.75;

    const chevron = trackMesh(
      MeshBuilder.CreateCylinder(
        `preview-base-chevron-mesh-${index}`,
        { height: 0.18, diameterTop: 0, diameterBottom: 4.8, tessellation: 3 },
        context.scene,
      ),
    );
    chevron.position.set(0, -2.18, 14 + index * 7.2);
    chevron.rotation.x = Math.PI * 0.5;
    chevron.rotation.z = Math.PI;
    chevron.material = chevronMaterial;
  }

  return {
    actions: () => [],
    invoke: () => {},
    update: () => {},
    dispose: () => {
      context.root.scaling.setAll(1);
      for (const mesh of meshes) {
        mesh.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
    },
  };
}

function fitImportedStation(root: TransformNode, targetExtent: number): void {
  const bounds = getHierarchyBounds(root);
  if (!bounds) {
    return;
  }

  const size = bounds.max.subtract(bounds.min);
  const maxExtent = Math.max(size.x, size.y, size.z, 0.001);
  root.scaling.setAll(targetExtent / maxExtent);

  const scaledBounds = getHierarchyBounds(root);
  if (!scaledBounds) {
    return;
  }

  const center = scaledBounds.min.add(scaledBounds.max).scale(0.5);
  root.position.subtractInPlace(center);
}

function getHierarchyBounds(root: TransformNode): { min: Vector3; max: Vector3 } | null {
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

function hasRenderableGeometry(mesh: AbstractMesh): boolean {
  return typeof mesh.getTotalVertices === "function" && mesh.getTotalVertices() > 0;
}
