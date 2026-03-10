# Object Preview Plan

status: draft

## Why Rename `bestiary`

The current feature is called `bestiary`, but the screen is already showing more than enemies:

- enemy ships
- asteroids
- the base station

That means the current name no longer matches the real scope of the feature.

Recommended naming direction:

- user-facing label: `Object Preview` or `Archive`
- technical name: `object preview`

Suggested future rename in code:

- `src/bestiary.ts` -> `src/objectPreview.ts`
- `BestiaryViewer` -> `ObjectPreviewViewer`
- `BestiaryObjectId` -> `PreviewObjectId`
- URL param `?bestiary=enemy` -> `?preview=enemy`

This rename does not need to happen immediately, but new work should be planned around the broader concept instead of the old name.

## Feature Goal

The object preview screen should serve two roles at the same time:

1. A player-facing archive of 3D world objects with short descriptions.
2. A developer-facing preview tool for inspecting the exact same presentation used in gameplay.

This is especially valuable for tuning:

- enemy light positions
- weapon mount positions
- animation states
- future moving parts such as hangar doors or station gates

## Core Rule

The preview screen must not build a separate approximation of a world object.

It should always display the same presentation layer used by gameplay.

That means:

- one place defines the enemy model
- one place defines engine glows
- one place defines weapon mounts
- one place defines future animated parts

The preview layer should only add controls and debug helpers on top.

## Current Good Direction

The enemy already moved in the right direction:

- shared offsets live in `src/enemyConfig.ts`
- shared model loading lives in `src/spacecraftAsset.ts`
- shared enemy assembly now lives in `src/enemyPresentation.ts`

This should become the standard pattern for every previewable object.

## Target Architecture

Separate the system into two layers:

### 1. Presentation Layer

This layer builds and animates the real object.

Responsibilities:

- create meshes
- attach materials
- create glows, mounts, helper nodes
- expose update hooks for animations
- expose a clean dispose path

Examples:

- `enemyPresentation.ts`
- future `asteroidPresentation.ts`
- future `basePresentation.ts`

### 2. Preview Layer

This layer hosts the object inside the preview screen and exposes supported interactions.

Responsibilities:

- create the object presentation
- declare available actions
- execute those actions
- update preview-only state
- expose debug toggles

Examples:

- future `previews/enemyPreview.ts`
- future `previews/asteroidPreview.ts`
- future `previews/basePreview.ts`

## Capability-Based Actions

The preview toolbar should not hardcode object-specific behavior with conditionals such as:

- if enemy -> show fire button
- if asteroid -> hide fire button
- if base -> show gate button

Instead, each preview object should declare what it can do.

Suggested contract:

```ts
type PreviewAction =
  | { id: string; label: string; kind: "button" }
  | { id: string; label: string; kind: "toggle"; value: boolean };

type PreviewHandle = {
  actions(): PreviewAction[];
  invoke(actionId: string, value?: boolean): void;
  update(dt: number, timeMs: number): void;
  dispose(): void;
};
```

This allows different objects to expose different controls naturally.

Examples:

- enemy:
  - toggle lights
  - fire
  - toggle markers
- asteroid:
  - toggle spin
  - reset rotation
- base:
  - toggle shield
  - open gate
  - close gate

## Proposed Folder Structure

```txt
src/
  objectPreview.ts
  previewRegistry.ts
  previews/
    enemyPreview.ts
    asteroidPreview.ts
    basePreview.ts
  enemyPresentation.ts
  asteroidPresentation.ts
  basePresentation.ts
```

Notes:

- `previewRegistry.ts` maps URL ids to preview factories
- `objectPreview.ts` owns scene setup, camera, layout, and toolbar rendering
- presentation modules remain reusable by gameplay

## Implementation Phases

## Phase 1: Rename and Stabilize

- rename the feature internally from `bestiary` to `object preview`
- keep backward compatibility for the old URL if needed for a short time
- keep the current preview screen functional during the rename

Deliverable:

- neutral naming in code and UI

## Phase 2: Introduce `PreviewHandle`

- move object-specific preview behavior out of the viewer
- let each object expose its own actions
- render the toolbar from `actions()`

Deliverable:

- preview UI becomes generic
- object behavior becomes pluggable

## Phase 3: Enemy Controls

First object to fully support the new system should be the enemy ship.

Recommended first actions:

- `Lights`
  - toggle engine glows on and off
- `Fire`
  - spawn a preview projectile or muzzle flash
- `Markers`
  - show or hide weapon/light debug markers

Deliverable:

- enemy preview becomes a real tuning tool

## Phase 4: Base Controls

Add base-specific behavior once the enemy pattern is working.

Possible actions:

- `Shield`
  - toggle station shield visibility
- `Gate`
  - open/close docking gate if added later
- `Beacons`
  - toggle beacon/emissive elements

Deliverable:

- object preview supports non-combat interactions

## Phase 5: Asteroid Controls

Asteroids are simpler but still useful for inspection.

Possible actions:

- `Spin`
  - start/stop rotation
- `Variants`
  - swap between size or mineral variants later

Deliverable:

- preview is useful for passive world props too

## URL and Refresh Workflow

The preview mode should remain easy to reload directly with the browser.

Recommended direction:

- `?preview=enemy`
- `?preview=asteroid`
- `?preview=base`

Optional debug params:

- `?preview=enemy&markers=1`
- future `?preview=base&shield=1`

This preserves the current fast F5 workflow for iteration.

## Risks

### 1. Duplicate Logic

Risk:

- gameplay and preview drift apart again

Mitigation:

- keep all object construction in presentation modules
- preview modules should only orchestrate controls

### 2. Toolbar Coupling

Risk:

- the viewer starts accumulating object-specific ifs

Mitigation:

- keep the toolbar driven only by `PreviewHandle.actions()`

### 3. Debug Controls Polluting Gameplay Code

Risk:

- preview toggles leak into runtime gameplay paths

Mitigation:

- keep debug-only controls in preview modules
- keep presentation modules focused on shared visual behavior

## Minimal Next Step

The safest next implementation step is:

1. rename the concept from `bestiary` to `object preview`
2. introduce `PreviewHandle`
3. migrate the enemy preview first
4. add a toolbar with:
   - lights
   - fire
   - markers

This gives immediate value without redesigning every object at once.

## Recommendation

Treat this feature as an `Object Preview` system, not a bestiary.

Its long-term purpose is broader:

- player-facing archive
- art review tool
- gameplay presentation debugger
- fast iteration surface for any 3D object in the game

That framing will make future extensions much cleaner than continuing with the narrower `bestiary` naming.
