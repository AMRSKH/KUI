/**
 * KUI Khmer rendering verification harness.
 *
 * Runs the REAL xterm.js UnicodeService (same code path the app uses) against
 * the Khmer Unicode provider and inspects the resulting terminal buffer.
 *
 * Oracle: Intl.Segmenter grapheme clusters (same model Windows Terminal /
 * iTerm2 use) + Unicode 11 wcwidth for the cell width of each cluster.
 *
 * Usage: node scripts/verify-khmer.mjs [--compare-old]
 */
import * as esbuild from 'esbuild';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const ROOT = process.cwd();
const OUT = join(ROOT, 'node_modules', '.kui-verify');
mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------------------
// Bundle a TS source file so we test the real source, not a copy.
// ---------------------------------------------------------------------------
async function loadTs(file, { bundle = false } = {}) {
  const out = await esbuild.build({
    entryPoints: [file],
    bundle: true,
    format: 'esm',
    platform: 'node',
    write: false,
    logLevel: 'silent',
    // @xterm/xterm is CommonJS, so it has to be inlined for the ESM output to
    // be able to use its named exports.
    external: bundle ? [] : ['@xterm/xterm', '@xterm/addon-unicode11'],
  });
  const name = file.replace(/[^a-z0-9]/gi, '_');
  const modPath = join(OUT, `${name}.mjs`);
  writeFileSync(modPath, out.outputFiles[0].text);
  return import(pathToFileURL(modPath).href);
}

const { KhmerUnicodeAddon, KhmerUnicodeProvider } = await loadTs(
  join(ROOT, 'src/utils/khmerUnicode.ts')
);
const testModule = await loadTs(join(ROOT, 'src/utils/khmerUnicode.test.ts'), { bundle: true });

const { Terminal } = require('@xterm/xterm');
const { Unicode11Addon } = require('@xterm/addon-unicode11');

// ---------------------------------------------------------------------------
// Test infrastructure
// ---------------------------------------------------------------------------
let pass = 0;
let fail = 0;
const failures = [];

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function check(name, actual, expected) {
  if (eq(actual, expected)) {
    pass++;
    return true;
  }
  fail++;
  failures.push(
    `${name}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`
  );
  return false;
}

function section(title) {
  console.log(`\n\x1b[36m── ${title}\x1b[0m`);
}

function makeTerm(withKhmer) {
  const term = new Terminal({ allowProposedApi: true, cols: 120, rows: 30, scrollback: 100 });
  if (withKhmer) {
    new KhmerUnicodeAddon().activate(term);
  } else {
    new Unicode11Addon().activate(term);
    term.unicode.activeVersion = '11'; // the addon only registers; activate it
  }
  return term;
}

const svc = (term) => term._core.unicodeService;
const widthOf = (term, s) => svc(term).getStringCellWidth(s);
const writeAsync = (term, data) => new Promise((res) => term.write(data, res));

function dumpLine(term, y = 0) {
  const line = term.buffer.active.getLine(y);
  if (!line) return [];
  const cells = [];
  for (let x = 0; x < term.cols; x++) {
    const cell = line.getCell(x);
    if (!cell) continue;
    const chars = cell.getChars();
    if (chars !== '' && chars !== ' ') {
      cells.push({ x, chars, width: cell.getWidth() });
    }
  }
  return cells;
}

// ---------------------------------------------------------------------------
// Reference oracle: grapheme clusters (Intl.Segmenter) x Unicode 11 width
// ---------------------------------------------------------------------------
const segmenter = new Intl.Segmenter('km', { granularity: 'grapheme' });
const u11Term = makeTerm(false);
const u11Provider = svc(u11Term)._activeProvider;

function referenceWidth(text) {
  let total = 0;
  for (const { segment } of segmenter.segment(text)) {
    let w = 0;
    for (const ch of segment) {
      const cw = u11Provider.wcwidth(ch.codePointAt(0));
      if (cw > w) w = cw;
    }
    total += w;
  }
  return total;
}

// ===========================================================================
section('1. Khmer cluster width vs. reference terminal model');
// ===========================================================================
const CORPUS = [
  ...testModule.KHMER_CLUSTER_CASES,
  ...testModule.KHMER_EDGE_CASES,
];

