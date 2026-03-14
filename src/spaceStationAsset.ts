import { AssetContainer } from "@babylonjs/core/assetContainer";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Scene } from "@babylonjs/core/scene";
import stationUrl from "./assets/models/space_station.glb?url";
import "@babylonjs/loaders/glTF";

type StationMaterialDefinition = {
  baseColorFactor?: [number, number, number, number];
  doubleSided?: boolean;
  textureSourceIndex: number | null;
};

type StationGlbDefinition = {
  modelData: Uint8Array;
  materialAssignments: Map<string, number>;
  materials: StationMaterialDefinition[];
  textures: Array<{ source?: number }>;
  images: Array<{ bufferView?: number; mimeType?: string }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number }>;
  binaryChunkOffset: number;
};

export type LoadedSpaceStationAsset = {
  materialsByMeshName: Map<string, StandardMaterial>;
  prefab: AssetContainer;
  dispose: () => void;
};

export async function loadSpaceStationAsset(scene: Scene): Promise<LoadedSpaceStationAsset> {
  const response = await fetch(stationUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch station model: ${response.status} ${response.statusText}`);
  }

  const modelData = new Uint8Array(await response.arrayBuffer());
  const prefab = await LoadAssetContainerAsync(modelData, scene, {
    name: "space_station.glb",
    pluginExtension: ".glb",
    pluginOptions: {
      gltf: {
        // Babylon's imported PBR stack for this asset triggers shader/runtime issues,
        // so keep the geometry and rebuild stable Babylon materials from the embedded textures.
        skipMaterials: true,
      },
    },
  });
  prefab.removeAllFromScene();

  let textureUrls: string[] = [];
  const definitions = extractStationDefinition(modelData);
  const materials = definitions.materials.map((definition, index) =>
    createStationMaterial(scene, definitions, definition, index, (textureUrl) => {
      if (textureUrl) {
        textureUrls.push(textureUrl);
      }
    }),
  );

  const materialsByMeshName = new Map<string, StandardMaterial>();
  for (const [meshName, materialIndex] of definitions.materialAssignments.entries()) {
    const material = materials[materialIndex];
    if (material) {
      materialsByMeshName.set(meshName, material);
    }
  }

  return {
    materialsByMeshName,
    prefab,
    dispose: () => {
      prefab.dispose();
      for (const material of materials) {
        material.dispose();
      }
      for (const textureUrl of textureUrls) {
        URL.revokeObjectURL(textureUrl);
      }
      textureUrls = [];
    },
  };
}

function createStationMaterial(
  scene: Scene,
  definitions: StationGlbDefinition,
  definition: StationMaterialDefinition,
  index: number,
  onTextureUrlCreated: (textureUrl: string | null) => void,
): StandardMaterial {
  const material = new StandardMaterial(`station-imported-material-${index}-${performance.now()}`, scene);
  const baseColorFactor = definition.baseColorFactor ?? [1, 1, 1, 1];
  material.diffuseColor = new Color3(baseColorFactor[0], baseColorFactor[1], baseColorFactor[2]);
  material.alpha = baseColorFactor[3];
  material.emissiveColor = new Color3(0.03, 0.04, 0.055);
  material.specularColor = new Color3(0.08, 0.08, 0.08);
  material.specularPower = 32;
  material.backFaceCulling = !definition.doubleSided;

  const image = extractEmbeddedTextureFromGlb(definitions, modelDataImageIndex(definition, definitions));
  if (!image) {
    onTextureUrlCreated(null);
    return material;
  }

  const textureUrl = URL.createObjectURL(image.blob);
  onTextureUrlCreated(textureUrl);
  const texture = new Texture(textureUrl, scene, {
    invertY: false,
    samplingMode: Texture.NEAREST_SAMPLINGMODE,
  });
  material.diffuseTexture = texture;
  return material;
}

function modelDataImageIndex(
  definition: StationMaterialDefinition,
  definitions: StationGlbDefinition,
): number | null {
  if (definition.textureSourceIndex === null) {
    return null;
  }

  return definitions.textures[definition.textureSourceIndex]?.source ?? null;
}

function extractStationDefinition(modelData: Uint8Array): StationGlbDefinition {
  const view = new DataView(modelData.buffer, modelData.byteOffset, modelData.byteLength);
  if (modelData.byteLength < 20) {
    throw new Error("Station GLB is too small to parse.");
  }

  const magic = new TextDecoder().decode(modelData.subarray(0, 4));
  if (magic !== "glTF") {
    throw new Error("Station asset is not a valid GLB file.");
  }

  let offset = 12;
  let json: {
    meshes?: Array<{
      name?: string;
      primitives?: Array<{ material?: number }>;
    }>;
    materials?: Array<{
      doubleSided?: boolean;
      pbrMetallicRoughness?: {
        baseColorFactor?: [number, number, number, number];
        baseColorTexture?: { index: number };
      };
    }>;
    textures?: Array<{ source?: number }>;
    images?: Array<{ bufferView?: number; mimeType?: string }>;
    bufferViews?: Array<{ byteOffset?: number; byteLength: number }>;
  } | null = null;
  let binaryChunkOffset = 0;

  while (offset + 8 <= modelData.byteLength) {
    const chunkLength = view.getUint32(offset, true);
    const chunkType = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkDataOffset + chunkLength > modelData.byteLength) {
      throw new Error("Station GLB chunk extends past file bounds.");
    }

    if (chunkType === 0x4e4f534a) {
      const jsonText = new TextDecoder().decode(modelData.subarray(chunkDataOffset, chunkDataOffset + chunkLength));
      json = JSON.parse(jsonText);
    } else if (chunkType === 0x004e4942) {
      binaryChunkOffset = chunkDataOffset;
    }

    offset = chunkDataOffset + chunkLength;
  }

  if (!json) {
    throw new Error("Station GLB is missing JSON metadata.");
  }

  const materialAssignments = new Map<string, number>();
  for (const mesh of json.meshes ?? []) {
    const meshName = mesh.name;
    if (!meshName || !mesh.primitives?.length) {
      continue;
    }

    if (mesh.primitives.length === 1) {
      const materialIndex = mesh.primitives[0].material;
      if (materialIndex !== undefined) {
        materialAssignments.set(meshName, materialIndex);
      }
      continue;
    }

    for (let primitiveIndex = 0; primitiveIndex < mesh.primitives.length; primitiveIndex += 1) {
      const materialIndex = mesh.primitives[primitiveIndex].material;
      if (materialIndex !== undefined) {
        materialAssignments.set(`${meshName}_primitive${primitiveIndex}`, materialIndex);
      }
    }
  }

  return {
    modelData,
    materialAssignments,
    materials: (json.materials ?? []).map((material) => ({
      baseColorFactor: material.pbrMetallicRoughness?.baseColorFactor,
      doubleSided: material.doubleSided,
      textureSourceIndex: material.pbrMetallicRoughness?.baseColorTexture?.index ?? null,
    })),
    textures: json.textures ?? [],
    images: json.images ?? [],
    bufferViews: json.bufferViews ?? [],
    binaryChunkOffset,
  };
}

function extractEmbeddedTextureFromGlb(
  definitions: StationGlbDefinition,
  imageIndex: number | null,
): { blob: Blob; mimeType: string } | null {
  if (imageIndex === null) {
    return null;
  }

  const image = definitions.images[imageIndex];
  if (!image || image.bufferView === undefined || !image.mimeType) {
    return null;
  }

  const bufferView = definitions.bufferViews[image.bufferView];
  if (!bufferView) {
    return null;
  }

  const byteOffset = definitions.binaryChunkOffset + (bufferView.byteOffset ?? 0);
  const byteLength = bufferView.byteLength;

  return {
    blob: new Blob([definitions.modelData.slice(byteOffset, byteOffset + byteLength)], { type: image.mimeType }),
    mimeType: image.mimeType,
  };
}
