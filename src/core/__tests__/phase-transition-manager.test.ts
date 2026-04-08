import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import { PhaseTransitionManager } from '../phase-transition-manager';
import { ProgressManager } from '../progress-manager';
import type { ProjectProgress } from '../../types';

describe('PhaseTransitionManager', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-ptm-'));
    await fse.ensureDir(path.join(projectRoot, '.phasegate', 'contracts'));
    await fse.ensureDir(path.join(projectRoot, '.phasegate', 'tasks'));
    await fse.ensureDir(path.join(projectRoot, '.phasegate', 'requirements'));

    const progress: ProjectProgress = {
      projectName: 'ptm-test',
      currentPhase: 2,
      activeRequirement: 'feature',
      requirements: [{ name: 'feature', file: 'feature.md', status: 'selected' }],
      design: {
        modules: [{ name: 'demo', status: 'done' }],
        contracts: [],
        reviewPassed: false,
      },
      modules: [{ name: 'demo', status: 'pending' }],
      codeReviewPassed: false,
      blockers: [],
    };

    new ProgressManager().write(projectRoot, progress);

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'demo.md'),
      `# demo

## Dependencies
| Interface | Direction |
|---|---|
| DemoContract | CONSUMES |
`,
      'utf-8'
    );
  });

  afterEach(async () => {
    await fse.remove(projectRoot);
  });

  it('treats active contract status and providers frontmatter as finalized/provider data', async () => {
    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'contracts', 'DemoContract.md'),
      `---
name: DemoContract
description: Demo contract
status: active
providers:
  - demo-provider
consumers:
  - demo
---

# DemoContract

## Status
active

## Definition
\`\`\`ts
type DemoContract = {
  id: string;
};
\`\`\`
`,
      'utf-8'
    );

    const transition = await new PhaseTransitionManager().resolve(projectRoot, { phase: 2 });
    const progress = new ProgressManager().read(projectRoot);

    expect(transition.nextPhase).toBe(3);
    expect(progress.currentPhase).toBe(3);
    expect(progress.design.reviewPassed).toBe(true);

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'contracts', 'DemoContract.md'),
      `---
name: DemoContract
description: Demo contract
providers:
  - demo-provider
consumers:
  - demo
---

# DemoContract

## Status
stable

## Definition
\`\`\`ts
type DemoContract = {
  id: string;
};
\`\`\`
`,
      'utf-8'
    );

    const synced = await new PhaseTransitionManager().resolve(projectRoot, { phase: 1 });
    const syncedProgress = new ProgressManager().read(projectRoot);

    expect(synced.nextPhase).toBe(2);
    expect(syncedProgress.design.contracts[0]?.status).toBe('finalized');
    expect(syncedProgress.design.contracts[0]?.provider).toBe('demo-provider');
  });

  it('allows single-module phase 1 output without contracts', async () => {
    await fse.remove(path.join(projectRoot, '.phasegate', 'contracts', 'DemoContract.md'));

    const transition = await new PhaseTransitionManager().resolve(projectRoot, { phase: 1 });
    const progress = new ProgressManager().read(projectRoot);

    expect(transition.nextPhase).toBe(2);
    expect(progress.currentPhase).toBe(2);
    expect(progress.design.modules).toHaveLength(1);
    expect(progress.design.contracts).toHaveLength(0);
  });

  it('auto-appends a Phase 4 summary when the review run completes without one', async () => {
    const pm = new ProgressManager();
    const progress = pm.read(projectRoot);
    progress.currentPhase = 4;
    progress.modules = [{ name: 'demo', status: 'done' }];
    pm.write(projectRoot, progress);

    const transition = await new PhaseTransitionManager().resolve(projectRoot, {
      phase: 4,
      output: 'PASS - Both review passes completed. No P0 issues remain across reviewed modules.',
    });
    const updatedProgress = pm.read(projectRoot);
    const summary = await fse.readFile(
      path.join(projectRoot, '.phasegate', 'scratchpad', 'summaries', 'phase-4-summary.md'),
      'utf-8'
    );

    expect(transition.nextPhase).toBe(5);
    expect(updatedProgress.currentPhase).toBe(5);
    expect(updatedProgress.codeReviewPassed).toBe(true);
    expect(summary).toContain('# Phase 4 Summary');
  });

  it('creates an acceptance guide and appends a Phase 5 summary', async () => {
    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'requirements', 'feature.md'),
      `# Feature

## Acceptance Criteria
- [ ] user can complete the workflow
`,
      'utf-8'
    );

    const transition = await new PhaseTransitionManager().resolve(projectRoot, { phase: 5 });
    const guide = await fse.readFile(path.join(projectRoot, 'acceptance-guide.md'), 'utf-8');
    const archiveEntries = await fse.readdir(path.join(projectRoot, '.phasegate', 'archive'));
    const archivedScratchpad = await fse.readFile(
      path.join(
        projectRoot,
        '.phasegate',
        'archive',
        archiveEntries[0],
        'scratchpad',
        'summaries',
        'phase-5-summary.md'
      ),
      'utf-8'
    );
    const updatedProgress = new ProgressManager().read(projectRoot);

    expect(transition.nextPhase).toBeNull();
    expect(guide).toContain('# ptm-test Acceptance Guide');
    expect(guide).toContain('user can complete the workflow');
    expect(archivedScratchpad).toContain('# Phase 5 Summary');
    expect(archivedScratchpad).toContain('PHASE_DONE');
    expect(updatedProgress.currentPhase).toBe(0);
    expect(updatedProgress.activeRequirement).toBeNull();
  });

  it('blocks Phase 5 finalization when no acceptance criteria are recorded', async () => {
    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'requirements', 'feature.md'),
      `# Feature

## Description
demo
`,
      'utf-8'
    );

    const transition = await new PhaseTransitionManager().resolve(projectRoot, { phase: 5 });
    const updatedProgress = new ProgressManager().read(projectRoot);
    const summary = await fse.readFile(
      path.join(projectRoot, '.phasegate', 'scratchpad', 'summaries', 'phase-5-summary.md'),
      'utf-8'
    );

    expect(transition.stopReason).toBe('gate_failed');
    expect(transition.message).toContain('acceptance criteria recorded: 0');
    expect(updatedProgress.currentPhase).toBe(2);
    expect(updatedProgress.activeRequirement).toBe('feature');
    expect(summary).toContain('PHASE_BLOCKED');
    expect(summary).toContain('Passed: 0 acceptance criteria recorded');
  });
});
