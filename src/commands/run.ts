import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fse from 'fs-extra';
import { ProgressManager } from '../core/progress-manager';
import { Orchestrator, type ModuleRunResult } from '../core/orchestrator';
import { createRunner } from '../core/ai-runner';
import { ConstraintChecker } from '../core/constraint-checker';
import type { ProjectProgress, PhaseId } from '../types';

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');

// Phase 0 → phasegate chat
// Phase 3 → Orchestrator (special path)
// Phases 1, 2, 4, 5 → runSinglePhase
const PHASE_META: Record<number, { title: string; promptFile: string }> = {
  1: { title: 'Design Generation',  promptFile: 'phase1_design.md' },
  2: { title: 'Design Review',      promptFile: 'phase2_review.md' },
  4: { title: 'Code Review',        promptFile: 'phase4_code_review.md' },
  5: { title: 'Acceptance',         promptFile: 'phase5_acceptance.md' },
};

export function createRunCommand(): Command {
  const cmd = new Command('run');

  cmd
    .description('Drive the current phase (auto-detects from progress.json)')
    .option('--phase <n>', 'override phase to run (0-5)', parseInt)
    .action(async (options: { phase?: number }) => {
      const cwd = process.cwd();
      const pm = new ProgressManager();
      let progress: ProjectProgress;

      try {
        progress = pm.read(cwd);
      } catch {
        console.error(
          chalk.red('Error:') +
            ' progress.json not found. Run ' +
            chalk.bold('phasegate init') +
            ' first.'
        );
        process.exit(1);
      }

      const phase = options.phase ?? progress.currentPhase;

      if (phase === 0) {
        console.log(
          chalk.yellow('!') +
            ' Phase 0 is an interactive session. Run ' +
            chalk.bold('phasegate chat') +
            ' instead.'
        );
        process.exit(0);
      }

      if (phase === 3) {
        await runPhase3(cwd, pm, progress);
      } else {
        await runSinglePhase(cwd, phase as PhaseId);
      }
    });

  return cmd;
}

async function runPhase3(
  cwd: string,
  pm: ProgressManager,
  _progress: ProjectProgress
): Promise<void> {
  const checker = new ConstraintChecker();
  const report = checker.check(cwd);

  if (!report.passed) {
    console.error(chalk.red('Constraint violations detected:'));
    for (const v of report.violations) {
      console.error(`  ${chalk.yellow(v.file)}: [${v.rule}] ${v.detail}`);
    }
    process.exit(1);
  }

  console.log(chalk.cyan('->') + ' Launching Orchestrator for Phase 3 (parallel module development)...');

  const orchestrator = new Orchestrator();
  try {
    const results = await orchestrator.run(cwd);
    printOrchestratorResults(results);

    const allDone = results.every((r) => r.status === 'done' || r.status === 'blocked');
    const anyFailed = results.some((r) => r.status === 'failed');
    if (!anyFailed && allDone) {
      pm.updatePhase(cwd, 4);
      console.log('');
      console.log(chalk.green('✓') + ' Phase 3 complete. Advancing to Phase 4 (code review).');
    } else {
      console.log('');
      console.log(
        chalk.yellow('!') + ' Some modules failed. Fix blockers and re-run to resume.'
      );
    }
  } catch (err) {
    console.error(
      chalk.red('Orchestrator error:'),
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

async function runSinglePhase(cwd: string, phase: PhaseId): Promise<void> {
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
    console.error(
      chalk.red('Error:') + ` Prompt file not found: ${promptPath}`
    );
    process.exit(1);
  }

  try {
    const runner = await createRunner(cwd);
    const result = await runner.run(
      ['.phasegate/progress.md', 'docs/03_architecture_constraints.md'],
      prompt
    );
    console.log(result);
  } catch (err) {
    console.error(
      chalk.red('Runner error:'),
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

function printOrchestratorResults(results: ModuleRunResult[]): void {
  console.log('');
  console.log(chalk.bold('Phase 3 Results'));
  console.log(chalk.dim('-'.repeat(40)));

  const done = results.filter((r) => r.status === 'done');
  const failed = results.filter((r) => r.status === 'failed');
  const blocked = results.filter((r) => r.status === 'blocked');

  for (const r of done) {
    console.log(`  ${chalk.green('✓')} ${r.moduleName} (${(r.durationMs / 1000).toFixed(1)}s)`);
  }
  for (const r of failed) {
    console.log(`  ${chalk.red('x')} ${r.moduleName} - ${r.error ?? 'failed'}`);
  }
  for (const r of blocked) {
    console.log(`  ${chalk.yellow('!')} ${r.moduleName} - ${r.error ?? 'blocked'}`);
  }

  console.log('');
  console.log(
    `  ${chalk.green(String(done.length) + ' done')}` +
      `  ${chalk.red(String(failed.length) + ' failed')}` +
      `  ${chalk.yellow(String(blocked.length) + ' blocked')}`
  );
}
