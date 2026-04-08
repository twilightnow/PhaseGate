import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import * as fse from 'fs-extra';
import { DependencyGraph } from '../src/core/dependency-graph';

const repoRoot = path.resolve(__dirname, '..');
const cliEntry = path.join(repoRoot, 'src', 'index.ts');
const tscEntry = path.join(repoRoot, 'node_modules', 'typescript', 'bin', 'tsc');
const tsxEntry = path.join(repoRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

async function main(): Promise<void> {
  runTypecheck();

  const sandboxRoot = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-phase2-'));

  try {
    await runCliAcceptance(sandboxRoot);
    await runDependencyGraphAcceptance(sandboxRoot);
    console.log('PASS acceptance:phase2');
  } finally {
    await fse.remove(sandboxRoot);
  }
}

function runTypecheck(): void {
  execFileSync(process.execPath, [tscEntry, '--noEmit'], {
    cwd: repoRoot,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}

async function runCliAcceptance(sandboxRoot: string): Promise<void> {
  const projectRoot = path.join(sandboxRoot, 'my-project');
  await fse.ensureDir(projectRoot);

  const initOutput = runCli(projectRoot, ['init', '--adapter', 'codex']);
  assert.match(initOutput, /initialized/i);
  assert.match(initOutput, /default AI adapter:\s+Codex/i);
  assert.match(initOutput, /\.phasegate\/phasegate\.config\.json/);

  const expectedEntries = [
    'contracts',
    'phasegate.config.json',
    'progress.json',
    'archive',
    'requirements',
    'scratchpad',
    'tasks',
  ];
  const actualEntries = (await fse.readdir(path.join(projectRoot, '.phasegate'))).sort();
  assert.deepStrictEqual(actualEntries, expectedEntries);

  const progressJson = await fse.readJson(path.join(projectRoot, '.phasegate', 'progress.json'));
  assert.strictEqual(progressJson.projectName, 'my-project');
  assert.strictEqual(progressJson.currentPhase, 0);
  assert.strictEqual(progressJson.activeRequirement, null);
  const configJson = await fse.readJson(path.join(projectRoot, '.phasegate', 'phasegate.config.json'));
  assert.strictEqual(configJson.runner, 'codex');
  assert.strictEqual(configJson.aiProfiles.default.adapter, 'codex');
  assert.deepStrictEqual(
    (await fse.readdir(path.join(projectRoot, '.phasegate', 'requirements'))).sort(),
    []
  );

  const statusOutput = runCli(projectRoot, ['status']);
  assert.match(statusOutput, /Phase 0/i);
  assert.match(statusOutput, /my-project/);
  assert.match(statusOutput, /Active requirement:\s+\(none\)/i);

  const progressOutput = runCli(projectRoot, ['progress']);
  assert.match(progressOutput, /"projectName": "my-project"/);
  assert.match(progressOutput, /"currentPhase": 0/);
  assert.match(progressOutput, /"activeRequirement": null/);
  assert.match(progressOutput, /my-project/);

  const claudeProjectRoot = path.join(sandboxRoot, 'my-project-claude');
  await fse.ensureDir(claudeProjectRoot);
  const claudeInitOutput = runCli(claudeProjectRoot, ['init', '--adapter', 'claude-code']);
  assert.match(claudeInitOutput, /default AI adapter:\s+Claude Code/i);
  const claudeConfigJson = await fse.readJson(
    path.join(claudeProjectRoot, '.phasegate', 'phasegate.config.json')
  );
  assert.strictEqual(claudeConfigJson.runner, 'claude');
  assert.strictEqual(claudeConfigJson.aiProfiles.default.adapter, 'claude-code');

  const invalidProjectRoot = path.join(sandboxRoot, 'my-project-invalid');
  await fse.ensureDir(invalidProjectRoot);
  assert.throws(
    () => runCli(invalidProjectRoot, ['init', '--adapter', 'bad']),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Unsupported adapter "bad"/);
      assert.doesNotMatch(err.message, /src[\\/]+commands[\\/]+init\.ts/);
      return true;
    }
  );
  assert.strictEqual(await fse.pathExists(path.join(invalidProjectRoot, '.phasegate')), false);
}

async function runDependencyGraphAcceptance(sandboxRoot: string): Promise<void> {
  const projectRoot = path.join(sandboxRoot, 'my-project');
  const tasksDir = path.join(projectRoot, '.phasegate', 'tasks');
  const contractsDir = path.join(projectRoot, '.phasegate', 'contracts');

  await fse.writeFile(
    path.join(tasksDir, 'module-a.md'),
    [
      '# module-a',
      '## Dependencies',
      '| Dependency | Why |',
      '|---|---|',
    ].join('\n'),
    'utf-8'
  );

  await fse.writeFile(
    path.join(tasksDir, 'module-b.md'),
    [
      '# module-b',
      '## Dependencies',
      '| Dependency | Why |',
      '|---|---|',
      '| module-a | needs A |',
    ].join('\n'),
    'utf-8'
  );

  await fse.writeFile(
    path.join(contractsDir, 'IFoo.md'),
    [
      '---',
      'name: IFoo',
      'description: Foo interface',
      'consumers:',
      '  - module-b',
      '---',
      '# IFoo contract',
    ].join('\n'),
    'utf-8'
  );

  const dg = new DependencyGraph();
  const nodes = await dg.build(projectRoot);
  const waves = dg.getExecutionWaves(nodes);
  const moduleA = nodes.find((node) => node.name === 'module-a');
  const moduleB = nodes.find((node) => node.name === 'module-b');

  assert.deepStrictEqual(waves[0]?.map((node) => node.name), ['module-a']);
  assert.deepStrictEqual(waves[1]?.map((node) => node.name), ['module-b']);
  assert.deepStrictEqual(
    moduleB?.contractFiles.map((file) => path.basename(file)),
    ['IFoo.md']
  );
  assert.deepStrictEqual(moduleA?.contractFiles, []);

  await fse.writeFile(
    path.join(tasksDir, 'module-c.md'),
    [
      '# module-c',
      '## Dependencies',
      '| Dependency | Why |',
      '|---|---|',
      '| module-b | needs B |',
    ].join('\n'),
    'utf-8'
  );

  await fse.writeFile(
    path.join(tasksDir, 'module-b.md'),
    [
      '# module-b',
      '## Dependencies',
      '| Dependency | Why |',
      '|---|---|',
      '| module-a | needs A |',
      '| module-c | cycle! |',
    ].join('\n'),
    'utf-8'
  );

  await assert.rejects(
    () => dg.build(projectRoot),
    (err: unknown) => {
      assert.ok(err instanceof Error);
      assert.match(err.message, /Circular dependency/);
      assert.match(err.message, /module-b -> module-c -> module-b/);
      return true;
    }
  );
}

function runCli(cwd: string, args: string[]): string {
  return execFileSync(process.execPath, [tsxEntry, cliEntry, ...args], {
    cwd,
    encoding: 'utf-8',
    stdio: 'pipe',
  });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
