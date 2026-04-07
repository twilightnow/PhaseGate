/**
 * Tests for the streaming extension of CliRunner.run()
 *
 * Strategy: mock child_process.spawn to return a fake EventEmitter-based proc,
 * then verify that onEvent callbacks are called with the right shapes.
 */

import { EventEmitter } from 'events';
import { Writable } from 'stream';

// ---- Mock child_process.spawn BEFORE importing ai-runner ----
const mockSpawn = jest.fn();
jest.mock('child_process', () => ({ spawn: mockSpawn }));

// ---- Mock fs-extra so buildContextPrompt works without real files ----
jest.mock('fs-extra', () => ({
  pathExists: jest.fn().mockResolvedValue(false),
  readFile: jest.fn().mockResolvedValue(''),
  readJson: jest.fn().mockResolvedValue({}),
}));

import { CliRunner } from '../ai-runner';
import type { RunEvent } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface FakeProc extends EventEmitter {
  stdin: Writable;
  stdout: EventEmitter;
  stderr: EventEmitter;
}

/** Build a minimal fake proc that behaves like a ChildProcess */
function makeFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc;
  proc.stdin = new Writable({ write(_c, _e, cb) { cb(); } });
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

/** Emit newline-delimited JSON lines then close the proc */
function emitLines(proc: FakeProc, lines: unknown[], exitCode = 0): void {
  setImmediate(() => {
    for (const line of lines) {
      proc.stdout.emit('data', Buffer.from(JSON.stringify(line) + '\n'));
    }
    proc.emit('close', exitCode);
  });
}

// RUNNER_DEFINITIONS is internal, so we build CliRunner instances directly via
// the exported factory helpers.  We test with the claude command by monkeypatching
// the definition command.

// Access the private definition field via casting.
function claudeRunner(): CliRunner {
  // ClaudeRunner isn't exported so we reconstruct a CliRunner with claude definition.
  // The simplest way: import createRunner and override config — but that reads disk.
  // Instead, we cast to `any` to pass a synthetic definition with command='claude'.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (CliRunner as any)({
    command: 'claude',
    buildRunArgs: () => ['--print'],
    useStdinForPrompt: true,
    buildChatArgs: () => [],
  });
}

function geminiRunner(): CliRunner {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new (CliRunner as any)({
    command: 'gemini',
    buildRunArgs: (p: string) => ['-p', p],
    buildChatArgs: () => [],
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockSpawn.mockReset();
});

// 1. onEvent absent → existing spawnCli path, no streaming
describe('run() without onEvent', () => {
  it('calls spawnCli (non-streaming) and returns trimmed stdout', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = claudeRunner();
    const resultPromise = runner.run([], 'hello');

    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from('  result text  '));
      proc.emit('close', 0);
    });

    const result = await resultPromise;
    expect(result).toBe('result text');

    // Should NOT have used stream-json flag
    const [, args] = mockSpawn.mock.calls[0];
    expect(args).not.toContain('stream-json');
  });
});

