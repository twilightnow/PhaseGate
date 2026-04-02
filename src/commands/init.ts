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
    .description('Initialize PhaseGate in the current directory')
    .action(async () => {
      const cwd = process.cwd();
      const projectName = path.basename(cwd);
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

      const requirementsTemplate = [
        '# {feature-name}',
        '',
        '## Description',
        'Briefly describe the feature and its purpose.',
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

      console.log(chalk.green('✓') + ` PhaseGate initialized for "${projectName}"\n`);
      console.log(
        `  ${chalk.cyan('.phasegate/requirements/')}  requirements documents (template included)`
      );
      console.log(
        `  ${chalk.cyan('.phasegate/design/')}        module design documents (generated in Phase 1)`
      );
      console.log(
        `  ${chalk.cyan('.phasegate/contracts/')}     interface contracts (generated in Phase 1)`
      );
      console.log(`  ${chalk.cyan('.phasegate/progress.json')}  project state (source of truth)`);
      console.log(`  ${chalk.cyan('.phasegate/progress.md')}    project progress (human-readable)`);
      console.log(`  ${chalk.cyan('.phasegate/phasegate.config.json')}  configuration\n`);
      console.log(`Next step: ${chalk.bold('phasegate chat')} to start requirements discussion`);
    });

  return cmd;
}
