import type { ModuleRunResult } from './orchestrator';
import type { PhaseId } from '../types';

export type ExecutablePhaseId = Exclude<PhaseId, 0>;

export interface PhaseExecutionResult {
  phase: ExecutablePhaseId;
  phase3Results?: ModuleRunResult[];
  output?: string;
}

export type PhaseStopReason = 'gate_failed' | 'terminal';

export interface PhaseTransitionResult {
  phase: ExecutablePhaseId;
  nextPhase: ExecutablePhaseId | null;
  shouldContinue: boolean;
  stopReason: PhaseStopReason;
  message: string;
}
