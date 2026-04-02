import { Command } from 'commander';
import chalk from 'chalk';
import { ProgressManager } from '../core/progress-manager';
import type { ProjectProgress } from '../types';

const PHASE_NAMES: Record<number, string> = {
  0: '需求讨论',
  1: '设计书生成',
  2: '设计书 review',
  3: '模块并行开发',
  4: '代码 review',
  5: '验收',
};

export function createStatusCommand(): Command {
  const cmd = new Command('status');

  cmd
    .description('Show current project progress overview')
    .action(() => {
      const cwd = process.cwd();
      const manager = new ProgressManager();
      let progress: ProjectProgress;

      try {
        progress = manager.read(cwd);
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
  const phaseName = PHASE_NAMES[progress.currentPhase] ?? 'unknown';

  console.log('');
  console.log(chalk.bold(progress.projectName));
  console.log(chalk.dim('─'.repeat(40)));
  console.log(`Phase ${progress.currentPhase}: ${phaseName}`);
  console.log('');

  // Requirements
  if (progress.requirements.length > 0) {
    console.log(chalk.bold('Requirements'));
    for (const req of progress.requirements) {
      const icon = req.status === 'done' ? chalk.green('✓') : chalk.dim('○');
      console.log(`  ${icon} ${req.name}`);
    }
    console.log('');
  }

  // Design
  if (progress.design.modules.length > 0) {
    console.log(chalk.bold('Design Modules'));
    for (const mod of progress.design.modules) {
      const icon = mod.status === 'done' ? chalk.green('✓') : chalk.dim('○');
      console.log(`  ${icon} ${mod.name}`);
    }
    const reviewIcon = progress.design.reviewPassed ? chalk.green('✓') : chalk.dim('○');
    console.log(`  ${reviewIcon} design review`);
    console.log('');
  }

  // Runtime modules
  if (progress.modules.length > 0) {
    console.log(chalk.bold('Modules'));
    for (const mod of progress.modules) {
      let icon: string;
      switch (mod.status) {
        case 'done':    icon = chalk.green('✓'); break;
        case 'running': icon = chalk.cyan('↗');  break;
        case 'failed':  icon = chalk.red('✗');   break;
        case 'blocked': icon = chalk.yellow('⊘'); break;
        default:        icon = chalk.dim('○');
      }
      const suffix =
        mod.status === 'blocked' && mod.blockedBy
          ? chalk.dim(` (blocked by ${mod.blockedBy})`)
          : '';
      console.log(`  ${icon} ${mod.name}${suffix}`);
    }
    console.log('');
  }

  // Blockers
  if (progress.blockers.length > 0) {
    console.log(chalk.red.bold('Blockers'));
    for (const b of progress.blockers) {
      console.log(`  ${chalk.red('!')} ${b}`);
    }
    console.log('');
  }

  const codeReviewIcon = progress.codeReviewPassed ? chalk.green('✓') : chalk.dim('○');
  console.log(`${codeReviewIcon} code review`);
  console.log('');
}
