import { spawn } from 'child_process';
import * as path from 'path';
import * as fse from 'fs-extra';
import type { WorkerReport } from '../types';

export interface IAiRunner {
  run(files: string[], prompt: string): Promise<string>;
  fork(files: string[], prompt: string): Promise<WorkerReport>;
  chat(systemPrompt: string): Promise<void>;
}

type RunnerName = 'claude' | 'gemini' | 'codex';

interface RunnerConfig {
  runner?: string;
}

interface RunnerDefinition {
  command: string;
  buildRunArgs: (prompt: string) => string[];
  buildChatArgs: (systemPrompt: string) => string[];
}

const RUNNER_DEFINITIONS: Record<RunnerName, RunnerDefinition> = {
  claude: {
    command: 'claude',
    buildRunArgs: (prompt) => ['-p', prompt],
    buildChatArgs: (systemPrompt) => (systemPrompt ? ['--append-system-prompt', systemPrompt] : []),
  },
  gemini: {
    command: 'gemini',
    buildRunArgs: (prompt) => ['-p', prompt],
    buildChatArgs: (systemPrompt) => (systemPrompt ? ['-i', systemPrompt] : []),
  },
  codex: {
    command: 'codex',
    buildRunArgs: (prompt) => ['exec', prompt],
    buildChatArgs: (systemPrompt) => (systemPrompt ? [systemPrompt] : []),
  },
};

const RUNNER_ALIASES: Record<string, RunnerName> = {
  claude: 'claude',
  gemini: 'gemini',
  codex: 'codex',
  openai: 'codex',
  chatgpt: 'codex',
};

export class CliRunner implements IAiRunner {
  constructor(private readonly definition: RunnerDefinition) {}

  async run(files: string[], prompt: string): Promise<string> {
    const fullPrompt = await buildContextPrompt(files, prompt);
    return spawnCli(this.definition.command, this.definition.buildRunArgs(fullPrompt));
  }

  async fork(files: string[], prompt: string): Promise<WorkerReport> {
    const fullPrompt = await buildContextPrompt(files, prompt);
    const output = await spawnCli(this.definition.command, this.definition.buildRunArgs(fullPrompt));
    return parseWorkerReport(output);
  }

  async chat(systemPrompt: string): Promise<void> {
    await spawnCliInteractive(
      this.definition.command,
      this.definition.buildChatArgs(systemPrompt)
    );
  }
}

export class ClaudeRunner extends CliRunner {
  constructor() {
    super(RUNNER_DEFINITIONS.claude);
  }
}

export async function createRunner(projectRoot: string = process.cwd()): Promise<IAiRunner> {
  const runnerName = await loadRunnerName(projectRoot);
  return new CliRunner(RUNNER_DEFINITIONS[runnerName]);
}

async function buildContextPrompt(files: string[], prompt: string): Promise<string> {
  const parts: string[] = [];
  for (const filePath of files) {
    if (await fse.pathExists(filePath)) {
      const content = await fse.readFile(filePath, 'utf-8');
      parts.push(`--- FILE: ${path.basename(filePath)} ---\n${content}`);
    }
  }

  if (parts.length > 0) {
    return parts.join('\n\n') + '\n\n--- TASK ---\n' + prompt;
  }

  return prompt;
}

async function loadRunnerName(projectRoot: string): Promise<RunnerName> {
  const configPaths = [
    path.join(projectRoot, '.phasegate', 'phasegate.config.json'),
    path.join(projectRoot, 'phasegate.config.json'),
  ];

  for (const configPath of configPaths) {
    if (!(await fse.pathExists(configPath))) continue;

    const config = (await fse.readJson(configPath)) as RunnerConfig;
    const rawRunner = config.runner?.toLowerCase().trim();
    if (!rawRunner) continue;

    const resolvedRunner = RUNNER_ALIASES[rawRunner];
    if (!resolvedRunner) {
      throw new Error(
        `Unsupported runner "${config.runner}" in ${configPath}. Supported values: ${Object.keys(RUNNER_DEFINITIONS).join(', ')}`
      );
    }

    return resolvedRunner;
  }

  return 'claude';
}

function spawnCli(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });
    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}\n${stderr}`));
        return;
      }

      resolve(stdout.trim());
    });

    proc.on('error', (err) => reject(err));
  });
}

function spawnCliInteractive(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}`));
        return;
      }

      resolve();
    });

    proc.on('error', reject);
  });
}

export function parseWorkerReport(output: string): WorkerReport {
  const scope = extractSection(output, 'Scope') || 'unknown module';
  const resultText = extractSection(output, 'Result') || '';
  const keyFiles = extractListSection(output, 'Key Files');
  const filesChanged = extractListSection(output, 'Files Changed');
  const issues = extractListSection(output, 'Issues');

  return {
    scope,
    result: resultText.toLowerCase().includes('done') ? 'done' : 'failed',
    keyFiles,
    filesChanged,
    issues,
  };
}

export function formatWorkerReport(report: WorkerReport): string {
  const listOrNone = (items: string[]) =>
    items.length > 0 ? items.map((f) => `- ${f}`).join('\n') : '(none)';

  return [
    '## Scope',
    report.scope,
    '',
    '## Result',
    report.result,
    '',
    '## Key Files',
    listOrNone(report.keyFiles),
    '',
    '## Files Changed',
    listOrNone(report.filesChanged),
    '',
    '## Issues',
    listOrNone(report.issues),
    '',
  ].join('\n');
}

function extractSection(content: string, section: string): string {
  const regex = new RegExp(`##\\s+${section}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractListSection(content: string, section: string): string[] {
  const text = extractSection(content, section);
  if (!text || text === '(none)') return [];

  return text
    .split('\n')
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.replace(/^-\s+/, '').trim());
}
