import { Terminal } from '@xterm/xterm';
import { KhmerUnicodeAddon } from './khmerUnicode';

/**
 * Regression tests for the Khmer Unicode provider.
 *
 * A Khmer syllable is one grapheme cluster and therefore has to occupy
 * exactly ONE terminal cell — the same way Windows Terminal and iTerm2 lay
 * Khmer out. The expected cell count of every sample below is the number of
 * clusters reported by `Intl.Segmenter`, which is the reference model.
 *
 * Run with: npm test
 */

/** Everyday Khmer words and sentences. */
export const KHMER_CLUSTER_CASES: ReadonlyArray<string> = [
  'ខ្ញុំ',
  'សួស្តី',
  'ខ្មែរ',
  'សួស្តីពិភពលោក!',
  'កម្ពុ',
  'ភាសាខ្មែរ',
  'ជើងអក្សរ',
  'ស្ត្រី',
  'កម្ពុជា',
  'ស្រឡាញ់',
  'ត្រី',
  'ព្រឹក',
  'ខ្ញុំបាទ',
  'អក្សរខ្មែរ',
  '១២៣៤៥៦៧៨៩០',
  'ពុទ្ធ',
  'ស៊ី',
  'យ៉ា',
  'ឈ្នះ',
  'េក',
  'េគ',
  'កេ',
  'ប្រ',
  'ក្ន',
  'លើ',
  'ជាមួយ',
  'អង្គរ',
  'ក្ខ្ញ',
  'សក្កដិ',
  'ខ្មែរជាតិ',
  'វិធីប្រើកម្មវិធី',
  'សេចក្តី',
  'ព្រះរាជាណាចក្រកម្ពុជា',
];

/** Marks around a coeng, shifter stacks and standalone marks. */
export const KHMER_EDGE_CASES: ReadonlyArray<string> = [
  'ក្ិ',
  'កិ្ខ',
  'េ្ក',
  'ក៉',
  'ក៉្ខ',
  'ក្ខ៉',
  'កំ',
  'ស្រៈ',
  'ក្ដ',
  'ក្ឋ',
  'ក្ឌ',
  'ក្ឍ',
  'ក្ណ',
  'ក្ត',
  'ក្ថ',
];

/**
 * Returns the number of terminal cells a string occupies with the Khmer
 * provider active.
 */
export function measureCells(terminal: Terminal, text: string): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unicodeService = (terminal as any)._core.unicodeService;
  return unicodeService.getStringCellWidth(text);
}

/**
 * Verifies that every sample occupies exactly one cell per grapheme cluster.
 * Returns the list of failures (empty when everything is correct).
 */
export function runKhmerUnicodeTests(
  terminal: Terminal,
  samples: ReadonlyArray<string> = [...KHMER_CLUSTER_CASES, ...KHMER_EDGE_CASES]
): string[] {
  const failures: string[] = [];
  const segmenter = new Intl.Segmenter('km', { granularity: 'grapheme' });

  for (const sample of samples) {
    const expected = [...segmenter.segment(sample)].length;
    const actual = measureCells(terminal, sample);
    if (actual !== expected) {
      failures.push(`"${sample}": expected ${expected} cells, got ${actual}`);
    }
  }

  return failures;
}

/**
 * Convenience helper: creates a terminal with the Khmer provider active.
 */
export function createKhmerTerminal(): Terminal {
  const terminal = new Terminal({ allowProposedApi: true });
  new KhmerUnicodeAddon().activate(terminal);
  return terminal;
}
