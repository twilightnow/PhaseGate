import * as path from 'path';
import * as fse from 'fs-extra';
import { ProgressManager } from './progress-manager';
import { PhaseArtifactBuilder } from './phase-artifact-builder';
import type { ContractEntry } from '../types';
import type {
  PhaseExecutionResult,
  PhaseTransitionResult,
} from './phase-runtime';

export interface IPhaseTransitionManager {
  resolve(cwd: string, result: PhaseExecutionResult): Promise<PhaseTransitionResult>;
}

export class PhaseTransitionManager implements IPhaseTransitionManager {
  constructor(
    private readonly pm: ProgressManager = new ProgressManager(),
    private readonly artifacts: PhaseArtifactBuilder = new PhaseArtifactBuilder()
  ) {}

  async resolve(cwd: string, result: PhaseExecutionResult): Promise<PhaseTransitionResult> {
    switch (result.phase) {
      case 1:
        return this.resolvePhase1(cwd);
      case 2:
        return this.resolvePhase2(cwd);
      case 3:
        return this.resolvePhase3(cwd, result);
      case 4:
        return this.resolvePhase4WithResult(cwd, result.output);
      case 5:
        return this.resolvePhase5(cwd);
    }
  }

  private async resolvePhase1(cwd: string): Promise<PhaseTransitionResult> {
    await this.syncPhase1Outputs(cwd);
    return {
      phase: 1,
      nextPhase: 2,
      shouldContinue: true,
      stopReason: 'terminal',
      message: 'OK Phase advanced to 2 (Design Review).',
    };
  }

  private async resolvePhase2(cwd: string): Promise<PhaseTransitionResult> {
    const passed = await this.checkPhase2Gate(cwd);
    const progress = this.pm.read(cwd);
    progress.design.reviewPassed = passed;
    if (passed) {
      progress.currentPhase = 3;
    }
    this.pm.write(cwd, progress);

    if (passed) {
      return {
        phase: 2,
        nextPhase: 3,
        shouldContinue: true,
        stopReason: 'terminal',
        message: 'OK Phase advanced to 3 (Parallel Module Development).',
      };
    }

    return {
      phase: 2,
      nextPhase: null,
      shouldContinue: false,
      stopReason: 'gate_failed',
      message:
        '! Phase 2 gate not yet passed: not all contracts are finalized. Re-run when the review session is complete.',
    };
  }

  private async resolvePhase3(
    cwd: string,
    result: PhaseExecutionResult
  ): Promise<PhaseTransitionResult> {
    const phase3Results = result.phase3Results ?? [];
    const allDone = phase3Results.every(
      (entry) => entry.status === 'done' || entry.status === 'blocked'
    );
    const anyFailed = phase3Results.some((entry) => entry.status === 'failed');

    if (!anyFailed && allDone) {
      const progress = this.pm.read(cwd);
      this.artifacts.appendPhase3Summary(cwd, progress);
      progress.currentPhase = 4;
      this.pm.write(cwd, progress);

      return {
        phase: 3,
        nextPhase: 4,
        shouldContinue: true,
        stopReason: 'terminal',
        message: 'OK Phase 3 complete. Advancing to Phase 4 (code review).',
      };
    }

    return {
      phase: 3,
      nextPhase: null,
      shouldContinue: false,
      stopReason: 'gate_failed',
      message: '! Some modules failed. Fix blockers and re-run to resume.',
    };
  }

  private async resolvePhase4WithResult(
    cwd: string,
    output: string | undefined
  ): Promise<PhaseTransitionResult> {
    const verdict = getPhase4Verdict(output);
    if (output) {
      this.artifacts.writePhase4ReviewOutput(cwd, output);
    }

    const progress = this.pm.read(cwd);
    if (verdict === 'pass') {
      this.artifacts.appendPhase4Summary(cwd, progress);
    }

    const passed = verdict === 'pass' && (await this.checkPhase4Gate(cwd));
    progress.codeReviewPassed = passed;
    if (passed) {
      progress.currentPhase = 5;
    }
    this.pm.write(cwd, progress);

    if (passed) {
      return {
        phase: 4,
        nextPhase: 5,
        shouldContinue: true,
        stopReason: 'terminal',
        message: 'OK Phase advanced to 5 (Acceptance).',
      };
    }

    return {
      phase: 4,
      nextPhase: null,
      shouldContinue: false,
      stopReason: 'gate_failed',
      message:
        '! Phase 4 gate not yet passed: review output did not produce a PASS verdict with a persisted phase-4-summary.md.',
    };
  }

  private async resolvePhase5(cwd: string): Promise<PhaseTransitionResult> {
    const progress = this.pm.read(cwd);
    const criteria = this.artifacts.getAcceptanceCriteria(cwd, progress);
    if (criteria.length === 0) {
      this.artifacts.appendPhase5Summary(cwd, progress, 'blocked');
      return {
        phase: 5,
        nextPhase: null,
        shouldContinue: false,
        stopReason: 'gate_failed',
        message:
          '! Phase 5 gate failed: acceptance criteria recorded: 0. Add explicit criteria to the active requirement before finalizing.',
      };
    }

    this.artifacts.ensureAcceptanceGuide(cwd, progress);
    this.artifacts.appendPhase5Summary(cwd, progress);
    this.artifacts.finalizeExecutionArtifacts(cwd, progress);
    this.pm.completeActiveRequirement(cwd);

    return {
      phase: 5,
      nextPhase: null,
      shouldContinue: false,
      stopReason: 'terminal',
      message: 'OK Phase 5 complete. Active execution finalized and archived.',
    };
  }

