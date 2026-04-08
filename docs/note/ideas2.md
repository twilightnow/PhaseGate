# Architecture Priorities Notes

- Type: note
- Status: draft
- Reader: both

## Purpose

This note captures broader architecture priorities from discussion.
It is intentionally looser than the current implementation docs.

## Priority Themes

### Stronger Gates

- clearer blocking vs non-blocking findings
- better Phase 4 and Phase 5 verification structure

### Better Artifact Lifecycle

- clearer keep/archive/discard rules
- less noise from disposable outputs

### Better State Model

- keep `progress.json` execution-focused
- avoid bringing back removed derived state files

### Better Review Surface

- standard findings shape
- better residual-risk reporting

### Better Orchestrator Boundaries

- explicit module ownership
- clearer shared-file exceptions
- smaller, cleaner worker context
