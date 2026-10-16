// The docs that are generated from checklist.js must match it, so what the
// README, METHOD.md and CHECKLIST.md say is what the page asks. If this
// fails, run `npm run docs` and commit the result.

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const checklist = require('../checklist.js');
const { render } = require('../scripts/build-docs.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

test('generated docs are up to date', () => {
  for (const [file, content] of Object.entries(render())) {
    assert.equal(read(file), content, file + ' is out of date: run npm run docs');
  }
});

test('every reference is cited, and every citation has a reference', () => {
  const method = read('METHOD.md');
  const prose = method.replace(/<!-- generated:[\s\S]*?<!-- \/generated:[a-z-]+ -->/g, '');
  const cited = new Set(checklist.questions.flatMap((q) => q.sources.map((s) => s.id)));
  for (const [id, src] of Object.entries(checklist.sources)) {
    assert.ok(cited.has(id) || prose.includes(src.short), `${id} (${src.short}) is in the reference list but never cited`);
  }
  // In-text citations look like "(Wilson, 1927)", "Breck et al., 2017" or
  // "European Union, 2024". A match passes when it ends with a known
  // citation, or is the end of one.
  const shorts = Object.values(checklist.sources).map((s) => s.short);
  const name = "[A-Z][A-Za-zıü’'-]+";
  const pattern = new RegExp(`\\b(${name}(?: ${name})*(?: et al\\.| & ${name})?, (?:19|20)\\d\\d[a-z]?)\\b`, 'g');
  let found = 0;
  for (const m of prose.matchAll(pattern)) {
    found++;
    assert.ok(shorts.some((s) => m[1].endsWith(s) || s.endsWith(m[1])), `METHOD.md cites "${m[1]}", which has no reference`);
  }
  assert.ok(found > 30, `only ${found} in-text citations found: is the pattern still matching?`);
});

test('the page and the docs link to files that exist', () => {
  for (const f of ['index.html', 'README.md', 'METHOD.md', 'CHECKLIST.md']) {
    const text = read(f);
    for (const m of text.matchAll(/\]\(((?!https?:|#|mailto:)[^)\s]+)\)|\b(?:src|href)="((?!https?:|#|data:|mailto:)[^"]+)"/g)) {
      const target = (m[1] || m[2]).split('#')[0];
      if (!target) continue;
      assert.ok(fs.existsSync(path.join(ROOT, target)), `${f} links to ${target}, which doesn't exist`);
    }
  }
});

// Every text file the project ships or runs.
function shippedFiles() {
  const out = ['index.html', 'app.js', 'score.js', 'checklist.js', 'README.md', 'METHOD.md', 'CHECKLIST.md', 'package.json'];
  for (const dir of ['test', 'scripts', 'audit']) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) if (/\.(js|md)$/.test(f)) out.push(dir + '/' + f);
  }
  return out;
}

test('no stray control characters or Windows line endings in any file', () => {
  // A find-and-replace once turned apostrophes on the page into control
  // characters, deleting the letters around them. This would have caught it.
  for (const f of shippedFiles()) {
    const text = read(f);
    const bad = text.match(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/);
    assert.equal(bad, null, `${f} contains a control character (code ${bad && bad[0].charCodeAt(0)})`);
    assert.ok(!text.includes('\r'), `${f} has Windows line endings`);
  }
});

test('the README’s count of tests is the real count', () => {
  const real = fs.readdirSync(path.join(ROOT, 'test'))
    .filter((f) => f.endsWith('.test.js'))
    .reduce((n, f) => n + (read('test/' + f).match(/^test\(/gm) || []).length, 0);
  const said = read('README.md').match(/All (\d+) tests pass on the unchanged code/);
  assert.ok(said, 'the README should say how many tests there are');
  assert.equal(Number(said[1]), real, 'run node audit/mutants.js --write to refresh the README');
});