  private async syncPhase1Outputs(cwd: string): Promise<void> {
    const tasksDir = path.join(cwd, '.phasegate', 'tasks');
    const contractsDir = path.join(cwd, '.phasegate', 'contracts');

    const taskFiles = await listMarkdownFiles(tasksDir);
    const contractFiles = await listMarkdownFiles(contractsDir);

    if (taskFiles.length === 0) {
      throw new Error(
        'No module design files found in .phasegate/tasks/. Ensure the AI generated at least one task file before advancing.'
      );
    }
    if (contractFiles.length === 0 && taskFiles.length > 1) {
      throw new Error(
        'No contract files found in .phasegate/contracts/. Multi-module designs must declare at least one contract before advancing.'
      );
    }

    const progress = this.pm.read(cwd);
    const moduleNames = taskFiles.map((file) => path.basename(file, '.md'));

    progress.design.modules = moduleNames.map((name) => ({ name, status: 'done' }));
    progress.modules = moduleNames.map((name) => ({
      name,
      status: 'pending',
    }));
    progress.design.contracts = await Promise.all(
      contractFiles.map((file) => readContractEntry(file))
    );
    progress.design.reviewPassed = false;
    progress.codeReviewPassed = false;
    progress.blockers = [];
    progress.currentPhase = 2;

    this.pm.write(cwd, progress);
  }

  private async checkPhase2Gate(cwd: string): Promise<boolean> {
    const contractsDir = path.join(cwd, '.phasegate', 'contracts');
    const files = await listMarkdownFiles(contractsDir);
    const progress = this.pm.read(cwd);
    if (files.length === 0) {
      return progress.design.modules.length === 1;
    }

    for (const file of files) {
      const content = await fse.readFile(file, 'utf-8');
      if (parseContractStatus(content) !== 'finalized') {
        return false;
      }
    }

    return true;
  }

  private async checkPhase4Gate(cwd: string): Promise<boolean> {
    const mdPath = path.join(cwd, '.phasegate', 'scratchpad', 'summaries', 'phase-4-summary.md');
    if (!(await fse.pathExists(mdPath))) {
      return false;
    }

    const content = await fse.readFile(mdPath, 'utf-8');
    return content.includes('# Phase 4 Summary');
  }
}

function getPhase4Verdict(output: string | undefined): 'pass' | 'fail' | 'unknown' {
  const normalized = output?.trim().toUpperCase() ?? '';
  if (!normalized) {
    return 'unknown';
  }

  if (/\bPASS\b/.test(normalized)) {
    return 'pass';
  }

  if (/\bFAIL\b/.test(normalized)) {
    return 'fail';
  }

  return 'unknown';
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  if (!(await fse.pathExists(dir))) {
    return [];
  }

  return (await fse.readdir(dir))
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(dir, file));
}

async function readContractEntry(filePath: string): Promise<ContractEntry> {
  const content = await fse.readFile(filePath, 'utf-8');
  const frontmatter = parseFrontmatter(content);

  return {
    name: frontmatter.name || path.basename(filePath, '.md'),
    status: parseContractStatus(content),
    provider: frontmatter.provider || frontmatter.providers[0] || 'unknown',
    consumers: frontmatter.consumers,
  };
}

function parseFrontmatter(content: string): {
  name: string;
  provider: string;
  providers: string[];
  consumers: string[];
} {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) {
    return { name: '', provider: '', providers: [], consumers: [] };
  }

  const yaml = match[1];
  return {
    name: extractYamlScalar(yaml, 'name'),
    provider:
      extractYamlList(yaml, 'provider')[0] || extractYamlScalar(yaml, 'provider'),
    providers: extractYamlList(yaml, 'providers'),
    consumers: extractYamlList(yaml, 'consumers'),
  };
}

function parseContractStatus(content: string): ContractEntry['status'] {
  const frontmatterMatch = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const frontmatter = frontmatterMatch?.[1] ?? '';
  const frontmatterStatus = extractYamlScalar(frontmatter, 'status').toLowerCase();

  const statusSectionMatch = content.match(/##\s+Status\s*\n([^\n]+)/i);
  const statusSectionValue = statusSectionMatch?.[1]?.trim().toLowerCase() ?? '';

  const normalized = statusSectionValue || frontmatterStatus;
  return ['finalized', 'active', 'stable', 'defined'].includes(normalized) ? 'finalized' : 'draft';
}

function extractYamlScalar(yaml: string, key: string): string {
  const regex = new RegExp(`^${key}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, 'm');
  const match = yaml.match(regex);
  return match ? match[1].trim() : '';
}

function extractYamlList(yaml: string, key: string): string[] {
  const lines = yaml.split('\n');
  const startIdx = lines.findIndex((line) => new RegExp(`^${key}:\\s*$`).test(line));
  if (startIdx < 0) {
    return [];
  }

  const items: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const itemMatch = lines[i].match(/^\s+-\s+(.+)$/);
    if (itemMatch) {
      items.push(itemMatch[1].trim());
      continue;
    }

    if (lines[i].trim() && !lines[i].startsWith(' ')) {
      break;
    }
  }

  return items;
}
