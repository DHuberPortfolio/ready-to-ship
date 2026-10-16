// The scoring rules. Every expected number was worked out before the code:
// the Wilson figures by hand and with a separate Python script, checked
// against the published tables in Newcombe (1998), and the spot-check plans
// by a separate exact-binomial search in Python.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const checklist = require('../checklist.js');
const score = require('../score.js');
const {
  wilson, recordsNeeded, chanceAtLeast, planSpotChecks, PLAN, answerOf, numberProblems,
  evaluate, firstStep, encodeHash, decodeHash, toMarkdown, verdictText, md,
} = score;

// Within half a unit of the last decimal place the source printed.
function near(actual, expected, places) {
  const tol = 0.5 * 10 ** -places;
  assert.ok(Math.abs(actual - expected) <= tol, `expected ${expected} (to ${places} places), got ${actual}`);
}

// Ticks for questions 1..12, written as in the link: "-" blank, "n" marked
// no, or a hex digit whose bits are the ticks. Every part ticked, for each
// question in order (2, 2, 2, 1, 2, 3, 3, 3, 2, 3, 3, 2 ticks):
const ALL = '333137773773';
function S(t, extra) {
  const s = decodeHash(checklist, 'v=' + checklist.version + '&t=' + t);
  return Object.assign(s, extra || {});
}
// Enough evidence for question 5 against a 5% limit: 0 wrong in 100.
const PASSING = { limit: 5, wrong: 0, unchecked: 100 };
const set = (t, n, ch) => t.slice(0, n - 1) + ch + t.slice(n);
const item = (r, n) => r.items[n - 1];

// ---- the statistics ----

test('Wilson ranges match Newcombe (1998), Table I', () => {
  for (const [k, n, low, high] of [[81, 263, 0.2553, 0.3662], [15, 148, 0.0624, 0.1605], [0, 20, 0, 0.1611], [1, 29, 0.0061, 0.1718]]) {
    const r = wilson(k, n);
    near(r.low, low, 4);
    near(r.high, high, 4);
  }
});

test('Wilson ranges match the figures published by the sibling tools', () => {
  const a = wilson(3, 50); near(a.low, 0.020615, 6); near(a.high, 0.162173, 6);
  const b = wilson(6, 20); near(b.low, 0.145475, 6); near(b.high, 0.518977, 6);
  const c = wilson(25, 256); near(c.low, 0.067024, 6); near(c.high, 0.140186, 6);
});

test('records needed: the smallest sample whose whole range sits under the target', () => {
  assert.equal(recordsNeeded(0, 0.05), 73);
  assert.equal(recordsNeeded(0, 0.01), 381);
  assert.equal(recordsNeeded(0, 0.001), 3838);
  assert.equal(recordsNeeded(0.06, 0.10), 217); // the calculator's README example
  assert.equal(recordsNeeded(0.06, 0.05), null); // already over: more testing can't help
  assert.equal(recordsNeeded(0.05, 0.05), null);
  assert.equal(recordsNeeded(0.0499, 0.05), Infinity); // past a million
});

test('exact binomial tail', () => {
  near(chanceAtLeast(1, 1, 0.3), 0.3, 12);
  near(chanceAtLeast(2, 3, 0.5), 0.5, 12);
  near(chanceAtLeast(4, 34, 0.1), 0.446, 3);
  assert.equal(chanceAtLeast(0, 5, 0.2), 1);
  assert.equal(chanceAtLeast(6, 5, 0.2), 0);
});

test('spot-check plans match a separate exact search', () => {
  // [limit, weekly checks, stop at], from the Python search.
  for (const [limit, n, c] of [[0.01, 169, 4], [0.02, 85, 4], [0.05, 34, 4], [0.10, 17, 4], [0.20, 6, 3]]) {
    const p = planSpotChecks(limit);
    assert.deepEqual([p.n, p.c], [n, c], 'limit ' + limit);
    assert.ok(p.catchWithin4Weeks >= PLAN.catchChance);
    assert.ok(p.falseStopsPerYear <= PLAN.falseStopsPerYear);
  }
  assert.equal(planSpotChecks(0.3), null);
  assert.equal(planSpotChecks(1e-7), null);
});

