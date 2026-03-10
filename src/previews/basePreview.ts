import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PreviewFactoryContext, PreviewHandle } from "../objectPreviewTypes";

export function createBasePreview(context: PreviewFactoryContext): PreviewHandle {
  context.root.scaling.setAll(0.12);
  context.root.rotation.y = Math.PI * 0.14;

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

  const shieldMaterial = trackMaterial(new StandardMaterial("preview-base-shield-mat", context.scene));
  shieldMaterial.disableLighting = true;
  shieldMaterial.emissiveColor = new Color3(0.46, 0.62, 0.92);
  shieldMaterial.diffuseColor = new Color3(0.14, 0.2, 0.38);
  shieldMaterial.specularColor = Color3.Black();
  shieldMaterial.alpha = 0.13;
  shieldMaterial.backFaceCulling = false;

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

  const spine = trackMesh(
    MeshBuilder.CreateBox(
      "preview-base-spine",
      { width: 3.4, height: 3.4, depth: 26 },
      context.scene,
    ),
  );
  spine.material = hullMaterial;

  const hangar = trackMesh(
    MeshBuilder.CreateBox(
      "preview-base-hangar",
      { width: 10, height: 5.4, depth: 6 },
      context.scene,
    ),
  );
  hangar.position.z = 16;
  hangar.material = hullMaterial;

  const dock = trackMesh(
    MeshBuilder.CreateCylinder(
      "preview-base-dock",
      { height: 5.6, diameter: 12.5, tessellation: 12 },
      context.scene,
    ),
  );
  dock.rotation.x = Math.PI * 0.5;
  dock.position.z = 21.5;
  dock.material = accentMaterial;

  const dishLeft = trackMesh(
    MeshBuilder.CreateBox(
      "preview-base-wing-l",
      { width: 16, height: 1, depth: 4 },
      context.scene,
    ),
  );
  dishLeft.position.set(-11.5, 0, -3.5);
  dishLeft.rotation.z = 0.1;
  dishLeft.material = hullMaterial;

  const dishRight = trackMesh(
    MeshBuilder.CreateBox(
      "preview-base-wing-r",
      { width: 16, height: 1, depth: 4 },
      context.scene,
    ),
  );
  dishRight.position.set(11.5, 0, -3.5);
  dishRight.rotation.z = -0.1;
  dishRight.material = hullMaterial;

  const beacon = trackMesh(MeshBuilder.CreateSphere("preview-base-beacon", { diameter: 2.4, segments: 8 }, context.scene));
  beacon.position.set(0, 0, 27.5);
  beacon.material = beaconMaterial;

  const shield = trackMesh(MeshBuilder.CreateSphere("preview-base-shield", { diameter: 184, segments: 20 }, context.scene));
  shield.material = shieldMaterial;

  let shieldEnabled = true;

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
    actions: () => [{ id: "shield", label: "Shield", kind: "toggle", active: shieldEnabled }],
    invoke: (actionId, nextActive) => {
      if (actionId === "shield") {
        shieldEnabled = nextActive ?? !shieldEnabled;
        shield.setEnabled(shieldEnabled);
      }
    },
    update: () => {},
    dispose: () => {
      for (const mesh of meshes) {
        mesh.dispose();
      }
      for (const material of materials) {
        material.dispose();
      }
    },
  };
}
