import * as path from 'path';
import * as fse from 'fs-extra';
import type { ContractEntry, ProjectProgress } from '../types';
import { getRequiredSections } from './phase-gate';

export interface AcceptanceCriterionStatus {
  text: string;
  status: 'pending' | 'blocked' | 'recorded';
}

export interface GateSnapshot {
  phaseLabel: string;
  status: 'ready' | 'blocked' | 'idle';
  message: string;
}

const PHASE_NAMES: Record<number, string> = {
  0: 'Idle / No Active Execution',
  1: 'Design Generation',
  2: 'Design Review',
  3: 'Parallel Module Development',
  4: 'Code Review',
  5: 'Acceptance',
};

export function getPhaseName(phase: number): string {
  return PHASE_NAMES[phase] ?? 'unknown';
}

export function readAcceptanceCriteria(cwd: string, progress: ProjectProgress): string[] {
  const requirementPath = getActiveRequirementPath(cwd, progress);
  if (!requirementPath || !fse.existsSync(requirementPath)) {
    return [];
  }

  const acceptanceHeadings = Array.from(
    new Set([
      'Acceptance Criteria',
      getRequiredSections('en')[2],
      getRequiredSections('zh')[2],
      getRequiredSections('ja')[2],
    ])
  );

  const content = fse.readFileSync(requirementPath, 'utf-8');
  const section = acceptanceHeadings
    .map((heading) => extractMarkdownSection(content, heading))
    .find(Boolean);
  if (!section) {
    return [];
  }

  return section
    .split('\n')
    .map((line) => parseAcceptanceLine(line))
    .filter(Boolean);
}

export function buildAcceptanceChecklist(
  cwd: string,
  progress: ProjectProgress
): AcceptanceCriterionStatus[] {
  const criteria = readAcceptanceCriteria(cwd, progress);
  const hasModuleFailures = progress.modules.some(
    (entry) => entry.status === 'failed' || entry.status === 'blocked'
  );
  const recordedStatus: AcceptanceCriterionStatus['status'] =
    progress.currentPhase >= 5 ? 'recorded' : 'pending';

  return criteria.map((text) => ({
    text,
    status: hasModuleFailures ? 'blocked' : recordedStatus,
  }));
}

export function isMinimalDeliveryMode(progress: ProjectProgress): boolean {
  return progress.design.modules.length === 1 && progress.design.contracts.length === 0;
}

export function evaluateGateSnapshot(cwd: string, progress: ProjectProgress): GateSnapshot {
  if (!progress.activeRequirement) {
    return {
      phaseLabel: getPhaseName(progress.currentPhase),
      status: 'idle',
      message: 'No active requirement selected.',
    };
  }

  if (progress.currentPhase === 1) {
    return {
      phaseLabel: getPhaseName(1),
      status: 'blocked',
      message: 'Waiting for Phase 1 outputs: at least one task book is required.',
    };
  }

  if (progress.currentPhase === 2) {
    if (progress.design.contracts.length === 0 && isMinimalDeliveryMode(progress)) {
      return {
        phaseLabel: getPhaseName(2),
        status: 'ready',
        message: 'Minimal Delivery Mode: single-module design does not require contracts.',
      };
    }

    const draftContracts = progress.design.contracts.filter((entry) => entry.status !== 'finalized');
    if (draftContracts.length === 0 && progress.design.contracts.length > 0) {
      return {
        phaseLabel: getPhaseName(2),
        status: 'ready',
        message: 'All contracts finalized. Phase 2 gate is ready to pass.',
      };
    }

    return {
      phaseLabel: getPhaseName(2),
      status: 'blocked',
      message:
        draftContracts.length > 0
          ? `Waiting for finalized contracts: ${draftContracts.map((entry) => entry.name).join(', ')}.`
          : 'Waiting for Phase 1 outputs to define contracts or confirm Minimal Delivery Mode.',
    };
  }

  if (progress.currentPhase === 3) {
    const failed = progress.modules.filter((entry) => entry.status === 'failed');
    if (failed.length > 0) {
      return {
        phaseLabel: getPhaseName(3),
        status: 'blocked',
        message: `Module failures must be resolved: ${failed.map((entry) => entry.name).join(', ')}.`,
      };
    }

    const pending = progress.modules.filter(
      (entry) => entry.status === 'pending' || entry.status === 'running'
    );
    if (pending.length === 0) {
      return {
        phaseLabel: getPhaseName(3),
        status: 'ready',
        message: 'All runnable modules have finished. Phase 3 is ready to advance.',
      };
    }

    return {
      phaseLabel: getPhaseName(3),
      status: 'blocked',
      message: `Waiting on runtime modules: ${pending.map((entry) => entry.name).join(', ')}.`,
    };
  }

  if (progress.currentPhase === 4) {
    return {
      phaseLabel: getPhaseName(4),
      status: progress.codeReviewPassed ? 'ready' : 'blocked',
      message: progress.codeReviewPassed
        ? 'Phase 4 PASS verdict recorded.'
        : 'Waiting for a persisted PASS verdict in phase-4-summary.md.',
    };
  }

  if (progress.currentPhase === 5) {
    const criteria = readAcceptanceCriteria(cwd, progress);
    return {
      phaseLabel: getPhaseName(5),
      status: criteria.length > 0 ? 'ready' : 'blocked',
      message:
        criteria.length > 0
          ? `Acceptance criteria recorded: ${criteria.length}.`
          : 'Acceptance criteria recorded: 0. Requirement cannot be finalized.',
    };
  }

  return {
    phaseLabel: getPhaseName(progress.currentPhase),
    status: 'idle',
    message: 'No active gate.',
  };
}

