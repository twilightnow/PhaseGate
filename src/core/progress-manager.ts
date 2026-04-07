import * as path from 'path';
import * as fse from 'fs-extra';
import type { PhaseId, ProjectProgress } from '../types';

const PROGRESS_JSON = path.join('.phasegate', 'progress.json');
const PROGRESS_MD = path.join('.phasegate', 'progress.md');

const STATUS_SECTION_START = '<!-- ==================== Status Section ==================== -->';
const SUMMARY_SECTION_START = '<!-- ==================== Phase Summary ==================== -->';
const SUMMARY_SECTION_NOTE =
  '<!-- Append phase summaries below. Existing summaries should not be edited. -->';

type L10n = {
  phaseNames: Record<PhaseId, string>;
  title: string;
  notice: string;
  lastUpdated: string;
  currentPhase: string;
  requirements: string;
  design: string;
  modules: string;
  contracts: string;
  designReviewPassed: string;
  moduleDevelopment: string;
  codeReview: string;
  codeReviewPassed: string;
  blockers: string;
  notStarted: string;
  filledAfterPhase1: string;
  none: string;
  phaseSummaryHeading: (phase: PhaseId) => string;
};

const L10N: Record<string, L10n> = {
  zh: {
    phaseNames: {
      0: '需求讨论',
      1: '设计生成',
      2: '设计评审',
      3: '并行模块开发',
      4: '代码评审',
      5: '验收',
    },
    title: '项目进度',
    notice: '本文件由 PhaseGate 维护，请勿手动编辑状态区段。',
    lastUpdated: '最后更新',
    currentPhase: '## 当前阶段',
    requirements: '## 需求',
    design: '## 设计',
    modules: '### 模块',
    contracts: '### 接口契约',
    designReviewPassed: '设计评审通过',
    moduleDevelopment: '## 模块开发',
    codeReview: '## 代码评审',
    codeReviewPassed: '代码评审通过',
    blockers: '## 阻塞项',
    notStarted: '（未开始）',
    filledAfterPhase1: '（Phase 1 后填充）',
    none: '无',
    phaseSummaryHeading: (phase) => `## Phase ${phase} Summary`,
  },
  ja: {
    phaseNames: {
      0: '要件定義',
      1: 'デザイン生成',
      2: 'デザインレビュー',
      3: '並行モジュール開発',
      4: 'コードレビュー',
      5: '受入',
    },
    title: 'プロジェクト進捗',
    notice: 'このファイルは PhaseGate によって管理されています。ステータスセクションを手動編集しないでください。',
    lastUpdated: '最終更新',
    currentPhase: '## 現在のフェーズ',
    requirements: '## 要件',
    design: '## 設計',
    modules: '### モジュール',
    contracts: '### インターフェース契約',
    designReviewPassed: 'デザインレビュー通過',
    moduleDevelopment: '## モジュール開発',
    codeReview: '## コードレビュー',
    codeReviewPassed: 'コードレビュー通過',
    blockers: '## ブロッカー',
    notStarted: '（未着手）',
    filledAfterPhase1: '（Phase 1 後に記入）',
    none: 'なし',
    phaseSummaryHeading: (phase) => `## Phase ${phase} Summary`,
  },
  en: {
    phaseNames: {
      0: 'Requirements Discussion',
      1: 'Design Generation',
      2: 'Design Review',
      3: 'Parallel Module Development',
      4: 'Code Review',
      5: 'Acceptance',
    },
    title: 'Project Progress',
    notice: 'This file is maintained by PhaseGate. Do not manually edit the status section.',
    lastUpdated: 'Last updated',
    currentPhase: '## Current Phase',
    requirements: '## Requirements',
    design: '## Design',
    modules: '### Modules',
    contracts: '### Contracts',
    designReviewPassed: 'Design review passed',
    moduleDevelopment: '## Module Development',
    codeReview: '## Code Review',
    codeReviewPassed: 'Code review passed',
    blockers: '## Blockers',
    notStarted: '(not started)',
    filledAfterPhase1: '(filled after Phase 1)',
    none: 'None',
    phaseSummaryHeading: (phase) => `## Phase ${phase} Summary`,
  },
};

function getL10n(locale?: string): L10n {
  return L10N[locale ?? 'zh'] ?? L10N['zh'];
}

export interface IProgressManager {
  read(cwd: string): ProjectProgress;
  write(cwd: string, progress: ProjectProgress): void;
  updatePhase(cwd: string, phase: PhaseId): void;
  markModuleDone(cwd: string, moduleName: string): void;
  markModuleFailed(cwd: string, moduleName: string, error: string): void;
  markModuleBlocked(cwd: string, moduleName: string, blockedBy: string): void;
  appendPhaseSummary(cwd: string, phase: PhaseId, summary: string): void;
}

export class ProgressManager implements IProgressManager {
  read(cwd: string): ProjectProgress {
    const jsonPath = path.join(cwd, PROGRESS_JSON);
    if (!fse.existsSync(jsonPath)) {
      throw new Error(
        `progress.json not found in ${cwd}. Run 'phasegate init' first.`
      );
    }
    return fse.readJsonSync(jsonPath) as ProjectProgress;
  }

