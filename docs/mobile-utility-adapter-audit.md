# Mobile Utility Adapter Audit (Phase 5 Worker B)

Date: 2026-03-14

## Removed In This Pass

- Removed page-level legacy key writes/usages under `frontend/app/m/(utility)`:
  - `compare/page.tsx`: `resultActionContext.from_compare_id` -> `compare_id`
  - `wiki/[category]/page.tsx`: event props `from_compare_id` -> `compare_id`
  - `wiki/product/[productId]/page.tsx`: event props `from_compare_id` -> `compare_id`
- Collapsed compare-result CTA hop query composition into shared route-state helper:
  - `compare/result/[compareId]/result-flow.tsx`: use `appendMobileUtilityRouteState(...)` instead of page-local `params.set("source"|"result_cta"|"compare_id")`.

## Remaining Legacy Compatibility Reads (Centralized)

- `frontend/features/mobile-utility/routeState.ts`
  - `parseMobileUtilityRouteState`: reads `compare_id || from_compare_id`.
- `frontend/lib/mobile/resultCtaAttribution.ts`
  - `parseResultCtaAttribution`: reads `compare_id || from_compare_id`.

These are read-only adapters for old deep links. New links write `compare_id` only.

## Deletion Candidates (When Legacy Link Window Is Closed)

1. Remove `from_compare_id` fallback in `parseResultCtaAttribution`.
2. Remove `from_compare_id` fallback in `parseMobileUtilityRouteState`.
3. Remove legacy-read comments and treat `compare_id` as the only accepted compare provenance key.

---

# Utility Decision Re-entry Audit (Phase 7 Worker C)

Date: 2026-03-15

## Landed

- Utility-origin decision profile re-entry now consumes shared decision-entry helper:
  - compare rewrite CTA: `frontend/app/m/(utility)/compare/page.tsx`
  - wiki category choose CTA: `frontend/app/m/(utility)/wiki/[category]/page.tsx`
- New utility adapter wraps shared helper while preserving route-state semantics:
  - `frontend/features/mobile-utility/decisionEntry.ts`
  - preserves `scenario_id / result_cta / compare_id`
  - keeps explicit source propagation by preventing route-state source override

## Intentionally Retained Exceptions

- None for `profile?step=1` under utility + mobile component surfaces in this phase.

---

# Frozen Source Call-site Adoption (Phase 8 Worker C)

Date: 2026-03-18

## Landed

- Me/history/bag continuation call sites now consume continuation surface helper presets instead of passing `sourceFallback` at page/component call sites:
  - `frontend/components/mobile/MobileBagPanel.tsx`
  - `frontend/components/mobile/MobileSelectionHistoryPanel.tsx`
  - `frontend/components/mobile/MobileCompareHistoryPanel.tsx`
- Surface-to-frozen-source mapping now stays in one helper owner:
  - `frontend/features/mobile-utility/useMobileUtilityContinuationLinks.ts`
  - frozen continuation vocabulary still resolved through `DECISION_CONTINUATION_SOURCE`

## Intentionally Retained Source Exceptions

- `frontend/app/m/(utility)/me/use/page.tsx` keeps `resolveMobileUtilitySource(..., "m_me_use")`.
- Reason: this is page analytics source for `my_use`, not decision-entry/continuation source propagation, so it stays outside `decision_entry_sources.v1.json`.
