import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { AudioManager } from "./audio";

type Asteroid = {
  mesh: Mesh;
  velocity: Vector3;
  radius: number;
  size: number;
  durability: number;
  spin: Vector3;
};

type Bullet = {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  radius: number;
};

type Explosion = {
  mesh: Mesh;
  material: StandardMaterial;
  age: number;
  duration: number;
  growth: number;
};

type HudRefs = {
  score: HTMLElement;
  lives: HTMLElement;
  shield: HTMLElement;
  speed: HTMLElement;
  status: HTMLElement;
  overlay: HTMLElement;
  finalScore: HTMLElement;
};

type SettingsRefs = {
  overlay: HTMLElement;
  openButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  invertHorizontal: HTMLInputElement;
  invertVertical: HTMLInputElement;
};

type ControlSettings = {
  invertHorizontal: boolean;
  invertVertical: boolean;
};

const ARENA_RESPAWN_MIN = 70;
const ARENA_RESPAWN_MAX = 150;
const TARGET_ASTEROID_COUNT = 18;
const SHIP_COLLISION_RADIUS = 2.2;
const FIRE_INTERVAL = 0.12;
const BULLET_SPEED = 155;
const MAX_DELTA_TIME = 0.05;
const SETTINGS_STORAGE_KEY = "aster3d-control-settings";

