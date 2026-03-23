# Document State System Design v1

## Purpose

This design solves one problem only:
- future docs must stop relying on timestamps as a fake proxy for task priority or completion state

This document does **not** attempt to clean up legacy docs.
Historical remediation is a separate track.

## Core Judgment

Time is not truth.

`created_at` and `updated_at` can help with chronology, but they cannot answer:
- which doc is currently active
- which doc is already done
- which doc is only historical reference
- which doc superseded another doc
- which doc is allowed to drive execution right now

The system to build is a **document state system**, not a timestamp sorting system.

## Scope

This design applies to:
- all new docs created after adoption
- all existing docs that are materially updated after adoption

This design does not require a full backfill of old docs before adoption.

## Repository Placement Model

This repo now separates workflow docs from initiative docs.

- `docs/workflow/`
  - governance, startup prompts, operations docs, and team-owned handoffs
- `docs/initiatives/`
  - live initiative truth, rollout docs, review records, completion records, and archive

Rules:
- if a file defines how people should work, it belongs in `docs/workflow/`
- if a file defines or records initiative truth, it belongs in `docs/initiatives/`
- role prompts and startup prompts are never substitutes for initiative truth
- initiative output docs must not be hidden inside team folders

## Non-Negotiable Rules

- A document is a work object, not just a file.
- Every live document must have one owner.
- Every live document must have one explicit status.
- No document may drive execution without a valid status.
- No team may rely on filesystem time as the primary signal of priority or recency.
- Only one document may hold frozen truth for the same scope at the same time.

## Document Object Model

Every formal doc must declare these fields at the top of the file.

Required:
- `doc_id`
- `title`
- `doc_type`
- `initiative`
- `workstream`
- `owner`
- `status`
- `priority`
- `created_at`
- `updated_at`

Optional but strongly recommended:
- `phase`
- `reviewers`
- `started_at`
- `frozen_at`
- `completed_at`
- `supersedes`
- `superseded_by`
- `related_docs`
- `related_assignments`

Formal governed docs in this system normally live under:
- `docs/initiatives/<initiative>/product/`
- `docs/initiatives/<initiative>/architecture/`
- `docs/initiatives/<initiative>/reviews/` or equivalent
- `docs/initiatives/<initiative>/archive/`

Workflow-owned prompts, handoffs, startup bootstraps, and phase assignments may stay under `docs/workflow/`.
They can still be referenced by state surfaces when they actively drive execution, but they do not replace initiative truth.

## Front Matter Template

```yaml
---
doc_id: mobile-product-first-run-funnel-spec-v1
title: Mobile First Run Funnel Execution Spec v1
doc_type: spec
initiative: mobile
workstream: product
owner: product-owner
reviewers:
  - experience-owner
  - user-insight-copy-owner
  - architecture-owner
status: active
priority: p0
created_at: 2026-03-19
updated_at: 2026-03-22
phase: phase-13
started_at: 2026-03-19
frozen_at:
completed_at:
supersedes:
superseded_by:
related_docs:
  - mobile-result-intent-routing-prd-v1
related_assignments:
  - phase-13-worker-a
---
```

## Document Type System

Every doc must belong to one of these types:

- `strategy`
  - product or business direction
- `spec`
  - product or UX definition that can drive downstream work
- `architecture`
  - system design, contract design, or migration design
- `rollout`
  - execution or cutover plan
- `assignment`
  - owner-to-worker dispatch
- `review`
  - acceptance note, audit, critique, or decision review
- `runbook`
  - operational instructions
- `record`
  - completion note, decision log, or historical checkpoint
- `archive`
  - historical storage only

## Workstream System

Every doc must also belong to one workstream:

- `business`
- `product`
- `experience`
- `user-insight-copy`
- `architecture`
- `engineering-assignment`
- `operations`
- `shared-governance`

`doc_type` answers what kind of document it is.
`workstream` answers which line owns it.

## Status System

All live docs must use one of these statuses:

- `draft`
  - being written; not allowed to drive execution
- `active`
  - current working doc for discussion and alignment
- `frozen`
  - approved truth; allowed to drive downstream execution
- `in_execution`
  - execution has started based on this doc
- `blocked`
  - current doc is valid but cannot advance due to dependency
- `completed`
  - the task or scope defined by this doc is done
- `superseded`
  - replaced by a newer doc; no longer current truth
- `archived`
  - history only; excluded from active retrieval

## Status Intent

The most important distinctions are:

- `active` is not the same as `frozen`
- `frozen` is the only valid truth state for downstream implementation
- `completed` is not the same as `archived`
- `superseded` must explicitly point to the replacing doc
- `archived` means do not use this doc for current decision-making

## Allowed Status Transitions

Default transitions:

- `draft -> active`
- `active -> frozen`
- `active -> blocked`
- `blocked -> active`
- `frozen -> in_execution`
- `in_execution -> completed`
- `active -> superseded`
- `frozen -> superseded`
- `completed -> archived`
- `superseded -> archived`

Forbidden by default:

- `draft -> in_execution`
- `draft -> completed`
- `archived -> active`
- `superseded -> frozen`

If an exception is needed, the owner must record why.

## Type-Specific Status Discipline

Not every doc type uses every status equally.

Recommended defaults:

