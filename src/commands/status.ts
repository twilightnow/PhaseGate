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

  // Show Phase 2 migration notice if applicable
  const phase2State = progress.phaseStates?.find(s => s.phaseId === 2);
  const phase2Display = phase2State?.state === 'migrated'
    ? chalk.dim('Phase 2: Design Review → merged into Phase 1 (no separate execution needed)')
    : null;

  console.log(`Execution phase: Phase ${progress.currentPhase}: ${phaseName}`);
  if (phase2Display) {
    console.log(`  ${phase2Display}`);
  }
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
      `  ${progress.design.reviewPassed ? chalk.green('OK') : chalk.dim('.')} Phase 1 design checks`
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
    `${progress.codeReviewPassed ? chalk.green('OK') : chalk.dim('.')} lightweight final review (Phase 4)`
  );
  console.log('');

  const approvedCount = progress.requirements.filter((r) => r.status === 'approved').length;
  if (approvedCount > 0) {
    console.log(
      `待执行队列：${approvedCount} 条（approved）— 运行 ` +
        chalk.bold('phasegate loop --dry-run') +
        ' 查看顺序'
    );
  } else {
    console.log(chalk.dim('待执行队列：0 条（approved）'));
  }
}
