# Phase 10 Worker A Prompt

You are Worker A on the mobile result-intent routing rollout.

Read first:
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/product/mobile-result-intent-routing-prd-v1.md`
- `/Users/lijiabo/Documents/New project/docs/initiatives/mobile/architecture/mobile-result-intent-routing-rollout.md`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/README.md`

Objective:
- Align analytics consumption and docs to the owner-frozen result-intent routing rollout.
- Keep the decision-result vocabulary on the existing event family while making the new intent model observable.

Task Boundary:
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/backend/app/routes/products.py`
- `/Users/lijiabo/Documents/New project/backend/app/schemas.py`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/README.md`

Do Not Touch:
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/SelectionPublishedResultFlow.tsx`
- `/Users/lijiabo/Documents/New project/frontend/app/m/(decision)/page.tsx`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`

Deliverables:
- Keep `result_view`, `result_primary_cta_click`, `result_secondary_loop_click`, and `utility_return_click` as the primary decision-result vocabulary.
- Make the new result-intent rollout visible through existing event props such as `result_cta`, `action`, and `target_path`.
- Add support for `home_workspace_quick_action_click` where analytics docs or consumption layers need it.
- Recheck that compare remains supporting context, not the primary result-success story.

Self-review Checklist:
- `rg -n 'result_primary_cta_click|result_secondary_loop_click|utility_return_click|home_workspace_quick_action_click' /Users/lijiabo/Documents/New\\ project/frontend/app/analytics /Users/lijiabo/Documents/New\\ project/frontend/components/analytics /Users/lijiabo/Documents/New\\ project/backend /Users/lijiabo/Documents/New\\ project/shared`
- `rg -n 'result_add_to_bag_click|result_compare_entry_click|result_rationale_entry_click|result_retry_same_category_click|result_switch_category_click' /Users/lijiabo/Documents/New\\ project/frontend /Users/lijiabo/Documents/New\\ project/backend /Users/lijiabo/Documents/New\\ project/shared`

Must-run Verification:
- `cd /Users/lijiabo/Documents/New project && PYTHONPATH='/Users/lijiabo/Documents/New project:/Users/lijiabo/Documents/New project/backend' conda run -n cosmeles python3 -m pytest -q backend/tests/test_mobile_analytics_api.py`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`

Escalate To Owner When:
- Observability would require a second result-event vocabulary instead of reusing the frozen event family.
- Backend summary shapes need to change to expose the rollout correctly.
- The proposed home workspace quick action event would distort current P0 funnel reporting instead of supporting it.
