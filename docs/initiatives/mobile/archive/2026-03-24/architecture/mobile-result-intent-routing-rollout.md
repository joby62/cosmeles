---
doc_id: mobile-result-intent-routing-rollout-archive-2026-03-24
title: Archived Mobile Result Intent Routing Rollout (2026-03-24 Snapshot)
doc_type: archive
initiative: mobile
workstream: architecture
owner: architecture-owner
status: archived
priority: p1
created_at: 2026-03-24
updated_at: 2026-03-24
related_docs:
  - mobile-result-intent-routing-rollout
---

# Archived Snapshot Notice

This file is an archived snapshot of the original rollout document.
It is preserved for history and prompt compatibility and must not be treated as the current operating source of truth.

# Mobile Result Intent Routing Rollout

Status: `owner_frozen`  
Created on: `2026-03-19`

## Purpose
- Translate the product PRD into an implementation order the worker pool can execute without inventing a second route or analytics truth.
- Keep this rollout focused on the live decision-first product, not on archived phase choreography.

## Source Docs
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-decision-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-architecture-v2.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-refactor-playbook.md`

## Live Scope
- `/m/[category]/result` intent routing
- result-to-utility return semantics
- `/m` returning-user workspace layering
- analytics alignment for the above changes

## Non-goals
- Rebuilding compare or wiki internal information architecture
- Changing backend recommendation logic
- Expanding the public route family outside `/m`
- Introducing a second result-event vocabulary in the same pass

## Owner Freeze

### 1. Result page action model
- The result page is an intent-routing page, not a terminal explanation page.
- One strong primary CTA only:
  - `加入购物袋`
- Doubt-resolution paths are second layer and ordered:
  1. `和我现在在用的比一下`
  2. `看为什么推荐这款`
- Task-switch actions are third layer and must stay explicit:
  - `重测这类`
  - `测其他品类`
- Do not collapse task switching back into a single vague retry button.

### 2. Route-state and return semantics
- Result-to-utility hops must continue to carry:
  - `source`
  - `return_to`
  - `scenario_id`
  - `result_cta`
- `compare_id` remains optional provenance and appears only when compare context exists.
- `result_cta` vocabulary for this rollout is frozen to:
  - `bag_add`
  - `compare`
  - `rationale`
  - `retry_same_category`
  - `switch_category`
- `return_to` on a result-page request is downstream return context, not a signal to auto-redirect away from the result page itself.
- Fallbacks must land on a valid decision path; browser back is never the only business return mechanism.

### 3. Analytics freeze for Phase 10
- Keep the decision-result vocabulary anchored on:
  - `result_view`
  - `result_primary_cta_click`
  - `result_secondary_loop_click`
  - `utility_return_click`
- Do not add per-intent result event names in this pass.
- Express result intent through existing event props:
  - `result_cta`
  - `action`
  - `target_path`
- Returning-user home quick actions may use:
  - `home_workspace_quick_action_click`
- Existing bag system events such as `bag_add_success` remain supporting product events, not replacements for decision-result primary metrics.

### 4. `/m` home layering freeze
- New users still see the single decision-first landing.
- Returning users move by priority:
  1. unfinished questionnaire -> `继续上次进度`
  2. recent result -> `回看上次结果`
  3. current in-use product -> `和当前在用做对比`
  4. workspace quick actions -> `测新的` / `对比` / `查百科` / `我的`
- Returning-user workspace may not regress into a first-visit four-entry portal.

## Worker Split
- Owner:
  - freeze rollout semantics and assignment boundaries
- Worker B:
  - truth owner for route-state, `result_cta`, source propagation, and result-return helper behavior
- Worker C:
  - result-page and home-surface adoption on top of Worker B's frozen helper semantics
- Worker A:
  - analytics contract alignment, dashboard/docs wording, and event-consumption recheck

## Merge Order
1. Owner freeze docs and minimal contract updates
2. Worker B helper / route-state truth
3. Worker C result page and home workspace adoption
4. Worker A analytics alignment and dashboard/docs cleanup
5. Owner integration review across result -> utility -> return -> home workspace

## Review Gates
- No result-page request auto-redirects away solely because `return_to` is present.
- The result page exposes exactly one strong conversion CTA.
- Compare sits above rationale in the doubt-resolution layer.
- `重测这类` and `测其他品类` stay distinct.
- No new result-event vocabulary is introduced outside the frozen contract.
- Returning-user `/m` becomes a workspace without regressing new-user first-visit clarity.

## Archive Metadata

- archive_date: `2026-03-24`
- archive_source_path: `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-intent-routing-rollout.md`
- original_file_birth_time: `2026-03-19 12:38:34 +0800`
- original_file_last_modified_time: `2026-03-19 12:38:34 +0800`
