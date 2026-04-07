import { spawn } from 'child_process';
import * as path from 'path';
import * as fse from 'fs-extra';
import type { WorkerReport, RunEvent, ToolUseEvent, ResultEvent } from '../types';

export interface IAiRunner {
  run(files: string[], prompt: string, onEvent?: (event: RunEvent) => void): Promise<string>;
  fork(files: string[], prompt: string): Promise<WorkerReport>;
  chat(systemPrompt: string, systemPromptFile?: string, initialMessage?: string): Promise<void>;
}

export type AdapterName = 'claude-code' | 'codex';
export type RunnerScope =
  | 'default'
  | 'chat'
  | 'phase1'
  | 'phase2'
  | 'phase3.coordinator'
  | 'phase3.worker'
  | 'phase4'
  | 'phase5';

interface AiProfileConfig {
  adapter?: string;
  options?: Record<string, unknown>;
}

interface RoutingConfig {
  [scope: string]: string | undefined;
}

interface RunnerConfig {
  runner?: string;
  aiProfiles?: Record<string, AiProfileConfig>;
  aiRouting?: RoutingConfig;
}

interface RunnerDefinition {
  command: string;
  buildRunArgs: (prompt: string) => string[];
  buildChatArgs: (systemPrompt: string, systemPromptFile?: string, initialMessage?: string) => string[];
  /** When true, the prompt is sent via stdin and buildRunArgs must not include it */
  useStdinForPrompt?: boolean;
}

const CODEX_CONFIG_ARGS = [
  '-c',
  'approvals_reviewer="user"',
  '-c',
  'windows.sandbox="unelevated"',
];
const CODEX_SANDBOX_ARGS = ['-s', 'workspace-write'];

const ADAPTER_DEFINITIONS: Record<AdapterName, RunnerDefinition> = {
  'claude-code': {
    command: 'claude',
    // Prompt is piped via stdin to avoid multi-line shell-escaping issues on Windows
    buildRunArgs: () => ['--print'],
    useStdinForPrompt: true,
    buildChatArgs: (systemPrompt, systemPromptFile, initialMessage) => {
      const args: string[] = [];
      // Prefer file-based flag to avoid multi-line shell-escaping issues on Windows
      if (systemPromptFile) args.push('--append-system-prompt-file', systemPromptFile);
      if (systemPrompt) args.push('--append-system-prompt', systemPrompt);
      // Positional arg — Claude responds to this first, then enters interactive REPL
      if (initialMessage) args.push(initialMessage);
      return args;
    },
  },
  codex: {
    command: 'codex',
    // `codex exec` accepts `-` to read the prompt from stdin.
    buildRunArgs: () => [
      'exec',
      ...CODEX_CONFIG_ARGS,
      '--skip-git-repo-check',
      ...CODEX_SANDBOX_ARGS,
      '-',
    ],
    useStdinForPrompt: true,
    buildChatArgs: (systemPrompt) => [
      ...CODEX_CONFIG_ARGS,
      ...CODEX_SANDBOX_ARGS,
      ...(systemPrompt ? [systemPrompt] : []),
    ],
  },
};

const LEGACY_RUNNER_ALIASES: Record<string, AdapterName> = {
  claude: 'claude-code',
  'claude-code': 'claude-code',
  codex: 'codex',
  openai: 'codex',
  chatgpt: 'codex',
};

export class CliRunner implements IAiRunner {
  constructor(private readonly definition: RunnerDefinition) {}

  async run(files: string[], prompt: string, onEvent?: (event: RunEvent) => void): Promise<string> {
    const fullPrompt = await buildContextPrompt(files, prompt);
    if (onEvent && this.definition.command === 'claude') {
      return spawnCliStreaming(fullPrompt, onEvent);
    }
    const stdinContent = this.definition.useStdinForPrompt ? fullPrompt : undefined;
    return spawnCli(this.definition.command, this.definition.buildRunArgs(fullPrompt), stdinContent);
  }

