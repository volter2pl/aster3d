import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Engine } from "@babylonjs/core/Engines/engine";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import type { LoadedDockedShipAsset } from "./dockedShipAsset";
import { DockedShipProfileAdapter, type DockedShipRig } from "./dockedShipProfileAdapter";
import type { DockedShipProfile } from "./dockedShipProfiles";

export class StationShipPreview {
  private readonly canvas: HTMLCanvasElement;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: ArcRotateCamera;
  private readonly root: TransformNode;
  private readonly engineGlowMeshes: Mesh[] = [];
  private readonly fallbackMaterials: StandardMaterial[] = [];
  private readonly fallbackMeshes: Mesh[] = [];
  private readonly resizeHandler = (): void => {
    this.engine.resize();
  };

  private disposed = false;
  private lastFrameTime = 0;
  private loadVersion = 0;
  private shipAsset: LoadedDockedShipAsset | null = null;
  private shipRig: DockedShipRig | null = null;

  public static create(root: HTMLElement): StationShipPreview {
    return new StationShipPreview(root);
  }

  private constructor(root: HTMLElement) {
    const canvas = root.querySelector<HTMLCanvasElement>("[data-station-preview-canvas]");
    if (!canvas) {
      throw new Error("Missing station preview canvas");
    }

    this.canvas = canvas;
    this.engine = new Engine(this.canvas, true, { preserveDrawingBuffer: false, stencil: true });
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0, 0, 0, 0);

    const fillLight = new HemisphericLight("station-preview-fill", new Vector3(0.2, 1, -0.3), this.scene);
    fillLight.intensity = 0.95;
    fillLight.diffuse = new Color3(0.72, 0.78, 1);
    fillLight.groundColor = new Color3(0.06, 0.05, 0.08);

    const rimLight = new HemisphericLight("station-preview-rim", new Vector3(-0.7, 0.2, 0.8), this.scene);
    rimLight.intensity = 0.35;
    rimLight.diffuse = new Color3(1, 0.74, 0.38);
    rimLight.groundColor = Color3.Black();

    new GlowLayer("station-preview-glow", this.scene, { blurKernelSize: 32 }).intensity = 0.7;

    this.camera = new ArcRotateCamera("station-preview-camera", -Math.PI / 2, Math.PI / 2.45, 12, Vector3.Zero(), this.scene);
    this.camera.lowerRadiusLimit = 7;
    this.camera.upperRadiusLimit = 14;
    this.camera.panningSensibility = 0;
    this.camera.wheelPrecision = 60;
    this.camera.attachControl(this.canvas, true);

    this.root = new TransformNode("station-preview-root", this.scene);

