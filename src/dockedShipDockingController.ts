import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { Scene } from "@babylonjs/core/scene";
import type { LoadedDockedShipAsset } from "./dockedShipAsset";
import { DockedShipProfileAdapter, type DockedShipRig } from "./dockedShipProfileAdapter";
import type { DockedShipProfile } from "./dockedShipProfiles";

type DockedShipDockingControllerHudRefs = {
  cockpitOverlay: HTMLCanvasElement;
  reticle: HTMLElement;
};

export class DockedShipDockingController {
  private readonly dockCamera: UniversalCamera;
  private arrivalActive = false;
  private asset: LoadedDockedShipAsset | null = null;
  private onArrivalComplete: (() => void) | null = null;
  private rig: DockedShipRig | null = null;
  private viewActive = false;

  public constructor(
    private readonly scene: Scene,
    private readonly shipRoot: TransformNode,
    private readonly flightCamera: UniversalCamera,
    private readonly hud: DockedShipDockingControllerHudRefs,
    private readonly profile: DockedShipProfile,
  ) {
    this.dockCamera = new UniversalCamera(
      "dockCamera",
      new Vector3(0, 4, this.profile.camera.minDistance),
      this.scene,
    );
    this.dockCamera.inputs.clear();
    this.dockCamera.minZ = 0.05;
    this.dockCamera.fov = 0.82;
  }

  public beginArrivalSequence(onComplete: () => void): void {
    const rig = this.ensureRig();
    this.onArrivalComplete = onComplete;
    this.arrivalActive = rig?.animationStrategy.beginArrivalSequence() ?? false;
    if (!this.arrivalActive) {
      this.completeArrivalSequence();
    }
  }

  public dispose(): void {
    this.hideDockingView();
    this.rig?.dispose();
    this.rig = null;
  }

  public hideDockingView(): void {
    this.arrivalActive = false;
    this.onArrivalComplete = null;
    this.rig?.animationStrategy.stopEngineLoop();
    if (!this.viewActive) {
      return;
    }

    this.scene.activeCamera = this.flightCamera;
    this.hud.cockpitOverlay.style.visibility = "visible";
    this.hud.reticle.style.visibility = "visible";
    this.rig?.root.setEnabled(false);
    this.viewActive = false;
  }

  public setAsset(asset: LoadedDockedShipAsset | null): void {
    if (this.asset === asset) {
      return;
    }

    this.rig?.dispose();
    this.rig = null;
    this.asset = asset;
  }

  public showDockingView(): void {
    const rig = this.ensureRig();
    rig?.root.setEnabled(true);
    rig?.animationStrategy.setIdleState();
    rig?.animationStrategy.startEngineLoop();
    this.scene.activeCamera = this.dockCamera;
    this.hud.cockpitOverlay.style.visibility = "hidden";
    this.hud.reticle.style.visibility = "hidden";
    this.viewActive = true;
  }

  public update(dt: number, dockPosition: Vector3): void {
    if (!this.viewActive) {
      return;
    }

    this.refreshDockCamera(dockPosition);
    const arrivalCompleted = this.rig?.animationStrategy.update(dt) ?? false;
    if (this.arrivalActive && arrivalCompleted) {
      this.completeArrivalSequence();
    }
  }

  private completeArrivalSequence(): void {
    this.arrivalActive = false;
    const onArrivalComplete = this.onArrivalComplete;
    this.onArrivalComplete = null;
    onArrivalComplete?.();
  }

  private ensureRig(): DockedShipRig | null {
    if (this.rig) {
      return this.rig;
    }

    if (!this.asset) {
      return null;
    }

    const adapter = new DockedShipProfileAdapter(this.scene, this.shipRoot, this.profile);
    this.rig = adapter.adapt(this.asset);
    return this.rig;
  }

  private refreshDockCamera(dockPosition: Vector3): void {
    const worldUp = Vector3.Up();
    const dockToShip = this.shipRoot.position.subtract(dockPosition);
    const backward =
      dockToShip.lengthSquared() > 0.001
        ? dockToShip.normalize()
        : this.flightCamera.getDirection(Vector3.Backward(this.scene.useRightHandedSystem)).normalize();
    const visualSize =
      this.rig?.visualSize ?? new Vector3(this.profile.camera.targetExtent, 4.2, this.profile.camera.targetExtent);
    const shipLength = Math.max(visualSize.z, visualSize.x, this.profile.camera.targetExtent);
    const shipHeight = Math.max(visualSize.y, 4);
    const cameraDistance = Math.max(
      this.profile.camera.minDistance + this.profile.camera.distancePadding,
      shipLength * this.profile.camera.distanceScale,
    );
    const cameraLift = Math.max(this.profile.camera.liftMin, shipHeight * this.profile.camera.liftScale);
    const targetLift = Math.max(this.profile.camera.targetLiftMin, shipHeight * this.profile.camera.targetLiftScale);

    this.dockCamera.position.copyFrom(
      this.shipRoot.position.add(backward.scale(cameraDistance)).add(worldUp.scale(cameraLift)),
    );
    this.dockCamera.setTarget(dockPosition.add(worldUp.scale(targetLift)));
  }
}