  async fork(files: string[], prompt: string): Promise<WorkerReport> {
    const fullPrompt = await buildContextPrompt(files, prompt);
    const stdinContent = this.definition.useStdinForPrompt ? fullPrompt : undefined;
    const output = await spawnCli(this.definition.command, this.definition.buildRunArgs(fullPrompt), stdinContent);
    return parseWorkerReport(output);
  }

  async chat(systemPrompt: string, systemPromptFile?: string, initialMessage?: string): Promise<void> {
    if (this.definition.command === 'codex') {
      const startupPrompt = await buildCodexChatPrompt(systemPrompt, systemPromptFile, initialMessage);
      await spawnCliInteractive(
        this.definition.command,
        this.definition.buildChatArgs(startupPrompt)
      );
      return;
    }

    await spawnCliInteractive(
      this.definition.command,
      this.definition.buildChatArgs(systemPrompt, systemPromptFile, initialMessage)
    );
  }
}

export class ClaudeRunner extends CliRunner {
  constructor() {
    super(ADAPTER_DEFINITIONS['claude-code']);
  }
}

export async function createRunner(
  projectRoot: string = process.cwd(),
  scope: RunnerScope = 'default'
): Promise<IAiRunner> {
  const adapterName = await resolveAdapterName(projectRoot, scope);
  return new CliRunner(ADAPTER_DEFINITIONS[adapterName]);
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

async function resolveAdapterName(projectRoot: string, scope: RunnerScope): Promise<AdapterName> {
  const loadedConfig = await loadRunnerConfig(projectRoot);
  if (!loadedConfig) {
    return 'codex';
  }

  const { config, configPath } = loadedConfig;
  const adapterFromRouting = resolveAdapterFromRouting(config, scope, configPath);
  if (adapterFromRouting) {
    return adapterFromRouting;
  }

  const rawRunner = config.runner?.toLowerCase().trim();
  if (rawRunner) {
    const legacyAdapter = LEGACY_RUNNER_ALIASES[rawRunner];
    if (!legacyAdapter) {
      throw new Error(
        `Unsupported runner "${config.runner}" in ${configPath}. Supported legacy values: ${Object.keys(
          LEGACY_RUNNER_ALIASES
        ).join(', ')}`
      );
    }

    return legacyAdapter;
  }

  return 'codex';
}

async function loadRunnerConfig(
  projectRoot: string
): Promise<{ config: RunnerConfig; configPath: string } | undefined> {
  const configPaths = [
    path.join(projectRoot, '.phasegate', 'phasegate.config.json'),
    path.join(projectRoot, 'phasegate.config.json'),
  ];

  for (const configPath of configPaths) {
    if (!(await fse.pathExists(configPath))) continue;

    const config = (await fse.readJson(configPath)) as RunnerConfig;
    return { config, configPath };
  }

  return undefined;
}

function resolveAdapterFromRouting(
  config: RunnerConfig,
  scope: RunnerScope,
  configPath: string
): AdapterName | undefined {
  const routing = config.aiRouting;
  const profiles = config.aiProfiles;
  if (!routing && !profiles) {
    return undefined;
  }

  if (!routing || !profiles) {
    throw new Error(
      `Invalid AI routing config in ${configPath}. "aiProfiles" and "aiRouting" must be configured together.`
    );
  }

  const profileName = routing[scope] ?? routing['default'];
  if (!profileName) {
    return undefined;
  }

  const profile = profiles[profileName];
  if (!profile) {
    throw new Error(
      `Invalid AI routing config in ${configPath}. Route "${scope}" points to missing profile "${profileName}".`
    );
  }

  const rawAdapter = profile.adapter?.toLowerCase().trim();
  if (!rawAdapter) {
    throw new Error(
      `Invalid AI routing config in ${configPath}. Profile "${profileName}" must define an "adapter".`
    );
  }

  if (!isAdapterName(rawAdapter)) {
    throw new Error(
      `Unsupported adapter "${profile.adapter}" in ${configPath}. Supported adapters: ${Object.keys(
        ADAPTER_DEFINITIONS
      ).join(', ')}`
    );
  }

  return rawAdapter;
}

function isAdapterName(value: string): value is AdapterName {
  return value in ADAPTER_DEFINITIONS;
}

async function buildCodexChatPrompt(
  systemPrompt: string,
  systemPromptFile?: string,
  initialMessage?: string
): Promise<string> {
  const parts: string[] = [];

  if (systemPromptFile && (await fse.pathExists(systemPromptFile))) {
    const filePrompt = (await fse.readFile(systemPromptFile, 'utf-8')).trim();
    if (filePrompt) parts.push(filePrompt);
  }

  const inlinePrompt = systemPrompt.trim();
  if (inlinePrompt) parts.push(inlinePrompt);

  const kickoffMessage = initialMessage?.trim();
  if (kickoffMessage) {
    parts.push(['Start the session with this first user-facing message:', kickoffMessage].join('\n'));
  }

  return parts.join('\n\n');
}

function spawnCli(command: string, args: string[], stdinContent?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, {
      stdio: [stdinContent !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    if (stdinContent !== undefined && proc.stdin) {
      proc.stdin.write(stdinContent);
      proc.stdin.end();
    }

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

function spawnCliStreaming(prompt: string, onEvent: (event: RunEvent) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', ['--output-format', 'stream-json', '--verbose', '--print'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      shell: process.platform === 'win32',
      windowsHide: true,
    });

    if (proc.stdin) {
      proc.stdin.write(prompt);
      proc.stdin.end();
    }

    let buffer = '';
    let resultText = '';
    let stderr = '';
    let sawResult = false;

    const processStreamLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        return; // silently skip malformed JSON
      }

      if (!parsed || typeof parsed !== 'object') return;
      const obj = parsed as Record<string, unknown>;

      if (obj['type'] === 'assistant') {
        const message = obj['message'] as Record<string, unknown> | undefined;
        const content = message?.['content'];
        if (!Array.isArray(content)) return;

        for (const block of content) {
          if (!block || typeof block !== 'object') continue;
          const b = block as Record<string, unknown>;
          if (b['type'] !== 'tool_use' || typeof b['name'] !== 'string') continue;

          const toolName = b['name'];
          const inputObj = b['input'] as Record<string, unknown> | undefined;
          const event: ToolUseEvent = { type: 'tool_use', name: toolName };
          const extracted = extractToolInput(toolName, inputObj);
          if (extracted !== undefined) event.input = extracted;
          onEvent(event);
        }
      } else if (obj['type'] === 'result') {
        sawResult = true;
        const resultEvent: ResultEvent = { type: 'result' };
        const usage = obj['usage'];
        if (usage && typeof usage === 'object') {
          resultEvent.usage = usage as ResultEvent['usage'];
        }
        onEvent(resultEvent);
        resultText = typeof obj['result'] === 'string' ? obj['result'] : '';
      }
    };

    proc.stdout?.on('data', (data: Buffer) => {
      buffer += data.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        processStreamLine(line);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        if (sawResult) {
          processStreamLine(buffer);
          resolve(resultText);
          return;
        }
        reject(new Error(`claude exited with code ${code}\n${stderr}`));
        return;
      }
      processStreamLine(buffer);
      resolve(resultText);
    });

    proc.on('error', reject);
  });
}

function extractToolInput(name: string, input: Record<string, unknown> | undefined): string | undefined {
  if (!input) return undefined;
  switch (name) {
    case 'Write':
    case 'Edit':
      return typeof input['file_path'] === 'string' ? input['file_path'] : undefined;
    case 'Bash': {
      const cmd = typeof input['command'] === 'string' ? input['command'] : undefined;
      return cmd ? cmd.slice(0, 60) : undefined;
    }
    case 'TodoWrite':
    case 'Task':
      return undefined;
    default:
      return undefined;
  }
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