    this.lastFrameTime = performance.now();
    window.addEventListener("resize", this.resizeHandler);
    this.engine.runRenderLoop(() => {
      if (this.disposed) {
        return;
      }

      const now = performance.now();
      const dt = Math.min((now - this.lastFrameTime) / 1000, 0.05);
      this.lastFrameTime = now;
      this.update(dt, now);
      this.scene.render();
    });
  }

  public async setShipProfile(profile: DockedShipProfile): Promise<void> {
    const loadVersion = ++this.loadVersion;

    try {
      const asset = await profile.loadAsset(this.scene);
      if (this.disposed || loadVersion !== this.loadVersion) {
        asset.dispose();
        return;
      }

      this.clearShipVisual();
      this.shipAsset = asset;
      const adapter = new DockedShipProfileAdapter(this.scene, this.root, profile);
      this.shipRig = adapter.adapt(asset);
      this.shipRig.root.setEnabled(true);
      this.shipRig.animationStrategy.setIdleState();
      this.shipRig.animationStrategy.startEngineLoop();
      this.fitCameraToShip(this.shipRig.visualSize);
    } catch (error) {
      if (this.disposed || loadVersion !== this.loadVersion) {
        return;
      }

      console.warn("Failed to load station ship preview model, using procedural fallback.", error);
      this.clearShipVisual();
      this.buildPlaceholderShip();
      this.fitCameraToShip(new Vector3(6.8, 1.6, 6.8));
    }
  }

  private buildPlaceholderShip(): void {
    const hullMaterial = this.trackMaterial(new StandardMaterial("station-preview-hull", this.scene));
    hullMaterial.diffuseColor = new Color3(0.28, 0.3, 0.38);
    hullMaterial.emissiveColor = new Color3(0.06, 0.06, 0.1);
    hullMaterial.specularColor = new Color3(0.18, 0.18, 0.18);

    const accentMaterial = this.trackMaterial(new StandardMaterial("station-preview-accent", this.scene));
    accentMaterial.diffuseColor = new Color3(0.72, 0.46, 0.18);
    accentMaterial.emissiveColor = new Color3(0.18, 0.08, 0.02);
    accentMaterial.specularColor = new Color3(0.12, 0.1, 0.08);

    const canopyMaterial = this.trackMaterial(new StandardMaterial("station-preview-canopy", this.scene));
    canopyMaterial.diffuseColor = new Color3(0.12, 0.3, 0.42);
    canopyMaterial.emissiveColor = new Color3(0.08, 0.22, 0.34);
    canopyMaterial.specularColor = new Color3(0.3, 0.38, 0.42);
    canopyMaterial.alpha = 0.96;

    const glowMaterial = this.trackMaterial(new StandardMaterial("station-preview-engine", this.scene));
    glowMaterial.disableLighting = true;
    glowMaterial.emissiveColor = new Color3(1, 0.56, 0.2);
    glowMaterial.diffuseColor = new Color3(0.7, 0.26, 0.08);

    const fuselage = this.trackMesh(MeshBuilder.CreateCylinder(
      "station-preview-fuselage",
      { height: 6.8, diameterTop: 0.8, diameterBottom: 1.5, tessellation: 8 },
      this.scene,
    ));
    fuselage.rotation.x = Math.PI / 2;
    fuselage.parent = this.root;
    fuselage.material = hullMaterial;

    const nose = this.trackMesh(MeshBuilder.CreateSphere("station-preview-nose", { diameter: 1.3, segments: 12 }, this.scene));
    nose.parent = this.root;
    nose.position.z = 2.6;
    nose.scaling.set(0.78, 0.7, 1.12);
    nose.material = canopyMaterial;

    const spine = this.trackMesh(
      MeshBuilder.CreateBox("station-preview-spine", { width: 0.55, height: 0.48, depth: 3.4 }, this.scene),
    );
    spine.parent = this.root;
    spine.position.set(0, 0.42, 0.2);
    spine.material = accentMaterial;

    const wingLeft = this.trackMesh(
      MeshBuilder.CreateBox("station-preview-wing-left", { width: 3.4, height: 0.18, depth: 1.7 }, this.scene),
    );
    wingLeft.parent = this.root;
    wingLeft.position.set(-1.95, -0.1, 0.2);
    wingLeft.rotation.z = -0.16;
    wingLeft.material = hullMaterial;

    const wingRight = this.trackMesh(wingLeft.clone("station-preview-wing-right") as Mesh);
    wingRight.parent = this.root;
    wingRight.position.x = 1.95;
    wingRight.rotation.z = 0.16;

    const podLeft = this.trackMesh(MeshBuilder.CreateCylinder(
      "station-preview-pod-left",
      { height: 2.2, diameterTop: 0.42, diameterBottom: 0.66, tessellation: 8 },
      this.scene,
    ));
    podLeft.parent = this.root;
    podLeft.rotation.x = Math.PI / 2;
    podLeft.position.set(-1.72, -0.36, -1.2);
    podLeft.material = accentMaterial;

    const podRight = this.trackMesh(podLeft.clone("station-preview-pod-right") as Mesh);
    podRight.parent = this.root;
    podRight.position.x = 1.72;

    const finTop = this.trackMesh(
      MeshBuilder.CreateBox("station-preview-fin-top", { width: 0.2, height: 1.05, depth: 1.3 }, this.scene),
    );
    finTop.parent = this.root;
    finTop.position.set(0, 0.74, -1.1);
    finTop.material = hullMaterial;

    const finBottom = this.trackMesh(
      MeshBuilder.CreateBox("station-preview-fin-bottom", { width: 0.18, height: 0.55, depth: 1.2 }, this.scene),
    );
    finBottom.parent = this.root;
    finBottom.position.set(0, -0.62, -1.3);
    finBottom.material = accentMaterial;

    for (const x of [-0.58, 0.58]) {
      const glow = this.trackMesh(MeshBuilder.CreateSphere(
        `station-preview-engine-glow-${x}`,
        { diameter: 0.46, segments: 10 },
        this.scene,
      ));
      glow.parent = this.root;
      glow.position.set(x, 0, -3.12);
      glow.material = glowMaterial;
      this.engineGlowMeshes.push(glow);
    }
  }

  private clearShipVisual(): void {
    this.engineGlowMeshes.length = 0;
    this.shipRig?.dispose();
    this.shipRig = null;
    this.shipAsset?.dispose();
    this.shipAsset = null;

    for (const mesh of this.fallbackMeshes.splice(0)) {
      mesh.dispose();
    }
    for (const material of this.fallbackMaterials.splice(0)) {
      material.dispose();
    }
  }

  private fitCameraToShip(visualSize: Vector3): void {
    const maxExtent = Math.max(visualSize.x, visualSize.y, visualSize.z, 1);
    const radius = Math.max(8.5, maxExtent * 1.18);
    this.camera.target.set(0, visualSize.y * 0.08, 0);
    this.camera.radius = radius;
    this.camera.lowerRadiusLimit = Math.max(6, radius * 0.72);
    this.camera.upperRadiusLimit = Math.max(this.camera.lowerRadiusLimit + 1, radius * 1.28);
  }

  private trackMaterial(material: StandardMaterial): StandardMaterial {
    this.fallbackMaterials.push(material);
    return material;
  }

  private trackMesh(mesh: Mesh): Mesh {
    this.fallbackMeshes.push(mesh);
    return mesh;
  }

  private update(dt: number, timeMs: number): void {
    this.root.rotation.y += dt * 0.42;
    this.root.rotation.x = Math.sin(timeMs * 0.0007) * 0.08;
    this.root.position.y = Math.sin(timeMs * 0.0013) * 0.18;

    const pulse = 0.78 + (Math.sin(timeMs * 0.006) * 0.5 + 0.5) * 0.42;
    for (const glow of this.engineGlowMeshes) {
      glow.scaling.setAll(pulse);
    }
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.loadVersion += 1;
    window.removeEventListener("resize", this.resizeHandler);
    this.clearShipVisual();
    this.scene.dispose();
    this.engine.dispose();
  }
}
