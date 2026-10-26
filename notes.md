# Publishing notes — PromptWars Virtual Challenge 5 (CelebrAIte)

**Status: built and verified locally. Nothing published or submitted yet.**

## Repo
- Suggested name: **celebraite** → `github.com/swarnnim/celebraite`
- Contents: everything in this folder (single branch `main`, already committed locally, clean tree).
- Size: ~1.2 MB total (well under the 10 MB limit) — screenshots included.
- After pushing: **Settings → Pages → Deploy from branch → `main` / root** → live URL will be
  `https://swarnnim.github.io/celebraite/`. Wait for the Pages build to go green, open the URL,
  generate one plan to confirm, then fill the two `[…ADD ON PUBLISH]` placeholders in
  README.md and linkedin-post.md.

## Remaining publish steps (in order)
1. Create the public repo, push `main`.
2. Enable GitHub Pages (above), verify the live link.
3. Add live + repo links to README.md and linkedin-post.md; commit.
4. Record the demo video from `video-script.md` (60–90 s, real interactions only).
5. Post the LinkedIn post (`linkedin-post.md`) with the 3 screenshots attached; keep the video
   link handy — the submission needs both.
6. Submit on Hack2skill (Challenge 5, event pwvirtual1) with: repo URL, deployed URL, video,
   LinkedIn post URL, and the two form texts below. Deadline: **Sun Nov 1, 2026, 11:59 PM IST**.

## Submission form texts (drafted from the actual build; each ≤1024 chars — verified)

**"Describe the changes/updates made in the deployed version":**
> CelebrAIte is a GenAI-powered celebration & event planner (weddings, birthdays, community events) deployed as a zero-build static site. From five inputs — event type, date, guests, budget (INR), city/theme — it generates: (1) a budget breakdown whose category weights shift by event type, guest scale and per-guest budget tier, with catering capped per guest and rows reconciling exactly to the total; (2) a planning timeline scaled to the real runway (distant milestones compress to "book this week" for near dates) plus a day-of run sheet; (3) a prioritised vendor checklist with lead times and live booking progress; (4) personalised ideas composed from theme × event-type fragments with tier-aware framing; (5) a generated written plan summary. Interactive checklist, copy-as-text and print/PDF export included; accessibility-first (labels, focus, contrast, reduced motion).

**"Mention the Gen AI services utilized…" (declare Gen AI use = YES):**
> Two layers, honestly declared in BUILD_NOTES.md: (1) In-app Gen AI — a local, combinatorial generative engine in src/logic.js (sentence templates with context slots, synonym banks, rule-based idea composition, seeded RNG sampling) that generates the plan narrative and idea set per user context; it runs 100% offline with no external API or key, by design, so the static app never hangs or leaks data. (2) Build-time Gen AI — the app was built with AI assistance from Muse Spark (by Meta) as a pair-programmer for architecture, code and docs, directed and reviewed by the participant; correctness is verified by 22 Node unit tests and headless-browser screenshots, not by the AI's say-so.

## Verified facts (safe to state anywhere)
- 22 Node unit tests, all passing (`node tests/run.js`).
- Screenshots in `assets/` are real captures of the running app (headless Firefox, demo
  scenario: royal Jaipur wedding, 250 guests, ₹7,50,000).
- No accounts, keys, paid services or external calls anywhere in the build.
