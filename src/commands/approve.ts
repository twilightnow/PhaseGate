import { Command } from 'commander';
import chalk from 'chalk';
import { ProgressManager } from '../core/progress-manager';

export function createApproveCommand(): Command {
  const cmd = new Command('approve');

  cmd
    .description('Approve a requirement document (promote draft → approved)')
    .argument('[requirement]', 'requirement name (omit to approve all drafts)')
    .action((requirementName?: string) => {
      const cwd = process.cwd();
      const pm = new ProgressManager();

      try {
        const before = pm.read(cwd).requirements.map((r) => ({ name: r.name, status: r.status }));
        const progress = pm.approveRequirementDocs(cwd, requirementName);

        const newlyApproved = progress.requirements.filter((r) => {
          const prior = before.find((b) => b.name === r.name);
          return r.status === 'approved' && prior?.status === 'draft';
        });

        if (requirementName) {
          if (newlyApproved.length > 0) {
            console.log(chalk.green('OK') + ` Requirement approved: ${newlyApproved[0].name}`);
          } else {
            const entry = progress.requirements.find(
              (r) => r.name.toLowerCase() === requirementName.toLowerCase()
            );
            const state = entry ? entry.status : 'not found';
            console.log(chalk.yellow('!') + ` Requirement '${requirementName}' is already ${state}, no change.`);
          }
        } else {
          if (newlyApproved.length === 0) {
            console.log(chalk.yellow('!') + ' No draft requirements found to approve.');
          } else {
            for (const r of newlyApproved) {
              console.log(chalk.green('OK') + ` Approved: ${r.name}`);
            }
          }
        }

        console.log('Run ' + chalk.bold('phasegate loop') + ' to execute approved requirements.');
      } catch (err) {
        console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });

  return cmd;
}
