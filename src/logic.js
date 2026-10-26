/*
 * CelebrAIte — pure planning logic (no DOM, no network).
 * Runs in the browser (window.CelebrAIte) and in Node for unit tests
 * (module.exports). Every output is computed from the user's context.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CelebrAIte = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------------- deterministic RNG (seeded by plan context) -------- */
  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
  function shuffle(rng, arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------------- formatting ---------------- */
  function inr(n) {
    return '₹' + Math.round(n).toLocaleString('en-IN');
  }
  function round100(n) { return Math.max(0, Math.round(n / 100) * 100); }
  function clamp(n, lo, hi) { return Math.min(hi, Math.max(lo, n)); }

  /* ---------------- domain data ---------------- */
  const EVENT_TYPES = {
    wedding: {
      label: 'Wedding',
      base: { venue: 0.28, catering: 0.30, decor: 0.10, photo: 0.09, music: 0.05, attire: 0.08, invites: 0.03, misc: 0.07 },
      categories: { venue: 'Venue & rentals', catering: 'Catering & cake', decor: 'Décor & flowers', photo: 'Photo & video', music: 'Music & entertainment', attire: 'Attire & styling', invites: 'Invitations & stationery', misc: 'Misc & buffer' },
    },
    birthday: {
      label: 'Birthday party',
      base: { venue: 0.22, catering: 0.32, decor: 0.12, photo: 0.07, music: 0.07, attire: 0.03, invites: 0.04, misc: 0.13 },
      categories: { venue: 'Venue & rentals', catering: 'Food, drinks & cake', decor: 'Décor & balloons', photo: 'Photo & video', music: 'Music & entertainment', attire: 'Outfits', invites: 'Invitations', misc: 'Games, return gifts & buffer' },
    },
    community: {
      label: 'Community event',
      base: { venue: 0.24, catering: 0.28, decor: 0.08, photo: 0.06, music: 0.08, attire: 0.01, invites: 0.05, misc: 0.20 },
      categories: { venue: 'Venue & seating', catering: 'Food & refreshments', decor: 'Décor & signage', photo: 'Photo & video coverage', music: 'Sound, stage & entertainment', attire: 'Volunteer kits', invites: 'Publicity & invites', misc: 'Permits, safety & buffer' },
    },
  };

  function budgetTier(perGuest) {
    if (perGuest < 800) return { id: 'smart', label: 'Smart saver', cateringCap: 450 };
    if (perGuest < 2000) return { id: 'balanced', label: 'Balanced', cateringCap: 1100 };
    if (perGuest < 4500) return { id: 'grand', label: 'Grand', cateringCap: 2400 };
    return { id: 'royal', label: 'Royal', cateringCap: 5000 };
  }

  /* ---------------- 1. Budget allocator ----------------
   * Weights shift by event type, guest scale (venue/catering economies),
   * and tier (tight budgets push share to food + venue, trim décor/attire).
   * Catering is sanity-capped per guest; freed money flows to the buffer. */
  function allocateBudget(ctx) {
    const spec = EVENT_TYPES[ctx.eventType] || EVENT_TYPES.wedding;
    const guests = Math.max(1, ctx.guests | 0);
    const total = Math.max(0, ctx.budget | 0);
    const perGuest = total / guests;
    const tier = budgetTier(perGuest);

    const w = Object.assign({}, spec.base);
    if (guests >= 300) { w.venue += 0.03; w.catering += 0.02; w.decor -= 0.02; w.attire -= 0.02; w.invites -= 0.01; }
    if (guests <= 60) { w.decor += 0.02; w.photo += 0.01; w.venue -= 0.02; w.misc -= 0.01; }
    if (tier.id === 'smart') { w.catering += 0.05; w.venue += 0.02; w.decor -= 0.03; w.attire -= 0.02; w.music -= 0.01; w.photo -= 0.01; }
    if (tier.id === 'royal') { w.decor += 0.03; w.photo += 0.02; w.music += 0.01; w.misc -= 0.03; w.catering -= 0.03; }

    const sum = Object.values(w).reduce((a, b) => a + b, 0);
    const rows = Object.keys(spec.base).map((key) => {
      let amount = round100((total * w[key]) / sum);
      return { key, label: spec.categories[key], amount, share: 0 };
    });

    // Cap catering per guest; overflow goes to misc/buffer.
    const cat = rows.find((r) => r.key === 'catering');
    const capTotal = tier.cateringCap * guests;
    if (cat.amount > capTotal) {
      const over = cat.amount - capTotal;
      cat.amount = round100(capTotal);
      rows.find((r) => r.key === 'misc').amount += over;
    }
    // Reconcile rounding so rows sum to the (rounded) total.
    const drift = round100(total) - rows.reduce((a, r) => a + r.amount, 0);
    rows.find((r) => r.key === 'misc').amount = Math.max(0, rows.find((r) => r.key === 'misc').amount + drift);
    const finalTotal = rows.reduce((a, r) => a + r.amount, 0);
    rows.forEach((r) => { r.share = finalTotal ? r.amount / finalTotal : 0; });

    return { rows, total: finalTotal, perGuest: finalTotal / guests, tier };
  }

  /* ---------------- 2. Timeline generator ----------------
   * Milestones are anchored to days-before-event and filtered/scaled to
   * the real runway: a plan made 20 days out compresses early milestones
   * into "this week" instead of pretending there are 6 months left. */
  const MILESTONES = {
    wedding: [
      [180, 'Fix the date, guest list draft and total budget'],
      [150, 'Book the venue — good dates go first'],
      [120, 'Book caterer and photographer/videographer'],
      [90, 'Order attire; book décor and makeup/styling'],
      [60, 'Send invitations; book music/DJ and transport'],
      [30, 'Menu tasting; finalise ceremony flow with the officiant'],
      [14, 'Final guest count to caterer; seating plan draft'],
      [7, 'Confirm every vendor in writing; pack an emergency kit'],
      [1, 'Rehearsal walk-through; hand the run sheet to a day coordinator'],
      [0, 'The big day — delegate everything, be present'],
    ],
    birthday: [
      [45, 'Fix the date, theme and guest list'],
      [30, 'Book the venue or reserve the space'],
      [21, 'Order the cake; book entertainment/games'],
      [14, 'Send invitations; plan the menu'],
      [7, 'Order décor and return gifts; confirm photographer'],
      [3, 'Confirm orders and headcount; prep a playlist'],
      [1, 'Pick up the cake and perishables; charge cameras'],
      [0, 'Party day — set up 2 hours early'],
    ],
    community: [
      [90, 'Form the organising team; fix date, venue and budget'],
      [75, 'Apply for permits and venue permissions'],
      [60, 'Book stage, sound and seating vendors'],
      [45, 'Open registrations; start publicity'],
      [30, 'Confirm sponsors, catering and volunteers roster'],
      [14, 'Print signage and badges; safety and first-aid plan'],
      [7, 'Full vendor confirmation; rain/heat backup plan'],
      [1, 'Venue setup and sound check'],
      [0, 'Event day — help desk staffed from gates-open'],
    ],
  };
  const RUNSHEET = {
    wedding: [['08:00', 'Venue opens; décor and setup check'], ['10:00', 'Styling and getting-ready photos'], ['12:30', 'Guest welcome desk opens'], ['13:00', 'Ceremony begins'], ['15:00', 'Couple photos + guest refreshments'], ['17:00', 'Reception, performances and dinner'], ['20:30', 'Cake, toasts and send-off']],
    birthday: [['T-2h', 'Décor setup and music check'], ['T-30m', 'Welcome desk and photo corner ready'], ['Start', 'Guests arrive; games and music'], ['+1h', 'Cake cutting and group photos'], ['+1.5h', 'Food service'], ['+2.5h', 'Return gifts and wind-down']],
    community: [['T-3h', 'Setup, signage and sound check'], ['T-1h', 'Volunteer briefing; help desk opens'], ['Start', 'Gates open; registrations'], ['+1h', 'Main programme / stage events'], ['+3h', 'Food and networking break'], ['Close', 'Vote of thanks; teardown crew in']],
  };

  function daysUntil(dateStr, todayStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const t = new Date((todayStr || new Date().toISOString().slice(0, 10)) + 'T00:00:00');
    return Math.round((d - t) / 86400000);
  }

  function buildTimeline(ctx, todayStr) {
    const days = Math.max(0, daysUntil(ctx.date, todayStr));
    const all = (MILESTONES[ctx.eventType] || MILESTONES.wedding);
    const items = all.map(([lead, task]) => {
      let when, urgent = false;
      if (lead === 0) when = 'Event day';
      else if (lead >= days) { when = 'This week'; urgent = true; }
      else if (lead >= 30) when = 'T-' + Math.round(lead / 30) + (lead >= 60 ? ' months' : ' month');
      else when = 'T-' + lead + (lead === 1 ? ' day' : ' days');
      return { leadDays: lead, task, when, urgent };
    });
    return { daysLeft: days, items, runsheet: RUNSHEET[ctx.eventType] || RUNSHEET.wedding };
  }

  /* ---------------- 3. Vendor checklist ---------------- */
  const VENDORS = {
    wedding: [
      ['Venue manager', 150, 'critical'], ['Caterer', 120, 'critical'], ['Photographer & videographer', 120, 'critical'],
      ['Décor & florist', 90, 'high'], ['Makeup & styling', 90, 'high'], ['DJ / live musicians', 60, 'high'],
      ['Cake studio', 45, 'medium'], ['Invitation printer / e-invite designer', 60, 'medium'], ['Transport for guests', 30, 'medium'],
      ['Mehendi / ceremony artists', 45, 'low'], ['Day-of coordinator', 30, 'high'],
    ],
    birthday: [
      ['Venue / party hall', 30, 'critical'], ['Cake studio', 21, 'critical'], ['Caterer / food counter', 21, 'high'],
      ['Decorator (theme)', 21, 'high'], ['Entertainer / game host', 21, 'high'], ['Photographer', 14, 'medium'],
      ['DJ / music setup', 14, 'medium'], ['Return-gift supplier', 10, 'low'],
    ],
    community: [
      ['Venue authority & permits', 75, 'critical'], ['Stage & sound vendor', 60, 'critical'], ['Seating & shamiana vendor', 45, 'high'],
      ['Caterer / food stalls', 30, 'high'], ['Printing (signage, badges)', 21, 'medium'], ['Photo/video coverage', 21, 'medium'],
      ['First-aid & safety provider', 14, 'high'], ['Volunteer coordinator', 30, 'high'], ['Waste & cleanup crew', 7, 'low'],
    ],
  };

  function buildChecklist(ctx) {
    const list = (VENDORS[ctx.eventType] || VENDORS.wedding).map(([name, lead, priority]) => ({
      id: 'v-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name, leadDays: lead, priority,
      tip: 'Book ~' + lead + ' days before',
    }));
    const order = { critical: 0, high: 1, medium: 2, low: 3 };
    return list.sort((a, b) => order[a.priority] - order[b.priority] || b.leadDays - a.leadDays);
  }

  /* ---------------- 4. Idea generator ----------------
   * Ideas are composed from theme × event-type fragments, filtered by
   * tier (royal ideas never appear in a smart-saver plan), then seeded-
   * shuffled so the same context reproduces the same set. */
  const IDEA_BANK = {
    wedding: {
      traditional: ['A banana-leaf or brass-urli welcome installation with marigold strings', 'Live instrumental trio (veena/flute) for the ceremony hour', 'A family-recipe counter serving one dish from each side of the family'],
      modern: ['A neon monogram sign that doubles as the photo-backdrop', 'QR-code table cards linking to a live photo wall guests upload to', 'A signature mocktail named after the couple, served at a self-serve bar'],
      eco: ['Seed-paper invitations guests can plant after the wedding', 'Potted-plant centrepieces that go home as favours', 'A no-plastic pledge: steel, banana fibre and glass only'],
      royal: ['A vintage-car entry for the couple', 'Chandelier-lit mandap with cascading orchids', 'A curated perfume bar where guests blend a take-home scent'],
      minimal: ['One-flower décor: a single variety used everywhere, beautifully', 'A monochrome palette with candlelight doing the heavy lifting', 'Digital invites and a single-page programme card'],
    },
    birthday: {
      traditional: ['A retro photo booth with props from the birthday star\u2019s childhood era', 'A "through the years" photo timeline wall', 'Homestyle regional thali counter alongside the cake'],
      modern: ['A themed escape-room style treasure hunt across the venue', 'Live caricature artist for guests', 'A DIY dessert bar with labelled toppings'],
      eco: ['Plantable seed-bomb return gifts', 'A bring-your-own-cup drinks station with a fun prize draw', 'Décor made from upcycled bottles and paper, crafted with the kids'],
      royal: ['A red-carpet entry with a "paparazzi" photo wall', 'A multi-tier designer cake as the centrepiece', 'Personalised monogrammed return-gift boxes'],
      minimal: ['Golden-hour picnic setup with floor cushions and fairy lights', 'One hero cake, one playlist, one great photo corner', 'A potluck board where each guest brings one favourite dish'],
    },
    community: {
      traditional: ['A local folk-performance opening act', 'A community kitchen / langar-style shared meal', 'An elders\u2019 honouring ceremony on stage'],
      modern: ['A live social-media wall with the event hashtag', 'QR-based feedback and lucky-draw at the exit', 'Silent-disco corner with shared headphones for the youth zone'],
      eco: ['A tree-planting drive tied to attendance count', 'Segregated waste stations with a green-volunteer team', 'A repair-and-reuse mela corner alongside the main event'],
      royal: ['A grand stage backdrop with LED name reveal', 'Valet and concierge desk for guests', 'A curated souvenir hamper for chief guests and sponsors'],
      minimal: ['A single-stage, single-sound setup — less gear, more programme', 'BYO-bottle water refill stations instead of packaged water', 'Digital-only publicity: posters become shareable cards'],
    },
  };
  const IDEA_BUDGET_NOTES = {
    smart: 'All picks stay friendly to a tight budget — DIY-able or rentable locally.',
    balanced: 'A mix of vendor-booked and DIY picks that fit a mid-range budget.',
    grand: 'Includes a couple of splurge-worthy touches your budget can absorb.',
    royal: 'Premium picks included — your budget tier supports statement pieces.',
  };

  function generateIdeas(ctx, rng) {
    const bank = IDEA_BANK[ctx.eventType] || IDEA_BANK.wedding;
    const themed = bank[ctx.theme] || bank.modern;
    const others = Object.keys(bank).filter((t) => t !== ctx.theme)
      .flatMap((t) => bank[t]);
    const picks = shuffle(rng, themed).slice(0, 3).concat(shuffle(rng, others).slice(0, 2));
    return { ideas: picks, note: IDEA_BUDGET_NOTES[ctx.tierId] || IDEA_BUDGET_NOTES.balanced };
  }

  /* ---------------- 5. Narrative generator ----------------
   * The generative layer: sentence templates with context slots and
   * synonym banks, sampled with the seeded RNG. Same context + same
   * "shuffle" count = same text; "Regenerate" advances the seed. */
  const OPENERS = [
    (c) => `Here is your ${c.theme} ${c.eventLabel.toLowerCase()} in ${c.city}, planned for ${c.guests} guests on a total budget of ${inr(c.budget)}.`,
    (c) => `Your ${c.eventLabel.toLowerCase()} in ${c.city} brings together ${c.guests} guests, a ${c.theme} mood, and ${inr(c.budget)} to spend wisely.`,
    (c) => `${inr(c.budget)}, ${c.guests} guests, one ${c.theme} ${c.eventLabel.toLowerCase()} in ${c.city} — here is how it comes together.`,
  ];
  const BUDGET_LINES = [
    (c) => `The biggest shares go to ${c.top1} (${inr(c.top1Amt)}) and ${c.top2} (${inr(c.top2Amt)}), which works out to about ${inr(c.perGuest)} per guest at the ${c.tierLabel.toLowerCase()} tier.`,
    (c) => `Money follows the experience: ${c.top1} leads at ${inr(c.top1Amt)}, then ${c.top2} at ${inr(c.top2Amt)} — roughly ${inr(c.perGuest)} per guest overall.`,
  ];
  const TIME_LINES = [
    (c) => c.daysLeft > 0
      ? `With ${c.daysLeft} days to go, the plan front-loads the critical bookings — ${c.firstCritical.toLowerCase()} first — and keeps the final week for confirmations, not decisions.`
      : `The date is here: the run sheet takes over, vendors are confirmed, and your only job is to show up.`,
    (c) => c.daysLeft > 30
      ? `You have a comfortable ${c.daysLeft}-day runway, so milestones are spread out — venue and catering early, details later, nothing rushed.`
      : `The runway is short at ${c.daysLeft} days, so the timeline compresses: critical vendors (${c.firstCritical.toLowerCase()} first) are marked "this week" and décor decisions move fast.`,
  ];
  const MUST_LINES = [
    (c) => `Your must-haves — ${c.mustHaves} — are treated as fixed points: the checklist and budget protect them before anything optional.`,
  ];
  const CLOSERS = [
    () => `Check off vendors as you book them and the plan stays honest — a celebration that fits the budget you actually have.`,
    () => `Revisit the budget split after each booking; the buffer line is there to absorb surprises without stress.`,
  ];

  function generateNarrative(ctx, rng) {
    const lines = [pick(rng, OPENERS)(ctx), pick(rng, BUDGET_LINES)(ctx), pick(rng, TIME_LINES)(ctx)];
    if (ctx.mustHaves && ctx.mustHaves.trim()) lines.push(pick(rng, MUST_LINES)(ctx));
    lines.push(pick(rng, CLOSERS)(ctx));
    return lines.join(' ');
  }

  /* ---------------- full plan assembly ---------------- */
  function buildPlan(input, opts) {
    const options = opts || {};
    const ctx = {
      eventType: EVENT_TYPES[input.eventType] ? input.eventType : 'wedding',
      date: input.date,
      guests: clamp(parseInt(input.guests, 10) || 100, 1, 100000),
      budget: clamp(parseInt(input.budget, 10) || 500000, 0, 100000000),
      city: (input.city || 'your city').toString().trim() || 'your city',
      theme: ['traditional', 'modern', 'eco', 'royal', 'minimal'].includes(input.theme) ? input.theme : 'modern',
      mustHaves: (input.mustHaves || '').toString(),
    };
    const budget = allocateBudget(ctx);
    ctx.tierId = budget.tier.id;
    const timeline = buildTimeline(ctx, options.today);
    const checklist = buildChecklist(ctx);
    const seedBase = [ctx.eventType, ctx.date, ctx.guests, ctx.budget, ctx.city, ctx.theme, ctx.mustHaves, options.variant || 0].join('|');
    const rng = mulberry32(hashSeed(seedBase));
    const ideas = generateIdeas(ctx, rng);
    const sorted = budget.rows.slice().sort((a, b) => b.amount - a.amount);
    const narrative = generateNarrative({
      theme: ctx.theme, eventLabel: EVENT_TYPES[ctx.eventType].label, city: ctx.city,
      guests: ctx.guests, budget: budget.total, perGuest: budget.perGuest,
      top1: sorted[0].label, top1Amt: sorted[0].amount, top2: sorted[1].label, top2Amt: sorted[1].amount,
      tierLabel: budget.tier.label, daysLeft: timeline.daysLeft,
      firstCritical: (checklist.find((v) => v.priority === 'critical') || checklist[0]).name,
      mustHaves: ctx.mustHaves,
    }, rng);
    return { ctx, budget, timeline, checklist, ideas, narrative };
  }

  return { allocateBudget, buildTimeline, buildChecklist, generateIdeas, generateNarrative, buildPlan, budgetTier, daysUntil, inr, hashSeed, mulberry32, EVENT_TYPES };
});
