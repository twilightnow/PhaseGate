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

function buildSectionAliasGroups(fallbackSections: string[]): string[][] {
  return fallbackSections.map((section, index) => {
    const aliases = new Set<string>([section]);
    for (const localizedSections of Object.values(LOCALE_SECTIONS)) {
      const alias = localizedSections[index];
      if (alias) {
        aliases.add(alias);
      }
    }
    return Array.from(aliases);
  });
}

export function detectLocale(): string {
  try {
    const locale = Intl.DateTimeFormat().resolvedOptions().locale;
    const lang = locale.split('-')[0].toLowerCase();
    if (lang in LOCALE_SECTIONS) return lang;
  } catch {
    /* ignore */
  }

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
  return LOCALE_SECTIONS[lang] ?? LOCALE_SECTIONS.zh;
}

export function buildLocalLanguageInstruction(locale?: string): string {
  const lang = locale ?? detectLocale();
  const languageName =
    lang === 'ja' ? 'Japanese' : lang === 'zh' ? 'Simplified Chinese' : 'English';

  return [
    'Language policy:',
    '- Keep all provided instructions, filenames, code, and any required headings/templates exactly as written.',
    `- Use ${languageName} for user-facing narrative or conversational text.`,
    '- If a task requires an exact template or exact headings, preserve them exactly and localize only surrounding explanatory prose.',
  ].join('\n');
}

async function loadRequiredSections(cwd: string): Promise<string[]> {
  const configPath = path.join(cwd, '.phasegate', 'phasegate.config.json');
  try {
    const config = await fse.readJson(configPath);
    if (Array.isArray(config.phase0Sections) && config.phase0Sections.length > 0) {
      return config.phase0Sections;
    }
  } catch {
    /* config missing or unreadable; use locale default */
  }

  return getRequiredSections();
}

export async function checkPhase0Gate(cwd: string, featureName?: string): Promise<GateResult> {
  const reqDir = path.join(cwd, '.phasegate', 'requirements');
  const issues: string[] = [];

  let files: string[] = [];
  try {
    files = await fse.readdir(reqDir);
  } catch {
    issues.push('requirements/ directory not found');
    return { passed: false, issues };
  }

  const allRequirementFiles = files.filter((f) => f.endsWith('.md') && f !== 'requirements.md');
  const normalizedFeature = featureName
    ? path.basename(featureName.trim(), path.extname(featureName.trim())).toLowerCase()
    : null;
  const mdFiles = normalizedFeature
    ? allRequirementFiles.filter(
        (file) => path.basename(file, '.md').toLowerCase() === normalizedFeature
      )
    : allRequirementFiles;
  if (mdFiles.length === 0) {
    if (normalizedFeature) {
      issues.push(`No requirements file found for feature "${featureName}"`);
    } else {
      issues.push('No requirements file found; expected .phasegate/requirements/{feature-name}.md');
    }
    return { passed: false, issues };
  }

  const fallbackSections = await loadRequiredSections(cwd);
  const aliasGroups = buildSectionAliasGroups(fallbackSections);

  for (const file of mdFiles) {
    const content = await fse.readFile(path.join(reqDir, file), 'utf-8');

    for (const [index, aliases] of aliasGroups.entries()) {
      if (aliases.some((section) => content.includes(section))) {
        continue;
      }
      issues.push(`${file}: missing section "${fallbackSections[index]}"`);
    }
  }

  return { passed: issues.length === 0, issues };
}
