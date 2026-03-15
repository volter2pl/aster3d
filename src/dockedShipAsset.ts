import { AssetContainer } from "@babylonjs/core/assetContainer";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import { Scene } from "@babylonjs/core/scene";
import dockedShipUrl from "./assets/models/no_mans_sky_-_golden_vector.glb?url";
import "@babylonjs/loaders/glTF";

type DockedShipMaterialDefinition = {
  baseColorFactor?: [number, number, number, number];
  doubleSided?: boolean;
  emissiveFactor?: [number, number, number];
  emissiveStrength?: number;
  roughnessFactor?: number;
  baseTextureSourceIndex: number | null;
  emissiveTextureSourceIndex: number | null;
};

type DockedShipGlbDefinition = {
  modelData: Uint8Array;
  materialAssignments: Map<string, number>;
  materials: DockedShipMaterialDefinition[];
  textures: Array<{ source?: number }>;
  images: Array<{ bufferView?: number; mimeType?: string }>;
  bufferViews: Array<{ byteOffset?: number; byteLength: number }>;
  binaryChunkOffset: number;
};

export type LoadedDockedShipAsset = {
  materialsByMeshName: Map<string, StandardMaterial>;
  prefab: AssetContainer;
  dispose: () => void;
};

export async function loadDockedShipAsset(scene: Scene): Promise<LoadedDockedShipAsset> {
  const response = await fetch(dockedShipUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch docked ship model: ${response.status} ${response.statusText}`);
  }

  const modelData = new Uint8Array(await response.arrayBuffer());
  const prefab = await LoadAssetContainerAsync(modelData, scene, {
    name: "no_mans_sky_-_golden_vector.glb",
    pluginExtension: ".glb",
    pluginOptions: {
      gltf: {
        // Keep importer stable by rebuilding a Babylon material stack from the GLB metadata.
        skipMaterials: true,
      },
    },
  });
  prefab.removeAllFromScene();

  const definitions = extractDockedShipDefinition(modelData);
  const textureUrls: string[] = [];
  const texturesByImageIndex = new Map<number, Texture>();

  const getOrCreateTexture = (imageIndex: number | null): Texture | null => {
    if (imageIndex === null) {
      return null;
    }

    const existingTexture = texturesByImageIndex.get(imageIndex);
    if (existingTexture) {
      return existingTexture;
    }

    const image = extractEmbeddedTextureFromGlb(definitions, imageIndex);
    if (!image) {
      return null;
    }

    const textureUrl = URL.createObjectURL(image.blob);
    textureUrls.push(textureUrl);
    const texture = new Texture(textureUrl, scene, {
      invertY: false,
      samplingMode: Texture.TRILINEAR_SAMPLINGMODE,
    });
    texturesByImageIndex.set(imageIndex, texture);
    return texture;
  };

  const materials = definitions.materials.map((definition, index) =>
    createDockedShipMaterial(scene, definitions, definition, index, getOrCreateTexture),
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
      for (const texture of texturesByImageIndex.values()) {
        texture.dispose();
      }
      for (const textureUrl of textureUrls) {
        URL.revokeObjectURL(textureUrl);
      }
    },
  };
}

function createDockedShipMaterial(
  scene: Scene,
  definitions: DockedShipGlbDefinition,
  definition: DockedShipMaterialDefinition,
  index: number,
  getOrCreateTexture: (imageIndex: number | null) => Texture | null,
): StandardMaterial {
  const material = new StandardMaterial(`docked-ship-material-${index}-${performance.now()}`, scene);
  const baseColorFactor = definition.baseColorFactor ?? [1, 1, 1, 1];
  const emissiveFactor = definition.emissiveFactor ?? [0, 0, 0];
  const emissiveStrength = definition.emissiveStrength ?? 1;
  const roughness = definition.roughnessFactor ?? 0.45;
  const imageIndex =
    modelDataImageIndex(definition.baseTextureSourceIndex, definitions) ??
    modelDataImageIndex(definition.emissiveTextureSourceIndex, definitions);

  material.diffuseColor = new Color3(baseColorFactor[0], baseColorFactor[1], baseColorFactor[2]);
  material.alpha = baseColorFactor[3];
  material.emissiveColor = new Color3(
    emissiveFactor[0] * emissiveStrength,
    emissiveFactor[1] * emissiveStrength,
    emissiveFactor[2] * emissiveStrength,
  );
  material.specularColor = new Color3(1, 1, 1).scale(Math.max(0.04, 1 - roughness));
  material.specularPower = 16 + (1 - roughness) * 96;
  material.backFaceCulling = !definition.doubleSided;

  const texture = getOrCreateTexture(imageIndex);
  if (texture) {
    if (definition.baseTextureSourceIndex !== null) {
      material.diffuseTexture = texture;
    }
    if (definition.emissiveTextureSourceIndex !== null) {
      material.emissiveTexture = texture;
    }
  }

  return material;
}

function modelDataImageIndex(textureSourceIndex: number | null, definitions: DockedShipGlbDefinition): number | null {
  if (textureSourceIndex === null) {
    return null;
  }

  return definitions.textures[textureSourceIndex]?.source ?? null;
}

function extractDockedShipDefinition(modelData: Uint8Array): DockedShipGlbDefinition {
  const view = new DataView(modelData.buffer, modelData.byteOffset, modelData.byteLength);
  if (modelData.byteLength < 20) {
    throw new Error("Docked ship GLB is too small to parse.");
  }

  const magic = new TextDecoder().decode(modelData.subarray(0, 4));
  if (magic !== "glTF") {
    throw new Error("Docked ship asset is not a valid GLB file.");
  }

  let offset = 12;
  let json: {
    meshes?: Array<{
      name?: string;
      primitives?: Array<{ material?: number }>;
    }>;
    materials?: Array<{
      doubleSided?: boolean;
      emissiveFactor?: [number, number, number];
      extensions?: {
        KHR_materials_emissive_strength?: {
          emissiveStrength?: number;
        };
      };
      pbrMetallicRoughness?: {
        baseColorFactor?: [number, number, number, number];
        baseColorTexture?: { index: number };
        roughnessFactor?: number;
      };
      emissiveTexture?: { index: number };
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
      throw new Error("Docked ship GLB chunk extends past file bounds.");
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
    throw new Error("Docked ship GLB is missing JSON metadata.");
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
      emissiveFactor: material.emissiveFactor,
      emissiveStrength: material.extensions?.KHR_materials_emissive_strength?.emissiveStrength,
      roughnessFactor: material.pbrMetallicRoughness?.roughnessFactor,
      baseTextureSourceIndex: material.pbrMetallicRoughness?.baseColorTexture?.index ?? null,
      emissiveTextureSourceIndex: material.emissiveTexture?.index ?? null,
    })),
    textures: json.textures ?? [],
    images: json.images ?? [],
    bufferViews: json.bufferViews ?? [],
    binaryChunkOffset,
  };
}

function extractEmbeddedTextureFromGlb(
  definitions: DockedShipGlbDefinition,
  imageIndex: number,
): { blob: Blob; mimeType: string } | null {
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
  if (byteOffset + byteLength > definitions.modelData.byteLength) {
    return null;
  }

  return {
    blob: new Blob([definitions.modelData.slice(byteOffset, byteOffset + byteLength)], { type: image.mimeType }),
    mimeType: image.mimeType,
  };
}
