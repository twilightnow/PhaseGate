import * as path from 'path';
import * as fse from 'fs-extra';
import type {
  ModuleRunStatus,
  PhaseId,
  PhaseStateEntry,
  ProjectProgress,
  RequirementEntry,
  RequirementStatus,
  VerdictRecord,
} from '../types';
import { renderProgressMarkdown } from './progress-report';

const PROGRESS_JSON = path.join('.phasegate', 'progress.json');

const REQUIREMENT_STATUSES: RequirementStatus[] = [
  'draft',
  'approved',
  'selected',
  'implemented',
  'archived',
];

function isRequirementStatus(value: unknown): value is RequirementStatus {
  return typeof value === 'string' && REQUIREMENT_STATUSES.includes(value as RequirementStatus);
}

function normalizeRequirementStatus(value: unknown): RequirementStatus {
  if (isRequirementStatus(value)) {
    return value;
  }

  if (value === 'done') {
    return 'approved';
  }

  return 'draft';
}

function normalizeRequirementEntry(entry: unknown): RequirementEntry | null {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const candidate = entry as Record<string, unknown>;
  const name = typeof candidate.name === 'string' ? candidate.name.trim() : '';
  if (!name) {
    return null;
  }

  const file =
    typeof candidate.file === 'string' && candidate.file.trim()
      ? candidate.file.trim()
      : `${name}.md`;

  return {
    name,
    file,
    status: normalizeRequirementStatus(candidate.status),
  };
}

function normalizeModuleStatus(value: unknown): ModuleRunStatus {
  switch (value) {
    case 'running':
    case 'done':
    case 'failed':
    case 'blocked':
      return value;
    default:
      return 'pending';
  }
}

/**
 * Migrates raw currentPhase value.
 * Phase 2 is folded into Phase 1 — old workspaces at Phase 2 are reset to Phase 1.
 */
function migrateCurrentPhase(raw: unknown): PhaseId {
  if (typeof raw !== 'number') return 0;
  if (raw === 2) {
    // Phase 2 is migrated; reset to Phase 1 so user can re-run Phase 1 → Phase 3
    return 1;
  }
  if (raw >= 0 && raw <= 5) return raw as PhaseId;
  return 0;
}

function parsePhaseStateEntry(raw: unknown): PhaseStateEntry | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.phaseId !== 'number' || typeof r.state !== 'string' || typeof r.enteredAt !== 'string') {
    return null;
  }
  return {
    phaseId: r.phaseId as PhaseId,
    state: r.state as PhaseStateEntry['state'],
    enteredAt: r.enteredAt,
    verdict: r.verdict as VerdictRecord | undefined,
  };
}

