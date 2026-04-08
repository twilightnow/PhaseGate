import * as path from 'path';
import * as fse from 'fs-extra';
import type { WorkerReport, ModuleRunStatus } from '../types';
import { ProgressManager } from './progress-manager';
import { DependencyGraph, type ModuleNode } from './dependency-graph';
import type { IAiRunner, RunHooks } from './ai-runner';
import { createRunner } from './ai-runner';
import { buildLocalLanguageInstruction } from './phase-gate';

export interface ModuleRunResult {
  moduleName: string;
  status: ModuleRunStatus;
  durationMs: number;
  report?: WorkerReport;
  error?: string;
}

export interface IOrchestrator {
  run(projectRoot: string): Promise<ModuleRunResult[]>;
  retry(projectRoot: string, moduleName: string, failureContext: string): Promise<ModuleRunResult>;
}

const MAX_RETRIES = 3;
const SCRATCHPAD_BASE = '.phasegate/scratchpad';
const ARCH_CONSTRAINTS_REL = path.join('docs', 'core', 'architecture-constraints.md');
const DEFAULT_WORKER_TIMEOUT_MS = 10 * 60 * 1000;

export class Orchestrator implements IOrchestrator {
  private pm = new ProgressManager();
  private dg = new DependencyGraph();

  async run(projectRoot: string): Promise<ModuleRunResult[]> {
    const coordinatorRunner = await createRunner(projectRoot, 'phase3.coordinator');
    const runner = await createRunner(projectRoot, 'phase3.worker');
    const progress = this.pm.read(projectRoot);

    const allNodes = await this.dg.build(projectRoot);
    await this.generateCoordinatorBrief(projectRoot, allNodes, coordinatorRunner);

    let dirty = false;
    for (const node of allNodes) {
      if (!progress.modules.find((m) => m.name === node.name)) {
        progress.modules.push({ name: node.name, status: 'pending' });
        dirty = true;
      }
    }
    if (dirty) this.pm.write(projectRoot, progress);

    const doneModules = new Set(progress.modules.filter((m) => m.status === 'done').map((m) => m.name));
    const pendingNodes = allNodes.filter((n) => !doneModules.has(n.name));

    const waves = this.dg.getExecutionWaves(pendingNodes);
    const allResults: ModuleRunResult[] = [];
    const failedModules = new Set<string>();

    for (let waveIndex = 0; waveIndex < waves.length; waveIndex++) {
      const wave = waves[waveIndex];
      console.log(`Wave ${waveIndex + 1}/${waves.length}: ${wave.map((node) => node.name).join(', ')}`);

      const waveResults = await Promise.all(
        wave.map((node) => this.runModule(projectRoot, node, failedModules, undefined, runner))
      );

      for (const result of waveResults) {
        allResults.push(result);
        if (result.status === 'done') {
          this.pm.markModuleDone(projectRoot, result.moduleName);
        } else if (result.status === 'failed') {
          failedModules.add(result.moduleName);
          this.pm.markModuleFailed(projectRoot, result.moduleName, result.error ?? 'unknown error');
        }
      }
    }

    return allResults;
  }

  async retry(
    projectRoot: string,
    moduleName: string,
    failureContext: string
  ): Promise<ModuleRunResult> {
    const runner = await createRunner(projectRoot, 'phase3.worker');
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
      const result = await this.runModule(projectRoot, node, failedModules, prompt, runner);

      if (result.status === 'done') {
        this.pm.markModuleDone(projectRoot, moduleName);
        return result;
      }
    }

    const finalError = `max retries (${MAX_RETRIES}) exceeded`;
    this.pm.markModuleFailed(projectRoot, moduleName, finalError);
    return { moduleName, status: 'failed', durationMs: 0, error: finalError };
  }

  private async runModule(
    projectRoot: string,
    node: ModuleNode,
    failedModules: Set<string>,
    overridePrompt?: string,
    runner?: IAiRunner
  ): Promise<ModuleRunResult> {
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
    const timeoutMs = getWorkerTimeoutMs();
    console.log(`  -> ${node.name} started`);
    const hooks: RunHooks = {
      onText: (text) => {
        const line = text.trim();
        if (!line) return;
        console.log(`    [${node.name}] ${line}`);
      },
    };

    try {
      const activeRunner = runner ?? (await createRunner(projectRoot));
      const report = await withTimeout(
        activeRunner.fork(contextFiles, prompt, hooks),
        timeoutMs,
        `worker timeout after ${formatDuration(timeoutMs)}`
      );
      const durationMs = Date.now() - startMs;

      await fse.writeFile(
        path.join(scratchpadPath, 'report.json'),
        JSON.stringify(report, null, 2),
        'utf-8'
      );

      console.log(`  ${report.result === 'done' ? 'OK' : 'x'} ${node.name} ${report.result} (${formatDuration(durationMs)})`);

      return {
        moduleName: node.name,
        status: report.result === 'done' ? 'done' : 'failed',
        durationMs,
        report,
        error: report.result === 'failed' ? report.issues.join('; ') : undefined,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      const durationMs = Date.now() - startMs;
      await persistFailureReport(scratchpadPath, node.name, error, durationMs);
      console.log(`  x ${node.name} failed (${formatDuration(durationMs)}): ${error}`);

      return {
        moduleName: node.name,
        status: 'failed',
        durationMs,
        error,
      };
    }
  }

  private async generateCoordinatorBrief(
    projectRoot: string,
    nodes: ModuleNode[],
    runner: IAiRunner
  ): Promise<void> {
    const scratchpadPath = path.join(projectRoot, SCRATCHPAD_BASE, 'coordinator');
    await fse.ensureDir(scratchpadPath);

    const contextFiles = await this.buildCoordinatorContextFiles(projectRoot);
    const prompt = buildCoordinatorPrompt(nodes, scratchpadPath);
    const brief = await runner.run(contextFiles, prompt);

    await fse.writeFile(path.join(scratchpadPath, 'brief.md'), brief, 'utf-8');
    console.log(`Coordinator brief written: ${path.join(SCRATCHPAD_BASE, 'coordinator', 'brief.md')}`);
  }

  private async buildCoordinatorContextFiles(projectRoot: string): Promise<string[]> {
    const pg = path.join(projectRoot, '.phasegate');
    const archConstraints = path.join(projectRoot, ARCH_CONSTRAINTS_REL);
    const files: string[] = [];
    const progress = this.pm.read(projectRoot);
    if (progress.activeRequirement) {
      const activeRequirement = progress.requirements.find(
        (entry) => entry.name === progress.activeRequirement
      );
      const requirementPath = path.join(
        pg,
        'requirements',
        activeRequirement?.file ?? `${progress.activeRequirement}.md`
      );
      if (await fse.pathExists(requirementPath)) {
        files.push(requirementPath);
      }
    }

    files.push(...(await listMarkdownFiles(path.join(pg, 'tasks'))));
    files.push(...(await listMarkdownFiles(path.join(pg, 'contracts'))));

    if (await fse.pathExists(archConstraints)) {
      files.push(archConstraints);
    }

    return files;
  }
}

