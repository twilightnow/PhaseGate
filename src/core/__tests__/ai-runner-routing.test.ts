import { EventEmitter } from 'events';
import { Writable } from 'stream';

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({ spawn: mockSpawn }));

const mockPathExists = jest.fn();
const mockReadJson = jest.fn();
const mockReadFile = jest.fn();

jest.mock('fs-extra', () => ({
  pathExists: (...args: unknown[]) => mockPathExists(...args),
  readJson: (...args: unknown[]) => mockReadJson(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
}));

import { createRunner } from '../ai-runner';

interface FakeProc extends EventEmitter {
  stdin: Writable;
  stdout: EventEmitter;
  stderr: EventEmitter;
}

function makeFakeProc(): FakeProc {
  const proc = new EventEmitter() as FakeProc;
  proc.stdin = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();
  return proc;
}

function succeed(proc: FakeProc, output = 'ok'): void {
  setImmediate(() => {
    proc.stdout.emit('data', Buffer.from(output));
    proc.emit('close', 0);
  });
}

beforeEach(() => {
  mockSpawn.mockReset();
  mockPathExists.mockReset();
  mockReadJson.mockReset();
  mockReadFile.mockReset();

  mockReadFile.mockResolvedValue('');
  mockPathExists.mockImplementation(async (targetPath: string) =>
    targetPath.includes('phasegate.config.json')
  );
});

describe('createRunner routing', () => {
  it('defaults to Codex when no config file exists', async () => {
    mockPathExists.mockResolvedValue(false);

    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = await createRunner('F:\\repo');
    const runPromise = runner.run([], 'hello');
    succeed(proc);

    await runPromise;

    const [command] = mockSpawn.mock.calls[0];
    expect(command).toBe('codex');
  });

  it('uses aiRouting scope mapping before legacy runner', async () => {
    mockReadJson.mockResolvedValue({
      runner: 'claude',
      aiProfiles: {
        default: { adapter: 'claude-code' },
        architect: { adapter: 'codex' },
      },
      aiRouting: {
        default: 'default',
        chat: 'architect',
      },
    });

    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = await createRunner('F:\\repo', 'chat');
    const runPromise = runner.run([], 'hello');
    succeed(proc);

    await runPromise;

    const [command] = mockSpawn.mock.calls[0];
    expect(command).toBe('codex');
  });

  it('falls back to aiRouting.default when scope is not mapped', async () => {
    mockReadJson.mockResolvedValue({
      aiProfiles: {
        default: { adapter: 'codex' },
      },
      aiRouting: {
        default: 'default',
      },
    });

    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = await createRunner('F:\\repo', 'phase5');
    const runPromise = runner.run([], 'hello');
    succeed(proc);

    await runPromise;

    const [command] = mockSpawn.mock.calls[0];
    expect(command).toBe('codex');
  });

  it('maps legacy runner aliases to adapters', async () => {
    mockReadJson.mockResolvedValue({
      runner: 'openai',
    });

    const proc = makeFakeProc();
    mockSpawn.mockReturnValue(proc);

    const runner = await createRunner('F:\\repo', 'phase1');
    const runPromise = runner.run([], 'hello');
    succeed(proc);

    await runPromise;

    const [command] = mockSpawn.mock.calls[0];
    expect(command).toBe('codex');
  });

  it('fails fast when routing references a missing profile', async () => {
    mockReadJson.mockResolvedValue({
      aiProfiles: {
        default: { adapter: 'claude-code' },
      },
      aiRouting: {
        chat: 'architect',
      },
    });

    await expect(createRunner('F:\\repo', 'chat')).rejects.toThrow('missing profile "architect"');
  });

  it('fails fast when legacy runner is unsupported', async () => {
    mockReadJson.mockResolvedValue({
      runner: 'gemini',
    });

    await expect(createRunner('F:\\repo', 'phase1')).rejects.toThrow('Unsupported runner "gemini"');
  });
});
