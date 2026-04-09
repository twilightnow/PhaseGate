import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fse from 'fs-extra';
import { ProgressManager } from '../core/progress-manager';
import { runPhasesUntilDone } from './run';
import type { RequirementEntry } from '../types';

interface SummaryRow {
  name: string;
  priority: string;
  result: 'pass' | 'gate_failed';
  time: string;
}

function formatTimestamp(iso: string): string {
  // Replace colons and dots for safe filename use; keep the display friendly
  return iso.replace(/[:.]/g, '-');
}

async function writeLoopArchive(
  archivePath: string,
  rows: SummaryRow[],
  loopStartTime: string
): Promise<void> {
  await fse.ensureDir(path.dirname(archivePath));
  const passCount = rows.filter((r) => r.result === 'pass').length;
  const failCount = rows.filter((r) => r.result === 'gate_failed').length;

  const tableRows = rows
    .map((r) => `| ${r.name} | ${r.priority} | ${r.result} | ${r.time} |`)
    .join('\n');

  const content = [
    `# Loop Summary — ${loopStartTime}`,
    '',
    '| 需求 | 优先级 | 结果 | 时间 |',
    '|---|---|---|---|',
    tableRows || '| (none) | — | — | — |',
    '',
    `总计：运行 ${rows.length} 条，成功 ${passCount} 条，失败 ${failCount} 条`,
  ].join('\n');

  await fse.writeFile(archivePath, content, 'utf-8');
}

function printTerminalSummary(rows: SummaryRow[]): void {
  const passCount = rows.filter((r) => r.result === 'pass').length;
  const failCount = rows.filter((r) => r.result === 'gate_failed').length;
  console.log('');
  console.log(chalk.bold('Loop summary'));
  if (rows.length === 0) {
    console.log(chalk.dim('  No requirements were executed.'));
  } else {
    for (const row of rows) {
      const icon = row.result === 'pass' ? chalk.green('OK') : chalk.red('FAIL');
      console.log(`  ${icon} ${row.name} [priority: ${row.priority}]`);
    }
  }
  console.log(`Total: ${rows.length} run, ${passCount} passed, ${failCount} failed`);
}

export function createLoopCommand(): Command {
  const cmd = new Command('loop');

  cmd
    .description('Auto-select and run all approved requirements in priority order')
    .option('--dry-run', 'preview execution order without running')
    .action(async (options: { dryRun?: boolean }) => {
      const cwd = process.cwd();
      const pm = new ProgressManager();

      try {
        pm.syncRequirementsFromWorkspace(cwd);
      } catch {
        console.error(
          chalk.red('Error:') +
            ' progress.json not found. Run ' +
            chalk.bold('phasegate init') +
            ' first.'
        );
        process.exit(1);
      }

      if (options.dryRun) {
        const queue = pm.getQueuedRequirements(cwd);
        if (queue.length === 0) {
          console.log(chalk.yellow('!') + ' No approved requirements in queue.');
          return;
        }
        console.log(chalk.bold('Execution order (dry-run):'));
        queue.forEach((req: RequirementEntry, i: number) => {
          const priority = req.priority ?? 'normal';
          const approvedAt = req.approvedAt ?? '—';
          console.log(`  ${i + 1}. ${req.name}  [priority: ${priority}]  [approvedAt: ${approvedAt}]`);
        });
        return;
      }

      const loopStartTime = new Date().toISOString();
      const archivePath = path.join(
        cwd,
        '.phasegate',
        'archive',
        `loop-${formatTimestamp(loopStartTime)}.md`
      );
      const summaryRows: SummaryRow[] = [];

      // Resume active requirement if present
      const progress = pm.read(cwd);
      if (progress.activeRequirement) {
        const reqName = progress.activeRequirement;
        const reqEntry = pm
          .getQueuedRequirements(cwd)
          .find((r) => r.name === reqName) ?? pm.read(cwd).requirements.find((r) => r.name === reqName);
        const priority = reqEntry?.priority ?? 'normal';

        console.log(chalk.cyan('->') + ` Resuming active requirement: ${reqName}`);
        const result = await runPhasesUntilDone(cwd, pm);
        const time = new Date().toISOString();

        if (result === 'gate_failed') {
          summaryRows.push({ name: reqName, priority, result: 'gate_failed', time });
          console.error(chalk.red('!') + ` Gate failed for requirement: ${reqName}. Loop stopped.`);
          await writeLoopArchive(archivePath, summaryRows, loopStartTime);
          printTerminalSummary(summaryRows);
          return;
        }

        summaryRows.push({ name: reqName, priority, result: 'pass', time });
        pm.syncRequirementsFromWorkspace(cwd);
      }

      // Process queue dynamically
      while (true) {
        const nextQueue = pm.getQueuedRequirements(cwd);
        const next = nextQueue[0];
        if (!next) {
          console.log(chalk.dim('Queue is empty. Loop complete.'));
          break;
        }

        console.log(chalk.cyan('->') + ` Selecting requirement: ${next.name}`);
        try {
          pm.activateRequirement(cwd, next.name);
        } catch (err) {
          console.error(chalk.red('Error:'), err instanceof Error ? err.message : err);
          break;
        }

        const result = await runPhasesUntilDone(cwd, pm);
        const time = new Date().toISOString();

        if (result === 'gate_failed') {
          summaryRows.push({ name: next.name, priority: next.priority ?? 'normal', result: 'gate_failed', time });
          console.error(chalk.red('!') + ` Gate failed for requirement: ${next.name}. Loop stopped.`);
          break;
        }

        summaryRows.push({ name: next.name, priority: next.priority ?? 'normal', result: 'pass', time });
        pm.syncRequirementsFromWorkspace(cwd);
      }

      await writeLoopArchive(archivePath, summaryRows, loopStartTime);
      printTerminalSummary(summaryRows);
    });

  return cmd;
}
