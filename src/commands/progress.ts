import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fse from 'fs-extra';

export function createProgressCommand(): Command {
  const cmd = new Command('progress');

  cmd
    .description('Show detailed progress document (reads progress.md)')
    .action(async () => {
      const cwd = process.cwd();
      const mdPath = path.join(cwd, '.phasegate', 'progress.md');

      if (!(await fse.pathExists(mdPath))) {
        console.error(
          chalk.red('Error:') +
            ' .phasegate/progress.md not found. Run ' +
            chalk.bold('phasegate init') +
            ' first.'
        );
        process.exit(1);
      }

      const content = await fse.readFile(mdPath, 'utf-8');
      console.log(content);
    });

  return cmd;
}