  write(cwd: string, progress: ProjectProgress): void {
    fse.writeJsonSync(path.join(cwd, PROGRESS_JSON), progress, { spaces: 2 });
    this._syncMdStatus(cwd, progress);
  }

  updatePhase(cwd: string, phase: PhaseId): void {
    const progress = this.read(cwd);
    progress.currentPhase = phase;
    this.write(cwd, progress);
  }

  markModuleDone(cwd: string, moduleName: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'done';
    this.write(cwd, progress);
  }

  markModuleFailed(cwd: string, moduleName: string, error: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'failed';
    const blockerEntry = `[${moduleName}] ${error}`;
    if (!progress.blockers.includes(blockerEntry)) {
      progress.blockers.push(blockerEntry);
    }
    this.write(cwd, progress);
  }

  markModuleBlocked(cwd: string, moduleName: string, blockedBy: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'blocked';
    mod.blockedBy = blockedBy;
    this.write(cwd, progress);
  }

  appendPhaseSummary(cwd: string, phase: PhaseId, summary: string): void {
    const mdPath = path.join(cwd, PROGRESS_MD);
    if (!fse.existsSync(mdPath)) {
      throw new Error(`progress.md not found in ${cwd}`);
    }
    const existing = fse.readFileSync(mdPath, 'utf-8');
    const progress = this.read(cwd);
    const l = getL10n(progress.locale);
    const block = `\n${l.phaseSummaryHeading(phase)}\n\n${summary}\n`;
    fse.writeFileSync(mdPath, existing + block, 'utf-8');
  }

  private _syncMdStatus(cwd: string, progress: ProjectProgress): void {
    const mdPath = path.join(cwd, PROGRESS_MD);
    const existing = fse.existsSync(mdPath)
      ? fse.readFileSync(mdPath, 'utf-8')
      : '';

    const summaryIdx = existing.indexOf(SUMMARY_SECTION_START);
    const summaryTail =
      summaryIdx >= 0
        ? '\n' + existing.slice(summaryIdx)
        : `\n${SUMMARY_SECTION_START}\n${SUMMARY_SECTION_NOTE}\n`;

    const statusBody = this._buildStatusSection(progress);
    const newContent = STATUS_SECTION_START + '\n\n' + statusBody + summaryTail;

    fse.writeFileSync(mdPath, newContent, 'utf-8');
  }

  private _buildStatusSection(progress: ProjectProgress): string {
    const l = getL10n(progress.locale);
    const lines: string[] = [];
    const phaseName = l.phaseNames[progress.currentPhase];
    const today = new Date().toISOString().split('T')[0];

    lines.push(`# ${progress.projectName} ${l.title}`);
    lines.push('');
    lines.push(`> ${l.notice}`);
    lines.push('');
    lines.push(`${l.lastUpdated}: ${today}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push(l.currentPhase);
    lines.push('');
    lines.push(`Phase ${progress.currentPhase}: ${phaseName}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push(l.requirements);
    lines.push('');
    if (progress.requirements.length === 0) {
      lines.push(l.notStarted);
    } else {
      for (const req of progress.requirements) {
        const tick = req.status === 'done' ? 'x' : ' ';
        lines.push(`- [${tick}] ${req.name}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push(l.design);
    lines.push('');
    if (progress.design.modules.length === 0) {
      lines.push(l.filledAfterPhase1);
      lines.push('');
    } else {
      lines.push(l.modules);
      lines.push('');
      for (const mod of progress.design.modules) {
        const tick = mod.status === 'done' ? 'x' : ' ';
        lines.push(`- [${tick}] ${mod.name}`);
      }
      lines.push('');
    }
    if (progress.design.contracts.length > 0) {
      lines.push(l.contracts);
      lines.push('');
      lines.push('| Contract | Status | Provider | Consumers |');
      lines.push('|---|---|---|---|');
      for (const c of progress.design.contracts) {
        lines.push(
          `| ${c.name} | ${c.status} | ${c.provider} | ${c.consumers.join(', ')} |`
        );
      }
      lines.push('');
    }
    const reviewTick = progress.design.reviewPassed ? 'x' : ' ';
    lines.push(`- [${reviewTick}] ${l.designReviewPassed}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push(l.moduleDevelopment);
    lines.push('');
    if (progress.modules.length === 0) {
      lines.push(l.filledAfterPhase1);
    } else {
      for (const mod of progress.modules) {
        const tick = mod.status === 'done' ? 'x' : ' ';
        const statusNote =
          mod.status !== 'pending' && mod.status !== 'done'
            ? ` - ${mod.status}`
            : '';
        const blockedNote = mod.blockedBy
          ? ` (blocked by ${mod.blockedBy})`
          : '';
        lines.push(`- [${tick}] ${mod.name}${statusNote}${blockedNote}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push(l.codeReview);
    lines.push('');
    const codeReviewTick = progress.codeReviewPassed ? 'x' : ' ';
    lines.push(`- [${codeReviewTick}] ${l.codeReviewPassed}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    lines.push(l.blockers);
    lines.push('');
    if (progress.blockers.length === 0) {
      lines.push(l.none);
    } else {
      for (const b of progress.blockers) {
        lines.push(`- ${b}`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }
}
