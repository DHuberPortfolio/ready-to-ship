// Writes the parts of the docs that come from checklist.js, so the README,
// METHOD.md and the paper checklist can't drift from what the page asks.
//
//   node scripts/build-docs.js           rewrite CHECKLIST.md and the marked blocks
//   node scripts/build-docs.js --check   exit 1 if anything is out of date (CI runs this as a test)
//
// A marked block looks like
//   <!-- generated:name -->
//   ...replaced on every build...
//   <!-- /generated:name -->

'use strict';
const fs = require('node:fs');
const path = require('node:path');
const checklist = require('../checklist.js');
const { applies, planSpotChecks, wilsonBounds, chanceExactly, fmtLimit, fill: fillText } = require('../score.js');
// Question text for paper: {here} becomes "on the interactive page".
const P = (text) => fillText(text, 'paper');

const ROOT = path.join(__dirname, '..');
const Q = checklist.questions;
const MODE_WORD = { required: 'counts', optional: 'optional', na: '–' };

// One Markdown table cell: pipes escaped, nothing else changed.
const cell = (s) => String(s).replace(/\|/g, '\\|');

function citations(q, kinds) {
  return q.sources
    .filter((s) => !kinds || kinds.includes(checklist.sources[s.id].kind))
    .map((s) => checklist.sources[s.id].short + (s.where ? ', ' + s.where : ''))
    .join('; ');
}

