import type { AnimationGroup } from "@babylonjs/core/Animations/animationGroup";
import {
  DockedShipAnimationStrategy,
  NullDockedShipAnimationStrategy,
  SplitDockedShipAnimationStrategy,
} from "./dockedShipAnimationStrategies";
import type { DockedShipAnimationProfile } from "./dockedShipProfiles";

export class DockedShipAnimationStrategyFactory {
  public static create(
    animationGroup: AnimationGroup | null,
    profile: DockedShipAnimationProfile | undefined,
  ): DockedShipAnimationStrategy {
    if (!animationGroup || !profile) {
      return new NullDockedShipAnimationStrategy();
    }

    return new SplitDockedShipAnimationStrategy(animationGroup, profile);
  }
}
