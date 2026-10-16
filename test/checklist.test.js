// Checks on the questions themselves: the rules the checklist promises to
// follow (METHOD.md, "How the questions are written"), enforced so a later
// edit can't quietly break one.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const checklist = require('../checklist.js');
const { wilson, recordsNeeded, applies, planSpotChecks, PLAN } = require('../score.js');

const Q = checklist.questions;
const MODES = checklist.modes.map((m) => m.id);
const words = (s) => s.trim().split(/\s+/).length;
const TEXT_FIELDS = ['title', 'failure', 'ask', 'plain', 'why', 'firstStep', 'further'];
const allText = (q) => TEXT_FIELDS.map((f) => q[f]).concat(q.ticks, q.computedBar || [], q.fallbackNote || []);

test('twelve questions, numbered 1 to 12 in order, with unique names', () => {
  assert.equal(Q.length, 12);
  Q.forEach((q, i) => assert.equal(q.n, i + 1));
  assert.equal(new Set(Q.map((q) => q.id)).size, 12);
});

test('every question has all its parts', () => {
  for (const q of Q) {
    for (const field of TEXT_FIELDS) {
      assert.ok(typeof q[field] === 'string' && q[field].trim().length > 0, `question ${q.n} is missing ${field}`);
    }
    assert.ok(Array.isArray(q.ticks) && q.ticks.length >= 1 && q.ticks.length <= 4, `question ${q.n} needs 1 to 4 ticks (the link stores them in one hex digit)`);
    assert.ok(Array.isArray(q.needs) && Array.isArray(q.sources) && q.sources.length > 0, `question ${q.n}`);
  }
});

test('each question asks one thing', () => {
  // A heuristic: "and" or "or" in a question usually means it asks two
  // things, and a yes to one of them reads as a yes to both. Each tick is
  // its own condition, so a bar can have several without that problem.
  for (const q of Q) {
    assert.doesNotMatch(q.ask, /\b(and|or)\b/i, `question ${q.n} may ask two things: ${q.ask}`);
    assert.ok(q.ask.endsWith('?'), `question ${q.n} should end with a question mark`);
  }
});

test('questions and ticks are short enough to read at a glance', () => {
  for (const q of Q) {
    assert.ok(words(q.ask) <= 20, `question ${q.n} is ${words(q.ask)} words`);
    assert.ok(words(q.plain) <= 45, `question ${q.n}'s plain line is ${words(q.plain)} words`);
    for (const t of q.ticks) assert.ok(words(t) <= 40, `a tick on question ${q.n} is ${words(t)} words`);
    assert.ok(words(q.why) <= 75, `question ${q.n}'s why is ${words(q.why)} words`);
    assert.ok(words(q.firstStep) <= 60, `question ${q.n}'s first step is ${words(q.firstStep)} words`);
  }
});

test('stages run in order, each a block of consecutive questions', () => {
  const order = checklist.stages.map((s) => s.id);
  let last = 0;
  for (const q of Q) {
    const at = order.indexOf(q.stage);
    assert.ok(at >= 0, `question ${q.n} has an unknown stage`);
    assert.ok(at >= last, `question ${q.n} goes back to an earlier stage`);
    last = at;
  }
  assert.equal(new Set(Q.map((q) => q.stage)).size, order.length, 'every stage has a question');
});

test('every prerequisite comes before the question that rests on it', () => {
  // This is what lets the scorecard list gaps in plain number order and
  // still never ask for a fix before the thing it depends on.
  for (const q of Q) {
    for (const p of q.needs) {
      assert.ok(Q.some((x) => x.n === p), `question ${q.n} needs a question that doesn't exist (${p})`);
      assert.ok(p < q.n, `question ${q.n} needs ${p}, which comes after it`);
    }
  }
});

test('a question a design counts never rests on one it does not', () => {
  for (const mode of MODES) {
    for (const q of Q.filter((x) => applies(x, mode) === 'required')) {
      for (const p of q.needs) {
        assert.equal(applies(Q[p - 1], mode), 'required', `${mode}: ${q.n} counts, but rests on ${p}, which doesn't`);
      }
    }
  }
});

test('every design asks something, and the gated design asks everything', () => {
  for (const q of Q) {
    for (const mode of MODES) assert.ok(['required', 'optional', 'na'].includes(applies(q, mode)), `${q.n} ${mode}`);
    assert.ok(MODES.some((m) => applies(q, m) === 'required'), `question ${q.n} counts in no design`);
    assert.equal(applies(q, 'gated'), 'required', `question ${q.n}`);
  }
  assert.ok(MODES.includes(checklist.safestMode) && MODES.includes(checklist.nextMode));
});

