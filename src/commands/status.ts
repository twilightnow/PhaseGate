import { Command } from 'commander';
import chalk from 'chalk';
import { ProgressManager } from '../core/progress-manager';
import type { ProjectProgress, RequirementStatus } from '../types';
import { evaluateGateSnapshot, getPhaseName, readAcceptanceCriteria } from '../core/progress-report';

function renderRequirementIcon(status: RequirementStatus): string {
  switch (status) {
    case 'implemented':
      return chalk.green('OK');
    case 'selected':
      return chalk.cyan('->');
    case 'approved':
      return chalk.blue('A');
    case 'archived':
      return chalk.dim('Z');
    default:
      return chalk.dim('.');
  }
}

export function createStatusCommand(): Command {
  const cmd = new Command('status');

  cmd
    .description('Show current project progress overview')
    .action(() => {
      const cwd = process.cwd();
      const manager = new ProgressManager();
      let progress: ProjectProgress;

      try {
        progress = manager.syncRequirementsFromWorkspace(cwd);
      } catch {
        console.error(
          chalk.red('Error:') +
            ' progress.json not found. Run ' +
            chalk.bold('phasegate init') +
            ' first.'
        );
        process.exit(1);
      }

      renderStatus(progress);
    });

  return cmd;
}

function renderStatus(progress: ProjectProgress): void {
  const phaseName = getPhaseName(progress.currentPhase);
  const gate = evaluateGateSnapshot(process.cwd(), progress);
  const criteria = readAcceptanceCriteria(process.cwd(), progress);
  const gateIcon =
    gate.status === 'ready' ? chalk.green('OK') : gate.status === 'blocked' ? chalk.yellow('!') : chalk.dim('.');

  console.log('');
  console.log(chalk.bold(progress.projectName));
  console.log(chalk.dim('-'.repeat(48)));
  console.log(`Active requirement: ${progress.activeRequirement ?? '(none)'}`);
  console.log(`Execution phase: Phase ${progress.currentPhase}: ${phaseName}`);
  console.log(`Gate status: ${gateIcon} ${gate.message}`);
  console.log(`Acceptance criteria recorded: ${criteria.length}`);
  console.log('');

  console.log(chalk.bold('Requirements'));
  if (progress.requirements.length === 0) {
    console.log(`  ${chalk.dim('(none)')}`);
  } else {
    for (const req of progress.requirements) {
      console.log(`  ${renderRequirementIcon(req.status)} ${req.name} [${req.status}]`);
    }
  }
  console.log('');

  if (progress.design.modules.length > 0) {
    console.log(chalk.bold('Design Modules'));
    for (const mod of progress.design.modules) {
      const icon = mod.status === 'done' ? chalk.green('OK') : chalk.dim('.');
      console.log(`  ${icon} ${mod.name}`);
    }
    console.log(
      `  ${progress.design.reviewPassed ? chalk.green('OK') : chalk.dim('.')} design review`
    );
    console.log('');
  }

  if (progress.modules.length > 0) {
    console.log(chalk.bold('Runtime Modules'));
    for (const mod of progress.modules) {
      let icon: string;
      switch (mod.status) {
        case 'done':
          icon = chalk.green('OK');
          break;
        case 'running':
          icon = chalk.cyan('->');
          break;
        case 'failed':
          icon = chalk.red('x');
          break;
        case 'blocked':
          icon = chalk.yellow('!');
          break;
        default:
          icon = chalk.dim('.');
      }
      const suffix =
        mod.status === 'blocked' && mod.blockedBy
          ? chalk.dim(` (blocked by ${mod.blockedBy})`)
          : '';
      console.log(`  ${icon} ${mod.name}${suffix}`);
    }
    console.log('');
  }

  if (progress.blockers.length > 0) {
    console.log(chalk.red.bold('Blockers'));
    for (const blocker of progress.blockers) {
      console.log(`  ${chalk.red('!')} ${blocker}`);
    }
    console.log('');
  }

  console.log(
    `${progress.codeReviewPassed ? chalk.green('OK') : chalk.dim('.')} final code review`
  );
  console.log('');
}
