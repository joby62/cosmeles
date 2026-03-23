---
doc_id: mobile-utility-adapter-audit-log-v1
title: Mobile Utility Continuation Audit Log
doc_type: review
initiative: mobile
workstream: architecture
owner: architecture-owner
status: active
priority: p1
created_at: 2026-03-19
updated_at: 2026-03-24
related_docs:
  - mobile-refactor-playbook
  - mobile-first-run-and-compare-closure-rollout
---

# Mobile Utility Continuation Audit Log

Status checked on: `2026-03-19`

## Purpose
- Track the live utility-side compatibility reads, continuation helpers, and intentional source exceptions that still exist in the mobile stack.
- Keep this file stable for current team prompts while moving older phase-by-phase wording into the archive.

## Current Confirmed State
- Utility route-state parsing and append logic is centralized in `frontend/features/mobile-utility/routeState.ts`.
- Utility-to-decision profile re-entry is centralized through `frontend/features/mobile-utility/decisionEntry.ts`.
- `me`, history, and bag continuation links are built through `frontend/features/mobile-utility/useMobileUtilityContinuationLinks.ts` instead of page-local source fallback wiring.

## Remaining Compatibility Reads
- `frontend/features/mobile-utility/routeState.ts`
  - `parseMobileUtilityRouteState(...)` still reads `compare_id || from_compare_id`.
- `frontend/lib/mobile/resultCtaAttribution.ts`
  - `parseResultCtaAttribution(...)` still reads `compare_id || from_compare_id`.

These remain read-only adapters for old deep links. New links write `compare_id` only.

## Intentional Current Exception
- `frontend/app/m/(utility)/me/use/page.tsx`
  - keeps `resolveMobileUtilitySource(..., "m_me_use")`
  - reason: `m_me_use` is still page analytics source for the `my_use` surface, not decision-entry or continuation vocabulary

## Deletion Candidates
1. Remove the `from_compare_id` fallback in `parseResultCtaAttribution(...)` after the legacy deep-link window is closed.
2. Remove the `from_compare_id` fallback in `parseMobileUtilityRouteState(...)` after the same window closes.
3. Remove the legacy-read comments once `compare_id` is the only supported compare provenance key.

## Archived Reference
- Historical pre-cleanup snapshot:
  - [`../../archive/2026-03-19/architecture/mobile-utility-adapter-audit.md`](../../archive/2026-03-19/architecture/mobile-utility-adapter-audit.md)