test('a question that only matters when a person reviews never carries over to reviewing everything', () => {
  // A review step built for the doubtful share, or reviewers tested at that
  // volume, says nothing about a person approving every output.
  for (const q of Q.filter((x) => applies(x, 'automatic') === 'na')) {
    assert.equal(q.carriesOver, false, `question ${q.n}`);
    assert.ok(q.fallbackNote, `question ${q.n} needs a note for the fallback`);
  }
});

test('the worked-out question rests on the questions its numbers come from, and on the hold-out', () => {
  const computed = Q.filter((x) => x.computed);
  assert.equal(computed.length, 1);
  const q = computed[0];
  assert.equal(Q[q.computed.limitFrom - 1].input, 'limit');
  assert.equal(Q[q.computed.countsFrom - 1].input, 'counts');
  assert.ok(q.needs.includes(q.computed.limitFrom) && q.needs.includes(q.computed.countsFrom));
  assert.ok(q.needs.includes(Q.find((x) => x.id === 'held-out').n), 'a rate from tuned records is no evidence');
  assert.ok(q.computedBar, 'its bar says the numbers decide');
});

test('every source cited exists, with a full reference and a link', () => {
  for (const q of Q) {
    for (const s of q.sources) assert.ok(checklist.sources[s.id], `question ${q.n} cites an unknown source: ${s.id}`);
  }
  for (const [id, src] of Object.entries(checklist.sources)) {
    assert.ok(src.cite && src.cite.length > 20, `${id} has no reference`);
    assert.match(src.url, /^https:\/\//, `${id} has no https link`);
    assert.ok(src.short, `${id} has no short name`);
    assert.ok(['framework', 'practice', 'tool', 'research'].includes(src.kind), `${id} has no kind`);
  }
});

test('every number the text quotes from the math is the math', () => {
  const byId = (id) => Q.find((q) => q.id === id);
  // "Zero mistakes in 20 outputs fits a real rate as high as 16%."
  assert.match(byId('enough-evidence').why, /Zero mistakes in 20 outputs fits a real rate as high as 16%/);
  assert.equal(Math.round(wilson(0, 20).high * 100), 16);
  // "less than once in 1,000 times, you'd need nearly 4,000 outputs in a row"
  assert.match(byId('hard-stop').why, /less than once in 1,000 times, you’d need nearly 4,000 outputs/);
  const n = recordsNeeded(0, 0.001);
  assert.ok(n > 3500 && n < 4000, `actually ${n}`);
  // "6 of 20 needed a person (likely 15% to 52%)"
  assert.match(byId('review-waits').why, /6 of 20 needed a person \(likely 15% to 52%\)/);
  assert.deepEqual([Math.round(wilson(6, 20).low * 100), Math.round(wilson(6, 20).high * 100)], [15, 52]);
  // "Catching all 20 ... the miss rate could still be as high as 16%."
  assert.match(byId('reviewers-catch').further, /Catching all 20 .* as high as 16%/);
  assert.match(byId('reviewers-catch').ticks[1], /at least 20 known mistakes/);
  // "check 34 a week; stop at 4 wrong" for a 5% limit
  assert.match(byId('spot-checks').firstStep, /check 34 a week; stop at 4 wrong” for a 5% limit/);
  const plan = planSpotChecks(0.05);
  assert.deepEqual([plan.n, plan.c], [34, 4]);
  // "if the error rate doubled, the stop rule would trip within four weeks, 9 times out of 10"
  assert.match(byId('spot-checks').ticks[2], /if the error rate doubled, .* within four weeks, 9 times out of 10/);
  assert.deepEqual([PLAN.weeks, PLAN.catchChance], [4, 0.9]);
});

test('text reads cleanly: curly quotes, no doubled spaces, no stray characters', () => {
  for (const q of Q) {
    for (const text of allText(q)) {
      assert.doesNotMatch(text, /["']/, `question ${q.n} uses a straight quote: ${text}`);
      assert.doesNotMatch(text, / {2}/, `question ${q.n} has a doubled space`);
      assert.doesNotMatch(text, /\s[,.;:]/, `question ${q.n} has a space before punctuation`);
      assert.doesNotMatch(text, /[\u0000-\u001f\u007f]/, `question ${q.n} has a control character`);
      // The only placeholder is {here}, filled in differently on the page and on paper.
      assert.doesNotMatch(text.replace(/\{here\}/g, ''), /[{}]/, `question ${q.n} has an unknown placeholder: ${text}`);
    }
  }
});
