import chalk from 'chalk';
import ora from 'ora';
import * as path from 'path';
import * as fse from 'fs-extra';
import { createRunner, type IAiRunner } from './ai-runner';
import { ConstraintChecker } from './constraint-checker';
import { buildLocalLanguageInstruction } from './phase-gate';
import { Orchestrator, type ModuleRunResult } from './orchestrator';
import { ProgressManager } from './progress-manager';
import type { ExecutablePhaseId, PhaseExecutionResult } from './phase-runtime';
import type { RunnerScope } from './ai-runner';

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');

const PHASE_META: Record<number, { title: string; promptFile: string }> = {
  1: { title: 'Design Generation', promptFile: 'phase1_design.md' },
  2: { title: 'Design Review', promptFile: 'phase2_review.md' },
  4: { title: 'Code Review', promptFile: 'phase4_code_review.md' },
  5: { title: 'Acceptance', promptFile: 'phase5_acceptance.md' },
};

export interface PreparedPhase {
  runner: IAiRunner;
  contextFiles: string[];
  prompt: string;
  title: string;
}

export interface IPhaseExecutor {
  execute(cwd: string, phase: ExecutablePhaseId): Promise<PhaseExecutionResult>;
  prepare(cwd: string, phase: Exclude<ExecutablePhaseId, 3>): Promise<PreparedPhase>;
}

export class PhaseExecutor implements IPhaseExecutor {
  private readonly progressManager = new ProgressManager();

  async prepare(cwd: string, phase: Exclude<ExecutablePhaseId, 3>): Promise<PreparedPhase> {
    const meta = PHASE_META[phase];
    if (!meta) {
      throw new Error(`No runner configured for phase ${phase}.`);
    }

    const promptPath = path.join(PROMPTS_DIR, meta.promptFile);
    let prompt: string;
    try {
      prompt = await fse.readFile(promptPath, 'utf-8');
    } catch {
      throw new Error(`Prompt file not found: ${promptPath}`);
    }
    prompt = this.applyOutputLanguageInstruction(prompt);

    const contextFiles = await this.buildPhaseContextFiles(cwd, phase);
    const runner = await createRunner(cwd, this.getRunnerScopeForPhase(phase));

    return { runner, contextFiles, prompt, title: meta.title };
  }

  async execute(cwd: string, phase: ExecutablePhaseId): Promise<PhaseExecutionResult> {
    if (phase === 3) {
      const results = await this.runPhase3(cwd);
      return { phase, phase3Results: results };
    }

    await this.runPromptPhase(cwd, phase);
    return { phase };
  }

