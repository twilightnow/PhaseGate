import * as path from 'path';
import * as fse from 'fs-extra';

export interface GateResult {
  passed: boolean;
  issues: string[];
}

const LOCALE_SECTIONS: Record<string, string[]> = {
  zh: ['## 描述', '## 范围', '## 验收标准'],
  en: ['## Description', '## Scope', '## Acceptance Criteria'],
  ja: ['## 説明', '## スコープ', '## 受入基準'],
};

export function detectLocale(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const lang = locale.split('-')[0].toLowerCase();
    if (lang in LOCALE_SECTIONS) return lang;
  } catch { /* ignore */ }
  const envLang = process.env.LANG || process.env.LANGUAGE || process.env.LC_ALL || '';
  const match = envLang.match(/^([a-z]{2})/i);
  if (match) {
    const lang = match[1].toLowerCase();
    if (lang in LOCALE_SECTIONS) return lang;
  }
  return 'zh';
}

export function getRequiredSections(locale?: string): string[] {
  const lang = locale ?? detectLocale();
  return LOCALE_SECTIONS[lang] ?? LOCALE_SECTIONS['zh'];
}

async function loadRequiredSections(cwd: string): Promise<string[]> {
  const configPath = path.join(cwd, '.phasegate', 'phasegate.config.json');
  try {
    const config = await fse.readJson(configPath);
    if (Array.isArray(config.phase0Sections) && config.phase0Sections.length > 0) {
      return config.phase0Sections;
    }
  } catch { /* config missing or unreadable — use locale default */ }
  return getRequiredSections();
}

/**
 * Gate check for Phase 0 → Phase 1 transition.
 * Verifies that at least one requirements file (not the init template) exists
 * and contains the required sections.
 * Section names are auto-detected from system locale, or overridden via
 * phasegate.config.json `phase0Sections`.
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

  const fallbackSections = await loadRequiredSections(cwd);
  // All known section sets (built-in locales + any config override)
  const allSectionSets = Object.values(LOCALE_SECTIONS);
  if (!allSectionSets.some((s) => s === fallbackSections)) {
    allSectionSets.push(fallbackSections);
  }

  for (const file of mdFiles) {
    const content = await fse.readFile(path.join(reqDir, file), 'utf-8');

    // Pass if the file satisfies ANY locale's complete section set
    const satisfied = allSectionSets.some((sections) =>
      sections.every((s) => content.includes(s))
    );
    if (satisfied) continue;

    // Report missing sections from the best-matching set (most sections present)
    const bestSet = allSectionSets.reduce((best, sections) => {
      const matches = sections.filter((s) => content.includes(s)).length;
      const bestMatches = best.filter((s) => content.includes(s)).length;
      return matches > bestMatches ? sections : best;
    }, fallbackSections);

    for (const section of bestSet) {
      if (!content.includes(section)) {
        issues.push(`${file}: missing section "${section}"`);
      }
    }
  }

  return { passed: issues.length === 0, issues };
}