const blocks = {
  // README: the twelve questions at a glance.
  questions() {
    const rows = Q.map((q) => `| ${q.n} | **${cell(q.title)}** | ${cell(q.ask)} |`);
    return ['| # | | The question |', '|---|---|---|', ...rows].join('\n');
  },

  // METHOD.md: which design counts which question.
  applicability() {
    const head = '| # | Question | ' + checklist.modes.map((m) => m.name).join(' | ') + ' |';
    const rule = '|---|---|' + checklist.modes.map(() => '---|').join('');
    const rows = Q.map((q) => `| ${q.n} | ${cell(q.title)} | ` + checklist.modes.map((m) => MODE_WORD[applies(q, m.id)]).join(' | ') + ' |');
    const totals = '| | **Questions that count** | ' + checklist.modes.map((m) => '**' + Q.filter((q) => applies(q, m.id) === 'required').length + '**').join(' | ') + ' |';
    return [head, rule, ...rows, totals].join('\n');
  },

  // METHOD.md: which yes rests on which.
  dependencies() {
    const rows = Q.filter((q) => q.needs.length).map((q) =>
      `| ${q.n}. ${cell(q.title)} | ${q.needs.map((p) => p + '. ' + Q[p - 1].title).join('; ')} |`);
    return ['| This yes | rests on |', '|---|---|', ...rows].join('\n');
  },

  // METHOD.md: each question, the failure it guards against, and where the idea comes from.
  traceability() {
    const rows = Q.map((q) => `| ${q.n} | ${cell(q.title)} | ${cell(q.failure)} | ${cell(citations(q, ['framework', 'practice', 'tool']) || '–')} | ${cell(citations(q, ['research']) || '–')} |`);
    return ['| # | Question | The silent failure it prevents | Frameworks and practice | Research |', '|---|---|---|---|---|', ...rows].join('\n');
  },

  // METHOD.md: weekly spot-check plans for a range of limits.
  plans() {
    const rows = [0.01, 0.02, 0.05, 0.10, 0.20].map((L) => {
      const p = planSpotChecks(L);
      return `| ${fmtLimit(L)} | ${p.n} | ${p.c} or more | ${Math.round(p.catchWithin4Weeks * 100)} in 100 | ${p.falseStopsPerYear.toFixed(2)} | ${Math.round(p.weeklyTripAtLimit * 100)}% |`;
    });
    return ['| Limit | Check each week | Stop at | Catches a doubled rate within 4 weeks | False stops a year at half the limit | Weekly chance of a stop exactly at the limit |',
      '|---|---|---|---|---|---|', ...rows].join('\n');
  },

  // METHOD.md: how often the rules give the wrong answer, worked out exactly
  // from the binomial distribution with the shipped score.js.
  operating() {
    const yesAtLimit = (k, n, L) => wilsonBounds(k / n, n).high < L;
    // (a) One test: the worst chance of a yes when the real rate is the limit.
    const one = [0.01, 0.02, 0.05, 0.10].map((L) => {
      let worst = 0, at = 0;
      for (let n = 20; n <= 1000; n++) {
        let pass = 0;
        for (let k = 0; k <= n && yesAtLimit(k, n, L); k++) pass += chanceExactly(k, n, L);
        if (pass > worst) { worst = pass; at = n; }
      }
      return `| ${fmtLimit(L)} | ${(worst * 100).toFixed(2)}% (at ${at} records) |`;
    });
    // (b) Testing until it passes: looks of m new records, counts added up.
    const repeated = (L, looks, m) => {
      let dist = new Map([[0, 1]]), passed = 0;
      for (let j = 1; j <= looks; j++) {
        const next = new Map();
        for (const [k0, pr] of dist) {
          for (let x = 0; x <= m; x++) {
            const q = pr * chanceExactly(x, m, L);
            if (q > 1e-15) next.set(k0 + x, (next.get(k0 + x) || 0) + q);
          }
        }
        dist = new Map();
        for (const [k, pr] of next) { if (yesAtLimit(k, j * m, L)) passed += pr; else dist.set(k, pr); }
      }
      return passed;
    };
    const looks = [[1, 1000], [10, 100], [20, 50]].map(([l, m]) =>
      `| ${l === 1 ? 'One test of 1,000' : l + ' looks of ' + m + ', added up'} | ${(repeated(0.05, l, m) * 100).toFixed(1)}% |`);
    // (c) The reviewer screen in question 8: catch all of 20 planted mistakes.
    const screen = [0.01, 0.05, 0.10, 0.16, 0.30].map((miss) =>
      `| ${Math.round(miss * 100)}% | ${+((1 - miss) ** 20 * 100).toPrecision(2)}% |`);
    return [
      '**One test, at the limit.** The chance of a yes when the real rate is exactly the limit, at the worst sample size from 20 to 1,000:',
      '', '| Limit | Worst chance of a wrong yes |', '|---|---|', ...one, '',
      '**Testing until it passes** (5% limit, real rate exactly 5%):',
      '', '| How it was tested | Chance of a wrong yes |', '|---|---|', ...looks, '',
      '**The reviewer screen** (question 8: every one of 20 planted mistakes caught):',
      '', '| Reviewer’s real miss rate | Chance they pass anyway |', '|---|---|', ...screen,
    ].join('\n');
  },

  // METHOD.md: the reference list, alphabetical.
  references() {
    return Object.values(checklist.sources)
      .slice()
      // Alphabetical by author, ignoring "&" as APA does. A plain comparison,
      // not localeCompare, so Windows and Linux sort alike.
      .sort((a, b) => {
        const key = (s) => s.cite.toLowerCase().replace(/&\s*/g, '');
        return key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0;
      })
      // A link only where the reference doesn't already end with one.
      .map((s) => `- ${s.cite}` + (s.cite.includes('http') ? '' : ` <${s.url}>`))
      .join('\n');
  },
};

