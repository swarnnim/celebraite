# CelebrAIte — GenAI Celebration & Event Planner

A GenAI-powered planning assistant for **weddings, birthdays and community events**. Give it an
occasion, a date, a guest count and a budget — it generates a budget breakdown, a planning
timeline scaled to your real runway, a prioritised vendor checklist, personalised ideas and a
written plan summary. Everything is computed from *your* context, in your browser, with **no
server, no API key and no sign-up** — it works fully offline.

🔗 **Live demo:** _[GitHub Pages link — added on publish]_
📦 **Repo size:** well under 10 MB · single branch (`main`) · zero build step (plain HTML/CSS/JS)

## Chosen vertical

**Celebration & event planning** (PromptWars Virtual — Challenge 5). Event planning is a
decision-heavy, budget-constrained problem that most people solve with scattered spreadsheets
and guesswork. CelebrAIte turns five inputs into a coherent, internally-consistent plan in one
click — the budget, timeline, vendors and ideas all agree with each other because they are all
derived from the same context object.

## Approach and logic

The core idea: **the AI words things; the code counts things.** All logic lives in one pure,
DOM-free module (`src/logic.js`, also unit-tested in Node):

1. **Budget allocator** — Each event type starts from base category weights (a wedding weights
   venue + catering; a community event weights permits/safety buffer). Weights then *shift* by
   context: large guest counts push share toward venue and catering (scale economies), small
   events toward décor and photography; the per-guest spend classifies the plan into a tier
   (Smart saver / Balanced / Grand / Royal) and tight tiers deliberately re-weight toward food
   and venue while trimming décor and attire. Catering is sanity-capped per guest by tier, with
   overflow flowing to the buffer line. Rows always reconcile exactly to the total.
2. **Timeline generator** — Milestones are anchored to days-before-event and **scaled to the
   real runway**: plan 15 days out and the 6-month milestones compress into "This week — book
   now" instead of pretending you have half a year. A day-of run sheet ships with every plan.
3. **Vendor checklist** — Vendors per event type with realistic lead times, sorted
   critical-first. Checking vendors off updates a live progress bar (persisted in localStorage).
4. **Idea generator** — Ideas are composed from theme × event-type fragments, shuffled with a
   seeded RNG so the same context reproduces the same set; the framing note adapts to the
   budget tier (a Smart-saver plan never gets "premium statement piece" advice).
5. **Narrative generator (the generative layer)** — "Your plan in words" is generated text,
   not a canned paragraph: sentence templates with context slots (city, guests, top categories,
   tier, days left, must-haves, first critical vendor) and synonym banks, sampled by the seeded
   RNG. *Regenerate wording* advances the seed for a fresh phrasing of the same plan.

## How the solution works

- Open `index.html` (or the GitHub Pages link) — no build, no install.
- Fill the form → **Generate my plan** → budget, timeline, checklist, ideas and narrative render
  from the single `buildPlan()` pipeline in `src/logic.js`.
- Tick off vendors as you book them; use **Copy as text** or **Print / save PDF** to share the plan.
- The whole core is deterministic given the same inputs + wording variant, which is what makes
  it unit-testable end to end.

## Assumptions made

- Budgets are in **INR** and category weights reflect typical Indian market splits; per-guest
  catering caps are heuristic tiers, not quotes — real vendor prices vary by city and season.
- Lead times are planning heuristics (e.g. wedding venues ~150 days) for a typical metro market.
- Dates use the visitor's local "today"; a past date yields a run-sheet-focused plan.
- The generative layer is a local combinatorial text engine (templates + context rules + seeded
  variation) rather than a cloud LLM — a deliberate choice so the app never hangs, never needs a
  key, and works 100% offline. This is declared honestly in `BUILD_NOTES.md`.

## Accessibility

Semantic landmarks, labelled inputs, visible focus rings, keyboard-operable throughout,
sufficient colour contrast, `aria-live` announcements for generated plans and copy feedback,
and `prefers-reduced-motion` support. Print stylesheet included.

## Tests

Pure-logic unit tests (Node, no dependencies) cover the budget allocator, timeline generator,
checklist builder, idea generator, narrative generator and full-plan assembly — **22 tests**:

```bash
node tests/run.js   # 22 passed, 0 failed
```

## Project structure

```
index.html        the single-page app
styles.css        styling, print stylesheet, reduced-motion support
app.js            DOM wiring only (rendering, progress, copy/print)
src/logic.js      all planning + generative logic (browser + Node)
tests/run.js      Node unit tests for the pure logic
assets/           screenshots
BUILD_NOTES.md    honest record of the AI tools used to build this, and what the in-app AI does
LICENSE           MIT
```

## License

MIT — see [LICENSE](LICENSE).
