export const POLICY_LAST_UPDATED = "March 11, 2026";

export const POLICY_SCOPE_NOTE =
  "Last updated March 11, 2026. Applies to the current US pre-checkout Jeslect storefront. Checkout, payment, and post-purchase order handling are not live in this build.";

export const SUPPORT_HUB_LINKS = [
  {
    title: "Shipping",
    summary: "Processing windows, delivery framing, and what Jeslect plans to surface before ordering opens.",
    href: "/support/shipping",
  },
  {
    title: "Returns",
    summary: "Return-window language, refund timing expectations, and which rules belong near the bag.",
    href: "/support/returns",
  },
  {
    title: "FAQ",
    summary: "The quickest read on bag behavior, current storefront scope, and how Match/Compare connect.",
    href: "/support/faq",
  },
  {
    title: "Contact",
    summary: "Pre-purchase support routing for fit, policy, and legal questions while checkout remains out of scope.",
    href: "/support/contact",
  },
] as const;

export const SUPPORT_LEGAL_LINKS = [
  {
    title: "Privacy",
    summary: "See what the current US storefront collects for saved state, fit tools, and public support visibility.",
    href: "/privacy",
  },
  {
    title: "Terms",
    summary: "Read the current scope for discovery, bag behavior, fit guidance, and pre-checkout storefront use.",
    href: "/terms",
  },
  {
    title: "Cookies",
    summary: "Understand which state is necessary for Bag, Match, Compare, and Saved continuity on this build.",
    href: "/cookies",
  },
] as const;

export const SHIPPING_POLICY_SECTIONS = [
  {
    title: "What Jeslect shows before ordering opens",
    items: [
      "Processing time should be shown separately from delivery timing so customers do not have to guess the full wait.",
      "Product, bag, and support paths should surface the same shipping framing before checkout goes live.",
      "If a product follows a different fulfillment path later, that exception should appear before order creation, not after.",
    ],
  },
  {
    title: "How the US launch should frame delivery",
    items: [
      "Jeslect is currently written for a US-first storefront before UK-specific shipping rules are layered in.",
      "Shipping origin, service region, and delivery-window language should stay readable to a first-time visitor.",
      "Tracking expectations should be treated as part of shopping confidence, not buried in post-order messaging.",
    ],
  },
  {
    title: "What still needs a real commerce feed",
    items: [
      "Per-product shipping ETA",
      "Shipping-rate thresholds or service tiers",
      "Live carrier and fulfillment exceptions once checkout is introduced",
    ],
  },
] as const;

export const RETURNS_POLICY_SECTIONS = [
  {
    title: "What customers should know before they commit",
    items: [
      "The return window should be visible from product, bag, and support paths before payment exists.",
      "Refund timing should read like a customer promise, not a block of defensive policy jargon.",
      "Any exclusions or condition rules should be named directly so they do not feel hidden later.",
    ],
  },
  {
    title: "How Jeslect should frame return trust",
    items: [
      "Returns language should reduce hesitation at the decision stage, especially while the storefront is still pre-checkout.",
      "Condition expectations should stay specific enough to understand in one pass on mobile.",
      "If a visitor is unsure whether a product fits, the storefront should route them back to Match, Compare, or support before that becomes a return issue.",
    ],
  },
  {
    title: "What still depends on launch operations",
    items: [
      "A finalized US return window",
      "A live refund-processing workflow once payment and orders exist",
      "Named category exceptions after the full commerce stack is connected",
    ],
  },
] as const;

export const SUPPORT_FAQ_ITEMS = [
  {
    question: "Does my Jeslect bag stay saved if I leave the site?",
    answer: "Yes. Jeslect stores the current shortlist on this device so you can return without rebuilding Bag, Match context, and recent decision paths from scratch.",
  },
  {
    question: "Can I check out on Jeslect right now?",
    answer:
      "Not yet. The current US storefront is live for discovery, fit, Compare, Learn, Saved recovery, and pre-purchase support. Checkout, payment, and post-order flow are not published in this build.",
  },
  {
    question: "Why do some products still not show price, stock, or final delivery dates?",
    answer:
      "Because Jeslect only shows commerce fields once a real product feed provides them. The storefront does not invent pricing, availability, or ETA details to make the shop look more complete than it really is.",
  },
  {
    question: "How do Match and Compare work together?",
    answer:
      "Match builds a route recommendation for the category you answer. Compare can then reuse that saved route context to judge which product aligns better with your current needs.",
  },
  {
    question: "Where should I look for shipping, returns, and policy basics?",
    answer:
      "The support hub keeps Shipping, Returns, FAQ, Contact, Privacy, Terms, and Cookies visible before checkout exists. Those links also stay close to product and bag paths.",
  },
  {
    question: "What kind of help does Jeslect support cover today?",
    answer:
      "Current support scope is pre-purchase only: product-fit questions, public policy questions, Bag behavior, and how Match or Compare decisions connect across the storefront.",
  },
] as const;

