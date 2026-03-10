import { UniversalCamera } from "@babylonjs/core/Cameras/universalCamera";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { Quaternion, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Engine } from "@babylonjs/core/Engines/engine";
import { DirectionalLight } from "@babylonjs/core/Lights/directionalLight";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { GlowLayer } from "@babylonjs/core/Layers/glowLayer";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Scene } from "@babylonjs/core/scene";
import { LoadedAsteroidAsset, loadAsteroidAsset } from "./asteroidAsset";
import { createAsteroidPresentation } from "./asteroidPresentation";
import { AudioManager } from "./audio";
import { EnemyEngineGlow, createEnemyPresentation, updateEnemyEngineGlows } from "./enemyPresentation";
import { LoadedSpacecraftAsset, loadSpacecraftAsset } from "./spacecraftAsset";

type Asteroid = {
  asteroidClass: AsteroidClass;
  disposeCustom: () => void;
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
  cockpitOverlay: HTMLCanvasElement;
  score: HTMLElement;
  lives: HTMLElement;
  shield: HTMLElement;
  cargo: HTMLElement;
  boost: HTMLElement;
  speed: HTMLElement;
  objectiveDistance: HTMLElement;
  baseDistance: HTMLElement;
  boostVeil: HTMLElement;
  objectiveEdge: HTMLElement;
  objectiveEdgeArrow: HTMLElement;
  baseEdge: HTMLElement;
  baseEdgeArrow: HTMLElement;
  enemyEdgeLayer: HTMLElement;
  fpsMeter: HTMLElement;
  status: HTMLElement;
  overlay: HTMLElement;
  finalScore: HTMLElement;
};

type EnemyHudMarker = {
  edge: HTMLElement;
  arrow: HTMLElement;
  label: HTMLElement;
};

type SettingsRefs = {
  overlay: HTMLElement;
  openButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  mouseInvertHorizontal: HTMLInputElement;
  mouseInvertVertical: HTMLInputElement;
  keyboardInvertHorizontal: HTMLInputElement;
  keyboardInvertVertical: HTMLInputElement;
  arrowLookSpeed: HTMLInputElement;
  arrowLookSpeedValue: HTMLElement;
  showFps: HTMLInputElement;
};

type StationRefs = {
  overlay: HTMLElement;
  cargo: HTMLElement;
  points: HTMLElement;
  shield: HTMLElement;
  message: HTMLElement;
  sellButton: HTMLButtonElement;
  repairButton: HTMLButtonElement;
  undockButton: HTMLButtonElement;
};

type ControlSettings = {
  mouseInvertHorizontal: boolean;
  mouseInvertVertical: boolean;
  keyboardInvertHorizontal: boolean;
  keyboardInvertVertical: boolean;
  arrowLookSpeed: number;
  showFps: boolean;
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
type AsteroidClass = "small" | "medium" | "large" | "huge";

type PlayerWeaponProfile = {
  bulletDamage: number;
  bulletLife: number;
  bulletRadius: number;
  bulletSpeed: number;
  fireInterval: number;
};

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
  weaponMounts: TransformNode[];
  nextWeaponMountIndex: number;
  engineGlows: EnemyEngineGlow[];
  disposeCustom: () => void;
};

const WORLD_SECTOR_SIZE = 220;
const WORLD_LOAD_RADIUS = 2;
const WORLD_UNLOAD_RADIUS = 3;
const SHIP_COLLISION_RADIUS = 2.2;
const MAX_DELTA_TIME = 0.05;
const SETTINGS_STORAGE_KEY = "aster3d-control-settings";
const COLLECTIBLE_PICKUP_RADIUS = 7;
const OBJECTIVE_MIN_DISTANCE = 520;
const OBJECTIVE_MAX_DISTANCE = 760;
const BOOST_MAX = 100;
const BOOST_DRAIN_PER_SECOND = 58;
const BOOST_REGEN_PER_SECOND = 18;
const ENEMY_ATTACK_RANGE = 165;
const ENEMY_MARKER_DISTANCE = ENEMY_ATTACK_RANGE + 35;
const ENEMY_MAX_SPEED = 33;
const ENEMY_BULLET_SPEED = 92;
const ENEMY_COLLISION_RADIUS = 5;
const ENEMY_VIEW_DISTANCE = WORLD_SECTOR_SIZE * (WORLD_UNLOAD_RADIUS + 1.2);
const ASTEROID_SALVAGE_DROP_CHANCE = 0.2;
const ENEMY_SALVAGE_DROP_CHANCE = 0.4;
const ASTEROID_HIT_IMPULSE = 2.2;
const ASTEROID_LARGE_CHANCE = 0.15;
const ASTEROID_HUGE_CHANCE = 0.05;
const ASTEROID_BASE_SIZE_MIN = 2.1;
const ASTEROID_BASE_SIZE_MAX = 5.6;
const ASTEROID_CLASS_SCALE: Record<AsteroidClass, number> = {
  small: 0.5,
  medium: 1,
  large: 2,
  huge: 4,
};
const ASTEROID_CLASS_HP: Record<AsteroidClass, number> = {
  small: 4,
  medium: 8,
  large: 16,
  huge: 32,
};
const ENEMY_HEALTH = ASTEROID_CLASS_HP.medium;
const PLAYER_MAXED_WEAPON: PlayerWeaponProfile = {
  bulletDamage: 1,
  bulletLife: 1.6,
  bulletRadius: 0.4,
  bulletSpeed: 155,
  fireInterval: 0.12,
};
const BASE_POSITION = new Vector3(-180, 24, -340);
const BASE_DOCK_OFFSET = new Vector3(0, -5, 34);
const BASE_DOCK_OFFSET_APPROACH = new Vector3(0, 8, 68);
const BASE_SAFE_RADIUS = 92;
const BASE_ENEMY_AVOID_RADIUS = BASE_SAFE_RADIUS + 18;
const BASE_COMBAT_EXCLUSION_RADIUS = BASE_SAFE_RADIUS + 70;
const BASE_NAVIGATION_RADIUS = BASE_SAFE_RADIUS + 120;
const SALVAGE_SELL_VALUE = 100;
const SHIELD_REPAIR_COST = 2;
const ARROW_LOOK_SPEED_MIN = 0.6;
const ARROW_LOOK_SPEED_MAX = 3.4;
const ARROW_LOOK_SPEED_DEFAULT = 20;
const STRAFE_THRUST = 30;
const STRAFE_BOOST_THRUST = 78;
const SUNLIGHT_DIRECTION = new Vector3(0.78, -0.28, -0.56).normalize();
const SUN_POSITION = SUNLIGHT_DIRECTION.scale(-460);

export class Aster3DGame {
  private readonly canvas: HTMLCanvasElement;
  private readonly hud: HudRefs;
  private readonly settingsUi: SettingsRefs;
  private readonly stationUi: StationRefs;
  private readonly engine: Engine;
  private readonly scene: Scene;
  private readonly camera: UniversalCamera;
  private readonly shipRoot: TransformNode;
  private readonly starfieldRoot: TransformNode;
  private readonly baseRoot: TransformNode;
  private readonly audio = new AudioManager();
  private readonly keys = new Set<string>();
  private readonly loadedSectors = new Map<string, SectorData>();
  private readonly baseChevronMaterials: StandardMaterial[] = [];
  private readonly cleanupCallbacks: Array<() => void> = [];

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
  private stationOpen = false;
  private autoDockActive = false;
  private autoDockStage = 0;
  private autoDockProgress = 0;
  private autoDockDuration = 0;
  private baseDockRearmRequired = false;
  private baseShieldFlash = 0;
  private worldSeed = Math.random();
  private collectedSalvage = 0;
  private boostCharge = BOOST_MAX;
  private boostVisual = 0;
  private boostHoldTime = 0;
  private disposed = false;
  private cockpitImageSource: HTMLCanvasElement | null = null;

  private readonly shipVelocity = new Vector3(0, 0, 0);
  private readonly autoDockPathStart = new Vector3();
  private readonly autoDockPathControl = new Vector3();
  private readonly autoDockPathEnd = new Vector3();
  private readonly controlSettings: ControlSettings;
  private readonly renderLoop = (): void => {
    if (this.disposed) {
      return;
    }

    const dt = Math.min(this.engine.getDeltaTime() / 1000, MAX_DELTA_TIME);
    this.update(dt);
    this.scene.render();
  };
  private baseShieldMaterial: StandardMaterial | null = null;
  private objectiveDirection = new Vector3(0.24, 0.08, 0.97).normalize();
  private asteroidModelAsset: LoadedAsteroidAsset | null = null;
  private enemyModelAsset: LoadedSpacecraftAsset | null = null;
  private readonly enemyHudMarkers: EnemyHudMarker[] = [];