export class Aster3DGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly hud: HudRefs;
  private readonly settingsUi: SettingsRefs;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly shipRoot: TransformNode;
  private readonly starfieldRoot: TransformNode;
  private readonly audio = new AudioManager();
  private readonly keys = new Set<string>();

  private readonly asteroids: Asteroid[] = [];
  private readonly bullets: Bullet[] = [];
  private readonly explosions: Explosion[] = [];

  private mouseDown = false;
  private mouseLookX = 0;
  private mouseLookY = 0;
  private yaw = 0;
  private pitch = 0;
  private roll = 0;
  private score = 0;
  private lives = 3;
  private shield = 100;
  private invulnerability = 0;
  private fireCooldown = 0;
  private asteroidSpawnCooldown = 0;
  private statusFlash = 0;
  private gameOver = false;
  private settingsOpen = false;

  private readonly shipVelocity = new Vector3(0, 0, 0);
  private readonly controlSettings: ControlSettings;

  constructor(root: HTMLElement) {
    this.canvas = this.requireElement<HTMLCanvasElement>(root, ".game-canvas");
    this.hud = {
      score: this.requireElement(root, "[data-score]"),
      lives: this.requireElement(root, "[data-lives]"),
      shield: this.requireElement(root, "[data-shield]"),
      speed: this.requireElement(root, "[data-speed]"),
      status: this.requireElement(root, "[data-status]"),
      overlay: this.requireElement(root, "[data-game-over]"),
      finalScore: this.requireElement(root, "[data-final-score]"),
    };
    this.settingsUi = {
      overlay: this.requireElement(root, "[data-settings]"),
      openButton: this.requireElement(root, "[data-open-settings]"),
      closeButton: this.requireElement(root, "[data-close-settings]"),
      invertHorizontal: this.requireElement(root, "[data-invert-horizontal]"),
      invertVertical: this.requireElement(root, "[data-invert-vertical]"),
    };
    this.controlSettings = this.loadControlSettings();

    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.008, 0.015, 0.04, 1);

    const light = new HemisphericLight("keyLight", new Vector3(0.2, 1, -0.3), this.scene);
    light.intensity = 0.94;
    light.groundColor = new Color3(0.01, 0.03, 0.07);

    new GlowLayer("sceneGlow", this.scene, { blurKernelSize: 32 }).intensity = 0.65;

    this.shipRoot = new TransformNode("shipRoot", this.scene);
    this.shipRoot.rotationQuaternion = Quaternion.Identity();

    this.camera = new UniversalCamera("cockpitCamera", Vector3.Zero(), this.scene);
    this.camera.parent = this.shipRoot;
    this.camera.inputs.clear();
    this.camera.minZ = 0.05;
    this.camera.fov = 1;
    this.scene.activeCamera = this.camera;

    this.starfieldRoot = new TransformNode("starfieldRoot", this.scene);

    this.createCockpit();
    this.createStarfield();
    this.syncSettingsUi();
    this.bindEvents();
    this.resetRun();

    this.engine.runRenderLoop(() => {
      const dt = Math.min(this.engine.getDeltaTime() / 1000, MAX_DELTA_TIME);
      this.update(dt);
      this.scene.render();
    });
  }

  private bindEvents(): void {
    window.addEventListener("resize", () => {
      this.engine.resize();
    });

    window.addEventListener("keydown", (event) => {
      if (this.settingsOpen && event.code === "Escape") {
        this.closeSettings();
        return;
      }

      if (this.settingsOpen && event.code !== "Escape") {
        return;
      }

      this.keys.add(event.code);
      if (event.code === "Space" || event.code === "ShiftLeft" || event.code === "ShiftRight") {
        event.preventDefault();
      }
    });

    window.addEventListener("keyup", (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouseDown = false;
    });

    this.canvas.addEventListener("click", () => {
      void this.audio.resume();
      if (document.pointerLockElement !== this.canvas) {
        void this.canvas.requestPointerLock();
      }
    });

    this.canvas.addEventListener("mousedown", (event) => {
      if (event.button === 0) {
        this.mouseDown = true;
      }
    });

    window.addEventListener("mouseup", (event) => {
      if (event.button === 0) {
        this.mouseDown = false;
      }
    });

    window.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas || this.gameOver) {
        return;
      }

      this.mouseLookX += event.movementX;
      this.mouseLookY += event.movementY;
    });

    document.addEventListener("pointerlockchange", () => {
      if (document.pointerLockElement !== this.canvas) {
        this.mouseDown = false;
      }

      if (!this.gameOver && !this.settingsOpen) {
        this.setStatus(
          document.pointerLockElement === this.canvas
            ? "Mouse active. W/S thrust, A/D yaw, Shift boost, Space fire."
            : "Click to engage cockpit controls",
          1.25,
        );
      }
    });

    this.settingsUi.openButton.addEventListener("click", () => {
      void this.audio.resume();
      this.openSettings();
    });

    this.settingsUi.closeButton.addEventListener("click", () => {
      this.closeSettings();
    });

    this.settingsUi.overlay.addEventListener("click", (event) => {
      if (event.target === this.settingsUi.overlay) {
        this.closeSettings();
      }
    });

    this.settingsUi.invertHorizontal.addEventListener("change", () => {
      this.controlSettings.invertHorizontal = this.settingsUi.invertHorizontal.checked;
      this.persistControlSettings();
      this.setStatus(
        `Horizontal axis ${this.controlSettings.invertHorizontal ? "inverted" : "normal"}`,
        1.2,
      );
    });

    this.settingsUi.invertVertical.addEventListener("change", () => {
      this.controlSettings.invertVertical = this.settingsUi.invertVertical.checked;
      this.persistControlSettings();
      this.setStatus(
        `Vertical axis ${this.controlSettings.invertVertical ? "inverted" : "normal"}`,
        1.2,
      );
    });
  }

  private update(dt: number): void {
    if (this.settingsOpen) {
      this.updateHud();
      return;
    }

    if (this.keys.has("KeyR") && this.gameOver) {
      this.resetRun();
    }

    if (this.gameOver) {
      this.updateHud();
      return;
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    this.asteroidSpawnCooldown = Math.max(0, this.asteroidSpawnCooldown - dt);
    this.statusFlash = Math.max(0, this.statusFlash - dt);

    this.updateShip(dt);
    this.updateBullets(dt);
    this.updateAsteroids(dt);
    this.updateExplosions(dt);
    this.spawnAsteroidsIfNeeded();

    this.starfieldRoot.position.copyFrom(this.shipRoot.position);
    this.updateHud();
  }

  private updateShip(dt: number): void {
    const pointerActive = document.pointerLockElement === this.canvas;
    const yawInput = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const thrustInput = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) * 0.6;
    const boost = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const fireRequested = this.keys.has("Space") || (pointerActive && this.mouseDown);

    if (pointerActive) {
      const horizontalSign = this.controlSettings.invertHorizontal ? 1 : -1;
      const verticalSign = this.controlSettings.invertVertical ? 1 : -1;
      this.yaw += this.mouseLookX * 0.0024 * horizontalSign;
      this.pitch = clamp(this.pitch + this.mouseLookY * 0.002 * verticalSign, -1.1, 1.1);
    }

    this.mouseLookX = 0;
    this.mouseLookY = 0;

    this.yaw += yawInput * dt * 1.75;
    this.roll = damp(this.roll, -(yawInput * 0.22), 4.6, dt);

    this.shipRoot.rotationQuaternion = Quaternion.RotationYawPitchRoll(this.yaw, this.pitch, this.roll);

    const forward = this.camera.getDirection(Vector3.Forward(this.scene.useRightHandedSystem)).normalize();
    const thrust = boost ? 66 : 42;
    if (thrustInput !== 0) {
      this.shipVelocity.addInPlace(forward.scale(thrustInput * thrust * dt));
    }

    this.shipVelocity.scaleInPlace(Math.exp(-0.55 * dt));
    this.shipRoot.position.addInPlace(this.shipVelocity.scale(dt));

    if (fireRequested && this.fireCooldown === 0) {
      this.fireBullet(forward);
      this.fireCooldown = FIRE_INTERVAL;
    }
  }

  private updateBullets(dt: number): void {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      bullet.life -= dt;
      bullet.mesh.position.addInPlace(bullet.velocity.scale(dt));

      if (bullet.life <= 0 || Vector3.DistanceSquared(this.shipRoot.position, bullet.mesh.position) > 140_000) {
        this.disposeBullet(index);
        continue;
      }

      let bulletDestroyed = false;
      for (let asteroidIndex = this.asteroids.length - 1; asteroidIndex >= 0; asteroidIndex -= 1) {
        const asteroid = this.asteroids[asteroidIndex];
        const collisionRadius = asteroid.radius + bullet.radius;

        if (
          Vector3.DistanceSquared(bullet.mesh.position, asteroid.mesh.position) <=
          collisionRadius * collisionRadius
        ) {
          this.damageAsteroid(asteroidIndex, bullet.velocity);
          this.disposeBullet(index);
          bulletDestroyed = true;
          break;
        }
      }

      if (bulletDestroyed) {
        continue;
      }
    }
  }

  private updateAsteroids(dt: number): void {
    for (let index = this.asteroids.length - 1; index >= 0; index -= 1) {
      const asteroid = this.asteroids[index];
      asteroid.mesh.position.addInPlace(asteroid.velocity.scale(dt));
      asteroid.mesh.rotation.x += asteroid.spin.x * dt;
      asteroid.mesh.rotation.y += asteroid.spin.y * dt;
      asteroid.mesh.rotation.z += asteroid.spin.z * dt;

      if (Vector3.DistanceSquared(this.shipRoot.position, asteroid.mesh.position) > 95_000) {
        this.repositionAsteroid(asteroid);
      }

      const collisionRadius = asteroid.radius + SHIP_COLLISION_RADIUS;
      if (
        this.invulnerability === 0 &&
        Vector3.DistanceSquared(this.shipRoot.position, asteroid.mesh.position) <=
          collisionRadius * collisionRadius
      ) {
        const impactDamage = 14 + asteroid.size * 6;
        this.applyShipDamage(impactDamage);
        this.spawnExplosion(asteroid.mesh.position, asteroid.size * 0.8, new Color3(1, 0.43, 0.3));
        this.audio.playExplosion(asteroid.size * 0.2);
        this.repositionAsteroid(asteroid);
      }
    }
  }

  private updateExplosions(dt: number): void {
    for (let index = this.explosions.length - 1; index >= 0; index -= 1) {
      const explosion = this.explosions[index];
      explosion.age += dt;
      const progress = explosion.age / explosion.duration;

      if (progress >= 1) {
        explosion.mesh.dispose();
        explosion.material.dispose();
        this.explosions.splice(index, 1);
        continue;
      }

      const scale = 1 + progress * explosion.growth;
      explosion.mesh.scaling.setAll(scale);
      explosion.material.alpha = 1 - progress;
    }
  }

  private fireBullet(forward: Vector3): void {
    this.audio.playShot();

    const bulletMaterial = new StandardMaterial(`bullet-mat-${performance.now()}`, this.scene);
    bulletMaterial.disableLighting = true;
    bulletMaterial.emissiveColor = new Color3(0.55, 0.98, 1);
    bulletMaterial.diffuseColor = new Color3(0.15, 0.85, 1);

    const bulletMesh = MeshBuilder.CreateSphere(
      `bullet-${performance.now()}`,
      { diameter: 0.34, segments: 6 },
      this.scene,
    );
    bulletMesh.material = bulletMaterial;
    bulletMesh.position.copyFrom(this.camera.globalPosition.add(forward.scale(2.2)));

    this.bullets.push({
      mesh: bulletMesh,
      velocity: forward.scale(BULLET_SPEED).add(this.shipVelocity.scale(0.45)),
      life: 1.6,
      radius: 0.4,
    });
  }

  private damageAsteroid(index: number, impulse: Vector3): void {
    const asteroid = this.asteroids[index];
    asteroid.durability -= 1;
    asteroid.velocity.addInPlace(impulse.normalize().scale(3.8));

    this.spawnExplosion(asteroid.mesh.position, asteroid.size * 0.45, new Color3(0.58, 0.94, 1));

    if (asteroid.durability > 0) {
      this.audio.playExplosion(0.58);
      return;
    }

    const impactPosition = asteroid.mesh.position.clone();
    const asteroidVelocity = asteroid.velocity.clone();
    const nextSize = asteroid.size * 0.62;

    this.score += Math.round(asteroid.size * 28);
    asteroid.mesh.dispose();
    this.asteroids.splice(index, 1);
    this.spawnExplosion(impactPosition, asteroid.size * 0.9, new Color3(1, 0.68, 0.34));
    this.audio.playExplosion(asteroid.size * 0.24);

    if (nextSize > 1.65) {
      const splitDirection = randomUnitVector();
      this.spawnAsteroid(nextSize, impactPosition.add(splitDirection.scale(nextSize * 1.2)), asteroidVelocity.add(splitDirection.scale(8)));
      this.spawnAsteroid(
        nextSize * 0.92,
        impactPosition.add(splitDirection.scale(-nextSize * 1.2)),
        asteroidVelocity.add(splitDirection.scale(-8)),
      );
    }
  }

  private applyShipDamage(amount: number): void {
    this.shield = Math.max(0, this.shield - amount);
    this.invulnerability = 1.15;

    if (this.shield > 0) {
      this.setStatus(`Shield hit: ${Math.round(this.shield)}% integrity remaining`, 1.2);
      return;
    }

    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.gameOver = true;
      this.hud.overlay.classList.remove("hidden");
      this.hud.finalScore.textContent = `Final score: ${this.score}`;
      this.setStatus("Hull integrity lost. Press R to relaunch.", 999);
      return;
    }

    this.setStatus(`Ship lost. ${this.lives} lives remaining. Relaunching...`, 1.8);
    this.resetShipState();
    this.seedAsteroids();
  }

  private spawnAsteroidsIfNeeded(): void {
    if (this.asteroidSpawnCooldown > 0 || this.asteroids.length >= TARGET_ASTEROID_COUNT) {
      return;
    }

    this.spawnAsteroid(randomBetween(2.2, 5.2));
    this.asteroidSpawnCooldown = 0.9;
  }

  private spawnAsteroid(size: number, position?: Vector3, velocity?: Vector3): void {
    const asteroidMesh = MeshBuilder.CreateIcoSphere(
      `asteroid-${performance.now()}`,
      { radius: size, subdivisions: size > 2.5 ? 1 : 0 },
      this.scene,
    );
    asteroidMesh.convertToFlatShadedMesh();
    asteroidMesh.scaling = new Vector3(
      randomBetween(0.7, 1.4),
      randomBetween(0.72, 1.36),
      randomBetween(0.74, 1.44),
    );
    asteroidMesh.position.copyFrom(position ?? this.randomSpawnPoint());
    asteroidMesh.rotation = new Vector3(
      randomBetween(0, Math.PI),
      randomBetween(0, Math.PI),
      randomBetween(0, Math.PI),
    );

    const asteroidMaterial = new StandardMaterial(`asteroid-mat-${performance.now()}`, this.scene);
    const hueShift = randomBetween(-0.04, 0.08);
    asteroidMaterial.diffuseColor = new Color3(0.31 + hueShift, 0.27 + hueShift * 0.65, 0.24 + hueShift * 0.4);
    asteroidMaterial.emissiveColor = new Color3(0.02, 0.03, 0.045);
    asteroidMaterial.specularColor = Color3.Black();
    asteroidMesh.material = asteroidMaterial;

    this.asteroids.push({
      mesh: asteroidMesh,
      velocity:
        velocity ??
        randomUnitVector()
          .scale(randomBetween(5.5, 15))
          .add(this.shipVelocity.scale(randomBetween(0.1, 0.25))),
      radius: size * Math.max(asteroidMesh.scaling.x, asteroidMesh.scaling.y, asteroidMesh.scaling.z),
      size,
      durability: Math.max(1, Math.round(size * 1.15)),
      spin: new Vector3(
        randomBetween(-1.2, 1.2),
        randomBetween(-1.1, 1.1),
        randomBetween(-1.3, 1.3),
      ),
    });
  }

  private repositionAsteroid(asteroid: Asteroid): void {
    asteroid.mesh.position.copyFrom(this.randomSpawnPoint());
    asteroid.velocity = randomUnitVector()
      .scale(randomBetween(4.8, 12.5))
      .add(this.shipVelocity.scale(randomBetween(0.12, 0.22)));
  }

  private spawnExplosion(position: Vector3, radius: number, color: Color3): void {
    const flash = MeshBuilder.CreateSphere(
      `explosion-${performance.now()}`,
      { diameter: Math.max(0.4, radius) },
      this.scene,
    );
    flash.position.copyFrom(position);

    const material = new StandardMaterial(`explosion-mat-${performance.now()}`, this.scene);
    material.disableLighting = true;
    material.emissiveColor = color;
    material.diffuseColor = color.scale(0.4);
    material.alpha = 0.95;
    flash.material = material;

    this.explosions.push({
      mesh: flash,
      material,
      age: 0,
      duration: randomBetween(0.18, 0.42),
      growth: randomBetween(1.8, 3.2),
    });
  }

  private disposeBullet(index: number): void {
    const bullet = this.bullets[index];
    const material = bullet.mesh.material;
    bullet.mesh.dispose();
    if (material instanceof StandardMaterial) {
      material.dispose();
    }
    this.bullets.splice(index, 1);
  }

  private resetRun(): void {
    this.score = 0;
    this.lives = 3;
    this.shield = 100;
    this.gameOver = false;
    this.hud.overlay.classList.add("hidden");
    this.setStatus("Click to engage cockpit controls", 1.8);
    this.resetShipState();
    this.seedAsteroids();
    this.clearBullets();
    this.clearExplosions();
    this.updateHud();
  }

  private resetShipState(): void {
    this.shipRoot.position.copyFromFloats(0, 0, 0);
    this.shipVelocity.copyFromFloats(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.roll = 0;
    this.shipRoot.rotationQuaternion = Quaternion.Identity();
    this.shield = 100;
    this.invulnerability = 2.2;
    this.fireCooldown = 0;
  }

  private seedAsteroids(): void {
    for (const asteroid of this.asteroids) {
      const material = asteroid.mesh.material;
      asteroid.mesh.dispose();
      if (material instanceof StandardMaterial) {
        material.dispose();
      }
    }

    this.asteroids.length = 0;

    for (let index = 0; index < 5; index += 1) {
      this.spawnAsteroid(
        randomBetween(2.6, 4.8),
        new Vector3(
          randomBetween(-22, 22),
          randomBetween(-14, 14),
          randomBetween(55, 95),
        ),
      );
    }

    for (let index = this.asteroids.length; index < TARGET_ASTEROID_COUNT; index += 1) {
      this.spawnAsteroid(randomBetween(2.2, 5.4));
    }
  }

  private clearBullets(): void {
    while (this.bullets.length > 0) {
      this.disposeBullet(this.bullets.length - 1);
    }
  }

  private clearExplosions(): void {
    for (const explosion of this.explosions) {
      explosion.mesh.dispose();
      explosion.material.dispose();
    }
    this.explosions.length = 0;
  }

  private createCockpit(): void {
    const cockpitMaterial = new StandardMaterial("cockpit-mat", this.scene);
    cockpitMaterial.diffuseColor = new Color3(0.08, 0.12, 0.2);
    cockpitMaterial.emissiveColor = new Color3(0.02, 0.13, 0.18);
    cockpitMaterial.specularColor = new Color3(0.1, 0.18, 0.25);
    cockpitMaterial.alpha = 0.96;

    const accentMaterial = new StandardMaterial("accent-mat", this.scene);
    accentMaterial.disableLighting = true;
    accentMaterial.emissiveColor = new Color3(0.25, 0.85, 1);
    accentMaterial.diffuseColor = new Color3(0.08, 0.45, 0.72);

    const createPart = (
      name: string,
      dimensions: { width: number; height: number; depth: number },
      position: Vector3,
      rotation: Vector3,
      material: StandardMaterial,
    ): Mesh => {
      const mesh = MeshBuilder.CreateBox(name, dimensions, this.scene);
      mesh.parent = this.camera;
      mesh.position.copyFrom(position);
      mesh.rotation.copyFrom(rotation);
      mesh.material = material;
      return mesh;
    };

    createPart(
      "cockpit-left-frame",
      { width: 0.08, height: 1.9, depth: 0.08 },
      new Vector3(-1.08, -0.12, 2.3),
      new Vector3(0, 0, -0.28),
      cockpitMaterial,
    );

    createPart(
      "cockpit-right-frame",
      { width: 0.08, height: 1.9, depth: 0.08 },
      new Vector3(1.08, -0.12, 2.3),
      new Vector3(0, 0, 0.28),
      cockpitMaterial,
    );

    createPart(
      "cockpit-top-frame",
      { width: 2.4, height: 0.08, depth: 0.08 },
      new Vector3(0, 0.82, 2.18),
      new Vector3(0.09, 0, 0),
      cockpitMaterial,
    );

    createPart(
      "cockpit-console",
      { width: 2.6, height: 0.42, depth: 0.9 },
      new Vector3(0, -1.02, 1.52),
      new Vector3(-0.2, 0, 0),
      cockpitMaterial,
    );

    createPart(
      "cockpit-display-left",
      { width: 0.46, height: 0.14, depth: 0.05 },
      new Vector3(-0.64, -0.82, 1.16),
      new Vector3(-0.5, 0.08, 0),
      accentMaterial,
    );

    createPart(
      "cockpit-display-right",
      { width: 0.46, height: 0.14, depth: 0.05 },
      new Vector3(0.64, -0.82, 1.16),
      new Vector3(-0.5, -0.08, 0),
      accentMaterial,
    );

    createPart(
      "cockpit-display-center",
      { width: 0.36, height: 0.18, depth: 0.05 },
      new Vector3(0, -0.74, 1.08),
      new Vector3(-0.54, 0, 0),
      accentMaterial,
    );
  }

  private createStarfield(): void {
    const white = new Color3(0.92, 0.96, 1);
    const blue = new Color3(0.58, 0.82, 1);

    for (let index = 0; index < 360; index += 1) {
      const star = MeshBuilder.CreateSphere(`star-${index}`, { diameter: randomBetween(0.22, 0.74) }, this.scene);
      const starMaterial = new StandardMaterial(`star-mat-${index}`, this.scene);
      starMaterial.disableLighting = true;
      starMaterial.emissiveColor = randomBetween(0, 1) > 0.72 ? blue : white;
      starMaterial.alpha = randomBetween(0.65, 1);
      star.material = starMaterial;
      star.parent = this.starfieldRoot;
      star.position.copyFrom(randomUnitVector().scale(randomBetween(180, 520)));
    }
  }

  private updateHud(): void {
    this.hud.score.textContent = this.score.toString();
    this.hud.lives.textContent = this.lives.toString();
    this.hud.shield.textContent = `${Math.round(this.shield)}%`;
    this.hud.speed.textContent = Math.round(this.shipVelocity.length()).toString();

    if (this.statusFlash === 0 && !this.gameOver && document.pointerLockElement === this.canvas) {
      this.hud.status.textContent = "W/S thrust  A/D yaw  Mouse look  Shift boost  Space fire";
    }
  }

  private setStatus(text: string, duration: number): void {
    this.hud.status.textContent = text;
    this.statusFlash = duration;
  }

  private openSettings(): void {
    this.settingsOpen = true;
    this.mouseDown = false;
    this.keys.clear();
    this.settingsUi.overlay.classList.remove("hidden");
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    this.setStatus("Configuration open", 999);
  }

  private closeSettings(): void {
    this.settingsOpen = false;
    this.settingsUi.overlay.classList.add("hidden");
    this.setStatus("Click to engage cockpit controls", 1.8);
  }

  private syncSettingsUi(): void {
    this.settingsUi.invertHorizontal.checked = this.controlSettings.invertHorizontal;
    this.settingsUi.invertVertical.checked = this.controlSettings.invertVertical;
  }

  private loadControlSettings(): ControlSettings {
    const fallback: ControlSettings = {
      invertHorizontal: false,
      invertVertical: false,
    };

    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<ControlSettings>;
      return {
        invertHorizontal: Boolean(parsed.invertHorizontal),
        invertVertical: Boolean(parsed.invertVertical),
      };
    } catch {
      return fallback;
    }
  }

  private persistControlSettings(): void {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.controlSettings));
  }

  private randomSpawnPoint(): Vector3 {
    return this.shipRoot.position.add(randomUnitVector().scale(randomBetween(ARENA_RESPAWN_MIN, ARENA_RESPAWN_MAX)));
  }

  private requireElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing required element: ${selector}`);
    }
    return element;
  }
}

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomUnitVector(): Vector3 {
  const vector = new Vector3(
    randomBetween(-1, 1),
    randomBetween(-1, 1),
    randomBetween(-1, 1),
  );

  if (vector.lengthSquared() < 0.001) {
    return randomUnitVector();
  }

  return vector.normalize();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}
