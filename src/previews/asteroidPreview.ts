import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { PreviewFactoryContext, PreviewHandle } from "../objectPreviewTypes";

export function createAsteroidPreview(context: PreviewFactoryContext): PreviewHandle {
  const asteroidMesh = MeshBuilder.CreateIcoSphere(
    "preview-asteroid",
    { radius: 4.4, subdivisions: 1 },
    context.scene,
  );
  asteroidMesh.parent = context.root;
  asteroidMesh.convertToFlatShadedMesh();
  asteroidMesh.scaling = new Vector3(1.28, 0.94, 1.36);
  asteroidMesh.rotation = new Vector3(0.72, 1.12, 0.38);

  const asteroidMaterial = new StandardMaterial("preview-asteroid-mat", context.scene);
  asteroidMaterial.diffuseColor = new Color3(0.34, 0.29, 0.24);
  asteroidMaterial.emissiveColor = new Color3(0.03, 0.04, 0.055);
  asteroidMaterial.specularColor = Color3.Black();
  asteroidMesh.material = asteroidMaterial;

  let spinning = true;

  return {
    actions: () => [{ id: "spin", label: "Spin", kind: "toggle", active: spinning }],
    invoke: (actionId, nextActive) => {
      if (actionId === "spin") {
        spinning = nextActive ?? !spinning;
      }
    },
    update: (dt) => {
      if (!spinning) {
        return;
      }

      asteroidMesh.rotation.y += dt * 0.46;
      asteroidMesh.rotation.x += dt * 0.14;
    },
    dispose: () => {
      asteroidMesh.dispose();
      asteroidMaterial.dispose();
    },
  };
}
