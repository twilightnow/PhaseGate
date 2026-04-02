import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fse from 'fs-extra';
import { createRunner } from '../core/ai-runner';

const REQUIREMENTS_SYSTEM_PROMPT = `You are assisting with requirements discussion for a PhaseGate project.

Work through the following framework in order. Do not skip unanswered items:
1. Functional boundary - What does this feature do? What is explicitly out of scope?
2. Data - What data is involved? What are the relationships?
3. Error cases - What happens on failure? What are the edge cases?
4. Acceptance - What counts as "done"? Who validates?
5. Constraints - Tech stack, performance requirements, other limits?

After all items are confirmed, summarize the requirements and offer to generate
.phasegate/requirements/{feature-name}.md using the standard template.`;

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

      const systemPrompt = options.feature
        ? `${REQUIREMENTS_SYSTEM_PROMPT}\n\nFeature being discussed: ${options.feature}`
        : REQUIREMENTS_SYSTEM_PROMPT;

      console.log(chalk.cyan('->') + ' Starting requirements discussion session...');
      console.log(chalk.dim('(Press Ctrl+C to exit)'));
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
    });

  return cmd;
}
