# Mobile Architecture Assignments

This folder contains architecture-owner task dispatch by phase.

## Rule

- Put phase-scoped worker tasks under `phase-x/worker-y.prompt.md`.
- Keep long-lived worker handoffs out of this folder; those belong under `workers/`.
- Phase assignment is dispatch only, not initiative truth.
- If a phase causes PRD, rollout, review, record, or archive updates, those docs belong under `docs/initiatives/`, and the assignment should point to the target path and target status.
