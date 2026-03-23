# Team Collaboration And Decision SOP

## Purpose

This SOP fixes three recurring problems:
- multiple functions changing the same user-facing decision at the same time
- downstream teams silently overriding upstream direction
- implementation being used to discover product, UX, or copy strategy too late

The operating principle is simple:
- decide by layer, not by seniority
- freeze the upstream layer before downstream execution
- every change has one owner, one DRI, and one escalation path

## Applies To

- current mixed team in this repo
- future project teams that need shared decision, design, copy, and engineering governance

## Functional Role Slots

Every team must map people into these six slots before work starts:

1. `Business Owner`
   - owns business goal, release priority, and tradeoff arbitration
2. `Product Owner`
   - owns scope, user path, CTA logic, and acceptance criteria
3. `Experience Owner`
   - owns information hierarchy, layout, visual system, and interaction feedback
4. `User Insight And Copy Owner`
   - owns persuasion logic, trust language, naming, CTA wording, and tone
5. `Architecture Owner`
   - owns system boundaries, contracts, implementation strategy, and technical risk
6. `Delivery Workers`
   - implement within assigned scope; they do not define upstream truth

## Current Team Mapping

- `Business Owner`: you / COO
- `Product Owner`: ByteDance product lead
- `Experience Owner`: Apple UI and interaction specialist
- `User Insight And Copy Owner`: Sam's-club-style customer psychology lead + Xiaohongshu copy specialist
- `Architecture Owner`: Microsoft architect
- `Delivery Workers`: the three Microsoft-aligned worker teams

## Decision Hierarchy

The team must follow this order of authority:

1. `Business Goal`
   - what outcome matters, what ships first, what can be cut
   - final owner: `Business Owner`
2. `Product Logic`
   - what the user is trying to do, what CTA sequence exists, what the flow should accomplish
   - final owner: `Product Owner`
3. `Experience Structure`
   - what the user sees first, page hierarchy, interaction model, layout, motion, visual priority
   - final owner: `Experience Owner`
4. `Persuasion And Copy`
   - why the user should trust the page, what wording increases confidence and action
   - final owner: `User Insight And Copy Owner`
5. `Technical Realization`
   - how the system is split, implemented, tested, and kept stable
   - final owner: `Architecture Owner`

Important constraint:
- downstream roles may optimize their layer
- downstream roles may not silently redefine upstream truth
- the `Architecture Owner` may reject an implementation only for feasibility, risk, timeline, or cost reasons, and must provide a concrete alternative

## Final Decision Table

| Topic | Final Owner | Must Be Consulted | Must Not Override |
| --- | --- | --- | --- |
| business target, release sequence, cut list | `Business Owner` | `Product Owner`, `Architecture Owner` | everyone else |
| feature scope, user flow, CTA priority, acceptance criteria | `Product Owner` | `Experience Owner`, `User Insight And Copy Owner`, `Architecture Owner` | workers |
| layout, interaction pattern, visual hierarchy, feedback states | `Experience Owner` | `Product Owner`, `Architecture Owner` | workers |
| naming, button wording, persuasive copy, trust framing | `User Insight And Copy Owner` | `Product Owner`, `Experience Owner` | workers |
| system contracts, module boundaries, integration order, non-functional risk | `Architecture Owner` | `Product Owner`, `Experience Owner` | workers |
| implementation details inside assigned scope | assigned `Delivery Worker` | `Architecture Owner` | peers outside scope |

## Non-Negotiable Rules

- One demand has one `DRI`, usually the `Product Owner`.
- One artifact has one owner.
- One layer has one source of truth.
- No implementation starts before upstream freeze for that layer.
- No oral instruction overrides the tracked document.
- No worker edits outside their approved write scope without escalation.
- No one may "fix" another layer by directly replacing it in code or design.

## Required Artifacts Before Build

Every meaningful feature or revision must produce the following package:

1. `Goal Brief`
   - target user
   - business objective
   - success metric
   - release constraint
2. `Product Spec`
   - user path
   - CTA sequence
   - entry and exit conditions
   - acceptance criteria
3. `Experience Spec`
   - page structure or wireframe
   - interaction rules
   - visual hierarchy
   - responsive notes
