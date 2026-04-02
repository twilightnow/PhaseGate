import * as path from 'path';
import * as fse from 'fs-extra';
import type { PhaseId, ProjectProgress } from '../types';

const PROGRESS_JSON = path.join('.phasegate', 'progress.json');
const PROGRESS_MD = path.join('.phasegate', 'progress.md');

const STATUS_SECTION_START = '<!-- ==================== Status Section ==================== -->';
const SUMMARY_SECTION_START = '<!-- ==================== Phase Summary ==================== -->';
const SUMMARY_SECTION_NOTE =
  '<!-- Append phase summaries below. Existing summaries should not be edited. -->';

const PHASE_NAMES: Record<PhaseId, string> = {
  0: 'Requirements Discussion',
  1: 'Design Generation',
  2: 'Design Review',
  3: 'Parallel Module Development',
  4: 'Code Review',
  5: 'Acceptance',
};

export interface IProgressManager {
  read(cwd: string): ProjectProgress;
  write(cwd: string, progress: ProjectProgress): void;
  updatePhase(cwd: string, phase: PhaseId): void;
  markModuleDone(cwd: string, moduleName: string): void;
  markModuleFailed(cwd: string, moduleName: string, error: string): void;
  markModuleBlocked(cwd: string, moduleName: string, blockedBy: string): void;
  appendPhaseSummary(cwd: string, phase: PhaseId, summary: string): void;
}

export class ProgressManager implements IProgressManager {
  read(cwd: string): ProjectProgress {
    const jsonPath = path.join(cwd, PROGRESS_JSON);
    if (!fse.existsSync(jsonPath)) {
      throw new Error(
        `progress.json not found in ${cwd}. Run 'phasegate init' first.`
      );
    }
    return fse.readJsonSync(jsonPath) as ProjectProgress;
  }

  write(cwd: string, progress: ProjectProgress): void {
    fse.writeJsonSync(path.join(cwd, PROGRESS_JSON), progress, { spaces: 2 });
    this._syncMdStatus(cwd, progress);
  }

  updatePhase(cwd: string, phase: PhaseId): void {
    const progress = this.read(cwd);
    progress.currentPhase = phase;
    this.write(cwd, progress);
  }

  markModuleDone(cwd: string, moduleName: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'done';
    this.write(cwd, progress);
  }

  markModuleFailed(cwd: string, moduleName: string, error: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'failed';
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

  appendPhaseSummary(cwd: string, phase: PhaseId, summary: string): void {
    const mdPath = path.join(cwd, PROGRESS_MD);
    if (!fse.existsSync(mdPath)) {
      throw new Error(`progress.md not found in ${cwd}`);
    }
    const existing = fse.readFileSync(mdPath, 'utf-8');
    const block = `\n## Phase ${phase} Summary\n\n${summary}\n`;
    fse.writeFileSync(mdPath, existing + block, 'utf-8');
  }

  private _syncMdStatus(cwd: string, progress: ProjectProgress): void {
    const mdPath = path.join(cwd, PROGRESS_MD);
    const existing = fse.existsSync(mdPath)
      ? fse.readFileSync(mdPath, 'utf-8')
      : '';

    const summaryIdx = existing.indexOf(SUMMARY_SECTION_START);
    const summaryTail =
      summaryIdx >= 0
        ? '\n' + existing.slice(summaryIdx)
        : `\n${SUMMARY_SECTION_START}\n${SUMMARY_SECTION_NOTE}\n`;

    const statusBody = this._buildStatusSection(progress);
    const newContent = STATUS_SECTION_START + '\n\n' + statusBody + summaryTail;

    fse.writeFileSync(mdPath, newContent, 'utf-8');
  }

  private _buildStatusSection(progress: ProjectProgress): string {
    const lines: string[] = [];
    const phaseName = PHASE_NAMES[progress.currentPhase];
    const today = new Date().toISOString().split('T')[0];

    lines.push(`# ${progress.projectName} Project Progress`);
    lines.push('');
    lines.push('> This file is maintained by PhaseGate. Do not manually edit the status section.');
    lines.push('');
    lines.push(`Last updated: ${today}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Current Phase');
    lines.push('');
    lines.push(`Phase ${progress.currentPhase}: ${phaseName}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Requirements');
    lines.push('');
    if (progress.requirements.length === 0) {
      lines.push('(not started)');
    } else {
      for (const req of progress.requirements) {
        const tick = req.status === 'done' ? 'x' : ' ';
        lines.push(`- [${tick}] ${req.name}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Design');
    lines.push('');
    if (progress.design.modules.length === 0) {
      lines.push('(filled after Phase 1)');
      lines.push('');
    } else {
      lines.push('### Modules');
      lines.push('');
      for (const mod of progress.design.modules) {
        const tick = mod.status === 'done' ? 'x' : ' ';
        lines.push(`- [${tick}] ${mod.name}`);
      }
      lines.push('');
    }
    if (progress.design.contracts.length > 0) {
      lines.push('### Contracts');
      lines.push('');
      lines.push('| Contract | Status | Provider | Consumers |');
      lines.push('|---|---|---|---|');
      for (const c of progress.design.contracts) {
        lines.push(
          `| ${c.name} | ${c.status} | ${c.provider} | ${c.consumers.join(', ')} |`
        );
      }
      lines.push('');
    }
    const reviewTick = progress.design.reviewPassed ? 'x' : ' ';
    lines.push(`- [${reviewTick}] Design review passed`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Module Development');
    lines.push('');
    if (progress.modules.length === 0) {
      lines.push('(filled after Phase 1)');
    } else {
      for (const mod of progress.modules) {
        const tick = mod.status === 'done' ? 'x' : ' ';
        const statusNote =
          mod.status !== 'pending' && mod.status !== 'done'
            ? ` - ${mod.status}`
            : '';
        const blockedNote = mod.blockedBy
          ? ` (blocked by ${mod.blockedBy})`
          : '';
        lines.push(`- [${tick}] ${mod.name}${statusNote}${blockedNote}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Code Review');
    lines.push('');
    const codeReviewTick = progress.codeReviewPassed ? 'x' : ' ';
    lines.push(`- [${codeReviewTick}] Code review passed`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push('## Blockers');
    lines.push('');
    if (progress.blockers.length === 0) {
      lines.push('None');
    } else {
      for (const b of progress.blockers) {
        lines.push(`- ${b}`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }
}
