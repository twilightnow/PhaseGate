import * as os from 'os';
import * as path from 'path';
import * as fse from 'fs-extra';
import { DependencyGraph } from '../dependency-graph';

describe('DependencyGraph', () => {
  let projectRoot: string;

  beforeEach(async () => {
    projectRoot = await fse.mkdtemp(path.join(os.tmpdir(), 'phasegate-dg-'));
    await fse.ensureDir(path.join(projectRoot, '.phasegate', 'tasks'));
    await fse.ensureDir(path.join(projectRoot, '.phasegate', 'contracts'));
  });

  afterEach(async () => {
    await fse.remove(projectRoot);
  });

  it('resolves interface dependencies to provider modules and keeps contract context minimal', async () => {
    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'ai-runner-stream.md'),
      `# AiRunnerStream

## Dependencies
| Interface | Direction |
|---|---|
`,
      'utf-8'
    );

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'run-display.md'),
      `# RunDisplay

## Dependencies
| Interface | Direction |
|---|---|
| IRunEvent | CONSUMES |
`,
      'utf-8'
    );

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'contracts', 'IRunEvent.md'),
      `---
name: IRunEvent
description: Streaming run events
consumers:
  - RunDisplay
---

# IRunEvent

## Provider
- AiRunnerStream (\`core/ai-runner.ts\`)
`,
      'utf-8'
    );

    const graph = new DependencyGraph();
    const nodes = await graph.build(projectRoot);
    const nodeMap = new Map(nodes.map((node) => [node.name, node]));

    expect(nodeMap.get('ai-runner-stream')?.dependencies).toEqual([]);
    expect(nodeMap.get('ai-runner-stream')?.contractFiles).toHaveLength(1);
    expect(nodeMap.get('run-display')?.dependencies).toEqual(['ai-runner-stream']);
    expect(nodeMap.get('run-display')?.contractFiles).toHaveLength(1);

    const waves = graph.getExecutionWaves(nodes).map((wave) => wave.map((node) => node.name));
    expect(waves).toEqual([['ai-runner-stream'], ['run-display']]);
  });

  it('keeps direct module dependencies supported', async () => {
    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'core-a.md'),
      `# CoreA

## Dependencies
| Module | Direction |
|---|---|
`,
      'utf-8'
    );

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'core-b.md'),
      `# CoreB

## Dependencies
| Module | Direction |
|---|---|
| core-a | USES |
`,
      'utf-8'
    );

    const graph = new DependencyGraph();
    const nodes = await graph.build(projectRoot);
    const nodeMap = new Map(nodes.map((node) => [node.name, node]));

    expect(nodeMap.get('core-b')?.dependencies).toEqual(['core-a']);
    expect(graph.getExecutionWaves(nodes).map((wave) => wave.map((node) => node.name))).toEqual([
      ['core-a'],
      ['core-b'],
    ]);
  });

  it('resolves interface dependencies even when the design doc wraps them in markdown formatting', async () => {
    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'producer.md'),
      `# Producer

## Dependencies
| Interface | Direction |
|---|---|
`,
      'utf-8'
    );

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'tasks', 'consumer.md'),
      `# Consumer

## Dependencies
| Interface | Direction |
|---|---|
| \`IRunEvent\` | CONSUMES |
`,
      'utf-8'
    );

    await fse.writeFile(
      path.join(projectRoot, '.phasegate', 'contracts', 'IRunEvent.md'),
      `---
name: IRunEvent
description: Streaming run events
consumers:
  - Consumer
---

# IRunEvent

## Provider
- Producer
`,
      'utf-8'
    );

    const graph = new DependencyGraph();
    const nodes = await graph.build(projectRoot);
    const nodeMap = new Map(nodes.map((node) => [node.name, node]));

    expect(nodeMap.get('consumer')?.dependencies).toEqual(['producer']);
  });
});
