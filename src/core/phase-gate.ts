import * as path from 'path';
import * as fse from 'fs-extra';

export interface GateResult {
  passed: boolean;
  issues: string[];
}

const PHASE0_REQUIRED_SECTIONS = ['## Description', '## Scope', '## Acceptance Criteria'];

/**
 * Gate check for Phase 0 → Phase 1 transition.
 * Verifies that at least one requirements file (not the init template) exists
 * and contains the required sections.
 */
export async function checkPhase0Gate(cwd: string): Promise<GateResult> {
  const reqDir = path.join(cwd, '.phasegate', 'requirements');
  const issues: string[] = [];

  let files: string[] = [];
  try {
    files = await fse.readdir(reqDir);
  } catch {
    issues.push('requirements/ directory not found');
    return { passed: false, issues };
  }

  // Exclude the blank init template; AI-generated files have feature-specific names
  const mdFiles = files.filter((f) => f.endsWith('.md') && f !== 'requirements.md');

  if (mdFiles.length === 0) {
    issues.push(
      'No requirements file found — expected .phasegate/requirements/{feature-name}.md'
    );
    return { passed: false, issues };
  }

  for (const file of mdFiles) {
    const content = await fse.readFile(path.join(reqDir, file), 'utf-8');
    for (const section of PHASE0_REQUIRED_SECTIONS) {
      if (!content.includes(section)) {
        issues.push(`${file}: missing section "${section}"`);
      }
    }
  }

  return { passed: issues.length === 0, issues };
}
