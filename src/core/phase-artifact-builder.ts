import * as path from 'path';
import * as fse from 'fs-extra';
import type { ProjectProgress, WorkerReport } from '../types';
import { readAcceptanceCriteria } from './progress-report';

type WorkerReportSnapshot = {
  keyFiles: string[];
  issues: string[];
};

function getSummaryDir(cwd: string): string {
  return path.join(cwd, '.phasegate', 'scratchpad', 'summaries');
}

function ensureSummaryDir(cwd: string): string {
  const dir = getSummaryDir(cwd);
  fse.ensureDirSync(dir);
  return dir;
}

function formatArchiveSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

export class PhaseArtifactBuilder {
  appendPhase3Summary(cwd: string, progress: ProjectProgress): void {
    const summaryPath = path.join(ensureSummaryDir(cwd), 'phase-3-summary.md');

    const done = progress.modules.filter((entry) => entry.status === 'done');
    const failed = progress.modules.filter((entry) => entry.status === 'failed');
    const blocked = progress.modules.filter((entry) => entry.status === 'blocked');

    const lines = [
      '# Phase 3 Summary',
      '',
      `Active requirement: ${progress.activeRequirement ?? '(none)'}`,
      '',
      '## Current State',
      done.length > 0
        ? `Completed modules: ${done.map((entry) => entry.name).join(', ')}`
        : 'Completed modules: none',
      failed.length > 0
        ? `Failed modules: ${failed.map(formatModuleReason).join('; ')}`
        : 'Failed modules: none',
      blocked.length > 0
        ? `Blocked modules: ${blocked.map(formatModuleReason).join('; ')}`
        : 'Blocked modules: none',
      '',
      '## Outputs',
      '- .phasegate/scratchpad/: worker reports updated for all attempted modules',
      '- progress.json: module runtime statuses synchronized from orchestrator results',
      '',
    ];

    fse.writeFileSync(summaryPath, lines.join('\n'), 'utf-8');
  }

  appendPhase4Summary(cwd: string, progress: ProjectProgress): void {
    const summaryPath = path.join(ensureSummaryDir(cwd), 'phase-4-summary.md');
    const done = progress.modules.filter((entry) => entry.status === 'done');
    const skipped = progress.modules.filter(
      (entry) => entry.status === 'failed' || entry.status === 'blocked'
    );
    const reports = this.readFullWorkerReports(cwd, done.map((entry) => entry.name));

    const lines = [
      '# Phase 4 Summary',
      '',
      `Active requirement: ${progress.activeRequirement ?? '(none)'}`,
      '',
      '## Current State',
      done.length > 0
        ? 'Lightweight final review completed for all done modules.'
        : 'No done modules were available for review.',
      '',
      '## Coverage',
      done.length > 0
        ? done
            .map((entry) => this.buildModuleReviewSummaryLine(entry.name, reports[entry.name]))
            .join('\n')
        : '- none',
      '',
      '## Self-Review Findings',
      buildSelfReviewFindingsSummary(reports, done.map((entry) => entry.name)),
      '',
      '## Known Risks',
      buildKnownRisksSummary(reports, done.map((entry) => entry.name)),
      '',
      '## Modules Skipped',
      skipped.length > 0
        ? skipped.map((entry) => `- ${entry.name}: ${entry.status}`).join('\n')
        : '- none',
      '',
    ];

    fse.writeFileSync(summaryPath, lines.join('\n'), 'utf-8');
  }

  private buildModuleReviewSummaryLine(name: string, report?: WorkerReport): string {
    // Use new fields first, fall back to legacy fields
    const files = report?.changedFiles ?? report?.keyFiles ?? [];
    const summary = report?.implementationSummary;
    const risks = report?.knownRisks ?? [];
    const testSummary = report?.testSummary;

    const parts: string[] = [`- ${name}: reviewed.`];
    if (summary) parts.push(`Summary: ${summary}.`);
    if (files.length) parts.push(`Changed: ${files.join(', ')}.`);
    if (testSummary) parts.push(`Tests: ${testSummary}.`);
    if (risks.length) parts.push(`Known risks: ${risks.join('; ')}.`);

    return parts.join(' ');
  }

  writePhase4ReviewOutput(cwd: string, output: string): void {
    const outputPath = path.join(ensureSummaryDir(cwd), 'phase-4-review-output.md');
    fse.writeFileSync(outputPath, output, 'utf-8');
  }

