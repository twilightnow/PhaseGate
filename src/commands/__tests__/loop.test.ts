/**
 * Tests for src/commands/loop.ts
 *
 * Strategy: mock ProgressManager and runPhasesUntilDone to isolate loop logic.
 */

import type { RequirementEntry, ProjectProgress } from '../../types';

// ---- mocks ----

const mockSyncRequirementsFromWorkspace = jest.fn();
const mockGetQueuedRequirements = jest.fn();
const mockActivateRequirement = jest.fn();
const mockRead = jest.fn();

jest.mock('../../core/progress-manager', () => ({
  ProgressManager: jest.fn().mockImplementation(() => ({
    syncRequirementsFromWorkspace: (...args: unknown[]) =>
      mockSyncRequirementsFromWorkspace(...args),
    getQueuedRequirements: (...args: unknown[]) => mockGetQueuedRequirements(...args),
    activateRequirement: (...args: unknown[]) => mockActivateRequirement(...args),
    read: (...args: unknown[]) => mockRead(...args),
  })),
}));

const mockRunPhasesUntilDone = jest.fn();

jest.mock('../run', () => ({
  ...jest.requireActual('../run'),
  runPhasesUntilDone: (...args: unknown[]) => mockRunPhasesUntilDone(...args),
}));

// stub fs-extra: ensure ensureDir / writeFile succeed silently
jest.mock('fs-extra', () => ({
  ensureDir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
  dirname: jest.requireActual('path').dirname,
}));

import { createLoopCommand } from '../loop';

// ---- helpers ----

function makeReq(
  name: string,
  priority: RequirementEntry['priority'] = 'normal',
  approvedAt?: string
): RequirementEntry {
  return { name, file: `${name}.md`, status: 'approved', priority, approvedAt };
}

function makeProgress(activeRequirement: string | null = null): ProjectProgress {
  return {
    projectName: 'test',
    currentPhase: activeRequirement ? 1 : 0,
    activeRequirement,
    requirements: [],
    design: { modules: [], contracts: [], reviewPassed: false },
    modules: [],
    codeReviewPassed: false,
    blockers: [],
  };
}

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

async function runLoop(args: string[]): Promise<string[]> {
  const lines: string[] = [];
  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);

  console.log = (...a: unknown[]) => lines.push(stripAnsi(a.map(String).join(' ')));
  console.error = (...a: unknown[]) => lines.push(stripAnsi(a.map(String).join(' ')));

  try {
    const cmd = createLoopCommand();
    await cmd.parseAsync(['node', 'test', 'loop', ...args], { from: 'user' });
  } finally {
    console.log = origLog;
    console.error = origError;
  }

  return lines;
}

// ---- tests ----

beforeEach(() => {
  jest.clearAllMocks();
  mockSyncRequirementsFromWorkspace.mockReturnValue(undefined);
  mockActivateRequirement.mockReturnValue(undefined);
  mockRead.mockReturnValue(makeProgress(null));
  mockGetQueuedRequirements.mockReturnValue([]);
  mockRunPhasesUntilDone.mockResolvedValue('pass');
});

describe('loop --dry-run', () => {
  it('prints ordered queue and exits without running', async () => {
    mockGetQueuedRequirements.mockReturnValue([
      makeReq('high-req', 'high', '2026-01-01T00:00:00Z'),
      makeReq('normal-req', 'normal', '2026-01-02T00:00:00Z'),
    ]);

    const lines = await runLoop(['--dry-run']);

    expect(lines.some((l) => l.includes('high-req'))).toBe(true);
    expect(lines.some((l) => l.includes('normal-req'))).toBe(true);
    // high-req should appear before normal-req
    const highIdx = lines.findIndex((l) => l.includes('high-req'));
    const normalIdx = lines.findIndex((l) => l.includes('normal-req'));
    expect(highIdx).toBeLessThan(normalIdx);
    expect(mockRunPhasesUntilDone).not.toHaveBeenCalled();
  });

  it('prints a message when queue is empty on dry-run', async () => {
    mockGetQueuedRequirements.mockReturnValue([]);

    const lines = await runLoop(['--dry-run']);

    expect(lines.some((l) => l.includes('No approved requirements'))).toBe(true);
    expect(mockRunPhasesUntilDone).not.toHaveBeenCalled();
  });
});

describe('loop — normal execution', () => {
  it('exits cleanly when queue is empty', async () => {
    mockGetQueuedRequirements.mockReturnValue([]);

    const lines = await runLoop([]);

    expect(lines.some((l) => l.includes('empty') || l.includes('complete'))).toBe(true);
    expect(mockRunPhasesUntilDone).not.toHaveBeenCalled();
  });

  it('resumes activeRequirement instead of selecting next', async () => {
    mockRead.mockReturnValue(makeProgress('feature-a'));
    // after resume, queue is empty
    mockGetQueuedRequirements.mockReturnValue([]);
    mockRunPhasesUntilDone.mockResolvedValue('pass');

    await runLoop([]);

    // runPhasesUntilDone called once for the resume
    expect(mockRunPhasesUntilDone).toHaveBeenCalledTimes(1);
    // activateRequirement NOT called (resume path, not select-next path)
    expect(mockActivateRequirement).not.toHaveBeenCalled();
  });

  it('stops loop and prints error on gate_failed', async () => {
    mockRead.mockReturnValue(makeProgress(null));
    mockGetQueuedRequirements
      .mockReturnValueOnce([makeReq('req-a', 'high')])
      .mockReturnValue([]);
    mockRunPhasesUntilDone.mockResolvedValue('gate_failed');

    const lines = await runLoop([]);

    expect(lines.some((l) => l.toLowerCase().includes('gate failed') || l.includes('req-a'))).toBe(true);
    // loop should stop after first gate_failed
    expect(mockRunPhasesUntilDone).toHaveBeenCalledTimes(1);
  });

  it('reloads queue after each completed requirement', async () => {
    mockRead.mockReturnValue(makeProgress(null));
    mockGetQueuedRequirements
      .mockReturnValueOnce([makeReq('req-a', 'normal')])
      .mockReturnValueOnce([makeReq('req-b', 'normal')])
      .mockReturnValue([]);
    mockRunPhasesUntilDone.mockResolvedValue('pass');

    await runLoop([]);

    expect(mockRunPhasesUntilDone).toHaveBeenCalledTimes(2);
    expect(mockActivateRequirement).toHaveBeenCalledWith(expect.any(String), 'req-a');
    expect(mockActivateRequirement).toHaveBeenCalledWith(expect.any(String), 'req-b');
  });
});
