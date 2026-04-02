import * as path from 'path';
import * as fse from 'fs-extra';
import type { PhaseId, ProjectProgress } from '../types';

const PROGRESS_JSON = path.join('.phasegate', 'progress.json');
const PROGRESS_MD = path.join('.phasegate', 'progress.md');

const STATUS_SECTION_START = '<!-- ==================== 状态区 ==================== -->';
const SUMMARY_SECTION_START = '<!-- ==================== Phase Summary 区 ==================== -->';
const SUMMARY_SECTION_NOTE = '<!-- 每个阶段完成后追加，已写入的 Summary 不可修改 -->';

const PHASE_NAMES: Record<PhaseId, string> = {
  0: '需求讨论',
  1: '设计书生成',
  2: '设计书 review',
  3: '模块并行开发',
  4: '代码 review',
  5: '验收',
};

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
  /**
   * Read progress.json (source of truth) and return parsed ProjectProgress.
   * Throws if progress.json does not exist.
   */
  read(cwd: string): ProjectProgress {
    const jsonPath = path.join(cwd, PROGRESS_JSON);
    if (!fse.existsSync(jsonPath)) {
      throw new Error(
        `progress.json not found in ${cwd}. Run 'phasegate init' first.`
      );
    }
    return fse.readJsonSync(jsonPath) as ProjectProgress;
  }

  /**
   * Write progress.json (source of truth) and regenerate the status section
   * of progress.md, preserving the Phase Summary section.
   */
  write(cwd: string, progress: ProjectProgress): void {
    fse.writeJsonSync(path.join(cwd, PROGRESS_JSON), progress, { spaces: 2 });
    this._syncMdStatus(cwd, progress);
  }

  /** Update currentPhase field and persist. */
  updatePhase(cwd: string, phase: PhaseId): void {
    const progress = this.read(cwd);
    progress.currentPhase = phase;
    this.write(cwd, progress);
  }

  /** Mark a runtime module as done. */
  markModuleDone(cwd: string, moduleName: string): void {
    const progress = this.read(cwd);
    const mod = progress.modules.find((m) => m.name === moduleName);
    if (!mod) {
      throw new Error(`Module '${moduleName}' not found in progress.json`);
    }
    mod.status = 'done';
    this.write(cwd, progress);
  }

  /** Mark a runtime module as failed and append to blockers. */
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

  /** Mark a runtime module as blocked by another module. */
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

  /**
   * Append a Phase Summary block to progress.md (Phase Summary 区).
   * This section is append-only; existing summaries are never modified.
   */
  appendPhaseSummary(cwd: string, phase: PhaseId, summary: string): void {
    const mdPath = path.join(cwd, PROGRESS_MD);
    if (!fse.existsSync(mdPath)) {
      throw new Error(`progress.md not found in ${cwd}`);
    }
    const existing = fse.readFileSync(mdPath, 'utf-8');
    const block = `\n## Phase ${phase} Summary\n\n${summary}\n`;
    fse.writeFileSync(mdPath, existing + block, 'utf-8');
  }

  // ── private helpers ──────────────────────────────────────────────────────

  /** Regenerate the status section of progress.md, keeping Phase Summary intact. */
  private _syncMdStatus(cwd: string, progress: ProjectProgress): void {
    const mdPath = path.join(cwd, PROGRESS_MD);
    const existing = fse.existsSync(mdPath)
      ? fse.readFileSync(mdPath, 'utf-8')
      : '';

    // Preserve everything from SUMMARY_SECTION_START onward (append-only area).
    const summaryIdx = existing.indexOf(SUMMARY_SECTION_START);
    const summaryTail =
      summaryIdx >= 0
        ? '\n' + existing.slice(summaryIdx)
        : `\n${SUMMARY_SECTION_START}\n${SUMMARY_SECTION_NOTE}\n`;

    const statusBody = this._buildStatusSection(progress);
    const newContent =
      STATUS_SECTION_START + '\n\n' + statusBody + summaryTail;

    fse.writeFileSync(mdPath, newContent, 'utf-8');
  }

  /** Build the status section markdown from a ProjectProgress object. */
  private _buildStatusSection(progress: ProjectProgress): string {
    const lines: string[] = [];
    const phaseName = PHASE_NAMES[progress.currentPhase];
    const today = new Date().toISOString().split('T')[0];

    lines.push(`# ${progress.projectName} — Project Progress`);
    lines.push('');
    lines.push(
      '> 本文档由 phasegate 自动维护，状态区请勿手动修改。'
    );
    lines.push('');
    lines.push(`最后更新：${today}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 当前阶段
    lines.push('## 当前阶段');
    lines.push('');
    lines.push(`Phase ${progress.currentPhase}：${phaseName}`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 需求
    lines.push('## 需求');
    lines.push('');
    if (progress.requirements.length === 0) {
      lines.push('（未开始）');
    } else {
      for (const req of progress.requirements) {
        const tick = req.status === 'done' ? 'x' : ' ';
        lines.push(`- [${tick}] ${req.name}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // 设计
    lines.push('## 设计');
    lines.push('');
    if (progress.design.modules.length === 0) {
      lines.push('（Phase 1 完成后填写）');
      lines.push('');
    } else {
      lines.push('### 模块列表');
      lines.push('');
      for (const mod of progress.design.modules) {
        const tick = mod.status === 'done' ? 'x' : ' ';
        lines.push(`- [${tick}] ${mod.name}`);
      }
      lines.push('');
    }
    if (progress.design.contracts.length > 0) {
      lines.push('### 接口契约状态');
      lines.push('');
      lines.push('| 接口 | 状态 | 实现方 | 依赖方 |');
      lines.push('|---|---|---|---|');
      for (const c of progress.design.contracts) {
        lines.push(
          `| ${c.name} | ${c.status} | ${c.provider} | ${c.consumers.join(', ')} |`
        );
      }
      lines.push('');
    }
    const reviewTick = progress.design.reviewPassed ? 'x' : ' ';
    lines.push(`- [${reviewTick}] 设计书 review 通过`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 模块开发
    lines.push('## 模块开发');
    lines.push('');
    if (progress.modules.length === 0) {
      lines.push('（Phase 1 完成后填写）');
    } else {
      for (const mod of progress.modules) {
        const tick = mod.status === 'done' ? 'x' : ' ';
        const statusNote =
          mod.status !== 'pending' && mod.status !== 'done'
            ? ` — ${mod.status}`
            : '';
        const blockedNote = mod.blockedBy
          ? `（blocked by ${mod.blockedBy}）`
          : '';
        lines.push(`- [${tick}] ${mod.name}${statusNote}${blockedNote}`);
      }
    }
    lines.push('');
    lines.push('---');
    lines.push('');

    // 代码 review
    lines.push('## 代码 review');
    lines.push('');
    const codeReviewTick = progress.codeReviewPassed ? 'x' : ' ';
    lines.push(`- [${codeReviewTick}] 代码 review 通过`);
    lines.push('');
    lines.push('---');
    lines.push('');

    // 阻塞项
    lines.push('## 阻塞项');
    lines.push('');
    if (progress.blockers.length === 0) {
      lines.push('无');
    } else {
      for (const b of progress.blockers) {
        lines.push(`- ${b}`);
      }
    }
    lines.push('');

    return lines.join('\n');
  }
}
