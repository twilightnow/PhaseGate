import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ProgressManager } from '../core/progress-manager';
import { PhaseExecutor } from '../core/phase-executor';
import { PhaseTransitionManager } from '../core/phase-transition-manager';
import type { ExecutablePhaseId } from '../core/phase-runtime';
import type { IAiRunner } from '../core/ai-runner';
import type { ProjectProgress, RunEvent, ToolUseEvent } from '../types';

const TOOL_SYMBOLS: Record<string, string> = {
  Write: '+',
  Edit: '~',
  Bash: '$',
  TodoWrite: '*',
  Task: '=',
};

function formatToolLine(event: ToolUseEvent): string {
  const name = event.name;
  const symbol = TOOL_SYMBOLS[name] ?? '.';

  if (name === 'TodoWrite' || name === 'Task') {
    return `  ${symbol}`;
  }

  const label = event.input ?? name;
  return `  ${symbol} ${label}`;
}

function shouldDisplayTool(event: ToolUseEvent): boolean {
  return !['Read', 'Glob', 'Grep'].includes(event.name);
}

function formatTextLine(text: string): string | undefined {
  const line = text.trim();
  if (!line) return undefined;
  return `  | ${line}`;
}

export async function runSinglePhase(
  runner: IAiRunner,
  contextFiles: string[],
  prompt: string,
  phase: number,
  title: string
): Promise<string> {
  const spinner = ora(`Phase ${phase}: ${title}...`).start();
  let spinnerStopped = false;
  let completionPrinted = false;

  const onEvent = (event: RunEvent): void => {
    if (event.type === 'tool_use') {
      if (!shouldDisplayTool(event)) {
        return;
      }
      if (!spinnerStopped) {
        spinner.stop();
        spinnerStopped = true;
      }
      process.stdout.write(formatToolLine(event) + '\n');
    } else if (event.type === 'result') {
      if (!spinnerStopped) {
        spinner.stop();
        spinnerStopped = true;
      }
      const base = `${chalk.green('OK')} Phase ${phase}: ${title} complete.`;
      const costText =
        typeof event.usage?.cost_usd === 'number'
          ? ` | $${event.usage.cost_usd.toFixed(4)}`
          : '';
      const stats = event.usage
        ? `  [in: ${event.usage.input_tokens} / out: ${event.usage.output_tokens} tokens${costText}]`
        : '';
      console.log(base + stats);
      completionPrinted = true;
    }
  };

  const onText = (text: string): void => {
    const line = formatTextLine(text);
    if (!line) return;
    if (!spinnerStopped) {
      spinner.stop();
      spinnerStopped = true;
    }
    process.stdout.write(line + '\n');
  };

  try {
    const result = await runner.run(contextFiles, prompt, { onEvent, onText });

    if (!spinnerStopped) {
      spinner.succeed(`Phase ${phase}: ${title} complete.`);
    } else if (!completionPrinted) {
      console.log(`${chalk.green('OK')} Phase ${phase}: ${title} complete.`);
    }

    return result;
  } catch (err) {
    if (!spinnerStopped) spinner.stop();
    console.error(chalk.red('Runner error:'), err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

export function createRunCommand(): Command {
  const cmd = new Command('run');

  cmd
    .description('Drive the current phase (auto-detects from progress.json)')
    .option('--phase <n>', 'override phase to run (0-5)', parseInt)
    .option('--requirement <name>', 'select an approved requirement before running')
    .action(async (options: { phase?: number; requirement?: string }) => {
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

      progress = pm.syncRequirementsFromWorkspace(cwd);

      if (options.requirement) {
        try {
          progress = pm.activateRequirement(cwd, options.requirement);
        } catch (err) {
          console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
          process.exit(1);
        }
      }

      if (!progress.activeRequirement) {
        console.log(
          chalk.yellow('!') +
            ' No active requirement is selected. Use ' +
            chalk.bold('phasegate select <requirement>') +
            ' or ' +
            chalk.bold('phasegate run --requirement <requirement>') +
            '.'
        );
        process.exit(0);
      }

      const forcedPhase = options.phase !== undefined;
      const requestedPhase = options.phase ?? (progress.currentPhase === 0 ? 1 : progress.currentPhase);

      if (requestedPhase === 0) {
        console.log(
          chalk.yellow('!') +
            ' Phase 0 is requirement intake only. Select a requirement and run Phase 1 or later.'
        );
        process.exit(0);
      }

      const executor = new PhaseExecutor();
      const transitionManager = new PhaseTransitionManager(pm);
      let phase = requestedPhase as ExecutablePhaseId;

      while (true) {
        let executionResult;

        if (phase === 2) {
          // Phase 2 has been folded into Phase 1 — skip AI entirely
          console.log(
            chalk.yellow('!') + ' Phase 2 (Design Review) has been folded into Phase 1.\n' +
            '  Design self-check constraints are now embedded in the Phase 1 prompt.\n' +
            '  Skipping Phase 2 AI execution. Transition manager will advance to Phase 3.'
          );
          executionResult = { phase: 2 as ExecutablePhaseId, output: 'phase2_migrated' };
        } else if (phase === 3) {
          executionResult = await executor.execute(cwd, 3);
        } else {
          console.log(chalk.cyan('->') + ` Running Phase ${phase}...`);
          let prepared;
          try {
            prepared = await executor.prepare(cwd, phase as Exclude<ExecutablePhaseId, 2 | 3>);
          } catch (err) {
            console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
            process.exit(1);
          }

          const output = await runSinglePhase(
            prepared.runner,
            prepared.contextFiles,
            prepared.prompt,
            phase,
            prepared.title
          );
          executionResult = { phase, output };
        }

        const transition = await transitionManager.resolve(cwd, executionResult);
        console.log(transition.message);

        if (forcedPhase || !transition.shouldContinue || transition.nextPhase === null) {
          break;
        }

        phase = transition.nextPhase;
        console.log('');
      }
    });

  return cmd;
}
