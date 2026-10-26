# Build Notes — honest AI declaration

PromptWars requires Gen AI use and asks participants to declare it. This file declares both
sides plainly: the AI used to **build** CelebrAIte, and the AI **inside** CelebrAIte.

## AI used to build this project

- **Muse (by Meta), accessed through the Muse assistant environment** — used as the primary
  AI pair-programmer: it drafted the architecture (pure-logic core separated from DOM wiring),
  wrote the first pass of `src/logic.js`, `index.html`, `styles.css`, `app.js` and the test
  suite, and drafted this documentation and the README.
- The participant (Swarnnim Agnihotri) directed the build: chose the vertical and feature set,
  set the constraints (static site, zero build, offline-capable, under 10 MB, accessibility
  judged), and reviewed outputs.
- **Verification was not delegated to the AI's say-so:** the logic is covered by 22 Node unit
  tests (`tests/run.js`, all passing), and the UI was exercised in a real headless browser
  (Playwright/Firefox) to capture the screenshots in `assets/` and confirm the plan generates
  end-to-end.

### Prompt strategy used while building

1. **Constrain before generating** — fixed the non-negotiables first (single static page, pure
   testable logic, no paid APIs) so generated code landed inside them.
2. **Logic before layout** — generated the decision engine (budget weights, tier rules, runway
   compression) and its tests *before* any UI, then required tests to pass before styling.
3. **"Computed, not canned" checks** — every generator was prompted to derive outputs from the
   context object; tests assert context actually changes outcomes (e.g. tight budgets shift
   catering share, short runways compress milestones).
4. **Iterate on failures, not vibes** — each fix round started from a failing test or a concrete
   behaviour, not a rewrite.

## The AI inside CelebrAIte

- **What it is:** a local, combinatorial generative engine in `src/logic.js` — sentence
  templates with context slots and synonym banks, plus rule-based idea composition from
  theme × event-type fragments, all sampled with a seeded RNG. It genuinely *generates*:
  the narrative and idea set are composed per-plan from the user's inputs and are never the
  same canned text twice (the "Regenerate wording" button advances the seed).
- **What it is not:** it is **not** a cloud LLM and calls no external AI API. That is a
  deliberate engineering choice for this challenge: the app must deploy as a static site, work
  100% offline, never hang on a network call, and need no API key — while the decision layer
  (budgets, timelines, checklists) stays deterministic and unit-testable.
- **Gen AI in the submission sense** applies twice, and both are declared: (1) the app itself
  contains a generative text/idea engine; (2) the app was built with a generative AI assistant,
  as documented above.
