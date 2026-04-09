// Global shared types for PhaseGate CLI.
// No logic, types only.

export type PhaseId = 0 | 1 | 2 | 3 | 4 | 5;

/**
 * Phases in the default auto-advance path (Phase 2 excluded).
 * Used by PhaseTransitionManager to determine next phase.
 */
export type ActivePhaseId = 1 | 3 | 4 | 5;

/** Ordered list of phases in the default auto-advance path. */
export const ACTIVE_PHASE_SEQUENCE: ReadonlyArray<ActivePhaseId> = [1, 3, 4, 5];

/** Design-time status used for requirements and design.modules. */
export type ItemStatus = 'pending' | 'done' | 'blocked' | 'failed';
export type RequirementStatus = 'draft' | 'approved' | 'selected' | 'implemented' | 'archived';

/** Runtime status used for ProjectProgress.modules during Phase 3 orchestration. */
export type ModuleRunStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';

export type ContractStatus = 'draft' | 'finalized';

// ---- VerdictRecord (structured review verdict) ----

export type VerdictLevel = 'accepted' | 'conditional_pass' | 'rejected';

export interface VerdictFinding {
  level: 'P0' | 'P1' | 'P2';
  description: string;
  relatedModule?: string;
  resolved: boolean;
}

export interface VerdictRecord {
  verdict: VerdictLevel;
  reviewedBy: 'phase4' | 'phase5' | 'manual';
  timestamp?: string;
  findings: VerdictFinding[];
  residualRisks: string[];
  confidenceLevel?: 'high' | 'medium' | 'low';
}

// ---- PhaseStateEntry (explicit state machine entry per phase) ----

export type PhaseExecutionState =
  | 'idle'
  | 'running'
  | 'awaiting_gate'
  | 'gate_passed'
  | 'gate_failed'
  | 'terminal'
  | 'migrated';

export interface PhaseStateEntry {
  phaseId: PhaseId;
  state: PhaseExecutionState;
  enteredAt: string;
  verdict?: VerdictRecord;
}

export interface ModuleEntry {
  name: string;
  status: ItemStatus;
  blockedBy?: string;
}

export interface ContractEntry {
  name: string;
  status: ContractStatus;
  provider: string;
  consumers: string[];
}

export interface RequirementEntry {
  name: string;
  file: string;
  status: RequirementStatus;
  priority?: 'high' | 'normal' | 'low';
  approvedAt?: string;
}

export interface ProjectProgress {
  projectName: string;
  locale?: string;
  currentPhase: PhaseId;
  activeRequirement: string | null;
  requirements: RequirementEntry[];
  design: {
    modules: ModuleEntry[];
    contracts: ContractEntry[];
    /** true = Phase 1 embedded design checks completed (v1.1+: not Phase 2 review passed) */
    reviewPassed: boolean;
  };
  /** Runtime module list; status uses ModuleRunStatus, including 'running'. */
  modules: { name: string; status: ModuleRunStatus; blockedBy?: string }[];
  codeReviewPassed: boolean;
  blockers: string[];
  /** Structured verdict from Phase 4 review gate (v1.1+). */
  phase4Verdict?: VerdictRecord;
  /** Explicit state machine entries per phase (v1.1+). */
  phaseStates?: PhaseStateEntry[];
}

/** Interface contract file frontmatter used by the orchestrator for context injection decisions. */
export interface ContractFrontmatter {
  name: string;
  description: string; // Must be semantically clear for orchestrator filtering.
  consumers: string[]; // Only inject this contract into workers that depend on it.
}

/** Standard output report written by each worker. */
export interface WorkerReport {
  scope: string; // "{ModuleName} - one-line responsibility"
  result: 'done' | 'failed';
  keyFiles: string[];
  filesChanged: string[];  // legacy field (= changedFiles alias)
  issues: string[];        // legacy field (= selfReviewFindings alias)

  // Phase 3 review bundle extension fields (optional, progressively required)
  implementationSummary?: string;
  changedFiles?: string[];
  testsRun?: string[];
  testSummary?: string;
  selfReviewFindings?: string[];
  knownRisks?: string[];
  publicSurfaceChanged?: boolean;
  recommendedReviewScope?: string[];
}

/** Emitted by spawnCliStreaming() for a tool_use content block. */
export interface ToolUseEvent {
  type: 'tool_use';
  name: string;
  /** Extracted display string: file_path for Write/Edit, truncated command for Bash; absent for others. */
  input?: string;
}

/** Emitted by spawnCliStreaming() when the result event is received. */
export interface ResultEvent {
  type: 'result';
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cost_usd?: number;
  };
}

export type RunnerStreamLevel = 'none' | 'text' | 'event';

export interface RunnerCapabilities {
  runStreaming: RunnerStreamLevel;
  forkStreaming: RunnerStreamLevel;
  interactiveChat: boolean;
  structuredWorkerReport: boolean;
}

export type RunEvent = ToolUseEvent | ResultEvent;
