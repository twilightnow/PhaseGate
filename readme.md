# PhaseGate

Engineering-first AI coding workflow with phase isolation, contract-first design, and orchestrated multi-module implementation.

[English](./README.md) | [简体中文](./README.zh-CN.md) | [日本語](./README.ja.md)

## What It Is

PhaseGate turns AI coding into a staged workflow with two separate tracks:

- a requirements track where requirement docs can keep accumulating
- an execution track where one selected requirement is turned into design, implementation, review, and acceptance artifacts

It is for teams or individuals who want repeatable, inspectable AI-assisted delivery. It is not for one-shot prompt coding.

What makes it different from many AI coding tools:

- requirement intake is separated from active execution instead of forcing one global conversation state
- phase boundaries reset context instead of carrying one long conversation
- task books and contracts become explicit files, not hidden agent memory
- multi-module work is coordinated from a dependency DAG, not just parallel prompts
- progress is persisted on disk so the workflow can resume after interruption

## Quick Start

Important: the invoked AI tool must run with full-access permissions. Restricted sandbox mode can block the workflow or produce incomplete results.

Requirements:

- Node.js 18+
- npm
- an installed AI CLI adapter: `codex` or `claude`

Run locally:

```bash
npm install
npm run build
node dist/index.js init
node dist/index.js chat --feature login
node dist/index.js run
```

During `init`, PhaseGate will ask which default AI adapter to use: `Claude Code` or `Codex`.
If you want to skip the prompt in automation, use:

```bash
node dist/index.js init --adapter codex
node dist/index.js init --adapter claude-code
```

After initialization, you can change the default adapter or routing in `.phasegate/phasegate.config.json` under the `.phasegate/` folder.

## Workspace

```text
.phasegate/
  requirements/
  tasks/
  contracts/
  scratchpad/
  archive/
  progress.json
  phasegate.config.json
```

`requirements/` is intended to behave like a requirement pool, not a single in-flight phase folder.
`tasks/` and `contracts/` are active execution artifacts for the currently selected requirement.
`scratchpad/` is for disposable run output such as coordinator briefs, worker reports, and temporary notes.
`archive/` is for promoted historical artifacts worth keeping after a run finishes.

`progress.json` is the only source of truth for execution state.

## Workflow Direction

The intended operating model is:

- requirements can be added, revised, and approved independently of the current execution phase
- `phasegate run` should operate on one manually selected requirement at a time
- execution does not need parallel requirement handling yet; selection and sequencing can stay explicit
- once a requirement is selected for execution, PhaseGate generates the task / contract / review artifacts for that requirement only
- one-off documents should stay in `scratchpad/` by default and only move to `archive/` if they have future audit or reuse value

Current direction:

- treat `.phasegate/requirements/*.md` as an appendable backlog of approved or candidate requirements
- keep an explicit `activeRequirement` in `progress.json`
- scope `currentPhase` to the active requirement execution flow rather than to the entire workspace
- keep summaries and disposable artifacts under `scratchpad/` instead of maintaining a derived `progress.md`
- avoid treating generated task books, coordinator briefs, and worker reports as permanent documentation unless they are deliberately promoted

## Status

Implemented now:

- `init`, `chat`, `run`, `status`, `progress`, `review`
- explicit `select` command for choosing the active requirement
- scope-based AI routing
- Phase 3 coordinator / worker orchestration
- progress persistence and resume from disk

Planned next:

- clarify lifecycle rules for disposable documents versus archived artifacts
- add a new phase that generates and maintains a high-level design document after implementation changes
- make automated implementation stages more parallel across tasks and modules
- support for more AI APIs and adapters

## Limits

- Output quality still depends on prompt, task-book, and contract quality
- Review and acceptance still need human judgment
- The current adapter surface is limited to `codex` and `claude-code`

## Docs

- Start here: [docs/guides/getting-started.md](docs/guides/getting-started.md)
- CLI surface: [docs/core/cli-surface.md](docs/core/cli-surface.md)
- Workflow phases: [docs/core/workflow-phases.md](docs/core/workflow-phases.md)
- Workspace layout: [docs/guides/workspace-layout.md](docs/guides/workspace-layout.md)
- Full docs index: [docs/README.md](docs/README.md)