function buildWorkerPrompt(node: ModuleNode, scratchpadPath: string): string {
  const contractList =
    node.contractFiles.length > 0
      ? `Contracts:\n${node.contractFiles.map((c) => `  - ${c}`).join('\n')}\n`
      : '';

  return [
    `Implement module: ${node.name}`,
    `Design file: ${node.designFile}`,
    contractList,
    buildLocalLanguageInstruction(),
    '',
    'When complete, output a WorkerReport in this exact markdown format:',
    '',
    '## Scope',
    '{module name} - {one-line responsibility}',
    '',
    '## Result',
    'done',
    '',
    '## Key Files',
    '- {path to each key file}',
    '',
    '## Files Changed',
    '- {all files changed}',
    '',
    '## Issues',
    '(none)',
    '',
    `Scratchpad directory (for intermediate files only): ${scratchpadPath}`,
  ]
    .filter((line) => line !== undefined)
    .join('\n');
}

function buildCoordinatorPrompt(nodes: ModuleNode[], scratchpadPath: string): string {
  const moduleList = nodes.length > 0 ? nodes.map((node) => `- ${node.name}`).join('\n') : '- (none)';

  return [
    'You are the Phase 3 coordinator for PhaseGate.',
    'Review the current module plan and produce a concise execution brief for the orchestrator and workers.',
    buildLocalLanguageInstruction(),
    '',
    'Modules in scope:',
    moduleList,
    '',
    'Write the response as markdown with these sections only:',
    '## Execution Order',
    '- ordered wave-level summary',
    '',
    '## Dependency Risks',
    '- contracts or dependency edges that are easy to break',
    '',
    '## Worker Guidance',
    '- implementation cautions workers should keep in mind',
    '',
    `The brief will be stored at: ${path.join(scratchpadPath, 'brief.md')}`,
  ].join('\n');
}

function buildRetryPrompt(
  moduleName: string,
  node: ModuleNode,
  failureContext: string,
  attempt: number
): string {
  return [
    `Retry attempt ${attempt}/${MAX_RETRIES} for module: ${moduleName}`,
    '',
    'Previous failure context:',
    failureContext,
    '',
    `Design file: ${node.designFile}`,
    node.contractFiles.length > 0
      ? `Contracts:\n${node.contractFiles.map((c) => `  - ${c}`).join('\n')}`
      : '',
    '',
    buildLocalLanguageInstruction(),
    '',
    'Fix the reported issues and output a WorkerReport when done (same format as before).',
  ]
    .filter(Boolean)
    .join('\n');
}

function getWorkerTimeoutMs(): number {
  const raw = process.env.PHASEGATE_WORKER_TIMEOUT_MS;
  if (!raw) return DEFAULT_WORKER_TIMEOUT_MS;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_WORKER_TIMEOUT_MS;
  }

  return parsed;
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      }
    );
  });
}

async function persistFailureReport(
  scratchpadPath: string,
  moduleName: string,
  error: string,
  durationMs: number
): Promise<void> {
  const report: WorkerReport = {
    scope: `${moduleName} - failed execution`,
    result: 'failed',
    keyFiles: [],
    filesChanged: [],
    issues: [error, `duration: ${formatDuration(durationMs)}`],
  };

  await fse.writeFile(
    path.join(scratchpadPath, 'report.json'),
    JSON.stringify(report, null, 2),
    'utf-8'
  );
}

function formatDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  return `${(durationMs / 1000).toFixed(1)}s`;
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  if (!(await fse.pathExists(dir))) {
    return [];
  }

  return (await fse.readdir(dir))
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(dir, file));
}
