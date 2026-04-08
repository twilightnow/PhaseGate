import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fse from 'fs-extra';
import { createRunner, getRunnerAdapterName } from '../core/ai-runner';
import { ProgressManager } from '../core/progress-manager';
import { buildLocalLanguageInstruction, checkPhase0Gate, detectLocale } from '../core/phase-gate';

const PROMPTS_DIR = path.join(__dirname, '..', '..', 'prompts');

const KICKOFF_MESSAGE_BY_LOCALE: Record<string, string> = {
  zh: '\u8bf7\u5148\u68c0\u67e5\u5df2\u6709 requirements\uff0c\u907f\u514d\u91cd\u590d\u63d0\u95ee\uff0c\u7136\u540e\u76f4\u63a5\u7ee7\u7eed Phase 0 \u9700\u6c42\u8ba8\u8bba\u3002',
  ja: '\u65e2\u5b58\u306e requirements \u3092\u78ba\u8a8d\u3057\u3001\u91cd\u8907\u3092\u907f\u3051\u3066 Phase 0 \u306e\u8981\u4ef6\u8a0e\u8b70\u3092\u305d\u306e\u307e\u307e\u7d9a\u3051\u3066\u304f\u3060\u3055\u3044\u3002',
  en: 'Check any existing requirements first, avoid repeating recorded details, and continue the Phase 0 discussion directly.',
};
const STARTUP_CONTEXT_MAX_CHARS = 24000;

function getPhase0PromptFile(): string {
  return path.join(PROMPTS_DIR, 'phase0_requirements_en.md');
}

function getKickoffMessage(): string {
  const locale = detectLocale();
  return KICKOFF_MESSAGE_BY_LOCALE[locale] ?? KICKOFF_MESSAGE_BY_LOCALE.en;
}

async function collectStartupProjectContext(cwd: string): Promise<string> {
  const sections: string[] = [];
  let remaining = STARTUP_CONTEXT_MAX_CHARS;

  const pushSection = (title: string, content: string): void => {
    const trimmed = content.trim();
    if (!trimmed || remaining <= 0) return;

    const reserved = `## ${title}\n\n`;
    const available = remaining - reserved.length;
    if (available <= 0) return;

    const truncated = trimmed.length > available ? `${trimmed.slice(0, Math.max(0, available - 16))}\n\n[truncated]` : trimmed;
    sections.push(`${reserved}${truncated}`);
    remaining -= reserved.length + truncated.length + 2;
  };

  const requirementsDir = path.join(cwd, '.phasegate', 'requirements');
  if (await fse.pathExists(requirementsDir)) {
    const requirementFiles = (await fse.readdir(requirementsDir))
      .filter((name) => name.toLowerCase().endsWith('.md'))
      .sort();

    if (requirementFiles.length > 0) {
      const parts: string[] = [];
      for (const fileName of requirementFiles) {
        const filePath = path.join(requirementsDir, fileName);
        const content = await fse.readFile(filePath, 'utf-8');
        parts.push(`### ${fileName}\n${content.trim()}`);
      }
      pushSection('Existing Requirements', parts.join('\n\n'));
    }
  }

  for (const readmeName of ['README.md', 'README']) {
    const readmePath = path.join(cwd, readmeName);
    if (await fse.pathExists(readmePath)) {
      pushSection(readmeName, await fse.readFile(readmePath, 'utf-8'));
      break;
    }
  }

  const packageJsonPath = path.join(cwd, 'package.json');
  if (await fse.pathExists(packageJsonPath)) {
    pushSection('package.json', await fse.readFile(packageJsonPath, 'utf-8'));
  }

  const srcPath = path.join(cwd, 'src');
  if (await fse.pathExists(srcPath)) {
    const entries = await fse.readdir(srcPath);
    if (entries.length > 0) {
      pushSection('Top-level src entries', entries.sort().map((entry) => `- ${entry}`).join('\n'));
    }
  }

  return sections.join('\n\n');
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

      const inlinePromptParts: string[] = [];
      if (!promptFileExists) {
        inlinePromptParts.push('You are facilitating a PhaseGate requirements discussion session.');
      }
      inlinePromptParts.push(buildLocalLanguageInstruction());
      if (options.feature) {
        inlinePromptParts.push(`Feature being discussed: ${options.feature}`);
      }

      const adapterName = await getRunnerAdapterName(cwd, 'chat');
      const kickoffMessage = getKickoffMessage();
      const startupProjectContext = await collectStartupProjectContext(cwd);
      const isCodex = adapterName === 'codex';
      if (startupProjectContext) {
        inlinePromptParts.push(
          [
            'Project context is provided below so you can continue the discussion without re-reading files at startup.',
            'Use this context first and avoid repeating details already captured there.',
            'Do not run shell or file-inspection commands unless the user explicitly asks or the provided context is insufficient.',
            '',
            startupProjectContext,
          ].join('\n')
        );
      }
      if (isCodex) {
        inlinePromptParts.push(
          [
            'This Phase 0 chat is strictly turn-based.',
            'Do not restate setup steps, file-loading actions, or other meta-process instructions unless the user explicitly asks.',
            'Use the provided project context instead of announcing or replaying startup file checks.',
            'Do not run shell or file-inspection commands at startup unless they are strictly necessary to answer the next user turn.',
            'Ask at most one user-facing discussion message per turn, then stop and wait for the user reply.',
            'After you ask a question, request confirmation, or present candidate acceptance criteria, end your turn immediately.',
            'Do not send a second assistant message unless the user has replied.',
            'Do not rephrase, revise, or repeat the previous discussion point on your own.',
            'Do not advance from one Phase 0 topic to the next until the current topic has been answered clearly by the user.',
            'Do not run phasegate commands on behalf of the user during this chat session.',
            'Do not expose tool calls, shell transcripts, or file-reading progress in user-facing messages.',
          ].join(' ')
        );
      }

      const inlinePrompt = inlinePromptParts.join('\n\n');

      console.log(chalk.cyan('->') + ' Starting requirements discussion session...');
      console.log(chalk.dim('(Exit the session when requirements are confirmed)'));
      console.log('');

      try {
        const runner = await createRunner(cwd, 'chat');
        await runner.chat(inlinePrompt, systemPromptFile, kickoffMessage);
      } catch (err) {
        console.error(chalk.red('Chat error:'), err instanceof Error ? err.message : err);
        process.exit(1);
      }

      console.log('');
      console.log(
        chalk.cyan('->') +
          ' Phase 0 session ended or was interrupted. Running gate check...'
      );

      const gate = await checkPhase0Gate(cwd, options.feature);

      if (!gate.passed) {
        console.error(chalk.red('Phase 0 gate failed:'));
        for (const issue of gate.issues) {
          console.error(`  ${chalk.yellow('!')} ${issue}`);
        }
        console.log('');
        console.log(
          'Requirements files were found, but Phase 0 is still incomplete. Fix the issues above and run ' +
            chalk.bold('phasegate chat') +
            ' again.'
        );
        process.exit(1);
      }

      const pm = new ProgressManager();
      pm.approveRequirementDocs(cwd, options.feature);

      console.log(chalk.green('OK') + ' Gate passed.');
      console.log(chalk.green('OK') + ' Requirement documents approved and synced.');
      console.log(
        'Use ' +
          chalk.bold('phasegate select <requirement>') +
          ' or ' +
          chalk.bold('phasegate run --requirement <requirement>') +
          ' to start execution.'
      );
    });

  return cmd;
}