| doc_type | normal live states | normal terminal states |
| --- | --- | --- |
| `strategy` | `draft`, `active`, `frozen`, `blocked` | `superseded`, `archived` |
| `spec` | `draft`, `active`, `frozen`, `blocked`, `in_execution` | `completed`, `superseded`, `archived` |
| `architecture` | `draft`, `active`, `frozen`, `blocked`, `in_execution` | `completed`, `superseded`, `archived` |
| `rollout` | `active`, `frozen`, `blocked`, `in_execution` | `completed`, `archived` |
| `assignment` | `active`, `blocked`, `in_execution` | `completed`, `superseded`, `archived` |
| `review` | `active` | `completed`, `archived` |
| `runbook` | `active`, `blocked` | `superseded`, `archived` |
| `record` | `completed` | `archived` |

## Ownership Rules

Status ownership follows workstream ownership:

- `business` docs: `Business Owner`
- `product` docs: `Product Owner`
- `experience` docs: `Experience Owner`
- `user-insight-copy` docs: `User Insight And Copy Owner`
- `architecture` docs: `Architecture Owner`
- `engineering-assignment` docs: `Architecture Owner`
- `operations` docs: `Operations Owner` or current deployment owner
- `shared-governance` docs: current governance owner, usually `Business Owner` or delegated ops/governance owner

Rules:

- Only the owner may change `status`, unless the owner explicitly delegates.
- Any change to `supersedes` or `superseded_by` must be made in the same change as the status update.
- A worker may propose a status change, but may not self-approve it unless they are the owner.

## Currentness Surfaces

The system must expose current truth in three surfaces.

### 1. `docs/initiatives/NOW.md`

Purpose:
- the only default entry point for "what matters now"

Rules:
- only include docs with `active`, `frozen`, `in_execution`, or `blocked`
- limit to the current working set
- sort by `priority`, not by timestamp
- each entry must show:
  - title
  - workstream
  - owner
  - status
  - priority
  - last meaningful update
  - path, including `docs/workflow/` items when the live work object is an assignment or dispatch doc

### 2. `docs/initiatives/DOC_INDEX.md`

Purpose:
- full catalog of all governed docs

Rules:
- group by `workstream`, `doc_type`, and `status`
- allow retrieval by initiative and phase
- archived docs must still be searchable here

### 3. `docs/initiatives/TIMELINE.md`

Purpose:
- append-only record of document lifecycle events

Events to record:
- created
- frozen
- execution started
- blocked
- completed
- superseded
- archived

## Archive Rules

Archive is not a trash can.

A doc moves to archive only when one of these is true:
- it is completed and no longer needed as live truth
- it is superseded by a newer doc
- it is historical record only

Archive rules:
- archived docs must live under an archive path
- archived docs must not appear in `docs/initiatives/NOW.md`
- archived docs must remain searchable in `docs/initiatives/DOC_INDEX.md`
- archived docs should preserve their final status history

## Replacement Rules

If a new doc replaces an old one:

- the new doc must declare `supersedes`
- the old doc must declare `superseded_by`
- the old doc must move to `superseded`
- the old doc must stop appearing in `docs/initiatives/NOW.md`

Do not allow parallel frozen truth for the same scope.

## Execution Rules

Execution must only reference:
- `frozen`
- `in_execution`

Never start implementation from:
- `draft`
- unlabeled docs
- timestamp-sorted guesswork

Assignments must also obey:
- every assignment must point to its upstream truth doc
- every assignment must carry owner, phase, and status
- completed assignments must not remain mixed with active assignments without explicit status
- if an assignment causes a governed initiative doc to be created or updated, that doc still belongs under `docs/initiatives/`, not under a team prompt folder

## Review Cadence

Minimum operating rhythm:

- daily or per-work-cycle:
  - update `docs/initiatives/NOW.md`
- weekly:
  - review all `active`, `blocked`, and `in_execution` docs
- milestone close:
  - mark docs as `completed`, `superseded`, or `archived`
- monthly:
  - archive stale completed docs

## PR / Change Discipline

Any PR or doc change that creates or materially updates a governed doc must also do the following:

- set or update front matter fields
- update `updated_at`
- update `docs/initiatives/NOW.md` if the doc is live
- update `docs/initiatives/DOC_INDEX.md` if the doc enters or leaves the governed set
- update `docs/initiatives/TIMELINE.md` if the status changes

If a change updates a doc but not its state surfaces, the change is incomplete.

## Minimal Adoption Plan

This design is intended to prevent future relapse, not to block present execution.

Adopt in this order:

1. all new docs must use front matter
2. introduce `docs/initiatives/NOW.md`
3. introduce `docs/initiatives/DOC_INDEX.md`
4. introduce `docs/initiatives/TIMELINE.md`
5. require status updates in doc PR reviews
6. gradually bring high-value live docs into the new model

## Explicit Non-Goals

This v1 does not require:
- full legacy backfill before adoption
- perfect historical timestamps
- immediate re-tagging of every old archived doc
- one universal workflow for all document types

## Decision Standard

The system is working only if any team member can answer these questions in under one minute:

- what is the current live truth
- which docs are actively driving execution
- which docs are blocked
- which docs are completed
- which doc replaced the old one
- who owns each live doc

If those answers still require guessing from timestamps, the system has failed.
