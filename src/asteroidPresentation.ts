import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { LoadedAsteroidAsset } from "./asteroidAsset";

type AsteroidPresentationOptions = {
  diameter: number;
  rng?: () => number;
};

export type AsteroidPresentation = {
  dispose: () => void;
};

export function createAsteroidPresentation(
  scene: Scene,
  root: TransformNode,
  asset: LoadedAsteroidAsset | null,
  options: AsteroidPresentationOptions,
): AsteroidPresentation {
  const visualRoot = new TransformNode(`asteroid-visual-${performance.now()}`, scene);
  visualRoot.parent = root;
  const disposeCallbacks: Array<() => void> = [];

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

    const uniformScale = options.diameter / Math.max(asset.baseDiameter, 0.001);
    visualRoot.scaling.setAll(uniformScale);
  } else {
    const material = new StandardMaterial(`asteroid-fallback-mat-${performance.now()}`, scene);
    material.diffuseColor = new Color3(0.34, 0.29, 0.24);
    material.emissiveColor = new Color3(0.03, 0.04, 0.055);
    material.specularColor = Color3.Black();

    const asteroidMesh = MeshBuilder.CreateIcoSphere(
      `asteroid-fallback-${performance.now()}`,
      { radius: options.diameter * 0.5, subdivisions: options.diameter > 5 ? 1 : 0 },
      scene,
    );
    asteroidMesh.parent = visualRoot;
    asteroidMesh.convertToFlatShadedMesh();
    asteroidMesh.material = material;

    const rng = options.rng ?? Math.random;
    visualRoot.scaling = new Vector3(
      randomBetween(0.7, 1.4, rng),
      randomBetween(0.72, 1.36, rng),
      randomBetween(0.74, 1.44, rng),
    );

    disposeCallbacks.push(() => {
      material.dispose();
    });
  }

  return {
    dispose: () => {
      for (const dispose of disposeCallbacks) {
        dispose();
      }
    },
  };
}

function randomBetween(min: number, max: number, rng: () => number): number {
  return min + (max - min) * rng();
}