function normalizeProgress(raw: unknown, originalCurrentPhase?: number): ProjectProgress {
  const candidate = (raw ?? {}) as Record<string, unknown>;
  const requirements = Array.isArray(candidate.requirements)
    ? candidate.requirements
        .map(normalizeRequirementEntry)
        .filter((entry): entry is RequirementEntry => entry !== null)
    : [];

  const rawCurrentPhase = typeof candidate.currentPhase === 'number' ? candidate.currentPhase : -1;
  const migratedPhase = migrateCurrentPhase(candidate.currentPhase);

  // Parse phaseStates (defensive)
  const rawPhaseStates = Array.isArray(candidate.phaseStates)
    ? candidate.phaseStates
        .map(parsePhaseStateEntry)
        .filter((e): e is PhaseStateEntry => e !== null)
    : undefined;

  const progress: ProjectProgress = {
    projectName:
      typeof candidate.projectName === 'string' && candidate.projectName.trim()
        ? candidate.projectName.trim()
        : 'phasegate-project',
    locale: typeof candidate.locale === 'string' ? candidate.locale : undefined,
    currentPhase: migratedPhase,
    activeRequirement:
      typeof candidate.activeRequirement === 'string' && candidate.activeRequirement.trim()
        ? candidate.activeRequirement.trim()
        : null,
    requirements,
    design: {
      modules: Array.isArray((candidate.design as Record<string, unknown> | undefined)?.modules)
        ? (((candidate.design as Record<string, unknown>).modules as unknown[]) ?? []).flatMap((entry) => {
            if (!entry || typeof entry !== 'object') return [];
            const record = entry as Record<string, unknown>;
            const name = typeof record.name === 'string' ? record.name.trim() : '';
            if (!name) return [];
            const status =
              record.status === 'done' || record.status === 'blocked' || record.status === 'failed'
                ? record.status
                : 'pending';
            return [{ name, status, blockedBy: typeof record.blockedBy === 'string' ? record.blockedBy : undefined }];
          })
        : [],
      contracts: Array.isArray((candidate.design as Record<string, unknown> | undefined)?.contracts)
        ? (((candidate.design as Record<string, unknown>).contracts as unknown[]) ?? []).flatMap((entry) => {
            if (!entry || typeof entry !== 'object') return [];
            const record = entry as Record<string, unknown>;
            const name = typeof record.name === 'string' ? record.name.trim() : '';
            if (!name) return [];
            return [
              {
                name,
                status: record.status === 'finalized' ? 'finalized' : 'draft',
                provider: typeof record.provider === 'string' ? record.provider : 'unknown',
                consumers: Array.isArray(record.consumers)
                  ? record.consumers.filter((value): value is string => typeof value === 'string')
                  : [],
              },
            ];
          })
        : [],
      reviewPassed: Boolean((candidate.design as Record<string, unknown> | undefined)?.reviewPassed),
    },
    modules: Array.isArray(candidate.modules)
      ? candidate.modules.flatMap((entry) => {
          if (!entry || typeof entry !== 'object') return [];
          const record = entry as Record<string, unknown>;
          const name = typeof record.name === 'string' ? record.name.trim() : '';
          if (!name) return [];
          return [
            {
              name,
              status: normalizeModuleStatus(record.status),
              blockedBy: typeof record.blockedBy === 'string' ? record.blockedBy : undefined,
            },
          ];
        })
      : [],
    codeReviewPassed: Boolean(candidate.codeReviewPassed),
    blockers: Array.isArray(candidate.blockers)
      ? candidate.blockers.filter((value): value is string => typeof value === 'string')
      : [],
    phase4Verdict: candidate.phase4Verdict as VerdictRecord | undefined,
    phaseStates: rawPhaseStates,
  };

  // Migration: if old workspace had currentPhase: 2, add a migration record to phaseStates
  if (rawCurrentPhase === 2) {
    maybeRecordPhase2Migration(progress);
  }

  return progress;
}

function maybeRecordPhase2Migration(progress: ProjectProgress): void {
  const hasRecord = progress.phaseStates?.some(s => s.phaseId === 2);
  if (hasRecord) return;
  const states = progress.phaseStates ?? [];
  states.push({
    phaseId: 2,
    state: 'migrated',
    enteredAt: new Date().toISOString(),
  });
  progress.phaseStates = states;
}

function normalizeRequirementName(input: string): string {
  return path.basename(input.trim(), path.extname(input.trim())).toLowerCase();
}

function resetExecutionState(progress: ProjectProgress): void {
  progress.design = {
    modules: [],
    contracts: [],
    reviewPassed: false,
  };
  progress.modules = [];
  progress.codeReviewPassed = false;
  progress.blockers = [];
}

function reconcileActiveRequirement(progress: ProjectProgress): void {
  const activeNormalized = progress.activeRequirement
    ? normalizeRequirementName(progress.activeRequirement)
    : null;

  let activeFound = false;

  for (const requirement of progress.requirements) {
    const requirementNormalized = normalizeRequirementName(requirement.name);
    if (activeNormalized && requirementNormalized === activeNormalized) {
      requirement.status = 'selected';
      progress.activeRequirement = requirement.name;
      activeFound = true;
      continue;
    }

    if (requirement.status === 'selected') {
      requirement.status = requirement.status === 'selected' ? 'approved' : requirement.status;
    }
  }

  if (!activeFound) {
    progress.activeRequirement = null;
    progress.currentPhase = 0;
    resetExecutionState(progress);
  }
}

