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
  radius: number;
  size: number;
  durability: number;
  spin: Vector3;
  velocity: Vector3;
  sectorKey: string | null;
};

type Bullet = {
  mesh: Mesh;
  velocity: Vector3;
  life: number;
  radius: number;
  hostile: boolean;
  damage: number;
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
  boost: HTMLElement;
  speed: HTMLElement;
  objectiveDistance: HTMLElement;
  boostVeil: HTMLElement;
  objectiveEdge: HTMLElement;
  objectiveEdgeArrow: HTMLElement;
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

type SectorData = {
  key: string;
  x: number;
  y: number;
  z: number;
  asteroids: Asteroid[];
  enemies: Enemy[];
};

type Collectible = {
  mesh: Mesh;
  pulse: number;
  position: Vector3;
  objective: boolean;
};

type EnemyState = "pursuit" | "attack" | "recover";

type Enemy = {
  root: TransformNode;
  velocity: Vector3;
  radius: number;
  health: number;
  fireCooldown: number;
  recoverTimer: number;
  strafeSign: number;
  state: EnemyState;
  sectorKey: string | null;
};

const WORLD_SECTOR_SIZE = 220;
const WORLD_LOAD_RADIUS = 2;
const WORLD_UNLOAD_RADIUS = 3;
const SHIP_COLLISION_RADIUS = 2.2;
const FIRE_INTERVAL = 0.12;
const BULLET_SPEED = 155;
const MAX_DELTA_TIME = 0.05;
const SETTINGS_STORAGE_KEY = "aster3d-control-settings";
const COLLECTIBLE_PICKUP_RADIUS = 7;
const OBJECTIVE_MIN_DISTANCE = 520;
const OBJECTIVE_MAX_DISTANCE = 760;
const BOOST_MAX = 100;
const BOOST_DRAIN_PER_SECOND = 58;
const BOOST_REGEN_PER_SECOND = 18;
const ENEMY_ATTACK_RANGE = 165;
const ENEMY_MAX_SPEED = 33;
const ENEMY_BULLET_SPEED = 92;
const ENEMY_COLLISION_RADIUS = 2.8;
const ENEMY_VIEW_DISTANCE = WORLD_SECTOR_SIZE * (WORLD_UNLOAD_RADIUS + 1.2);
const ASTEROID_SALVAGE_DROP_CHANCE = 0.2;
const ENEMY_SALVAGE_DROP_CHANCE = 0.4;

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
  private readonly loadedSectors = new Map<string, SectorData>();

  private readonly asteroids: Asteroid[] = [];
  private readonly enemies: Enemy[] = [];
  private readonly bullets: Bullet[] = [];
  private readonly explosions: Explosion[] = [];
  private readonly collectibles: Collectible[] = [];

  private mouseLookX = 0;
  private mouseLookY = 0;
  private score = 0;
  private lives = 3;
  private shield = 100;
  private invulnerability = 0;
  private fireCooldown = 0;
  private statusFlash = 0;
  private gameOver = false;
  private settingsOpen = false;
  private worldSeed = Math.random();
  private collectedSalvage = 0;
  private boostCharge = BOOST_MAX;
  private boostVisual = 0;
  private boostHoldTime = 0;

  private readonly shipVelocity = new Vector3(0, 0, 0);
  private readonly controlSettings: ControlSettings;
  private objectiveDirection = new Vector3(0.24, 0.08, 0.97).normalize();

  constructor(root: HTMLElement) {
    this.canvas = this.requireElement<HTMLCanvasElement>(root, ".game-canvas");
    this.hud = {
      score: this.requireElement(root, "[data-score]"),
      lives: this.requireElement(root, "[data-lives]"),
      shield: this.requireElement(root, "[data-shield]"),
      boost: this.requireElement(root, "[data-boost]"),
      speed: this.requireElement(root, "[data-speed]"),
      objectiveDistance: this.requireElement(root, "[data-objective-distance]"),
      boostVeil: this.requireElement(root, "[data-boost-veil]"),
      objectiveEdge: this.requireElement(root, "[data-objective-edge]"),
      objectiveEdgeArrow: this.requireElement(root, ".objective-edge__arrow"),
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
    });

    this.canvas.addEventListener("click", () => {
      void this.audio.resume();
      if (document.pointerLockElement !== this.canvas) {
        void this.canvas.requestPointerLock();
      }
    });

    document.addEventListener("mousemove", (event) => {
      if (document.pointerLockElement !== this.canvas || this.gameOver) {
        return;
      }

      this.mouseLookX += event.movementX;
      this.mouseLookY += event.movementY;
    });

    document.addEventListener("pointerlockchange", () => {
      if (!this.gameOver && !this.settingsOpen) {
        this.setStatus(
          document.pointerLockElement === this.canvas
            ? "Mouse active. Mouse yaw/pitch, A/D yaw, Q/E roll, Shift boost, Space fire."
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
    this.statusFlash = Math.max(0, this.statusFlash - dt);

    this.syncWorldSectors();
    this.updateShip(dt);
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateAsteroids(dt);
    this.updateObjective(dt);
    this.updateExplosions(dt);

    this.starfieldRoot.position.copyFrom(this.shipRoot.position);
    this.updateHud();
  }

  private updateShip(dt: number): void {
    const pointerActive = document.pointerLockElement === this.canvas;
    const yawInput = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const rollInput = (this.keys.has("KeyE") ? 1 : 0) - (this.keys.has("KeyQ") ? 1 : 0);
    const throttleInput = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) * 0.6;
    const boostRequested = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const boostActive = boostRequested && this.boostCharge > 0;
    const fireRequested = this.keys.has("Space");

    let yawDelta = yawInput * dt * 1.7;
    let pitchDelta = 0;
    let rollDelta = rollInput * dt * 1.95;

    if (pointerActive) {
      const horizontalSign = this.controlSettings.invertHorizontal ? 1 : -1;
      const verticalSign = this.controlSettings.invertVertical ? 1 : -1;
      yawDelta += this.mouseLookX * 0.0024 * horizontalSign;
      pitchDelta += this.mouseLookY * 0.002 * verticalSign;
    }

    this.mouseLookX = 0;
    this.mouseLookY = 0;

    const orientation = this.shipRoot.rotationQuaternion ?? Quaternion.Identity();
    const localDelta = Quaternion.RotationYawPitchRoll(yawDelta, pitchDelta, rollDelta);
    this.shipRoot.rotationQuaternion = orientation.multiply(localDelta).normalize();

    const forward = this.camera.getDirection(Vector3.Forward(this.scene.useRightHandedSystem)).normalize();
    const thrustInput = boostActive && throttleInput <= 0 ? 1 : throttleInput;
    const thrust = boostActive ? 118 : 42;
    if (thrustInput !== 0) {
      this.shipVelocity.addInPlace(forward.scale(thrustInput * thrust * dt));
    }

    if (boostActive) {
      this.boostCharge = Math.max(0, this.boostCharge - BOOST_DRAIN_PER_SECOND * dt);
      this.boostHoldTime = Math.min(1.8, this.boostHoldTime + dt);
    } else {
      this.boostCharge = Math.min(BOOST_MAX, this.boostCharge + BOOST_REGEN_PER_SECOND * dt);
      this.boostHoldTime = Math.max(0, this.boostHoldTime - dt * 2.2);
    }
    this.boostVisual += ((boostActive ? 1 : 0) - this.boostVisual) * (1 - Math.exp(-10 * dt));

    this.shipVelocity.scaleInPlace(Math.exp(-0.55 * dt));
    this.shipRoot.position.addInPlace(this.shipVelocity.scale(dt));
    this.audio.setEngine(this.shipVelocity.length() / 160, this.boostHoldTime / 1.8);

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

      if (bullet.hostile) {
        const collisionRadius = SHIP_COLLISION_RADIUS + bullet.radius;
        if (
          Vector3.DistanceSquared(this.shipRoot.position, bullet.mesh.position) <=
          collisionRadius * collisionRadius
        ) {
          if (this.invulnerability === 0) {
            this.applyShipDamage(bullet.damage);
            this.spawnExplosion(bullet.mesh.position, 1.8, new Color3(1, 0.42, 0.24));
            this.audio.playExplosion(0.54);
          }
          this.disposeBullet(index);
        }
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

      for (let enemyIndex = this.enemies.length - 1; enemyIndex >= 0; enemyIndex -= 1) {
        const enemy = this.enemies[enemyIndex];
        const collisionRadius = enemy.radius + bullet.radius;
        if (
          Vector3.DistanceSquared(bullet.mesh.position, enemy.root.position) <=
          collisionRadius * collisionRadius
        ) {
          this.damageEnemy(enemyIndex, bullet.velocity);
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

  private updateEnemies(dt: number): void {
    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
      enemy.recoverTimer = Math.max(0, enemy.recoverTimer - dt);
      const modelForwardAxis = Vector3.Backward(this.scene.useRightHandedSystem);

      if (
        enemy.sectorKey === null &&
        Vector3.DistanceSquared(this.shipRoot.position, enemy.root.position) > ENEMY_VIEW_DISTANCE ** 2
      ) {
        this.disposeEnemy(enemy);
        this.enemies.splice(index, 1);
        continue;
      }

      const toShip = this.shipRoot.position.subtract(enemy.root.position);
      const distance = Math.max(0.001, toShip.length());
      const currentForward = enemy.root.getDirection(modelForwardAxis).normalize();
      const currentUp = enemy.root.getDirection(Vector3.Up()).normalize();
      const currentRight = enemy.root.getDirection(Vector3.Right()).normalize();
      const toShipDirection = toShip.scale(1 / distance);
      const forwardDot = Vector3.Dot(currentForward, toShipDirection);

      let desiredDirection = toShipDirection;
      if (enemy.recoverTimer > 0) {
        enemy.state = "recover";
        desiredDirection = toShipDirection.scale(-1).add(currentRight.scale(enemy.strafeSign * 0.72)).normalize();
      } else if (distance < 42 && forwardDot > 0.64) {
        enemy.state = "recover";
        enemy.recoverTimer = randomBetween(1.1, 1.8);
        desiredDirection = toShipDirection.scale(-1).add(currentRight.scale(enemy.strafeSign * 0.72)).normalize();
      } else if (distance <= ENEMY_ATTACK_RANGE) {
        enemy.state = "attack";
      } else {
        enemy.state = "pursuit";
      }

      const targetRotation = this.scene.useRightHandedSystem
        ? Quaternion.FromLookDirectionRH(desiredDirection.scale(-1), currentUp)
        : Quaternion.FromLookDirectionLH(desiredDirection.scale(-1), currentUp);
      const rotation = enemy.root.rotationQuaternion ?? Quaternion.Identity();
      enemy.root.rotationQuaternion = Quaternion.Slerp(rotation, targetRotation, 1 - Math.exp(-1.9 * dt)).normalize();

      const noseDirection = enemy.root.getDirection(modelForwardAxis).normalize();
      const thrust =
        enemy.state === "recover"
          ? 24
          : enemy.state === "attack"
            ? 16
            : 20;
      enemy.velocity.addInPlace(noseDirection.scale(thrust * dt));
      enemy.velocity.scaleInPlace(Math.exp(-1.05 * dt));
      if (enemy.velocity.lengthSquared() > ENEMY_MAX_SPEED * ENEMY_MAX_SPEED) {
        enemy.velocity.normalize().scaleInPlace(ENEMY_MAX_SPEED);
      }
      enemy.root.position.addInPlace(enemy.velocity.scale(dt));

      const toShipAfterMove = this.shipRoot.position.subtract(enemy.root.position);
      const distanceAfterMove = Math.max(0.001, toShipAfterMove.length());
      const attackDirection = toShipAfterMove.scale(1 / distanceAfterMove);

      if (
        enemy.state === "attack" &&
        distanceAfterMove <= ENEMY_ATTACK_RANGE &&
        enemy.fireCooldown === 0
      ) {
        const aimDirection = attackDirection.add(this.shipVelocity.scale(0.012)).normalize();
        this.fireEnemyBullet(enemy, aimDirection);
        enemy.fireCooldown = randomBetween(0.92, 1.28);
      }

      const collisionRadius = enemy.radius + SHIP_COLLISION_RADIUS;
      if (
        this.invulnerability === 0 &&
        Vector3.DistanceSquared(this.shipRoot.position, enemy.root.position) <= collisionRadius * collisionRadius
      ) {
        this.applyShipDamage(20);
        this.damageEnemy(index, this.shipVelocity.add(currentForward.scale(10)), true);
        this.spawnExplosion(enemy.root.position, enemy.radius * 0.9, new Color3(1, 0.34, 0.26));
        this.audio.playExplosion(0.8);
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

      if (
        asteroid.sectorKey === null &&
        Vector3.DistanceSquared(this.shipRoot.position, asteroid.mesh.position) >
          (WORLD_SECTOR_SIZE * (WORLD_UNLOAD_RADIUS + 1.5)) ** 2
      ) {
        this.disposeAsteroid(asteroid);
        this.asteroids.splice(index, 1);
        continue;
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
        const pushDirection = this.shipRoot.position.subtract(asteroid.mesh.position);
        if (pushDirection.lengthSquared() > 0.01) {
          this.shipRoot.position.addInPlace(pushDirection.normalize().scale(collisionRadius + 2));
        }
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
      hostile: false,
      damage: 1,
    });
  }

  private fireEnemyBullet(enemy: Enemy, direction: Vector3): void {
    this.audio.playEnemyShot();

    const bulletMaterial = new StandardMaterial(`enemy-bullet-mat-${performance.now()}`, this.scene);
    bulletMaterial.disableLighting = true;
    bulletMaterial.emissiveColor = new Color3(1, 0.42, 0.18);
    bulletMaterial.diffuseColor = new Color3(1, 0.2, 0.12);

    const bulletMesh = MeshBuilder.CreateSphere(
      `enemy-bullet-${performance.now()}`,
      { diameter: 0.58, segments: 6 },
      this.scene,
    );
    bulletMesh.material = bulletMaterial;
    bulletMesh.position.copyFrom(enemy.root.position.add(direction.scale(enemy.radius + 1.1)));

    this.bullets.push({
      mesh: bulletMesh,
      velocity: direction.scale(ENEMY_BULLET_SPEED).add(enemy.velocity.scale(0.55)),
      life: 2.8,
      radius: 0.58,
      hostile: true,
      damage: 13,
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
    this.detachAsteroidFromSector(asteroid);
    asteroid.mesh.dispose();
    this.asteroids.splice(index, 1);
    this.spawnExplosion(impactPosition, asteroid.size * 0.9, new Color3(1, 0.68, 0.34));
    this.audio.playExplosion(asteroid.size * 0.24);
    if (Math.random() < ASTEROID_SALVAGE_DROP_CHANCE) {
      this.spawnAsteroidSalvage(impactPosition);
    }

    if (nextSize > 1.65) {
      const splitDirection = randomUnitVector();
      this.spawnAsteroid(
        nextSize,
        impactPosition.add(splitDirection.scale(nextSize * 1.2)),
        asteroidVelocity.add(splitDirection.scale(8)),
      );
      this.spawnAsteroid(
        nextSize * 0.92,
        impactPosition.add(splitDirection.scale(-nextSize * 1.2)),
        asteroidVelocity.add(splitDirection.scale(-8)),
      );
    }
  }

  private damageEnemy(index: number, impulse: Vector3, collisionKill = false): void {
    const enemy = this.enemies[index];
    enemy.health -= collisionKill ? 99 : 1;
    if (impulse.lengthSquared() > 0.001) {
      enemy.velocity.addInPlace(impulse.normalize().scale(4.8));
    }

    this.spawnExplosion(enemy.root.position, enemy.radius * 0.55, new Color3(1, 0.48, 0.26));

    if (enemy.health > 0) {
      this.audio.playExplosion(0.58);
      enemy.recoverTimer = Math.max(enemy.recoverTimer, 0.75);
      return;
    }

    this.score += 180;
    this.detachEnemyFromSector(enemy);
    this.spawnExplosion(enemy.root.position, enemy.radius * 1.15, new Color3(1, 0.24, 0.22));
    this.audio.playExplosion(0.92);
    if (Math.random() < ENEMY_SALVAGE_DROP_CHANCE) {
      this.spawnAsteroidSalvage(enemy.root.position.clone());
    }
    this.disposeEnemy(enemy);
    this.enemies.splice(index, 1);
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
    this.resetShipState(true);
  }

  private syncWorldSectors(): void {
    const centerX = Math.floor(this.shipRoot.position.x / WORLD_SECTOR_SIZE);
    const centerY = Math.floor(this.shipRoot.position.y / WORLD_SECTOR_SIZE);
    const centerZ = Math.floor(this.shipRoot.position.z / WORLD_SECTOR_SIZE);

    for (let offsetX = -WORLD_LOAD_RADIUS; offsetX <= WORLD_LOAD_RADIUS; offsetX += 1) {
      for (let offsetY = -WORLD_LOAD_RADIUS; offsetY <= WORLD_LOAD_RADIUS; offsetY += 1) {
        for (let offsetZ = -WORLD_LOAD_RADIUS; offsetZ <= WORLD_LOAD_RADIUS; offsetZ += 1) {
          if (offsetX * offsetX + offsetY * offsetY + offsetZ * offsetZ > WORLD_LOAD_RADIUS * WORLD_LOAD_RADIUS) {
            continue;
          }

          const x = centerX + offsetX;
          const y = centerY + offsetY;
          const z = centerZ + offsetZ;
          const key = sectorKey(x, y, z);
          if (!this.loadedSectors.has(key)) {
            this.loadSector(x, y, z);
          }
        }
      }
    }

    for (const sector of [...this.loadedSectors.values()]) {
      const dx = sector.x - centerX;
      const dy = sector.y - centerY;
      const dz = sector.z - centerZ;
      if (dx * dx + dy * dy + dz * dz > WORLD_UNLOAD_RADIUS * WORLD_UNLOAD_RADIUS) {
        this.unloadSector(sector.key);
      }
    }
  }

  private loadSector(x: number, y: number, z: number): void {
    const key = sectorKey(x, y, z);
    const rng = mulberry32(hashSector(this.worldSeed, x, y, z));
    const asteroidCount = 1 + (rng() > 0.35 ? 1 : 0) + (rng() > 0.88 ? 1 : 0);
    const sector: SectorData = { key, x, y, z, asteroids: [], enemies: [] };
    const sectorCenter = new Vector3(
      x * WORLD_SECTOR_SIZE + WORLD_SECTOR_SIZE * 0.5,
      y * WORLD_SECTOR_SIZE + WORLD_SECTOR_SIZE * 0.5,
      z * WORLD_SECTOR_SIZE + WORLD_SECTOR_SIZE * 0.5,
    );
    const sectorDistanceToShip = Vector3.Distance(this.shipRoot.position, sectorCenter);

    for (let index = 0; index < asteroidCount; index += 1) {
      const position = new Vector3(
        x * WORLD_SECTOR_SIZE + rng() * WORLD_SECTOR_SIZE,
        y * WORLD_SECTOR_SIZE + rng() * WORLD_SECTOR_SIZE,
        z * WORLD_SECTOR_SIZE + rng() * WORLD_SECTOR_SIZE,
      );

      const asteroid = this.spawnAsteroid(
        randomBetween(2.1, 5.6, rng),
        position,
        Vector3.Zero(),
        key,
        rng,
      );
      sector.asteroids.push(asteroid);
    }

    if (sectorDistanceToShip > 80) {
      const enemySpawnChance =
        sectorDistanceToShip < 240
          ? 0.82
          : sectorDistanceToShip < 420
            ? 0.62
            : 0.4;
      const enemyCount =
        rng() < enemySpawnChance
          ? 1 + (sectorDistanceToShip < 340 && rng() > 0.45 ? 1 : 0) + (sectorDistanceToShip < 220 && rng() > 0.82 ? 1 : 0)
          : 0;

      for (let index = 0; index < enemyCount; index += 1) {
        const enemyPosition = new Vector3(
          x * WORLD_SECTOR_SIZE + rng() * WORLD_SECTOR_SIZE,
          y * WORLD_SECTOR_SIZE + rng() * WORLD_SECTOR_SIZE,
          z * WORLD_SECTOR_SIZE + rng() * WORLD_SECTOR_SIZE,
        );
        const enemy = this.spawnEnemy(enemyPosition, key, rng);
        sector.enemies.push(enemy);
      }
    }

    this.loadedSectors.set(key, sector);
  }

  private unloadSector(key: string): void {
    const sector = this.loadedSectors.get(key);
    if (!sector) {
      return;
    }

    for (const asteroid of sector.asteroids) {
      this.disposeAsteroid(asteroid);
      const index = this.asteroids.indexOf(asteroid);
      if (index >= 0) {
        this.asteroids.splice(index, 1);
      }
    }

    for (const enemy of sector.enemies) {
      this.disposeEnemy(enemy);
      const index = this.enemies.indexOf(enemy);
      if (index >= 0) {
        this.enemies.splice(index, 1);
      }
    }

    this.loadedSectors.delete(key);
  }

  private spawnAsteroid(
    size: number,
    position: Vector3,
    velocity: Vector3 = Vector3.Zero(),
    sectorKeyValue: string | null = null,
    rng: () => number = Math.random,
  ): Asteroid {
    const asteroidMesh = MeshBuilder.CreateIcoSphere(
      `asteroid-${performance.now()}`,
      { radius: size, subdivisions: size > 2.5 ? 1 : 0 },
      this.scene,
    );
    asteroidMesh.convertToFlatShadedMesh();
    asteroidMesh.scaling = new Vector3(
      randomBetween(0.7, 1.4, rng),
      randomBetween(0.72, 1.36, rng),
      randomBetween(0.74, 1.44, rng),
    );
    asteroidMesh.position.copyFrom(position);
    asteroidMesh.rotation = new Vector3(
      randomBetween(0, Math.PI, rng),
      randomBetween(0, Math.PI, rng),
      randomBetween(0, Math.PI, rng),
    );

    const asteroidMaterial = new StandardMaterial(`asteroid-mat-${performance.now()}`, this.scene);
    const hueShift = randomBetween(-0.04, 0.08, rng);
    asteroidMaterial.diffuseColor = new Color3(0.31 + hueShift, 0.27 + hueShift * 0.65, 0.24 + hueShift * 0.4);
    asteroidMaterial.emissiveColor = new Color3(0.02, 0.03, 0.045);
    asteroidMaterial.specularColor = Color3.Black();
    asteroidMesh.material = asteroidMaterial;

    const asteroid: Asteroid = {
      mesh: asteroidMesh,
      velocity,
      radius: size * Math.max(asteroidMesh.scaling.x, asteroidMesh.scaling.y, asteroidMesh.scaling.z),
      size,
      durability: Math.max(1, Math.round(size * 1.15)),
      spin: new Vector3(
        randomBetween(-1.2, 1.2, rng),
        randomBetween(-1.1, 1.1, rng),
        randomBetween(-1.3, 1.3, rng),
      ),
      sectorKey: sectorKeyValue,
    };

    this.asteroids.push(asteroid);
    return asteroid;
  }

  private spawnEnemy(position: Vector3, sectorKeyValue: string | null = null, rng: () => number = Math.random): Enemy {
    const root = new TransformNode(`enemy-${performance.now()}`, this.scene);
    root.position.copyFrom(position);
    const initialDirection = randomUnitVector();
    root.rotationQuaternion = this.scene.useRightHandedSystem
      ? Quaternion.FromLookDirectionRH(initialDirection.scale(-1), Vector3.Up())
      : Quaternion.FromLookDirectionLH(initialDirection.scale(-1), Vector3.Up());

    const hullMaterial = new StandardMaterial(`enemy-hull-${performance.now()}`, this.scene);
    hullMaterial.diffuseColor = new Color3(0.2, 0.23, 0.3);
    hullMaterial.emissiveColor = new Color3(0.04, 0.05, 0.08);
    hullMaterial.specularColor = new Color3(0.08, 0.08, 0.08);

    const accentMaterial = new StandardMaterial(`enemy-accent-${performance.now()}`, this.scene);
    accentMaterial.disableLighting = true;
    accentMaterial.emissiveColor = new Color3(1, 0.16, 0.12);
    accentMaterial.diffuseColor = new Color3(0.95, 0.22, 0.18);

    const engineMaterial = new StandardMaterial(`enemy-engine-${performance.now()}`, this.scene);
    engineMaterial.disableLighting = true;
    engineMaterial.emissiveColor = new Color3(0.26, 0.88, 1);
    engineMaterial.diffuseColor = new Color3(0.16, 0.56, 0.88);

    const hull = MeshBuilder.CreateBox(
      `enemy-hull-${performance.now()}`,
      { width: 1.35, height: 0.72, depth: 2.9 },
      this.scene,
    );
    hull.parent = root;
    hull.position.z = 0.08;
    hull.material = hullMaterial;

    const canopy = MeshBuilder.CreateBox(
      `enemy-canopy-${performance.now()}`,
      { width: 0.76, height: 0.24, depth: 0.78 },
      this.scene,
    );
    canopy.parent = root;
    canopy.position.set(0, 0.34, 0.86);
    canopy.material = accentMaterial;

    const nose = MeshBuilder.CreateCylinder(
      `enemy-nose-${performance.now()}`,
      { height: 1.28, diameterTop: 0.12, diameterBottom: 0.72, tessellation: 4 },
      this.scene,
    );
    nose.parent = root;
    nose.rotation.x = Math.PI * 0.5;
    nose.position.set(0, 0.02, 2.02);
    nose.material = accentMaterial;

    const leftWing = MeshBuilder.CreateBox(
      `enemy-wing-l-${performance.now()}`,
      { width: 1.9, height: 0.12, depth: 0.9 },
      this.scene,
    );
    leftWing.parent = root;
    leftWing.position.set(-1.55, -0.02, -0.2);
    leftWing.rotation.z = 0.1;
    leftWing.material = hullMaterial;

    const rightWing = MeshBuilder.CreateBox(
      `enemy-wing-r-${performance.now()}`,
      { width: 1.9, height: 0.12, depth: 0.9 },
      this.scene,
    );
    rightWing.parent = root;
    rightWing.position.set(1.55, -0.02, -0.2);
    rightWing.rotation.z = -0.1;
    rightWing.material = hullMaterial;

    const leftPylon = MeshBuilder.CreateBox(
      `enemy-pylon-l-${performance.now()}`,
      { width: 0.28, height: 0.3, depth: 2.1 },
      this.scene,
    );
    leftPylon.parent = root;
    leftPylon.position.set(-1.02, 0, 0.08);
    leftPylon.material = hullMaterial;

    const rightPylon = MeshBuilder.CreateBox(
      `enemy-pylon-r-${performance.now()}`,
      { width: 0.28, height: 0.3, depth: 2.1 },
      this.scene,
    );
    rightPylon.parent = root;
    rightPylon.position.set(1.02, 0, 0.08);
    rightPylon.material = hullMaterial;

    const dorsalFin = MeshBuilder.CreateBox(
      `enemy-fin-${performance.now()}`,
      { width: 0.18, height: 0.78, depth: 1.1 },
      this.scene,
    );
    dorsalFin.parent = root;
    dorsalFin.position.set(0, 0.54, -0.92);
    dorsalFin.material = hullMaterial;

    const gunLeft = MeshBuilder.CreateCylinder(
      `enemy-gun-l-${performance.now()}`,
      { height: 1.05, diameter: 0.16, tessellation: 6 },
      this.scene,
    );
    gunLeft.parent = root;
    gunLeft.rotation.x = Math.PI * 0.5;
    gunLeft.position.set(-0.86, -0.12, 1.58);
    gunLeft.material = accentMaterial;

    const gunRight = MeshBuilder.CreateCylinder(
      `enemy-gun-r-${performance.now()}`,
      { height: 1.05, diameter: 0.16, tessellation: 6 },
      this.scene,
    );
    gunRight.parent = root;
    gunRight.rotation.x = Math.PI * 0.5;
    gunRight.position.set(0.86, -0.12, 1.58);
    gunRight.material = accentMaterial;

    const engineLeft = MeshBuilder.CreateCylinder(
      `enemy-engine-l-${performance.now()}`,
      { height: 0.82, diameter: 0.52, tessellation: 8 },
      this.scene,
    );
    engineLeft.parent = root;
    engineLeft.rotation.x = Math.PI * 0.5;
    engineLeft.position.set(-0.84, -0.02, -1.88);
    engineLeft.material = engineMaterial;

    const engineRight = MeshBuilder.CreateCylinder(
      `enemy-engine-r-${performance.now()}`,
      { height: 0.82, diameter: 0.52, tessellation: 8 },
      this.scene,
    );
    engineRight.parent = root;
    engineRight.rotation.x = Math.PI * 0.5;
    engineRight.position.set(0.84, -0.02, -1.88);
    engineRight.material = engineMaterial;

    const enemy: Enemy = {
      root,
      velocity: randomUnitVector().scale(randomBetween(2, 8, rng)),
      radius: ENEMY_COLLISION_RADIUS,
      health: 4,
      fireCooldown: randomBetween(0.45, 1.2, rng),
      recoverTimer: 0,
      strafeSign: rng() > 0.5 ? 1 : -1,
      state: "pursuit",
      sectorKey: sectorKeyValue,
    };

    this.enemies.push(enemy);
    return enemy;
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
    this.boostCharge = BOOST_MAX;
    this.gameOver = false;
    this.collectedSalvage = 0;
    this.worldSeed = Math.random();
    this.objectiveDirection = new Vector3(0.24, 0.08, 0.97).normalize();
    this.hud.overlay.classList.add("hidden");
    this.setStatus("Click to engage cockpit controls", 1.8);
    this.clearWorld();
    this.resetShipState(false);
    this.spawnNextObjective(this.shipRoot.position.clone(), true);
    this.syncWorldSectors();
    this.clearBullets();
    this.clearExplosions();
    this.updateHud();
  }

  private resetShipState(keepPosition: boolean): void {
    if (!keepPosition) {
      this.shipRoot.position.copyFromFloats(0, 0, 0);
    }
    this.shipVelocity.copyFromFloats(0, 0, 0);
    this.shipRoot.rotationQuaternion = Quaternion.Identity();
    this.shield = 100;
    this.boostCharge = BOOST_MAX;
    this.boostVisual = 0;
    this.boostHoldTime = 0;
    this.audio.setEngine(0, 0);
    this.invulnerability = 2.2;
    this.fireCooldown = 0;
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

  private clearWorld(): void {
    this.clearCollectibles();
    for (const asteroid of [...this.asteroids]) {
      this.disposeAsteroid(asteroid);
    }
    for (const enemy of [...this.enemies]) {
      this.disposeEnemy(enemy);
    }
    this.asteroids.length = 0;
    this.enemies.length = 0;
    this.loadedSectors.clear();
  }

  private disposeAsteroid(asteroid: Asteroid): void {
    const material = asteroid.mesh.material;
    asteroid.mesh.dispose();
    if (material instanceof StandardMaterial) {
      material.dispose();
    }
  }

  private detachAsteroidFromSector(asteroid: Asteroid): void {
    if (!asteroid.sectorKey) {
      return;
    }

    const sector = this.loadedSectors.get(asteroid.sectorKey);
    if (!sector) {
      return;
    }

    sector.asteroids = sector.asteroids.filter((candidate) => candidate !== asteroid);
  }

  private disposeEnemy(enemy: Enemy): void {
    const materials = new Set<StandardMaterial>();
    for (const mesh of enemy.root.getChildMeshes()) {
      if (mesh.material instanceof StandardMaterial) {
        materials.add(mesh.material);
      }
      mesh.dispose();
    }
    enemy.root.dispose();
    for (const material of materials) {
      material.dispose();
    }
  }

  private detachEnemyFromSector(enemy: Enemy): void {
    if (!enemy.sectorKey) {
      return;
    }

    const sector = this.loadedSectors.get(enemy.sectorKey);
    if (!sector) {
      return;
    }

    sector.enemies = sector.enemies.filter((candidate) => candidate !== enemy);
  }

  private updateObjective(dt: number): void {
    if (this.collectibles.length === 0) {
      return;
    }

    for (let index = this.collectibles.length - 1; index >= 0; index -= 1) {
      const collectible = this.collectibles[index];
      collectible.pulse += dt;
      const bob = 1 + Math.sin(collectible.pulse * 3.2) * 0.12;
      collectible.mesh.scaling.setAll(bob);
      collectible.mesh.rotation.y += dt * 1.4;
      collectible.mesh.rotation.x += dt * 0.5;

      if (
        Vector3.DistanceSquared(this.shipRoot.position, collectible.position) <=
        COLLECTIBLE_PICKUP_RADIUS * COLLECTIBLE_PICKUP_RADIUS
      ) {
        this.collectedSalvage += 1;
        this.score += collectible.objective ? 120 : 85;
        this.audio.playPickup();
        const pickupPosition = collectible.position.clone();
        this.spawnExplosion(pickupPosition, collectible.objective ? 3.8 : 2.8, new Color3(0.38, 1, 0.72));
        this.audio.playExplosion(0.72);
        this.disposeCollectible(index);

        if (collectible.objective) {
          this.spawnNextObjective(pickupPosition, false);
          this.setStatus(`Salvage secured. Cargo ${this.collectedSalvage}. Next marker locked.`, 2.4);
        } else {
          this.setStatus(`Recovered salvage fragment. Cargo ${this.collectedSalvage}.`, 1.6);
        }
      }
    }
  }

  private spawnNextObjective(anchor: Vector3, firstObjective: boolean): void {
    for (let index = this.collectibles.length - 1; index >= 0; index -= 1) {
      if (this.collectibles[index].objective) {
        this.disposeCollectible(index);
      }
    }

    const jitter = randomUnitVector().scale(randomBetween(40, 140));
    this.objectiveDirection = this.objectiveDirection.scale(0.72).add(randomUnitVector().scale(0.28)).normalize();
    const distance = firstObjective ? 420 : randomBetween(OBJECTIVE_MIN_DISTANCE, OBJECTIVE_MAX_DISTANCE);
    const position = anchor.add(this.objectiveDirection.scale(distance)).add(jitter);

    this.spawnCollectible(position, true);
  }

  private spawnAsteroidSalvage(position: Vector3): void {
    const scatter = randomUnitVector().scale(randomBetween(1.6, 4.4));
    this.spawnCollectible(position.add(scatter), false);
  }

  private spawnCollectible(position: Vector3, objective: boolean): void {
    const mesh = MeshBuilder.CreatePolyhedron(
      `salvage-${performance.now()}`,
      { type: objective ? 1 : 2, size: objective ? 2.5 : 1.8 },
      this.scene,
    );
    mesh.position.copyFrom(position);

    const material = new StandardMaterial(`salvage-mat-${performance.now()}`, this.scene);
    material.disableLighting = true;
    material.emissiveColor = objective ? new Color3(0.36, 1, 0.74) : new Color3(0.62, 1, 0.82);
    material.diffuseColor = objective ? new Color3(0.16, 0.56, 0.42) : new Color3(0.22, 0.52, 0.42);
    mesh.material = material;

    this.collectibles.push({
      mesh,
      pulse: 0,
      position: position.clone(),
      objective,
    });
  }

  private disposeCollectible(index: number): void {
    const collectible = this.collectibles[index];
    const material = collectible.mesh.material;
    collectible.mesh.dispose();
    if (material instanceof StandardMaterial) {
      material.dispose();
    }
    this.collectibles.splice(index, 1);
  }

  private clearCollectibles(): void {
    while (this.collectibles.length > 0) {
      this.disposeCollectible(this.collectibles.length - 1);
    }
  }

  private getTrackedCollectible(): Collectible | null {
    if (this.collectibles.length === 0) {
      return null;
    }

    let nearest: Collectible | null = null;
    let nearestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const collectible of this.collectibles) {
      const distanceSquared = Vector3.DistanceSquared(this.camera.globalPosition, collectible.position);
      if (distanceSquared < nearestDistanceSquared) {
        nearestDistanceSquared = distanceSquared;
        nearest = collectible;
      }
    }

    return nearest;
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
    this.hud.boost.textContent = `${Math.round(this.boostCharge)}%`;
    this.hud.speed.textContent = Math.round(this.shipVelocity.length()).toString();
    this.hud.boostVeil.style.opacity = `${this.boostVisual}`;
    const blur = this.boostVisual * 24;
    const saturate = 1 + this.boostVisual * 0.55;
    this.hud.boostVeil.style.backdropFilter = `blur(${blur}px) saturate(${saturate})`;
    this.hud.boostVeil.style.setProperty("-webkit-backdrop-filter", `blur(${blur}px) saturate(${saturate})`);
    this.updateObjectiveHud();

    if (this.statusFlash === 0 && !this.gameOver && document.pointerLockElement === this.canvas) {
      this.hud.status.textContent = "Mouse yaw/pitch  A/D yaw  Q/E roll  Shift boost  Space fire";
    }
  }

  private updateObjectiveHud(): void {
    const trackedCollectible = this.getTrackedCollectible();
    if (!trackedCollectible) {
      this.hud.objectiveDistance.textContent = "--";
      this.hud.objectiveEdge.classList.add("hidden");
      return;
    }

    const toObjective = trackedCollectible.position.subtract(this.camera.globalPosition);
    const distance = toObjective.length();
    this.hud.objectiveDistance.textContent = `${Math.round(distance)}m`;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0 || distance < 0.001) {
      this.hud.objectiveEdge.classList.add("hidden");
      return;
    }

    const forward = this.camera.getDirection(Vector3.Forward(this.scene.useRightHandedSystem)).normalize();
    const right = this.camera.getDirection(Vector3.Right()).normalize();
    const up = this.camera.getDirection(Vector3.Up()).normalize();

    const localX = Vector3.Dot(toObjective, right);
    const localY = Vector3.Dot(toObjective, up);
    const localZ = Vector3.Dot(toObjective, forward);
    const aspect = width / height;
    const tanHalfFov = Math.tan(this.camera.fov * 0.5);
    const projectedX = localX / Math.max(Math.abs(localZ), 0.001) / (tanHalfFov * aspect);
    const projectedY = localY / Math.max(Math.abs(localZ), 0.001) / tanHalfFov;

    const onScreen =
      localZ > 0 &&
      Math.abs(projectedX) <= 1 &&
      Math.abs(projectedY) <= 1;

    if (onScreen) {
      this.hud.objectiveEdge.classList.add("hidden");
      return;
    }

    let screenDirX = localX;
    let screenDirY = -localY;
    if (localZ < 0) {
      screenDirX *= -1;
      screenDirY *= -1;
    }

    if (Math.abs(screenDirX) < 0.001 && Math.abs(screenDirY) < 0.001) {
      screenDirY = -1;
    }

    const edgePadding = 42;
    const centerX = width * 0.5;
    const centerY = height * 0.5;
    const scale = Math.min(
      (centerX - edgePadding) / Math.max(Math.abs(screenDirX), 0.001),
      (centerY - edgePadding) / Math.max(Math.abs(screenDirY), 0.001),
    );
    const edgeX = centerX + screenDirX * scale;
    const edgeY = centerY + screenDirY * scale;
    const angle = Math.atan2(screenDirY, screenDirX) * (180 / Math.PI) + 90;

    this.hud.objectiveEdge.style.left = `${edgeX}px`;
    this.hud.objectiveEdge.style.top = `${edgeY}px`;
    this.hud.objectiveEdgeArrow.style.transform = `rotate(${angle}deg)`;
    this.hud.objectiveEdge.classList.remove("hidden");
  }

  private setStatus(text: string, duration: number): void {
    this.hud.status.textContent = text;
    this.statusFlash = duration;
  }

  private openSettings(): void {
    this.settingsOpen = true;
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

  private requireElement<T extends HTMLElement>(root: ParentNode, selector: string): T {
    const element = root.querySelector<T>(selector);
    if (!element) {
      throw new Error(`Missing required element: ${selector}`);
    }
    return element;
  }
}

function randomBetween(min: number, max: number, rng: () => number = Math.random): number {
  return min + rng() * (max - min);
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

function sectorKey(x: number, y: number, z: number): string {
  return `${x}:${y}:${z}`;
}

function hashSector(seed: number, x: number, y: number, z: number): number {
  let hash = Math.floor(seed * 1_000_000_000) ^ (x * 374761393) ^ (y * 668265263) ^ (z * 2147483647);
  hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
  return (hash ^ (hash >>> 16)) >>> 0;
}

function mulberry32(seed: number): () => number {
  return () => {
    let state = (seed += 0x6d2b79f5);
    state = Math.imul(state ^ (state >>> 15), state | 1);
    state ^= state + Math.imul(state ^ (state >>> 7), state | 61);
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296;
  };
}
