# Jeslect / Cosmeles

> Last updated: March 13, 2026

Chinese version: [README.zh-CN.md](README.zh-CN.md)

## Current Direction

`jeslect.com` is now the primary product direction.

The current target is:

- Market: United States first, United Kingdom second
- Product type: English-first beauty and personal-care independent storefront
- Operating scope: pre-checkout storefront
- Core model: fit-first shopping, not SKU-first shopping
- Current commerce boundary: checkout and payment are intentionally out of scope for now

In practical terms, Jeslect is not yet a full ecommerce stack.
It is a US-facing storefront that helps users understand, compare, and save the right product path before checkout exists.

The legacy Chinese/mobile structure is retained as reference in `frontend-legacy/`.
The active standalone storefront lives in `frontend/`.

## Product Positioning

### One-line definition

Jeslect helps users find products that fit their routine, with less guesswork and clearer product guidance.

### Internal product definition

Jeslect is a fit-first pre-checkout beauty storefront for hair, body, and skin care.

### What the site is trying to do

- Reduce product-choice anxiety
- Explain fit more clearly than a normal shop grid
- Surface shipping, returns, and support before checkout
- Preserve user progress across Bag, Match, Compare, and Saved states
- Connect learning and product selection in one journey

### What the site is not trying to do yet

- Full checkout and payment
- Order management
- Post-purchase logistics handling
- A fake “complete store” with invented price, stock, or ETA data

## User Value

Jeslect currently delivers value in four layers:

### 1. Clarity

Users can understand:

- what a product is
- who it is for
- who it is not ideal for
- why it fits a route

### 2. Fit

Users are not forced to guess from a large catalog.
They can narrow decisions through:

- `Match`
- `Compare`
- `Learn`
- concern-first browsing

### 3. Confidence

Users can see trust basics before checkout exists:

- shipping framing
- returns framing
- support routing
- ingredient transparency
- privacy / terms / cookies scope

### 4. Continuity

Users do not lose progress when they leave.
The storefront currently supports recovery for:

- Bag
- Saved
- Match history
- Compare history
- recent product views

## Brand Language

Jeslect should sound:

- calm
- precise
- useful
- non-judgmental

Jeslect should avoid:

- hype-heavy luxury language
- vague “technology” claims
- overpromising efficacy
- pressure-first ecommerce copy

### Recommended homepage Hero

- Eyebrow: `Jeslect US`
- Headline: `Find products that fit your routine.`
- Subheadline: `Shop hair, body, and skin care with clearer fit, cleaner comparisons, and less guesswork.`
- Primary CTA: `Find my match`
- Secondary CTA: `Shop by concern`

## Current Information Architecture

Public storefront routes currently in scope:

- `/`
- `/shop`
- `/shop/[category]`
- `/collections/[slug]`
- `/product/[id]`
- `/match`
- `/match/[sessionId]`
- `/compare`
- `/compare/[compareId]`
- `/learn`
- `/learn/product/[productId]`
- `/learn/ingredient/[category]/[ingredientId]`
- `/search`
- `/bag`
- `/saved`
- `/support`
- `/support/shipping`
- `/support/returns`
- `/support/faq`
- `/support/contact`
- `/privacy`
- `/terms`
- `/cookies`
- `/about`
- `/ops/commerce` (internal operations route)

## Repo Layout

```text
backend/                    FastAPI + SQLite + file storage
frontend/                   Active Jeslect standalone storefront
frontend-legacy/            Frozen legacy frontend for reference only
docs/                       Operational and project notes
```

## Local Run

Run the storefront in two terminals: backend first, frontend second.

### 1. Backend

Recommended local command for this repo:

```bash
cd /Users/lijiabo/cosmeles/backend
PYTHONPATH='/Users/lijiabo/cosmeles/backend' conda run -n cosmeles uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Notes:

- The backend listens on `http://127.0.0.1:8000`
- If Doubao-related env vars are needed, configure `backend/.env.local` first
- Health checks:

```bash
curl -s http://127.0.0.1:8000/healthz
curl -s http://127.0.0.1:8000/readyz
```

### 2. Frontend

In a second terminal:

```bash
cd /Users/lijiabo/cosmeles/frontend
npm run dev
```

Notes:

- The storefront runs at `http://127.0.0.1:3000`
- Frontend API rewrites point to `http://127.0.0.1:8000`
- Optional support contact values can be added to `frontend/.env.local`

### 3. Open the site

- Main storefront: `http://127.0.0.1:3000`
- Internal commerce workbench: `http://127.0.0.1:3000/ops/commerce`

### 4. Chinese shell demo

- Use the header switcher: `EN / 中`
- This demo currently changes the shell layer only:
  brand lockup, nav labels, footer tone, and the `婕选` logo treatment
- Core page bodies remain mostly English on purpose; this is a shell-level demo, not full i18n

### 5. Verification commands

Frontend lint:

```bash
cd /Users/lijiabo/cosmeles/frontend
node ./node_modules/eslint/bin/eslint.js app components lib --max-warnings=0
```

Frontend build:

```bash
cd /Users/lijiabo/cosmeles/frontend
node ./node_modules/next/dist/bin/next build --debug
```

Backend pytest:

```bash
PYTHONPATH='/Users/lijiabo/cosmeles:/Users/lijiabo/cosmeles/backend' conda run -n cosmeles pytest '/Users/lijiabo/cosmeles/backend/tests/test_mobile_compare.py' -q
```

