// Do the tests catch real mistakes? A passing test suite proves little if it
// would also pass with the rules broken. This script breaks the rules on
// purpose, one at a time ("mutants"), in a scratch copy of the project, runs
// the whole test suite against each, and reports how many tests failed. A
// mutant that passes every test is a hole in the tests.
//
// Run from the repo root:  node audit/mutants.js          (prints the table)
//                          node audit/mutants.js --write  (also puts it in the README)
//
// Each mutation names the exact text it replaces, and the script stops if
// that text isn't found exactly once, so a mutant can't silently go stale
// when the code changes.

'use strict';
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
// Everything the tests read, including what the docs link to.
const COPY = ['score.js', 'checklist.js', 'app.js', 'index.html', 'README.md', 'METHOD.md', 'CHECKLIST.md', 'LICENSE', 'package.json', 'test', 'scripts', 'audit', 'docs'];

const MUTANTS = [
  {
    name: 'Compensatory scoring: one gap still counts as ready',
    file: 'score.js',
    from: "else if (counts.gaps > 0) verdict = 'not-ready';",
    to: "else if (counts.gaps > 1) verdict = 'not-ready';",
  },
  {
    name: 'Prerequisites ignored: a yes can rest on a no',
    file: 'score.js',
    from: ".filter((p) => byNumber[p] && byNumber[p].status === 'gap');",
    to: '.filter(() => false);',
  },
  {
    name: 'The rate seen, not the top of its likely range, is compared with the limit',
    file: 'score.js',
    from: 'const pass = range.high < limit;',
    to: 'const pass = range.rate < limit;',
  },
  {
    name: 'A range that touches the limit counts as under it',
    file: 'score.js',
    from: 'const pass = range.high < limit;',
    to: 'const pass = range.high <= limit;',
  },
  {
    name: '90% confidence instead of 95%',
    file: 'score.js',
    from: 'const Z = 1.96;',
    to: 'const Z = 1.645;',
  },
  {
    name: 'Textbook interval instead of Wilson',
    file: 'score.js',
    from: 'const half = (Z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n))) / denom;\n    return { low: Math.max(0, center - half), high: Math.min(1, center + half) };',
    to: 'const half = Z * Math.sqrt(p * (1 - p) / n);\n    return { low: Math.max(0, p - half), high: Math.min(1, p + half) };',
  },
  {
    name: 'Part of the bar ticked counts as a yes',
    file: 'score.js',
    from: "return { answer: 'no', mask, partial: true, markedNo: false };",
    to: "return { answer: 'yes', mask, partial: true, markedNo: false };",
  },
  {
    name: 'Ticks override numbers that fail',
    file: 'score.js',
    from: "answer = 'no'; source = 'computed';",
    to: "source = 'computed';",
  },
  {
    name: 'The evidence question can be a yes without the numbers',
    file: 'score.js',
    from: "if (answer === 'yes') { answer = null; source = null; waiting = 'numbers'; }",
    to: "if (answer === 'yes') { waiting = 'numbers'; }",
  },
  {
    name: 'An unanswered question counts as a yes',
    file: 'score.js',
    from: "else if (!answer) status = 'unanswered';",
    to: "else if (!answer) status = 'met';",
  },
  {
    name: 'Optional questions are counted',
    file: 'score.js',
    from: "const counted = items.filter((i) => i.applicability === 'required');",
    to: "const counted = items.filter((i) => i.applicability !== 'na');",
  },
  {
    name: 'An unfinished checklist with a gap says "not finished" instead of "not ready"',
    file: 'score.js',
    from: "else if (counts.gaps > 0) verdict = 'not-ready'; // one gap decides it, answered or not\n    else if (counts.unanswered > 0) verdict = 'incomplete';",
    to: "else if (counts.unanswered > 0) verdict = 'incomplete';\n    else if (counts.gaps > 0) verdict = 'not-ready';",
  },
  {
    name: 'The cautious design is offered to a design that is already the cautious one',
    file: 'score.js',
    from: "if (!mode || mode === safest || verdict !== 'not-ready') return null;",
    to: "if (!mode || verdict !== 'not-ready') return null;",
  },
  {
    name: 'The workflow name leaks into the shareable link',
    file: 'score.js',
    from: "    return p.length > 1 ? p.join('&') : '';",
    to: "    if (state.name) p.push('n=' + encodeURIComponent(state.name));\n    return p.length > 1 ? p.join('&') : '';",
  },
  {
    name: 'A link made for another version of the questions is read anyway',
    file: 'score.js',
    from: 'if (parts.v !== String(checklist.version)) return state;',
    to: '',
  },
  {
    name: 'Typed notes can put HTML in the Markdown',
    file: 'score.js',
    from: ".replace(/</g, '&lt;').replace(/>/g, '&gt;')",
    to: '',
  },
  {
    name: 'Line breaks in typed notes split the Markdown table',
    file: 'score.js',
    from: ".replace(/\\s*[\\r\\n]+\\s*/g, ' / ')",
    to: '',
  },
  {
    name: 'The spot-check plan ignores false stops',
    file: 'score.js',
    from: 'while (52 * chanceAtLeast(c, n, limit / 2) > PLAN.falseStopsPerYear) c++;',
    to: '',
  },
  {
    name: 'Question 5 no longer rests on the limit (question 1)',
    file: 'checklist.js',
    from: 'needs: [1, 3, 4],',
    to: 'needs: [3, 4],',
  },
  {
    name: 'A review set up for the doubtful share carries over to reviewing everything',
    file: 'checklist.js',
    from: "        carriesOver: false,\n        modes: REVIEWS,\n        needs: [],\n        sources: [{ id: 'nist-rmf', where: 'MAP 3.5' }",
    to: "        modes: REVIEWS,\n        needs: [],\n        sources: [{ id: 'nist-rmf', where: 'MAP 3.5' }",
  },
  {
    name: 'Question 3 no longer rests on the answer key (question 2)',
    file: 'checklist.js',
    from: "needs: [2],\n        sources: [{ id: 'harness', where: 'docs/SILENT_ERRORS.md' }",
    to: "needs: [],\n        sources: [{ id: 'harness', where: 'docs/SILENT_ERRORS.md' }",
  },
  {
    name: 'The review questions count in a design where nothing waits for a person',
    file: 'checklist.js',
    from: "const REVIEWS = { automatic: 'na',",
    to: "const REVIEWS = { automatic: 'required',",
  },
];