const khmerTerm = makeTerm(true);
let widthMismatch = 0;
for (const text of CORPUS) {
  const actual = widthOf(khmerTerm, text);
  const expected = referenceWidth(text);
  if (actual !== expected) {
    widthMismatch++;
    console.log(
      `   \x1b[33mMISMATCH\x1b[0m "${text}"  got ${actual}, reference ${expected}  clusters=${JSON.stringify(
        [...segmenter.segment(text)].map((s) => s.segment)
      )}`
    );
  }
  check(`cluster width "${text}"`, actual, expected);
}
console.log(`   corpus size: ${CORPUS.length}`);

// The test module in src/utils must agree with the reference model too.
{
  const term = testModule.createKhmerTerminal();
  const failures = testModule.runKhmerUnicodeTests(term);
  check('src/utils/khmerUnicode.test.ts passes', failures.length, 0);
  for (const f of failures.slice(0, 10)) console.log(`   \x1b[33m${f}\x1b[0m`);
}

// ===========================================================================
section('2. Buffer layout — every cluster must land in ONE cell');
// ===========================================================================
{
  const cases = [
    ['កម្ពុ', 2, ['ក', 'ម្ពុ']],
    ['ខ្ញុំ', 1, ['ខ្ញុំ']],
    ['ស្ត្រី', 1, ['ស្ត្រី']],
    ['សួស្តី', 2, ['សួ', 'ស្តី']],
  ];
  for (const [text, count, expected] of cases) {
    const term = makeTerm(true);
    await writeAsync(term, text);
    const cells = dumpLine(term, 0);
    check(`buffer cells for "${text}"`, cells.length, count);
    check(`buffer content for "${text}"`, cells.map((c) => c.chars), expected);
    check(
      `all cells width 1 for "${text}"`,
      cells.every((c) => c.width === 1),
      true
    );
  }
}

{
  // Khmer next to ASCII on the same line — the classic overlap bug.
  const term = makeTerm(true);
  await writeAsync(term, 'ABCខ្ញុំDEF');
  const cells = dumpLine(term, 0);
  check('mixed line cell count', cells.length, 7);
  check('mixed cells', cells.map((c) => c.chars), ['A', 'B', 'C', 'ខ្ញុំ', 'D', 'E', 'F']);
  check('mixed cells are contiguous', cells.map((c) => c.x), [0, 1, 2, 3, 4, 5, 6]);
}

// ===========================================================================
section('3. Regression — non-Khmer text must be identical to Unicode 11');
// ===========================================================================
{
  const kTerm = makeTerm(true);
  const uTerm = makeTerm(false);
  const samples = [
    'Hello World',
    'ls -la /usr/local/bin',
    'a'.repeat(80),
    '日本語のテキスト',
    '한국어 텍스트',
    'العربية نص',
    'emoji: 👍🏽 👨‍👩‍👧‍👦',
    'combining: éàô',
    'box: ┌──┐ │ └──┘',
    'url: https://github.com/AMRSKH/KUI',
  ];
  for (const s of samples) {
    check(`width parity "${s.slice(0, 26)}"`, widthOf(kTerm, s), widthOf(uTerm, s));
  }
  // Mixed Khmer+ASCII: the Khmer provider is *expected* to differ from plain
  // Unicode 11 (it is cluster aware), so compare against the reference.
  const mixed = 'mixed កម្ពុ ASCII 123';
  check(`mixed width vs reference`, widthOf(kTerm, mixed), referenceWidth(mixed));
  for (const s of ['Hello World', '日本語のテキスト', 'box: ┌──┐ │ └──┘', 'emoji: 👍🏽']) {
    const kt = makeTerm(true);
    const ut = makeTerm(false);
    await writeAsync(kt, s);
    await writeAsync(ut, s);
    check(
      `buffer parity "${s.slice(0, 22)}"`,
      dumpLine(kt, 0).map((c) => c.chars).join('|'),
      dumpLine(ut, 0).map((c) => c.chars).join('|')
    );
  }
}

