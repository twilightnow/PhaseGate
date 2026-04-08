const mockPathExists = jest.fn();
const mockReadFile = jest.fn();
const mockReaddir = jest.fn();
const mockCreateRunner = jest.fn();
const mockGetRunnerAdapterName = jest.fn();
const mockCheckPhase0Gate = jest.fn();
const mockDetectLocale = jest.fn();
const mockBuildLocalLanguageInstruction = jest.fn();
const mockApproveRequirementDocs = jest.fn();

jest.mock('fs-extra', () => ({
  pathExists: (...args: unknown[]) => mockPathExists(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  readdir: (...args: unknown[]) => mockReaddir(...args),
}));

jest.mock('../../core/ai-runner', () => ({
  createRunner: (...args: unknown[]) => mockCreateRunner(...args),
  getRunnerAdapterName: (...args: unknown[]) => mockGetRunnerAdapterName(...args),
}));

jest.mock('../../core/phase-gate', () => ({
  buildLocalLanguageInstruction: (...args: unknown[]) => mockBuildLocalLanguageInstruction(...args),
  checkPhase0Gate: (...args: unknown[]) => mockCheckPhase0Gate(...args),
  detectLocale: (...args: unknown[]) => mockDetectLocale(...args),
}));

jest.mock('../../core/progress-manager', () => ({
  ProgressManager: jest.fn().mockImplementation(() => ({
    approveRequirementDocs: (...args: unknown[]) => mockApproveRequirementDocs(...args),
  })),
}));

import { createChatCommand } from '../chat';

function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*m/g, '');
}

async function runChatCommand(): Promise<string[]> {
  const lines: string[] = [];
  const origLog = console.log.bind(console);
  const origError = console.error.bind(console);

  console.log = (...args: unknown[]) => {
    lines.push(stripAnsi(args.map(String).join(' ')));
  };
  console.error = (...args: unknown[]) => {
    lines.push(stripAnsi(args.map(String).join(' ')));
  };

  try {
    const command = createChatCommand();
    await command.parseAsync(['node', 'test', 'chat'], { from: 'user' });
  } finally {
    console.log = origLog;
    console.error = origError;
  }

  return lines;
}

beforeEach(() => {
  mockPathExists.mockReset();
  mockReadFile.mockReset();
  mockReaddir.mockReset();
  mockCreateRunner.mockReset();
  mockGetRunnerAdapterName.mockReset();
  mockCheckPhase0Gate.mockReset();
  mockDetectLocale.mockReset();
  mockBuildLocalLanguageInstruction.mockReset();
  mockApproveRequirementDocs.mockReset();

  mockPathExists.mockResolvedValue(true);
  mockReadFile.mockResolvedValue('');
  mockReaddir.mockResolvedValue([]);
  mockCheckPhase0Gate.mockResolvedValue({ passed: true, issues: [] });
  mockDetectLocale.mockReturnValue('ja');
  mockBuildLocalLanguageInstruction.mockReturnValue(
    'Language policy:\n- Use Japanese for user-facing narrative or conversational text.'
  );
});

describe('chat command startup behaviour', () => {
  const kickoffMessage =
    '既存の requirements を確認し、重複を避けて Phase 0 の要件討議をそのまま続けてください。';

  it('keeps Codex startup short and does not print a CLI greeting', async () => {
    const chat = jest.fn().mockResolvedValue(undefined);
    mockGetRunnerAdapterName.mockResolvedValue('codex');
    mockCreateRunner.mockResolvedValue({ chat });

    const lines = await runChatCommand();

    expect(chat).toHaveBeenCalledWith(
      expect.not.stringContaining('The welcome message has already been shown to the user by the CLI.'),
      expect.stringContaining('phase0_requirements_en.md'),
      kickoffMessage
    );
    expect(chat).toHaveBeenCalledWith(
      expect.stringContaining('Use Japanese for user-facing narrative or conversational text.'),
      expect.any(String),
      kickoffMessage
    );
    expect(chat).toHaveBeenCalledWith(
      expect.stringContaining(
        'Ask at most one user-facing discussion message per turn, then stop and wait for the user reply.'
      ),
      expect.any(String),
      kickoffMessage
    );
    expect(chat).toHaveBeenCalledWith(
      expect.stringContaining('Do not send a second assistant message unless the user has replied.'),
      expect.any(String),
      kickoffMessage
    );
    expect(chat).toHaveBeenCalledWith(
      expect.stringContaining(
        'Do not run shell or file-inspection commands at startup unless they are strictly necessary to answer the next user turn.'
      ),
      expect.any(String),
      kickoffMessage
    );
    expect(lines).not.toContain(kickoffMessage);
  });

  it('passes the same short kickoff message through the adapter for Claude without printing it', async () => {
    const chat = jest.fn().mockResolvedValue(undefined);
    mockGetRunnerAdapterName.mockResolvedValue('claude-code');
    mockCreateRunner.mockResolvedValue({ chat });

    const lines = await runChatCommand();

    expect(chat).toHaveBeenCalledWith(
      expect.stringContaining('Use Japanese for user-facing narrative or conversational text.'),
      expect.stringContaining('phase0_requirements_en.md'),
      kickoffMessage
    );
    expect(lines).not.toContain(kickoffMessage);
  });

  it('injects existing requirements into the startup prompt so the agent can skip startup file reads', async () => {
    const chat = jest.fn().mockResolvedValue(undefined);
    mockGetRunnerAdapterName.mockResolvedValue('codex');
    mockCreateRunner.mockResolvedValue({ chat });

    mockPathExists.mockImplementation(async (targetPath: string) => {
      if (targetPath.endsWith('.phasegate\\requirements')) return true;
      if (targetPath.endsWith('add-demo-blog-post.md')) return true;
      return true;
    });
    mockReaddir.mockResolvedValue(['add-demo-blog-post.md']);
    mockReadFile.mockResolvedValue('# add-demo-blog-post\n\n## Description\nexisting content');

    await runChatCommand();

    expect(chat).toHaveBeenCalledWith(
      expect.stringContaining('## Existing Requirements'),
      expect.any(String),
      kickoffMessage
    );
    expect(chat).toHaveBeenCalledWith(
      expect.stringContaining('### add-demo-blog-post.md'),
      expect.any(String),
      kickoffMessage
    );
    expect(chat).toHaveBeenCalledWith(
      expect.stringContaining('## Description\nexisting content'),
      expect.any(String),
      kickoffMessage
    );
  });
});
