// Global shared types for PhaseGate CLI.
// No logic — types only.

export type PhaseId = 0 | 1 | 2 | 3 | 4 | 5;

/** Design-time status: used for requirements and design.modules */
export type ItemStatus = 'pending' | 'done' | 'blocked' | 'failed';

/** Runtime status: used for ProjectProgress.modules during Phase 3 orchestration */
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

export interface ProjectProgress {
  projectName: string;
  currentPhase: PhaseId;
  requirements: { name: string; status: ItemStatus }[];
  design: {
    modules: ModuleEntry[];
    contracts: ContractEntry[];
    reviewPassed: boolean;
  };
  /** Runtime module list — status uses ModuleRunStatus (includes 'running') */
  modules: { name: string; status: ModuleRunStatus; blockedBy?: string }[];
  codeReviewPassed: boolean;
  blockers: string[];
}

/** Interface contract file frontmatter — used by orchestrator for context injection decisions */
export interface ContractFrontmatter {
  name: string;
  description: string; // Must be semantically clear for orchestrator filtering
  consumers: string[]; // Only inject this contract into workers that depend on it
}

/** Standard output report written by each Fork Worker Agent */
export interface WorkerReport {
  scope: string;       // "{ModuleName} — one-line responsibility"
  result: 'done' | 'failed';
  keyFiles: string[];
  filesChanged: string[];
  issues: string[];
}
