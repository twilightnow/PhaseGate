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
    expect(progress.currentPhase).toBe(2);
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