function copyInto(dir) {
  for (const item of COPY) fs.cpSync(path.join(ROOT, item), path.join(dir, item), { recursive: true });
}

function runTests(dir) {
  const r = spawnSync(process.execPath, ['--test'], { cwd: dir, encoding: 'utf8' });
  // The summary lines read "ℹ tests 41" (spec reporter) or "# tests 41" (TAP).
  const grab = (label) => Number(((r.stdout || '').match(new RegExp('^(?:ℹ|#) ' + label + ' (\\d+)', 'm')) || [])[1]);
  return { tests: grab('tests'), fail: grab('fail'), pass: grab('pass') };
}

// Returns the exit code: 0 all caught, 1 a bug got through, 2 can't run.
// (Returning instead of calling process.exit lets `finally` clean up.)
// The README states how many tests there are, and a test checks that. With
// --write, put the right number in first, so the unchanged code can pass.
function refreshTestCount() {
  const real = fs.readdirSync(path.join(ROOT, 'test'))
    .filter((f) => f.endsWith('.test.js'))
    .reduce((n, f) => n + (fs.readFileSync(path.join(ROOT, 'test', f), 'utf8').match(/^test\(/gm) || []).length, 0);
  const readme = path.join(ROOT, 'README.md');
  const text = fs.readFileSync(readme, 'utf8');
  fs.writeFileSync(readme, text.replace(/All \d+ tests pass on the unchanged code/, `All ${real} tests pass on the unchanged code`));
}

function main() {
  if (process.argv.includes('--write')) refreshTestCount();
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'ready-to-ship-mutants-'));
  try {
    const clean = path.join(base, 'clean');
    copyInto(clean);
    const baseline = runTests(clean);
    if (!(baseline.tests > 0) || baseline.fail !== 0) {
      console.error('The unchanged code must pass every test first. Got:', baseline);
      return 2;
    }

    const rows = [];
    for (const [i, m] of MUTANTS.entries()) {
      const dir = path.join(base, 'm' + i);
      copyInto(dir);
      const file = path.join(dir, m.file);
      const text = fs.readFileSync(file, 'utf8');
      const hits = text.split(m.from).length - 1;
      if (hits !== 1) {
        console.error(`Mutant "${m.name}": the text to replace was found ${hits} times in ${m.file}, not once. Update audit/mutants.js.`);
        return 2;
      }
      fs.writeFileSync(file, text.replace(m.from, m.to));
      rows.push(Object.assign({ name: m.name }, runTests(dir)));
    }

    const table = [
      `All ${baseline.tests} tests pass on the unchanged code. Then, one deliberate bug at a time:`,
      '',
      '| Deliberate bug | Tests failed |',
      '|---|---|',
      ...rows.map((r) => `| ${r.name} | ${r.fail} of ${r.tests} |`),
    ].join('\n');
    console.log(table + '\n');
    const survivors = rows.filter((r) => !(r.fail > 0));
    if (process.argv.includes('--write') && !survivors.length) {
      const readme = path.join(ROOT, 'README.md');
      const text = fs.readFileSync(readme, 'utf8');
      fs.writeFileSync(readme, text.replace(/<!-- generated:mutants -->[\s\S]*?<!-- \/generated:mutants -->/,
        '<!-- generated:mutants -->\n' + table + '\n<!-- /generated:mutants -->'));
      console.log('Wrote the table into README.md.');
    }
    if (survivors.length) {
      console.log(`${survivors.length} bug(s) got past every test:`);
      for (const s of survivors) console.log('- ' + s.name);
      return 1;
    }
    console.log(`Every one of the ${rows.length} bugs was caught.`);
    return 0;
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
}

process.exitCode = main();
