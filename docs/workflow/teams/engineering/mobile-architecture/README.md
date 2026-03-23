# Mobile Architecture Team Docs

This folder holds the Microsoft-architect line and the three worker teams for the mobile architecture program.

## Layout

- `owner/`
  - durable owner prompts for the architecture lead
- `workers/worker-a/`
  - worker-specific handoff and long-lived execution constraints
- `workers/worker-b/`
  - reserved for worker B handoff docs
- `workers/worker-c/`
  - reserved for worker C handoff docs
- `assignments/phase-x/`
  - architecture-owner task dispatch for each delivery phase

## Rules

- Owner strategy and freeze prompts stay under `owner/`.
- Individual worker handoffs stay under `workers/worker-x/`.
- Phase dispatch belongs under `assignments/phase-x/` because those files express owner-to-worker tasking, not generic prompts.
- If a phase creates or updates live initiative truth, the resulting spec, rollout, review, or record doc belongs under `docs/initiatives/mobile/`, not inside this team folder.
