# Phase 4 Worker A Prompt

You are Worker A on the mobile architecture refactor.

Objective:
Finish the analytics frontend cutover so `/analytics` reports the mobile decision funnel in the new decision-result vocabulary.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/components/analytics/*`
- `/Users/lijiabo/Documents/New project/frontend/lib/api.ts`
- `/Users/lijiabo/Documents/New project/frontend/lib/analyticsNav.ts`
- `/Users/lijiabo/Documents/New project/shared/mobile/contracts/analytics_events.json`
- `/Users/lijiabo/Documents/New project/backend/tests/test_mobile_analytics_api.py` only if API contract expectations must be updated in lockstep

Constraints:
- Do not change backend route paths or query parameter names.
- `/analytics` is an internal decision console, not a compare showcase wall.
- `compare_result_view` and `profile_result_view` may appear as legacy context only; they must not remain the primary result KPI lens.
- Do not invent frontend-only event aliases.
- If a panel still needs a legacy field, label it explicitly as compatibility context, not product truth.

Deliverables:
- Overview, funnel, and experience panels speak in `result_view`, `result_primary_cta_click`, `result_secondary_loop_click`, and `utility_return_click`.
- Dashboard types match the backend response contract.
- Session timeline and panel copy explain the decision result flow instead of the old compare/profile split.
- Analytics docs under `/analytics` describe the same north-star questions as the current product brief.

Self-review checklist:
- `rg -n "profile_result_view|compare_result_view" frontend/app/analytics frontend/components/analytics frontend/lib/api.ts` only returns intentional compatibility mentions.
- No stat card labels utility return traffic as primary result CTA traffic.
- Any new copy still answers the four weekly review questions before secondary detail.
- `npm run lint` and `npx tsc --noEmit` pass in `frontend/`.

Escalate to architecture owner if:
- You think the shared analytics contract needs a new event name.
- The dashboard cannot represent a required KPI without backend response changes.
- A legacy metric has to remain as more than a temporary compatibility panel.
