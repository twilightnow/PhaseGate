import * as path from 'path';
import * as fse from 'fs-extra';
import type { WorkerReport, ModuleRunStatus } from '../types';
import { ProgressManager } from './progress-manager';
import { DependencyGraph, type ModuleNode } from './dependency-graph';
import { ClaudeRunner } from './ai-runner';

export interface ModuleRunResult {
  moduleName: string;
  status: ModuleRunStatus;
  durationMs: number;
  report?: WorkerReport;
  error?: string;
}

export interface IOrchestrator {
  /**
   * Full Phase 3 execution with breakpoint resume.
   * Reads progress.json, skips done modules, forks workers wave by wave.
   */
  run(projectRoot: string): Promise<ModuleRunResult[]>;
  /**
   * Phase 5A self-correction loop: re-fork a failed module.
   * Injects failure context into the prompt. Retries up to MAX_RETRIES times.
   */
  retry(
    projectRoot: string,
    moduleName: string,
    failureContext: string
  ): Promise<ModuleRunResult>;
}

const MAX_RETRIES = 3;
const SCRATCHPAD_BASE = '.phasegate/scratchpad';
const ARCH_CONSTRAINTS_REL = path.join('docs', '03_architecture_constraints.md');

export class Orchestrator implements IOrchestrator {
  private pm = new ProgressManager();
  private dg = new DependencyGraph();
  private runner = new ClaudeRunner();

  async run(projectRoot: string): Promise<ModuleRunResult[]> {
    const progress = this.pm.read(projectRoot);

    // Build full DAG
    const allNodes = await this.dg.build(projectRoot);

    // Register any DAG module not yet in progress.modules (defensive)
    let dirty = false;
    for (const node of allNodes) {
      if (!progress.modules.find((m) => m.name === node.name)) {
        progress.modules.push({ name: node.name, status: 'pending' });
        dirty = true;
      }
    }
    if (dirty) this.pm.write(projectRoot, progress);

    // Breakpoint resume: skip already-done modules
    const doneModules = new Set(
      progress.modules.filter((m) => m.status === 'done').map((m) => m.name)
    );
    const pendingNodes = allNodes.filter((n) => !doneModules.has(n.name));

    const waves = this.dg.getExecutionWaves(pendingNodes);
    const allResults: ModuleRunResult[] = [];
    const failedModules = new Set<string>();

    for (const wave of waves) {
      // Fork all modules in this wave concurrently (Don't peek / Don't race)
      const waveResults = await Promise.all(
        wave.map((node) => this._runModule(projectRoot, node, failedModules))
      );

      for (const result of waveResults) {
        allResults.push(result);
        if (result.status === 'done') {
          this.pm.markModuleDone(projectRoot, result.moduleName);
        } else if (result.status === 'failed') {
          failedModules.add(result.moduleName);
          this.pm.markModuleFailed(
            projectRoot,
            result.moduleName,
            result.error ?? 'unknown error'
          );
        }
        // blocked status is recorded inside _runModule
      }
    }

    return allResults;
  }

  async retry(
    projectRoot: string,
    moduleName: string,
    failureContext: string
  ): Promise<ModuleRunResult> {
    const allNodes = await this.dg.build(projectRoot);
    const node = allNodes.find((n) => n.name === moduleName);

    if (!node) {
      return {
        moduleName,
        status: 'failed',
        durationMs: 0,
        error: `Module '${moduleName}' not found in DAG`,
      };
    }

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const prompt = buildRetryPrompt(moduleName, node, failureContext, attempt);
      const failedModules = new Set<string>();
      const result = await this._runModule(projectRoot, node, failedModules, prompt);

      if (result.status === 'done') {
        this.pm.markModuleDone(projectRoot, moduleName);
        return result;
      }
    }

    const finalError = `max retries (${MAX_RETRIES}) exceeded`;
    this.pm.markModuleFailed(projectRoot, moduleName, finalError);
    return { moduleName, status: 'failed', durationMs: 0, error: finalError };
  }

  // ── private ────────────────────────────────────────────────────────────────

  private async _runModule(
    projectRoot: string,
    node: ModuleNode,
    failedModules: Set<string>,
    overridePrompt?: string
  ): Promise<ModuleRunResult> {
    // Block if any dependency failed
    const blockedBy = node.dependencies.find((dep) => failedModules.has(dep));
    if (blockedBy) {
      this.pm.markModuleBlocked(projectRoot, node.name, blockedBy);
      return {
        moduleName: node.name,
        status: 'blocked',
        durationMs: 0,
        error: `blocked by ${blockedBy}`,
      };
    }

    const scratchpadPath = path.join(projectRoot, SCRATCHPAD_BASE, node.name);
    await fse.ensureDir(scratchpadPath);

    const archConstraints = path.join(projectRoot, ARCH_CONSTRAINTS_REL);
    const contextFiles = [
      node.designFile,
      ...node.contractFiles,
      ...(await fse.pathExists(archConstraints) ? [archConstraints] : []),
    ];

    const prompt = overridePrompt ?? buildWorkerPrompt(node, scratchpadPath);
    const startMs = Date.now();

    try {
      const report = await this.runner.fork(contextFiles, prompt);
      const durationMs = Date.now() - startMs;

      // Persist report to scratchpad (don't peek was satisfied — process done)
      await fse.writeFile(
        path.join(scratchpadPath, 'report.json'),
        JSON.stringify(report, null, 2),
        'utf-8'
      );

      return {
        moduleName: node.name,
        status: report.result === 'done' ? 'done' : 'failed',
        durationMs,
        report,
        error: report.result === 'failed' ? report.issues.join('; ') : undefined,
      };
    } catch (err) {
      return {
        moduleName: node.name,
        status: 'failed',
        durationMs: Date.now() - startMs,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}

// ── prompt builders ───────────────────────────────────────────────────────────

function buildWorkerPrompt(node: ModuleNode, scratchpadPath: string): string {
  const contractList =
    node.contractFiles.length > 0
      ? `Contracts:\n${node.contractFiles.map((c) => `  - ${c}`).join('\n')}\n`
      : '';

  return [
    `Implement module: ${node.name}`,
    `Design file: ${node.designFile}`,
    contractList,
    `When complete, output a WorkerReport in this exact markdown format:`,
    ``,
    `## Scope`,
    `{module name} — {one-line responsibility}`,
    ``,
    `## Result`,
    `done`,
    ``,
    `## Key Files`,
    `- {path to each key file}`,
    ``,
    `## Files Changed`,
    `- {all files changed}`,
    ``,
    `## Issues`,
    `(none)`,
    ``,
    `Scratchpad directory (for intermediate files only): ${scratchpadPath}`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

function buildRetryPrompt(
  moduleName: string,
  node: ModuleNode,
  failureContext: string,
  attempt: number
): string {
  return [
    `Retry attempt ${attempt}/${MAX_RETRIES} for module: ${moduleName}`,
    ``,
    `Previous failure context:`,
    failureContext,
    ``,
    `Design file: ${node.designFile}`,
    node.contractFiles.length > 0
      ? `Contracts:\n${node.contractFiles.map((c) => `  - ${c}`).join('\n')}`
      : '',
    ``,
    `Fix the reported issues and output a WorkerReport when done (same format as before).`,
  ]
    .filter(Boolean)
    .join('\n');
}
