import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';

const mockCreateRunner = jest.fn();
jest.mock('../ai-runner', () => ({
  createRunner: (...args: unknown[]) => mockCreateRunner(...args),
}));

import { Orchestrator } from '../orchestrator';
import type { IAiRunner } from '../ai-runner';

const runnerCapabilities = {
  runStreaming: 'event' as const,
  forkStreaming: 'event' as const,
  interactiveChat: true,
  structuredWorkerReport: true,
};

describe('Orchestrator', () => {
  let projectRoot: string;
  let originalTimeoutEnv: string | undefined;

  beforeEach(async () => {
    originalTimeoutEnv = process.env['PHASEGATE_WORKER_TIMEOUT_MS'];
    mockCreateRunner.mockReset();

    projectRoot = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-orch-'));
    await fse.ensureDir(path.join(projectRoot, '.phasegate', 'tasks'));
    await fse.ensureDir(path.join(projectRoot, '.phasegate', 'contracts'));

    await fse.writeJson(
      path.join(projectRoot, '.phasegate', 'progress.json'),
      {
        projectName: 'PhaseGate',
        locale: 'en',
        currentPhase: 3,
        requirements: [],
        design: { modules: [], contracts: [], reviewPassed: true },
        modules: [],
        codeReviewPassed: false,
        blockers: [],
      },
      { spaces: 2 }
    );
  });

  afterEach(async () => {
    if (originalTimeoutEnv === undefined) {
      delete process.env['PHASEGATE_WORKER_TIMEOUT_MS'];
    } else {
      process.env['PHASEGATE_WORKER_TIMEOUT_MS'] = originalTimeoutEnv;
    }
    await fse.remove(projectRoot);
    jest.restoreAllMocks();
  });

  it('times out hung workers, persists failure details, and logs wave progress', async () => {
    process.env['PHASEGATE_WORKER_TIMEOUT_MS'] = '25';

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'module-a.md'),
      `# ModuleA

## Dependencies
| Module | Direction |
|---|---|
`,
      'utf-8'
    );

    const coordinatorRunner: IAiRunner = {
      capabilities: jest.fn(() => runnerCapabilities),
      run: jest.fn().mockResolvedValue('## Execution Order\n- module-a'),
      fork: jest.fn(),
      chat: jest.fn(),
    };
    const workerRunner: IAiRunner = {
      capabilities: jest.fn(() => runnerCapabilities),
      run: jest.fn(),
      fork: jest.fn(() => new Promise(() => undefined)),
      chat: jest.fn(),
    };
    mockCreateRunner
      .mockResolvedValueOnce(coordinatorRunner)
      .mockResolvedValueOnce(workerRunner);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const orchestrator = new Orchestrator();
    const [result] = await orchestrator.run(projectRoot);

    expect(result.status).toBe('failed');
    expect(result.error).toContain('worker timeout after 25ms');
    expect(mockCreateRunner).toHaveBeenNthCalledWith(1, projectRoot, 'phase3.coordinator');
    expect(mockCreateRunner).toHaveBeenNthCalledWith(2, projectRoot, 'phase3.worker');
    expect(logSpy).toHaveBeenCalledWith('Wave 1/1: module-a');
    expect(
      logSpy.mock.calls.some(([line]) => String(line).includes('module-a started'))
    ).toBe(true);
    expect(
      logSpy.mock.calls.some(([line]) => String(line).includes('module-a failed'))
    ).toBe(true);

    const report = await fse.readJson(
      path.join(projectRoot, '.phasegate', 'scratchpad', 'module-a', 'report.json')
    );
    expect(report.result).toBe('failed');
    expect(report.issues[0]).toContain('worker timeout after 25ms');

    const progress = await fse.readJson(path.join(projectRoot, '.phasegate', 'progress.json'));
    expect(progress.modules).toContainEqual({ name: 'module-a', status: 'failed' });
    expect(progress.blockers).toContain('[module-a] worker timeout after 25ms');
    expect(
      await fse.readFile(
        path.join(projectRoot, '.phasegate', 'scratchpad', 'coordinator', 'brief.md'),
        'utf-8'
      )
    ).toContain('## Execution Order');
  });

  it('passes only the module design file and relevant contracts to each worker', async () => {
    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'run-display.md'),
      `# RunDisplay

## Dependencies
| Interface | Direction |
|---|---|
| IRunEvent | CONSUMES |
`,
      'utf-8'
    );

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'contracts', 'IRunEvent.md'),
      `---
name: IRunEvent
description: Streaming run events
consumers:
  - RunDisplay
---

# IRunEvent

## Provider
- AiRunnerStream
`,
      'utf-8'
    );

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'contracts', 'IUnused.md'),
      `---
name: IUnused
description: Unrelated contract
consumers:
  - OtherModule
---

# IUnused

## Provider
- OtherModule
`,
      'utf-8'
    );

    const coordinatorRunner: IAiRunner = {
      capabilities: jest.fn(() => runnerCapabilities),
      run: jest.fn().mockResolvedValue('## Execution Order\n- run-display'),
      fork: jest.fn(),
      chat: jest.fn(),
    };
    const workerRunner: IAiRunner = {
      capabilities: jest.fn(() => runnerCapabilities),
      run: jest.fn(),
      fork: jest.fn().mockResolvedValue({
        scope: 'run-display - display streaming progress',
        result: 'done',
        keyFiles: ['src/commands/run.ts'],
        filesChanged: ['src/commands/run.ts'],
        issues: [],
      }),
      chat: jest.fn(),
    };
    mockCreateRunner
      .mockResolvedValueOnce(coordinatorRunner)
      .mockResolvedValueOnce(workerRunner);

    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const orchestrator = new Orchestrator();
    const [result] = await orchestrator.run(projectRoot);

    expect(result.status).toBe('done');
    expect(mockCreateRunner).toHaveBeenNthCalledWith(1, projectRoot, 'phase3.coordinator');
    expect(mockCreateRunner).toHaveBeenNthCalledWith(2, projectRoot, 'phase3.worker');
    expect(workerRunner.fork).toHaveBeenCalledTimes(1);

    const [contextFiles, _prompt, hooks] = (workerRunner.fork as jest.Mock).mock.calls[0];
    expect(contextFiles).toContain(
      path.join(projectRoot, '.phasegate', 'tasks', 'run-display.md')
    );
    expect(contextFiles).toContain(
      path.join(projectRoot, '.phasegate', 'contracts', 'IRunEvent.md')
    );
    expect(contextFiles).not.toContain(
      path.join(projectRoot, '.phasegate', 'contracts', 'IUnused.md')
    );
    expect(hooks).toMatchObject({ onText: expect.any(Function) });
    expect(
      await fse.readFile(
        path.join(projectRoot, '.phasegate', 'scratchpad', 'coordinator', 'brief.md'),
        'utf-8'
      )
    ).toContain('## Execution Order');
  });

  it('prints worker text lines with module prefixes while a module runs', async () => {
    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'module-a.md'),
      `# ModuleA

## Dependencies
| Module | Direction |
|---|---|
`,
      'utf-8'
    );

    const coordinatorRunner: IAiRunner = {
      capabilities: jest.fn(() => runnerCapabilities),
      run: jest.fn().mockResolvedValue('## Execution Order\n- module-a'),
      fork: jest.fn(),
      chat: jest.fn(),
    };
    const workerRunner: IAiRunner = {
      capabilities: jest.fn(() => runnerCapabilities),
      run: jest.fn(),
      fork: jest.fn(async (_files, _prompt, hooks) => {
        hooks?.onText?.('planning');
        hooks?.onText?.('writing src/module-a.ts');
        return {
          scope: 'module-a - example',
          result: 'done' as const,
          keyFiles: ['src/module-a.ts'],
          filesChanged: ['src/module-a.ts'],
          issues: [],
        };
      }),
      chat: jest.fn(),
    };
    mockCreateRunner
      .mockResolvedValueOnce(coordinatorRunner)
      .mockResolvedValueOnce(workerRunner);

    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    const orchestrator = new Orchestrator();
    await orchestrator.run(projectRoot);

    expect(
      logSpy.mock.calls.some(([line]) => String(line).includes('[module-a] planning'))
    ).toBe(true);
    expect(
      logSpy.mock.calls.some(([line]) => String(line).includes('[module-a] writing src/module-a.ts'))
    ).toBe(true);
  });
});
