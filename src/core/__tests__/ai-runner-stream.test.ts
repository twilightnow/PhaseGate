import { EventEmitter } from 'events';
import { Writable } from 'stream';

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({ spawn: mockSpawn }));

jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  pathExists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  readJson: jest.fn().mockResolvedValue({}),
  remove: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

import { CliRunner } from '../ai-runner';
import type { RunEvent } from '../../types';
import * as fse from 'fs-extra';

interface FakeProc extends EventEmitter {
  stdin: Writable;
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function makeFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc;
  proc.stdin = new Writable({ write(_chunk, _encoding, callback) { callback(); } });
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

function emitJsonLines(proc: FakeProc, lines: unknown[], exitCode = 0): void {
  setImmediate(() => {
    for (const line of lines) {
      proc.stdout.emit('data', Buffer.from(JSON.stringify(line) + '\n'));
    }
    proc.emit('close', exitCode);
  });
}

function claudeRunner(): CliRunner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (CliRunner as any)({
    command: 'claude',
    buildRunArgs: () => ['--print'],
    buildStreamingRunArgs: () => ['--output-format', 'stream-json', '--verbose', '--print'],
    useStdinForPrompt: true,
    buildChatArgs: () => [],
    capabilities: {
      runStreaming: 'event',
      forkStreaming: 'text',
      interactiveChat: true,
      structuredWorkerReport: true,
    },
  });
}

function geminiRunner(): CliRunner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (CliRunner as any)({
    command: 'gemini',
    buildRunArgs: (prompt: string) => ['-p', prompt],
    buildChatArgs: () => [],
    capabilities: {
      runStreaming: 'none',
      forkStreaming: 'none',
      interactiveChat: true,
      structuredWorkerReport: false,
    },
  });
}

function codexRunner(): CliRunner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (CliRunner as any)({
    command: 'codex',
    buildRunArgs: () => [
      'exec',
      '-c',
      'approvals_reviewer="user"',
      '-c',
      'windows.sandbox="unelevated"',
      '--skip-git-repo-check',
      '-s',
      'workspace-write',
      '-',
    ],
    buildStreamingRunArgs: () => [
      'exec',
      '-c',
      'approvals_reviewer="user"',
      '-c',
      'windows.sandbox="unelevated"',
      '--skip-git-repo-check',
      '-s',
      'workspace-write',
      '--json',
      '-',
    ],
    useStdinForPrompt: true,
    buildChatArgs: (systemPrompt: string) => [
      '-c',
      'approvals_reviewer="user"',
      '-c',
      'windows.sandbox="unelevated"',
      '-s',
      'workspace-write',
      ...(systemPrompt ? [systemPrompt] : []),
    ],
    capabilities: {
      runStreaming: 'event',
      forkStreaming: 'event',
      interactiveChat: true,
      structuredWorkerReport: true,
    },
  });
}

beforeEach(() => {
  mockSpawn.mockReset();
  jest.clearAllMocks();
});

describe('run() without hooks', () => {
  it('uses the plain CLI path and returns trimmed stdout', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = claudeRunner();
    const resultPromise = runner.run([], 'hello');

    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from('  result text  '));
      proc.emit('close', 0);
    });

    await expect(resultPromise).resolves.toBe('result text');
    const [, args] = mockSpawn.mock.calls[0];
    expect(args).not.toContain('stream-json');
  });
});

describe('run() with Claude event streaming', () => {
  it('emits tool_use events and final usage', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (event) => events.push(event));

    emitJsonLines(proc, [
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Write', input: { file_path: 'src/foo.ts' } },
            { type: 'tool_use', name: 'Bash', input: { command: 'npm test -- --runInBand' } },
          ],
        },
      },
      { type: 'result', result: 'done text', usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0.001 } },
    ]);

    await expect(resultPromise).resolves.toBe('done text');
    expect(events).toEqual([
      { type: 'tool_use', name: 'Write', input: 'src/foo.ts' },
      { type: 'tool_use', name: 'Bash', input: 'npm test -- --runInBand' },
      { type: 'result', usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0.001 } },
    ]);

    const [, args] = mockSpawn.mock.calls[0];
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
  });

  it('skips malformed JSON and still handles the final buffered line', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (event) => events.push(event));

    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from('not json\n'));
      proc.stdout.emit('data', Buffer.from(JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Edit', input: { file_path: 'src/bar.ts' } }] },
      }) + '\n'));
      proc.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', result: 'done without newline' })));
      proc.emit('close', 0);
    });

    await expect(resultPromise).resolves.toBe('done without newline');
    expect(events).toContainEqual({ type: 'tool_use', name: 'Edit', input: 'src/bar.ts' });
    expect(events).toContainEqual({ type: 'result' });
  });
});

