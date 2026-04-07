import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { ProgressManager } from '../core/progress-manager';
import { PhaseExecutor } from '../core/phase-executor';
import { PhaseTransitionManager } from '../core/phase-transition-manager';
import type { ExecutablePhaseId } from '../core/phase-runtime';
import type { IAiRunner } from '../core/ai-runner';
import type { ProjectProgress, RunEvent, ToolUseEvent } from '../types';

// ---- display helpers -------------------------------------------------------

const TOOL_SYMBOLS: Record<string, string> = {
  Write: '+',
  Edit: '~',
  Bash: '⚡',
  TodoWrite: '📋',
  Task: '✓',
};

function formatToolLine(event: ToolUseEvent): string {
  const name = event.name;
  const symbol = TOOL_SYMBOLS[name] ?? '·';

  // TodoWrite / Task: display just the symbol
  if (name === 'TodoWrite' || name === 'Task') {
    return `  ${symbol}`;
  }

  const label = event.input ?? name;
  return `  ${symbol} ${label}`;
}

function shouldDisplayTool(event: ToolUseEvent): boolean {
  return !['Read', 'Glob', 'Grep'].includes(event.name);
}

// ---- runSinglePhase --------------------------------------------------------

/**
 * Run a single non-Phase-3 phase with real-time tool-event display.
 * Display logic is fully contained here; no stdout/console.log outside this function.
 */
export async function runSinglePhase(
  runner: IAiRunner,
  contextFiles: string[],
  prompt: string,
  phase: number,
  title: string
): Promise<void> {
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
      const base = `${chalk.green('✓')} Phase ${phase}: ${title} complete.`;
      const stats = event.usage
        ? `  [in: ${event.usage.input_tokens} / out: ${event.usage.output_tokens} tokens | $${event.usage.cost_usd.toFixed(4)}]`
        : '';
      console.log(base + stats);
      completionPrinted = true;
    }
  };

  try {
    await runner.run(contextFiles, prompt, onEvent);

    if (!spinnerStopped) {
      spinner.succeed(`Phase ${phase}: ${title} complete.`);
    } else if (!completionPrinted) {
      console.log(`${chalk.green('✓')} Phase ${phase}: ${title} complete.`);
    }
  } catch (err) {
    if (!spinnerStopped) spinner.stop();
    console.error(
      chalk.red('Runner error:'),
      err instanceof Error ? err.message : err
    );
    process.exit(1);
  }
}

// ---- command ---------------------------------------------------------------

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

      const forcedPhase = options.phase !== undefined;
      const requestedPhase = options.phase ?? progress.currentPhase;

      if (requestedPhase === 0) {
        console.log(
          chalk.yellow('!') +
            ' Phase 0 is an interactive session. Run ' +
            chalk.bold('phasegate chat') +
            ' instead.'
        );
        process.exit(0);
      }

      const executor = new PhaseExecutor();
      const transitionManager = new PhaseTransitionManager(pm);
      let phase = requestedPhase as ExecutablePhaseId;

      while (true) {
        let executionResult;

        if (phase === 3) {
          executionResult = await executor.execute(cwd, 3);
        } else {
          console.log(chalk.cyan('->') + ` Running Phase ${phase}...`);
          let prepared;
          try {
            prepared = await executor.prepare(cwd, phase as Exclude<ExecutablePhaseId, 3>);
          } catch (err) {
            console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
            process.exit(1);
          }
          await runSinglePhase(prepared.runner, prepared.contextFiles, prepared.prompt, phase, prepared.title);
          executionResult = { phase };
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
