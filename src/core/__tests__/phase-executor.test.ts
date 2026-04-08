import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import { PhaseExecutor } from '../phase-executor';
import type { ProjectProgress } from '../../types';

jest.mock('../ai-runner', () => ({
  createRunner: jest.fn(async () => ({
    run: jest.fn(),
    fork: jest.fn(),
    chat: jest.fn(),
    capabilities: jest.fn(() => ({
      runStreaming: 'event',
      forkStreaming: 'event',
      interactiveChat: true,
      structuredWorkerReport: true,
    })),
  })),
}));

describe('PhaseExecutor.prepare', () => {
  async function makeWorkspace(): Promise<string> {
    const cwd = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-executor-'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'requirements'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'tasks'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'contracts'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'scratchpad', 'module-a'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'scratchpad', 'summaries'));

    const progress: ProjectProgress = {
      projectName: 'demo',
      currentPhase: 4,
      activeRequirement: 'feature-a',
      requirements: [{ name: 'feature-a', file: 'feature-a.md', status: 'selected' }],
      design: { modules: [{ name: 'module-a', status: 'done' }], contracts: [], reviewPassed: true },
      modules: [{ name: 'module-a', status: 'done' }],
      codeReviewPassed: false,
      blockers: [],
    };

    await fse.writeJson(path.join(cwd, '.phasegate', 'progress.json'), progress, { spaces: 2 });
    await fse.writeFile(path.join(cwd, '.phasegate', 'requirements', 'feature-a.md'), '# feature-a', 'utf-8');
    await fse.writeFile(path.join(cwd, '.phasegate', 'tasks', 'module-a.md'), '# module-a', 'utf-8');
    await fse.writeFile(path.join(cwd, '.phasegate', 'contracts', 'IFoo.md'), '# IFoo', 'utf-8');
    await fse.writeFile(
      path.join(cwd, '.phasegate', 'scratchpad', 'summaries', 'phase-3-summary.md'),
      '# Phase 3 Summary',
      'utf-8'
    );
    await fse.writeJson(
      path.join(cwd, '.phasegate', 'scratchpad', 'module-a', 'report.json'),
      { result: 'done' },
      { spaces: 2 }
    );

    return cwd;
  }

  afterEach(async () => {
    const base = os.tmpdir();
    const entries = await fse.readdir(base);
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith('phasegate-executor-'))
        .map((entry) => fse.remove(path.join(base, entry)))
    );
  });

  it('injects progress, summaries, tasks, contracts, and worker reports for phase 4', async () => {
    const cwd = await makeWorkspace();
    const executor = new PhaseExecutor();

    const prepared = await executor.prepare(cwd, 4);

    expect(prepared.contextFiles).toContain(path.join(cwd, '.phasegate', 'progress.json'));
    expect(prepared.contextFiles).toContain(path.join(cwd, '.phasegate', 'tasks', 'module-a.md'));
    expect(prepared.contextFiles).toContain(path.join(cwd, '.phasegate', 'contracts', 'IFoo.md'));
    expect(prepared.contextFiles).toContain(
      path.join(cwd, '.phasegate', 'scratchpad', 'summaries', 'phase-3-summary.md')
    );
    expect(prepared.contextFiles).toContain(
      path.join(cwd, '.phasegate', 'scratchpad', 'module-a', 'report.json')
    );
  });
});
