// Global shared types for PhaseGate CLI.
// No logic, types only.

export type PhaseId = 0 | 1 | 2 | 3 | 4 | 5;

/** Design-time status used for requirements and design.modules. */
export type ItemStatus = 'pending' | 'done' | 'blocked' | 'failed';
export type RequirementStatus = 'draft' | 'approved' | 'selected' | 'implemented' | 'archived';

/** Runtime status used for ProjectProgress.modules during Phase 3 orchestration. */
export type ModuleRunStatus = 'pending' | 'running' | 'done' | 'failed' | 'blocked';

export type ContractStatus = 'draft' | 'finalized';

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
    reviewPassed: boolean;
  };
  /** Runtime module list; status uses ModuleRunStatus, including 'running'. */
  modules: { name: string; status: ModuleRunStatus; blockedBy?: string }[];
  codeReviewPassed: boolean;
  blockers: string[];
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
  filesChanged: string[];
  issues: string[];
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
