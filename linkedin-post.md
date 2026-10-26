# LinkedIn post — DRAFT (ready to post; fill the two links on publish)

Weddings run on spreadsheets, guesswork and panic. For PromptWars Virtual Challenge 5 — Celebration & Event Planner — I built **CelebrAIte**, a GenAI-powered planning assistant that turns five inputs (event type, date, guests, budget, theme) into a complete, internally-consistent plan. 🎉

The problem: every planning tool I tried gives static advice. A ₹60,000 birthday and a ₹9,00,000 wedding get the same checklist. Real planning is contextual — budgets, timelines and priorities must move together.

My prompt strategy while building it:
1. Constrain before generating — static site, zero build step, fully offline, under 10 MB. The AI wrote code inside those rails, not around them.
2. Logic before layout — I had the decision engine (budget allocator, timeline generator, vendor checklist) written and unit-tested before a single pixel of UI.
3. "Computed, not canned" — every output must be derived from the user's context. Tight budget? Catering share rises and décor trims. Event in 15 days? The 6-month milestones compress into "book this week" instead of pretending there's time.

What CelebrAIte does:
💰 Budget breakdown that shifts by event type, guest count and budget tier — with per-guest math shown
🗓️ A planning timeline scaled to your real runway + a day-of run sheet
✅ A prioritised vendor checklist with lead times and live progress
💡 Personalised ideas matched to your theme and budget tier
✍️ A generated written summary of your plan — composed fresh by a local generative text engine (no cloud API, no key, works 100% offline)

Built with AI assistance (declared honestly in the repo's BUILD_NOTES.md), verified with 22 unit tests, and designed accessibility-first: labelled inputs, keyboard support, visible focus, reduced-motion respect.

📸 [Attach: assets/shot-1-hero-form.png, assets/shot-2-plan-words.png, assets/shot-3-checklist.png — the planner, a generated plan, and the vendor checklist in action]

Try it live: [DEPLOYED LINK — ADD ON PUBLISH]
Code: [GITHUB REPO LINK — ADD ON PUBLISH]

@googlefordevelopers @hack2skill
#BuildwithAI #PromptWarsVirtual #Challenge5

---

*Posting notes (delete before posting): first person as Swarnnim; attach the 3 screenshots;
replace the two placeholders with the live GitHub Pages URL and the repo URL; tags are
@googlefordevelopers and @hack2skill as required by the challenge.*
