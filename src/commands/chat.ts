import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fse from 'fs-extra';
import { createRunner } from '../core/ai-runner';
import { ProgressManager } from '../core/progress-manager';
import { checkPhase0Gate, detectLocale } from '../core/phase-gate';

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');

const PROMPT_FILE_BY_LOCALE: Record<string, string> = {
  zh: 'phase0_requirements.md',
  ja: 'phase0_requirements_ja.md',
};

const INITIAL_MESSAGE_BY_LOCALE: Record<string, string> = {
  zh: '你好！我们开始 Phase 0 需求讨论吧。你想开发什么功能？',
  ja: 'こんにちは。Phase 0 の要件整理を始めましょう。どんな機能を作りたいですか？',
};

function getPhase0PromptFile(): string {
  const locale = detectLocale();
  const file = PROMPT_FILE_BY_LOCALE[locale] ?? 'phase0_requirements_en.md';
  return path.join(PROMPTS_DIR, file);
}

function getInitialMessage(): string {
  const locale = detectLocale();
  return (
    INITIAL_MESSAGE_BY_LOCALE[locale] ??
    "Hello! Let's start the Phase 0 requirements discussion. What feature would you like to build?"
  );
}

export function createChatCommand(): Command {
  const cmd = new Command('chat');

  cmd
    .description('Start requirements discussion session (Phase 0)')
    .option('--feature <name>', 'feature name for the output document')
    .action(async (options: { feature?: string }) => {
      const cwd = process.cwd();
      const progressPath = path.join(cwd, '.phasegate', 'progress.json');

      if (!(await fse.pathExists(progressPath))) {
        console.error(
          chalk.red('Error:') +
            ' .phasegate/progress.json not found. Run ' +
            chalk.bold('phasegate init') +
            ' first.'
        );
        process.exit(1);
      }

      const promptFile = getPhase0PromptFile();
      const promptFileExists = await fse.pathExists(promptFile);
      const systemPromptFile = promptFileExists ? promptFile : undefined;

      let inlinePrompt = '';
      if (!promptFileExists) {
        inlinePrompt = 'You are facilitating a PhaseGate requirements discussion session.';
      }
      if (options.feature) {
        inlinePrompt += (inlinePrompt ? '\n\n' : '') + `Feature being discussed: ${options.feature}`;
      }

      console.log(chalk.cyan('->') + ' Starting requirements discussion session...');
      console.log(chalk.dim('(Exit the session when requirements are confirmed)'));
      console.log('');

      try {
        const runner = await createRunner(cwd, 'chat');
        await runner.chat(inlinePrompt, systemPromptFile, getInitialMessage());
      } catch (err) {
        console.error(chalk.red('Chat error:'), err instanceof Error ? err.message : err);
        process.exit(1);
      }

      console.log('');
      console.log(chalk.cyan('->') + ' Session ended. Running Phase 0 Gate check...');

      const gate = await checkPhase0Gate(cwd);

      if (!gate.passed) {
        console.error(chalk.red('Gate failed:'));
        for (const issue of gate.issues) {
          console.error(`  ${chalk.yellow('!')} ${issue}`);
        }
        console.log('');
        console.log('Fix the issues above and run ' + chalk.bold('phasegate chat') + ' again.');
        process.exit(1);
      }

      const pm = new ProgressManager();
      pm.updatePhase(cwd, 1);

      console.log(chalk.green('OK') + ' Gate passed.');
      console.log(chalk.green('OK') + ' Phase advanced to 1 (Design Generation).');
      console.log('Run ' + chalk.bold('phasegate run') + ' to start Phase 1.');
    });

  return cmd;
}
