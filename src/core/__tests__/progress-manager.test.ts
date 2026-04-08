import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import { ProgressManager } from '../progress-manager';
import type { ProjectProgress } from '../../types';

describe('ProgressManager.syncRequirementsFromWorkspace', () => {
  const manager = new ProgressManager();

  async function makeWorkspace(progress: ProjectProgress): Promise<string> {
    const cwd = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-progress-'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'requirements'));
    await fse.writeJson(path.join(cwd, '.phasegate', 'progress.json'), progress, { spaces: 2 });
    return cwd;
  }

  afterEach(async () => {
    const base = os.tmpdir();
    const entries = await fse.readdir(base);
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith('phasegate-progress-'))
        .map((entry) => fse.remove(path.join(base, entry)))
    );
  });

  it('downgrades orphan selected requirements when no active requirement exists', async () => {
    const cwd = await makeWorkspace({
      projectName: 'demo',
      currentPhase: 3,
      activeRequirement: null,
      requirements: [{ name: 'feature-a', file: 'feature-a.md', status: 'selected' }],
      design: { modules: [{ name: 'mod-a', status: 'done' }], contracts: [], reviewPassed: true },
      modules: [{ name: 'mod-a', status: 'done' }],
      codeReviewPassed: true,
      blockers: ['stale'],
    });

    await fse.writeFile(
      path.join(cwd, '.phasegate', 'requirements', 'feature-a.md'),
      '# feature-a',
      'utf-8'
    );

    const progress = manager.syncRequirementsFromWorkspace(cwd);

    expect(progress.activeRequirement).toBeNull();
    expect(progress.currentPhase).toBe(0);
    expect(progress.requirements[0]?.status).toBe('approved');
    expect(progress.design.modules).toHaveLength(0);
    expect(progress.modules).toHaveLength(0);
    expect(progress.blockers).toHaveLength(0);
  });

  it('re-selects the matched requirement when activeRequirement exists but status drifted', async () => {
    const cwd = await makeWorkspace({
      projectName: 'demo',
      currentPhase: 2,
      activeRequirement: 'feature-a',
      requirements: [
        { name: 'feature-a', file: 'feature-a.md', status: 'approved' },
        { name: 'feature-b', file: 'feature-b.md', status: 'selected' },
      ],
      design: { modules: [], contracts: [], reviewPassed: false },
      modules: [],
      codeReviewPassed: false,
      blockers: [],
    });

    await fse.writeFile(
      path.join(cwd, '.phasegate', 'requirements', 'feature-a.md'),
      '# feature-a',
      'utf-8'
    );
    await fse.writeFile(
      path.join(cwd, '.phasegate', 'requirements', 'feature-b.md'),
      '# feature-b',
      'utf-8'
    );

    const progress = manager.syncRequirementsFromWorkspace(cwd);

    expect(progress.activeRequirement).toBe('feature-a');
    expect(progress.requirements.find((entry) => entry.name === 'feature-a')?.status).toBe('selected');
    expect(progress.requirements.find((entry) => entry.name === 'feature-b')?.status).toBe('approved');
    // currentPhase 2 is migrated to 1 on normalise
    expect(progress.currentPhase).toBe(1);
  });

  it('writes a generated progress.md snapshot with acceptance tracking', async () => {
    const cwd = await makeWorkspace({
      projectName: 'demo',
      currentPhase: 5,
      activeRequirement: 'feature-a',
      requirements: [{ name: 'feature-a', file: 'feature-a.md', status: 'selected' }],
      design: { modules: [{ name: 'mod-a', status: 'done' }], contracts: [], reviewPassed: true },
      modules: [{ name: 'mod-a', status: 'done' }],
      codeReviewPassed: true,
      blockers: [],
    });

    await fse.writeFile(
      path.join(cwd, '.phasegate', 'requirements', 'feature-a.md'),
      `# feature-a

## Acceptance Criteria
- [ ] user can see the new article
`,
      'utf-8'
    );

    const progress = manager.read(cwd);
    manager.write(cwd, progress);

    const snapshot = await fse.readFile(path.join(cwd, '.phasegate', 'progress.md'), 'utf-8');
    expect(snapshot).toContain('# Progress');
    expect(snapshot).toContain('Acceptance criteria recorded: 1');
    expect(snapshot).toContain('recorded: user can see the new article');
  });

  it('parses bullet and ordered acceptance criteria, not only checkboxes', async () => {
    const cwd = await makeWorkspace({
      projectName: 'demo',
      currentPhase: 5,
      activeRequirement: 'feature-a',
      requirements: [{ name: 'feature-a', file: 'feature-a.md', status: 'selected' }],
      design: { modules: [], contracts: [], reviewPassed: false },
      modules: [],
      codeReviewPassed: false,
      blockers: [],
    });

    await fse.writeFile(
      path.join(cwd, '.phasegate', 'requirements', 'feature-a.md'),
      `# feature-a

## Acceptance Criteria
- article appears in the list
1. article detail page is reachable
`,
      'utf-8'
    );

    const progress = manager.read(cwd);
    manager.write(cwd, progress);

    const snapshot = await fse.readFile(path.join(cwd, '.phasegate', 'progress.md'), 'utf-8');
    expect(snapshot).toContain('Acceptance criteria recorded: 2');
    expect(snapshot).toContain('recorded: article appears in the list');
    expect(snapshot).toContain('recorded: article detail page is reachable');
  });
});