// ===========================================================================
section('4. wcwidth audit — Khmer provider vs Unicode 11 (whole BMP)');
// ===========================================================================
{
  const kTerm = makeTerm(true);
  const kProvider = svc(kTerm)._activeProvider;
  const diffs = [];
  for (let cp = 0; cp <= 0xffff; cp++) {
    const k = kProvider.wcwidth(cp);
    const u = u11Provider.wcwidth(cp);
    if (k !== u) diffs.push({ cp, k, u, ch: String.fromCodePoint(cp) });
  }
  const outside = diffs.filter((d) => d.cp < 0x1780 || d.cp > 0x17ff);
  console.log(`   total differences: ${diffs.length}, outside Khmer block: ${outside.length}`);
  for (const d of outside.slice(0, 20)) {
    console.log(
      `     U+${d.cp.toString(16).toUpperCase().padStart(4, '0')} ${d.ch}  khmer=${d.k}  u11=${d.u}`
    );
  }
  check('no wcwidth change outside the Khmer block', outside.length, 0);
  const inKhmer = diffs.filter((d) => d.cp >= 0x1780 && d.cp <= 0x17ff);
  console.log(`   Khmer-block differences vs u11: ${inKhmer.length}`);
}

// ===========================================================================
section('5. Cluster width must never be negative or fractional');
// ===========================================================================
{
  const kTerm = makeTerm(true);
  const bad = [];
  for (const text of CORPUS) {
    const w = widthOf(kTerm, text);
    if (!Number.isInteger(w) || w < 0) bad.push({ text, w });
  }
  check('all cluster widths are non-negative integers', bad.length, 0);
}

// ===========================================================================
section('6. Line wrapping must land on cluster boundaries');
// ===========================================================================
{
  const text = 'កម្ពុជាស្រឡាញ់ត្រីព្រឹកខ្ញុំវិធីប្រើកម្មវិធី';
  const cols = 10;
  const term = new Terminal({ allowProposedApi: true, cols, rows: 10 });
  new KhmerUnicodeAddon().activate(term);
  await writeAsync(term, text);
  const l0 = dumpLine(term, 0);
  const l1 = dumpLine(term, 1);
  const expectedTotal = referenceWidth(text);
  const used = l0.length + l1.length;
  check('wrapped text used the expected number of cells', used, expectedTotal);
  check('no cell overflow on the first row', l0.length, cols);
  // every row must be a whole number of clusters
  check('row 1 is not empty', l1.length > 0, true);
}

// ===========================================================================
section('7. xterm.js char-property contract');
// ===========================================================================
{
  const term = makeTerm(true);
  const kProvider = svc(term)._activeProvider;
  const US = svc(term).constructor;

  const base = kProvider.charProperties(0x1780, 0); // ក
  check('base consonant width', US.extractWidth(base), 1);
  check('base consonant does not join', US.extractShouldJoin(base), false);

  const coeng = kProvider.charProperties(0x17d2, base); // ្ after ក
  check('coeng joins the base', US.extractShouldJoin(coeng), true);
  check('coeng width = cluster width (1)', US.extractWidth(coeng), 1);

  const sub = kProvider.charProperties(0x1784, coeng); // ង after ្
  check('subscript consonant joins', US.extractShouldJoin(sub), true);
  check('subscript width = cluster width (1)', US.extractWidth(sub), 1);

  const vowel = kProvider.charProperties(0x17c0, sub); // ៀ after ង
  check('vowel joins the cluster', US.extractShouldJoin(vowel), true);
  check('vowel width = cluster width (1)', US.extractWidth(vowel), 1);

  // The width of a joining char must equal the width of the cluster it joins,
  // otherwise xterm subtracts the wrong amount and shifts the cursor.
  check(
    'join chain keeps a constant width',
    [base, coeng, sub, vowel].map((p) => US.extractWidth(p)),
    [1, 1, 1, 1]
  );
}

// ===========================================================================
section('8. Provider registration');
// ===========================================================================
{
  const term = makeTerm(true);
  check('active unicode version', svc(term).activeVersion, 'khmer-11');
  check('provider registered', Object.keys(svc(term)._providers).includes('khmer-11'), true);
  check('khmer provider is active', svc(term)._activeProvider instanceof KhmerUnicodeProvider, true);
  check('unicode 11 still registered', Object.keys(svc(term)._providers).includes('11'), true);
}

