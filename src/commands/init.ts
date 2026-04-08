import { Command } from 'commander';
import * as path from 'path';
import * as fse from 'fs-extra';
import chalk from 'chalk';
import { createInterface } from 'node:readline/promises';
import { ProgressManager } from '../core/progress-manager';
import { detectLocale } from '../core/phase-gate';
import type { ProjectProgress } from '../types';
import type { AdapterName } from '../core/ai-runner';

const DEFAULT_ADAPTER: AdapterName = 'codex';

function createDefaultConfig(adapter: AdapterName) {
  return {
  maxLinesPerFile: 500,
  minTestCoverage: 80,
  runner: adapter === 'claude-code' ? 'claude' : 'codex',
  aiProfiles: {
    default: { adapter },
    architect: { adapter },
    reviewer: { adapter },
    implementer: { adapter },
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
}

function getAdapterDisplayName(adapter: AdapterName): string {
  return adapter === 'claude-code' ? 'Claude Code' : 'Codex';
}

function resolveAdapterOption(optionAdapter: string | undefined): AdapterName | undefined {
  const normalized = normalizeAdapterChoice(optionAdapter);
  if (normalized) {
    return normalized;
  }

  if (optionAdapter) {
    throw new Error(`Unsupported adapter "${optionAdapter}". Supported values: claude-code, codex.`);
  }

  return undefined;
}

function normalizeAdapterChoice(input: string | undefined): AdapterName | undefined {
  const normalized = input?.trim().toLowerCase();
  if (!normalized) return undefined;

  if (['1', 'claude', 'claude-code', 'claudecode'].includes(normalized)) {
    return 'claude-code';
  }

  if (['2', 'codex'].includes(normalized)) {
    return 'codex';
  }

  return undefined;
}

function getAdapterPrompt(locale: string): { question: string; invalid: string } {
  if (locale === 'zh') {
    return {
      question: `请选择默认 AI 适配器: [1] Claude Code  [2] Codex (默认 ${getAdapterDisplayName(
        DEFAULT_ADAPTER
      )}): `,
      invalid: '输入无效，请输入 1、2、claude 或 codex。',
    };
  }

  if (locale === 'ja') {
    return {
      question: `デフォルト AI アダプターを選択してください: [1] Claude Code  [2] Codex (既定 ${getAdapterDisplayName(
        DEFAULT_ADAPTER
      )}): `,
      invalid: '無効な入力です。1、2、claude、codex のいずれかを入力してください。',
    };
  }

  return {
    question: `Select the default AI adapter: [1] Claude Code  [2] Codex (default ${getAdapterDisplayName(
      DEFAULT_ADAPTER
    )}): `,
    invalid: 'Invalid input. Enter 1, 2, claude, or codex.',
  };
}

async function promptForDefaultAdapter(locale: string): Promise<AdapterName> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return DEFAULT_ADAPTER;
  }

  const prompt = getAdapterPrompt(locale);
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    while (true) {
      const answer = await rl.question(prompt.question);
      const selected = normalizeAdapterChoice(answer) ?? (answer.trim() === '' ? DEFAULT_ADAPTER : undefined);
      if (selected) {
        return selected;
      }

      console.log(chalk.yellow(prompt.invalid));
    }
  } finally {
    rl.close();
  }
}

export function createInitCommand(): Command {
  const cmd = new Command('init');

  cmd
    .description('Initialize PhaseGate in the current directory')
    .option('--adapter <adapter>', 'Default AI adapter: claude-code or codex')
    .action(async () => {
      try {
        const cwd = process.cwd();
        const projectName = path.basename(cwd);
        const pgDir = path.join(cwd, '.phasegate');
        const progressJsonPath = path.join(pgDir, 'progress.json');
        const locale = detectLocale();
        const optionAdapter = cmd.opts<{ adapter?: string }>().adapter;

        if (await fse.pathExists(progressJsonPath)) {
          console.error(
            chalk.red('Error:') +
              ' .phasegate/progress.json already exists. This directory may already be a PhaseGate project.'
          );
          process.exit(1);
        }

        const selectedAdapter = resolveAdapterOption(optionAdapter) ?? (await promptForDefaultAdapter(locale));

        await fse.ensureDir(path.join(pgDir, 'requirements'));
        await fse.ensureDir(path.join(pgDir, 'tasks'));
        await fse.ensureDir(path.join(pgDir, 'contracts'));
        await fse.ensureDir(path.join(pgDir, 'scratchpad'));
        await fse.ensureDir(path.join(pgDir, 'archive'));

        const initialProgress: ProjectProgress = {
          projectName,
          locale,
          currentPhase: 0,
          activeRequirement: null,
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

        await fse.writeJson(path.join(pgDir, 'phasegate.config.json'), createDefaultConfig(selectedAdapter), {
          spaces: 2,
        });

        console.log(chalk.green('OK') + ` PhaseGate initialized for "${projectName}"\n`);
        console.log(`  default AI adapter: ${chalk.cyan(getAdapterDisplayName(selectedAdapter))}`);
        console.log(`  ${chalk.cyan('.phasegate/requirements/')}  requirements documents (generated in Phase 0)`);
        console.log(`  ${chalk.cyan('.phasegate/tasks/')}         active execution task documents`);
        console.log(`  ${chalk.cyan('.phasegate/contracts/')}     active execution contracts`);
        console.log(`  ${chalk.cyan('.phasegate/scratchpad/')}    disposable run artifacts`);
        console.log(`  ${chalk.cyan('.phasegate/archive/')}       archived execution artifacts`);
        console.log(`  ${chalk.cyan('.phasegate/progress.json')}  project state (source of truth)`);
        console.log(`  ${chalk.cyan('.phasegate/phasegate.config.json')}  configuration\n`);
        console.log(
          `Config lives under ${chalk.cyan('.phasegate/')}. To change the default adapter or routing later, edit ${chalk.cyan(
            '.phasegate/phasegate.config.json'
          )}.\n`
        );
        console.log(`Next step: ${chalk.bold('phasegate chat')} to accumulate or refine requirements`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(chalk.red('Error:') + ` ${message}`);
        process.exit(1);
      }
    });

  return cmd;
}
