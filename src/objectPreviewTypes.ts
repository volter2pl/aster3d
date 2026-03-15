import { Scene } from "@babylonjs/core/scene";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";

export type PreviewObjectId = "enemy" | "asteroid" | "base" | "ship";

export type PreviewEntry = {
  id: PreviewObjectId;
  title: string;
  eyebrow: string;
  description: string;
  hint: string;
};

export type PreviewAction = {
  id: string;
  label: string;
  kind: "button" | "toggle";
  active?: boolean;
};

export type PreviewHandle = {
  actions(): PreviewAction[];
  invoke(actionId: string, nextActive?: boolean): void;
  update(dt: number, timeMs: number): void;
  dispose(): void;
};

export type PreviewFactoryContext = {
  scene: Scene;
  root: TransformNode;
  initialMarkers: boolean;
};
