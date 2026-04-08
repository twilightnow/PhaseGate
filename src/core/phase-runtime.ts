import type { ModuleRunResult } from './orchestrator';
import type { PhaseId, VerdictRecord } from '../types';

/**
 * Phases that can be actively executed in the run loop.
 * Phase 2 is retained as a type value but treated as no-op / migrated in runtime.
 */
export type ExecutablePhaseId = 1 | 2 | 3 | 4 | 5;

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
  verdict?: VerdictRecord;
}
