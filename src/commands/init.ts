import { Command } from 'commander';
import * as path from 'path';
import * as fse from 'fs-extra';
import chalk from 'chalk';
import { ProgressManager } from '../core/progress-manager';
import { detectLocale } from '../core/phase-gate';
import type { ProjectProgress } from '../types';

const DEFAULT_CONFIG = {
  maxLinesPerFile: 500,
  minTestCoverage: 80,
  runner: 'codex',
  aiProfiles: {
    default: { adapter: 'codex' },
    architect: { adapter: 'codex' },
    reviewer: { adapter: 'codex' },
    implementer: { adapter: 'codex' },
  },
  aiRouting: {
    default: 'default',
    chat: 'architect',
    phase1: 'architect',
    phase2: 'reviewer',
    'phase3.coordinator': 'architect',
    'phase3.worker': 'implementer',
    phase4: 'reviewer',
    phase5: 'reviewer',
  },
};

function buildRequirementsTemplate(locale: string): string {
  if (locale === 'zh') {
    return [
      '# {功能名称}',
      '',
      '## 描述',
      '简要描述该功能及其目标。',
      '',
      '## 范围',
      '包含：...',
      '不包含：...',
      '',
      '## 用户故事',
      '- 作为{用户}，我希望{操作}，以便{收益}',
      '',
      '## 边界情况',
      '| 场景 | 处理方式 |',
      '|---|---|',
      '| ... | ... |',
      '',
      '## 验收标准',
      '- [ ] 标准',
      '',
      '## 约束',
      '- 技术：...',
      '- 性能：...',
    ].join('\n');
  }

  if (locale === 'ja') {
    return [
      '# {機能名}',
      '',
      '## 説明',
      '機能とその目的を簡潔に説明してください。',
      '',
      '## スコープ',
      '含む: ...',
      '含まない: ...',
      '',
      '## ユーザーストーリー',
      '- {ユーザー}として、{操作}したい。そうすることで{利益}を得られる。',
      '',
      '## エッジケース',
      '| シナリオ | 対応方法 |',
      '|---|---|',
      '| ... | ... |',
      '',
      '## 受入基準',
      '- [ ] 基準',
      '',
      '## 制約',
      '- 技術: ...',
      '- 性能: ...',
    ].join('\n');
  }

  return [
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
}

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
      await fse.ensureDir(path.join(pgDir, 'tasks'));
      await fse.ensureDir(path.join(pgDir, 'contracts'));

      const requirementsTemplate = buildRequirementsTemplate(detectLocale());
      await fse.writeFile(path.join(pgDir, 'requirements', 'requirements.md'), requirementsTemplate, 'utf-8');

      const initialProgress: ProjectProgress = {
        projectName,
        locale: detectLocale(),
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

      await fse.writeJson(path.join(pgDir, 'phasegate.config.json'), DEFAULT_CONFIG, { spaces: 2 });

      console.log(chalk.green('OK') + ` PhaseGate initialized for "${projectName}"\n`);
      console.log(`  ${chalk.cyan('.phasegate/requirements/')}  requirements documents (template included)`);
      console.log(`  ${chalk.cyan('.phasegate/tasks/')}         task documents (generated in Phase 1)`);
      console.log(`  ${chalk.cyan('.phasegate/contracts/')}     interface contracts (generated in Phase 1)`);
      console.log(`  ${chalk.cyan('.phasegate/progress.json')}  project state (source of truth)`);
      console.log(`  ${chalk.cyan('.phasegate/progress.md')}    project progress (human-readable)`);
      console.log(`  ${chalk.cyan('.phasegate/phasegate.config.json')}  configuration\n`);
      console.log(`Next step: ${chalk.bold('phasegate chat')} to start requirements discussion`);
    });

  return cmd;
}