export function renderProgressMarkdown(cwd: string, progress: ProjectProgress): string {
  const gate = evaluateGateSnapshot(cwd, progress);
  const checklist = buildAcceptanceChecklist(cwd, progress);
  const minimalDelivery = isMinimalDeliveryMode(progress) ? 'enabled' : 'disabled';

  const lines = [
    '# Progress',
    '',
    `- Project: ${progress.projectName}`,
    `- Active requirement: ${progress.activeRequirement ?? '(none)'}`,
    `- Execution phase: Phase ${progress.currentPhase} - ${getPhaseName(progress.currentPhase)}`,
    `- Gate: ${gate.status.toUpperCase()} - ${gate.message}`,
    `- Minimal Delivery Mode: ${minimalDelivery}`,
    '',
    '## Requirements',
  ];

  if (progress.requirements.length === 0) {
    lines.push('- none');
  } else {
    for (const requirement of progress.requirements) {
      lines.push(`- ${requirement.name}: ${requirement.status}`);
    }
  }

  lines.push('', '## Runtime Summary');
  if (progress.modules.length === 0) {
    lines.push('- No runtime modules recorded.');
  } else {
    for (const moduleEntry of progress.modules) {
      const reason =
        moduleEntry.status === 'blocked' && moduleEntry.blockedBy
          ? ` (blocked by ${moduleEntry.blockedBy})`
          : '';
      lines.push(`- ${moduleEntry.name}: ${moduleEntry.status}${reason}`);
    }
  }

  if (progress.design.modules.length > 0 || progress.design.contracts.length > 0) {
    lines.push('', '## Design Summary');
    if (progress.design.modules.length > 0) {
      lines.push(
        `- Modules: ${progress.design.modules.map((entry) => entry.name).join(', ')}`
      );
    } else {
      lines.push('- Modules: none');
    }
    lines.push(`- Contracts: ${formatContractSummary(progress.design.contracts)}`);
    lines.push(`- Design review passed: ${progress.design.reviewPassed ? 'yes' : 'no'}`);
  }

  lines.push('', '## Acceptance Checklist');
  lines.push(`- Acceptance criteria recorded: ${checklist.length}`);
  if (checklist.length === 0) {
    lines.push('- ERROR: no acceptance criteria were parsed from the active requirement.');
  } else {
    for (const criterion of checklist) {
      lines.push(`- ${criterion.status}: ${criterion.text}`);
    }
  }

  if (progress.blockers.length > 0) {
    lines.push('', '## Blockers');
    for (const blocker of progress.blockers) {
      lines.push(`- ${blocker}`);
    }
  }

  lines.push('');
  return lines.join('\n');
}

function getActiveRequirementPath(cwd: string, progress: ProjectProgress): string | null {
  if (!progress.activeRequirement) {
    return null;
  }

  const requirement = progress.requirements.find((entry) => entry.name === progress.activeRequirement);
  const fileName = requirement?.file ?? `${progress.activeRequirement}.md`;
  return path.join(cwd, '.phasegate', 'requirements', fileName);
}

function extractMarkdownSection(content: string, heading: string): string {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function parseAcceptanceLine(line: string): string {
  const trimmed = line.trim();
  if (!trimmed) {
    return '';
  }

  const checkboxMatch = trimmed.match(/^- \[[ xX]\]\s+(.+)$/);
  if (checkboxMatch) {
    return checkboxMatch[1].trim();
  }

  const bulletMatch = trimmed.match(/^[-*+]\s+(.+)$/);
  if (bulletMatch) {
    return bulletMatch[1].trim();
  }

  const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
  if (orderedMatch) {
    return orderedMatch[1].trim();
  }

  return '';
}

function formatContractSummary(contracts: ContractEntry[]): string {
  if (contracts.length === 0) {
    return 'none';
  }

  return contracts.map((entry) => `${entry.name}:${entry.status}`).join(', ');
}