test('a spot-check plan is the smallest that does both jobs', () => {
  for (const limit of [0.02, 0.05]) {
    const m = planSpotChecks(limit).n - 1;
    // With one fewer check a week, no stop count meets both targets.
    for (let c = 1; c <= m; c++) {
      const falseOk = 52 * chanceAtLeast(c, m, limit / 2) <= 1;
      const catchOk = 1 - (1 - chanceAtLeast(c, m, 2 * limit)) ** 4 >= 0.9;
      assert.ok(!(falseOk && catchOk), `limit ${limit}: ${m} a week, stop at ${c}, also works`);
    }
  }
});

// ---- ticks ----

test('every part ticked is a yes; part of the bar is a no; nothing is no answer', () => {
  const q6 = checklist.questions[5]; // three ticks
  assert.equal(answerOf(q6, { ticks: { 6: 7 } }).answer, 'yes');
  assert.deepEqual(answerOf(q6, { ticks: { 6: 3 } }), { answer: 'no', mask: 3, partial: true, markedNo: false });
  assert.equal(answerOf(q6, {}).answer, null);
  assert.equal(answerOf(q6, { no: { 6: true }, ticks: { 6: 7 } }).answer, 'no'); // marked no wins
  assert.equal(answerOf(q6, { ticks: { 6: 15 } }).answer, 'yes'); // a bit for a tick that doesn't exist is ignored
  assert.equal(answerOf(q6, { ticks: { 6: '7' } }).answer, null); // not a number: no answer
});

// ---- the verdict ----

test('every question a yes, with passing numbers: ready, for each design', () => {
  for (const mode of ['automatic', 'gated', 'supervised']) {
    const r = evaluate(checklist, S(ALL, Object.assign({ mode }, PASSING)));
    assert.equal(r.verdict, 'ready', mode);
    assert.equal(r.counts.gaps, 0);
  }
});

test('the evidence question waits for the numbers', () => {
  const r = evaluate(checklist, S(ALL, { mode: 'gated' }));
  assert.equal(r.verdict, 'incomplete');
  assert.equal(item(r, 5).waiting, 'numbers');
  assert.equal(item(r, 5).status, 'unanswered');
  // In a supervised design it's optional, so it doesn't hold the verdict up.
  assert.equal(evaluate(checklist, S(ALL, { mode: 'supervised' })).verdict, 'ready');
});

