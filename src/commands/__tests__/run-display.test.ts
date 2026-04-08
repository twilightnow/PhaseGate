/**
 * Tests for runSinglePhase() display logic in commands/run.ts
 *
 * Strategy: inject a mock IAiRunner whose run() method calls onEvent with
 * pre-defined events, then capture stdout/console.log to verify output.
 */

import { runSinglePhase } from '../run';
import type { IAiRunner, RunHooks } from '../../core/ai-runner';
import type { RunEvent } from '../../types';

function makeRunner(events: RunEvent[], textLines: string[] = []): IAiRunner {
  return {
    capabilities: jest.fn(() => ({
      runStreaming: 'event',
      forkStreaming: 'text',
      interactiveChat: true,
      structuredWorkerReport: true,
    })),
    run: jest.fn(async (_files: string[], _prompt: string, hooks?: RunHooks | ((e: RunEvent) => void)) => {
      const normalizedHooks: RunHooks =
        typeof hooks === 'function' ? { onEvent: hooks } : hooks ?? {};

      if (normalizedHooks.onEvent) {
        for (const event of events) normalizedHooks.onEvent(event);
      }
      if (normalizedHooks.onText) {
        for (const line of textLines) normalizedHooks.onText(line);
      }
      return '';
    }),
    fork: jest.fn(),
    chat: jest.fn(),
  } as unknown as IAiRunner;
}

function captureOutput(fn: () => Promise<unknown>): Promise<string[]> {
  const lines: string[] = [];
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  const origLog = console.log.bind(console);

  const captureChunk = (chunk: string | Uint8Array): boolean => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
    lines.push(...text.split('\n').filter((line) => line !== ''));
    return true;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stdout.write as any) = captureChunk;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr.write as any) = captureChunk;

  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };

  return fn()
    .finally(() => {
      process.stdout.write = origStdoutWrite;
      process.stderr.write = origStderrWrite;
      console.log = origLog;
    })
    .then(() => lines);
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

describe('runSinglePhase - Claude runner with tool events', () => {
  it('prints tool-use lines for Write and Edit', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'Write', input: 'src/foo.ts' },
      { type: 'tool_use', name: 'Edit', input: 'src/bar.ts' },
      { type: 'result', usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0.001 } },
    ]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 2, 'Design Review'));
    const plain = lines.map(stripAnsi);

    expect(plain.some((line) => line.includes('+ src/foo.ts'))).toBe(true);
    expect(plain.some((line) => line.includes('~ src/bar.ts'))).toBe(true);
  });

  it('prints Bash symbol with command', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'Bash', input: 'npm test' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 2, 'Design Review'));
    const plain = lines.map(stripAnsi);

    expect(plain.some((line) => line.includes('$') && line.includes('npm test'))).toBe(true);
  });

  it('prints TodoWrite and Task with symbol only', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'TodoWrite' },
      { type: 'tool_use', name: 'Task' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 2, 'Design Review'));
    const plain = lines.map(stripAnsi);

    const todoLine = plain.find((line) => line.trim() === '*');
    const taskLine = plain.find((line) => line.trim() === '=');

    expect(todoLine).toBeDefined();
    expect(taskLine).toBeDefined();
  });

  it('prints unrecognised tool with default symbol and tool name', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'UnknownTool' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 2, 'Design Review'));
    const plain = lines.map(stripAnsi);

    expect(plain.some((line) => line.includes('. UnknownTool'))).toBe(true);
  });

  it('hides Read, Glob, and Grep tool events', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'Read', input: 'src/foo.ts' },
      { type: 'tool_use', name: 'Glob', input: '**/*.ts' },
      { type: 'tool_use', name: 'Grep', input: 'TODO' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 2, 'Design Review'));
    const plain = lines.map(stripAnsi);

    expect(plain.some((line) => line.includes('Read'))).toBe(false);
    expect(plain.some((line) => line.includes('Glob'))).toBe(false);
    expect(plain.some((line) => line.includes('Grep'))).toBe(false);
  });

  it('prints completion line with token stats when usage is present', async () => {
    const runner = makeRunner([
      { type: 'result', usage: { input_tokens: 100, output_tokens: 50, cost_usd: 0.002 } },
    ]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 2, 'Design Review'));
    const plain = lines.map(stripAnsi);
    const completionLine = plain.find((line) => line.includes('Phase 2') && line.includes('complete'));

    expect(completionLine).toBeDefined();
    expect(completionLine).toContain('in: 100');
    expect(completionLine).toContain('out: 50');
    expect(completionLine).toContain('$0.0020');
  });

  it('prints completion line when usage has no cost', async () => {
    const runner = makeRunner([
      { type: 'result', usage: { input_tokens: 100, output_tokens: 50 } },
    ]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 2, 'Design Review'));
    const plain = lines.map(stripAnsi);
    const completionLine = plain.find((line) => line.includes('Phase 2') && line.includes('complete'));

    expect(completionLine).toBeDefined();
    expect(completionLine).toContain('in: 100');
    expect(completionLine).toContain('out: 50');
    expect(completionLine).not.toContain('$');
  });

  it('prints completion line without brackets when usage is absent', async () => {
    const runner = makeRunner([{ type: 'result' }]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 4, 'Code Review'));
    const plain = lines.map(stripAnsi);
    const completionLine = plain.find((line) => line.includes('Phase 4') && line.includes('complete'));

    expect(completionLine).toBeDefined();
    expect(completionLine).not.toContain('[');
    expect(completionLine).not.toContain('tokens');
  });

  it('prints multiple tool events in order', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'Write', input: 'a.ts' },
      { type: 'tool_use', name: 'Bash', input: 'npm test' },
      { type: 'tool_use', name: 'Edit', input: 'b.ts' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() => runSinglePhase(runner, [], 'prompt', 1, 'Design Generation'));
    const plain = lines.map(stripAnsi).filter((line) => line.trim().match(/^[+~$*=.]/));

    expect(plain[0]).toContain('+ a.ts');
    expect(plain[1]).toContain('$ npm test');
    expect(plain[2]).toContain('~ b.ts');
  });
});

describe('runSinglePhase - Gemini/Codex runner (silent degradation)', () => {
  it('prints text lines when runner emits plain text instead of structured events', async () => {
    const geminiRunner: IAiRunner = {
      capabilities: jest.fn(() => ({
        runStreaming: 'text',
        forkStreaming: 'none',
        interactiveChat: true,
        structuredWorkerReport: false,
      })),
      run: jest.fn(async (_files, _prompt, hooks?: RunHooks | ((e: RunEvent) => void)) => {
        if (hooks && typeof hooks !== 'function') {
          hooks.onText?.('planning');
          hooks.onText?.('writing files');
        }
        return 'gemini output';
      }),
      fork: jest.fn(),
      chat: jest.fn(),
    } as unknown as IAiRunner;

    const lines = await captureOutput(() => runSinglePhase(geminiRunner, [], 'prompt', 2, 'Design Review'));
    const plain = lines.map(stripAnsi);
    const textLines = plain.filter((line) => line.includes('|'));

    expect(textLines).toContain('  | planning');
    expect(textLines).toContain('  | writing files');
    expect(plain.some((line) => line.includes('Phase 2') && line.includes('complete'))).toBe(true);
  });
});
