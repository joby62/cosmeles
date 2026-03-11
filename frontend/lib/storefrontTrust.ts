export const BAG_TRUST_POINTS = [
  "Your bag stays saved on this device, so you can leave and come back without rebuilding your shortlist.",
  "Shipping, returns, and support links stay visible before checkout, not buried after the decision is made.",
  "Every saved item stays one tap from product details, compare, and learn pages.",
] as const;

export const BAG_SUPPORT_LINKS = [
  {
    title: "Shipping expectations",
    summary: "See how Jeslect plans to show processing, delivery windows, and tracking before payment.",
    href: "/support/shipping",
  },
  {
    title: "Returns clarity",
    summary: "Review the return window, refund timing, and condition rules before you commit to a product.",
    href: "/support/returns",
  },
  {
    title: "Contact path",
    summary: "Know where product, shipping, and returns questions should go before order support opens.",
    href: "/support/contact",
  },
] as const;

export const SHIPPING_SECTIONS = [
  {
    title: "What Jeslect shows before checkout",
    items: [
      "Processing time is shown separately from delivery time so the total wait is easier to understand.",
      "Delivery windows are shown on the product and bag path before payment begins.",
      "Tracking expectations stay visible as part of the shopping flow, not only in post-purchase emails.",
    ],
  },
  {
    title: "How US launch shipping is framed",
    items: [
      "Jeslect starts with a US-first shipping experience before adding UK-specific delivery logic.",
      "Where products ship from and which regions are currently served should be stated in plain language.",
      "If a product has a different fulfillment path, the storefront should say so before the order is placed.",
    ],
  },
  {
    title: "What should never feel hidden",
    items: [
      "Shipping cost visibility",
      "Processing delays or slower routes",
      "Tracking handoff expectations",
    ],
  },
] as const;

export const RETURNS_SECTIONS = [
  {
    title: "What customers should know before buying",
    items: [
      "The return window should be visible before payment starts.",
      "Refund timing should be described in plain language instead of policy jargon.",
      "Any category exceptions should be named directly so customers are not surprised later.",
    ],
  },
  {
    title: "How Jeslect frames returns for trust",
    items: [
      "Returns should read like a shopping-confidence page, not a defensive legal trap.",
      "Condition requirements should stay specific enough to be understandable at a glance.",
      "Customers should always see where to go next if they are unsure about eligibility.",
    ],
  },
  {
    title: "What belongs near the bag",
    items: [
      "Return window summary",
      "Condition expectations",
      "Contact path for product and order questions",
    ],
  },
] as const;

export const FAQ_ITEMS = [
  {
    question: "Does my Jeslect bag stay saved if I leave the site?",
    answer: "Yes. The bag is stored on this device so you can come back without rebuilding the shortlist from scratch.",
  },
  {
    question: "How does Match connect to Compare?",
    answer: "Match saves a route decision for the category you answered. Compare then reuses that saved basis to judge products against your current fit.",
  },
  {
    question: "Where do shipping and returns appear?",
    answer: "They stay visible as first-class support pages and are linked from product, bag, and footer paths before checkout starts.",
  },
  {
    question: "Why does Jeslect show a route explanation before product details?",
    answer: "The storefront is built around fit-first shopping, so the route explains why a product belongs in your routine before you dig into ingredients and compare detail.",
  },
] as const;

export const CONTACT_SECTIONS = [
  {
    title: "Support routing principle",
    items: [
      "Product questions, shipping questions, and return questions should not be mixed into one vague inbox path.",
      "The storefront should tell customers what kind of help belongs in each channel before they submit anything.",
      "Response expectations should be stated near the contact path, not left as a mystery.",
    ],
  },
  {
    title: "What customers should always be able to find",
    items: [
      "How to ask about product fit",
      "How to ask about shipping and tracking",
      "How to ask about return eligibility",
    ],
  },
] as const;

export const PDP_TRUST_NOTES = [
  "Your bag stays saved on this device, so you can keep the shortlist visible while you compare or leave and come back.",
  "Shipping timing, return expectations, and support paths should stay visible before checkout starts.",
  "Product, learn, and compare routes should stay one tap away from this page.",
] as const;

export const PDP_SUPPORT_LINKS = [
  {
    title: "Shipping before payment",
    summary: "Review how Jeslect frames processing windows, delivery timing, and tracking expectations for the US launch.",
    href: "/support/shipping",
  },
  {
    title: "Returns before hesitation",
    summary: "Check the return window, refund timing, and condition rules before committing to this product.",
    href: "/support/returns",
  },
  {
    title: "Support routing",
    summary: "See where product-fit, shipping, and returns questions should go before order support opens.",
    href: "/support/contact",
  },
] as const;

export const SHOP_SUPPORT_LINKS = [
  {
    title: "Shipping visibility",
    summary: "See how Jeslect keeps processing windows and delivery timing visible before checkout exists.",
    href: "/support/shipping",
  },
  {
    title: "Returns clarity",
    summary: "Review return expectations before you commit to a product path.",
    href: "/support/returns",
  },
  {
    title: "Support routing",
    summary: "Know where product-fit and order questions should go before support volume grows.",
    href: "/support/contact",
  },
] as const;

export const SEARCH_SUGGESTIONS = [
  { label: "dryness", query: "dryness" },
  { label: "frizz", query: "frizz" },
  { label: "sensitive", query: "sensitive" },
  { label: "oil control", query: "oil" },
  { label: "barrier", query: "barrier" },
  { label: "cleanser", query: "cleanser" },
] as const;

export const SEARCH_TRUST_POINTS = [
  "Search should narrow the field, then hand you off cleanly to Match, Compare, or the right category page.",
  "Support links stay visible from search so users do not have to guess where shipping and returns live.",
  "Saved bag continuity matters here too: search is part of the decision path, not a dead-end results page.",
] as const;
