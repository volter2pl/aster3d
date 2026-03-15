import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import { AnimationGroupMask } from "@babylonjs/core/Animations/animationGroupMask";
import type { DockedShipAnimationProfile } from "./dockedShipProfiles";

export interface DockedShipAnimationStrategy {
  beginArrivalSequence(): boolean;
  dispose(): void;
  setCanopyOpen(open: boolean, options?: { animate?: boolean }): void;
  setIdleState(): void;
  startEngineLoop(): void;
  stopEngineLoop(): void;
  update(dt: number): boolean;
}

export class NullDockedShipAnimationStrategy implements DockedShipAnimationStrategy {
  public beginArrivalSequence(): boolean {
    return false;
  }

  public dispose(): void {}

  public setCanopyOpen(_open: boolean, _options?: { animate?: boolean }): void {}

  public setIdleState(): void {}

  public startEngineLoop(): void {}

  public stopEngineLoop(): void {}

  public update(_dt: number): boolean {
    return false;
  }
}

export class SplitDockedShipAnimationStrategy implements DockedShipAnimationStrategy {
  private readonly canopyAnimationGroup: AnimationGroup | null;
  private readonly canopyEndFrame: number;
  private readonly canopyOpenDuration: number;
  private readonly canopyStartFrame: number;
  private readonly engineAnimationGroup: AnimationGroup | null;
  private canopyProgress = 0;
  private canopyTargetProgress = 0;
  private completeArrivalOnStop = false;
  private transitionActive = false;

  public constructor(animationGroup: AnimationGroup, profile: DockedShipAnimationProfile) {
    this.canopyAnimationGroup = createFilteredAnimationGroup(animationGroup, profile.canopyTargetPrefixes);
    this.engineAnimationGroup = createFilteredAnimationGroup(animationGroup, profile.engineTargetPrefixes);
    this.canopyStartFrame = profile.canopyOpenRangeFrames.start;
    this.canopyEndFrame = profile.canopyOpenRangeFrames.end;
    this.canopyOpenDuration =
      (profile.canopyOpenRangeFrames.end - profile.canopyOpenRangeFrames.start) / profile.animationFps;
  }

  public beginArrivalSequence(): boolean {
    if (!this.canopyAnimationGroup) {
      return false;
    }

    this.prepareCanopyTimeline();
    this.completeArrivalOnStop = true;
    this.transitionActive = true;
    this.canopyProgress = 0;
    this.canopyTargetProgress = 1;
    this.applyCanopyFrame();
    return true;
  }

  public dispose(): void {
    this.canopyAnimationGroup?.dispose();
    this.stopEngineLoop();
    this.engineAnimationGroup?.dispose();
  }

  public setIdleState(): void {
    if (!this.canopyAnimationGroup) {
      return;
    }

    this.prepareCanopyTimeline();
    this.completeArrivalOnStop = false;
    this.transitionActive = false;
    this.canopyProgress = 0;
    this.canopyTargetProgress = 0;
    this.applyCanopyFrame();
  }

  public setCanopyOpen(open: boolean, options?: { animate?: boolean }): void {
    if (!this.canopyAnimationGroup) {
      return;
    }

    this.prepareCanopyTimeline();
    this.completeArrivalOnStop = false;
    this.canopyTargetProgress = open ? 1 : 0;

    if (options?.animate) {
      this.transitionActive = Math.abs(this.canopyTargetProgress - this.canopyProgress) > 0.0001;
      if (!this.transitionActive) {
        this.applyCanopyFrame();
      }
      return;
    }

    this.transitionActive = false;
    this.canopyProgress = this.canopyTargetProgress;
    this.applyCanopyFrame();
  }

  public startEngineLoop(): void {
    if (!this.engineAnimationGroup) {
      return;
    }

    this.engineAnimationGroup.stop(true);
    this.engineAnimationGroup.start(true, 1, this.engineAnimationGroup.from, this.engineAnimationGroup.to);
  }

  public stopEngineLoop(): void {
    if (!this.engineAnimationGroup) {
      return;
    }

    this.engineAnimationGroup.stop(true);
    this.engineAnimationGroup.start(false, 1, this.engineAnimationGroup.from, this.engineAnimationGroup.to);
    this.engineAnimationGroup.goToFrame(this.engineAnimationGroup.from);
    this.engineAnimationGroup.pause();
  }

  public update(dt: number): boolean {
    if (!this.transitionActive || !this.canopyAnimationGroup) {
      return false;
    }

    const direction = Math.sign(this.canopyTargetProgress - this.canopyProgress);
    if (direction === 0) {
      this.transitionActive = false;
      const completed = this.completeArrivalOnStop;
      this.completeArrivalOnStop = false;
      this.applyCanopyFrame();
      return completed;
    }

    const progressStep = dt / this.canopyOpenDuration;
    this.canopyProgress = clamp01(this.canopyProgress + progressStep * direction);
    if (
      (direction > 0 && this.canopyProgress < this.canopyTargetProgress) ||
      (direction < 0 && this.canopyProgress > this.canopyTargetProgress)
    ) {
      this.applyCanopyFrame();
      return false;
    }

    this.canopyProgress = this.canopyTargetProgress;
    this.transitionActive = false;
    this.applyCanopyFrame();
    const completed = this.completeArrivalOnStop;
    this.completeArrivalOnStop = false;
    return completed;
  }

  private applyCanopyFrame(): void {
    if (!this.canopyAnimationGroup) {
      return;
    }

    const frame = this.canopyStartFrame + (this.canopyEndFrame - this.canopyStartFrame) * this.canopyProgress;
    this.canopyAnimationGroup.goToFrame(frame);
    this.canopyAnimationGroup.pause();
  }

  private prepareCanopyTimeline(): void {
    if (!this.canopyAnimationGroup) {
      return;
    }

    this.canopyAnimationGroup.stop(true);
    this.canopyAnimationGroup.start(false, 1, this.canopyStartFrame, this.canopyEndFrame);
    this.canopyAnimationGroup.pause();
  }
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createFilteredAnimationGroup(
  sourceAnimationGroup: AnimationGroup,
  prefixes: string[],
): AnimationGroup | null {
  const animationGroup = sourceAnimationGroup.clone(`${sourceAnimationGroup.name}-filtered-${prefixes.join("-")}`);
  if (!animationGroup) {
    return null;
  }

  if (filterAnimationGroup(animationGroup, prefixes)) {
    return animationGroup;
  }

  animationGroup.dispose();
  return null;
}

function filterAnimationGroup(animationGroup: AnimationGroup, prefixes: string[]): boolean {
  const targetNames = animationGroup.targetedAnimations
    .map((targetedAnimation) => {
      const target = targetedAnimation.target as { name?: string } | null;
      return target?.name ?? "";
    })
    .filter((targetName) => prefixes.some((prefix) => targetName.startsWith(prefix)));

  if (targetNames.length === 0) {
    return false;
  }

  animationGroup.mask = new AnimationGroupMask(targetNames);
  animationGroup.removeUnmaskedAnimations();
  return true;
}