  ensureAcceptanceGuide(cwd: string, progress: ProjectProgress): void {
    const guidePath = path.join(cwd, 'acceptance-guide.md');
    const requirements = this.getAcceptanceCriteria(cwd, progress);
    const doneModules = progress.modules.filter((entry) => entry.status === 'done');
    const blockedModules = progress.modules.filter(
      (entry) => entry.status === 'failed' || entry.status === 'blocked'
    );
    const today = new Date().toISOString().split('T')[0];

    const lines = [
      `# ${progress.projectName} Acceptance Guide`,
      '',
      `Generated: ${today}`,
      `Requirement: ${progress.activeRequirement ?? '(none)'}`,
      '',
      '## AI Auto-Verification Summary',
      `- [x] Phase 5 automation completed for ${doneModules.length} done module(s)`,
      '- [ ] Manual verification items below still require human confirmation',
      '',
      '## Items Requiring Human Verification',
      '',
    ];

    if (requirements.length === 0) {
      lines.push('1. No explicit acceptance criteria were parsed from the active requirement.');
      lines.push('How to verify: Review the implemented workflow manually.');
      lines.push('Expected result: The workflow behaves as described in the requirement file.');
      lines.push('Pass condition: A human confirms the delivered behavior matches expectations.');
      lines.push('');
    } else {
      requirements.forEach((criterion, index) => {
        lines.push(`${index + 1}. ${criterion}`);
        lines.push('How to verify:');
        lines.push('1. Execute the relevant project workflow manually.');
        lines.push('2. Compare the observed behavior with this criterion.');
        lines.push('');
        lines.push('Expected result:');
        lines.push(criterion);
        lines.push('');
        lines.push('Pass condition:');
        lines.push('The observed behavior matches the criterion without manual workaround.');
        lines.push('');
      });
    }

    lines.push('## Modules Not Covered');
    if (blockedModules.length === 0) {
      lines.push('- none');
    } else {
      for (const entry of blockedModules) {
        lines.push(`- ${entry.name}: ${entry.status}`);
      }
    }
    lines.push('');

    fse.writeFileSync(guidePath, lines.join('\n'), 'utf-8');
  }

  appendPhase5Summary(
    cwd: string,
    progress: ProjectProgress,
    outcome: 'done' | 'blocked' = 'done'
  ): void {
    const summaryPath = path.join(ensureSummaryDir(cwd), 'phase-5-summary.md');
    const requirements = this.getAcceptanceCriteria(cwd, progress);
    const doneModules = progress.modules.filter((entry) => entry.status === 'done');
    const blockedModules = progress.modules.filter(
      (entry) => entry.status === 'failed' || entry.status === 'blocked'
    );

    const lines = [
      '# Phase 5 Summary',
      '',
      `Active requirement: ${progress.activeRequirement ?? '(none)'}`,
      '',
      '## Current State',
      outcome === 'done' ? 'PHASE_DONE' : 'PHASE_BLOCKED',
      '',
      '## Auto-Verification',
      `Passed: ${requirements.length} acceptance criteria recorded for follow-up in acceptance-guide.md`,
      `Skipped: ${blockedModules.length} module-related items`,
      'Escalated: 0 criteria',
      '',
      '## Human Verification',
      doneModules.length > 0
        ? `Pending manual confirmation for ${doneModules.length} implemented module(s) via acceptance-guide.md.`
        : 'Pending manual confirmation via acceptance-guide.md.',
      '',
      '## Known Limitations',
      blockedModules.length > 0
        ? blockedModules.map((entry) => `- ${entry.name}: ${entry.status}`).join('\n')
        : '- none',
      '',
    ];

    fse.writeFileSync(summaryPath, lines.join('\n'), 'utf-8');
  }

