# Testing Guide

## Minimal policy

Keep testing intentionally simple:

1. `npm test` and `npm run test:unit` are the default developer loop.
2. Default tests must not call a real AI runner or spend tokens.
3. Real AI verification is isolated in `npm run test:live`.
4. `test:live` is only a smoke test. It should use the smallest prompt and no file context.

## Commands

```bash
npm test
npm run test:unit
PHASEGATE_LIVE=1 npm run test:live
```

On Windows PowerShell:

```powershell
$env:PHASEGATE_LIVE='1'
npm run test:live
```

## Why

This keeps the normal edit-test loop cheap, while still preserving one explicit path to verify that the configured AI runner is alive and responding.
