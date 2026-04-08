import { Command } from 'commander';
import chalk from 'chalk';
import { ProgressManager } from '../core/progress-manager';

export function createProgressCommand(): Command {
  const cmd = new Command('progress');

  cmd
    .description('Show structured progress state (reads progress.json)')
    .action(() => {
      const cwd = process.cwd();
      const manager = new ProgressManager();

      try {
        const progress = manager.syncRequirementsFromWorkspace(cwd);
        console.log(JSON.stringify(progress, null, 2));
      } catch {
        console.error(
          chalk.red('Error:') +
            ' .phasegate/progress.json not found. Run ' +
            chalk.bold('phasegate init') +
            ' first.'
        );
        process.exit(1);
      }
    });

  return cmd;
}