describe('ProgressManager — Phase 2 migration', () => {
  const manager = new ProgressManager();

  async function makeWorkspace(raw: Record<string, unknown>): Promise<string> {
    const cwd = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-pm-migration-'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'requirements'));
    await fse.writeJson(path.join(cwd, '.phasegate', 'progress.json'), raw, { spaces: 2 });
    return cwd;
  }

  afterEach(async () => {
    const base = os.tmpdir();
    const entries = await fse.readdir(base);
    await Promise.all(
      entries
        .filter((entry) => entry.startsWith('phasegate-pm-migration-'))
        .map((entry) => fse.remove(path.join(base, entry)))
    );
  });

  it('migrates currentPhase: 2 to 1', async () => {
    const cwd = await makeWorkspace({ currentPhase: 2, projectName: 'test' });
    const progress = manager.read(cwd);
    expect(progress.currentPhase).toBe(1);
  });

  it('records migration in phaseStates', async () => {
    const cwd = await makeWorkspace({ currentPhase: 2, projectName: 'test' });
    const progress = manager.read(cwd);
    const migratedEntry = progress.phaseStates?.find(s => s.phaseId === 2);
    expect(migratedEntry?.state).toBe('migrated');
  });

  it('does not throw for progress without phaseStates field', async () => {
    const cwd = await makeWorkspace({ currentPhase: 3, projectName: 'test' });
    expect(() => manager.read(cwd)).not.toThrow();
  });

  it('reads currentPhase: 3 without migration', async () => {
    const cwd = await makeWorkspace({ currentPhase: 3, projectName: 'test' });
    const progress = manager.read(cwd);
    expect(progress.currentPhase).toBe(3);
    expect(progress.phaseStates?.find(s => s.phaseId === 2)).toBeUndefined();
  });
});

describe('ProgressManager — recordPhaseVerdict / getPhaseState', () => {
  const manager = new ProgressManager();
  let cwd: string;

  beforeEach(async () => {
    cwd = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-pm-verdict-'));
    await fse.ensureDir(path.join(cwd, '.phasegate', 'requirements'));
    const progress = {
      projectName: 'test',
      currentPhase: 4,
      activeRequirement: 'feature',
      requirements: [{ name: 'feature', file: 'feature.md', status: 'selected' }],
      design: { modules: [], contracts: [], reviewPassed: false },
      modules: [{ name: 'mod', status: 'done' }],
      codeReviewPassed: false,
      blockers: [],
    };
    await fse.writeJson(path.join(cwd, '.phasegate', 'progress.json'), progress, { spaces: 2 });
  });

  afterEach(async () => {
    await fse.remove(cwd);
  });

  it('writes and reads verdict for phase 4', () => {
    const verdict = {
      verdict: 'accepted' as const,
      reviewedBy: 'phase4' as const,
      findings: [],
      residualRisks: [],
    };
    manager.recordPhaseVerdict(cwd, 4, verdict);
    const state = manager.getPhaseState(cwd, 4);
    expect(state?.state).toBe('gate_passed');
    expect(state?.verdict?.verdict).toBe('accepted');

    const progress = manager.read(cwd);
    expect(progress.phase4Verdict?.verdict).toBe('accepted');
  });

  it('records gate_failed for rejected verdict', () => {
    const verdict = {
      verdict: 'rejected' as const,
      reviewedBy: 'phase4' as const,
      findings: [{ level: 'P0' as const, description: 'Critical bug', resolved: false }],
      residualRisks: [],
    };
    manager.recordPhaseVerdict(cwd, 4, verdict);
    const state = manager.getPhaseState(cwd, 4);
    expect(state?.state).toBe('gate_failed');
  });
});