// 2. onEvent present, Claude runner → spawnCliStreaming path
describe('run() with onEvent, Claude runner', () => {
  it('emits tool_use events for Write and Edit with file_path', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (e) => events.push(e));

    emitLines(proc, [
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'Write', input: { file_path: 'src/foo.ts', content: '...' } },
            { type: 'tool_use', name: 'Edit', input: { file_path: 'src/bar.ts' } },
          ],
        },
      },
      { type: 'result', subtype: 'success', result: 'done text', usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0.001 } },
    ]);

    await resultPromise;

    const toolEvents = events.filter((e) => e.type === 'tool_use');
    expect(toolEvents).toHaveLength(2);
    expect(toolEvents[0]).toEqual({ type: 'tool_use', name: 'Write', input: 'src/foo.ts' });
    expect(toolEvents[1]).toEqual({ type: 'tool_use', name: 'Edit', input: 'src/bar.ts' });
  });

  it('emits tool_use for Bash with truncated command (≤60 chars)', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (e) => events.push(e));

    const longCmd = 'npm run build && npm run test && npm run lint && extra stuff here';
    emitLines(proc, [
      {
        type: 'assistant',
        message: { content: [{ type: 'tool_use', name: 'Bash', input: { command: longCmd } }] },
      },
      { type: 'result', result: '' },
    ]);

    await resultPromise;

    const bashEvent = events.find((e) => e.type === 'tool_use' && e.name === 'Bash');
    expect(bashEvent).toBeDefined();
    expect((bashEvent as { input?: string }).input).toHaveLength(60);
  });

  it('emits tool_use for TodoWrite and Task without input field', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (e) => events.push(e));

    emitLines(proc, [
      {
        type: 'assistant',
        message: {
          content: [
            { type: 'tool_use', name: 'TodoWrite', input: { todos: [] } },
            { type: 'tool_use', name: 'Task', input: { description: 'something' } },
          ],
        },
      },
      { type: 'result', result: '' },
    ]);

    await resultPromise;

    const todoEvent = events.find((e) => e.type === 'tool_use' && e.name === 'TodoWrite');
    expect(todoEvent).not.toHaveProperty('input');
    const taskEvent = events.find((e) => e.type === 'tool_use' && e.name === 'Task');
    expect(taskEvent).not.toHaveProperty('input');
  });

  it('emits ResultEvent with usage when usage is present', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (e) => events.push(e));

    emitLines(proc, [
      { type: 'result', result: 'final answer', usage: { input_tokens: 100, output_tokens: 50, cost_usd: 0.002 } },
    ]);

    const result = await resultPromise;
    expect(result).toBe('final answer');

    const resultEvent = events.find((e) => e.type === 'result');
    expect(resultEvent).toEqual({
      type: 'result',
      usage: { input_tokens: 100, output_tokens: 50, cost_usd: 0.002 },
    });
  });

  it('emits ResultEvent without usage when usage field is absent', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (e) => events.push(e));

    emitLines(proc, [{ type: 'result', result: '' }]);

    await resultPromise;

    const resultEvent = events.find((e) => e.type === 'result');
    expect(resultEvent).toEqual({ type: 'result' });
    expect(resultEvent).not.toHaveProperty('usage');
  });

  it('uses --output-format stream-json flag', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', () => {});

    emitLines(proc, [{ type: 'result', result: '' }]);
    await resultPromise;

    const [, args] = mockSpawn.mock.calls[0];
    expect(args).toContain('--output-format');
    expect(args).toContain('stream-json');
  });

  it('returns empty string when result field is absent', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', () => {});

    emitLines(proc, [{ type: 'result' }]);
    const result = await resultPromise;
    expect(result).toBe('');
  });

  it('rejects when process exits with non-zero code', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', () => {});

    setImmediate(() => {
      proc.stderr.emit('data', Buffer.from('some error'));
      proc.emit('close', 1);
    });

    await expect(resultPromise).rejects.toThrow('exited with code 1');
  });
});

// 3. onEvent present, Gemini/Codex runner → silent degradation
describe('run() with onEvent, non-Claude runner', () => {
  it('ignores onEvent and calls existing spawnCli path for Gemini', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = geminiRunner();
    const resultPromise = runner.run([], 'task', (e) => events.push(e));

    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from('gemini output'));
      proc.emit('close', 0);
    });

    const result = await resultPromise;
    expect(result).toBe('gemini output');

    // onEvent should never have been called
    expect(events).toHaveLength(0);

    // Should NOT have used stream-json flag
    const [, args] = mockSpawn.mock.calls[0];
    expect(args).not.toContain('stream-json');
  });
});

// 4. Malformed JSON lines → skipped, subsequent valid lines still processed
describe('malformed JSON handling', () => {
  it('skips non-JSON lines and processes subsequent valid lines', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (e) => events.push(e));

    setImmediate(() => {
      // Mix of bad and good lines
      proc.stdout.emit('data', Buffer.from('not json\n'));
      proc.stdout.emit('data', Buffer.from('{broken\n'));
      proc.stdout.emit('data', Buffer.from(
        JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name: 'Write', input: { file_path: 'ok.ts' } }] } }) + '\n'
      ));
      proc.stdout.emit('data', Buffer.from(
        JSON.stringify({ type: 'result', result: 'done' }) + '\n'
      ));
      proc.emit('close', 0);
    });

    const result = await resultPromise;
    expect(result).toBe('done');
    expect(events.some((e) => e.type === 'tool_use' && e.name === 'Write')).toBe(true);
  });

  it('processes the final buffered JSON line without a trailing newline', async () => {
    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const events: RunEvent[] = [];
    const runner = claudeRunner();
    const resultPromise = runner.run([], 'task', (e) => events.push(e));

    setImmediate(() => {
      proc.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', result: 'done without newline' })));
      proc.emit('close', 0);
    });

    const result = await resultPromise;
    expect(result).toBe('done without newline');
    expect(events).toContainEqual({ type: 'result' });
  });
});
