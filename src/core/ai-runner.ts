import { spawn } from 'child_process';
import * as path from 'path';
import * as fse from 'fs-extra';
import type {
  WorkerReport,
  RunEvent,
  ToolUseEvent,
  ResultEvent,
  RunnerCapabilities,
} from '../types';

export interface RunHooks {
  onEvent?: (event: RunEvent) => void;
  onText?: (text: string) => void;
}

export interface IAiRunner {
  capabilities(): RunnerCapabilities;
  run(files: string[], prompt: string, hooks?: RunHooks | ((event: RunEvent) => void)): Promise<string>;
  fork(files: string[], prompt: string, hooks?: RunHooks): Promise<WorkerReport>;
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
  buildStreamingRunArgs?: (prompt: string) => string[];
  buildChatArgs: (systemPrompt: string, systemPromptFile?: string, initialMessage?: string) => string[];
  /** When true, the prompt is sent via stdin and buildRunArgs must not include it */
  useStdinForPrompt?: boolean;
  capabilities: RunnerCapabilities;
}

const CODEX_CONFIG_ARGS = [
  '-c',
  'approvals_reviewer="user"',
  '-c',
  'windows.sandbox="unelevated"',
];
const CODEX_SANDBOX_ARGS = ['-s', 'workspace-write'];
const CODEX_CHAT_INSTRUCTIONS_FILE_PREFIX = '.codex-chat-instructions';

