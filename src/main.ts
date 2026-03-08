import "./style.css";
import { Aster3DGame } from "./game";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

app.innerHTML = `
  <div class="shell">
    <canvas class="game-canvas" aria-label="Aster3D game view"></canvas>
    <div class="hud" aria-hidden="true">
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
          <label class="toggle">
            <input type="checkbox" data-invert-horizontal />
            <span>Invert horizontal axis</span>
          </label>
          <label class="toggle">
            <input type="checkbox" data-invert-vertical />
            <span>Invert vertical axis</span>
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

new Aster3DGame(app);
