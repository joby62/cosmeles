# Startup Prompts

This folder lives under `docs/workflow/` on purpose.

## What This Folder Is For

- starting a brand-new dialog with a role owner or worker
- copying a ready-to-send bootstrap prompt instead of paraphrasing from memory
- forcing the new dialog to read the right source documents in the right order

## What This Folder Is Not

- not the long-term source of truth for role governance
- not a replacement for `docs/`
- not initiative output truth

The source of truth still lives in:
- `/Users/lijiabo/Documents/New project/docs/workflow/governance/`
- `/Users/lijiabo/Documents/New project/docs/workflow/teams/`
- `/Users/lijiabo/Documents/New project/docs/initiatives/`

## Current Startup Files

- `owner-worker-dispatch-guide.md`
  - use this when the architecture owner needs the fixed dispatch order
- `architect-owner-dialog-bootstrap.prompt.md`
  - use this when opening a fresh dialog for the architecture owner
- `product-manager-dialog-bootstrap.prompt.md`
  - use this when opening a fresh dialog for the current product manager
- `worker-a-dialog-bootstrap.prompt.md`
  - use this when opening a fresh dialog for Worker A
- `worker-b-dialog-bootstrap.prompt.md`
  - use this when opening a fresh dialog for Worker B
- `worker-c-dialog-bootstrap.prompt.md`
  - use this when opening a fresh dialog for Worker C

## Rule

Do not just send a file path to a new dialog and assume it will read everything correctly.
Copy the bootstrap prompt from this folder into the first message.
Do not move these files back to repo root; they are workflow bootstraps, not initiative artifacts.