const ADAPTER_DEFINITIONS: Record<AdapterName, RunnerDefinition> = {
  'claude-code': {
    command: 'claude',
    // Prompt is piped via stdin to avoid multi-line shell-escaping issues on Windows
    buildRunArgs: () => ['--print'],
    buildStreamingRunArgs: () => ['--output-format', 'stream-json', '--verbose', '--print'],
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
    capabilities: {
      runStreaming: 'event',
      forkStreaming: 'text',
      interactiveChat: true,
      structuredWorkerReport: true,
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
    buildStreamingRunArgs: () => [
      'exec',
      ...CODEX_CONFIG_ARGS,
      '--skip-git-repo-check',
      ...CODEX_SANDBOX_ARGS,
      '--json',
      '-',
    ],
    useStdinForPrompt: true,
    buildChatArgs: (systemPrompt) => [
      ...CODEX_CONFIG_ARGS,
      ...CODEX_SANDBOX_ARGS,
      ...(systemPrompt ? [systemPrompt] : []),
    ],
    capabilities: {
      runStreaming: 'event',
      forkStreaming: 'event',
      interactiveChat: true,
      structuredWorkerReport: true,
    },
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

  capabilities(): RunnerCapabilities {
    return this.definition.capabilities;
  }

  async run(files: string[], prompt: string, hooks?: RunHooks | ((event: RunEvent) => void)): Promise<string> {
    const fullPrompt = await buildContextPrompt(files, prompt);
    const normalizedHooks = normalizeHooks(hooks);

    if (normalizedHooks && this.definition.capabilities.runStreaming === 'event') {
      if (this.definition.command === 'claude') {
        return spawnClaudeStreaming(fullPrompt, normalizedHooks);
      }
      if (this.definition.command === 'codex') {
        return spawnCodexStreaming(
          this.definition.command,
          this.definition.buildStreamingRunArgs?.(fullPrompt) ?? this.definition.buildRunArgs(fullPrompt),
          this.definition.useStdinForPrompt ? fullPrompt : undefined,
          normalizedHooks
        );
      }
    }

    if (normalizedHooks?.onText && this.definition.capabilities.runStreaming === 'text') {
      const stdinContent = this.definition.useStdinForPrompt ? fullPrompt : undefined;
      return spawnCliTextStreaming(
        this.definition.command,
        this.definition.buildRunArgs(fullPrompt),
        stdinContent,
        normalizedHooks.onText
      );
    }

    const stdinContent = this.definition.useStdinForPrompt ? fullPrompt : undefined;
    return spawnCli(this.definition.command, this.definition.buildRunArgs(fullPrompt), stdinContent);
  }

  async fork(files: string[], prompt: string, hooks?: RunHooks): Promise<WorkerReport> {
    const fullPrompt = await buildContextPrompt(files, prompt);
    const stdinContent = this.definition.useStdinForPrompt ? fullPrompt : undefined;
    let output: string;

    if (hooks && this.definition.capabilities.forkStreaming === 'event' && this.definition.command === 'codex') {
      output = await spawnCodexStreaming(
        this.definition.command,
        this.definition.buildStreamingRunArgs?.(fullPrompt) ?? this.definition.buildRunArgs(fullPrompt),
        stdinContent,
        hooks
      );
    } else if (hooks?.onText && this.definition.capabilities.forkStreaming === 'text') {
      output = await spawnCliTextStreaming(
        this.definition.command,
        this.definition.buildRunArgs(fullPrompt),
        stdinContent,
        hooks.onText
      );
    } else {
      output = await spawnCli(this.definition.command, this.definition.buildRunArgs(fullPrompt), stdinContent);
    }

    return parseWorkerReport(output);
  }

  async chat(systemPrompt: string, systemPromptFile?: string, initialMessage?: string): Promise<void> {
    if (this.definition.command === 'codex') {
      const startupPrompt = await buildCodexChatPrompt(systemPrompt, systemPromptFile, initialMessage);
      const invocation = await prepareCodexChatInvocation(
        startupPrompt,
        systemPrompt,
        systemPromptFile
      );
      try {
        await spawnCliInteractive(this.definition.command, invocation.args);
      } finally {
        await invocation.cleanup();
      }
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

function normalizeHooks(hooks?: RunHooks | ((event: RunEvent) => void)): RunHooks | undefined {
  if (!hooks) return undefined;
  if (typeof hooks === 'function') {
    return { onEvent: hooks };
  }
  return hooks;
}

export async function getRunnerAdapterName(
  projectRoot: string = process.cwd(),
  scope: RunnerScope = 'default'
): Promise<AdapterName> {
  return resolveAdapterName(projectRoot, scope);
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

interface ResolvedCliInvocation {
  command: string;
  args: string[];
  shell: boolean;
}

async function resolveCliInvocation(
  command: string,
  args: string[]
): Promise<ResolvedCliInvocation> {
  if (process.platform === 'win32' && command === 'codex') {
    const codexScriptPath = path.join(
      path.dirname(process.execPath),
      'node_modules',
      '@openai',
      'codex',
      'bin',
      'codex.js'
    );

    if (await fse.pathExists(codexScriptPath)) {
      return {
        command: process.execPath,
        args: [codexScriptPath, ...args],
        shell: false,
      };
    }
  }

  return {
    command,
    args,
    shell: process.platform === 'win32',
  };
}

async function buildCodexChatPrompt(
  systemPrompt: string,
  systemPromptFile?: string,
  initialMessage?: string
): Promise<string> {
  void systemPrompt;
  void systemPromptFile;
  return initialMessage?.trim() ?? '';
}

async function buildCodexChatInstructions(
  systemPrompt: string,
  systemPromptFile?: string
): Promise<string> {
  const parts: string[] = [];

  if (systemPromptFile && (await fse.pathExists(systemPromptFile))) {
    const filePrompt = (await fse.readFile(systemPromptFile, 'utf-8')).trim();
    if (filePrompt) parts.push(filePrompt);
  }

  const inlinePrompt = systemPrompt.trim();
  if (inlinePrompt) parts.push(inlinePrompt);

  return parts.join('\n\n');
}

async function prepareCodexChatInvocation(
  startupPrompt: string,
  systemPrompt: string,
  systemPromptFile?: string
): Promise<{ args: string[]; cleanup: () => Promise<void> }> {
  const args = [...CODEX_CONFIG_ARGS, ...CODEX_SANDBOX_ARGS];
  const instructions = await buildCodexChatInstructions(systemPrompt, systemPromptFile);
  let cleanup = async (): Promise<void> => {};

  if (instructions) {
    const instructionsFileName = `${CODEX_CHAT_INSTRUCTIONS_FILE_PREFIX}-${process.pid}-${Date.now()}.md`;
    const instructionsFilePath = path.join(process.cwd(), '.phasegate', instructionsFileName);
    await fse.ensureDir(path.dirname(instructionsFilePath));
    await fse.writeFile(instructionsFilePath, instructions, 'utf-8');
    args.push('-c', `model_instructions_file=${JSON.stringify(instructionsFilePath)}`);
    cleanup = async (): Promise<void> => {
      await fse.remove(instructionsFilePath);
    };
  }

  if (startupPrompt) {
    args.push(startupPrompt);
  }

  return { args, cleanup };
}

function spawnCli(command: string, args: string[], stdinContent?: string): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const invocation = await resolveCliInvocation(command, args);

    const proc = spawn(invocation.command, invocation.args, {
      stdio: [stdinContent !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      shell: invocation.shell,
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

function spawnCliTextStreaming(
  command: string,
  args: string[],
  stdinContent: string | undefined,
  onText: (text: string) => void
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const invocation = await resolveCliInvocation(command, args);

    const proc = spawn(invocation.command, invocation.args, {
      stdio: [stdinContent !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      shell: invocation.shell,
      windowsHide: true,
    });

    if (stdinContent !== undefined && proc.stdin) {
      proc.stdin.write(stdinContent);
      proc.stdin.end();
    }

    let stdout = '';
    let stderr = '';
    let buffer = '';

    const flushLine = (line: string): void => {
      const trimmed = line.replace(/\r$/, '');
      if (trimmed.length > 0) {
        onText(trimmed);
      }
    };

    proc.stdout?.on('data', (data: Buffer) => {
      const chunk = data.toString();
      stdout += chunk;
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        flushLine(line);
      }
    });

    proc.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      if (buffer.length > 0) {
        flushLine(buffer);
      }
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
  return new Promise(async (resolve, reject) => {
    const invocation = await resolveCliInvocation(command, args);

    const proc = spawn(invocation.command, invocation.args, {
      stdio: 'inherit',
      shell: invocation.shell,
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

function spawnClaudeStreaming(prompt: string, hooks: RunHooks): Promise<string> {
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
          hooks.onEvent?.(event);
        }
      } else if (obj['type'] === 'result') {
        sawResult = true;
        const resultEvent: ResultEvent = { type: 'result' };
        const usage = obj['usage'];
        if (usage && typeof usage === 'object') {
          resultEvent.usage = usage as ResultEvent['usage'];
        }
        hooks.onEvent?.(resultEvent);
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

function spawnCodexStreaming(
  command: string,
  args: string[],
  stdinContent: string | undefined,
  hooks: RunHooks
): Promise<string> {
  return new Promise(async (resolve, reject) => {
    const invocation = await resolveCliInvocation(command, args);

    const proc = spawn(invocation.command, invocation.args, {
      stdio: [stdinContent !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
      shell: invocation.shell,
      windowsHide: true,
    });

    if (stdinContent !== undefined && proc.stdin) {
      proc.stdin.write(stdinContent);
      proc.stdin.end();
    }

    let stderr = '';
    let buffer = '';
    let finalMessage = '';

    const processStreamLine = (line: string): void => {
      const trimmed = line.trim();
      if (!trimmed) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(trimmed);
      } catch {
        hooks.onText?.(trimmed);
        return;
      }

      if (!parsed || typeof parsed !== 'object') return;
      const obj = parsed as Record<string, unknown>;
      const type = typeof obj['type'] === 'string' ? obj['type'] : '';

      if (type === 'item.started') {
        const item = obj['item'];
        if (!item || typeof item !== 'object') return;
        const itemRecord = item as Record<string, unknown>;
        emitCodexItemEvent(itemRecord, hooks);
        return;
      }

      if (type === 'item.completed') {
        const item = obj['item'];
        if (!item || typeof item !== 'object') return;
        const itemRecord = item as Record<string, unknown>;
        const itemType = typeof itemRecord['type'] === 'string' ? itemRecord['type'] : '';
        if (itemType === 'agent_message') {
          const text = typeof itemRecord['text'] === 'string' ? itemRecord['text'].trim() : '';
          if (text) {
            finalMessage = text;
          }
        } else if (itemType === 'file_change' && !hooks.onEvent && hooks.onText) {
          emitCodexItemText(itemRecord, hooks.onText);
        }
        return;
      }

      if (type === 'turn.completed') {
        const usage = obj['usage'];
        const resultEvent: ResultEvent = { type: 'result' };
        if (usage && typeof usage === 'object') {
          const usageRecord = usage as Record<string, unknown>;
          const inputTokens = numberValue(usageRecord['input_tokens']);
          const outputTokens = numberValue(usageRecord['output_tokens']);
          if (inputTokens !== undefined && outputTokens !== undefined) {
            resultEvent.usage = {
              input_tokens: inputTokens,
              output_tokens: outputTokens,
            };
          }
        }
        hooks.onEvent?.(resultEvent);
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
      if (buffer.length > 0) {
        processStreamLine(buffer);
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}\n${stderr}`));
        return;
      }

      resolve(finalMessage);
    });

    proc.on('error', (err) => reject(err));
  });
}

function emitCodexItemEvent(item: Record<string, unknown>, hooks: RunHooks): void {
  const itemType = typeof item['type'] === 'string' ? item['type'] : '';
  if (itemType === 'command_execution') {
    const commandText = typeof item['command'] === 'string' ? item['command'] : undefined;
    hooks.onEvent?.({
      type: 'tool_use',
      name: 'Bash',
      input: commandText ? commandText.slice(0, 60) : undefined,
    });
    if (!hooks.onEvent && hooks.onText && commandText) {
      hooks.onText(commandText);
    }
    return;
  }

  if (itemType === 'file_change') {
    const changes = Array.isArray(item['changes']) ? item['changes'] : [];
    for (const change of changes) {
      if (!change || typeof change !== 'object') continue;
      const record = change as Record<string, unknown>;
      const rawPath = typeof record['path'] === 'string' ? record['path'] : undefined;
      const kind = typeof record['kind'] === 'string' ? record['kind'] : 'edit';
      const displayPath = rawPath ? toDisplayPath(rawPath) : undefined;
      hooks.onEvent?.({
        type: 'tool_use',
        name: kind === 'add' ? 'Write' : 'Edit',
        input: displayPath,
      });
      if (!hooks.onEvent && hooks.onText && displayPath) {
        hooks.onText(`${kind} ${displayPath}`);
      }
    }
  }
}

function emitCodexItemText(item: Record<string, unknown>, onText: (text: string) => void): void {
  const changes = Array.isArray(item['changes']) ? item['changes'] : [];
  for (const change of changes) {
    if (!change || typeof change !== 'object') continue;
    const record = change as Record<string, unknown>;
    const rawPath = typeof record['path'] === 'string' ? record['path'] : undefined;
    const kind = typeof record['kind'] === 'string' ? record['kind'] : 'edit';
    if (rawPath) {
      onText(`${kind} ${toDisplayPath(rawPath)}`);
    }
  }
}

function toDisplayPath(rawPath: string): string {
  const relativePath = path.relative(process.cwd(), rawPath);
  if (!relativePath || relativePath.startsWith('..')) {
    return rawPath;
  }
  return relativePath;
}

function numberValue(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
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