export interface IProgressManager {
  read(cwd: string): ProjectProgress;
  write(cwd: string, progress: ProjectProgress): void;
  updatePhase(cwd: string, phase: PhaseId): void;
  syncRequirementsFromWorkspace(cwd: string): ProjectProgress;
  approveRequirementDocs(cwd: string, requirementName?: string): ProjectProgress;
  activateRequirement(cwd: string, requirementName: string): ProjectProgress;
  completeActiveRequirement(cwd: string): ProjectProgress;
  markModuleDone(cwd: string, moduleName: string): void;
  markModuleFailed(cwd: string, moduleName: string, error: string): void;
  markModuleBlocked(cwd: string, moduleName: string, blockedBy: string): void;
  recordPhaseVerdict(cwd: string, phaseId: 4 | 5, verdict: VerdictRecord): void;
  getPhaseState(cwd: string, phaseId: PhaseId): PhaseStateEntry | undefined;
}

export class ProgressManager implements IProgressManager {
  read(cwd: string): ProjectProgress {
    const jsonPath = path.join(cwd, PROGRESS_JSON);
    if (!fse.existsSync(jsonPath)) {
      throw new Error(`progress.json not found in ${cwd}. Run 'phasegate init' first.`);
    }

    return normalizeProgress(fse.readJsonSync(jsonPath));
  }

  write(cwd: string, progress: ProjectProgress): void {
    fse.writeJsonSync(path.join(cwd, PROGRESS_JSON), progress, { spaces: 2 });
    fse.writeFileSync(
      path.join(cwd, '.phasegate', 'progress.md'),
      renderProgressMarkdown(cwd, progress),
      'utf-8'
    );
  }

  updatePhase(cwd: string, phase: PhaseId): void {
    const progress = this.read(cwd);
    progress.currentPhase = phase;
    this.write(cwd, progress);
  }

  syncRequirementsFromWorkspace(cwd: string): ProjectProgress {
    const progress = this.read(cwd);
    const requirementsDir = path.join(cwd, '.phasegate', 'requirements');
    const files = fse.existsSync(requirementsDir)
      ? fse
          .readdirSync(requirementsDir)
          .filter((name) => name.toLowerCase().endsWith('.md') && name.toLowerCase() !== 'requirements.md')
          .sort()
      : [];

    const existing = new Map(
      progress.requirements.map((entry) => [normalizeRequirementName(entry.name), entry] as const)
    );

    progress.requirements = files.map((file) => {
      const name = path.basename(file, '.md');
      const prior = existing.get(normalizeRequirementName(name));
      return {
        name,
        file,
        status: prior?.status ?? 'draft',
      };
    });

    if (
      progress.activeRequirement &&
      !progress.requirements.some(
        (entry) => normalizeRequirementName(entry.name) === normalizeRequirementName(progress.activeRequirement ?? '')
      )
    ) {
      progress.activeRequirement = null;
      progress.currentPhase = 0;
      resetExecutionState(progress);
    }

    reconcileActiveRequirement(progress);

    this.write(cwd, progress);
    return progress;
  }

  approveRequirementDocs(cwd: string, requirementName?: string): ProjectProgress {
    const progress = this.syncRequirementsFromWorkspace(cwd);
    const target = requirementName ? normalizeRequirementName(requirementName) : null;

    let matched = false;
    progress.requirements = progress.requirements.map((entry) => {
      if (target && normalizeRequirementName(entry.name) !== target) {
        return entry;
      }

      matched = true;
      if (entry.status === 'archived' || entry.status === 'implemented') {
        return entry;
      }

      if (entry.status === 'selected') {
        return entry;
      }

      return { ...entry, status: 'approved' };
    });

    if (target && !matched) {
      throw new Error(`Requirement '${requirementName}' not found in .phasegate/requirements/.`);
    }

    this.write(cwd, progress);
    return progress;
  }