  public static async create(root: HTMLElement): Promise<Aster3DGame> {
    const game = new Aster3DGame(root);
    await game.initialize();
    return game;
  }

  constructor(root: HTMLElement) {
    this.canvas = this.requireElement<HTMLCanvasElement>(root, ".game-canvas");
    this.hud = {
      cockpitOverlay: this.requireElement(root, "[data-cockpit-overlay]"),
      score: this.requireElement(root, "[data-score]"),
      lives: this.requireElement(root, "[data-lives]"),
      shield: this.requireElement(root, "[data-shield]"),
      cargo: this.requireElement(root, "[data-cargo]"),
      boost: this.requireElement(root, "[data-boost]"),
      speed: this.requireElement(root, "[data-speed]"),
      objectiveDistance: this.requireElement(root, "[data-objective-distance]"),
      baseDistance: this.requireElement(root, "[data-base-distance]"),
      boostVeil: this.requireElement(root, "[data-boost-veil]"),
      objectiveEdge: this.requireElement(root, "[data-objective-edge]"),
      objectiveEdgeArrow: this.requireElement(root, ".objective-edge__arrow"),
      baseEdge: this.requireElement(root, "[data-base-edge]"),
      baseEdgeArrow: this.requireElement(root, "[data-base-edge-arrow]"),
      enemyEdgeLayer: this.requireElement(root, "[data-enemy-edge-layer]"),
      fpsMeter: this.requireElement(root, "[data-fps-meter]"),
      status: this.requireElement(root, "[data-status]"),
      overlay: this.requireElement(root, "[data-game-over]"),
      finalScore: this.requireElement(root, "[data-final-score]"),
    };
    this.settingsUi = {
      overlay: this.requireElement(root, "[data-settings]"),
      openButton: this.requireElement(root, "[data-open-settings]"),
      closeButton: this.requireElement(root, "[data-close-settings]"),
      mouseInvertHorizontal: this.requireElement(root, "[data-mouse-invert-horizontal]"),
      mouseInvertVertical: this.requireElement(root, "[data-mouse-invert-vertical]"),
      keyboardInvertHorizontal: this.requireElement(root, "[data-keyboard-invert-horizontal]"),
      keyboardInvertVertical: this.requireElement(root, "[data-keyboard-invert-vertical]"),
      arrowLookSpeed: this.requireElement(root, "[data-arrow-look-speed]"),
      arrowLookSpeedValue: this.requireElement(root, "[data-arrow-look-speed-value]"),
      showFps: this.requireElement(root, "[data-show-fps]"),
    };
    this.stationUi = {
      overlay: this.requireElement(root, "[data-station]"),
      cargo: this.requireElement(root, "[data-station-cargo]"),
      points: this.requireElement(root, "[data-station-points]"),
      shield: this.requireElement(root, "[data-station-shield]"),
      message: this.requireElement(root, "[data-station-message]"),
      sellButton: this.requireElement(root, "[data-sell-salvage]"),
      repairButton: this.requireElement(root, "[data-repair-shields]"),
      undockButton: this.requireElement(root, "[data-undock]"),
    };
    this.controlSettings = this.loadControlSettings();

    this.engine = new Engine(this.canvas, true);
    this.scene = new Scene(this.engine);
    this.scene.clearColor = new Color4(0.008, 0.015, 0.04, 1);

    const light = new HemisphericLight("keyLight", new Vector3(0.2, 1, -0.3), this.scene);
    light.intensity = 0.62;
    light.diffuse = new Color3(0.54, 0.66, 0.92);
    light.groundColor = new Color3(0.01, 0.03, 0.08);

    const sunLight = new DirectionalLight("sunLight", SUNLIGHT_DIRECTION, this.scene);
    sunLight.intensity = 0.88;
    sunLight.diffuse = new Color3(1, 0.9, 0.72);
    sunLight.specular = new Color3(1, 0.94, 0.86);

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
    this.baseRoot = new TransformNode("baseRoot", this.scene);

    this.createCockpit();
    this.createStarfield();
    this.createBase();
    this.syncSettingsUi();
    this.bindEvents();
  }

  private async initialize(): Promise<void> {
    await this.loadAsteroidModelPrefab();
    await this.loadEnemyModelPrefab();
    this.resetRun();
    this.engine.runRenderLoop(this.renderLoop);
  }

  private bindEvents(): void {
    this.registerListener(window, "resize", () => {
      this.engine.resize();
      this.redrawCockpitOverlay();
    });

    this.registerListener(window, "keydown", (event) => {
      const keyboardEvent = event as KeyboardEvent;
      if (this.stationOpen && keyboardEvent.code === "Escape") {
        this.closeStation();
        return;
      }

      if (this.settingsOpen && keyboardEvent.code === "Escape") {
        this.closeSettings();
        return;
      }

      if (this.settingsOpen || this.stationOpen) {
        return;
      }

      if (!this.hasActivePointerLock() && !this.gameOver) {
        return;
      }

      this.keys.add(keyboardEvent.code);
      if (
        keyboardEvent.code === "Space" ||
        keyboardEvent.code === "ShiftLeft" ||
        keyboardEvent.code === "ShiftRight"
      ) {
        keyboardEvent.preventDefault();
      }
    });

    this.registerListener(window, "keyup", (event) => {
      this.keys.delete((event as KeyboardEvent).code);
    });

    this.registerListener(window, "blur", () => {
      this.keys.clear();
    });

    this.registerListener(this.canvas, "click", () => {
      void this.audio.resume();
      if (document.pointerLockElement !== this.canvas) {
        void this.canvas.requestPointerLock();
      }
    });

    this.registerListener(document, "mousemove", (event) => {
      const mouseEvent = event as MouseEvent;
      if (document.pointerLockElement !== this.canvas || this.gameOver) {
        return;
      }

      this.mouseLookX += mouseEvent.movementX;
      this.mouseLookY += mouseEvent.movementY;
    });

    this.registerListener(document, "pointerlockchange", () => {
      if (!this.hasActivePointerLock()) {
        this.keys.clear();
        this.mouseLookX = 0;
        this.mouseLookY = 0;
        this.audio.setEngine(0, 0);
      }

      if (!this.gameOver && !this.settingsOpen && !this.stationOpen && !this.autoDockActive) {
        this.setStatus(
          this.hasActivePointerLock()
            ? "Mouse active. Mouse or arrows yaw/pitch, A/D strafe, Q/E roll, Shift boost, Space fire."
            : "Paused. Click to resume cockpit controls",
          1.25,
        );
      }
    });

    this.registerListener(this.settingsUi.openButton, "click", () => {
      void this.audio.resume();
      this.openSettings();
    });

    this.registerListener(this.settingsUi.closeButton, "click", () => {
      this.closeSettings();
    });

    this.registerListener(this.settingsUi.overlay, "click", (event) => {
      if (event.target === this.settingsUi.overlay) {
        this.closeSettings();
      }
    });

    this.registerListener(this.stationUi.overlay, "click", (event) => {
      if (event.target === this.stationUi.overlay) {
        this.closeStation();
      }
    });

    this.registerListener(this.stationUi.sellButton, "click", () => {
      this.sellSalvage();
    });

    this.registerListener(this.stationUi.repairButton, "click", () => {
      this.repairShields();
    });

    this.registerListener(this.stationUi.undockButton, "click", () => {
      this.closeStation();
    });

    this.registerListener(this.settingsUi.mouseInvertHorizontal, "change", () => {
      this.controlSettings.mouseInvertHorizontal = this.settingsUi.mouseInvertHorizontal.checked;
      this.persistControlSettings();
      this.setStatus(
        `Mouse horizontal axis ${this.controlSettings.mouseInvertHorizontal ? "inverted" : "normal"}`,
        1.2,
      );
    });

    this.registerListener(this.settingsUi.mouseInvertVertical, "change", () => {
      this.controlSettings.mouseInvertVertical = this.settingsUi.mouseInvertVertical.checked;
      this.persistControlSettings();
      this.setStatus(
        `Mouse vertical axis ${this.controlSettings.mouseInvertVertical ? "inverted" : "normal"}`,
        1.2,
      );
    });

    this.registerListener(this.settingsUi.keyboardInvertHorizontal, "change", () => {
      this.controlSettings.keyboardInvertHorizontal = this.settingsUi.keyboardInvertHorizontal.checked;
      this.persistControlSettings();
      this.setStatus(
        `Keyboard horizontal axis ${
          this.controlSettings.keyboardInvertHorizontal ? "inverted" : "normal"
        }`,
        1.2,
      );
    });

    this.registerListener(this.settingsUi.keyboardInvertVertical, "change", () => {
      this.controlSettings.keyboardInvertVertical = this.settingsUi.keyboardInvertVertical.checked;
      this.persistControlSettings();
      this.setStatus(
        `Keyboard vertical axis ${this.controlSettings.keyboardInvertVertical ? "inverted" : "normal"}`,
        1.2,
      );
    });

    this.registerListener(this.settingsUi.arrowLookSpeed, "input", () => {
      this.controlSettings.arrowLookSpeed = clampNumber(
        Number.parseInt(this.settingsUi.arrowLookSpeed.value, 10),
        0,
        100,
      );
      this.persistControlSettings();
      this.syncSettingsUi();
      this.setStatus(`Arrow turn rate ${this.controlSettings.arrowLookSpeed}%`, 1.2);
    });

    this.registerListener(this.settingsUi.showFps, "change", () => {
      this.controlSettings.showFps = this.settingsUi.showFps.checked;
      this.persistControlSettings();
      this.syncSettingsUi();
      this.setStatus(`FPS counter ${this.controlSettings.showFps ? "enabled" : "disabled"}`, 1.2);
    });
  }

