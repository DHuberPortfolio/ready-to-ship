// How the checklist's answers become a verdict. No dependencies; runs in the
// browser (as window.ReadyToShip.score) and in Node (require('./score.js')),
// so the code the page runs is the code the tests check.
//
// Nothing here knows the wording of any question. The questions, and the
// facts about them that scoring needs (which design needs which question,
// which question depends on which), live in checklist.js. Every function
// takes that checklist as its first argument, so the tests can also score a
// small made-up checklist and check the rules on their own.
//
// The rules, in plain words:
//   1. A yes is every part of the bar ticked. Anything less is a no.
//   2. One gap is enough. Each question guards against a different way a
//      workflow fails silently, so a strong answer on one can't make up for
//      a missing one. There is no "92% ready".
//   3. A yes needs its foundations. A yes to a question whose prerequisite is
//      a gap can't be true (a rate measured against no answer key), so it
//      counts as a gap.
//   4. Numbers beat opinions. The evidence question can only be a yes when
//      the limit and the counts are filled in and the arithmetic agrees.

(function (root) {
  'use strict';

  // ---- the statistics ----

  // 95% confidence, z = 1.96: the same "likely range" as error-rate-calculator
  // and workflow-eval-harness, so the three tools agree to the decimal. The
  // ship rule compares the top of this two-sided range with the limit, which
  // makes it a one-sided check at 97.5%: slightly stricter than the usual
  // one-sided 95%, on purpose (METHOD.md, section 6).
  const Z = 1.96;
  const MAX_RECORDS = 1000000;

  // Ends of the Wilson score interval for an observed rate p over n records.
  function wilsonBounds(p, n) {
    const z2 = Z * Z;
    const denom = 1 + z2 / n;
    const center = (p + z2 / (2 * n)) / denom;
    const half = (Z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom;
    return { low: Math.max(0, center - half), high: Math.min(1, center + half) };
  }

  // The likely range of the real rate, given `wrong` mistakes in `tested`.
  function wilson(wrong, tested) {
    if (!validCounts(wrong, tested)) throw new RangeError('need whole numbers with 0 <= wrong <= tested and tested >= 1');
    const rate = wrong / tested;
    return Object.assign({ rate }, wilsonBounds(rate, tested));
  }

  // Smallest number of records whose whole likely range sits under `target`,
  // if mistakes keep turning up at `rate`. null when rate >= target (more
  // testing can't help); Infinity past a million records.
  function recordsNeeded(rate, target) {
    if (rate >= target) return null;
    for (let n = 1; n <= MAX_RECORDS; n++) {
      if (wilsonBounds(rate, n).high < target) return n;
    }
    return Infinity;
  }

  // Chance of at least c mistakes in n records at real rate p (exact
  // binomial, summed in logarithms so large n can't underflow).
  const logFactorial = [0, 0];
  function lnFact(n) {
    for (let i = logFactorial.length; i <= n; i++) logFactorial.push(logFactorial[i - 1] + Math.log(i));
    return logFactorial[n];
  }
  // Chance of exactly k mistakes in n records at real rate p.
  function chanceExactly(k, n, p) {
    if (k < 0 || k > n) return 0;
    if (p <= 0) return k === 0 ? 1 : 0;
    if (p >= 1) return k === n ? 1 : 0;
    return Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) + k * Math.log(p) + (n - k) * Math.log1p(-p));
  }
  function chanceAtLeast(c, n, p) {
    if (c <= 0) return 1;
    if (c > n || p <= 0) return 0;
    if (p >= 1) return 1;
    let below = 0;
    for (let k = 0; k < c; k++) below += chanceExactly(k, n, p);
    return Math.max(0, 1 - below);
  }

  // A weekly spot-check plan for a limit: check n outputs a week, and stop
  // when c or more of them are wrong. The smallest n that meets both:
  //   - a real rate of twice the limit trips it within 4 weeks, 9 times in 10;
  //   - at half the limit, it trips by bad luck no more than once a year on
  //     average (52 weeks x the weekly chance <= 1).
  // These two targets are choices, stated in METHOD.md section 6 so they can
  // be argued with. null for limits above 25% (twice the limit would be over
  // half) or plans of more than 20,000 a week.
  const PLAN = { weeks: 4, catchChance: 0.9, falseStopsPerYear: 1, maxWeekly: 20000 };
  const planCache = new Map();
  function planSpotChecks(limit) {
    if (!(limit > 0 && limit <= 0.25)) return null;
    if (planCache.has(limit)) return planCache.get(limit);
    let plan = null;
    let c = 1;
    for (let n = 1; n <= PLAN.maxWeekly; n++) {
      // The stop count only ever needs to rise as the sample grows.
      while (52 * chanceAtLeast(c, n, limit / 2) > PLAN.falseStopsPerYear) c++;
      const weekly = chanceAtLeast(c, n, 2 * limit);
      const within = 1 - Math.pow(1 - weekly, PLAN.weeks);
      if (within >= PLAN.catchChance) {
        plan = {
          n, c,
          catchWithin4Weeks: within,
          falseStopsPerYear: 52 * chanceAtLeast(c, n, limit / 2),
          weeklyTripAtLimit: chanceAtLeast(c, n, limit),
        };
        break;
      }
    }
    planCache.set(limit, plan);
    return plan;
  }

  // ---- reading the numbers someone typed ----

  function validCounts(wrong, tested) {
    return Number.isInteger(tested) && tested >= 1 &&
      Number.isInteger(wrong) && wrong >= 0 && wrong <= tested;
  }

  // A limit is a percentage strictly between 0 and 100.
  function validLimit(limit) {
    return typeof limit === 'number' && Number.isFinite(limit) && limit > 0 && limit < 100;
  }

  // Plain-words problems with the numbers, keyed by field, for the page to show.
  function numberProblems(state) {
    const out = {};
    if (state.limit !== undefined && !validLimit(state.limit)) {
      out.limit = 'Enter a limit between 0% and 100%, such as 5.';
    }
    const hasW = state.wrong !== undefined, hasU = state.unchecked !== undefined;
    if (hasU && !(Number.isInteger(state.unchecked) && state.unchecked >= 1)) {
      out.unchecked = 'Enter how many went out unchecked: a whole number, 1 or more.';
    } else if (hasW && !(Number.isInteger(state.wrong) && state.wrong >= 0)) {
      out.wrong = 'Enter how many were wrong: a whole number, 0 or more.';
    } else if (hasW && hasU && state.wrong > state.unchecked) {
      out.wrong = 'The wrong ones can’t outnumber the outputs that went out unchecked.';
    }
    return out;
  }

  // ---- scoring ----

  // How a question applies to a design: 'required', 'optional' or 'na'.
  function applies(question, mode) {
    return (question.modes && question.modes[mode]) || 'na';
  }

  // What the ticks say. A question can also be marked no outright.
  function answerOf(question, state) {
    const full = (1 << question.ticks.length) - 1;
    const raw = (state.ticks || {})[question.n];
    const mask = (Number.isInteger(raw) ? raw : 0) & full;
    if ((state.no || {})[question.n] === true) return { answer: 'no', mask: 0, partial: false, markedNo: true };
    if (mask === 0) return { answer: null, mask, partial: false, markedNo: false };
    if (mask === full) return { answer: 'yes', mask, partial: false, markedNo: false };
    return { answer: 'no', mask, partial: true, markedNo: false };
  }

  // The worked-out part of a `computed` question, or null when the numbers it
  // needs aren't all there. `answers` holds the answers decided so far.
  function computeAnswer(question, state, answers) {
    const c = question.computed;
    if (!c) return null;
    if (answers[c.limitFrom] !== 'yes' || answers[c.countsFrom] !== 'yes') return null;
    if (!validLimit(state.limit) || !validCounts(state.wrong, state.unchecked)) return null;
    const range = wilson(state.wrong, state.unchecked);
    const limit = state.limit / 100;
    const pass = range.high < limit;
    return {
      answer: pass ? 'yes' : 'no',
      wrong: state.wrong, unchecked: state.unchecked, limit,
      rate: range.rate, low: range.low, high: range.high,
      needed: pass ? null : recordsNeeded(range.rate, limit),
    };
  }

  // Scores one set of answers. `state` is
  //   { mode, ticks: { [n]: bitmask }, no: { [n]: true }, limit, wrong, unchecked, evidence: { [n]: text } }
  // and every field may be missing.
  function evaluate(checklist, state) {
    state = state || {};
    const mode = checklist.modes.some((m) => m.id === state.mode) ? state.mode : null;
    const items = [];
    const byNumber = {};
    const answers = {};
    let computed = null;

    for (const q of checklist.questions) {
      const applicability = mode ? applies(q, mode) : 'required';
      const a = applicability === 'na' ? { answer: null, mask: 0, partial: false, markedNo: false } : answerOf(q, state);
      let answer = a.answer;
      let source = answer ? 'answer' : null;
      let waiting = null;
      if (q.computed && applicability !== 'na') {
        const c = computeAnswer(q, state, answers);
        if (c) computed = Object.assign({ n: q.n }, c);
        if (answer === 'no') {
          // The ticks already say no; the numbers can't change that.
        } else if (!c) {
          if (answer === 'yes') { answer = null; source = null; waiting = 'numbers'; }
        } else if (c.answer === 'no') {
          answer = 'no'; source = 'computed';
        } else if (answer === 'yes') {
          source = 'computed';
        } else {
          waiting = 'ticks';
        }
      }
      answers[q.n] = answer;

      // Questions come in an order where every prerequisite has a smaller
      // number (checked by test/checklist.test.js), so their statuses are
      // already known here.
      const blockedBy = (q.needs || []).filter((p) => byNumber[p] && byNumber[p].status === 'gap');
      let status;
      if (applicability === 'na') status = 'na';
      else if (!answer) status = 'unanswered';
      else if (answer === 'no' || blockedBy.length) status = 'gap';
      else status = 'met';
      const ev = (state.evidence || {})[q.n];
      const item = {
        n: q.n, id: q.id, applicability, answer, source, status, blockedBy,
        unsupported: answer === 'yes' && blockedBy.length > 0,
        mask: a.mask, partial: a.partial, markedNo: a.markedNo, waiting,
        evidence: typeof ev === 'string' ? ev.trim() : '',
      };
      items.push(item);
      byNumber[q.n] = item;
    }

    // Which gaps the others wait on.
    for (const item of items) {
      item.unblocks = items.filter((o) => o.blockedBy.includes(item.n)).map((o) => o.n);
    }

    const counted = items.filter((i) => i.applicability === 'required');
    const counts = {
      required: counted.length,
      met: counted.filter((i) => i.status === 'met').length,
      gaps: counted.filter((i) => i.status === 'gap').length,
      unanswered: counted.filter((i) => i.status === 'unanswered').length,
    };

    let verdict;
    if (!mode) verdict = 'no-mode';
    else if (counts.gaps > 0) verdict = 'not-ready'; // one gap decides it, answered or not
    else if (counts.unanswered > 0) verdict = 'incomplete';
    else verdict = 'ready';

    // In the order to fix them. Numbers already run in dependency order.
    const gaps = counted.filter((i) => i.status === 'gap');
    const limitOk = validLimit(state.limit) && answers[1] === 'yes';

    return {
      mode, verdict, counts, items, gaps, computed,
      startHere: gaps.filter((g) => g.blockedBy.length === 0).map((g) => g.n),
      fallback: fallback(checklist, mode, verdict, byNumber),
      nextLevel: nextLevel(checklist, mode, verdict, byNumber),
      plan: limitOk ? planSpotChecks(state.limit / 100) : null,
    };
  }

  // When the planned design isn't ready, the cautious design may be: a person
  // approves every output. What that would need, and what's already known.
  // Answers given for another design carry over only where they mean the
  // same thing; a review set up for the doubtful share, or reviewers tested
  // at that share's volume, don't.
  function fallback(checklist, mode, verdict, byNumber) {
    const safest = checklist.safestMode;
    if (!mode || mode === safest || verdict !== 'not-ready') return null;
    const needs = checklist.questions.filter((q) => applies(q, safest) === 'required').map((q) => {
      const item = byNumber[q.n];
      const known = item.applicability !== 'na' && q.carriesOver !== false;
      return { n: q.n, status: known ? item.status : 'check', note: known ? null : q.fallbackNote || null };
    });
    return { mode: safest, needs };
  }

  // When the safest design is ready: what it would take to let some outputs
  // go out on their own.
  function nextLevel(checklist, mode, verdict, byNumber) {
    if (mode !== checklist.safestMode || verdict !== 'ready') return null;
    const target = checklist.nextMode;
    const needs = checklist.questions
      .filter((q) => applies(q, target) === 'required' && applies(q, mode) !== 'required')
      .map((q) => ({ n: q.n, status: byNumber[q.n].status }));
    return { mode: target, needs };
  }

  // ---- words and numbers for display, shared by the page and the Markdown ----

  // A rate, to one decimal place.
  function pct(x) { return (x * 100).toFixed(1) + '%'; }
  // A limit, as typed: up to two decimals, or two significant figures when tiny.
  function fmtLimit(x) {
    const v = x * 100;
    return (v >= 0.1 ? +v.toFixed(2) : +v.toPrecision(2)) + '%';
  }
  function count(n) { return n.toLocaleString('en-US'); }

  // "{here}" in a question's text stands for wherever the arithmetic is done.
  const WHERE = { page: 'on this page', markdown: 'on the checklist page', paper: 'on the interactive page' };
  function fill(text, where) { return String(text).replace(/\{here\}/g, WHERE[where] || where); }

  function verdictText(checklist, result) {
    const m = checklist.modes.find((x) => x.id === result.mode);
    return checklist.verdicts[result.verdict].replace('{mode}', m ? m.name.toLowerCase() : '');
  }

  // What to do first about a gap. Usually the question's own first step; for
  // a question worked out from the numbers, a step that uses them.
  function firstStep(checklist, item, result) {
    const q = checklist.questions.find((x) => x.n === item.n);
    if (q.plan && result.plan) {
      return 'Use this plan: every week, check ' + count(result.plan.n) + ' outputs that went out unchecked against the right answer, and stop if ' +
        result.plan.c + ' or more are wrong. Put the weekly slot in someone’s calendar, with the stop rule written next to it.';
    }
    const c = result.computed;
    if (item.source !== 'computed' || !c || c.n !== item.n || c.answer !== 'no') return q.firstStep;
    if (c.needed === null) {
      return 'You’re seeing ' + pct(c.rate) + ', already at or over your ' + fmtLimit(c.limit) + ' limit, so more testing can’t help. ' +
        'Find what the wrong outputs have in common, fix that, and test the fixed version on records you haven’t used.';
    }
    if (c.needed === Infinity) {
      return c.rate === 0
        ? 'Even with no mistakes at all, it would take more than a million outputs that go out unchecked to show a rate under ' + fmtLimit(c.limit) + '. A limit that small calls for a hard stop (question 6), not a test.'
        : 'At ' + pct(c.rate) + ' you’re too close to your ' + fmtLimit(c.limit) + ' limit to prove the difference by testing. Lower the error rate first.';
    }
    return 'Plan a new test of about ' + count(c.needed) + ' outputs that go out unchecked: at the rate you’re seeing, that many would bring the top of the range under ' +
      fmtLimit(c.limit) + '. Fix that size before you start, run it on records you haven’t used, and judge it on its own. Adding records until it passes makes passing too easy.';
  }

  // The parts of a question's bar not yet ticked, or all of them.
  function stillToTick(checklist, item) {
    const q = checklist.questions.find((x) => x.n === item.n);
    return q.ticks.filter((t, i) => !(item.mask & (1 << i)));
  }

  // ---- the link: design, ticks and numbers after the #, never free text ----
  //
  //   #v=2&m=g&t=33-n1777-3-30&l=5&w=3&u=50
  //
  // `t` has one character per question, in order: "-" not answered, "n"
  // marked no, or a hexadecimal digit whose bits are the ticks (1 = first
  // tick, 2 = second, 4 = third). `v` is the version of the question list,
  // so a link made for a different list is ignored rather than misread.
  // Workflow names and evidence notes stay out of the link on purpose: they
  // can name clients or systems, and links get pasted into chats and tickets.

  const MODE_CODES = { automatic: 'a', gated: 'g', supervised: 's' };

  function encodeHash(checklist, state) {
    state = state || {};
    const p = ['v=' + checklist.version];
    if (MODE_CODES[state.mode]) p.push('m=' + MODE_CODES[state.mode]);
    const t = checklist.questions.map((q) => {
      const a = answerOf(q, state);
      if (a.markedNo) return 'n';
      return a.mask ? a.mask.toString(16) : '-';
    }).join('');
    if (/[^-]/.test(t)) p.push('t=' + t);
    for (const [key, field] of [['l', 'limit'], ['w', 'wrong'], ['u', 'unchecked']]) {
      const v = state[field];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0) p.push(key + '=' + String(v));
    }
    return p.length > 1 ? p.join('&') : '';
  }

  // Reads a link back. Anything malformed, or from another version of the
  // question list, is ignored, never trusted.
  function decodeHash(checklist, hash) {
    const state = { ticks: {}, no: {} };
    const parts = Object.create(null); // no inherited keys to trip over
    for (const part of String(hash || '').replace(/^#/, '').split('&')) {
      const eq = part.indexOf('=');
      if (eq > 0) parts[part.slice(0, eq)] = part.slice(eq + 1);
    }
    if (parts.v !== String(checklist.version)) return state;
    for (const [mode, code] of Object.entries(MODE_CODES)) if (parts.m === code) state.mode = mode;
    if (/^[0-9a-fn-]+$/.test(parts.t || '')) {
      checklist.questions.forEach((q, i) => {
        const ch = parts.t[i];
        if (ch === 'n') { state.no[q.n] = true; return; }
        if (!ch || ch === '-') return;
        const mask = parseInt(ch, 16);
        if (mask > 0 && mask < (1 << q.ticks.length)) state.ticks[q.n] = mask;
      });
    }
    for (const [key, field] of [['l', 'limit'], ['w', 'wrong'], ['u', 'unchecked']]) {
      if (/^\d{1,10}(\.\d{1,8})?$/.test(parts[key] || '')) state[field] = Number(parts[key]);
    }
    return state;
  }

  // ---- the scorecard as Markdown, for a ticket, a pull request or a doc ----

  // Text someone typed, made safe for one line or one table cell of
  // GitHub-flavored Markdown: nothing that becomes formatting, a link, an
  // image, a heading or HTML, and no pipe or newline to break the table.
  // Web addresses are kept whole, so they still turn into links.
  function md(text) {
    return String(text)
      .split(/(https?:\/\/[^\s<>|]+)/)
      .map((part, i) => (i % 2
        ? part
        : part.replace(/[\\`*_[\]!~#|]/g, '\\$&').replace(/</g, '&lt;').replace(/>/g, '&gt;')))
      .join('')
      .replace(/\s*[\r\n]+\s*/g, ' / ')
      .trim();
  }

  function answerWords(item) {
    let words;
    if (item.applicability === 'na') words = 'doesn’t apply';
    else if (item.waiting === 'numbers') words = 'waiting for the numbers';
    else if (item.waiting === 'ticks') words = 'numbers pass; bar not ticked yet';
    else if (!item.answer) words = 'not answered';
    else if (item.answer === 'yes') words = 'yes' + (item.source === 'computed' ? ', numbers checked' : '');
    else if (item.partial) words = 'no (part of the bar ticked)';
    else words = 'no' + (item.source === 'computed' ? ' (worked out from the numbers)' : '');
    if (item.unsupported) words += ' (rests on a gap)';
    if (item.applicability === 'optional') words += ', optional';
    return words;
  }

  function toMarkdown(checklist, state, result, opts) {
    opts = opts || {};
    const q = (n) => checklist.questions.find((x) => x.n === n);
    const modeInfo = checklist.modes.find((m) => m.id === result.mode);
    const name = state.name && String(state.name).trim() ? md(state.name) : 'AI workflow';
    const lines = [];
    lines.push('# Ready to ship? ' + name);
    lines.push('');
    const meta = [];
    if (opts.date) meta.push('Checked ' + opts.date);
    if (modeInfo) meta.push('Design: ' + modeInfo.name.toLowerCase() + ' (' + modeInfo.summary + ')');
    if (meta.length) lines.push(meta.join(' · '));
    lines.push('');
    lines.push('**' + verdictText(checklist, result) + '**' +
      (result.mode ? ' ' + result.counts.met + ' of ' + result.counts.required + ' met' +
        (result.counts.gaps ? ', ' + result.counts.gaps + ' to fix' : '') +
        (result.counts.unanswered ? ', ' + result.counts.unanswered + ' unanswered' : '') + '.' : ''));
    lines.push('');

    if (result.computed) {
      const c = result.computed;
      lines.push('Question ' + c.n + ', worked out from the numbers: ' + c.wrong + ' wrong of ' + c.unchecked +
        ' that went out unchecked is ' + pct(c.rate) + ', likely ' + pct(c.low) + ' to ' + pct(c.high) +
        ' (95% Wilson range), against a limit of ' + fmtLimit(c.limit) + '.');
      lines.push('');
    }

    if (result.gaps.length) {
      lines.push('## To fix, in this order');
      lines.push('');
      result.gaps.forEach((g, i) => {
        let head = (i + 1) + '. **' + g.n + '. ' + q(g.n).title + '**';
        if (g.blockedBy.length) head += ' (after question ' + g.blockedBy.join(' and ') + ')';
        lines.push(head);
        if (g.unsupported) lines.push('   - Its bar is ticked, but it rests on question ' + g.blockedBy.join(' and ') + ', which is a gap.');
        lines.push('   - First step: ' + fill(firstStep(checklist, g, result), 'markdown'));
        const left = stillToTick(checklist, g).map((t) => fill(t, 'markdown'));
        if (left.length) lines.push('   - Still to tick: ' + left.join(' / '));
      });
      lines.push('');
    }

    if (result.fallback) {
      const f = result.fallback;
      const safe = checklist.modes.find((m) => m.id === f.mode);
      lines.push('## Meanwhile: run it ' + safe.name.toLowerCase());
      lines.push('');
      lines.push('Until the gaps are closed, it could run ' + safe.name.toLowerCase() + ' (' + safe.summary + '), once these are in place:');
      lines.push('');
      for (const x of f.needs) {
        lines.push('- ' + (x.status === 'met' ? '[x]' : '[ ]') + ' ' + x.n + '. ' + q(x.n).title +
          (x.note ? ': ' + x.note : x.status === 'gap' ? ' (a gap)' : x.status === 'unanswered' ? ' (not answered)' : ''));
      }
      lines.push('');
    }

    if (result.plan) {
      const p = result.plan;
      lines.push('Spot-check plan for a ' + fmtLimit(state.limit / 100) + ' limit: check ' + count(p.n) + ' outputs that went out unchecked each week; stop if ' +
        p.c + ' or more are wrong.');
      lines.push('');
    }

    lines.push('## All answers');
    lines.push('');
    lines.push('| # | Question | Answer | Evidence |');
    lines.push('|---|---|---|---|');
    for (const item of result.items) {
      const ev = item.evidence ? md(item.evidence) : (item.status === 'met' ? '_none written down_' : '');
      lines.push('| ' + item.n + ' | ' + md(q(item.n).title) + ' | ' + answerWords(item) + ' | ' + ev + ' |');
    }
    lines.push('');
    if (opts.url) lines.push('Made with [Ready to ship?](' + opts.url + '). Each question, its bar for a yes, and its sources are explained there.');
    return lines.join('\n') + '\n';
  }

  const api = {
    Z, MAX_RECORDS, PLAN,
    wilson, wilsonBounds, recordsNeeded, chanceExactly, chanceAtLeast, planSpotChecks,
    validCounts, validLimit, numberProblems,
    applies, answerOf, evaluate, firstStep, stillToTick,
    pct, fmtLimit, fill, verdictText, answerWords, md,
    encodeHash, decodeHash, toMarkdown,
  };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.ReadyToShip = root.ReadyToShip || {}; root.ReadyToShip.score = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
