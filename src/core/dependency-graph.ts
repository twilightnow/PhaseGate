import * as path from 'path';
import * as fse from 'fs-extra';
import type { ContractFrontmatter } from '../types';

export interface ModuleNode {
  name: string;
  designFile: string;
  /** Contract files this module depends on (from frontmatter consumers field) */
  contractFiles: string[];
  /** Module names this module depends on (from design doc Dependencies table) */
  dependencies: string[];
}

export interface IDependencyGraph {
  /** Scan design/ + contracts/ dirs, return all module nodes */
  build(projectRoot: string): Promise<ModuleNode[]>;
  /** Topological sort: modules in the same wave can run in parallel */
  getExecutionWaves(nodes: ModuleNode[]): ModuleNode[][];
}

export class DependencyGraph implements IDependencyGraph {
  async build(projectRoot: string): Promise<ModuleNode[]> {
    const designDir = path.join(projectRoot, '.phasegate', 'tasks');
    const contractsDir = path.join(projectRoot, '.phasegate', 'contracts');

    if (!(await fse.pathExists(designDir))) {
      throw new Error('.phasegate/tasks/ directory not found. Complete Phase 1 first.');
    }

    const designFiles = (await fse.readdir(designDir))
      .filter((f) => f.endsWith('.md'))
      .map((f) => path.join(designDir, f));

    if (designFiles.length === 0) {
      throw new Error('.phasegate/tasks/ is empty. Complete Phase 1 first.');
    }

    const contractMeta: Array<{ filePath: string; frontmatter: ContractFrontmatter }> = [];
    if (await fse.pathExists(contractsDir)) {
      const files = (await fse.readdir(contractsDir)).filter((f) => f.endsWith('.md'));
      for (const file of files) {
        const filePath = path.join(contractsDir, file);
        const content = await fse.readFile(filePath, 'utf-8');
        const fm = parseFrontmatter(content);

        if (fm) {
          contractMeta.push({ filePath, frontmatter: fm });
          continue;
        }

        contractMeta.push({
          filePath,
          frontmatter: {
            name: path.basename(file, '.md'),
            description: '',
            consumers: [],
          },
        });
      }
    }

    const nodes: ModuleNode[] = [];
    for (const designFile of designFiles) {
      const name = path.basename(designFile, '.md');
      const content = await fse.readFile(designFile, 'utf-8');
      const dependencies = parseDesignDependencies(content);

      const contractFiles = contractMeta
        .filter((cm) =>
          cm.frontmatter.consumers.length === 0
            ? true
            : cm.frontmatter.consumers.includes(name)
        )
        .map((cm) => cm.filePath);

      nodes.push({ name, designFile, contractFiles, dependencies });
    }

    validateNoCycles(nodes);
    return nodes;
  }

  getExecutionWaves(nodes: ModuleNode[]): ModuleNode[][] {
    if (nodes.length === 0) return [];

    const nodeMap = new Map<string, ModuleNode>(nodes.map((n) => [n.name, n]));
    const inDegree = new Map<string, number>();
    const remaining = new Set<string>(nodes.map((n) => n.name));

    for (const node of nodes) {
      inDegree.set(node.name, 0);
    }

    for (const node of nodes) {
      for (const dep of node.dependencies) {
        if (nodeMap.has(dep)) {
          inDegree.set(node.name, (inDegree.get(node.name) ?? 0) + 1);
        }
      }
    }

    const waves: ModuleNode[][] = [];
    while (remaining.size > 0) {
      const wave = [...remaining]
        .filter((name) => (inDegree.get(name) ?? 0) === 0)
        .map((name) => nodeMap.get(name)!);

      if (wave.length === 0) {
        throw new Error(
          `Circular dependency detected among: ${[...remaining].join(', ')}`
        );
      }

      waves.push(wave);
      for (const node of wave) {
        remaining.delete(node.name);
        for (const candidate of remaining) {
          const candidateNode = nodeMap.get(candidate)!;
          if (candidateNode.dependencies.includes(node.name)) {
            inDegree.set(candidate, (inDegree.get(candidate) ?? 0) - 1);
          }
        }
      }
    }

    return waves;
  }
}

function parseFrontmatter(content: string): ContractFrontmatter | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;

  const yaml = match[1];
  const name = extractYamlScalar(yaml, 'name');
  const description = extractYamlScalar(yaml, 'description');
  const consumers = extractYamlList(yaml, 'consumers');

  if (!name) return null;
  return { name, description, consumers };
}

function extractYamlScalar(yaml: string, key: string): string {
  const regex = new RegExp(`^${key}:\\s*["']?([^"'\\n]+?)["']?\\s*$`, 'm');
  const match = yaml.match(regex);
  return match ? match[1].trim() : '';
}

function extractYamlList(yaml: string, key: string): string[] {
  const lines = yaml.split('\n');
  const startIdx = lines.findIndex((l) => new RegExp(`^${key}:\\s*$`).test(l));
  if (startIdx < 0) return [];

  const items: string[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const itemMatch = lines[i].match(/^\s+-\s+(.+)$/);
    if (itemMatch) {
      items.push(itemMatch[1].trim());
    } else if (lines[i].trim() && !lines[i].startsWith(' ')) {
      break;
    }
  }
  return items;
}

function parseDesignDependencies(content: string): string[] {
  const depSection = content.match(/##\s+Dependencies?\s*\n([\s\S]*?)(?=\n##|$)/i);
  if (!depSection) return [];

  const tableRows = depSection[1].split('\n').filter((l) => l.includes('|'));
  if (tableRows.length < 3) return [];

  const deps: string[] = [];
  for (let i = 2; i < tableRows.length; i++) {
    const cells = tableRows[i].split('|').map((c) => c.trim()).filter(Boolean);
    const first = cells[0];
    if (first && !first.startsWith('---')) {
      deps.push(first);
    }
  }
  return deps;
}

function validateNoCycles(nodes: ModuleNode[]): void {
  const nodeMap = new Map<string, ModuleNode>(nodes.map((n) => [n.name, n]));
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function dfs(start: string): void {
    const stack: Array<{ name: string; nextDepIdx: number }> = [
      { name: start, nextDepIdx: 0 },
    ];
    const path: string[] = [];

    while (stack.length > 0) {
      const frame = stack[stack.length - 1];
      const { name } = frame;

      if (!visited.has(name)) {
        visited.add(name);
        inStack.add(name);
        path.push(name);
      }

      const deps = (nodeMap.get(name)?.dependencies ?? []).filter((dep) =>
        nodeMap.has(dep)
      );

      if (frame.nextDepIdx >= deps.length) {
        stack.pop();
        inStack.delete(name);
        if (path[path.length - 1] === name) path.pop();
        continue;
      }

      const dep = deps[frame.nextDepIdx];
      frame.nextDepIdx += 1;

      if (inStack.has(dep)) {
        const idx = path.indexOf(dep);
        const cycle = [...path.slice(idx), dep].join(' -> ');
        throw new Error(`Circular dependency: ${cycle}`);
      }

      if (!visited.has(dep)) {
        stack.push({ name: dep, nextDepIdx: 0 });
      }
    }
  }

  for (const node of nodes) {
    if (!visited.has(node.name)) {
      dfs(node.name);
    }
  }
}
