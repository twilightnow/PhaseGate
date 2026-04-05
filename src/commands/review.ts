import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fse from 'fs-extra';
import { createRunner } from '../core/ai-runner';

export function createReviewCommand(): Command {
  const cmd = new Command('review');

  cmd
    .description('Run independent AI review on a module task document')
    .argument('<module>', 'module name (matches .phasegate/tasks/{module}.md)')
    .action(async (moduleName: string) => {
      const cwd = process.cwd();
      const designPath = path.join(cwd, '.phasegate', 'tasks', `${moduleName}.md`);

      if (!(await fse.pathExists(designPath))) {
        console.error(
          chalk.red('Error:') + ` .phasegate/tasks/${moduleName}.md not found.`
        );
        process.exit(1);
      }

      const contractsDir = path.join(cwd, '.phasegate', 'contracts');
      const contractFiles: string[] = [];
      if (await fse.pathExists(contractsDir)) {
        const entries = await fse.readdir(contractsDir);
        contractFiles.push(
          ...entries
            .filter((f) => f.endsWith('.md'))
            .map((f) => path.join(contractsDir, f))
        );
      }

      const files = [designPath, ...contractFiles];

      const prompt = [
        'You are an independent AI reviewer with a fresh context (no prior discussion).',
        `Review the design document for module: ${moduleName}`,
        '',
        'Evaluate:',
        '1. Interface completeness - all methods have clear signatures and described behavior',
        '2. Dependency correctness - no circular deps, all deps explicitly declared',
        '3. Single responsibility - module does exactly one thing',
        '4. Error handling - edge cases and failure modes are addressed',
        '5. Naming consistency - naming patterns match the rest of the codebase',
        '6. Constraint compliance - respects architecture constraints',
        '',
        'Output format:',
        '## Verdict',
        'PASS or FAIL',
        '',
        '## Issues',
        '- (list any issues found, or "(none)" if clean)',
        '',
        '## Suggestions',
        '- (optional improvement suggestions)',
      ].join('\n');

      console.log(chalk.cyan('->') + ` Reviewing ${moduleName} (independent context)...`);

      try {
        const runner = await createRunner(cwd);
        const result = await runner.run(files, prompt);
        console.log('');
        console.log(result);
      } catch (err) {
        console.error(
          chalk.red('Review error:'),
          err instanceof Error ? err.message : err
        );
        process.exit(1);
      }
    });

  return cmd;
}
