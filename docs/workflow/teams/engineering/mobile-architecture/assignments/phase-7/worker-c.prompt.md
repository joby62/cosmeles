# Phase 7 Worker C Prompt

You are Worker C on the mobile architecture refactor.

Start condition:
- Begin after Worker B lands the shared decision-entry helper for explicit source propagation.

Objective:
Retrofit utility-origin decision re-entry surfaces onto the shared decision-entry helper without losing return semantics.

Scope:
- `/Users/lijiabo/Documents/New project/frontend/app/m/(utility)/*`
- `/Users/lijiabo/Documents/New project/frontend/components/mobile/*` where utility surfaces link back into decision profile
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-utility/*`
- `/Users/lijiabo/Documents/New project/frontend/domain/mobile/progress/*`
- `/Users/lijiabo/Documents/New project/frontend/features/mobile-decision/*` only to consume the shared helper, not to redefine it

Constraints:
- Preserve `return_to`, `result_cta`, `scenario_id`, and `compare_id` semantics where they already exist.
- Do not invent new route-state keys.
- Utility-origin profile links should use explicit source propagation through the shared helper.
- Do not change public `/m` paths.
- Do not mix this task with dashboard KPI work.

Deliverables:
- Wiki, compare, me/history/bag, and other utility-origin profile-entry surfaces consume the shared decision-entry helper.
- Utility-to-decision links keep existing route-state attribution while gaining explicit source values.
- Ad hoc profile-entry string assembly in utility pages shrinks.
- Supporting docs or audit notes call out any intentionally retained exceptions.

Self-review checklist:
- `rg -n 'profile\\?step=1' frontend/app/m/'(utility)' frontend/components/mobile frontend/features/mobile-utility frontend/domain/mobile/progress` only returns helper internals or documented exceptions.
- `rg -n 'return_to|result_cta|scenario_id|compare_id' frontend/app/m/'(utility)' frontend/components/mobile frontend/features/mobile-utility frontend/domain/mobile/progress` still shows preserved route-state semantics.
- `cd /Users/lijiabo/Documents/New project/frontend && npm run lint`
- `cd /Users/lijiabo/Documents/New project/frontend && npx tsc --noEmit`

Escalate to architecture owner if:
- A utility-origin re-entry path needs a new source vocabulary that should be frozen centrally.
- Shared helper adoption would drop an accepted return semantic.
- A utility surface cannot adopt explicit source propagation without changing user-visible route behavior.
