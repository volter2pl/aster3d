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
import {
  ObjectPreviewViewer,
  getPreviewEntry,
  getPreviewHref,
  listPreviewEntries,
  resolvePreviewObjectId,
  type PreviewObjectId,
} from "./objectPreview";
import { getPreviewCredits } from "./objectPreviewCredits";
import { Aster3DGame } from "./game";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Missing #app root element");
}

const root = app;

function renderGameShell(): void {
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
            <span class="panel__value" data-cargo>0/1</span>
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
          <a class="panel panel--button panel--link" href="${getPreviewHref("enemy")}">
            <span class="panel__label">Archive</span>
            <span class="panel__value">Objects</span>
          </a>
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
        <div class="fps-meter hidden" data-fps-meter>FPS 0</div>
        <div class="objective-edge hidden" data-objective-edge>
          <span class="objective-edge__arrow">▲</span>
          <span class="objective-edge__label">SALVAGE</span>
        </div>
        <div class="objective-edge objective-edge--base hidden" data-base-edge>
          <span class="objective-edge__arrow" data-base-edge-arrow>▲</span>
          <span class="objective-edge__label">BASE</span>
        </div>
        <div class="enemy-edge-layer" data-enemy-edge-layer></div>
        <div class="cargo-alert hidden" data-cargo-alert aria-hidden="true">
          <span class="cargo-alert__eyebrow">Warning</span>
          <strong class="cargo-alert__title">Cargo Full</strong>
          <span class="cargo-alert__copy" data-cargo-alert-copy>No free cargo slots. Salvage left in open space.</span>
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
            <p class="settings-group__title">Interface</p>
            <label class="toggle">
              <input type="checkbox" data-show-fps />
              <span>Show FPS counter</span>
            </label>
            <button class="overlay__action" type="button" data-close-settings>Close</button>
          </div>
        </div>
        <div class="overlay hidden" data-station>
          <div class="overlay__card overlay__card--station">
            <div class="station-arcade">
              <div class="station-arcade__header">
                <div class="station-logo">
                  <span class="station-logo__kicker">Frontier Station</span>
                  <strong class="station-logo__title">THE SHIPYARD</strong>
                </div>
                <div class="station-arcade__header-meta">
                  <span>Docked // Bay 03</span>
                  <span>Scavenger program online</span>
                </div>
              </div>

              <div class="station-arcade__main">
                <section class="station-preview-bay">
                  <div class="station-preview-bay__label">Current Ship</div>
                  <div class="station-preview-bay__frame">
                    <canvas
                      class="station-preview-bay__canvas"
                      aria-label="Current ship preview"
                      data-station-preview-canvas
                    ></canvas>
                  </div>
                  <div class="station-preview-bay__caption">
                    <span>Scavenger Mk.I</span>
                    <strong>Field Retrofit Hull</strong>
                  </div>
                </section>

                <section class="station-briefing">
                  <p class="station-briefing__eyebrow">Selected Upgrade</p>
                  <h3 class="station-briefing__title" data-station-feature-title>Cargo expansion rack installed</h3>
                  <p class="station-briefing__line" data-station-feature-line>Level 0 // cargo hold operating at 1 slot.</p>
                  <p class="station-briefing__copy" data-station-feature-copy>
                    Add one salvage slot per install to stay longer in hostile sectors before banking your run.
                  </p>
                  <div class="station-briefing__forecast">
                    <span>Upgrade prices</span>
                    <strong data-station-cargo-forecast>2 slots / 200 pts  •  3 slots / 400 pts  •  4 slots / 800 pts</strong>
                  </div>
                </section>

                <aside class="station-stats-rail">
                  <div class="station-stats-rail__item">
                    <span>Cargo hold</span>
                    <strong data-station-cargo>0 / 1</strong>
                  </div>
                  <div class="station-stats-rail__item">
                    <span>Banked points</span>
                    <strong data-station-points>0</strong>
                  </div>
                  <div class="station-stats-rail__item">
                    <span>Shield integrity</span>
                    <strong data-station-shield>100%</strong>
                  </div>
                  <div class="station-stats-rail__item">
                    <span>Cargo level</span>
                    <strong data-station-cargo-level>LVL 0</strong>
                  </div>
                  <div class="station-stats-rail__item">
                    <span>Installed capacity</span>
                    <strong data-station-cargo-capacity>1 slot</strong>
                  </div>
                  <div class="station-stats-rail__item">
                    <span>Next cargo slot</span>
                    <strong data-station-cargo-cost>200 pts</strong>
                  </div>
                </aside>
              </div>

              <div class="station-ribbon">
                <button class="shop-card shop-card--active" type="button" data-upgrade-cargo>
                  <span class="shop-card__label">Cargo</span>
                  <strong class="shop-card__value">Install cargo slot</strong>
                </button>
                <button class="shop-card shop-card--locked" type="button" disabled>
                  <span class="shop-card__label">Shields</span>
                  <strong class="shop-card__value">Offline</strong>
                </button>
                <button class="shop-card shop-card--locked" type="button" disabled>
                  <span class="shop-card__label">Weapons</span>
                  <strong class="shop-card__value">Offline</strong>
                </button>
                <button class="shop-card" type="button" data-sell-salvage>
                  <span class="shop-card__label">Sell</span>
                  <strong class="shop-card__value">Bank salvage</strong>
                </button>
                <button class="shop-card" type="button" data-repair-shields>
                  <span class="shop-card__label">Repair</span>
                  <strong class="shop-card__value">Restore shields</strong>
                </button>
                <button class="shop-card shop-card--launch" type="button" data-undock>
                  <span class="shop-card__label">Launch</span>
                  <strong class="shop-card__value">Return to sector</strong>
                </button>
              </div>

              <div class="station-ticker" data-station-message>Sell salvage for points or repair shields.</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderObjectPreviewShell(objectId: PreviewObjectId): void {
  const entry = getPreviewEntry(objectId);
  const credits = getPreviewCredits(objectId);
  const hasCredits = credits.length > 0;
  const objectLinks = listPreviewEntries()
    .map((candidate) => {
      const activeClass = candidate.id === objectId ? " viewer-nav__link--active" : "";
      return `<a class="viewer-nav__link${activeClass}" href="${getPreviewHref(candidate.id)}">${candidate.title}</a>`;
    })
    .join("");
  const markerLegend =
    objectId === "enemy"
      ? `
        <div class="viewer-legend">
          <div class="viewer-legend__item"><span class="viewer-legend__swatch viewer-legend__swatch--weapon"></span>Weapon mounts</div>
          <div class="viewer-legend__item"><span class="viewer-legend__swatch viewer-legend__swatch--front"></span>Front engine lights</div>
          <div class="viewer-legend__item"><span class="viewer-legend__swatch viewer-legend__swatch--rear"></span>Rear engine lights</div>
          <div class="viewer-legend__item"><span class="viewer-legend__swatch viewer-legend__swatch--exhaust"></span>Rear exhaust lights</div>
        </div>
      `
      : "";
  const creditsButton = hasCredits
    ? `
        <button class="viewer-info-button" type="button" data-preview-credits-open aria-label="Open asset credits">
          i
        </button>
      `
    : "";
  const creditsModal = hasCredits
    ? `
        <div class="viewer-credits hidden" data-preview-credits-modal>
          <div class="viewer-credits__backdrop" data-preview-credits-close></div>
          <div class="overlay__card viewer-credits__card" role="dialog" aria-modal="true" aria-labelledby="viewer-credits-title">
            <div class="viewer-credits__header">
              <div>
                <p class="overlay__eyebrow viewer-panel__eyebrow">Credits</p>
                <h2 id="viewer-credits-title">3D Asset Credits</h2>
              </div>
              <button class="viewer-credits__close" type="button" data-preview-credits-close aria-label="Close credits">
                Close
              </button>
            </div>
            <div class="viewer-credits__list">
              ${credits
                .map(
                  (credit) => `
                    <section class="viewer-credits__item">
                      ${credit.relationLabel ? `<div class="viewer-credits__eyebrow">${credit.relationLabel}</div>` : ""}
                      <h3>${credit.title}</h3>
                      ${
                        credit.creatorName
                          ? `<p>Author: ${
                              credit.creatorUrl
                                ? `<a href="${credit.creatorUrl}" target="_blank" rel="noreferrer">${credit.creatorName}</a>`
                                : credit.creatorName
                            }</p>`
                          : ""
                      }
                      <p>Source: <a href="${credit.sourceUrl}" target="_blank" rel="noreferrer">${credit.sourceLabel}</a></p>
                      ${
                        credit.licenseName
                          ? `<p>License: <a href="${credit.licenseUrl}" target="_blank" rel="noreferrer">${credit.licenseName}</a></p>`
                          : ""
                      }
                      ${credit.changes ? `<p>${credit.changes}</p>` : ""}
                      ${credit.notes ? `<p class="viewer-credits__note">${credit.notes}</p>` : ""}
                    </section>
                  `,
                )
                .join("")}
            </div>
          </div>
        </div>
      `
    : "";

  root.innerHTML = `
    <div class="viewer-shell">
      <aside class="viewer-panel">
        <div class="viewer-panel__topbar">
          <p class="overlay__eyebrow viewer-panel__eyebrow">${entry.eyebrow}</p>
          ${creditsButton}
        </div>
        <h1 class="viewer-panel__title">${entry.title}</h1>
        <p class="viewer-panel__description">${entry.description}</p>
        <p class="viewer-panel__hint">${entry.hint}</p>
        <nav class="viewer-nav" aria-label="Object preview objects">
          ${objectLinks}
        </nav>
        <div class="preview-toolbar" data-preview-actions></div>
        ${markerLegend}
        <div class="viewer-actions">
          <a class="overlay__action viewer-actions__link" href="./">Back to flight</a>
        </div>
      </aside>
      <div class="viewer-stage">
        <canvas class="game-canvas viewer-canvas" aria-label="Object preview" data-preview-canvas></canvas>
      </div>
      ${creditsModal}
    </div>
  `;
}

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

type DisposableScreen = {
  dispose: () => void;
};

let screen: DisposableScreen | null = null;

async function startGame(): Promise<void> {
  if (!Engine.IsSupported) {
    renderStartupError(
      root,
      "WebGL is not available",
      "Aster3D could not create a WebGL context, so the 3D scene cannot start.",
    );
    return;
  }

  const params = new URLSearchParams(window.location.search);
  const previewObject = resolvePreviewObjectId(params);
  const showMarkers = params.get("markers") === "1";

  try {
    if (previewObject) {
      renderObjectPreviewShell(previewObject);
      screen = await ObjectPreviewViewer.create(root, { objectId: previewObject, showMarkers });
      return;
    }

    renderGameShell();
    screen = await Aster3DGame.create(root);
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
    screen?.dispose();
    root.innerHTML = "";
  });
}
