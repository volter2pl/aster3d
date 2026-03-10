import "./style.css";
import { Engine } from "@babylonjs/core/Engines/engine";
import "@babylonjs/core/Shaders/default.vertex";
import "@babylonjs/core/Shaders/default.fragment";
import "@babylonjs/core/Shaders/kernelBlur.vertex";
import "@babylonjs/core/Shaders/kernelBlur.fragment";
import "@babylonjs/core/Shaders/glowMapMerge.vertex";
import "@babylonjs/core/Shaders/glowMapMerge.fragment";
import "@babylonjs/core/Shaders/glowBlurPostProcess.fragment";
import "@babylonjs/core/Shaders/glowMapGeneration.vertex";
import "@babylonjs/core/Shaders/glowMapGeneration.fragment";
import { Aster3DGame } from "./game";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

const root = app;

root.innerHTML = `
  <div class="shell">
    <canvas class="game-canvas" aria-label="Aster3D game view"></canvas>
    <div class="hud" aria-hidden="true">
      <canvas class="cockpit-overlay" data-cockpit-overlay></canvas>
      <div class="hud__top">
        <div class="panel">
          <span class="panel__label">Points</span>
          <span class="panel__value" data-score>0</span>
        </div>
        <div class="panel">
          <span class="panel__label">Lives</span>
          <span class="panel__value" data-lives>3</span>
        </div>
        <div class="panel">
          <span class="panel__label">Shield</span>
          <span class="panel__value" data-shield>100%</span>
        </div>
        <div class="panel">
          <span class="panel__label">Cargo</span>
          <span class="panel__value" data-cargo>0</span>
        </div>
        <div class="panel">
          <span class="panel__label">Boost</span>
          <span class="panel__value" data-boost>100%</span>
        </div>
        <div class="panel">
          <span class="panel__label">Speed</span>
          <span class="panel__value" data-speed>0</span>
        </div>
        <button class="panel panel--button" type="button" data-open-settings>
          <span class="panel__label">Config</span>
          <span class="panel__value">Control</span>
        </button>
        <div class="panel panel--objective">
          <span class="panel__label">Target</span>
          <span class="panel__value panel__value--objective">
            <span data-objective-distance>--</span>
          </span>
        </div>
        <div class="panel panel--base">
          <span class="panel__label">Base</span>
          <span class="panel__value" data-base-distance>--</span>
        </div>
      </div>
      <div class="reticle">
        <span></span>
        <span></span>
      </div>
      <div class="boost-veil" data-boost-veil></div>
      <div class="objective-edge hidden" data-objective-edge>
        <span class="objective-edge__arrow">▲</span>
        <span class="objective-edge__label">SALVAGE</span>
      </div>
      <div class="objective-edge objective-edge--base hidden" data-base-edge>
        <span class="objective-edge__arrow" data-base-edge-arrow>▲</span>
        <span class="objective-edge__label">BASE</span>
      </div>
      <div class="hud__bottom">
        <div class="status" data-status>Click to engage cockpit controls</div>
      </div>
      <div class="overlay hidden" data-game-over>
        <div class="overlay__card">
          <p class="overlay__eyebrow">Flight terminated</p>
          <h1>Hull integrity lost</h1>
          <p data-final-score>Final score: 0</p>
          <p>Press <strong>R</strong> to relaunch.</p>
        </div>
      </div>
      <div class="overlay hidden" data-settings>
        <div class="overlay__card overlay__card--settings">
          <p class="overlay__eyebrow">Configuration</p>
          <h2>Control</h2>
          <p class="settings-group__title">Mouse</p>
          <label class="toggle">
            <input type="checkbox" data-mouse-invert-horizontal />
            <span>Invert horizontal axis</span>
          </label>
          <label class="toggle">
            <input type="checkbox" data-mouse-invert-vertical />
            <span>Invert vertical axis</span>
          </label>
          <p class="settings-group__title">Keyboard</p>
          <label class="toggle">
            <input type="checkbox" data-keyboard-invert-horizontal />
            <span>Invert horizontal axis</span>
          </label>
          <label class="toggle">
            <input type="checkbox" data-keyboard-invert-vertical />
            <span>Invert vertical axis</span>
          </label>
          <label class="slider-field">
            <span class="slider-field__label">
              Arrow key turn rate
              <strong data-arrow-look-speed-value>20%</strong>
            </span>
            <input
              class="slider-field__input"
              type="range"
              min="0"
              max="100"
              step="1"
              value="20"
              data-arrow-look-speed
            />
          </label>
          <button class="overlay__action" type="button" data-close-settings>Close</button>
        </div>
      </div>
      <div class="overlay hidden" data-station>
        <div class="overlay__card overlay__card--station">
          <p class="overlay__eyebrow overlay__eyebrow--safe">Docked</p>
          <h2>Frontier Station</h2>
          <div class="station-grid">
            <div class="station-stat">
              <span>Cargo</span>
              <strong data-station-cargo>0</strong>
            </div>
            <div class="station-stat">
              <span>Points</span>
              <strong data-station-points>0</strong>
            </div>
            <div class="station-stat">
              <span>Shield</span>
              <strong data-station-shield>100%</strong>
            </div>
          </div>
          <p class="station-note" data-station-message>Sell salvage for points or repair shields.</p>
          <div class="station-actions">
            <button class="overlay__action" type="button" data-sell-salvage>Sell salvage</button>
            <button class="overlay__action" type="button" data-repair-shields>Repair shields</button>
            <button class="overlay__action overlay__action--ghost" type="button" data-undock>Undock</button>
          </div>
        </div>
      </div>
    </div>
  </div>
`;

function renderStartupError(root: HTMLDivElement, title: string, message: string): void {
  root.innerHTML = `
    <div class="shell">
      <div class="overlay">
        <div class="overlay__card">
          <p class="overlay__eyebrow">Renderer unavailable</p>
          <h1>${title}</h1>
          <p>${message}</p>
          <p>Enable hardware acceleration or try a browser with WebGL support.</p>
        </div>
      </div>
    </div>
  `;
}

let game: Aster3DGame | null = null;

async function startGame(): Promise<void> {
  if (!Engine.IsSupported) {
    renderStartupError(
      root,
      "WebGL is not available",
      "Aster3D could not create a WebGL context, so the 3D scene cannot start.",
    );
    return;
  }

  try {
    game = await Aster3DGame.create(root);
  } catch (error) {
    console.error("Failed to start Aster3D", error);
    const message =
      error instanceof Error ? error.message : "The renderer failed during startup for an unknown reason.";
    renderStartupError(root, "3D renderer failed to start", message);
  }
}

void startGame();

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    game?.dispose();
    root.innerHTML = "";
  });
}
