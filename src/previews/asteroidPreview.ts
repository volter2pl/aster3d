import { loadAsteroidAsset } from "../asteroidAsset";
import { createAsteroidPresentation } from "../asteroidPresentation";
import { PreviewFactoryContext, PreviewHandle } from "../objectPreviewTypes";

export async function createAsteroidPreview(context: PreviewFactoryContext): Promise<PreviewHandle> {
  let asset = null;
  try {
    asset = await loadAsteroidAsset(context.scene);
  } catch (error) {
    console.warn("Failed to load asteroid preview model, using procedural fallback.", error);
  }

  const presentation = createAsteroidPresentation(context.scene, context.root, asset, { diameter: 8.8 });

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

      context.root.rotation.y += dt * 0.46;
      context.root.rotation.x += dt * 0.14;
    },
    dispose: () => {
      presentation.dispose();
      asset?.dispose();
    },
  };
}
