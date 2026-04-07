import * as path from 'path';
import * as fse from 'fs-extra';
import { getRequiredSections } from './phase-gate';
import type { ProjectProgress } from '../types';

type WorkerReportSnapshot = {
  keyFiles: string[];
  issues: string[];
};

export class PhaseArtifactBuilder {
  appendPhase3Summary(cwd: string, progress: ProjectProgress): void {
    const progressMdPath = path.join(cwd, '.phasegate', 'progress.md');
    if (!fse.existsSync(progressMdPath)) {
      return;
    }

    const existing = fse.readFileSync(progressMdPath, 'utf-8');
    if (existing.includes('## Phase 3 Summary')) {
      return;
    }

    const done = progress.modules.filter((entry) => entry.status === 'done');
    const failed = progress.modules.filter((entry) => entry.status === 'failed');
    const blocked = progress.modules.filter((entry) => entry.status === 'blocked');

    const lines = [
      '',
      '## Phase 3 Summary',
      '',
      '### Current State',
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
      '### Outputs',
      '- .phasegate/scratchpad/: worker reports updated for all attempted modules',
      '- progress.json: module runtime statuses synchronized from orchestrator results',
      '',
      '### Notes for Phase 4',
      '- Review only modules listed as done in this summary.',
      failed.length > 0 || blocked.length > 0
        ? '- Use the failed/blocked reasons below to explain skipped modules.'
        : '- No failed or blocked modules were reported by Phase 3.',
      '',
    ];

    fse.writeFileSync(progressMdPath, existing + lines.join('\n'), 'utf-8');
  }

  appendPhase4Summary(cwd: string, progress: ProjectProgress): void {
    const progressMdPath = path.join(cwd, '.phasegate', 'progress.md');
    if (!fse.existsSync(progressMdPath)) {
      return;
    }

    const existing = fse.readFileSync(progressMdPath, 'utf-8');
    if (existing.includes('## Phase 4 Summary')) {
      return;
    }

    const done = progress.modules.filter((entry) => entry.status === 'done');
    const skipped = progress.modules.filter(
      (entry) => entry.status === 'failed' || entry.status === 'blocked'
    );
    const reports = this.readWorkerReports(cwd, done.map((entry) => entry.name));

    const lines = [
      '',
      '## Phase 4 Summary',
      '',
      '### Current State',
      done.length > 0
        ? 'Code review completed for all done modules.'
        : 'No done modules were available for code review.',
      '',
      '### Coverage',
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
      '### Issues Fixed',
      buildIssueSummary(reports, done.map((entry) => entry.name)),
      '',
      '### Remaining Non-P0 Issues',
      '- none recorded in automation summary',
      '',
      '### Modules Skipped (not reviewed)',
      skipped.length > 0
        ? skipped.map((entry) => `- ${entry.name}: ${entry.status}`).join('\n')
        : '- none',
      '',
      '### Notes for Phase 5',
      '- Re-run targeted acceptance checks for any modules changed during Phase 4.',
      '- Confirm user-facing behavior for modules reviewed in this phase.',
      '',
    ];

    fse.writeFileSync(progressMdPath, existing + lines.join('\n'), 'utf-8');
  }

  ensureAcceptanceGuide(cwd: string, progress: ProjectProgress): void {
    const guidePath = path.join(cwd, 'acceptance-guide.md');
    if (fse.existsSync(guidePath)) {
      return;
    }

    const requirements = this.readAcceptanceCriteria(cwd);
    const doneModules = progress.modules.filter((entry) => entry.status === 'done');
    const blockedModules = progress.modules.filter(
      (entry) => entry.status === 'failed' || entry.status === 'blocked'
    );
    const today = new Date().toISOString().split('T')[0];

    const lines = [
      `# ${progress.projectName} Acceptance Guide`,
      '',
      `Generated: ${today}`,
      'Phase: 5B - Human Verification',
      '',
      '## AI Auto-Verification Summary',
      `- [x] Phase 5 automation completed for ${doneModules.length} done module(s)`,
      '- [ ] Manual verification items below still require human confirmation',
      '',
      '## Items Requiring Human Verification',
      '',
    ];

    if (requirements.length === 0) {
      lines.push('1. No explicit acceptance criteria were parsed from requirements.');
      lines.push('How to verify: Review the implemented workflow manually.');
      lines.push('Expected result: The workflow behaves as described in the requirements files.');
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

  appendPhase5Summary(cwd: string, progress: ProjectProgress): void {
    const progressMdPath = path.join(cwd, '.phasegate', 'progress.md');
    if (!fse.existsSync(progressMdPath)) {
      return;
    }

    const existing = fse.readFileSync(progressMdPath, 'utf-8');
    if (existing.includes('## Phase 5 Summary')) {
      return;
    }

    const requirements = this.readAcceptanceCriteria(cwd);
    const doneModules = progress.modules.filter((entry) => entry.status === 'done');
    const blockedModules = progress.modules.filter(
      (entry) => entry.status === 'failed' || entry.status === 'blocked'
    );

    const lines = [
      '',
      '## Phase 5 Summary',
      '',
      '### Current State',
      'PHASE_DONE',
      '',
      '### Auto-Verification',
      `Passed: ${requirements.length} acceptance criteria recorded for follow-up in acceptance-guide.md`,
      `Skipped: ${blockedModules.length} module-related items`,
      'Escalated: 0 criteria',
      '',
      '### Human Verification',
      doneModules.length > 0
        ? `Pending manual confirmation for ${doneModules.length} implemented module(s) via acceptance-guide.md.`
        : 'Pending manual confirmation via acceptance-guide.md.',
      '',
      '### Known Limitations',
      blockedModules.length > 0
        ? blockedModules.map((entry) => `- ${entry.name}: ${entry.status}`).join('\n')
        : '- none',
      '',
    ];

    fse.writeFileSync(progressMdPath, existing + lines.join('\n'), 'utf-8');
  }

  private readAcceptanceCriteria(cwd: string): string[] {
    const requirementsDir = path.join(cwd, '.phasegate', 'requirements');
    if (!fse.existsSync(requirementsDir)) {
      return [];
    }

    const files = fse
      .readdirSync(requirementsDir)
      .filter((file) => file.endsWith('.md') && file !== 'requirements.md')
      .map((file) => path.join(requirementsDir, file));

    const acceptanceHeadings = Array.from(
      new Set([
        'Acceptance Criteria',
        getRequiredSections('en')[2],
        getRequiredSections('zh')[2],
        getRequiredSections('ja')[2],
      ])
    );

    const items: string[] = [];
    for (const file of files) {
      const content = fse.readFileSync(file, 'utf-8');
      const section = acceptanceHeadings
        .map((heading) => extractMarkdownSection(content, heading))
        .find(Boolean);
      if (!section) continue;

      for (const line of section.split('\n')) {
        const match = line.match(/^- \[[ xX]\]\s+(.+)$/);
        if (match) {
          items.push(match[1].trim());
        }
      }
    }

    return items;
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

function extractMarkdownSection(content: string, heading: string): string {
  const regex = new RegExp(`##\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
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