## Phase Plan

This roadmap is based on the real state of the current branch, not a greenfield wishlist.

### P0 | US Pre-checkout Launch Baseline

Status:

- Progress: about 93% to 95%
- Stage: late P0 / launch hardening

Goal:

Ship a US-facing English storefront that can support discovery, fit, compare, learn, save, and support visibility without pretending checkout already exists.

P0 scope:

- English standalone storefront shell
- US-first IA
- fit-first product decision flow
- support and legal baseline
- saved-state continuity
- commerce readiness and feed plumbing
- no payment, no checkout, no order management

P0 already completed:

- New standalone storefront in `frontend/`
- Legacy frontend frozen into `frontend-legacy/`
- Home, Shop, Category, Product, Match, Compare, Learn, Bag, Saved, Search, Collections
- Support hub plus Shipping / Returns / FAQ / Contact / Privacy / Terms / Cookies
- Device-level recovery for Bag, Saved, Match, Compare, recent product views
- Product commerce readiness exposed from backend to frontend
- Internal commerce operations workbench
- JSON / CSV / TSV commerce import
- Configurable support contact entry
- Evidence-based trust layer across Product / Learn / Compare
- Public product sorting now biased toward stronger commerce completeness

P0 still remaining:

- Fill real commerce data across a larger percentage of products:
  price, inventory, shipping ETA, pack size
- Configure a real support inbox in production environment
- Finish one launch-grade QA pass across:
  mobile layout
  desktop layout
  empty states
  error states
  support/legal cross-links
- Tighten homepage / About / trust language so the brand reads as launch-ready, not just functionally complete

P0 explicit non-goals:

- checkout
- payment
- shipping method selection
- order creation
- post-purchase support operations

P0 exit criteria:

- A US user can move from discovery to decision without dead ends
- No Chinese copy appears in the new storefront
- No fake commerce data is shown
- Trust pages are visible and internally consistent
- Saved-state continuity works across the main decision flow
- Commerce coverage is good enough that the storefront does not feel hollow on first browse

Current P0 risk concentration:

- real product data completeness
- social proof strategy
- operational support readiness

### P1 | Launch Hardening + Conversion Foundation

Status:

- Progress: about 25% to 35%
- Stage: groundwork laid, not yet fully executed

Goal:

Turn the current storefront from “usable and honest” into “launch-resilient and conversion-capable.”

P1 focus areas:

- Broader commerce coverage across the live catalog
- Better product ranking based on fit confidence and commerce completeness
- Stronger brand trust and quality language
- Formal review / proof strategy
- Search and collection page hardening
- Analytics, accessibility, and performance pass
- Better support operations handoff

P1 concrete deliverables:

- Higher coverage of price / inventory / shipping ETA across products
- Review strategy and display logic:
  real review source or explicit evidence-first alternative
- Stronger About page and brand standards page structure
- Improved category and collection sorting logic
- Better search result ordering
- Final trust polish on homepage and PDP
- Monitoring of key pre-checkout funnel events:
  landing
  PDP view
  match completion
  compare completion
  add to bag
  saved recovery

P1 exit criteria:

- Most high-intent users see enough real commerce data to continue
- The storefront has a coherent trust strategy, not just support links
- Search, category, collection, and PDP feel like one conversion system
- The site is ready for traffic scaling before checkout exists

### P2 | Full Shop + Regional Expansion

Status:

- Progress: about 5% to 10%
- Stage: intentionally deferred

Goal:

Turn Jeslect from a pre-checkout storefront into a real operating shop, then expand beyond the initial US-first foundation.

P2 scope:

- checkout
- payment
- address handling
- shipping methods
- order confirmation
- order history
- post-purchase support operations
- UK regionalization
- stronger lifecycle systems:
  email flows
  account layer
  loyalty / bundles / subscriptions if justified

P2 prerequisites:

- P0 must be truly stable
- P1 trust and commerce coverage must be strong enough
- payment and order systems must be intentionally designed, not patched in

P2 exit criteria:

- Jeslect can actually transact
- storefront promises match operational reality
- US and UK policy, shipping, and support differences are handled explicitly

## Current Progress Summary

As of March 12, 2026:

- P0 is almost complete in pre-checkout terms
- P1 groundwork is partly in place but still needs execution
- P2 is intentionally not active yet

In one sentence:

Jeslect has already crossed the “new standalone storefront exists and works” threshold, and is now primarily blocked by launch hardening, content/data completeness, and trust operations rather than missing page architecture.

## Local Development

### Backend

```bash
cd /Users/lijiabo/cosmeles/backend
PYTHONPATH='/Users/lijiabo/cosmeles/backend' conda run -n cosmeles uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### Frontend

```bash
cd /Users/lijiabo/cosmeles/frontend
npm run dev
```

Then open:

- `http://127.0.0.1:3000`

### Optional support contact env

Add these to `frontend/.env.local` if you want the support page to show a live contact channel:

```env
SUPPORT_EMAIL=hello@jeslect.com
SUPPORT_RESPONSE_WINDOW=Replies within 1-2 business days
SUPPORT_HOURS=Mon-Fri, 9:00 AM-6:00 PM ET
SUPPORT_SCOPE_NOTE=Pre-purchase fit, shipping, and policy questions only.
```

## Legacy Note

The older MatchUp / mobile-first Chinese implementation remains in this repo for reference and capability reuse.
It is not the active product direction for the current Jeslect US standalone storefront.