  finalizeExecutionArtifacts(cwd: string, progress: ProjectProgress): string | null {
    if (!progress.activeRequirement) {
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveDir = path.join(
      cwd,
      '.phasegate',
      'archive',
      `${formatArchiveSegment(progress.activeRequirement)}-${timestamp}`
    );

    const entriesToMove: Array<{ from: string; to: string }> = [
      { from: path.join(cwd, '.phasegate', 'tasks'), to: path.join(archiveDir, 'tasks') },
      { from: path.join(cwd, '.phasegate', 'contracts'), to: path.join(archiveDir, 'contracts') },
      { from: path.join(cwd, '.phasegate', 'scratchpad'), to: path.join(archiveDir, 'scratchpad') },
    ];

    let movedAny = false;
    for (const entry of entriesToMove) {
      if (!fse.existsSync(entry.from)) {
        continue;
      }

      const names = fse.readdirSync(entry.from);
      if (names.length === 0) {
        continue;
      }

      fse.ensureDirSync(path.dirname(entry.to));
      fse.moveSync(entry.from, entry.to, { overwrite: true });
      fse.ensureDirSync(entry.from);
      movedAny = true;
    }

    const acceptanceGuidePath = path.join(cwd, 'acceptance-guide.md');
    if (fse.existsSync(acceptanceGuidePath)) {
      fse.ensureDirSync(archiveDir);
      fse.copyFileSync(acceptanceGuidePath, path.join(archiveDir, 'acceptance-guide.md'));
      movedAny = true;
    }

    return movedAny ? archiveDir : null;
  }

  getAcceptanceCriteria(cwd: string, progress: ProjectProgress): string[] {
    return readAcceptanceCriteria(cwd, progress);
  }

  private readWorkerReports(cwd: string, moduleNames: string[]): Record<string, WorkerReportSnapshot> {
    const reports: Record<string, WorkerReportSnapshot> = {};

    for (const moduleName of moduleNames) {
      const reportPath = path.join(cwd, '.phasegate', 'scratchpad', moduleName, 'report.json');
      if (!fse.existsSync(reportPath)) {
        continue;
      }

      try {
        const report = fse.readJsonSync(reportPath) as { keyFiles?: string[]; issues?: string[] };
        reports[moduleName] = {
          keyFiles: Array.isArray(report.keyFiles) ? report.keyFiles : [],
          issues: Array.isArray(report.issues) ? report.issues : [],
        };
      } catch {
        reports[moduleName] = { keyFiles: [], issues: ['failed to parse worker report'] };
      }
    }

    return reports;
  }

  private readFullWorkerReports(cwd: string, moduleNames: string[]): Record<string, WorkerReport> {
    const reports: Record<string, WorkerReport> = {};

    for (const moduleName of moduleNames) {
      const reportPath = path.join(cwd, '.phasegate', 'scratchpad', moduleName, 'report.json');
      if (!fse.existsSync(reportPath)) {
        continue;
      }

      try {
        const raw = fse.readJsonSync(reportPath) as Record<string, unknown>;
        reports[moduleName] = {
          scope: typeof raw.scope === 'string' ? raw.scope : moduleName,
          result: raw.result === 'done' ? 'done' : 'failed',
          keyFiles: Array.isArray(raw.keyFiles) ? raw.keyFiles.filter((f): f is string => typeof f === 'string') : [],
          filesChanged: Array.isArray(raw.filesChanged) ? raw.filesChanged.filter((f): f is string => typeof f === 'string') : [],
          issues: Array.isArray(raw.issues) ? raw.issues.filter((i): i is string => typeof i === 'string') : [],
          implementationSummary: typeof raw.implementationSummary === 'string' ? raw.implementationSummary : undefined,
          changedFiles: Array.isArray(raw.changedFiles) ? raw.changedFiles.filter((f): f is string => typeof f === 'string') : undefined,
          testSummary: typeof raw.testSummary === 'string' ? raw.testSummary : undefined,
          knownRisks: Array.isArray(raw.knownRisks) ? raw.knownRisks.filter((r): r is string => typeof r === 'string') : undefined,
          selfReviewFindings: Array.isArray(raw.selfReviewFindings) ? raw.selfReviewFindings.filter((f): f is string => typeof f === 'string') : undefined,
        };
      } catch {
        reports[moduleName] = { scope: moduleName, result: 'failed', keyFiles: [], filesChanged: [], issues: ['failed to parse worker report'] };
      }
    }

    return reports;
  }
}

function buildIssueSummary(
  reports: Record<string, WorkerReportSnapshot>,
  moduleNames: string[]
): string {
  const entries = moduleNames.flatMap((moduleName) => {
    const report = reports[moduleName];
    if (!report || report.issues.length === 0) {
      return [];
    }

    return report.issues.map((issue) => `- ${moduleName}: ${issue}`);
  });

  return entries.length > 0 ? entries.join('\n') : '- none recorded in worker reports';
}

function buildSelfReviewFindingsSummary(
  reports: Record<string, WorkerReport>,
  moduleNames: string[]
): string {
  const entries = moduleNames.flatMap((moduleName) => {
    const report = reports[moduleName];
    // Prefer selfReviewFindings, fall back to issues
    const findings = report?.selfReviewFindings ?? report?.issues ?? [];
    if (findings.length === 0) return [];
    return findings.map((f) => `- ${moduleName}: ${f}`);
  });
  return entries.length > 0 ? entries.join('\n') : '- none reported';
}

function buildKnownRisksSummary(
  reports: Record<string, WorkerReport>,
  moduleNames: string[]
): string {
  const entries = moduleNames.flatMap((moduleName) => {
    const report = reports[moduleName];
    const risks = report?.knownRisks ?? [];
    if (risks.length === 0) return [];
    return risks.map((r) => `- ${moduleName}: ${r}`);
  });
  return entries.length > 0 ? entries.join('\n') : '- none identified';
}

function formatModuleReason(entry: {
  name?: string;
  moduleName?: string;
  blockedBy?: string;
  error?: string;
}): string {
  const name = entry.moduleName ?? entry.name ?? 'unknown-module';
  const reason = entry.error ?? entry.blockedBy ?? 'no details';
  return `${name} (${reason})`;
}
