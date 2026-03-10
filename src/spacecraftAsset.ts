import { AssetContainer } from "@babylonjs/core/assetContainer";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Scene } from "@babylonjs/core/scene";
import spacecraftUrl from "./assets/models/spacecraft.glb?url";
import "@babylonjs/loaders/glTF";

export type LoadedSpacecraftAsset = {
  prefab: AssetContainer;
  material: StandardMaterial;
  dispose: () => void;
};

export async function loadSpacecraftAsset(scene: Scene): Promise<LoadedSpacecraftAsset> {
  const response = await fetch(spacecraftUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch enemy model: ${response.status} ${response.statusText}`);
  }

  const modelData = new Uint8Array(await response.arrayBuffer());
  const prefab = await LoadAssetContainerAsync(modelData, scene, {
    name: "spacecraft.glb",
    pluginExtension: ".glb",
    pluginOptions: {
      gltf: {
        // Keep the GLB geometry/UVs, but rebuild a stable Babylon material from its embedded base-color texture.
        skipMaterials: true,
      },
    },
  });
  prefab.removeAllFromScene();

  let textureUrl: string | null = null;
  const material = createSpacecraftMaterial(scene, modelData, (nextTextureUrl) => {
    textureUrl = nextTextureUrl;
  });

  return {
    prefab,
    material,
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

function createSpacecraftMaterial(
  scene: Scene,
  modelData: Uint8Array,
  onTextureUrlCreated: (textureUrl: string | null) => void,
): StandardMaterial {
  const image = extractEmbeddedTextureFromGlb(modelData);
  const material = new StandardMaterial(`enemy-imported-material-${performance.now()}`, scene);
  material.diffuseColor = Color3.White();
  material.emissiveColor = new Color3(0.1, 0.12, 0.16);
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  material.specularPower = 32;
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
