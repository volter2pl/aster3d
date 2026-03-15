import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DockedShipProfileAdapter } from "../dockedShipProfileAdapter";
import { GOLDEN_VECTOR_DOCKED_SHIP_PROFILE } from "../dockedShipProfiles";
import { PreviewFactoryContext, PreviewHandle } from "../objectPreviewTypes";

export async function createShipPreview(context: PreviewFactoryContext): Promise<PreviewHandle> {
  const profile = GOLDEN_VECTOR_DOCKED_SHIP_PROFILE;
  const asset = await profile.loadAsset(context.scene);
  const adapter = new DockedShipProfileAdapter(context.scene, context.root, profile);
  const rig = adapter.adapt(asset);

  rig.root.setEnabled(true);
  rig.animationStrategy.setIdleState();
  rig.animationStrategy.startEngineLoop();

  let canopyOpen = false;
  let enginesEnabled = true;
  let spinning = true;

  return {
    actions: () => [
      { id: "engines", label: "Engines", kind: "toggle", active: enginesEnabled },
      { id: "canopy", label: "Canopy", kind: "toggle", active: canopyOpen },
      { id: "spin", label: "Spin", kind: "toggle", active: spinning },
    ],
    invoke: (actionId, nextActive) => {
      if (actionId === "engines") {
        enginesEnabled = nextActive ?? !enginesEnabled;
        if (enginesEnabled) {
          rig.animationStrategy.startEngineLoop();
        } else {
          rig.animationStrategy.stopEngineLoop();
        }
        return;
      }

      if (actionId === "canopy") {
        canopyOpen = nextActive ?? !canopyOpen;
        rig.animationStrategy.setCanopyOpen(canopyOpen, { animate: true });
        return;
      }

      if (actionId === "spin") {
        spinning = nextActive ?? !spinning;
      }
    },
    update: (dt, timeMs) => {
      rig.animationStrategy.update(dt);

      if (spinning) {
        context.root.rotation.y += dt * 0.34;
      }

      context.root.rotation.x = Math.sin(timeMs * 0.00055) * 0.05;
      context.root.position.y = Math.sin(timeMs * 0.001) * 0.14;
    },
    dispose: () => {
      context.root.rotation.setAll(0);
      context.root.position.copyFrom(Vector3.Zero());
      rig.dispose();
      asset.dispose();
    },
  };
}