describe('run() with non-Claude adapters', () => {
  it('keeps plain CLI behaviour for runners without streaming support', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = geminiRunner();
    const resultPromise = runner.run([], 'task', (event) => events.push(event));

    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from('gemini output'));
      proc.emit('close', 0);
    });

    await expect(resultPromise).resolves.toBe('gemini output');
    expect(events).toHaveLength(0);
    const [, args] = mockSpawn.mock.calls[0];
    expect(args).not.toContain('stream-json');
  });

  it('streams Codex JSON events, including command and file changes', async () => {
    const proc = makeFakeProc();
    const stdinWrite = jest.spyOn(proc.stdin, 'write');
    const stdinEnd = jest.spyOn(proc.stdin, 'end');
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = codexRunner();
    const resultPromise = runner.run([], 'multi\nline\nprompt', (event) => events.push(event));

    emitJsonLines(proc, [
      {
        type: 'item.started',
        item: { id: 'item_0', type: 'command_execution', command: 'npm test', status: 'in_progress' },
      },
      {
        type: 'item.started',
        item: {
          id: 'item_1',
          type: 'file_change',
          changes: [{ path: 'C:\\repo\\src\\foo.ts', kind: 'add' }],
          status: 'in_progress',
        },
      },
      {
        type: 'item.completed',
        item: { id: 'item_2', type: 'agent_message', text: 'codex output' },
      },
      {
        type: 'turn.completed',
        usage: { input_tokens: 11, output_tokens: 7 },
      },
    ]);

    await expect(resultPromise).resolves.toBe('codex output');
    expect(events).toEqual([
      { type: 'tool_use', name: 'Bash', input: 'npm test' },
      { type: 'tool_use', name: 'Write', input: 'C:\\repo\\src\\foo.ts' },
      { type: 'result', usage: { input_tokens: 11, output_tokens: 7 } },
    ]);

    const [command, args] = mockSpawn.mock.calls[0];
    expect(command).toBe('codex');
    expect(args).toEqual([
      'exec',
      '-c',
      'approvals_reviewer="user"',
      '-c',
      'windows.sandbox="unelevated"',
      '--skip-git-repo-check',
      '-s',
      'workspace-write',
      '--json',
      '-',
    ]);
    expect(stdinWrite).toHaveBeenCalledWith('multi\nline\nprompt');
    expect(stdinEnd).toHaveBeenCalled();
  });
});

describe('fork() streaming behaviour', () => {
  it('streams plain text for Claude fork and still parses the final worker report', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = claudeRunner();
    const textLines: string[] = [];
    const forkPromise = runner.fork([], 'task', { onText: (line) => textLines.push(line) });

    setImmediate(() => {
      proc.stdout.emit(
        'data',
        Buffer.from(
          '## Scope\nmodule-a - scope\n\n## Result\ndone\n\n## Key Files\n- src/a.ts\n\n## Files Changed\n- src/a.ts\n\n## Issues\n(none)\n'
        )
      );
      proc.emit('close', 0);
    });

    await expect(forkPromise).resolves.toEqual({
      scope: 'module-a - scope',
      result: 'done',
      keyFiles: ['src/a.ts'],
      filesChanged: ['src/a.ts'],
      issues: [],
    });
    expect(textLines.some((line) => line.includes('## Scope'))).toBe(true);
  });

  it('streams Codex JSON events during fork and parses the final worker report', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = codexRunner();
    const forkPromise = runner.fork([], 'task', { onEvent: (event) => events.push(event) });

    emitJsonLines(proc, [
      {
        type: 'item.started',
        item: { id: 'item_0', type: 'command_execution', command: 'npm test', status: 'in_progress' },
      },
      {
        type: 'item.completed',
        item: {
          id: 'item_1',
          type: 'agent_message',
          text: '## Scope\nmodule-b - scope\n\n## Result\ndone\n\n## Key Files\n- src/b.ts\n\n## Files Changed\n- src/b.ts\n\n## Issues\n(none)',
        },
      },
      {
        type: 'turn.completed',
        usage: { input_tokens: 21, output_tokens: 9 },
      },
    ]);

    await expect(forkPromise).resolves.toEqual({
      scope: 'module-b - scope',
      result: 'done',
      keyFiles: ['src/b.ts'],
      filesChanged: ['src/b.ts'],
      issues: [],
    });
    expect(events).toContainEqual({ type: 'tool_use', name: 'Bash', input: 'npm test' });
    expect(events).toContainEqual({ type: 'result', usage: { input_tokens: 21, output_tokens: 9 } });
  });
});

describe('chat() runner-specific behaviour', () => {
  it('passes Codex a short startup prompt and writes hidden instructions to a temp file', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const mockedPathExists = fse.pathExists as unknown as jest.Mock;
    const mockedReadFile = fse.readFile as unknown as jest.Mock;
    const mockedWriteFile = fse.writeFile as unknown as jest.Mock;
    const mockedRemove = fse.remove as unknown as jest.Mock;
    mockedPathExists.mockResolvedValue(true);
    mockedReadFile.mockResolvedValue('SYSTEM FILE CONTENT');

    const runner = codexRunner();
    const chatPromise = runner.chat('INLINE PROMPT', 'prompt.md', 'Check requirements first');

    setImmediate(() => {
      proc.emit('close', 0);
    });

    await chatPromise;

    const [command, args] = mockSpawn.mock.calls[0];
    expect(command).toBe(process.execPath);
    expect(mockedWriteFile).toHaveBeenCalledWith(
      expect.stringContaining('.phasegate'),
      'SYSTEM FILE CONTENT\n\nINLINE PROMPT',
      'utf-8'
    );
    expect(mockedWriteFile.mock.calls[0][0]).toEqual(
      expect.stringMatching(/\.codex-chat-instructions-\d+-\d+\.md$/)
    );
    expect(args).toEqual([
      expect.stringContaining('@openai\\codex\\bin\\codex.js'),
      '-c',
      'approvals_reviewer="user"',
      '-c',
      'windows.sandbox="unelevated"',
      '-s',
      'workspace-write',
      '-c',
      expect.stringMatching(/^model_instructions_file=/),
      'Check requirements first',
    ]);
    expect(mockedRemove).toHaveBeenCalledWith(expect.stringContaining('.phasegate'));
    expect(mockedRemove.mock.calls[0][0]).toEqual(
      expect.stringMatching(/\.codex-chat-instructions-\d+-\d+\.md$/)
    );
  });
});