4. `Copy Spec`
   - page messages
   - CTA wording
   - trust and persuasion notes
   - prohibited language
5. `Architecture Plan`
   - scope split
   - contracts
   - dependencies
   - risk and rollback notes

If any one of these is missing, the work is not ready for multi-team implementation.

## Delivery Flow

### 1. Intake

- `Business Owner` defines objective and priority.
- `Product Owner` becomes the `DRI`.
- `Architecture Owner`, `Experience Owner`, and `User Insight And Copy Owner` join from the start, not after engineering begins.

### 2. Upstream Alignment

- `Product Owner` drafts the user path and CTA logic.
- `Experience Owner` shapes the screen structure and interaction model.
- `User Insight And Copy Owner` refines motivation, trust, and wording in the same round.
- `Architecture Owner` flags feasibility constraints early without rewriting the user experience.

### 3. Freeze Gate

The following items must be explicitly frozen before worker implementation:

- user goal and target scenario
- CTA order and success path
- page structure and interaction model
- canonical copy pack
- implementation scope and write ownership

### 4. Worker Decomposition

`Architecture Owner` splits work by module or layer, never by vague effort buckets.

Good split:
- worker A owns shared contracts
- worker B owns page shell
- worker C owns analytics wiring

Bad split:
- everyone changes the same screen in parallel
- engineering starts before page hierarchy or CTA logic is frozen

### 5. Build And Checkpoints

Each worker must declare before starting:
- owned scope
- files or modules in scope
- dependencies
- what they will not modify
- escalation trigger

Each checkpoint must answer:
- `green`: on track
- `yellow`: risk exists, decision needed soon
- `red`: blocked by upstream ambiguity or dependency

### 6. Acceptance Order

The acceptance sequence is fixed:

1. worker self-check
2. `Architecture Owner` technical review
3. `Experience Owner` UX and layout review
4. `User Insight And Copy Owner` language and persuasion review
5. `Product Owner` flow and CTA review
6. `Business Owner` release tradeoff decision

No lower step may claim completion if a higher-layer acceptance is still open.

## Change Control

Any change after freeze must be logged with:
- who raised it
- which layer it changes
- why it is needed
- schedule impact
- who approves it

Approval rules:

- change to business target or release scope: `Business Owner`
- change to feature path or CTA logic: `Product Owner`
- change to layout or interaction model: `Experience Owner`
- change to persuasive or trust language: `User Insight And Copy Owner`
- change to architecture or delivery sequence: `Architecture Owner`

If one change affects multiple layers, escalate upward to the `Business Owner` for final arbitration.

## Conflict Resolution

Use this sequence when departments clash:

1. identify the layer being disputed
2. identify the final owner of that layer
3. ask whether the dispute is about truth or only implementation
4. if it crosses layers, escalate one level up
5. log the decision in the tracked artifact

Examples:

- product wants a different CTA order: `Product Owner` decides
- design wants the CTA lower on the page: `Experience Owner` decides
- copy wants stronger trust wording on the same CTA: `User Insight And Copy Owner` decides
- engineering says the current version is too risky this sprint: `Architecture Owner` proposes alternatives; `Business Owner` decides ship/cut/delay

## What Workers Are Allowed To Do

Workers may:
- implement their assigned scope
- suggest improvements
- raise risk early
- propose alternatives with impact notes

Workers may not:
- redefine product flow on their own
- re-layout screens without experience approval
- replace copy strategy without copy approval
- expand scope silently
- overwrite peer modules outside their assignment

## Minimum Weekly Operating Rhythm

- one kickoff for each new initiative or major revision
- one short checkpoint per day during active delivery
- one freeze review before coding starts
- one integration review before release
- one retro after release for process correction

## Startup Checklist For Any New Team

Before a new team begins, confirm these seven items:

1. the six role slots are assigned
2. the `DRI` is named
3. the final decision table is acknowledged
4. the required artifact package exists
5. worker write scopes are split
6. freeze gate is passed
7. escalation path is visible to everyone

## Reusable Guardrail Prompt

Use the companion prompt file here when spinning up a new team:

- `/Users/lijiabo/Documents/New project/docs/workflow/teams/shared/new-team-collaboration-guardrail.prompt.md`