test('each design counts its own questions', () => {
  const required = (mode) => evaluate(checklist, { mode }).items.filter((i) => i.applicability === 'required').map((i) => i.n);
  assert.deepEqual(required('gated'), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  assert.deepEqual(required('automatic'), [1, 2, 3, 4, 5, 6, 9, 10, 11, 12]);
  assert.deepEqual(required('supervised'), [6, 7, 8, 10]);
  // With no design picked yet, every question is shown as counting.
  assert.equal(evaluate(checklist, {}).items.filter((i) => i.applicability === 'required').length, 12);
});

test('one gap is enough: a single no, anywhere, is not ready', () => {
  for (let n = 1; n <= 12; n++) {
    const r = evaluate(checklist, S(set(ALL, n, 'n'), Object.assign({ mode: 'gated' }, PASSING)));
    assert.equal(r.verdict, 'not-ready', 'no on question ' + n);
    assert.ok(r.gaps.some((g) => g.n === n));
  }
});

test('part of a bar ticked is a gap', () => {
  const r = evaluate(checklist, S(set(ALL, 6, '3'), Object.assign({ mode: 'gated' }, PASSING)));
  assert.equal(r.verdict, 'not-ready');
  assert.equal(item(r, 6).partial, true);
  assert.deepEqual(score.stillToTick(checklist, item(r, 6)), [checklist.questions[5].ticks[2]]);
});

test('a gap decides it even before every question is answered', () => {
  const r = evaluate(checklist, S('n-----------', { mode: 'gated' }));
  assert.equal(r.verdict, 'not-ready');
  assert.equal(r.counts.unanswered, 11);
});

test('no gaps so far, some unanswered: not finished', () => {
  const r = evaluate(checklist, S(set(ALL, 12, '-'), Object.assign({ mode: 'gated' }, PASSING)));
  assert.equal(r.verdict, 'incomplete');
  assert.equal(r.counts.unanswered, 1);
});

test('no design picked: no verdict', () => {
  assert.equal(evaluate(checklist, S(ALL, PASSING)).verdict, 'no-mode');
  assert.equal(evaluate(checklist, S(ALL, Object.assign({ mode: 'nonsense' }, PASSING))).verdict, 'no-mode');
});

test('a question that does not apply ignores its answer', () => {
  // Automatic: nothing waits for a person, so 7 and 8 can't be gaps.
  const r = evaluate(checklist, S(set(set(ALL, 7, 'n'), 8, 'n'), Object.assign({ mode: 'automatic' }, PASSING)));
  assert.equal(r.verdict, 'ready');
  assert.equal(item(r, 7).status, 'na');
  assert.equal(item(r, 7).answer, null);
});

test('optional questions are asked but not counted', () => {
  // Supervised: no answer key doesn't stop a design where a person approves everything.
  const r = evaluate(checklist, S('nnnnn777n7nn', { mode: 'supervised' }));
  assert.equal(r.verdict, 'ready');
  assert.equal(r.counts.required, 4);
  assert.equal(item(r, 2).status, 'gap');
  assert.equal(item(r, 2).applicability, 'optional');
});

// ---- a yes needs its foundations ----

test('a yes resting on a gap is a gap, and the gap is where to start', () => {
  // No answer key, but "yes, I know my silent error rate": measured against what?
  const r = evaluate(checklist, S(set(ALL, 2, 'n'), Object.assign({ mode: 'gated' }, PASSING)));
  assert.equal(item(r, 3).status, 'gap');
  assert.equal(item(r, 3).unsupported, true);
  assert.deepEqual(item(r, 3).blockedBy, [2]);
  assert.deepEqual(item(r, 2).unblocks, [3, 12]);
  // 3 can't stand, so 4 and 5 (which rest on it) can't either.
  assert.deepEqual(r.gaps.map((g) => g.n), [2, 3, 4, 5, 12]);
  assert.deepEqual(r.startHere, [2]);
});

test('an unanswered prerequisite does not block; a no resting on a gap is just a no', () => {
  const r = evaluate(checklist, S(set(ALL, 2, '-'), Object.assign({ mode: 'gated' }, PASSING)));
  assert.equal(item(r, 3).status, 'met');
  assert.equal(r.verdict, 'incomplete');
  const all = evaluate(checklist, S('nnnnnnnnnnnn', { mode: 'gated' }));
  assert.equal(item(all, 3).unsupported, false);
  assert.deepEqual(item(all, 3).blockedBy, [2]);
});

test('gaps come out in an order where nothing is fixed before what it rests on', () => {
  const r = evaluate(checklist, S('nnnnnnnnnnnn', { mode: 'gated' }));
  const seen = new Set();
  for (const g of r.gaps) {
    for (const b of g.blockedBy) assert.ok(seen.has(b), g.n + ' listed before ' + b);
    seen.add(g.n);
  }
});

// ---- question 5 is worked out from the numbers ----

test('0 wrong in 20 against a 5% limit is not enough evidence', () => {
  const r = evaluate(checklist, S(ALL, { mode: 'gated', limit: 5, wrong: 0, unchecked: 20 }));
  const q5 = item(r, 5);
  assert.equal(q5.source, 'computed');
  assert.equal(q5.answer, 'no'); // every part ticked, and still a no
  near(r.computed.high, 0.161130, 6);
  assert.equal(r.computed.needed, 73);
  assert.equal(r.verdict, 'not-ready');
});

test('0 wrong in 73 clears a 5% limit; 0 in 72 does not', () => {
  const at = (u) => evaluate(checklist, S(ALL, { mode: 'gated', limit: 5, wrong: 0, unchecked: u }));
  assert.equal(item(at(73), 5).answer, 'yes');
  assert.equal(at(73).verdict, 'ready');
  assert.equal(item(at(72), 5).answer, 'no');
});

test('the top of the range has to be under the limit, not equal to it', () => {
  const limit = wilson(3, 50).high * 100;
  assert.equal(item(evaluate(checklist, S(ALL, { mode: 'gated', limit, wrong: 3, unchecked: 50 })), 5).answer, 'no');
  assert.equal(item(evaluate(checklist, S(ALL, { mode: 'gated', limit: limit + 1e-9, wrong: 3, unchecked: 50 })), 5).answer, 'yes');
});

test('a seen rate at or over the limit: more testing cannot help', () => {
  const r = evaluate(checklist, S(ALL, { mode: 'gated', limit: 5, wrong: 6, unchecked: 20 }));
  assert.equal(item(r, 5).answer, 'no');
  assert.equal(r.computed.needed, null);
});

test('the numbers only count once questions 1 and 3 are a yes', () => {
  for (const t of [set(ALL, 1, '1'), set(ALL, 3, 'n')]) {
    const r = evaluate(checklist, S(t, Object.assign({ mode: 'gated' }, PASSING)));
    assert.equal(r.computed, null, t);
    assert.equal(item(r, 5).waiting, 'numbers');
  }
});

test('passing numbers need the ticks too', () => {
  const partial = evaluate(checklist, S(set(ALL, 5, '1'), Object.assign({ mode: 'gated' }, PASSING)));
  assert.equal(item(partial, 5).answer, 'no');
  assert.equal(item(partial, 5).partial, true);
  const none = evaluate(checklist, S(set(ALL, 5, '-'), Object.assign({ mode: 'gated' }, PASSING)));
  assert.equal(item(none, 5).status, 'unanswered');
  assert.equal(item(none, 5).waiting, 'ticks');
  // Failing numbers are a no whatever the ticks say.
  const failing = evaluate(checklist, S(set(ALL, 5, '-'), { mode: 'gated', limit: 5, wrong: 0, unchecked: 20 }));
  assert.equal(item(failing, 5).answer, 'no');
});

test('numbers that make no sense are not used', () => {
  for (const bad of [{ limit: 0 }, { limit: 100 }, { limit: NaN }, { wrong: 3, unchecked: 2 }, { wrong: 1.5 }, { unchecked: 0 }]) {
    const s = S(ALL, Object.assign({ mode: 'gated' }, PASSING, bad));
    assert.equal(evaluate(checklist, s).computed, null, JSON.stringify(bad));
  }
});

test('plain-words problems for the numbers', () => {
  assert.deepEqual(numberProblems({ limit: 5, wrong: 0, unchecked: 20 }), {});
  assert.deepEqual(numberProblems({ wrong: 3, unchecked: 3 }), {});
  assert.ok(numberProblems({ limit: 150 }).limit);
  assert.ok(numberProblems({ wrong: 5, unchecked: 3 }).wrong);
  assert.ok(numberProblems({ wrong: 1.5, unchecked: 3 }).wrong);
  assert.ok(numberProblems({ unchecked: 0 }).unchecked);
  assert.ok(numberProblems({ wrong: -1, unchecked: 3 }).wrong);
});

test('a worked-out gap gets a first step built from its numbers', () => {
  const step = (s) => { const r = evaluate(checklist, S(ALL, Object.assign({ mode: 'gated' }, s))); return firstStep(checklist, item(r, 5), r); };
  assert.match(step({ limit: 5, wrong: 0, unchecked: 20 }), /a new test of about 73 outputs that go out unchecked.*under 5%\. Fix that size before you start/);
  assert.match(step({ limit: 5, wrong: 6, unchecked: 20 }), /already at or over your 5% limit, so more testing can’t help/);
  assert.match(step({ limit: 0.0001, wrong: 0, unchecked: 100 }), /more than a million outputs .* under 0\.0001%/);
  // Any other gap keeps its own first step.
  const r = evaluate(checklist, S(set(ALL, 1, 'n'), { mode: 'gated' }));
  assert.equal(firstStep(checklist, item(r, 1), r), checklist.questions[0].firstStep);
});

// ---- while it isn't ready: the cautious design ----

test('gated and not ready: supervised is offered, with what is known and what to check', () => {
  const r = evaluate(checklist, S(set(ALL, 5, 'n'), Object.assign({ mode: 'gated' }, PASSING)));
  assert.equal(r.fallback.mode, 'supervised');
  const status = Object.fromEntries(r.fallback.needs.map((x) => [x.n, x.status]));
  // A review built for the doubtful share, and reviewers tested at that
  // volume, don't carry over to reviewing everything.
  assert.deepEqual(status, { 6: 'met', 7: 'check', 8: 'check', 10: 'met' });
  assert.ok(r.fallback.needs.every((x) => x.status !== 'check' || x.note));
});

test('automatic and not ready: the review questions are to check', () => {
  const r = evaluate(checklist, S(set(ALL, 5, 'n'), Object.assign({ mode: 'automatic' }, PASSING)));
  const status = Object.fromEntries(r.fallback.needs.map((x) => [x.n, x.status]));
  assert.deepEqual(status, { 6: 'met', 7: 'check', 8: 'check', 10: 'met' });
});

test('no fallback when ready, unfinished, or already the cautious design', () => {
  assert.equal(evaluate(checklist, S(ALL, Object.assign({ mode: 'gated' }, PASSING))).fallback, null);
  assert.equal(evaluate(checklist, S(set(ALL, 12, '-'), Object.assign({ mode: 'gated' }, PASSING))).fallback, null);
  assert.equal(evaluate(checklist, S(set(ALL, 6, 'n'), { mode: 'supervised' })).fallback, null);
});

test('supervised and ready: what it would take to let some outputs go on their own', () => {
  const r = evaluate(checklist, S(set(ALL, 2, 'n'), { mode: 'supervised' }));
  assert.equal(r.nextLevel.mode, 'gated');
  assert.deepEqual(r.nextLevel.needs.map((x) => x.n), [1, 2, 3, 4, 5, 9, 11, 12]);
  assert.equal(r.nextLevel.needs.find((x) => x.n === 2).status, 'gap');
  assert.equal(evaluate(checklist, S(set(ALL, 6, 'n'), { mode: 'supervised' })).nextLevel, null);
});

test('a spot-check plan comes with a limit that question 1 stands behind', () => {
  const plan = evaluate(checklist, S(ALL, { mode: 'gated', limit: 5 })).plan;
  assert.deepEqual([plan.n, plan.c], [34, 4]);
  assert.equal(evaluate(checklist, S(set(ALL, 1, '1'), { mode: 'gated', limit: 5 })).plan, null);
});

test('with a limit, the spot-check first step is the plan itself', () => {
  const r = evaluate(checklist, S(set(ALL, 11, 'n'), { mode: 'gated', limit: 5 }));
  assert.match(firstStep(checklist, item(r, 11), r), /every week, check 34 outputs .* stop if 4 or more are wrong/);
  const without = evaluate(checklist, S(set(ALL, 11, 'n'), { mode: 'gated' }));
  assert.equal(firstStep(checklist, item(without, 11), without), checklist.questions[10].firstStep);
});

test('verdicts name the design', () => {
  assert.equal(verdictText(checklist, evaluate(checklist, S(ALL, Object.assign({ mode: 'gated' }, PASSING)))), 'Ready to ship as a gated design.');
  assert.equal(verdictText(checklist, evaluate(checklist, {})), 'Pick a design first.');
});

// ---- the link ----

test('the link format, exactly, both ways', () => {
  const state = { mode: 'gated', ticks: { 1: 3, 2: 1, 6: 7 }, no: { 3: true }, limit: 2.5, wrong: 3, unchecked: 120 };
  assert.equal(encodeHash(checklist, state), 'v=2&m=g&t=31n--7------&l=2.5&w=3&u=120');
  assert.deepEqual(decodeHash(checklist, '#v=2&m=g&t=31n--7------&l=2.5&w=3&u=120'), state);
  assert.equal(encodeHash(checklist, {}), '');
});

test('the link never carries names or notes', () => {
  const hash = encodeHash(checklist, S(ALL, { mode: 'gated', name: 'Client X intake', evidence: { 1: 'signed by Pat' } }));
  assert.doesNotMatch(hash, /Client|Pat|signed/);
});

test('a broken, hostile or out-of-date link is ignored, not trusted', () => {
  const empty = { ticks: {}, no: {} };
  assert.deepEqual(decodeHash(checklist, '#v=2&m=<script>&t=zz&l=1e9&w=-1&u=99999999999&evil=1&=&a'), empty);
  assert.deepEqual(decodeHash(checklist, '#v=1&m=g&t=333137773773'), empty); // another version of the questions
  assert.deepEqual(decodeHash(checklist, '#__proto__=x&constructor=y&v=2'), empty);
  assert.deepEqual(decodeHash(checklist, ''), empty);
  // A bit for a tick a question doesn't have makes that character unreadable.
  assert.deepEqual(decodeHash(checklist, '#v=2&t=---3').ticks, {});
  assert.deepEqual(decodeHash(checklist, '#v=2&t=3n').ticks, { 1: 3 }); // short is fine
});

// ---- the Markdown scorecard ----

test('the Markdown scorecard: verdict, gaps in order, what is left to tick, every answer', () => {
  const state = S(set(set(ALL, 2, 'n'), 6, '3'), Object.assign({ mode: 'gated', name: 'Intake triage', evidence: { 1: 'Set by ops lead, 3 Oct' } }, PASSING));
  const out = toMarkdown(checklist, state, evaluate(checklist, state), { date: '2026-10-15', url: 'https://example.org/' });
  assert.match(out, /^# Ready to ship\? Intake triage\n/);
  assert.match(out, /Checked 2026-10-15 · Design: gated/);
  assert.match(out, /\*\*Not ready to ship yet\.\*\* 6 of 12 met, 6 to fix\./);
  const order = [...out.matchAll(/^\d+\. \*\*(\d+)\./gm)].map((m) => Number(m[1]));
  assert.deepEqual(order, [2, 3, 4, 5, 6, 12]);
  assert.match(out, /\*\*3\. The silent error rate\*\* \(after question 2\)/);
  assert.match(out, /Its bar is ticked, but it rests on question 2, which is a gap\./);
  assert.match(out, /- Still to tick: You’ve tried to trigger it on purpose, and the rule stopped it\./);
  assert.match(out, /\| 1 \| A limit, set by the owner \| yes \| Set by ops lead, 3 Oct \|/);
  assert.match(out, /\| 7 \| Review that really waits \| yes \| _none written down_ \|/);
  assert.match(out, /\| 6 \| A hard stop on the worst case \| no \(part of the bar ticked\) \|/);
  assert.match(out, /\| 3 \| The silent error rate \| yes \(rests on a gap\) \|/);
  assert.match(out, /## Meanwhile: run it supervised/);
  assert.match(out, /- \[x\] 10\. Nothing goes missing/);
  assert.match(out, /- \[ \] 6\. A hard stop on the worst case \(a gap\)/);
  assert.match(out, /- \[ \] 7\. Review that really waits: Put an approval step/);
  assert.match(out, /Spot-check plan for a 5% limit: check 34 outputs/);
});

test('optional answers are labelled as optional', () => {
  const state = S(ALL, { mode: 'supervised' });
  assert.match(toMarkdown(checklist, state, evaluate(checklist, state), {}), /\| 1 \| A limit, set by the owner \| yes, optional \|/);
});

test('typed text cannot format, link, embed, inject or break the table', () => {
  assert.equal(md('a | b'), 'a \\| b');
  assert.equal(md('line one\nline two'), 'line one / line two');
  assert.equal(md('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
  assert.equal(md('![p](x.png) [c](javascript:alert(1))'), '\\!\\[p\\](x.png) \\[c\\](javascript:alert(1))');
  assert.equal(md('*bold* _it_ ~~gone~~ `code` # head'), '\\*bold\\* \\_it\\_ \\~\\~gone\\~\\~ \\`code\\` \\# head');
  assert.equal(md('a\\|b'), 'a\\\\\\|b');
  // Addresses stay whole, so they still become links.
  assert.equal(md('see https://example.org/a_b_c?x=1 now'), 'see https://example.org/a_b_c?x=1 now');
  const state = S(ALL, { mode: 'gated', name: 'A | B ###', evidence: { 2: '   ' } });
  const out = toMarkdown(checklist, state, evaluate(checklist, state), {});
  assert.match(out, /^# Ready to ship\? A \\\| B \\#\\#\\#\n/);
  assert.match(out, /\| 2 \| An answer key \| yes \| _none written down_ \|/); // blank evidence is none
});

test('a worked-out question says how it was worked out', () => {
  const state = S(ALL, { mode: 'gated', limit: 5, wrong: 0, unchecked: 20 });
  const out = toMarkdown(checklist, state, evaluate(checklist, state), {});
  assert.match(out, /Question 5, worked out from the numbers: 0 wrong of 20 that went out unchecked is 0\.0%, likely 0\.0% to 16\.1% \(95% Wilson range\), against a limit of 5%\./);
  assert.match(out, /\| 5 \| A big enough test \| no \(worked out from the numbers\) \|/);
});

test('{here} becomes the right place in each copy', () => {
  assert.equal(score.fill('worked out {here}.', 'page'), 'worked out on this page.');
  assert.equal(score.fill('worked out {here}.', 'paper'), 'worked out on the interactive page.');
  // The Markdown copy is read away from the page, so it says which page.
  const state = S(set(ALL, 5, 'n'), Object.assign({ mode: 'gated' }, PASSING));
  const out = toMarkdown(checklist, state, evaluate(checklist, state), {});
  assert.match(out, /the math is worked out on the checklist page\./);
  assert.doesNotMatch(out, /\{here\}/);
});

test('limits read the same on the page and in the Markdown', () => {
  assert.equal(score.fmtLimit(0.05), '5%');
  assert.equal(score.fmtLimit(0.0025), '0.25%');
  assert.equal(score.fmtLimit(0.0004), '0.04%');
  assert.equal(score.fmtLimit(0.000001), '0.0001%');
});
