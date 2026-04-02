import { spawn } from 'child_process';
import * as path from 'path';
import * as fse from 'fs-extra';
import type { WorkerReport } from '../types';

export interface IAiRunner {
  /** Non-interactive: pass files + prompt, get result back */
  run(files: string[], prompt: string): Promise<string>;
  /**
   * Fork Worker mode: launch independent AI CLI subprocess for a single module.
   * Resolves after worker completes (don't peek principle).
   */
  fork(files: string[], prompt: string): Promise<WorkerReport>;
  /** Interactive: open dialog session for requirements discussion */
  chat(systemPrompt: string): Promise<void>;
}

/**
 * ClaudeRunner: calls the `claude` CLI.
 * Switch implementation via phasegate.config.json `runner` field.
 */
export class ClaudeRunner implements IAiRunner {
  async run(files: string[], prompt: string): Promise<string> {
    const fullPrompt = await buildContextPrompt(files, prompt);
    return spawnClaude(['-p', fullPrompt]);
  }

  async fork(files: string[], prompt: string): Promise<WorkerReport> {
    const fullPrompt = await buildContextPrompt(files, prompt);
    const output = await spawnClaude(['-p', fullPrompt]);
    return parseWorkerReport(output);
  }

  async chat(systemPrompt: string): Promise<void> {
    await spawnClaudeInteractive(systemPrompt);
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

async function buildContextPrompt(files: string[], prompt: string): Promise<string> {
  const parts: string[] = [];
  for (const filePath of files) {
    if (await fse.pathExists(filePath)) {
      const content = await fse.readFile(filePath, 'utf-8');
      parts.push(`--- FILE: ${path.basename(filePath)} ---\n${content}`);
    }
  }
  if (parts.length > 0) {
    return parts.join('\n\n') + '\n\n--- TASK ---\n' + prompt;
  }
  return prompt;
}

function spawnClaude(args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('claude', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });
    proc.stderr?.on('data', (data: Buffer) => { stderr += data.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`claude exited with code ${code}\n${stderr}`));
      } else {
        resolve(stdout.trim());
      }
    });

    proc.on('error', (err) => reject(err));
  });
}

async function spawnClaudeInteractive(systemPrompt: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const args = systemPrompt ? ['--system', systemPrompt] : [];
    const proc = spawn('claude', args, { stdio: 'inherit' });
    proc.on('close', () => resolve());
    proc.on('error', reject);
  });
}

// ── WorkerReport parser / formatter ──────────────────────────────────────────

export function parseWorkerReport(output: string): WorkerReport {
  const scope = extractSection(output, 'Scope') || 'unknown module';
  const resultText = extractSection(output, 'Result') || '';
  const keyFiles = extractListSection(output, 'Key Files');
  const filesChanged = extractListSection(output, 'Files Changed');
  const issues = extractListSection(output, 'Issues');

  return {
    scope,
    result: resultText.toLowerCase().includes('done') ? 'done' : 'failed',
    keyFiles,
    filesChanged,
    issues,
  };
}

export function formatWorkerReport(report: WorkerReport): string {
  const listOrNone = (items: string[]) =>
    items.length > 0 ? items.map((f) => `- ${f}`).join('\n') : '(none)';

  return [
    '## Scope',
    report.scope,
    '',
    '## Result',
    report.result,
    '',
    '## Key Files',
    listOrNone(report.keyFiles),
    '',
    '## Files Changed',
    listOrNone(report.filesChanged),
    '',
    '## Issues',
    listOrNone(report.issues),
    '',
  ].join('\n');
}

function extractSection(content: string, section: string): string {
  const regex = new RegExp(`##\\s+${section}\\s*\\n([\\s\\S]*?)(?=\\n##\\s|$)`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

function extractListSection(content: string, section: string): string[] {
  const text = extractSection(content, section);
  if (!text || text === '(none)') return [];
  return text
    .split('\n')
    .filter((line) => line.trim().startsWith('- '))
    .map((line) => line.replace(/^-\s+/, '').trim());
}
