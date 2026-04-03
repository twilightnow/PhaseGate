import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fse from 'fs-extra';
import { createRunner } from '../core/ai-runner';
import { ProgressManager } from '../core/progress-manager';
import { checkPhase0Gate } from '../core/phase-gate';

const PROMPT_FILE = path.join(__dirname, '..', '..', 'prompts', 'phase0_requirements.md');

export function createChatCommand(): Command {
  const cmd = new Command('chat');

  cmd
    .description('Start requirements discussion session (Phase 0)')
    .option('--feature <name>', 'feature name for the output document')
    .action(async (options: { feature?: string }) => {
      const cwd = process.cwd();
      const progressPath = path.join(cwd, '.phasegate', 'progress.json');

      if (!(await fse.pathExists(progressPath))) {
        console.error(
          chalk.red('Error:') +
            ' .phasegate/progress.json not found. Run ' +
            chalk.bold('phasegate init') +
            ' first.'
        );
        process.exit(1);
      }

      let promptContent = '';
      if (await fse.pathExists(PROMPT_FILE)) {
        promptContent = await fse.readFile(PROMPT_FILE, 'utf-8');
      }

      let systemPrompt = promptContent || `You are facilitating a PhaseGate requirements discussion session.`;

      if (options.feature) {
        systemPrompt += `\n\nFeature being discussed: ${options.feature}`;
      }

      console.log(chalk.cyan('->') + ' Starting requirements discussion session...');
      console.log(chalk.dim('(Exit the session when requirements are confirmed)'));
      console.log('');

      try {
        const runner = await createRunner(cwd);
        await runner.chat(systemPrompt);
      } catch (err) {
        console.error(
          chalk.red('Chat error:'),
          err instanceof Error ? err.message : err
        );
        process.exit(1);
      }

      // Subprocess exited — Gate check runs automatically
      console.log('');
      console.log(chalk.cyan('->') + ' Session ended. Running Phase 0 Gate check...');

      const gate = await checkPhase0Gate(cwd);

      if (!gate.passed) {
        console.error(chalk.red('Gate failed:'));
        for (const issue of gate.issues) {
          console.error(`  ${chalk.yellow('!')} ${issue}`);
        }
        console.log('');
        console.log('Fix the issues above and run ' + chalk.bold('phasegate chat') + ' again.');
        process.exit(1);
      }

      const pm = new ProgressManager();
      pm.updatePhase(cwd, 1);

      console.log(chalk.green('✓') + ' Gate passed.');
      console.log(chalk.green('✓') + ' Phase advanced to 1 (Design Generation).');
      console.log('Run ' + chalk.bold('phasegate run') + ' to start Phase 1.');
    });

  return cmd;
}