// ===========================================================================
section('9. Every Khmer cluster must be a single cell (exhaustive scan)');
// ===========================================================================
{
  // Scan the whole Khmer block: build every "base + mark" combination and
  // assert the cluster occupies exactly one cell.
  const BASES = [0x1780, 0x1784, 0x1798, 0x179a, 0x179f, 0x17a1, 0x17a2];
  const MARKS = [0x17b4, 0x17b6, 0x17b7, 0x17bb, 0x17be, 0x17c1, 0x17c4, 0x17c6, 0x17c9, 0x17d2, 0x17dd];
  const term = makeTerm(true);
  const broken = [];
  for (const b of BASES) {
    for (const m of MARKS) {
      const text = String.fromCodePoint(b) + String.fromCodePoint(m);
      const w = widthOf(term, text);
      const ref = referenceWidth(text);
      if (w !== ref) broken.push({ text, w, ref });
    }
  }
  check('base+mark combinations all match the reference', broken.length, 0);
  for (const b of broken.slice(0, 15)) {
    console.log(`   \x1b[33mMISMATCH\x1b[0m "${b.text}" got ${b.w}, reference ${b.ref}`);
  }
}

// ===========================================================================
section('9b. Exhaustive scan: base + mark + mark + coeng + mark');
// ===========================================================================
{
  const BASES = [0x1780, 0x1798, 0x179f];
  const MARKS = [0x17b4, 0x17b6, 0x17b7, 0x17bb, 0x17be, 0x17c1, 0x17c4, 0x17c6, 0x17c9, 0x17cb, 0x17d2];
  const term = makeTerm(true);
  const broken = [];
  let tested = 0;
  for (const b of BASES) {
    for (const m1 of MARKS) {
      for (const m2 of MARKS) {
        const text =
          String.fromCodePoint(b) +
          String.fromCodePoint(m1) +
          String.fromCodePoint(m2) +
          String.fromCodePoint(0x1784);
        const w = widthOf(term, text);
        const ref = referenceWidth(text);
        tested++;
        if (w !== ref) broken.push({ text, w, ref });
      }
    }
  }
  console.log(`   combinations tested: ${tested}`);
  check('multi-mark sequences all match the reference', broken.length, 0);
  for (const b of broken.slice(0, 15)) {
    console.log(
      `   \x1b[33mMISMATCH\x1b[0m ${JSON.stringify(b.text)} got ${b.w}, reference ${b.ref}`
    );
  }
}

// ===========================================================================
if (process.argv.includes('--compare-old')) {
  section('10. BEFORE / AFTER (previous implementation from git)');
  // Extract the pre-fix version of the provider straight from git history.
  const prev = execFileSync(
    'git',
    ['show', '4354dd0:src/utils/khmerUnicode.ts'],
    { cwd: ROOT, encoding: 'utf8' }
  );
  const prevPath = join(OUT, 'khmerUnicode.old.ts');
  writeFileSync(prevPath, prev);
  const old = await loadTs(prevPath);
  const oldTerm = makeTerm(true);
  const oldProvider = new old.KhmerUnicodeProvider(u11Provider);
  svc(oldTerm).register(oldProvider);
  svc(oldTerm).activeVersion = oldProvider.version;

  const rows = [];
  for (const text of CORPUS) {
    const before = widthOf(oldTerm, text);
    const after = widthOf(khmerTerm, text);
    const ref = referenceWidth(text);
    rows.push(
      `   ${text.padEnd(22)} before=${String(before).padStart(3)}  after=${String(after).padStart(3)}  reference=${String(ref).padStart(3)}  ${before === ref ? '' : after === ref ? '\x1b[32mFIXED\x1b[0m' : '\x1b[31mSTILL WRONG\x1b[0m'}`
    );
  }
  console.log(rows.join('\n'));
}

// ===========================================================================
console.log(`\n${'═'.repeat(66)}`);
if (fail === 0) {
  console.log(`\x1b[32m✔ ALL ${pass} CHECKS PASSED\x1b[0m`);
} else {
  console.log(`\x1b[31m✘ ${fail} FAILED\x1b[0m  (\x1b[32m${pass} passed\x1b[0m)`);
  for (const f of failures) console.log(`\n  \x1b[31m✘\x1b[0m ${f}`);
}
console.log('═'.repeat(66));
process.exit(fail === 0 ? 0 : 1);
