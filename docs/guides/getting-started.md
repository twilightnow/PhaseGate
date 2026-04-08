# Getting Started

- Type: guide
- Status: active
- Reader: both

## Requirements

- Node.js 18+
- npm
- one supported AI CLI adapter: `codex` or `claude-code`

## Typical Setup

```bash
npm install
npm run build
phasegate init
```

During `init`, choose a default adapter or pass:

```bash
phasegate init --adapter codex
phasegate init --adapter claude-code
```

## Typical Flow

1. Discuss or refine requirements.

```bash
phasegate chat
phasegate chat --feature login
```

2. Inspect backlog and execution state.

```bash
phasegate status
phasegate progress
```

3. Select one approved requirement.

```bash
phasegate select login
```

4. Execute phases.

```bash
phasegate run
```

You can also select and run in one step:

```bash
phasegate run --requirement login
```

## What To Expect

- `chat` handles Phase 0 only
- `select` binds execution to one requirement
- `run` continues from the active requirement's current phase
- `progress.json` is the real state source
- summaries and worker reports are written under `scratchpad/`

## Common Problems

### `progress.json not found`

Run:

```bash
phasegate init
```

### `No active requirement is selected`

Run:

```bash
phasegate select <requirement>
```

or:

```bash
phasegate run --requirement <requirement>
```

## Related

- [workspace-layout.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/guides/workspace-layout.md)
- [workflow-phases.md](C:/WorkSpace/6_Source/2_VScode/99_gitProject/claudeCodeLeak/PhaseGate/docs/core/workflow-phases.md)