// The paper version: every question with its bar, for people who'd rather
// print it, or read it on GitHub.
function paperChecklist() {
  const out = [];
  out.push('# Ready to ship? The checklist on paper');
  out.push('');
  out.push('<!-- Generated by scripts/build-docs.js from checklist.js. Edit checklist.js, then run `npm run docs`. -->');
  out.push('');
  out.push('The same questions as [the interactive page](https://dhuberportfolio.github.io/ready-to-ship/), which also scores them. ' +
    'Under each question is what it means, then its bar: tick each part that is true. All of them ticked is a yes; anything less is a no.');
  out.push('');
  out.push('**First, the design you plan to ship.** It decides which questions count:');
  out.push('');
  for (const m of checklist.modes) {
    const n = Q.filter((q) => applies(q, m.id) === 'required').map((q) => q.n);
    out.push(`- [ ] **${m.label}** (${m.name.toLowerCase()}). ${m.detail} Counts questions ${n.join(', ')}.`);
  }
  out.push('');
  const evidence = Q.find((q) => q.computed);
  const spot = Q.find((q) => q.plan);
  out.push('**Scoring.** One no on a question that counts means not ready. A yes that rests on a no (the "Rests on" line) is a no too. ' +
    'Fix gaps in number order: nothing comes before what it rests on. ' +
    'For question ' + evidence.n + ', the likely range is the 95% Wilson interval, and for question ' + spot.n + ' the spot-check plan comes from your limit: ' +
    'the [interactive page](https://dhuberportfolio.github.io/ready-to-ship/) works out both, and the ' +
    '[error-rate calculator](https://dhuberportfolio.github.io/error-rate-calculator/) does the first.');
  for (const s of checklist.stages) {
    out.push('');
    out.push('## ' + s.title);
    out.push('');
    out.push('_' + s.blurb + '_');
    for (const q of Q.filter((x) => x.stage === s.id)) {
      out.push('');
      out.push(`### ${q.n}. ${q.title}`);
      out.push('');
      out.push(`**${q.ask}**`);
      out.push('');
      out.push(P(q.plain));
      out.push('');
      out.push('It’s a yes when all of these are true:');
      out.push('');
      for (const t of q.ticks) out.push('- [ ] ' + P(t));
      if (q.computedBar) out.push('- [ ] ' + P(q.computedBar) + ' (The interactive page and the error-rate calculator work this out.)');
      out.push('');
      if (q.needs.length) out.push('Rests on: ' + q.needs.map((p) => 'question ' + p).join(', ') + '. ');
      const counted = checklist.modes.filter((m) => applies(q, m.id) === 'required').map((m) => m.name.toLowerCase());
      out.push('Counts for: ' + counted.join(', ') + ' designs.');
      out.push('');
      out.push('- **Why it matters:** ' + P(q.why));
      out.push('- **If no, first step:** ' + P(q.firstStep));
      out.push('- **Go further:** ' + P(q.further));
    }
  }
  out.push('');
  out.push('---');
  out.push('');
  out.push('Why each question is here, how the scoring works, and every source: [METHOD.md](METHOD.md).');
  return out.join('\n') + '\n';
}

// Blocks another script owns, left exactly as they are. The mutants table
// comes from running the whole test suite many times over, so
// audit/mutants.js --write fills it: running it from here would run the
// tests inside the tests.
const EXTERNAL = ['mutants'];

function fill(text, file) {
  return text.replace(/<!-- generated:([a-z-]+) -->[\s\S]*?<!-- \/generated:\1 -->/g, (whole, name) => {
    if (EXTERNAL.includes(name)) return whole;
    if (!blocks[name]) throw new Error(file + ': unknown generated block "' + name + '"');
    return '<!-- generated:' + name + ' -->\n' + blocks[name]() + '\n<!-- /generated:' + name + ' -->';
  });
}

// Every file this script owns, with the content it should have.
function render() {
  const out = { 'CHECKLIST.md': paperChecklist() };
  for (const file of ['README.md', 'METHOD.md']) {
    const p = path.join(ROOT, file);
    if (fs.existsSync(p)) out[file] = fill(fs.readFileSync(p, 'utf8'), file);
  }
  return out;
}

if (require.main === module) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const [file, content] of Object.entries(render())) {
    const p = path.join(ROOT, file);
    const now = fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null;
    if (now === content) continue;
    if (check) { console.error(file + ' is out of date: run npm run docs'); stale++; }
    else { fs.writeFileSync(p, content); console.log('wrote ' + file); }
  }
  if (check && stale) process.exit(1);
}

module.exports = { render, blocks };
