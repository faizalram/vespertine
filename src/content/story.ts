import type { Task } from '../core/scheduler';
import type { Game } from '../game/game';
import { stage1 } from './stage1';
import { stage2 } from './stage2';
import { stage3 } from './stage3';

/** Story Mode, Act One: the stages run back to back, pausing for results and Vigil interludes between them. */
export const STAGES = [stage1, stage2, stage3] as const;
export const FINAL_STAGE = STAGES.length;

export function* storyScript(g: Game): Task {
  for (let n = Math.max(1, g.startStage); n <= FINAL_STAGE; n++) {
    yield* STAGES[n - 1](g);
  }
}