export const PRIVACY_SECTIONS = [
  {
    title: "What Jeslect currently collects",
    items: [
      "Basic browsing requests needed to load the storefront and route API calls.",
      "Device-linked saved state used for Bag, Saved activity, Match history, and Compare history.",
      "Product and route interactions such as search, category browsing, compare runs, and saved shortlist activity.",
      "Support messages or privacy questions only if Jeslect later publishes a direct submission path.",
    ],
  },
  {
    title: "What Jeslect does not collect in this build",
    items: [
      "Payment card data, because checkout is not live.",
      "Order history or shipping addresses tied to a customer account, because ordering is not published yet.",
      "More personal data than is necessary to run current storefront features.",
    ],
  },
  {
    title: "How storefront data is used",
    items: [
      "To keep Bag, Match, Compare, and Saved recovery working across a device session.",
      "To improve product fit, route explanations, and product discovery quality.",
      "To keep shipping, returns, and support content visible in the decision flow.",
    ],
  },
  {
    title: "Privacy expectations for US launch",
    items: [
      "Necessary storefront state should stay distinct from optional analytics or advertising tools.",
      "If optional analytics is added later, Jeslect should present it separately from required commerce state.",
      "Privacy questions should route through the support path with clear scope and readable language.",
    ],
  },
] as const;

export const TERMS_SECTIONS = [
  {
    title: "Current storefront scope",
    items: [
      "Jeslect currently operates as a pre-checkout storefront for discovery, fit, compare, learn, and saved shortlist activity.",
      "Adding a product to Bag does not reserve inventory, create an order, or guarantee availability.",
      "Published commerce fields are informational until a real checkout flow is introduced.",
    ],
  },
  {
    title: "Product information and fit guidance",
    items: [
      "Jeslect product pages, Match, Compare, and Learn are decision-support tools for shopping clarity.",
      "Nothing on this storefront should be read as medical advice or treatment guidance.",
      "Users should review ingredient information and watchouts before deciding whether a product fits their routine.",
    ],
  },
  {
    title: "Use of the storefront",
    items: [
      "The storefront may change product details, route logic, and support content as Jeslect continues the US launch.",
      "Users should not misuse the site, interfere with service availability, or scrape data in ways that harm the storefront.",
      "Jeslect may limit or change features while the independent store is still being built.",
    ],
  },
] as const;

export const COOKIE_SECTIONS = [
  {
    title: "Necessary storefront state",
    items: [
      "Jeslect uses necessary device-linked state to keep Bag, Saved activity, Match, and Compare recoverable.",
      "These state paths support core storefront behavior and are not the same as optional analytics or ad tracking.",
      "Without necessary state, users would lose shortlist continuity and saved decision context.",
    ],
  },
  {
    title: "Optional tools and future consent",
    items: [
      "If Jeslect adds optional analytics, campaign attribution, or advertising tools later, they should be presented separately.",
      "Optional tools should not be bundled into the same explanation as required storefront state.",
      "Consent choices should stay mobile-readable and revisitable from the footer and support layer.",
    ],
  },
  {
    title: "What users should be able to understand quickly",
    items: [
      "Which cookies are necessary for the storefront to work.",
      "Which tools are optional and why they exist.",
      "How to revisit those choices later without hunting through unrelated pages.",
    ],
  },
] as const;

export const CONTACT_ROUTE_SECTIONS = [
  {
    title: "What support covers right now",
    items: [
      "Pre-purchase questions about product fit, route logic, Compare results, and storefront policy clarity.",
      "Questions about how Bag, Saved, Match, and Compare currently behave on the US storefront.",
      "Questions about public shipping, returns, privacy, or terms content.",
    ],
  },
  {
    title: "What support does not cover yet",
    items: [
      "Payment troubleshooting, because checkout is not live.",
      "Order modifications, shipment tracking, or refunds tied to a placed order, because transactional order flow is not published yet.",
      "Medical or treatment advice beyond what the storefront explicitly states.",
    ],
  },
  {
    title: "How routing should stay clear",
    items: [
      "Product fit questions should stay separate from privacy or legal questions.",
      "Shipping and returns policy questions should be answerable from public pages before a direct support exchange is needed.",
      "Jeslect should publish a clear contact channel before any live order flow opens.",
    ],
  },
] as const;
