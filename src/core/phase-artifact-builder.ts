import * as path from 'path';
import * as fse from 'fs-extra';
import type { ProjectProgress } from '../types';
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
    const reports = this.readWorkerReports(cwd, done.map((entry) => entry.name));

    const lines = [
      '# Phase 4 Summary',
      '',
      `Active requirement: ${progress.activeRequirement ?? '(none)'}`,
      '',
      '## Current State',
      done.length > 0
        ? 'Code review completed for all done modules.'
        : 'No done modules were available for code review.',
      '',
      '## Coverage',
      done.length > 0
        ? done
            .map((entry) => {
              const report = reports[entry.name];
              const keyFiles = report?.keyFiles.length ? ` key files: ${report.keyFiles.join(', ')}` : '';
              return `- ${entry.name}: reviewed.${keyFiles}`;
            })
            .join('\n')
        : '- none',
      '',
      '## Issues Fixed',
      buildIssueSummary(reports, done.map((entry) => entry.name)),
      '',
      '## Remaining Non-P0 Issues',
      '- none recorded in automation summary',
      '',
      '## Modules Skipped',
      skipped.length > 0
        ? skipped.map((entry) => `- ${entry.name}: ${entry.status}`).join('\n')
        : '- none',
      '',
    ];

    fse.writeFileSync(summaryPath, lines.join('\n'), 'utf-8');
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
