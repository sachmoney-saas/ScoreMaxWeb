import { CrownDownStrategy } from "./CrownDownStrategy";
import { EyeCloseupStrategy } from "./EyeCloseupStrategy";
import { FrontalStrategy } from "./FrontalStrategy";
import { HairlineStrategy } from "./HairlineStrategy";
import { JawUpStrategy } from "./JawUpStrategy";
import { ProfileLeftStrategy } from "./ProfileLeftStrategy";
import { ProfileRightStrategy } from "./ProfileRightStrategy";
import type { PoseStrategy } from "./PoseStrategy";
import { SmileStrategy } from "./SmileStrategy";

export * from "./PoseStrategy";

export const POSE_STRATEGIES: PoseStrategy[] = [
  new FrontalStrategy(),
  new ProfileRightStrategy(),
  new ProfileLeftStrategy(),
  new JawUpStrategy(),
  new CrownDownStrategy(),
  new SmileStrategy(),
  new EyeCloseupStrategy(),
  new HairlineStrategy(),
];
