import { PreviewEntry, PreviewFactoryContext, PreviewHandle, PreviewObjectId } from "./objectPreviewTypes";
import { createAsteroidPreview } from "./previews/asteroidPreview";
import { createBasePreview } from "./previews/basePreview";
import { createEnemyPreview } from "./previews/enemyPreview";
import { createShipPreview } from "./previews/shipPreview";

type PreviewDefinition = {
  entry: PreviewEntry;
  create: (context: PreviewFactoryContext) => Promise<PreviewHandle> | PreviewHandle;
};

const PREVIEW_REGISTRY: Record<PreviewObjectId, PreviewDefinition> = {
  enemy: {
    entry: {
      id: "enemy",
      title: "Hunter Interceptor",
      eyebrow: "Object Preview",
      description:
        "A light patrol fighter. It carries two forward-facing cannons and distinct light points near both the front and rear engine sections.",
      hint: "Drag to rotate the object. Use the mouse wheel to zoom in and out.",
    },
    create: createEnemyPreview,
  },
  asteroid: {
    entry: {
      id: "asteroid",
      title: "Mineral Asteroid",
      eyebrow: "Object Preview",
      description:
        "An irregular rock mass drifting between sectors. In combat it disrupts aim and often blocks a clean firing line.",
      hint: "Drag to inspect the rock silhouette and surface from every angle.",
    },
    create: createAsteroidPreview,
  },
  base: {
    entry: {
      id: "base",
      title: "Frontier Station",
      eyebrow: "Object Preview",
      description:
        "A service outpost and safe docking point. This is where the player sells recovered salvage and restores shields.",
      hint: "Drag to inspect the dock layout, hangar section, and station shield from different angles.",
    },
    create: createBasePreview,
  },
  ship: {
    entry: {
      id: "ship",
      title: "Scavenger Mk.I",
      eyebrow: "Object Preview",
      description:
        "The current player ship. A compact retrofit hull with a canopy animation and exposed engine assemblies used throughout the docking sequence.",
      hint: "Drag to inspect the hull silhouette and engine section from different angles.",
    },
    create: createShipPreview,
  },
};

export function resolvePreviewObjectId(params: URLSearchParams): PreviewObjectId | null {
  const direct = params.get("preview");
  if (direct === "enemy" || direct === "asteroid" || direct === "base" || direct === "ship") {
    return direct;
  }

  const legacy = params.get("bestiary");
  if (legacy === "enemy" || legacy === "asteroid" || legacy === "base" || legacy === "ship") {
    return legacy;
  }

  if (direct || legacy) {
    return "enemy";
  }

  return null;
}

export function getPreviewEntry(objectId: PreviewObjectId): PreviewEntry {
  return PREVIEW_REGISTRY[objectId].entry;
}

export function listPreviewEntries(): PreviewEntry[] {
  return Object.values(PREVIEW_REGISTRY).map((definition) => definition.entry);
}

export function getPreviewHref(objectId: PreviewObjectId, showMarkers = false): string {
  const params = new URLSearchParams();
  params.set("preview", objectId);
  if (showMarkers) {
    params.set("markers", "1");
  }
  return `?${params.toString()}`;
}

export async function createPreviewHandle(
  objectId: PreviewObjectId,
  context: PreviewFactoryContext,
): Promise<PreviewHandle> {
  return PREVIEW_REGISTRY[objectId].create(context);
}
