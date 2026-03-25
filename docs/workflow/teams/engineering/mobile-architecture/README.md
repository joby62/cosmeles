# Mobile Architecture Team Docs

This folder holds the architecture-owner line and the three worker lanes for the mobile architecture program.

## Layout

- `owner/`
  - durable owner prompts for the architecture lead
- `workers/worker-a/`
  - worker-specific handoff and execution constraints
- `workers/worker-b/`
  - worker-specific handoff and truth-owner constraints
- `workers/worker-c/`
  - worker-specific handoff and adoption/deploy constraints
- `assignments/phase-x/`
  - owner-to-worker dispatch bundles for each execution phase

## Rules

- Owner strategy and freeze prompts stay under `owner/`.
- Individual worker handoffs stay under `workers/worker-x/`.
- Phase dispatch belongs under `assignments/phase-x/`.
- If a phase creates or updates live initiative truth, the resulting spec, rollout, review, or record doc belongs under `docs/initiatives/mobile/`, not inside this team folder.

## Operating Mode

- The delivery team shape is fixed:
  - `Owner`
  - `Worker A`
  - `Worker B`
  - `Worker C`
- `Owner` is the direct manager of Worker A/B/C.
- The user or coordinator may relay prompts, but does not replace owner decomposition, gate logic, or archive responsibility.
- Every active phase should let the owner hand the user:
  - handoff paths
  - assignment paths
  - deploy-dispatch path
  - fixed send order
  - copyable text for Worker A / Worker B / Worker C

## Closure Discipline

- When a phase closes, owner is responsible for:
  - gate conclusion
  - `record / review / archive`
  - `NOW / DOC_INDEX / TIMELINE`
- `phase-14` through `phase-20` are already completed historical runtime phases.
- There is no active runtime phase at the moment.
- If runtime work resumes, owner must open a new phase folder and new dispatch bundle rather than reviving `phase-20`.