  private update(dt: number): void {
    if (this.settingsOpen || this.stationOpen) {
      this.updateBaseVisuals(dt);
      this.updateHud();
      return;
    }

    if (this.keys.has("KeyR") && this.gameOver) {
      this.resetRun();
    }

    if (this.gameOver) {
      this.updateBaseVisuals(dt);
      this.updateHud();
      return;
    }

    if (this.shouldPauseForPointerUnlock()) {
      this.audio.setEngine(0, 0);
      this.updateBaseVisuals(dt);
      this.updateHud();
      return;
    }

    this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    this.invulnerability = Math.max(0, this.invulnerability - dt);
    this.statusFlash = Math.max(0, this.statusFlash - dt);
    this.baseShieldFlash = Math.max(0, this.baseShieldFlash - dt * 2.4);

    this.syncWorldSectors();
    this.updateBaseState(dt);
    if (this.autoDockActive) {
      this.updateAutoDock(dt);
    } else {
      this.updateShip(dt);
    }
    this.updateEnemies(dt);
    this.updateBullets(dt);
    this.updateAsteroids(dt);
    this.updateObjective(dt);
    this.updateExplosions(dt);
    this.updateBaseVisuals(dt);

    this.starfieldRoot.position.copyFrom(this.shipRoot.position);
    this.updateHud();
  }

  private updateShip(dt: number): void {
    const pointerActive = document.pointerLockElement === this.canvas;
    const strafeInput = (this.keys.has("KeyD") ? 1 : 0) - (this.keys.has("KeyA") ? 1 : 0);
    const rollInput = (this.keys.has("KeyE") ? 1 : 0) - (this.keys.has("KeyQ") ? 1 : 0);
    const throttleInput = (this.keys.has("KeyW") ? 1 : 0) - (this.keys.has("KeyS") ? 1 : 0) * 0.6;
    const boostRequested = this.keys.has("ShiftLeft") || this.keys.has("ShiftRight");
    const boostActive = boostRequested && this.boostCharge > 0;
    const fireRequested = this.keys.has("Space");

    let yawDelta = 0;
    let pitchDelta = 0;
    let rollDelta = rollInput * dt * 1.95;
    const mouseHorizontalSign = this.controlSettings.mouseInvertHorizontal ? 1 : -1;
    const mouseVerticalSign = this.controlSettings.mouseInvertVertical ? 1 : -1;
    const keyboardHorizontalSign = this.controlSettings.keyboardInvertHorizontal ? 1 : -1;
    const keyboardVerticalSign = this.controlSettings.keyboardInvertVertical ? 1 : -1;
    const arrowLookRate = this.getArrowLookRate();
    const arrowYawInput = (this.keys.has("ArrowRight") ? 1 : 0) - (this.keys.has("ArrowLeft") ? 1 : 0);
    const arrowPitchInput = (this.keys.has("ArrowDown") ? 1 : 0) - (this.keys.has("ArrowUp") ? 1 : 0);

    yawDelta += arrowYawInput * dt * arrowLookRate * keyboardHorizontalSign;
    pitchDelta += arrowPitchInput * dt * arrowLookRate * keyboardVerticalSign;

    if (pointerActive) {
      yawDelta += this.mouseLookX * 0.0024 * mouseHorizontalSign;
      pitchDelta += this.mouseLookY * 0.002 * mouseVerticalSign;
    }

    this.mouseLookX = 0;
    this.mouseLookY = 0;

    const orientation = this.shipRoot.rotationQuaternion ?? Quaternion.Identity();
    const localDelta = Quaternion.RotationYawPitchRoll(yawDelta, pitchDelta, rollDelta);
    this.shipRoot.rotationQuaternion = orientation.multiply(localDelta).normalize();

    const forward = this.camera.getDirection(Vector3.Forward(this.scene.useRightHandedSystem)).normalize();
    const right = this.camera.getDirection(Vector3.Right()).normalize();
    const thrustInput = boostActive && throttleInput <= 0 ? 1 : throttleInput;
    const thrust = boostActive ? 118 : 42;
    const lateralThrust = boostActive ? STRAFE_BOOST_THRUST : STRAFE_THRUST;
    const lateralInput = strafeInput * keyboardHorizontalSign;
    if (thrustInput !== 0) {
      this.shipVelocity.addInPlace(forward.scale(thrustInput * thrust * dt));
    }
    if (lateralInput !== 0) {
      this.shipVelocity.addInPlace(right.scale(lateralInput * lateralThrust * dt));
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
      this.fireCooldown = PLAYER_MAXED_WEAPON.fireInterval;
    }
  }

