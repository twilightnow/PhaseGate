import { Command } from 'commander';
import * as path from 'path';
import * as fse from 'fs-extra';
import chalk from 'chalk';
import { ProgressManager } from '../core/progress-manager';
import type { ProjectProgress } from '../types';

const DEFAULT_CONFIG = {
  maxLinesPerFile: 500,
  minTestCoverage: 80,
  runner: 'claude',
};

export function createInitCommand(): Command {
  const cmd = new Command('init');

  cmd
    .description('Initialize a new PhaseGate project in the current directory')
    .argument('[name]', 'project name (defaults to current directory name)')
    .action(async (nameArg: string | undefined) => {
      const cwd = process.cwd();
      const projectName = nameArg ?? path.basename(cwd);
      const pgDir = path.join(cwd, '.phasegate');
      const progressJsonPath = path.join(pgDir, 'progress.json');

      if (await fse.pathExists(progressJsonPath)) {
        console.error(
          chalk.red('Error:') +
          ' .phasegate/progress.json already exists. This directory may already be a PhaseGate project.'
        );
        process.exit(1);
      }

      await fse.ensureDir(path.join(pgDir, 'requirements'));
      await fse.ensureDir(path.join(pgDir, 'design'));
      await fse.ensureDir(path.join(pgDir, 'contracts'));

      // Seed requirements directory with a template file
      const requirementsTemplate = [
        '# {feature-name}',
        '',
        '## Description',
        '{一段话描述}',
        '',
        '## Scope',
        'IN: ...',
        'OUT: ...',
        '',
        '## User Stories',
        '- As {user}, I want {action} so that {benefit}',
        '',
        '## Edge Cases',
        '| Scenario | Handling |',
        '|---|---|',
        '| ... | ... |',
        '',
        '## Acceptance Criteria',
        '- [ ] criterion',
        '',
        '## Constraints',
        '- Tech: ...',
        '- Performance: ...',
      ].join('\n');
      await fse.writeFile(
        path.join(pgDir, 'requirements', 'requirements.md'),
        requirementsTemplate,
        'utf-8'
      );

      const initialProgress: ProjectProgress = {
        projectName,
        currentPhase: 0,
        requirements: [],
        design: {
          modules: [],
          contracts: [],
          reviewPassed: false,
        },
        modules: [],
        codeReviewPassed: false,
        blockers: [],
      };

      const manager = new ProgressManager();
      manager.write(cwd, initialProgress);

      await fse.writeJson(
        path.join(pgDir, 'phasegate.config.json'),
        DEFAULT_CONFIG,
        { spaces: 2 }
      );

      console.log(chalk.green('✓') + ` PhaseGate project "${projectName}" initialized\n`);
      console.log(`  ${chalk.cyan('.phasegate/requirements/')}  requirements documents (template included)`);
      console.log(`  ${chalk.cyan('.phasegate/design/')}        module design documents (auto-generated in Phase 1)`);
      console.log(`  ${chalk.cyan('.phasegate/contracts/')}     interface contracts (auto-generated in Phase 1)`);
      console.log(`  ${chalk.cyan('.phasegate/progress.json')}  project state (source of truth)`);
      console.log(`  ${chalk.cyan('.phasegate/progress.md')}    project progress (human-readable)`);
      console.log(`  ${chalk.cyan('.phasegate/phasegate.config.json')}  configuration\n`);
      console.log(`Next step: ${chalk.bold('phasegate chat')} — start requirements discussion`);
    });

  return cmd;
}

