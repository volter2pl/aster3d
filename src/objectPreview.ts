import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import {
  createPreviewHandle,
  getPreviewEntry,
  getPreviewHref,
  listPreviewEntries,
  resolvePreviewObjectId,
} from "./objectPreviewRegistry";
import { PreviewAction, PreviewHandle, PreviewObjectId } from "./objectPreviewTypes";

export { getPreviewEntry, getPreviewHref, listPreviewEntries, resolvePreviewObjectId };
export type { PreviewObjectId };

export type ObjectPreviewViewerOptions = {
  objectId: PreviewObjectId;
  showMarkers: boolean;
};

const VIEWER_SUNLIGHT_DIRECTION = new Vector3(0.78, -0.28, -0.56).normalize();

export class ObjectPreviewViewer {
  private readonly actionsHost: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly rootNode: TransformNode;
  private readonly actionsClickHandler = (event: Event): void => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLButtonElement>("[data-preview-action]");
    if (!target || !this.handle) {
      return;
    }

    const action = this.handle.actions().find((candidate) => candidate.id === target.dataset.previewAction);
    if (!action) {
      return;
    }

    const nextActive = action.kind === "toggle" ? action.active !== true : undefined;
    this.handle.invoke(action.id, nextActive);
    this.renderActions();
  };
  private readonly preventContextMenu = (event: Event): void => {
    event.preventDefault();
  };
  private readonly resizeHandler = (): void => {
    this.engine.resize();
  };

  private handle: PreviewHandle | null = null;
  private lastFrameTime = 0;
  private disposed = false;

  public static async create(root: HTMLElement, options: ObjectPreviewViewerOptions): Promise<ObjectPreviewViewer> {
    const viewer = new ObjectPreviewViewer(root);
    await viewer.initialize(options);
    return viewer;
  }

  private constructor(root: HTMLElement) {
    const canvas = root.querySelector<HTMLCanvasElement>("[data-preview-canvas]");
    const actionsHost = root.querySelector<HTMLElement>("[data-preview-actions]");
    if (!canvas || !actionsHost) {
      throw new Error("Missing object preview elements");
    }

    this.canvas = canvas;
    this.actionsHost = actionsHost;
    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.008, 0.015, 0.04, 1);

    const fillLight = new HemisphericLight("preview-fill", new Vector3(0.3, 1, -0.4), this.scene);
    fillLight.intensity = 0.84;
    fillLight.diffuse = new Color3(0.58, 0.72, 0.98);
    fillLight.groundColor = new Color3(0.03, 0.05, 0.1);

    const rimLight = new HemisphericLight("preview-rim", new Vector3(-0.9, 0.15, 0.7), this.scene);
    rimLight.intensity = 0.24;
    rimLight.diffuse = new Color3(0.32, 0.44, 0.74);
    rimLight.groundColor = Color3.Black();

    const sunLight = new DirectionalLight("preview-sun", VIEWER_SUNLIGHT_DIRECTION, this.scene);
    sunLight.intensity = 0.78;
    sunLight.diffuse = new Color3(1, 0.92, 0.76);
    sunLight.specular = new Color3(1, 0.96, 0.88);

    new GlowLayer("preview-glow", this.scene, { blurKernelSize: 32 }).intensity = 0.6;

    this.camera = new ArcRotateCamera("preview-camera", -Math.PI / 2, Math.PI / 2.45, 12, Vector3.Zero(), this.scene);
    this.camera.attachControl(this.canvas, true);
    this.camera.lowerRadiusLimit = 4;
    this.camera.upperRadiusLimit = 120;
    this.camera.wheelPrecision = 28;
    this.camera.panningSensibility = 0;
    this.camera.useNaturalPinchZoom = true;

    this.rootNode = new TransformNode("preview-root", this.scene);

    this.actionsHost.addEventListener("click", this.actionsClickHandler);
    this.canvas.addEventListener("contextmenu", this.preventContextMenu);
    window.addEventListener("resize", this.resizeHandler);
  }

  private async initialize(options: ObjectPreviewViewerOptions): Promise<void> {
    this.handle = await createPreviewHandle(options.objectId, {
      scene: this.scene,
      root: this.rootNode,
      initialMarkers: options.showMarkers,
    });
    this.lastFrameTime = performance.now();
    this.renderActions();
    this.applyCameraPreset(options.objectId);

    this.engine.runRenderLoop(() => {
      if (this.disposed) {
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = now;
      this.handle?.update(dt, now);
      this.scene.render();
    });
  }

  private applyCameraPreset(objectId: PreviewObjectId): void {
    if (objectId === "enemy") {
      this.camera.radius = 10.5;
      this.camera.lowerRadiusLimit = 5.5;
      this.camera.upperRadiusLimit = 24;
      return;
    }

    if (objectId === "asteroid") {
      this.camera.radius = 15.5;
      this.camera.lowerRadiusLimit = 7;
      this.camera.upperRadiusLimit = 28;
      return;
    }

    if (objectId === "ship") {
      this.camera.radius = 14;
      this.camera.lowerRadiusLimit = 8;
      this.camera.upperRadiusLimit = 26;
      return;
    }

    this.camera.radius = 32;
    this.camera.lowerRadiusLimit = 16;
    this.camera.upperRadiusLimit = 72;
  }

  private renderActions(): void {
    const actions = this.handle?.actions() ?? [];
    if (actions.length === 0) {
      this.actionsHost.innerHTML = "";
      return;
    }

    this.actionsHost.innerHTML = actions
      .map((action) => this.renderAction(action))
      .join("");
  }

  private renderAction(action: PreviewAction): string {
    const activeClass = action.kind === "toggle" && action.active ? " preview-toolbar__button--active" : "";
    const activeState = action.kind === "toggle" ? ` aria-pressed="${action.active ? "true" : "false"}"` : "";
    return `<button class="preview-toolbar__button${activeClass}" type="button" data-preview-action="${action.id}"${activeState}>${action.label}</button>`;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.actionsHost.removeEventListener("click", this.actionsClickHandler);
    this.canvas.removeEventListener("contextmenu", this.preventContextMenu);
    window.removeEventListener("resize", this.resizeHandler);
    this.handle?.dispose();
    this.handle = null;
    this.scene.dispose();
    this.engine.dispose();
  }
}