  private updateBullets(dt: number): void {
    for (let index = this.bullets.length - 1; index >= 0; index -= 1) {
      const bullet = this.bullets[index];
      bullet.life -= dt;
      bullet.mesh.position.addInPlace(bullet.velocity.scale(dt));

       if (this.isInsideBaseShield(bullet.mesh.position)) {
        this.triggerBaseShieldFlash(bullet.mesh.position);
        this.disposeBullet(index);
        continue;
      }

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
          this.damageAsteroid(asteroidIndex, bullet.damage, bullet.velocity);
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
          this.damageEnemy(enemyIndex, bullet.damage, bullet.velocity);
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
    const playerNearBase =
      Vector3.DistanceSquared(this.shipRoot.position, this.baseRoot.position) <=
      BASE_COMBAT_EXCLUSION_RADIUS * BASE_COMBAT_EXCLUSION_RADIUS;

    for (let index = this.enemies.length - 1; index >= 0; index -= 1) {
      const enemy = this.enemies[index];
      enemy.fireCooldown = Math.max(0, enemy.fireCooldown - dt);
      enemy.recoverTimer = Math.max(0, enemy.recoverTimer - dt);
      const modelForwardAxis = Vector3.Forward(this.scene.useRightHandedSystem);

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
      const baseBlocksPlayerPath =
        distancePointToSegmentSquared(this.baseRoot.position, enemy.root.position, this.shipRoot.position) <=
        BASE_NAVIGATION_RADIUS * BASE_NAVIGATION_RADIUS;
      const awayFromBase = enemy.root.position.subtract(this.baseRoot.position);
      const baseDistance = Math.max(0.001, awayFromBase.length());
      const baseNormal = awayFromBase.scale(1 / baseDistance);
      const insideAvoidZone = baseDistance < BASE_ENEMY_AVOID_RADIUS;
      const insideCombatExclusion = baseDistance < BASE_COMBAT_EXCLUSION_RADIUS;
      const insideNavigationRadius = baseDistance < BASE_NAVIGATION_RADIUS;
      const shouldAvoidBase =
        insideNavigationRadius ||
        (baseBlocksPlayerPath && baseDistance < BASE_NAVIGATION_RADIUS + 36);

      let desiredDirection = toShipDirection;
      if (baseDistance < BASE_SAFE_RADIUS + enemy.radius + 1.2) {
        enemy.state = "recover";
        enemy.recoverTimer = Math.max(enemy.recoverTimer, 1.25);
        enemy.fireCooldown = Math.max(enemy.fireCooldown, 0.7);
        desiredDirection = baseNormal;
      } else if (shouldAvoidBase) {
        enemy.state = "recover";
        enemy.recoverTimer = Math.max(enemy.recoverTimer, 1.05);
        enemy.fireCooldown = Math.max(enemy.fireCooldown, 0.45);

        let tangent = Vector3.Cross(baseNormal, Vector3.Up());
        if (tangent.lengthSquared() < 0.001) {
          tangent = Vector3.Cross(baseNormal, currentRight);
        }
        tangent.normalize();
        const tangentSign = Vector3.Dot(tangent, toShipDirection) >= 0 ? 1 : -1;
        const outwardBias = insideCombatExclusion ? 0.9 : insideAvoidZone ? 0.6 : 0.38;
        desiredDirection = tangent.scale(tangentSign).add(baseNormal.scale(outwardBias)).normalize();
      } else if (enemy.recoverTimer > 0) {
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
        ? Quaternion.FromLookDirectionRH(desiredDirection, currentUp)
        : Quaternion.FromLookDirectionLH(desiredDirection, currentUp);
      const rotation = enemy.root.rotationQuaternion ?? Quaternion.Identity();
      enemy.root.rotationQuaternion = Quaternion.Slerp(rotation, targetRotation, 1 - Math.exp(-1.9 * dt)).normalize();

      const noseDirection = enemy.root.getDirection(modelForwardAxis).normalize();
      const thrust =
        enemy.state === "recover"
          ? (insideCombatExclusion ? 34 : insideNavigationRadius ? 28 : 24)
          : enemy.state === "attack"
            ? 16
            : 20;
      enemy.velocity.addInPlace(noseDirection.scale(thrust * dt));
      if (insideNavigationRadius) {
        const radialSpeed = Vector3.Dot(enemy.velocity, baseNormal);
        if (radialSpeed < 8) {
          enemy.velocity.addInPlace(baseNormal.scale((8 - radialSpeed) * 0.5));
        }
      }
      enemy.velocity.scaleInPlace(Math.exp(-1.05 * dt));
      if (enemy.velocity.lengthSquared() > ENEMY_MAX_SPEED * ENEMY_MAX_SPEED) {
        enemy.velocity.normalize().scaleInPlace(ENEMY_MAX_SPEED);
      }
      enemy.root.position.addInPlace(enemy.velocity.scale(dt));

      const baseDistanceAfterMove = Vector3.Distance(enemy.root.position, this.baseRoot.position);
      if (baseDistanceAfterMove < BASE_SAFE_RADIUS + enemy.radius) {
        const bounceNormal = enemy.root.position.subtract(this.baseRoot.position).normalize();
        enemy.root.position.copyFrom(this.baseRoot.position.add(bounceNormal.scale(BASE_SAFE_RADIUS + enemy.radius + 0.8)));
        enemy.velocity.copyFrom(reflectVector(enemy.velocity, bounceNormal).scale(0.72));
        enemy.recoverTimer = Math.max(enemy.recoverTimer, 1.4);
        this.triggerBaseShieldFlash(enemy.root.position);
      }

      this.syncEnemySectorMembership(enemy);

      const toShipAfterMove = this.shipRoot.position.subtract(enemy.root.position);
      const distanceAfterMove = Math.max(0.001, toShipAfterMove.length());
      const attackDirection = toShipAfterMove.scale(1 / distanceAfterMove);

      if (
        enemy.state === "attack" &&
        !playerNearBase &&
        !baseBlocksPlayerPath &&
        distanceAfterMove <= ENEMY_ATTACK_RANGE &&
        baseDistanceAfterMove > BASE_NAVIGATION_RADIUS - 8 &&
        enemy.fireCooldown === 0
      ) {
        const aimDirection = attackDirection.add(this.shipVelocity.scale(0.012)).normalize();
        this.fireEnemyBullet(enemy, aimDirection);
        enemy.fireCooldown = randomBetween(0.92, 1.28);
      }

      const engineThrottle =
        enemy.state === "recover"
          ? 1
          : enemy.state === "attack"
            ? 0.72
            : 0.84;
      updateEnemyEngineGlows(enemy.engineGlows, engineThrottle, performance.now());

      const collisionRadius = enemy.radius + SHIP_COLLISION_RADIUS;
      if (
        this.invulnerability === 0 &&
        Vector3.DistanceSquared(this.shipRoot.position, enemy.root.position) <= collisionRadius * collisionRadius
      ) {
        this.applyShipDamage(20);
        this.damageEnemy(index, 99, this.shipVelocity.add(currentForward.scale(10)), true);
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

      this.syncAsteroidSectorMembership(asteroid);

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
    const weapon = PLAYER_MAXED_WEAPON;
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
      velocity: forward.scale(weapon.bulletSpeed).add(this.shipVelocity.scale(0.45)),
      life: weapon.bulletLife,
      radius: weapon.bulletRadius,
      hostile: false,
      damage: weapon.bulletDamage,
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
    const activeMount =
      enemy.weaponMounts[enemy.nextWeaponMountIndex % enemy.weaponMounts.length] ?? null;
    enemy.nextWeaponMountIndex = (enemy.nextWeaponMountIndex + 1) % Math.max(1, enemy.weaponMounts.length);

    const bulletOrigin = activeMount
      ? activeMount.getAbsolutePosition().add(direction.scale(0.45))
      : enemy.root.position.add(direction.scale(enemy.radius + 1.1));
    bulletMesh.position.copyFrom(bulletOrigin);

    this.bullets.push({
      mesh: bulletMesh,
      velocity: direction.scale(ENEMY_BULLET_SPEED).add(enemy.velocity.scale(0.55)),
      life: 2.8,
      radius: 0.58,
      hostile: true,
      damage: 13,
    });
  }

  private damageAsteroid(index: number, damage: number, impulse: Vector3): void {
    const asteroid = this.asteroids[index];
    asteroid.durability -= damage;
    asteroid.velocity.addInPlace(impulse.normalize().scale(ASTEROID_HIT_IMPULSE));

    this.spawnExplosion(asteroid.mesh.position, asteroid.size * 0.45, new Color3(0.58, 0.94, 1));

    if (asteroid.durability > 0) {
      this.audio.playExplosion(0.58);
      return;
    }

    const impactPosition = asteroid.mesh.position.clone();
    const asteroidVelocity = asteroid.velocity.clone();
    const nextClass = getNextSmallerAsteroidClass(asteroid.asteroidClass);
    const childSize = asteroid.size * 0.5;

    this.score += Math.round(asteroid.size * 28);
    this.detachAsteroidFromSector(asteroid);
    this.disposeAsteroid(asteroid);
    this.asteroids.splice(index, 1);
    this.spawnExplosion(impactPosition, asteroid.size * 0.9, new Color3(1, 0.68, 0.34));
    this.audio.playExplosion(asteroid.size * 0.24);
    if (Math.random() < ASTEROID_SALVAGE_DROP_CHANCE) {
      this.spawnAsteroidSalvage(impactPosition);
    }

    if (nextClass) {
      const splitDirection = randomUnitVector();
      this.spawnAsteroid(
        nextClass,
        impactPosition.add(splitDirection.scale(childSize * 1.2)),
        asteroidVelocity.add(splitDirection.scale(8)),
        null,
        Math.random,
        childSize,
      );
      this.spawnAsteroid(
        nextClass,
        impactPosition.add(splitDirection.scale(-childSize * 1.2)),
        asteroidVelocity.add(splitDirection.scale(-8)),
        null,
        Math.random,
        childSize,
      );
    }
  }

  private async loadEnemyModelPrefab(): Promise<void> {
    try {
      this.enemyModelAsset?.dispose();
      this.enemyModelAsset = await loadSpacecraftAsset(this.scene);
    } catch (error) {
      console.warn("Failed to load enemy spacecraft model, using procedural fallback.", error);
      this.enemyModelAsset = null;
    }
  }

  private async loadAsteroidModelPrefab(): Promise<void> {
    try {
      this.asteroidModelAsset?.dispose();
      this.asteroidModelAsset = await loadAsteroidAsset(this.scene);
    } catch (error) {
      console.warn("Failed to load asteroid model, using procedural fallback.", error);
      this.asteroidModelAsset = null;
    }
  }

  private damageEnemy(index: number, damage: number, impulse: Vector3, collisionKill = false): void {
    const enemy = this.enemies[index];
    enemy.health -= collisionKill ? 99 : damage;
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
      this.hud.finalScore.textContent = `Final points: ${this.score}`;
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

      const asteroid = this.spawnAsteroid(rollAsteroidClass(rng), position, Vector3.Zero(), key, rng);
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
        if (
          Vector3.DistanceSquared(enemyPosition, this.baseRoot.position) <
          BASE_NAVIGATION_RADIUS * BASE_NAVIGATION_RADIUS
        ) {
          continue;
        }
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
    asteroidClass: AsteroidClass,
    position: Vector3,
    velocity: Vector3 = Vector3.Zero(),
    sectorKeyValue: string | null = null,
    rng: () => number = Math.random,
    explicitSize?: number,
  ): Asteroid {
    const size = explicitSize ?? rollAsteroidSizeForClass(asteroidClass, rng);
    const asteroidMesh = new Mesh(`asteroid-${performance.now()}`, this.scene);
    asteroidMesh.position.copyFrom(position);
    asteroidMesh.rotation = new Vector3(
      randomBetween(0, Math.PI, rng),
      randomBetween(0, Math.PI, rng),
      randomBetween(0, Math.PI, rng),
    );
    const presentation = createAsteroidPresentation(this.scene, asteroidMesh, this.asteroidModelAsset, {
      diameter: size * 2,
      rng,
    });

    const asteroid: Asteroid = {
      asteroidClass,
      disposeCustom: presentation.dispose,
      mesh: asteroidMesh,
      velocity,
      radius: size,
      size,
      durability: ASTEROID_CLASS_HP[asteroidClass],
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
      ? Quaternion.FromLookDirectionRH(initialDirection, Vector3.Up())
      : Quaternion.FromLookDirectionLH(initialDirection, Vector3.Up());
    const presentation = createEnemyPresentation(this.scene, root, this.enemyModelAsset);

    const enemy: Enemy = {
      root,
      velocity: randomUnitVector().scale(randomBetween(2, 8, rng)),
      radius: ENEMY_COLLISION_RADIUS,
      health: ENEMY_HEALTH,
      fireCooldown: randomBetween(0.45, 1.2, rng),
      recoverTimer: 0,
      strafeSign: rng() > 0.5 ? 1 : -1,
      state: "pursuit",
      sectorKey: sectorKeyValue,
      weaponMounts: presentation.weaponMounts,
      nextWeaponMountIndex: 0,
      engineGlows: presentation.engineGlows,
      disposeCustom: presentation.dispose,
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
    this.autoDockActive = false;
    this.autoDockStage = 0;
    this.autoDockProgress = 0;
    this.autoDockDuration = 0;
    this.baseDockRearmRequired = false;
    this.baseShieldFlash = 0;
    this.collectedSalvage = 0;
    this.worldSeed = Math.random();
    this.objectiveDirection = new Vector3(0.24, 0.08, 0.97).normalize();
    this.stationOpen = false;
    this.hud.overlay.classList.add("hidden");
    this.stationUi.overlay.classList.add("hidden");
    this.setStatus("Click to engage cockpit controls", 1.8);
    this.clearWorld();
    this.resetShipState(false);
    this.spawnNextObjective(this.shipRoot.position.clone(), true);
    this.syncWorldSectors();
    this.clearBullets();
    this.clearExplosions();
    this.updateStationUi("Sell salvage for points or repair shields.");
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
    this.autoDockActive = false;
    this.autoDockStage = 0;
    this.autoDockProgress = 0;
    this.autoDockDuration = 0;
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
    asteroid.disposeCustom();
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

  private syncAsteroidSectorMembership(asteroid: Asteroid): void {
    const nextSectorKey = getSectorKeyForPosition(asteroid.mesh.position);
    if (nextSectorKey === asteroid.sectorKey) {
      return;
    }

    this.detachAsteroidFromSector(asteroid);
    const nextSector = this.loadedSectors.get(nextSectorKey);
    if (!nextSector) {
      asteroid.sectorKey = null;
      return;
    }

    asteroid.sectorKey = nextSectorKey;
    if (!nextSector.asteroids.includes(asteroid)) {
      nextSector.asteroids.push(asteroid);
    }
  }

  private disposeEnemy(enemy: Enemy): void {
    for (const mesh of enemy.root.getChildMeshes()) {
      mesh.dispose();
    }
    enemy.root.dispose();
    enemy.disposeCustom();
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

  private syncEnemySectorMembership(enemy: Enemy): void {
    const nextSectorKey = getSectorKeyForPosition(enemy.root.position);
    if (nextSectorKey === enemy.sectorKey) {
      return;
    }

    this.detachEnemyFromSector(enemy);
    const nextSector = this.loadedSectors.get(nextSectorKey);
    if (!nextSector) {
      enemy.sectorKey = null;
      return;
    }

    enemy.sectorKey = nextSectorKey;
    if (!nextSector.enemies.includes(enemy)) {
      nextSector.enemies.push(enemy);
    }
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

  private getBaseDockPosition(): Vector3 {
    return this.baseRoot.position.add(BASE_DOCK_OFFSET);
  }

  private getBaseApproachPosition(): Vector3 {
    return this.baseRoot.position.add(BASE_DOCK_OFFSET_APPROACH);
  }

  private isInsideBaseShield(position: Vector3): boolean {
    return Vector3.DistanceSquared(position, this.baseRoot.position) <= BASE_SAFE_RADIUS * BASE_SAFE_RADIUS;
  }

  private triggerBaseShieldFlash(position: Vector3): void {
    this.baseShieldFlash = Math.min(1, this.baseShieldFlash + 0.45);
    this.spawnExplosion(position, 2.4, new Color3(1, 0.82, 0.44));
  }

  private updateBaseState(_dt: number): void {
    const insideShield = this.isInsideBaseShield(this.shipRoot.position);

    if (this.baseDockRearmRequired && !insideShield) {
      this.baseDockRearmRequired = false;
    }

    if (!this.baseDockRearmRequired && !this.autoDockActive && insideShield) {
      this.startAutoDock();
    }
  }

  private startAutoDock(): void {
    this.autoDockActive = true;
    this.beginAutoDockStage(0);
    this.keys.clear();
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    this.setStatus("Station field captured. Autodocking...", 999);
  }

  private beginAutoDockStage(stage: number): void {
    this.autoDockStage = stage;
    this.autoDockProgress = 0;

    const stageStart = this.shipRoot.position.clone();
    const stageEnd = stage === 0 ? this.getBaseApproachPosition() : this.getBaseDockPosition();
    const midpoint = stageStart.add(stageEnd).scale(0.5);
    const awayFromBase = stageStart.subtract(this.baseRoot.position);
    const outward = awayFromBase.lengthSquared() > 0.001 ? awayFromBase.normalize() : Vector3.Forward();

    this.autoDockPathStart.copyFrom(stageStart);
    this.autoDockPathEnd.copyFrom(stageEnd);
    this.autoDockPathControl.copyFrom(
      stage === 0
        ? midpoint.add(Vector3.Up().scale(12)).add(outward.scale(16))
        : midpoint.add(Vector3.Up().scale(8)).add(outward.scale(4)),
    );

    const pathLength =
      Vector3.Distance(this.autoDockPathStart, this.autoDockPathControl) +
      Vector3.Distance(this.autoDockPathControl, this.autoDockPathEnd);
    this.autoDockDuration = stage === 0
      ? Math.max(1.35, pathLength / 34)
      : Math.max(0.9, pathLength / 22);
  }

  private updateAutoDock(dt: number): void {
    this.autoDockProgress = Math.min(this.autoDockDuration, this.autoDockProgress + dt);
    const t = this.autoDockDuration <= 0 ? 1 : this.autoDockProgress / this.autoDockDuration;
    const easedT = smoothstep(t);
    const currentPosition = quadraticBezierPoint(
      this.autoDockPathStart,
      this.autoDockPathControl,
      this.autoDockPathEnd,
      easedT,
    );
    const currentTangent = quadraticBezierTangent(
      this.autoDockPathStart,
      this.autoDockPathControl,
      this.autoDockPathEnd,
      easedT,
    );
    const desiredForward =
      currentTangent.lengthSquared() > 0.0001
        ? currentTangent.normalize()
        : this.autoDockPathEnd.subtract(this.autoDockPathStart).normalize();
    const targetRotation = this.scene.useRightHandedSystem
      ? Quaternion.FromLookDirectionRH(desiredForward.scale(-1), Vector3.Up())
      : Quaternion.FromLookDirectionLH(desiredForward.scale(-1), Vector3.Up());
    const rotation = this.shipRoot.rotationQuaternion ?? Quaternion.Identity();
    this.shipRoot.rotationQuaternion = Quaternion.Slerp(rotation, targetRotation, 1 - Math.exp(-4.2 * dt)).normalize();

    const previousPosition = this.shipRoot.position.clone();
    this.shipRoot.position.copyFrom(currentPosition);
    this.shipVelocity.copyFrom(currentPosition.subtract(previousPosition).scale(1 / Math.max(dt, 0.0001)));

    if (t >= 1) {
      this.shipVelocity.setAll(0);
      if (this.autoDockStage === 0) {
        this.shipRoot.position.copyFrom(this.getBaseApproachPosition());
        this.beginAutoDockStage(1);
      } else {
        this.shipRoot.position.copyFrom(this.getBaseDockPosition());
        this.openStation();
      }
    }
  }

  private updateBaseVisuals(_dt: number): void {
    if (this.baseShieldMaterial) {
      this.baseShieldMaterial.alpha = 0.08 + this.baseShieldFlash * 0.22;
      this.baseShieldMaterial.emissiveColor = new Color3(
        0.46 + this.baseShieldFlash * 0.28,
        0.62 + this.baseShieldFlash * 0.18,
        0.92 + this.baseShieldFlash * 0.06,
      );
    }

    for (let index = 0; index < this.baseChevronMaterials.length; index += 1) {
      const phase = performance.now() * 0.005 + index * 0.75;
      const glow = 0.38 + (Math.sin(phase) * 0.5 + 0.5) * 0.62;
      this.baseChevronMaterials[index].emissiveColor = new Color3(0.78 * glow, 0.54 * glow, 0.14 * glow);
      this.baseChevronMaterials[index].alpha = 0.54 + glow * 0.26;
    }
  }

  private createBase(): void {
    this.baseRoot.position.copyFrom(BASE_POSITION);

    const hullMaterial = new StandardMaterial("base-hull-mat", this.scene);
    hullMaterial.diffuseColor = new Color3(0.36, 0.37, 0.43);
    hullMaterial.emissiveColor = new Color3(0.05, 0.05, 0.08);
    hullMaterial.specularColor = new Color3(0.1, 0.1, 0.1);

    const accentMaterial = new StandardMaterial("base-accent-mat", this.scene);
    accentMaterial.disableLighting = true;
    accentMaterial.emissiveColor = new Color3(1, 0.78, 0.34);
    accentMaterial.diffuseColor = new Color3(0.82, 0.58, 0.22);

    const beaconMaterial = new StandardMaterial("base-beacon-mat", this.scene);
    beaconMaterial.disableLighting = true;
    beaconMaterial.emissiveColor = new Color3(1, 0.95, 0.86);
    beaconMaterial.diffuseColor = new Color3(0.84, 0.76, 0.62);

    const shieldMaterial = new StandardMaterial("base-shield-mat", this.scene);
    shieldMaterial.disableLighting = true;
    shieldMaterial.emissiveColor = new Color3(0.46, 0.62, 0.92);
    shieldMaterial.diffuseColor = new Color3(0.14, 0.2, 0.38);
    shieldMaterial.specularColor = Color3.Black();
    shieldMaterial.alpha = 0.13;
    shieldMaterial.backFaceCulling = false;
    this.baseShieldMaterial = shieldMaterial;

    const core = MeshBuilder.CreateCylinder(
      "base-core",
      { height: 12, diameter: 8.6, tessellation: 10 },
      this.scene,
    );
    core.parent = this.baseRoot;
    core.rotation.x = Math.PI * 0.5;
    core.material = hullMaterial;

    const spine = MeshBuilder.CreateBox(
      "base-spine",
      { width: 3.4, height: 3.4, depth: 26 },
      this.scene,
    );
    spine.parent = this.baseRoot;
    spine.material = hullMaterial;

    const hangar = MeshBuilder.CreateBox(
      "base-hangar",
      { width: 10, height: 5.4, depth: 6 },
      this.scene,
    );
    hangar.parent = this.baseRoot;
    hangar.position.z = 16;
    hangar.material = hullMaterial;

    const dock = MeshBuilder.CreateCylinder(
      "base-dock",
      { height: 5.6, diameter: 12.5, tessellation: 12 },
      this.scene,
    );
    dock.parent = this.baseRoot;
    dock.rotation.x = Math.PI * 0.5;
    dock.position.z = 21.5;
    dock.material = accentMaterial;

    const dishLeft = MeshBuilder.CreateBox(
      "base-wing-l",
      { width: 16, height: 1, depth: 4 },
      this.scene,
    );
    dishLeft.parent = this.baseRoot;
    dishLeft.position.set(-11.5, 0, -3.5);
    dishLeft.rotation.z = 0.1;
    dishLeft.material = hullMaterial;

    const dishRight = MeshBuilder.CreateBox(
      "base-wing-r",
      { width: 16, height: 1, depth: 4 },
      this.scene,
    );
    dishRight.parent = this.baseRoot;
    dishRight.position.set(11.5, 0, -3.5);
    dishRight.rotation.z = -0.1;
    dishRight.material = hullMaterial;

    const beacon = MeshBuilder.CreateSphere("base-beacon", { diameter: 2.4, segments: 8 }, this.scene);
    beacon.parent = this.baseRoot;
    beacon.position.set(0, 0, 27.5);
    beacon.material = beaconMaterial;

    const shield = MeshBuilder.CreateSphere("base-shield", { diameter: BASE_SAFE_RADIUS * 2, segments: 20 }, this.scene);
    shield.parent = this.baseRoot;
    shield.material = shieldMaterial;

    for (let index = 0; index < 4; index += 1) {
      const chevronMaterial = new StandardMaterial(`base-chevron-${index}`, this.scene);
      chevronMaterial.disableLighting = true;
      chevronMaterial.emissiveColor = new Color3(0.78, 0.54, 0.14);
      chevronMaterial.diffuseColor = new Color3(0.82, 0.58, 0.18);
      chevronMaterial.alpha = 0.75;
      this.baseChevronMaterials.push(chevronMaterial);

      const chevron = MeshBuilder.CreateCylinder(
        `base-chevron-mesh-${index}`,
        { height: 0.18, diameterTop: 0, diameterBottom: 4.8, tessellation: 3 },
        this.scene,
      );
      chevron.parent = this.baseRoot;
      chevron.position.set(0, -2.18, 14 + index * 7.2);
      chevron.rotation.x = Math.PI * 0.5;
      chevron.rotation.z = Math.PI;
      chevron.material = chevronMaterial;
    }
  }

  private openStation(): void {
    this.autoDockActive = false;
    this.autoDockStage = 0;
    this.autoDockProgress = 0;
    this.autoDockDuration = 0;
    this.stationOpen = true;
    this.keys.clear();
    this.shipVelocity.scaleInPlace(0);
    this.shipRoot.position.copyFrom(this.getBaseDockPosition());
    this.stationUi.overlay.classList.remove("hidden");
    if (document.pointerLockElement === this.canvas) {
      document.exitPointerLock();
    }
    this.updateStationUi("Docking clamps engaged.");
    this.setStatus("Docked at Frontier Station", 999);
  }

  private closeStation(): void {
    this.stationOpen = false;
    this.autoDockActive = false;
    this.autoDockStage = 0;
    this.autoDockProgress = 0;
    this.autoDockDuration = 0;
    this.baseDockRearmRequired = true;
    this.shipVelocity.scaleInPlace(0);
    this.stationUi.overlay.classList.add("hidden");
    this.setStatus("Docking clamps released. Throttle up to depart.", 1.8);
  }

  private updateStationUi(message?: string): void {
    this.stationUi.cargo.textContent = this.collectedSalvage.toString();
    this.stationUi.points.textContent = this.score.toString();
    this.stationUi.shield.textContent = `${Math.round(this.shield)}%`;
    if (message) {
      this.stationUi.message.textContent = message;
    }
  }

  private sellSalvage(): void {
    if (this.collectedSalvage === 0) {
      this.updateStationUi("Cargo hold is empty.");
      return;
    }

    const sold = this.collectedSalvage;
    const payout = sold * SALVAGE_SELL_VALUE;
    this.collectedSalvage = 0;
    this.score += payout;
    this.updateStationUi(`Sold ${sold} salvage for ${payout} points.`);
  }

  private repairShields(): void {
    const missingShield = Math.max(0, 100 - this.shield);
    if (missingShield <= 0) {
      this.updateStationUi("Shields already at full strength.");
      return;
    }

    const affordableRepair = Math.min(missingShield, Math.floor(this.score / SHIELD_REPAIR_COST));
    if (affordableRepair <= 0) {
      this.updateStationUi("Insufficient points for shield repair.");
      return;
    }

    this.shield += affordableRepair;
    this.score -= affordableRepair * SHIELD_REPAIR_COST;
    this.updateStationUi(`Repaired shields by ${affordableRepair}% for ${affordableRepair * SHIELD_REPAIR_COST} points.`);
  }

  private createCockpit(): void {
    const image = new window.Image();
    image.decoding = "async";
    image.src = new URL("./assets/cockpits/cockpit-default.png", import.meta.url).href;

    this.registerListener(image, "load", () => {
      const source = document.createElement("canvas");
      source.width = image.naturalWidth;
      source.height = image.naturalHeight;

      const sourceContext = source.getContext("2d");
      if (!sourceContext) {
        return;
      }

      sourceContext.imageSmoothingEnabled = false;
      sourceContext.drawImage(image, 0, 0);

      const pixels = sourceContext.getImageData(0, 0, source.width, source.height);
      for (let index = 0; index < pixels.data.length; index += 4) {
        const red = pixels.data[index];
        const green = pixels.data[index + 1];
        const blue = pixels.data[index + 2];

        if (green > 180 && red < 80 && blue < 80) {
          pixels.data[index + 3] = 0;
        }
      }

      sourceContext.putImageData(pixels, 0, 0);
      this.cockpitImageSource = source;
      this.redrawCockpitOverlay();
    });
  }

  private redrawCockpitOverlay(): void {
    const canvas = this.hud.cockpitOverlay;
    const context = canvas.getContext("2d");
    const source = this.cockpitImageSource;
    if (!context) {
      return;
    }

    const width = Math.max(1, Math.round(canvas.clientWidth));
    const height = Math.max(1, Math.round(canvas.clientHeight));
    const devicePixelRatio = window.devicePixelRatio || 1;
    const targetWidth = Math.round(width * devicePixelRatio);
    const targetHeight = Math.round(height * devicePixelRatio);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, canvas.width, canvas.height);
    if (!source) {
      return;
    }

    context.scale(devicePixelRatio, devicePixelRatio);
    context.imageSmoothingEnabled = false;

    const scale = Math.max(width / source.width, height / source.height);
    const drawWidth = source.width * scale;
    const drawHeight = source.height * scale;
    const drawX = (width - drawWidth) * 0.5;
    const drawY = height - drawHeight;

    context.drawImage(source, drawX, drawY, drawWidth, drawHeight);
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

    const sunCore = MeshBuilder.CreateSphere("sun-core", { diameter: 24, segments: 18 }, this.scene);
    const sunCoreMaterial = new StandardMaterial("sun-core-mat", this.scene);
    sunCoreMaterial.disableLighting = true;
    sunCoreMaterial.emissiveColor = new Color3(1, 0.8, 0.5);
    sunCoreMaterial.diffuseColor = new Color3(1, 0.86, 0.68);
    sunCore.material = sunCoreMaterial;
    sunCore.parent = this.starfieldRoot;
    sunCore.position.copyFrom(SUN_POSITION);

    const sunHalo = MeshBuilder.CreateSphere("sun-halo", { diameter: 44, segments: 18 }, this.scene);
    const sunHaloMaterial = new StandardMaterial("sun-halo-mat", this.scene);
    sunHaloMaterial.disableLighting = true;
    sunHaloMaterial.emissiveColor = new Color3(0.7, 0.86, 1);
    sunHaloMaterial.diffuseColor = new Color3(0.58, 0.74, 0.96);
    sunHaloMaterial.alpha = 0.16;
    sunHaloMaterial.backFaceCulling = false;
    sunHalo.material = sunHaloMaterial;
    sunHalo.parent = this.starfieldRoot;
    sunHalo.position.copyFrom(SUN_POSITION);
  }

  private updateHud(): void {
    this.hud.score.textContent = this.score.toString();
    this.hud.lives.textContent = this.lives.toString();
    this.hud.shield.textContent = `${Math.round(this.shield)}%`;
    this.hud.cargo.textContent = this.collectedSalvage.toString();
    this.hud.boost.textContent = `${Math.round(this.boostCharge)}%`;
    this.hud.speed.textContent = Math.round(this.shipVelocity.length()).toString();
    this.hud.boostVeil.style.opacity = `${this.boostVisual}`;
    const blur = this.boostVisual * 24;
    const saturate = 1 + this.boostVisual * 0.55;
    this.hud.boostVeil.style.backdropFilter = `blur(${blur}px) saturate(${saturate})`;
    this.hud.boostVeil.style.setProperty("-webkit-backdrop-filter", `blur(${blur}px) saturate(${saturate})`);
    this.updateObjectiveHud();
    this.updateBaseHud();
    this.updateEnemyHud();
    if (this.controlSettings.showFps) {
      this.hud.fpsMeter.textContent = `FPS ${Math.round(this.engine.getFps())}`;
    }
    if (this.stationOpen) {
      this.updateStationUi();
    }

    if (this.statusFlash === 0 && !this.gameOver && !this.stationOpen) {
      const dockingPrompt = this.getDockingPrompt();
      this.hud.status.textContent =
        dockingPrompt ??
        (this.hasActivePointerLock()
          ? "Mouse yaw/pitch  A/D strafe  Q/E roll  Shift boost  Space fire"
          : "Paused. Click to resume cockpit controls");
    }
  }

  private updateObjectiveHud(): void {
    const trackedCollectible = this.getTrackedCollectible();
    if (!trackedCollectible) {
      this.hud.objectiveDistance.textContent = "--";
      this.hud.objectiveEdge.classList.add("hidden");
      return;
    }

    const distance = this.updateEdgeMarker(trackedCollectible.position, this.hud.objectiveEdge, this.hud.objectiveEdgeArrow);
    this.hud.objectiveDistance.textContent = distance === null ? "--" : `${Math.round(distance)}m`;
  }

  private updateBaseHud(): void {
    const baseTarget = this.getBaseDockPosition();
    const distance = this.updateEdgeMarker(baseTarget, this.hud.baseEdge, this.hud.baseEdgeArrow);
    this.hud.baseDistance.textContent = distance === null ? "--" : `${Math.round(distance)}m`;
  }

  private updateEnemyHud(): void {
    const maxDistanceSquared = ENEMY_MARKER_DISTANCE * ENEMY_MARKER_DISTANCE;
    const nearbyEnemies = this.enemies
      .map((enemy) => ({
        enemy,
        distanceSquared: Vector3.DistanceSquared(this.shipRoot.position, enemy.root.position),
      }))
      .filter(({ distanceSquared }) => distanceSquared <= maxDistanceSquared)
      .sort((left, right) => left.distanceSquared - right.distanceSquared);

    this.ensureEnemyHudMarkers(nearbyEnemies.length);

    for (let index = 0; index < this.enemyHudMarkers.length; index += 1) {
      const marker = this.enemyHudMarkers[index];
      const trackedEnemy = nearbyEnemies[index];
      if (!trackedEnemy) {
        marker.edge.classList.add("hidden");
        continue;
      }

      const distance = this.updateEdgeMarker(trackedEnemy.enemy.root.position, marker.edge, marker.arrow);
      marker.label.textContent = distance === null ? "HOSTILE" : `HOSTILE ${Math.round(distance)}m`;
    }
  }

  private updateEdgeMarker(targetPosition: Vector3, edge: HTMLElement, arrow: HTMLElement): number | null {
    const toTarget = targetPosition.subtract(this.camera.globalPosition);
    const distance = toTarget.length();

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (width === 0 || height === 0 || distance < 0.001) {
      edge.classList.add("hidden");
      return null;
    }

    const forward = this.camera.getDirection(Vector3.Forward(this.scene.useRightHandedSystem)).normalize();
    const right = this.camera.getDirection(Vector3.Right()).normalize();
    const up = this.camera.getDirection(Vector3.Up()).normalize();

    const localX = Vector3.Dot(toTarget, right);
    const localY = Vector3.Dot(toTarget, up);
    const localZ = Vector3.Dot(toTarget, forward);
    const aspect = width / height;
    const tanHalfFov = Math.tan(this.camera.fov * 0.5);
    const projectedX = localX / Math.max(Math.abs(localZ), 0.001) / (tanHalfFov * aspect);
    const projectedY = localY / Math.max(Math.abs(localZ), 0.001) / tanHalfFov;

    const onScreen = localZ > 0 && Math.abs(projectedX) <= 1 && Math.abs(projectedY) <= 1;
    if (onScreen) {
      edge.classList.add("hidden");
      return distance;
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

    edge.style.left = `${edgeX}px`;
    edge.style.top = `${edgeY}px`;
    arrow.style.transform = `rotate(${angle}deg)`;
    edge.classList.remove("hidden");
    return distance;
  }

  private ensureEnemyHudMarkers(count: number): void {
    while (this.enemyHudMarkers.length < count) {
      const edge = document.createElement("div");
      edge.className = "objective-edge objective-edge--enemy hidden";

      const arrow = document.createElement("span");
      arrow.className = "objective-edge__arrow";
      arrow.textContent = "▲";

      const label = document.createElement("span");
      label.className = "objective-edge__label";
      label.textContent = "HOSTILE";

      edge.append(arrow, label);
      this.hud.enemyEdgeLayer.append(edge);
      this.enemyHudMarkers.push({ edge, arrow, label });
    }
  }

  private getDockingPrompt(): string | null {
    if (this.autoDockActive) {
      return "Autodocking to Frontier Station";
    }

    const baseDistance = Vector3.Distance(this.shipRoot.position, this.baseRoot.position);
    if (baseDistance > BASE_SAFE_RADIUS * 1.16) {
      return null;
    }

    if (this.baseDockRearmRequired) {
      return "Safe zone secured. Throttle out to leave the station";
    }

    return "Station field will capture your ship automatically";
  }

  private setStatus(text: string, duration: number): void {
    this.hud.status.textContent = text;
    this.statusFlash = duration;
  }

  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.disposed = true;
    this.keys.clear();
    this.mouseLookX = 0;
    this.mouseLookY = 0;
    this.engine.stopRenderLoop(this.renderLoop);

    for (const cleanup of this.cleanupCallbacks.splice(0)) {
      cleanup();
    }

    if (this.hasActivePointerLock()) {
      document.exitPointerLock();
    }

    this.clearBullets();
    this.clearExplosions();
    this.clearWorld();
    this.asteroidModelAsset?.dispose();
    this.asteroidModelAsset = null;
    this.enemyModelAsset?.dispose();
    this.enemyModelAsset = null;
    this.scene.dispose();
    this.engine.dispose();
    this.audio.dispose();
  }

  private hasActivePointerLock(): boolean {
    return document.pointerLockElement === this.canvas;
  }

  private shouldPauseForPointerUnlock(): boolean {
    return !this.hasActivePointerLock() && !this.autoDockActive;
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
    this.settingsUi.mouseInvertHorizontal.checked = this.controlSettings.mouseInvertHorizontal;
    this.settingsUi.mouseInvertVertical.checked = this.controlSettings.mouseInvertVertical;
    this.settingsUi.keyboardInvertHorizontal.checked = this.controlSettings.keyboardInvertHorizontal;
    this.settingsUi.keyboardInvertVertical.checked = this.controlSettings.keyboardInvertVertical;
    this.settingsUi.arrowLookSpeed.value = String(this.controlSettings.arrowLookSpeed);
    this.settingsUi.arrowLookSpeedValue.textContent = `${this.controlSettings.arrowLookSpeed}%`;
    this.settingsUi.showFps.checked = this.controlSettings.showFps;
    this.hud.fpsMeter.classList.toggle("hidden", !this.controlSettings.showFps);
  }

  private loadControlSettings(): ControlSettings {
    const fallback: ControlSettings = {
      mouseInvertHorizontal: true,
      mouseInvertVertical: true,
      keyboardInvertHorizontal: true,
      keyboardInvertVertical: false,
      arrowLookSpeed: ARROW_LOOK_SPEED_DEFAULT,
      showFps: false,
    };

    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return fallback;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<
        ControlSettings & { invertHorizontal?: boolean; invertVertical?: boolean }
      >;
      const legacyHorizontal =
        typeof parsed.invertHorizontal === "boolean" ? parsed.invertHorizontal : fallback.mouseInvertHorizontal;
      const legacyVertical =
        typeof parsed.invertVertical === "boolean" ? parsed.invertVertical : fallback.mouseInvertVertical;

      return {
        mouseInvertHorizontal:
          typeof parsed.mouseInvertHorizontal === "boolean" ? parsed.mouseInvertHorizontal : legacyHorizontal,
        mouseInvertVertical:
          typeof parsed.mouseInvertVertical === "boolean" ? parsed.mouseInvertVertical : legacyVertical,
        keyboardInvertHorizontal:
          typeof parsed.keyboardInvertHorizontal === "boolean"
            ? parsed.keyboardInvertHorizontal
            : legacyHorizontal,
        keyboardInvertVertical:
          typeof parsed.keyboardInvertVertical === "boolean"
            ? parsed.keyboardInvertVertical
            : fallback.keyboardInvertVertical,
        arrowLookSpeed: clampNumber(
          typeof parsed.arrowLookSpeed === "number" ? parsed.arrowLookSpeed : ARROW_LOOK_SPEED_DEFAULT,
          0,
          100,
        ),
        showFps: typeof parsed.showFps === "boolean" ? parsed.showFps : fallback.showFps,
      };
    } catch {
      return fallback;
    }
  }

  private getArrowLookRate(): number {
    const normalized = this.controlSettings.arrowLookSpeed / 100;
    return ARROW_LOOK_SPEED_MIN + (ARROW_LOOK_SPEED_MAX - ARROW_LOOK_SPEED_MIN) * normalized;
  }

  private persistControlSettings(): void {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(this.controlSettings));
  }

  private registerListener(
    target: EventTarget,
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void {
    target.addEventListener(type, listener, options);
    this.cleanupCallbacks.push(() => {
      target.removeEventListener(type, listener, options);
    });
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

function rollAsteroidClass(rng: () => number = Math.random): AsteroidClass {
  const tierRoll = rng();

  if (tierRoll < ASTEROID_HUGE_CHANCE) {
    return "huge";
  }

  if (tierRoll < ASTEROID_HUGE_CHANCE + ASTEROID_LARGE_CHANCE) {
    return "large";
  }

  return "medium";
}

function rollAsteroidSizeForClass(asteroidClass: AsteroidClass, rng: () => number = Math.random): number {
  const baseSize = randomBetween(ASTEROID_BASE_SIZE_MIN, ASTEROID_BASE_SIZE_MAX, rng);
  return baseSize * ASTEROID_CLASS_SCALE[asteroidClass];
}

function getNextSmallerAsteroidClass(asteroidClass: AsteroidClass): AsteroidClass | null {
  if (asteroidClass === "huge") {
    return "large";
  }

  if (asteroidClass === "large") {
    return "medium";
  }

  if (asteroidClass === "medium") {
    return "small";
  }

  return null;
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

function getSectorKeyForPosition(position: Vector3): string {
  return sectorKey(
    Math.floor(position.x / WORLD_SECTOR_SIZE),
    Math.floor(position.y / WORLD_SECTOR_SIZE),
    Math.floor(position.z / WORLD_SECTOR_SIZE),
  );
}

function reflectVector(vector: Vector3, normal: Vector3): Vector3 {
  return vector.subtract(normal.scale(2 * Vector3.Dot(vector, normal)));
}

function distancePointToSegmentSquared(point: Vector3, segmentStart: Vector3, segmentEnd: Vector3): number {
  const segment = segmentEnd.subtract(segmentStart);
  const lengthSquared = segment.lengthSquared();
  if (lengthSquared < 0.000001) {
    return Vector3.DistanceSquared(point, segmentStart);
  }

  const projection = Vector3.Dot(point.subtract(segmentStart), segment) / lengthSquared;
  const clamped = Math.min(1, Math.max(0, projection));
  const closestPoint = segmentStart.add(segment.scale(clamped));
  return Vector3.DistanceSquared(point, closestPoint);
}

function quadraticBezierPoint(start: Vector3, control: Vector3, end: Vector3, t: number): Vector3 {
  const oneMinusT = 1 - t;
  return start
    .scale(oneMinusT * oneMinusT)
    .add(control.scale(2 * oneMinusT * t))
    .add(end.scale(t * t));
}

function quadraticBezierTangent(start: Vector3, control: Vector3, end: Vector3, t: number): Vector3 {
  return control
    .subtract(start)
    .scale(2 * (1 - t))
    .add(end.subtract(control).scale(2 * t));
}

function smoothstep(value: number): number {
  const clamped = clampNumber(value, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
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
