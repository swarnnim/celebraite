/* CelebrAIte logic tests — no framework, run: node tests/run.js */
'use strict';
const assert = require('assert');
const L = require('../src/logic.js');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('FAIL  ' + name + ' — ' + e.message); }
}
const sum = (rows) => rows.reduce((a, r) => a + r.amount, 0);

/* ---- budget allocator ---- */
t('budget: rows sum to the total (wedding)', () => {
  const b = L.allocateBudget({ eventType: 'wedding', guests: 200, budget: 500000 });
  assert.strictEqual(b.total, 500000); assert.strictEqual(sum(b.rows), 500000);
});
t('budget: rows sum to the total (birthday, odd amount)', () => {
  const b = L.allocateBudget({ eventType: 'birthday', guests: 40, budget: 75750 });
  assert.strictEqual(sum(b.rows), b.total); assert.ok(Math.abs(b.total - 75800) <= 100);
});
t('budget: catering respects the per-guest tier cap', () => {
  const b = L.allocateBudget({ eventType: 'wedding', guests: 100, budget: 300000 });
  const cat = b.rows.find((r) => r.key === 'catering');
  assert.ok(cat.amount / 100 <= b.tier.cateringCap, 'catering per guest over cap');
});
t('budget: tight budget raises catering share vs lavish (decision logic)', () => {
  const tight = L.allocateBudget({ eventType: 'wedding', guests: 100, budget: 60000 });
  const lavish = L.allocateBudget({ eventType: 'wedding', guests: 100, budget: 900000 });
  const share = (b) => b.rows.find((r) => r.key === 'catering').share;
  assert.ok(share(tight) > share(lavish), 'smart tier should weight food higher');
});
t('budget: huge guest count shifts weight to venue+catering', () => {
  const small = L.allocateBudget({ eventType: 'community', guests: 40, budget: 200000 });
  const big = L.allocateBudget({ eventType: 'community', guests: 500, budget: 2000000 });
  const vc = (b) => b.rows.find((r) => r.key === 'venue').share + b.rows.find((r) => r.key === 'catering').share;
  assert.ok(vc(big) > vc(small));
});
t('budget: tiers classify by per-guest spend', () => {
  assert.strictEqual(L.budgetTier(500).id, 'smart');
  assert.strictEqual(L.budgetTier(1500).id, 'balanced');
  assert.strictEqual(L.budgetTier(3000).id, 'grand');
  assert.strictEqual(L.budgetTier(9000).id, 'royal');
});
t('budget: zero budget is safe', () => {
  const b = L.allocateBudget({ eventType: 'wedding', guests: 10, budget: 0 });
  assert.strictEqual(b.total, 0); assert.ok(b.rows.every((r) => r.amount >= 0));
});

/* ---- timeline generator ---- */
t('timeline: long runway keeps T-6 months milestone uncompressed', () => {
  const tl = L.buildTimeline({ eventType: 'wedding', date: '2027-06-01' }, '2026-10-26');
  assert.ok(tl.daysLeft > 180); assert.strictEqual(tl.items[0].urgent, false);
  assert.ok(/months/.test(tl.items[0].when));
});
t('timeline: short runway compresses early milestones to "This week"', () => {
  const tl = L.buildTimeline({ eventType: 'wedding', date: '2026-11-10' }, '2026-10-26');
  assert.strictEqual(tl.daysLeft, 15);
  assert.ok(tl.items.filter((i) => i.urgent).length >= 3);
});
t('timeline: every event type ships a non-empty run sheet', () => {
  for (const et of ['wedding', 'birthday', 'community']) {
    const tl = L.buildTimeline({ eventType: et, date: '2027-01-01' }, '2026-10-26');
    assert.ok(tl.runsheet.length >= 5, et);
    assert.strictEqual(tl.items[tl.items.length - 1].leadDays, 0);
  }
});
t('timeline: daysUntil is exact across a month boundary', () => {
  assert.strictEqual(L.daysUntil('2026-11-01', '2026-10-26'), 6);
});