  private async runPhase3(cwd: string): Promise<ModuleRunResult[]> {
    const checker = new ConstraintChecker();
    const report = checker.check(cwd);

    if (!report.passed) {
      console.error(chalk.red('Constraint violations detected:'));
      for (const violation of report.violations) {
        console.error(
          `  ${chalk.yellow(violation.file)}: [${violation.rule}] ${violation.detail}`
        );
      }
      process.exit(1);
    }

    console.log(
      chalk.cyan('->') + ' Launching Orchestrator for Phase 3 (parallel module development)...'
    );

    const orchestrator = new Orchestrator();
    try {
      const results = await orchestrator.run(cwd);
      this.printOrchestratorResults(results);
      return results;
    } catch (err) {
      console.error(chalk.red('Orchestrator error:'), err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  private async runPromptPhase(cwd: string, phase: Exclude<ExecutablePhaseId, 3>): Promise<void> {
    const meta = PHASE_META[phase];
    if (!meta) {
      console.error(chalk.red(`Error: No runner configured for phase ${phase}.`));
      process.exit(1);
    }

    console.log(chalk.cyan('->') + ` Running Phase ${phase}: ${meta.title}...`);

    const promptPath = path.join(PROMPTS_DIR, meta.promptFile);
    let prompt: string;

    try {
      prompt = await fse.readFile(promptPath, 'utf-8');
    } catch {
      console.error(chalk.red('Error:') + ` Prompt file not found: ${promptPath}`);
      process.exit(1);
    }

    prompt = this.applyOutputLanguageInstruction(prompt);
    const contextFiles = await this.buildPhaseContextFiles(cwd, phase);
    const spinner = ora(`Phase ${phase}: ${meta.title}...`).start();

    try {
      const runner = await createRunner(cwd, this.getRunnerScopeForPhase(phase));
      const result = await runner.run(contextFiles, prompt);
      spinner.succeed(`Phase ${phase}: ${meta.title} complete.`);
      console.log('');
      console.log(result);
    } catch (err) {
      spinner.fail(`Phase ${phase}: ${meta.title} failed.`);
      console.error(chalk.red('Runner error:'), err instanceof Error ? err.message : err);
      process.exit(1);
    }
  }

  private applyOutputLanguageInstruction(prompt: string): string {
    return [prompt, '', '---', '', buildLocalLanguageInstruction()].join('\n');
  }

  private async buildPhaseContextFiles(
    cwd: string,
    phase: Exclude<ExecutablePhaseId, 3>
  ): Promise<string[]> {
    const pg = path.join(cwd, '.phasegate');
    const archConstraints = path.join(cwd, 'docs', 'core', 'architecture-constraints.md');
    const files: string[] = [];
    const activeRequirementFiles = await this.getActiveRequirementContextFiles(cwd);
    const summaryDir = path.join(pg, 'scratchpad', 'summaries');

    switch (phase) {
      case 1: {
        files.push(...activeRequirementFiles);
        break;
      }
      case 2: {
        files.push(...(await listMarkdownFiles(path.join(pg, 'tasks'))));
        files.push(...(await listMarkdownFiles(path.join(pg, 'contracts'))));
        files.push(...activeRequirementFiles);
        break;
      }
      case 4: {
        files.push(path.join(pg, 'progress.json'));
        files.push(...(await listMarkdownFiles(path.join(pg, 'tasks'))));
        files.push(...(await listMarkdownFiles(path.join(pg, 'contracts'))));
        files.push(...activeRequirementFiles);
        if (await fse.pathExists(summaryDir)) {
          files.push(...(await listMarkdownFiles(summaryDir)));
        }
        files.push(...(await this.listWorkerReportFiles(path.join(pg, 'scratchpad'))));
        break;
      }
      case 5: {
        files.push(path.join(pg, 'progress.json'));
        files.push(...activeRequirementFiles);
        if (await fse.pathExists(summaryDir)) {
          files.push(...(await listMarkdownFiles(summaryDir)));
        }
        const scratchpadBase = path.join(pg, 'scratchpad');
        files.push(...(await this.listWorkerReportFiles(scratchpadBase)));
        break;
      }
    }

    const dedupedFiles = files.filter(Boolean);

    if (await fse.pathExists(archConstraints)) {
      dedupedFiles.push(archConstraints);
    }

    return Array.from(new Set(dedupedFiles));
  }

  private async getActiveRequirementContextFiles(cwd: string): Promise<string[]> {
    const progress = this.progressManager.read(cwd);
    if (!progress.activeRequirement) {
      return [];
    }

    const requirement = progress.requirements.find(
      (entry) => entry.name === progress.activeRequirement
    );
    const fileName = requirement?.file ?? `${progress.activeRequirement}.md`;
    const requirementPath = path.join(cwd, '.phasegate', 'requirements', fileName);

    return (await fse.pathExists(requirementPath)) ? [requirementPath] : [];
  }

  private getRunnerScopeForPhase(phase: Exclude<ExecutablePhaseId, 3>): RunnerScope {
    switch (phase) {
      case 1:
        return 'phase1';
      case 2:
        return 'phase2';
      case 4:
        return 'phase4';
      case 5:
        return 'phase5';
    }
  }

  private async listWorkerReportFiles(scratchpadBase: string): Promise<string[]> {
    if (!(await fse.pathExists(scratchpadBase))) {
      return [];
    }

    const entries = await fse.readdir(scratchpadBase);
    const reports: string[] = [];

    for (const entry of entries) {
      const reportPath = path.join(scratchpadBase, entry, 'report.json');
      if (await fse.pathExists(reportPath)) {
        reports.push(reportPath);
      }
    }

    return reports;
  }

  private printOrchestratorResults(results: ModuleRunResult[]): void {
    console.log('');
    console.log(chalk.bold('Phase 3 Results'));
    console.log(chalk.dim('-'.repeat(40)));

    const done = results.filter((r) => r.status === 'done');
    const failed = results.filter((r) => r.status === 'failed');
    const blocked = results.filter((r) => r.status === 'blocked');

    for (const result of done) {
      console.log(
        `  ${chalk.green('OK')} ${result.moduleName} (${(result.durationMs / 1000).toFixed(1)}s)`
      );
    }
    for (const result of failed) {
      console.log(`  ${chalk.red('x')} ${result.moduleName} - ${result.error ?? 'failed'}`);
    }
    for (const result of blocked) {
      console.log(`  ${chalk.yellow('!')} ${result.moduleName} - ${result.error ?? 'blocked'}`);
    }

    console.log('');
    console.log(
      `  ${chalk.green(String(done.length) + ' done')}` +
        `  ${chalk.red(String(failed.length) + ' failed')}` +
        `  ${chalk.yellow(String(blocked.length) + ' blocked')}`
    );
  }
}

async function listMarkdownFiles(dir: string): Promise<string[]> {
  if (!(await fse.pathExists(dir))) {
    return [];
  }

  return (await fse.readdir(dir))
    .filter((file) => file.endsWith('.md'))
    .map((file) => path.join(dir, file));
}
