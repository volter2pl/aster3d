import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { Scene } from "@babylonjs/core/scene";
import asteroidUrl from "./assets/models/asteroid.glb?url";
import "@babylonjs/loaders/glTF";

export type LoadedAsteroidAsset = {
  baseDiameter: number;
  material: StandardMaterial;
  prefab: AssetContainer;
  dispose: () => void;
};

export async function loadAsteroidAsset(scene: Scene): Promise<LoadedAsteroidAsset> {
  const response = await fetch(asteroidUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch asteroid model: ${response.status} ${response.statusText}`);
  }

  const modelData = new Uint8Array(await response.arrayBuffer());
  const prefab = await LoadAssetContainerAsync(modelData, scene, {
    name: "asteroid.glb",
    pluginExtension: ".glb",
    pluginOptions: {
      gltf: {
        skipMaterials: true,
      },
    },
  });
  prefab.removeAllFromScene();

  let textureUrl: string | null = null;
  const material = createAsteroidMaterial(scene, modelData, (nextTextureUrl) => {
    textureUrl = nextTextureUrl;
  });

  return {
    baseDiameter: getContainerDiameter(prefab.meshes),
    material,
    prefab,
    dispose: () => {
      prefab.dispose();
      material.dispose();
      if (textureUrl) {
        URL.revokeObjectURL(textureUrl);
        textureUrl = null;
      }
    },
  };
}

function createAsteroidMaterial(
  scene: Scene,
  modelData: Uint8Array,
  onTextureUrlCreated: (textureUrl: string | null) => void,
): StandardMaterial {
  const image = extractEmbeddedTextureFromGlb(modelData);
  const material = new StandardMaterial(`asteroid-imported-material-${performance.now()}`, scene);
  material.diffuseColor = new Color3(0.36, 0.31, 0.27);
  material.emissiveColor = new Color3(0.03, 0.04, 0.055);
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;

  if (image) {
    const textureUrl = URL.createObjectURL(image.blob);
    onTextureUrlCreated(textureUrl);
    const texture = new Texture(textureUrl, scene, {
      invertY: false,
      samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
    });
    material.diffuseTexture = texture;
  } else {
    onTextureUrlCreated(null);
  }

  return material;
}

function getContainerDiameter(meshes: AbstractMesh[]): number {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let minZ = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let maxZ = Number.NEGATIVE_INFINITY;

  for (const mesh of meshes) {
    if (mesh.getTotalVertices() === 0) {
      continue;
    }

    mesh.computeWorldMatrix(true);
    const boundingBox = mesh.getBoundingInfo().boundingBox;
    minX = Math.min(minX, boundingBox.minimumWorld.x);
    minY = Math.min(minY, boundingBox.minimumWorld.y);
    minZ = Math.min(minZ, boundingBox.minimumWorld.z);
    maxX = Math.max(maxX, boundingBox.maximumWorld.x);
    maxY = Math.max(maxY, boundingBox.maximumWorld.y);
    maxZ = Math.max(maxZ, boundingBox.maximumWorld.z);
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) {
    return 1;
  }

  return Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1);
}

function extractEmbeddedTextureFromGlb(modelData: Uint8Array): { blob: Blob; mimeType: string } | null {
  const view = new DataView(modelData.buffer, modelData.byteOffset, modelData.byteLength);
  if (modelData.byteLength < 20) {
    return null;
  }

  const magic = new TextDecoder().decode(modelData.subarray(0, 4));
  if (magic !== "glTF") {
    return null;
  }

  let offset = 12;
  let json: {
    images?: Array<{
      bufferView?: number;
      mimeType?: string;
    }>;
    bufferViews?: Array<{
      byteOffset?: number;
      byteLength: number;
    }>;
  } | null = null;
  let binaryChunkOffset = 0;

  while (offset + 8 <= modelData.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkDataOffset + chunkLength > modelData.byteLength) {
      return null;
    }

    if (chunkType === 0x4e4f534a) {
      const jsonText = new TextDecoder().decode(modelData.subarray(chunkDataOffset, chunkDataOffset + chunkLength));
      json = JSON.parse(jsonText);
    } else if (chunkType === 0x004e4942) {
      binaryChunkOffset = chunkDataOffset;
    }

    offset = chunkDataOffset + chunkLength;
  }

  const image = json?.images?.[0];
  if (!image || image.bufferView === undefined || !image.mimeType) {
    return null;
  }

  const bufferView = json?.bufferViews?.[image.bufferView];
  if (!bufferView) {
    return null;
  }

  const byteOffset = binaryChunkOffset + (bufferView.byteOffset ?? 0);
  const byteLength = bufferView.byteLength;
  if (byteOffset + byteLength > modelData.byteLength) {
    return null;
  }

  return {
    blob: new Blob([modelData.slice(byteOffset, byteOffset + byteLength)], { type: image.mimeType }),
    mimeType: image.mimeType,
  };
}
