/**
 * Tests for runSinglePhase() display logic in commands/run.ts
 *
 * Strategy: inject a mock IAiRunner whose run() method calls onEvent with
 * pre-defined events, then capture stdout/console.log to verify output.
 */

import { runSinglePhase } from '../run';
import type { IAiRunner } from '../../core/ai-runner';
import type { RunEvent } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a mock runner that emits the given events then resolves */
function makeRunner(events: RunEvent[]): IAiRunner {
  return {
    run: jest.fn(async (_files: string[], _prompt: string, onEvent?: (e: RunEvent) => void) => {
      if (onEvent) {
        for (const e of events) onEvent(e);
      }
      return '';
    }),
    fork: jest.fn(),
    chat: jest.fn(),
  } as unknown as IAiRunner;
}

/** Collect lines written to stdout, stderr, and console.log */
function captureOutput(fn: () => Promise<void>): Promise<string[]> {
  const lines: string[] = [];
  const origStdoutWrite = process.stdout.write.bind(process.stdout);
  const origStderrWrite = process.stderr.write.bind(process.stderr);
  const origLog = console.log.bind(console);

  const captureChunk = (chunk: string | Uint8Array): boolean => {
    const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString();
    lines.push(...text.split('\n').filter((l) => l !== ''));
    return true;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stdout.write as any) = captureChunk;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (process.stderr.write as any) = captureChunk;

  console.log = (...args: unknown[]) => {
    lines.push(args.map(String).join(' '));
  };

  return fn().finally(() => {
    process.stdout.write = origStdoutWrite;
    process.stderr.write = origStderrWrite;
    console.log = origLog;
  }).then(() => lines);
}

// Strip ANSI colour codes for easier assertions
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runSinglePhase — Claude runner with tool events', () => {
  it('prints tool-use lines for Write and Edit', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'Write', input: 'src/foo.ts' },
      { type: 'tool_use', name: 'Edit', input: 'src/bar.ts' },
      { type: 'result', usage: { input_tokens: 10, output_tokens: 5, cost_usd: 0.001 } },
    ]);

    const lines = await captureOutput(() =>
      runSinglePhase(runner, [], 'prompt', 2, 'Design Review')
    );

    const plain = lines.map(stripAnsi);
    expect(plain.some((l) => l.includes('+ src/foo.ts'))).toBe(true);
    expect(plain.some((l) => l.includes('~ src/bar.ts'))).toBe(true);
  });

  it('prints Bash symbol with command', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'Bash', input: 'npm test' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() =>
      runSinglePhase(runner, [], 'prompt', 2, 'Design Review')
    );

    const plain = lines.map(stripAnsi);
    expect(plain.some((l) => l.includes('⚡') && l.includes('npm test'))).toBe(true);
  });

  it('prints TodoWrite and Task with symbol only (no trailing text)', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'TodoWrite' },
      { type: 'tool_use', name: 'Task' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() =>
      runSinglePhase(runner, [], 'prompt', 2, 'Design Review')
    );

    const plain = lines.map(stripAnsi);
    const todoLine = plain.find((l) => l.includes('📋'));
    const taskLine = plain.find((l) => l.includes('✓') && !l.includes('complete'));
    expect(todoLine).toBeDefined();
    expect(taskLine).toBeDefined();
    // symbol-only: nothing meaningful after the symbol
    expect(todoLine!.trim()).toBe('📋');
    expect(taskLine!.trim()).toBe('✓');
  });

  it('prints unrecognised tool with · symbol and tool name', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'UnknownTool' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() =>
      runSinglePhase(runner, [], 'prompt', 2, 'Design Review')
    );

    const plain = lines.map(stripAnsi);
    expect(plain.some((l) => l.includes('·') && l.includes('UnknownTool'))).toBe(true);
  });

  it('hides Read, Glob, and Grep tool events', async () => {
    const runner = makeRunner([
      { type: 'tool_use', name: 'Read', input: 'src/foo.ts' },
      { type: 'tool_use', name: 'Glob', input: '**/*.ts' },
      { type: 'tool_use', name: 'Grep', input: 'TODO' },
      { type: 'result' },
    ]);

    const lines = await captureOutput(() =>
      runSinglePhase(runner, [], 'prompt', 2, 'Design Review')
    );

    const plain = lines.map(stripAnsi);
    expect(plain.some((l) => l.includes('Read'))).toBe(false);
    expect(plain.some((l) => l.includes('Glob'))).toBe(false);
    expect(plain.some((l) => l.includes('Grep'))).toBe(false);
  });

  it('prints completion line with token stats when usage is present', async () => {
    const runner = makeRunner([
      { type: 'result', usage: { input_tokens: 100, output_tokens: 50, cost_usd: 0.002 } },
    ]);

    const lines = await captureOutput(() =>
      runSinglePhase(runner, [], 'prompt', 2, 'Design Review')
    );

    const plain = lines.map(stripAnsi);
    const completionLine = plain.find((l) => l.includes('Phase 2') && l.includes('complete'));
    expect(completionLine).toBeDefined();
    expect(completionLine).toContain('in: 100');
    expect(completionLine).toContain('out: 50');
    expect(completionLine).toContain('$0.0020');
  });

  it('prints completion line without brackets when usage is absent', async () => {
    const runner = makeRunner([{ type: 'result' }]);

    const lines = await captureOutput(() =>
      runSinglePhase(runner, [], 'prompt', 4, 'Code Review')
    );

    const plain = lines.map(stripAnsi);
    const completionLine = plain.find((l) => l.includes('Phase 4') && l.includes('complete'));
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

    const lines = await captureOutput(() =>
      runSinglePhase(runner, [], 'prompt', 1, 'Design Generation')
    );

    const plain = lines.map(stripAnsi).filter((l) => l.trim().match(/^[+~⚡📋✓·]/));
    expect(plain[0]).toContain('+ a.ts');
    expect(plain[1]).toContain('⚡');
    expect(plain[2]).toContain('~ b.ts');
  });
});

describe('runSinglePhase — Gemini/Codex runner (silent degradation)', () => {
  it('emits no tool-use lines when runner does not call onEvent', async () => {
    // Gemini runner: run() ignores onEvent, returns plain text
    const geminiRunner: IAiRunner = {
      run: jest.fn(async () => 'gemini output'),
      fork: jest.fn(),
      chat: jest.fn(),
    } as unknown as IAiRunner;

    const lines = await captureOutput(() =>
      runSinglePhase(geminiRunner, [], 'prompt', 2, 'Design Review')
    );

    const plain = lines.map(stripAnsi);
    // No tool-use symbol lines
    const toolLines = plain.filter((l) => l.trim().match(/^[+~⚡📋·]/));
    expect(toolLines).toHaveLength(0);
    // Completion line should still appear (via spinner.succeed path)
    expect(plain.some((l) => l.includes('Phase 2') && l.includes('complete'))).toBe(true);
  });
});
