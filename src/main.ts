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
          <span class="panel__label">Score</span>
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
          <span class="panel__label">Speed</span>
          <span class="panel__value" data-speed>0</span>
        </div>
        <button class="panel panel--button" type="button" data-open-settings>
          <span class="panel__label">Config</span>
          <span class="panel__value">Control</span>
        </button>
      </div>
      <div class="reticle">
        <span></span>
        <span></span>
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
    </div>
  </div>
`;

new Aster3DGame(app);
