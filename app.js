/* CelebrAIte UI wiring — all logic lives in src/logic.js (window.CelebrAIte). */
(function () {
  'use strict';
  const L = window.CelebrAIte;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  let plan = null;
  let variant = 0;
  let checked = new Set(JSON.parse(localStorage.getItem('celebraite-checked') || '[]'));

  function readForm() {
    return {
      eventType: $('f-type').value,
      date: $('f-date').value,
      guests: $('f-guests').value,
      budget: $('f-budget').value,
      city: $('f-city').value,
      theme: $('f-theme').value,
      mustHaves: $('f-must').value,
    };
  }

  function render() {
    if (!plan) return;
    const { budget, timeline, checklist, ideas, ctx } = plan;
    $('results').hidden = false;
    $('narrative').textContent = plan.narrative;

    $('budget-meta').textContent =
      `${L.EVENT_TYPES[ctx.eventType].label} · ${ctx.guests} guests · ${budget.tier.label} tier · about ${L.inr(budget.perGuest)} per guest`;
    $('budget-rows').innerHTML = budget.rows.map((r) => `
      <div class="brow">
        <span>${esc(r.label)} <span class="per">(${(r.share * 100).toFixed(1)}% · ${L.inr(r.amount / Math.max(1, ctx.guests))}/guest)</span></span>
        <span class="amt">${L.inr(r.amount)}</span>
        <span class="bar" aria-hidden="true"><span class="fill" style="width:${(r.share * 100).toFixed(1)}%"></span></span>
      </div>`).join('');

    $('tl-meta').textContent = timeline.daysLeft > 0
      ? `${timeline.daysLeft} days to go — milestones are scaled to your real runway.`
      : 'Your event date has arrived or passed — the run sheet is your plan now.';
    $('timeline').innerHTML = timeline.items.map((i) => `
      <li class="${i.urgent ? 'urgent' : ''}"><span class="when">${esc(i.when)}</span> — ${esc(i.task)}${i.urgent ? '<span class="badge">book now</span>' : ''}</li>`).join('');
    $('runsheet').innerHTML = timeline.runsheet.map(([t, task]) => `
      <li><span class="rt">${esc(t)}</span> — ${esc(task)}</li>`).join('');

    $('checklist').innerHTML = checklist.map((v) => `
      <li class="${checked.has(v.id) ? 'done' : ''}">
        <label>
          <input type="checkbox" data-vid="${esc(v.id)}" ${checked.has(v.id) ? 'checked' : ''}>
          <span><span class="vname">${esc(v.name)}</span><span class="prio prio-${esc(v.priority)}">${esc(v.priority)}</span><br>
          <span class="tip">${esc(v.tip)} · priority: ${esc(v.priority)}</span></span>
        </label>
      </li>`).join('');
    updateProgress();

    $('ideas-note').textContent = ideas.note;
    $('ideas').innerHTML = ideas.ideas.map((i) => `<li>${esc(i)}</li>`).join('');
    $('status').textContent = `Plan generated: ${L.EVENT_TYPES[ctx.eventType].label} in ${ctx.city}, ${ctx.guests} guests, budget ${L.inr(budget.total)}.`;
  }

  function updateProgress() {
    if (!plan) return;
    const total = plan.checklist.length;
    const done = plan.checklist.filter((v) => checked.has(v.id)).length;
    $('vc-progress').max = 100;
    $('vc-progress').value = total ? Math.round((done / total) * 100) : 0;
    $('vc-progress-text').textContent = `${done} of ${total} booked`;
  }

  function generate() {
    const input = readForm();
    if (!input.date) { $('f-date').focus(); $('status').textContent = 'Please pick an event date first.'; return; }
    plan = L.buildPlan(input, { variant });
    render();
    $('results-h').setAttribute('tabindex', '-1');
    $('results-h').focus({ preventScroll: false });
  }

  function planAsText() {
    if (!plan) return '';
    const { budget, timeline, checklist, ideas, ctx } = plan;
    const lines = [
      `CelebrAIte plan — ${L.EVENT_TYPES[ctx.eventType].label} in ${ctx.city} (${ctx.date})`,
      `${ctx.guests} guests · theme: ${ctx.theme} · budget ${L.inr(budget.total)} (${budget.tier.label} tier, ${L.inr(budget.perGuest)}/guest)`,
      '', 'YOUR PLAN IN WORDS', plan.narrative,
      '', 'BUDGET',
      ...budget.rows.map((r) => `- ${r.label}: ${L.inr(r.amount)} (${(r.share * 100).toFixed(1)}%)`),
      '', `TIMELINE (${timeline.daysLeft} days to go)`,
      ...timeline.items.map((i) => `- [${i.when}] ${i.task}`),
      '', 'DAY-OF RUN SHEET',
      ...timeline.runsheet.map(([t, task]) => `- ${t}: ${task}`),
      '', 'VENDOR CHECKLIST',
      ...checklist.map((v) => `- [${checked.has(v.id) ? 'x' : ' '}] ${v.name} (${v.tip}, ${v.priority})`),
      '', 'IDEAS',
      ...ideas.ideas.map((i) => `- ${i}`),
    ];
    return lines.join('\n');
  }

  document.addEventListener('DOMContentLoaded', () => {
    const d = new Date(); d.setDate(d.getDate() + 90);
    $('f-date').value = d.toISOString().slice(0, 10);
    $('plan-form').addEventListener('submit', (e) => { e.preventDefault(); variant = 0; generate(); });
    $('btn-regen').addEventListener('click', () => { variant += 1; generate(); });
    $('btn-print').addEventListener('click', () => window.print());
    $('btn-copy').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(planAsText()); $('status').textContent = 'Plan copied to clipboard.'; }
      catch (err) { $('status').textContent = 'Copy failed — use Print / save PDF instead.'; }
    });
    $('checklist').addEventListener('change', (e) => {
      const box = e.target.closest('input[type="checkbox"][data-vid]');
      if (!box) return;
      if (box.checked) checked.add(box.dataset.vid); else checked.delete(box.dataset.vid);
      localStorage.setItem('celebraite-checked', JSON.stringify([...checked]));
      box.closest('li').classList.toggle('done', box.checked);
      updateProgress();
    });
    generate();
  });
})();
