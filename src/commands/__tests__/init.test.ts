const mockPathExists = jest.fn();
const mockEnsureDir = jest.fn();
const mockWriteJson = jest.fn();
const mockWriteFile = jest.fn();
const mockManagerWrite = jest.fn();
const mockDetectLocale = jest.fn();

jest.mock('fs-extra', () => ({
  pathExists: (...args: unknown[]) => mockPathExists(...args),
  ensureDir: (...args: unknown[]) => mockEnsureDir(...args),
  writeJson: (...args: unknown[]) => mockWriteJson(...args),
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
}));

jest.mock('../../core/progress-manager', () => ({
  ProgressManager: jest.fn().mockImplementation(() => ({
    write: (...args: unknown[]) => mockManagerWrite(...args),
  })),
}));

jest.mock('../../core/phase-gate', () => ({
  detectLocale: (...args: unknown[]) => mockDetectLocale(...args),
}));

import { createInitCommand } from '../init';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

async function runInitCommand(): Promise<string[]> {
  const lines: string[] = [];
  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);
  const origIsTTY = process.stdin.isTTY;
  const origOutIsTTY = process.stdout.isTTY;

  process.stdin.isTTY = false;
  process.stdout.isTTY = false;
  console.log = (...args: unknown[]) => {
    lines.push(stripAnsi(args.map(String).join(' ')));
  };
  console.error = (...args: unknown[]) => {
    lines.push(stripAnsi(args.map(String).join(' ')));
  };

  try {
    const command = createInitCommand();
    await command.parseAsync(['node', 'test', 'init'], { from: 'user' });
  } finally {
    process.stdin.isTTY = origIsTTY;
    process.stdout.isTTY = origOutIsTTY;
    console.log = origLog;
    console.error = origError;
  }

  return lines;
}

beforeEach(() => {
  mockPathExists.mockReset();
  mockEnsureDir.mockReset();
  mockWriteJson.mockReset();
  mockWriteFile.mockReset();
  mockManagerWrite.mockReset();
  mockDetectLocale.mockReset();

  mockPathExists.mockResolvedValue(false);
  mockEnsureDir.mockResolvedValue(undefined);
  mockWriteJson.mockResolvedValue(undefined);
  mockWriteFile.mockResolvedValue(undefined);
  mockManagerWrite.mockResolvedValue(undefined);
  mockDetectLocale.mockReturnValue('ja');
});

describe('init command', () => {
  it('does not scaffold a requirements template file', async () => {
    const lines = await runInitCommand();

    expect(mockWriteFile).not.toHaveBeenCalled();
    expect(
      lines.some((line) => line.includes('.phasegate/requirements/') && line.includes('generated in Phase 0'))
    ).toBe(true);
  });
});
