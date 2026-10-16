// The page: draws the questions from checklist.js, keeps the answers, and
// redraws the scorecard from score.js after every change. All the judgment
// is in those two files; this one only displays it.
//
// Text from the checklist and from the person typing is always placed with
// textContent, never as HTML, so nothing typed can run as code.

(function () {
  'use strict';
  const { checklist, score } = window.ReadyToShip;
  const Q = checklist.questions;
  const PAGE_URL = 'https://dhuberportfolio.github.io/ready-to-ship/';
  const $ = (id) => document.getElementById(id);
  const { pct, fmtLimit } = score;
  // Question text, with {here} filled in for this page.
  const T = (text) => score.fill(text, 'page');

  let state = blank();
  function blank() { return { ticks: {}, no: {}, evidence: {} }; }

  // el('p', { class: 'x' }, 'text', otherNode)
  function el(tag, props, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid === null || kid === undefined || kid === false) continue;
      node.append(typeof kid === 'string' ? document.createTextNode(kid) : kid);
    }
    return node;
  }

  // Sets text only when it changes, so live regions don't re-announce.
  function setText(node, text) { if (node.textContent !== text) node.textContent = text; }

  const count = (x) => x.toLocaleString('en-US');
  const question = (n) => Q.find((q) => q.n === n);
  const modeInfo = (id) => checklist.modes.find((m) => m.id === id);

  function sourceLinks(q) {
    const parts = [];
    q.sources.forEach((s, i) => {
      const src = checklist.sources[s.id];
      if (!src) return;
      if (i) parts.push('; ');
      parts.push(el('a', { href: src.url, target: '_blank', rel: 'noopener', text: (src.label || src.short) + (s.where ? ', ' + s.where : '') }));
    });
    return parts;
  }

  // ---- drawing the page once ----

  const cards = {};

  function buildModes() {
    const box = $('modes');
    for (const m of checklist.modes) {
      const required = Q.filter((q) => score.applies(q, m.id) === 'required').length;
      const input = el('input', { type: 'radio', name: 'mode', value: m.id });
      input.addEventListener('change', () => { state.mode = m.id; update(); });
      box.append(el('label', { class: 'mode' },
        el('span', { class: 'mode-top' }, input, el('span', { class: 'mode-name', text: m.label })),
        el('span', { class: 'mode-detail', text: m.detail }),
        el('span', { class: 'mode-count', text: m.name + ' · ' + required + ' questions count' })));
    }
  }

  function numberField(id, label, key, opts) {
    const input = el('input', Object.assign({ id, type: 'number', inputmode: 'decimal', min: '0', step: 'any' }, opts || {}));
    input.addEventListener('input', () => {
      const v = input.value.trim();
      // A browser hands back "" for text it can't read as a number; say so
      // rather than treat it as blank.
      state[key] = input.validity && input.validity.badInput ? NaN : v === '' ? undefined : Number(v);
      update();
    });
    return { input, label: el('label', { for: id }, el('span', { text: label }), input) };
  }

  function buildQuestion(q) {
    const id = 'q-' + q.n;
    const boxes = q.ticks.map((text, i) => {
      const box = el('input', { type: 'checkbox', id: id + '-t' + i });
      box.addEventListener('change', () => {
        const mask = (state.ticks[q.n] | 0) ^ (1 << i);
        if (mask) state.ticks[q.n] = mask; else delete state.ticks[q.n];
        delete state.no[q.n];
        update();
      });
      return { box, label: el('label', { class: 'tick', for: id + '-t' + i }, box, el('span', { text: T(text) })) };
    });

    let numbers = null;
    const fields = {};
    if (q.input === 'limit') {
      const f = numberField(id + '-limit', 'Your limit, in %', 'limit', { max: '99.99', placeholder: '5' });
      fields.limit = f.input;
      numbers = el('div', { class: 'numbers' }, f.label,
        el('span', { class: 'joiner', text: 'of what goes out unchecked may be wrong' }));
    } else if (q.input === 'counts') {
      const w = numberField(id + '-wrong', 'Wrong', 'wrong', { step: '1', inputmode: 'numeric', placeholder: '3' });
      const u = numberField(id + '-unchecked', 'Went out unchecked', 'unchecked', { step: '1', min: '1', inputmode: 'numeric', placeholder: '50' });
      fields.wrong = w.input; fields.unchecked = u.input;
      numbers = el('div', { class: 'numbers' }, w.label, el('span', { class: 'joiner', text: 'of' }), u.label);
    }
    const problem = el('p', { class: 'problem', hidden: true });

    const noBtn = el('button', { type: 'button', class: 'no-btn', 'aria-pressed': 'false', text: 'Mark as no' });
    noBtn.addEventListener('click', () => {
      if (state.no[q.n]) delete state.no[q.n];
      else { state.no[q.n] = true; delete state.ticks[q.n]; }
      update();
    });
    const status = el('p', { class: 'q-status' });

    const bar = el('fieldset', { class: 'yes-bar' },
      el('legend', null, el('b', { text: 'It’s a yes when' }), el('span', { class: 'sr-only', text: ' for question ' + q.n + ': ' + q.ask })),
      el('p', { class: 'bar-hint', text: q.ticks.length > 1 ? 'Tick each one that’s true. All of them ticked is a yes.' : 'Tick it if it’s true.' }),
      boxes.map((b, i) => [b.label, i === 0 ? numbers : null, i === 0 ? problem : null]),
      q.computedBar ? el('p', { class: 'computed-bar', text: T(q.computedBar) }) : null);

    const tool = q.tool ? el('a', { class: 'tool-link', href: q.tool.url, target: '_blank', rel: 'noopener', text: q.tool.label + ' ↗' }) : null;
    const ifNo = el('div', { class: 'if-no', hidden: true }, el('b', { text: 'First step' }), el('span', { class: 'first-step', text: T(q.firstStep) }), tool ? el('br') : null, tool);
    const worked = el('div', { class: 'worked', hidden: true });
    const planBox = q.plan ? el('div', { class: 'worked plan', hidden: true }) : null;

    const textarea = el('textarea', { id: id + '-evidence', placeholder: 'Where is the proof? A link, a count, a name and a date.' });
    textarea.addEventListener('input', () => { state.evidence[q.n] = textarea.value; update(); });
    const evidence = el('details', { class: 'evidence' },
      el('summary', { text: 'Add evidence' }),
      el('label', { class: 'sr-only', for: id + '-evidence', text: 'Evidence for question ' + q.n }),
      textarea);

    const more = el('details', { class: 'more' },
      el('summary', { text: 'Why it matters' }),
      el('p', { text: T(q.why) }),
      el('p', null, el('strong', { text: 'Go further. ' }), T(q.further)),
      el('p', { class: 'sources' }, 'Sources: ', sourceLinks(q)));

    const root = el('article', { class: 'card q', id, 'aria-labelledby': id + '-ask' },
      el('div', { class: 'q-head' },
        el('span', { class: 'q-num', 'aria-hidden': 'true', text: String(q.n) }),
        el('div', null,
          el('h3', { class: 'q-title', text: q.title }),
          el('p', { class: 'ask', id: id + '-ask', text: q.ask }),
          el('p', { class: 'plain', text: T(q.plain) }))),
      el('div', { class: 'q-body' },
        bar,
        el('div', { class: 'q-answer' }, noBtn, status),
        worked, planBox, ifNo,
        el('div', { class: 'q-actions' }, more, evidence)));

    cards[q.n] = { root, boxes, numbers, fields, problem, noBtn, status, ifNo, worked, planBox, textarea };
    return root;
  }

  function buildStages() {
    const box = $('stages');
    checklist.stages.forEach((s, i) => {
      const qs = Q.filter((q) => q.stage === s.id);
      const first = qs[0].n, last = qs[qs.length - 1].n;
      box.append(el('section', { class: 'stage', 'aria-labelledby': 'h-' + s.id },
        el('p', { class: 'eyebrow', text: 'Stage ' + (i + 1) + ' of ' + checklist.stages.length + ' · questions ' + first + (last > first ? '–' + last : '') }),
        el('h2', { id: 'h-' + s.id, text: s.title }),
        el('p', { class: 'stage-blurb', text: s.blurb }),
        el('div', { class: 'stack' }, qs.map(buildQuestion))));
    });
  }

  function buildCells(box) {
    return Q.map((q) => {
      const a = el('a', { class: 'cell', href: '#q-' + q.n, text: String(q.n) });
      box.append(a);
      return a;
    });
  }

  // ---- redrawing after every change ----

  const STATUS_WORDS = { met: 'met', gap: 'to fix', unanswered: 'not answered', na: 'doesn’t apply' };
  let railCells, stripCells, lastResult;

  function update() {
    const result = score.evaluate(checklist, state);
    lastResult = result;
    const problems = score.numberProblems(state);
    for (const item of result.items) updateCard(item, result, problems);
    for (const m of document.querySelectorAll('input[name=mode]')) m.checked = m.value === state.mode;
    updateCells(railCells, result);
    updateCells(stripCells, result);
    updateRailSummary(result);
    updateScorecard(result);
    saveToLink();
  }

  function updateCells(cells, result) {
    result.items.forEach((item, i) => {
      const status = item.applicability === 'na' ? 'na' : item.status;
      const cls = 'cell ' + status + (item.applicability === 'optional' ? ' optional' : '');
      if (cells[i].className !== cls) cells[i].className = cls;
      cells[i].setAttribute('aria-label', 'Question ' + item.n + ': ' + STATUS_WORDS[status] +
        (item.applicability === 'optional' ? ', optional' : ''));
    });
  }

  function updateRailSummary(result) {
    const box = $('rail-sum');
    const c = result.counts;
    const key = result.mode ? [c.met, c.gaps, c.unanswered].join('/') : 'none';
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.replaceChildren();
    if (!result.mode) {
      box.append(el('span', { text: 'Start by picking a design.' }), el('a', { href: '#design', text: 'Design ↑' }));
      return;
    }
    box.append(
      el('span', null, el('strong', { text: String(c.met) }), ' met'),
      el('span', null, el('strong', { text: String(c.gaps) }), ' to fix'),
      el('span', null, el('strong', { text: String(c.unanswered) }), ' left'),
      el('a', { href: '#scorecard', text: 'Scorecard ↓' }));
  }

  function statusLine(item, q) {
    if (item.applicability === 'na') return checklist.notes.na;
    let text;
    if (item.unsupported) text = 'Every part is ticked, but this rests on question ' + item.blockedBy.join(' and ') + ', which is a gap. Until that’s fixed, this counts as a gap too.';
    else if (item.waiting === 'numbers') text = 'Ticked. Now enter your limit (question ' + q.computed.limitFrom + ') and your counts (question ' + q.computed.countsFrom + '): the arithmetic decides the rest.';
    else if (item.waiting === 'ticks') text = 'The numbers pass. Tick ' + (q.ticks.length > 1 ? 'every part' : 'it') + ' above to make it a yes.';
    else if (item.source === 'computed' && item.answer === 'no') text = 'No: worked out from your numbers, below.';
    else if (item.source === 'computed') text = 'Yes: every part ticked, and the numbers pass.';
    else if (item.markedNo) text = 'Marked no.';
    else if (item.partial) {
      const ticked = q.ticks.filter((t, i) => item.mask & (1 << i)).length;
      text = ticked + ' of ' + q.ticks.length + ' ticked: that’s a no until every part is.';
    } else if (item.answer === 'yes') text = 'Yes: every part ticked.';
    else if (item.blockedBy.length) text = 'Rests on question ' + item.blockedBy.join(' and ') + ', which is a gap.';
    else text = '';
    if (item.applicability === 'optional') text = checklist.notes.optional + (text ? ' ' + text : '');
    return text;
  }

  function updateCard(item, result, problems) {
    const q = question(item.n);
    const c = cards[item.n];
    c.root.dataset.status = item.status;
    c.root.dataset.applies = item.applicability;
    const na = item.applicability === 'na';
    c.boxes.forEach((b, i) => {
      b.box.checked = !na && !!(item.mask & (1 << i));
      b.box.disabled = na;
    });
    c.noBtn.disabled = na;
    c.noBtn.setAttribute('aria-pressed', !na && item.markedNo ? 'true' : 'false');
    setText(c.noBtn, !na && item.markedNo ? 'Marked as no' : 'Mark as no');

    // The number fields show once their first tick is ticked.
    if (c.numbers) {
      const show = !na && !!(item.mask & 1);
      c.numbers.hidden = !show;
      const keys = Object.keys(c.fields);
      const msgs = [];
      for (const k of keys) {
        const bad = Number.isNaN(state[k]) && state[k] !== undefined;
        const msg = bad ? 'That isn’t a number.' : problems[k];
        if (msg) msgs.push(msg);
        c.fields[k].setAttribute('aria-invalid', msg ? 'true' : 'false');
        const want = state[k] === undefined || Number.isNaN(state[k]) ? null : String(state[k]);
        if (document.activeElement !== c.fields[k]) {
          if (want !== null && c.fields[k].value !== want) c.fields[k].value = want;
          if (state[k] === undefined && c.fields[k].value !== '') c.fields[k].value = '';
        }
      }
      c.problem.hidden = !(show && msgs.length);
      setText(c.problem, msgs.join(' '));
    }

    const line = statusLine(item, q);
    c.status.hidden = !line;
    setText(c.status, line);
    c.status.classList.toggle('warn', item.unsupported || item.partial);

    c.ifNo.hidden = !(item.status === 'gap' && !na && !item.unsupported && item.blockedBy.length === 0);
    setText(c.ifNo.querySelector('.first-step'), T(score.firstStep(checklist, item, result)));
    if (q.computed) drawWorked(c.worked, item, result.computed);
    if (c.planBox) drawPlan(c.planBox, item, result);
  }

  // The range picture and sentence for the worked-out question.
  function drawWorked(box, item, w) {
    box.hidden = !(w && item.applicability !== 'na');
    if (box.hidden) return;
    const max = [0.05, 0.1, 0.2, 0.3, 0.5, 0.75, 1].find((s) => s >= Math.max(w.high, w.limit) * 1.15) || 1;
    const at = (x) => (Math.min(x, max) / max) * 100 + '%';
    const band = el('div', { class: 'band' });
    band.style.left = at(w.low); band.style.width = 'calc(' + at(w.high) + ' - ' + at(w.low) + ')';
    const dot = el('div', { class: 'dot' }); dot.style.left = at(w.rate);
    const limit = el('div', { class: 'limit' }); limit.style.left = at(w.limit);

    const say = el('p', { class: 'say' });
    if (w.answer === 'yes') {
      say.append('The top of the range, ', el('strong', { text: pct(w.high) }), ', is under your ', el('strong', { text: fmtLimit(w.limit) }), ' limit.');
    } else if (w.needed === null) {
      say.append('You’re seeing ', el('strong', { text: pct(w.rate) }), ', already at or over your ', el('strong', { text: fmtLimit(w.limit) }),
        ' limit. More testing can’t fix that: fix the workflow, then test again.');
    } else if (w.needed === Infinity) {
      say.append(w.rate === 0
        ? 'Even with no mistakes at all, it would take more than a million unchecked outputs to show a rate under ' + fmtLimit(w.limit) + '.'
        : 'At ' + pct(w.rate) + ' you’re too close to your limit to prove the difference by testing. Lower the error rate first.');
    } else {
      say.append('The top of the range, ', el('strong', { text: pct(w.high) }), ', is over your ', el('strong', { text: fmtLimit(w.limit) }),
        ' limit, so the evidence isn’t there yet. ',
        w.wrong === 0 ? 'Even with no mistakes at all, it takes ' : 'If mistakes keep turning up at ' + pct(w.rate) + ', it takes about ',
        el('strong', { text: count(w.needed) + ' unchecked outputs' }), ' to bring the top under ' + fmtLimit(w.limit) + '.',
        state.mode === 'gated' ? ' Only part of an answer key goes out unchecked, so the key itself has to be bigger than that.' : '');
    }
    const calc = Q.find((x) => x.computed && x.tool);
    const link = calc ? el('a', {
      class: 'tool-link', target: '_blank', rel: 'noopener', text: 'Open these numbers in the error-rate calculator ↗',
      href: calc.tool.url + '#n=' + w.unchecked + '&k=' + w.wrong + '&t=' + +(w.limit * 100).toFixed(6),
    }) : null;
    box.replaceChildren(
      el('p', { class: 'eyebrow', style: '--c: var(--faint)', text: 'Likely range of your silent error rate' }),
      el('p', { class: 'big', text: pct(w.low) + ' – ' + pct(w.high) }),
      el('div', { class: 'range', role: 'img', 'aria-label': 'Likely ' + pct(w.low) + ' to ' + pct(w.high) + ', seen ' + pct(w.rate) + ', limit ' + fmtLimit(w.limit) }, band, dot, limit),
      el('div', { class: 'axis', 'aria-hidden': 'true' }, el('span', { text: '0%' }), el('span', { text: fmtLimit(max / 2) }), el('span', { text: fmtLimit(max) })),
      el('div', { class: 'legend', 'aria-hidden': 'true' },
        el('span', null, el('i', { style: 'background: var(--violet)' }), 'likely range'),
        el('span', null, el('i', { style: 'background: var(--amber)' }), 'your limit')),
      say, link);
  }

  // The weekly spot-check plan for the limit in question 1.
  function drawPlan(box, item, result) {
    const p = result.plan;
    box.hidden = !p || item.applicability === 'na';
    if (box.hidden) return;
    const limit = state.limit / 100;
    const key = [p.n, p.c, limit].join('/');
    if (box.dataset.key === key) return;
    box.dataset.key = key;
    box.replaceChildren(
      el('p', { class: 'eyebrow', style: '--c: var(--faint)', text: 'A spot-check plan for your ' + fmtLimit(limit) + ' limit' }),
      el('p', { class: 'big', text: 'Check ' + count(p.n) + ' a week' }),
      el('p', { class: 'say' }, 'Stop when ', el('strong', { text: p.c + ' or more' }), ' of a week’s ' + count(p.n) + ' are wrong. ',
        'If the real rate doubles to ' + fmtLimit(2 * limit) + ', this catches it within four weeks ' + Math.round(p.catchWithin4Weeks * 100) + ' times in 100. ',
        'At half your limit, it stops by bad luck about ' + (p.falseStopsPerYear < 0.95 ? 'once every ' + Math.round(1 / p.falseStopsPerYear) + ' years' : 'once a year') + '. ',
        'Fewer than ' + count(p.n) + ' unchecked outputs a week? Use batches of ' + count(p.n) + '.'));
  }

  // ---- the scorecard ----

  function updateScorecard(result) {
    const verdict = $('verdict');
    setText(verdict, score.verdictText(checklist, result));
    verdict.className = 'verdict ' + result.verdict;
    const c = result.counts;
    const m = modeInfo(result.mode);
    setText($('verdict-sub'), !m ? 'Pick the design you plan to ship, at the top of the checklist.' :
      m.name + ': ' + m.summary + '. ' + c.met + ' of ' + c.required + ' met' +
      (c.gaps ? ', ' + c.gaps + ' to fix' : '') + (c.unanswered ? ', ' + c.unanswered + ' not answered' : '') + '.');

    const body = $('sc-body');
    const tableOpen = !!($('all-answers') && $('all-answers').open); // kept open across redraws
    body.replaceChildren();

    if (result.verdict === 'incomplete') {
      body.append(el('div', { class: 'sc-block' }, el('p', { text: 'No gaps so far in the questions that count. Answer the ' + c.unanswered + ' left to see your verdict.' })));
    }
    if (result.verdict === 'ready') {
      body.append(el('div', { class: 'sc-block' }, el('p', {
        text: 'Every question this design counts clears its bar. Keep the evidence with the workflow, and run this again whenever the workflow, its inputs or its model change.',
      })));
    }

    if (result.gaps.length) {
      const list = el('ol', { class: 'gaps' });
      for (const g of result.gaps) {
        const q = question(g.n);
        const left = score.stillToTick(checklist, g);
        const head = el('div', { class: 'gap-head' },
          el('a', { href: '#q-' + g.n, text: g.n + '. ' + q.title }),
          g.blockedBy.length ? el('span', { class: 'tag after', text: 'After ' + g.blockedBy.join(' and ') })
            : el('span', { class: 'tag start', text: 'Start here' }),
          g.unblocks.length ? el('span', { class: 'tag after', text: 'Unblocks ' + g.unblocks.join(', ') }) : null);
        list.append(el('li', null, head,
          g.unsupported ? el('p', { text: 'Its bar is ticked, but it rests on question ' + g.blockedBy.join(' and ') + ', which is a gap.' }) : null,
          el('p', null, el('b', { text: 'First step: ' }), T(score.firstStep(checklist, g, result))),
          left.length ? el('div', { class: 'done' }, el('b', { text: 'Still to tick:' }), el('ul', null, left.map((t) => el('li', { text: T(t) })))) : null));
      }
      body.append(el('div', { class: 'sc-block' },
        el('h3', { text: 'Fix in this order' }),
        el('p', { text: 'Each gap comes after the ones it rests on, so nothing gets fixed twice.' }),
        list));
    }

    if (result.fallback) {
      const safe = modeInfo(result.fallback.mode);
      body.append(needsBox('fallback', result.fallback,
        'Meanwhile: run it ' + safe.name.toLowerCase(),
        'Until the gaps are closed, it could run ' + safe.name.toLowerCase() + ' (' + safe.summary + '), once these are in place:'));
    }
    if (result.nextLevel) {
      body.append(needsBox('next', result.nextLevel,
        'Next: letting some outputs go out on their own',
        'To move to a ' + modeInfo(result.nextLevel.mode).name.toLowerCase() + ' design, these need a yes too, answered for the outputs that would go out alone:'));
    }

    if (result.mode) {
      const yeses = result.items.filter((i) => i.applicability === 'required' && i.status === 'met');
      const withEvidence = yeses.filter((i) => i.evidence).length;
      if (yeses.length) {
        body.append(el('div', { class: 'sc-block' }, el('p', { class: 'note' },
          el('strong', { text: 'Evidence is written down for ' + withEvidence + ' of your ' + yeses.length + ' yes answers. ' }),
          'A yes with nothing behind it is a claim. Add evidence under each question; it goes into the Markdown copy, never into the link.')));
      }
    }

    const table = answersTable(result);
    table.open = tableOpen;
    body.append(table);
  }

  const MARKS = { met: '✓', gap: '✗', check: '?', unanswered: '?' };
  function needsBox(kind, data, title, intro) {
    return el('div', { class: 'box ' + kind },
      el('h3', { text: title }),
      el('p', { text: intro }),
      el('ul', { class: 'needs' }, data.needs.map((x) => el('li', null,
        el('span', { class: 'mark ' + x.status, 'aria-hidden': 'true', text: MARKS[x.status] || '?' }),
        el('span', null,
          el('a', { href: '#q-' + x.n, text: x.n + '. ' + question(x.n).title }),
          el('span', { class: 'sr-only', text: ' (' + (x.status === 'check' ? 'to check' : STATUS_WORDS[x.status]) + ')' }),
          x.note ? el('span', { class: 'why', text: ': ' + x.note }) : null)))));
  }

  function answersTable(result) {
    const rows = result.items.map((item) => el('tr', null,
      el('td', { text: String(item.n) }),
      el('td', { text: question(item.n).title }),
      el('td', { class: item.status === 'met' ? 'ans-yes' : item.status === 'gap' ? 'ans-no' : '', text: score.answerWords(item) }),
      el('td', { text: item.evidence || '' })));
    return el('details', { class: 'sc-block', id: 'all-answers' },
      el('summary', { text: 'All answers' }),
      el('div', { class: 'table-wrap' }, el('table', null,
        el('thead', null, el('tr', null, ['#', 'Question', 'Answer', 'Evidence'].map((h) => el('th', { scope: 'col', text: h })))),
        el('tbody', null, rows))));
  }

  // ---- the link, the copy, the print ----

  let lastHash = null;
  function saveToLink() {
    const hash = score.encodeHash(checklist, state);
    if (hash === lastHash) return; // browsers throttle history updates
    lastHash = hash;
    try { history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search); } catch (e) { /* file:// in some browsers */ }
  }

  function loadFromLink() {
    state = Object.assign(blank(), score.decodeHash(checklist, location.hash));
  }

  function flash(text) { $('done-msg').textContent = text; }

  async function copy(text, okMessage) {
    try {
      await navigator.clipboard.writeText(text);
      flash(okMessage);
      return true;
    } catch (e) {
      return false;
    }
  }

  $('copy-md').addEventListener('click', async () => {
    const md = score.toMarkdown(checklist, Object.assign({}, state, { name: $('wf-name').value }), score.evaluate(checklist, state),
      { date: new Date().toISOString().slice(0, 10), url: PAGE_URL });
    $('md-fallback').replaceChildren();
    if (!(await copy(md, 'Markdown copied. Paste it into a ticket, a pull request or a doc.'))) {
      const area = el('textarea', { class: 'fallback-text', readonly: true, 'aria-label': 'Scorecard as Markdown' });
      area.value = md;
      $('md-fallback').append(el('p', { class: 'note', text: 'Your browser blocked copying. Select this text and copy it:' }), area);
      area.focus(); area.select();
    }
  });

  $('copy-link').addEventListener('click', async () => {
    saveToLink();
    if (!(await copy(location.href, 'Link copied. It holds your ticks and numbers, not your notes.'))) {
      flash('Copy this page’s address from the address bar.');
    }
  });

  $('print').addEventListener('click', () => window.print());
  window.addEventListener('beforeprint', () => { const d = $('all-answers'); if (d) d.open = true; });

  function hasNotes() { return Object.values(state.evidence || {}).some((v) => v && v.trim()); }
  function hasAnything() {
    return !!state.mode || Object.keys(state.ticks).length > 0 || Object.keys(state.no).length > 0 || hasNotes() ||
      ['limit', 'wrong', 'unchecked'].some((k) => state[k] !== undefined);
  }

  function apply(next) {
    state = Object.assign(blank(), next);
    for (const q of Q) cards[q.n].textarea.value = state.evidence[q.n] || '';
    for (const c of Object.values(cards)) for (const f of Object.values(c.fields)) f.value = '';
    $('md-fallback').replaceChildren();
    flash('');
    update();
  }

  // Moves focus to a heading after a big change, so keyboard and
  // screen-reader users land where the page now points.
  function focusOn(id) {
    const target = $(id);
    target.setAttribute('tabindex', '-1');
    target.focus({ preventScroll: true });
    target.scrollIntoView();
  }

  $('reset').addEventListener('click', () => {
    if (hasAnything() && !window.confirm('Clear every answer, number and note?')) return;
    $('wf-name').value = '';
    apply(blank());
    focusOn('h-design');
  });

  // Examples, so the scorecard can be seen without answering twelve questions.
  // Ticks are written as in the link: one character per question.
  const PRESETS = {
    // Nothing measured yet; failures are alerted, but nobody has counted.
    first: { mode: 'automatic', t: 'nnnnnn--n1nn' },
    // Measured, but on 20 outputs; reviews are a note; no spot checks.
    twenty: { mode: 'gated', t: '333137n737n3', limit: 5, wrong: 0, unchecked: 20 },
    ready: { mode: 'gated', t: '333137773773', limit: 5, wrong: 2, unchecked: 300 },
  };
  for (const b of document.querySelectorAll('[data-preset]')) {
    b.addEventListener('click', () => {
      if (hasAnything() && !window.confirm('Replace your answers with the example?')) return;
      const p = PRESETS[b.dataset.preset];
      const next = score.decodeHash(checklist, 'v=' + checklist.version + '&t=' + p.t);
      next.mode = p.mode;
      for (const k of ['limit', 'wrong', 'unchecked']) if (p[k] !== undefined) next[k] = p[k];
      apply(next);
      focusOn('verdict');
    });
  }

  // Notes live only in this page. Warn before they're lost.
  window.addEventListener('beforeunload', (e) => {
    if (hasNotes()) { e.preventDefault(); e.returnValue = ''; }
  });

  // A link pasted into this tab, or the back button: take its answers. A
  // jump to a place on the page (#q-4, #scorecard) is not a link to answers,
  // so the answers stay and the address goes back to holding them.
  window.addEventListener('hashchange', () => {
    const hash = location.hash.replace(/^#/, '');
    if (hash === lastHash) return;
    if (!/(^|&)v=/.test(hash)) {
      try { history.replaceState(null, '', lastHash ? '#' + lastHash : location.pathname + location.search); } catch (e) { /* ignore */ }
      return;
    }
    const keepNotes = state.evidence;
    loadFromLink();
    state.evidence = keepNotes;
    apply(state);
  });

  buildModes();
  buildStages();
  railCells = buildCells($('rail-cells'));
  stripCells = buildCells($('strip'));
  loadFromLink();
  update();
})();
