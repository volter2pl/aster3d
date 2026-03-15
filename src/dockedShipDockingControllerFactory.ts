import type { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import { DockedShipDockingController } from "./dockedShipDockingController";
import type { DockedShipProfile } from "./dockedShipProfiles";

type DockedShipDockingControllerFactoryOptions = {
  cockpitOverlay: HTMLCanvasElement;
  flightCamera: UniversalCamera;
  profile: DockedShipProfile;
  reticle: HTMLElement;
  scene: Scene;
  shipRoot: TransformNode;
};

export class DockedShipDockingControllerFactory {
  public static create(options: DockedShipDockingControllerFactoryOptions): DockedShipDockingController {
    return new DockedShipDockingController(
      options.scene,
      options.shipRoot,
      options.flightCamera,
      {
        cockpitOverlay: options.cockpitOverlay,
        reticle: options.reticle,
      },
      options.profile,
    );
  }
}
