import type { PreviewObjectId } from "./objectPreviewTypes";

export type PreviewCreditEntry = {
  changes?: string;
  creatorName?: string;
  creatorUrl?: string;
  licenseName?: string;
  licenseUrl: string;
  notes?: string;
  relationLabel?: string;
  sourceLabel: string;
  sourceUrl: string;
  title: string;
};

const PREVIEW_CREDITS: Partial<Record<PreviewObjectId, PreviewCreditEntry[]>> = {
  base: [
    {
      title: "Space Station V (2001: A Space Odyssey)",
      creatorName: "uperesito",
      creatorUrl: "https://sketchfab.com/uperesito",
      sourceLabel: "Sketchfab",
      sourceUrl: "https://sketchfab.com/3d-models/space-station-v-2001-a-space-odyssey-cc2f60147e3b407d833685cb2349708a",
      licenseName: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      changes: "Modified for use in Aster3D.",
    },
  ],
  enemy: [
    {
      title: "Azure Nebula Starfighter X",
      sourceLabel: "Meshy",
      sourceUrl: "https://www.meshy.ai/3d-models/Azure-Nebula-Starfighter-x-v2-019caacb-82b2-750c-bc02-c77b26a0daf8",
      licenseName: "Source license not verified here",
      licenseUrl: "https://www.meshy.ai/",
      relationLabel: "Design inspiration",
      notes:
        "The in-game enemy is a hand-made model inspired by this page, not the downloaded Meshy asset. Provenance of the upstream reference imagery is unclear, so this entry is kept as source-of-inspiration metadata.",
    },
  ],
  ship: [
    {
      title: "No Man’s Sky - Golden Vector",
      creatorName: "LocoPixel",
      sourceLabel: "Sketchfab",
      sourceUrl: "https://sketchfab.com/3d-models/no-mans-sky-golden-vector-ccb55b1309434d51875cbe2860d78e2f",
      licenseName: "CC BY-NC 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc/4.0/",
      changes: "Modified for use in Aster3D.",
      notes: "Non-commercial license. Commercial use requires separate permission from the creator.",
    },
  ],
};

export function getPreviewCredits(objectId: PreviewObjectId): PreviewCreditEntry[] {
  return PREVIEW_CREDITS[objectId] ?? [];
}
