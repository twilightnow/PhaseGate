import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import { PhaseTransitionManager, tryParseVerdict } from '../phase-transition-manager';
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

  it('Phase 2 resolve returns migration message and advances to Phase 3', async () => {
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
    expect(transition.shouldContinue).toBe(true);
    expect(transition.message).toContain('folded into Phase 1');
    expect(progress.currentPhase).toBe(3);

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

    expect(synced.nextPhase).toBe(3);
    expect(syncedProgress.design.contracts[0]?.status).toBe('finalized');
    expect(syncedProgress.design.contracts[0]?.provider).toBe('demo-provider');
  });

  it('allows single-module phase 1 output without contracts', async () => {
    await fse.remove(path.join(projectRoot, '.phasegate', 'contracts', 'DemoContract.md'));

    const transition = await new PhaseTransitionManager().resolve(projectRoot, { phase: 1 });
    const progress = new ProgressManager().read(projectRoot);

    expect(transition.nextPhase).toBe(3);
    expect(progress.currentPhase).toBe(3);
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
    // currentPhase: 2 in setup was migrated to 1 on read; phase 5 gate failure does not change it
    expect(updatedProgress.currentPhase).toBe(1);
    expect(updatedProgress.activeRequirement).toBe('feature');
    expect(summary).toContain('PHASE_BLOCKED');
    expect(summary).toContain('Passed: 0 acceptance criteria recorded');
  });

  describe('Phase 4 VerdictRecord parsing', () => {
    beforeEach(async () => {
      const pm = new ProgressManager();
      const progress = pm.read(projectRoot);
      progress.currentPhase = 4;
      progress.modules = [{ name: 'demo', status: 'done' }];
      pm.write(projectRoot, progress);
    });

    it('Phase 4 resolve with accepted verdict gates to Phase 5', async () => {
      const verdictOutput = JSON.stringify({
        verdict: 'accepted',
        reviewedBy: 'phase4',
        timestamp: '2026-04-08T00:00:00Z',
        findings: [],
        residualRisks: [],
        confidenceLevel: 'high',
      });
      const wrappedOutput = '```json\n' + verdictOutput + '\n```';
      const transition = await new PhaseTransitionManager().resolve(projectRoot, {
        phase: 4,
        output: wrappedOutput,
      });
      const pm = new ProgressManager();
      const progress = pm.read(projectRoot);

      expect(transition.nextPhase).toBe(5);
      expect(transition.shouldContinue).toBe(true);
      expect(transition.verdict?.verdict).toBe('accepted');
      expect(progress.codeReviewPassed).toBe(true);
      expect(progress.phase4Verdict?.verdict).toBe('accepted');
    });

    it('Phase 4 resolve with rejected verdict stops workflow', async () => {
      const verdictOutput = JSON.stringify({
        verdict: 'rejected',
        reviewedBy: 'phase4',
        timestamp: '2026-04-08T00:00:00Z',
        findings: [{ level: 'P0', description: 'Critical bug', relatedModule: 'demo', resolved: false }],
        residualRisks: [],
        confidenceLevel: 'low',
      });
      const wrappedOutput = '```json\n' + verdictOutput + '\n```';
      const transition = await new PhaseTransitionManager().resolve(projectRoot, {
        phase: 4,
        output: wrappedOutput,
      });

      expect(transition.shouldContinue).toBe(false);
      expect(transition.stopReason).toBe('gate_failed');
      expect(transition.message).toContain('rejected');
    });

    it('Phase 4 resolve without verdict JSON falls back to legacy check', async () => {
      const transition = await new PhaseTransitionManager().resolve(projectRoot, {
        phase: 4,
        output: 'Code review complete. All issues addressed. PASS.',
      });

      expect(transition).toBeDefined();
      expect(typeof transition.shouldContinue).toBe('boolean');
    });
  });

  describe('tryParseVerdict', () => {
    it('parses a valid VerdictRecord from JSON block', () => {
      const output = '```json\n{"verdict":"accepted","reviewedBy":"phase4","findings":[],"residualRisks":[]}\n```';
      const result = tryParseVerdict(output);
      expect(result?.verdict).toBe('accepted');
      expect(result?.findings).toEqual([]);
    });

    it('returns null for non-JSON output', () => {
      expect(tryParseVerdict('PASS - review complete')).toBeNull();
    });

    it('returns null for malformed JSON block', () => {
      expect(tryParseVerdict('```json\n{broken}\n```')).toBeNull();
    });

    it('returns null for JSON without required fields', () => {
      expect(tryParseVerdict('```json\n{"foo":"bar"}\n```')).toBeNull();
    });
  });
});