/* ---- checklist builder ---- */
t('checklist: sorted critical-first with lead times attached', () => {
  const c = L.buildChecklist({ eventType: 'wedding' });
  assert.strictEqual(c[0].priority, 'critical');
  assert.ok(c.every((v) => v.leadDays > 0 && v.id && v.name));
});
t('checklist: community plan leads with permits', () => {
  const c = L.buildChecklist({ eventType: 'community' });
  assert.ok(/permit/i.test(c[0].name + c[1].name));
});
t('checklist: ids are unique', () => {
  const c = L.buildChecklist({ eventType: 'birthday' });
  assert.strictEqual(new Set(c.map((v) => v.id)).size, c.length);
});

/* ---- idea generator ---- */
t('ideas: five ideas, majority from the chosen theme bank', () => {
  const rng = L.mulberry32(L.hashSeed('test'));
  const { ideas } = L.generateIdeas({ eventType: 'wedding', theme: 'eco', tierId: 'smart' }, rng);
  assert.strictEqual(ideas.length, 5);
  const ecoBank = ['Seed-paper invitations guests can plant after the wedding', 'Potted-plant centrepieces that go home as favours', 'A no-plastic pledge: steel, banana fibre and glass only'];
  assert.ok(ideas.filter((i) => ecoBank.includes(i)).length >= 2);
});
t('ideas: tier note matches the budget tier', () => {
  const rng = L.mulberry32(42);
  const { note } = L.generateIdeas({ eventType: 'birthday', theme: 'modern', tierId: 'royal' }, rng);
  assert.ok(/Premium/.test(note));
});

/* ---- narrative generator ---- */
t('narrative: mentions city, guests and top categories from context', () => {
  const plan = L.buildPlan({ eventType: 'wedding', date: '2027-03-15', guests: 250, budget: 750000, city: 'Jaipur', theme: 'royal', mustHaves: 'live counters' }, { today: '2026-10-26' });
  assert.ok(plan.narrative.includes('Jaipur'));
  assert.ok(plan.narrative.includes('250 guests'));
  assert.ok(plan.narrative.includes('live counters'));
});
t('narrative: regenerate produces a different wording (variant seed)', () => {
  const input = { eventType: 'birthday', date: '2026-12-20', guests: 60, budget: 90000, city: 'Pune', theme: 'modern', mustHaves: '' };
  const a = L.buildPlan(input, { today: '2026-10-26', variant: 0 });
  const b = L.buildPlan(input, { today: '2026-10-26', variant: 3 });
  assert.notStrictEqual(a.narrative, b.narrative);
});
t('narrative: same context + same variant is reproducible', () => {
  const input = { eventType: 'community', date: '2027-01-26', guests: 300, budget: 200000, city: 'Indore', theme: 'eco', mustHaves: '' };
  const a = L.buildPlan(input, { today: '2026-10-26' });
  const b = L.buildPlan(input, { today: '2026-10-26' });
  assert.strictEqual(a.narrative, b.narrative);
  assert.deepStrictEqual(a.ideas.ideas, b.ideas.ideas);
});

/* ---- full assembly / robustness ---- */
t('buildPlan: complete shape for every event type', () => {
  for (const et of ['wedding', 'birthday', 'community']) {
    const p = L.buildPlan({ eventType: et, date: '2027-05-01', guests: 120, budget: 300000, city: 'Surat', theme: 'traditional', mustHaves: '' }, { today: '2026-10-26' });
    assert.ok(p.budget.rows.length === 8 && p.timeline.items.length >= 7 && p.checklist.length >= 8 && p.ideas.ideas.length === 5 && p.narrative.length > 150, et);
  }
});
t('buildPlan: invalid inputs fall back safely', () => {
  const p = L.buildPlan({ eventType: 'nope', date: '2027-05-01', guests: 'abc', budget: -5, city: '', theme: 'wild' }, { today: '2026-10-26' });
  assert.strictEqual(p.ctx.eventType, 'wedding'); assert.strictEqual(p.ctx.theme, 'modern');
  assert.ok(p.ctx.guests >= 1 && p.ctx.budget >= 0);
});
t('purity: allocateBudget does not mutate its input', () => {
  const ctx = { eventType: 'wedding', guests: 100, budget: 400000 };
  const before = JSON.stringify(ctx);
  L.allocateBudget(ctx);
  assert.strictEqual(JSON.stringify(ctx), before);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed, ' + (pass + fail) + ' total');
process.exit(fail ? 1 : 0);
