import { Command } from 'commander';
import chalk from 'chalk';
import { ProgressManager } from '../core/progress-manager';

export function createSelectCommand(): Command {
  const cmd = new Command('select');

  cmd
    .description('Select an approved requirement for the active execution flow')
    .argument('<requirement>', 'requirement name (matches .phasegate/requirements/{name}.md)')
    .action((requirementName: string) => {
      const cwd = process.cwd();
      const manager = new ProgressManager();

      try {
        const progress = manager.activateRequirement(cwd, requirementName);
        console.log(chalk.green('OK') + ` Active requirement: ${progress.activeRequirement}`);
        console.log(chalk.green('OK') + ' Execution phase reset to 1 (Design Generation).');
        console.log('Run ' + chalk.bold('phasegate run') + ' to continue the active execution flow.');
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error:') + ` ${message}`);
        process.exit(1);
      }
    });

  return cmd;
}