  activateRequirement(cwd: string, requirementName: string): ProjectProgress {
    const progress = this.syncRequirementsFromWorkspace(cwd);
    const normalizedName = normalizeRequirementName(requirementName);
    const activeNormalized = progress.activeRequirement
      ? normalizeRequirementName(progress.activeRequirement)
      : null;

    if (
      activeNormalized &&
      activeNormalized !== normalizedName &&
      progress.currentPhase !== 0
    ) {
      throw new Error(
        `Requirement '${progress.activeRequirement}' is already active. Finish or finalize it before switching.`
      );
    }

    if (activeNormalized && activeNormalized === normalizedName && progress.currentPhase !== 0) {
      return progress;
    }

    const entry = progress.requirements.find(
      (candidate) => normalizeRequirementName(candidate.name) === normalizedName
    );

    if (!entry) {
      throw new Error(`Requirement '${requirementName}' not found in .phasegate/requirements/.`);
    }

    if (entry.status === 'draft') {
      throw new Error(
        `Requirement '${entry.name}' is still draft. Complete Phase 0 discussion and gate checks before selecting it.`
      );
    }

    for (const requirement of progress.requirements) {
      if (requirement.status === 'selected') {
        requirement.status = 'approved';
      }
    }

    entry.status = 'selected';
    progress.activeRequirement = entry.name;
    progress.currentPhase = 1;
    resetExecutionState(progress);
    this.write(cwd, progress);
    return progress;
  }

  completeActiveRequirement(cwd: string): ProjectProgress {
    const progress = this.read(cwd);
    const activeNormalized = progress.activeRequirement
      ? normalizeRequirementName(progress.activeRequirement)
      : null;

    if (activeNormalized) {
      for (const requirement of progress.requirements) {
        if (normalizeRequirementName(requirement.name) === activeNormalized) {
          requirement.status = 'implemented';
        } else if (requirement.status === 'selected') {
          requirement.status = 'approved';
        }
      }
    }

    progress.activeRequirement = null;
    progress.currentPhase = 0;
    resetExecutionState(progress);
    this.write(cwd, progress);
    return progress;
  }

  markModuleDone(cwd: string, moduleName: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'done';
    delete mod.blockedBy;
    this.write(cwd, progress);
  }

  markModuleFailed(cwd: string, moduleName: string, error: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'failed';
    delete mod.blockedBy;
    const blockerEntry = `[${moduleName}] ${error}`;
    if (!progress.blockers.includes(blockerEntry)) {
      progress.blockers.push(blockerEntry);
    }
    this.write(cwd, progress);
  }

  markModuleBlocked(cwd: string, moduleName: string, blockedBy: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'blocked';
    mod.blockedBy = blockedBy;
    this.write(cwd, progress);
  }

  /**
   * Writes a VerdictRecord to progress.json for the specified phase.
   * Also updates the phaseStates array.
   */
  recordPhaseVerdict(cwd: string, phaseId: 4 | 5, verdict: VerdictRecord): void {
    const progress = this.read(cwd);
    if (phaseId === 4) {
      progress.phase4Verdict = verdict;
    }
    const states = progress.phaseStates ?? [];
    const idx = states.findIndex(s => s.phaseId === phaseId);
    const entry: PhaseStateEntry = {
      phaseId,
      state: verdict.verdict === 'rejected' ? 'gate_failed' : 'gate_passed',
      enteredAt: new Date().toISOString(),
      verdict,
    };
    if (idx >= 0) states[idx] = entry;
    else states.push(entry);
    progress.phaseStates = states;
    this.write(cwd, progress);
  }

  /**
   * Returns the PhaseStateEntry for the given phase, or undefined if not found.
   */
  getPhaseState(cwd: string, phaseId: PhaseId): PhaseStateEntry | undefined {
    const progress = this.read(cwd);
    return progress.phaseStates?.find(s => s.phaseId === phaseId);
  }
}
