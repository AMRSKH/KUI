import { IUnicodeVersionProvider, ITerminalAddon, Terminal } from '@xterm/xterm';
import { Unicode11Addon } from '@xterm/addon-unicode11';

// ---------------------------------------------------------------------------
// Khmer Unicode block: U+1780 - U+17FF
// ---------------------------------------------------------------------------
const KHMER_CONSONANT_START = 0x1780; // ក
const KHMER_CONSONANT_END = 0x17a2;   // អ
const KHMER_INDEP_VOWEL_START = 0x17a3; // ឣ
const KHMER_INDEP_VOWEL_END = 0x17b3;   // ឳ
const KHMER_COENG = 0x17d2; // ្ (subscript initiator)
const ZWJ = 0x200d;
const ZWNJ = 0x200c;
const ZWSP = 0x200b; // Zero width space

// Spacing (Mc) Khmer vowel signs — they occupy horizontal space on their own.
const KHMER_SPACING_VOWELS: ReadonlySet<number> = new Set([
  0x17b6, // ា
  0x17be, 0x17bf, 0x17c0, 0x17c1, 0x17c2, 0x17c3, 0x17c4, 0x17c5, // ើ ឿ ៀ េ ែ ៃ ោ ៅ
  0x17c7, 0x17c8, // ះ ៈ
]);

// Khmer spacing characters (currency, punctuation, digits) that are not marks.
const KHMER_SPACING_BLOCKS: ReadonlyArray<[number, number]> = [
  [0x17d4, 0x17dc], // ។ - ៜ
  [0x17e0, 0x17e9], // ០ - ៩
  [0x17f0, 0x17f9], // ៰ - ៹
];

// ---------------------------------------------------------------------------
// Cluster state
//
// The state is stored in the upper bits of the xterm.js char property value
// (see UnicodeService.createPropertyValue). Layout:
//
//   bit 0..3  kind of the last character inside the cluster
//   bit 4     LINK        the cluster is still chained to its base consonant
//   bit 5     PENDING     the next consonant is a subscript consonant
//   value 0               we are not inside a Khmer cluster
//
// A Khmer syllable (cluster) occupies exactly ONE terminal cell, the same way
// Windows Terminal and iTerm2 lay Khmer out. Every combining mark of the
// cluster therefore has to report "join" so xterm.js appends it to the cell of
// the base character instead of giving it a cell of its own.
//
// The LINK / PENDING flags reproduce the Unicode conjunct rules (UAX #29
// GB9c): a nonspacing mark keeps the base consonant linked to the consonant
// that follows the coeng, while a *spacing* Khmer vowel (Mc) breaks the
// chain, so "កា្ង" is two cells but "ក្ិង" is one.
// ---------------------------------------------------------------------------
const KIND_BASE = 1;
const KIND_COENG = 2;
const KIND_SUBSCRIPT = 3;
const KIND_SHIFTER = 4;
const KIND_VOWEL = 5;
const KIND_SIGN = 6;

const LINK = 0x10;
const PENDING = 0x20;
const STATE_NONE = 0;

function createPropertyValue(state: number, width: number, shouldJoin: boolean): number {
  return ((state & 0xffffff) << 3) | ((width & 3) << 1) | (shouldJoin ? 1 : 0);
}

function extractWidth(prop: number): number {
  return (prop >> 1) & 0x3;
}

function extractState(prop: number): number {
  return prop >> 3;
}

function clusterState(link: boolean, pending: boolean, kind: number): number {
  return kind | (link ? LINK : 0) | (pending ? PENDING : 0);
}

export function isKhmerConsonant(code: number): boolean {
  return (code >= KHMER_CONSONANT_START && code <= KHMER_CONSONANT_END) ||
         (code >= KHMER_INDEP_VOWEL_START && code <= KHMER_INDEP_VOWEL_END);
}

export function isKhmerDependentVowel(code: number): boolean {
  // Inherent vowels (0x17B4, 0x17B5) and dependent vowels (0x17B6 - 0x17C5)
  return code >= 0x17b4 && code <= 0x17c5;
}

export function isKhmerShifter(code: number): boolean {
  // Muusikatoan (0x17C9 ៉) or Triisap (0x17CA ៊)
  return code === 0x17c9 || code === 0x17ca;
}

export function isKhmerSign(code: number): boolean {
  // Nikahit (0x17C6 ំ), Reahmuk (0x17C7 ះ), Yuukaleapintu (0x17C8 ៈ)
  if (code >= 0x17c6 && code <= 0x17c8) return true;
  // Bantoc (0x17CB ់), Robat (0x17CC ៌), Toandakhiat (0x17CD ៍), Kakabat (0x17CE ៎),
  // Ahsda (0x17CF ៏), Samyok Sanya (0x17D0 ័), Viriam (0x17D1 ៑)
  if (code >= 0x17cb && code <= 0x17d1) return true;
  // Bathamasat (0x17D3 ៓), Atthacan (0x17DD ៝)
  if (code === 0x17d3 || code === 0x17dd) return true;
  return false;
}

function isKhmerSpacing(code: number): boolean {
  if (KHMER_SPACING_VOWELS.has(code)) return true;
  for (const [start, end] of KHMER_SPACING_BLOCKS) {
    if (code >= start && code <= end) return true;
  }
  return false;
}

/**
 * Unicode provider that makes xterm.js treat a Khmer syllable as a single
 * terminal cell, exactly like Windows Terminal / iTerm2 do.
 */
export class KhmerUnicodeProvider implements IUnicodeVersionProvider {
  public readonly version = 'khmer-11';
  private fallbackProvider: IUnicodeVersionProvider;

  constructor(fallback: IUnicodeVersionProvider) {
    this.fallbackProvider = fallback;
  }

  public wcwidth(codepoint: number): 0 | 1 | 2 {
    // Khmer Coeng (subscript generator) is strictly zero-width
    if (codepoint === KHMER_COENG) return 0;

    // Khmer consonant shifters (0x17C9, 0x17CA) are zero-width combining marks
    if (isKhmerShifter(codepoint)) return 0;

    // Nonspacing Khmer vowel signs (Mn) are zero-width combining marks
    if (isKhmerDependentVowel(codepoint) && !KHMER_SPACING_VOWELS.has(codepoint)) return 0;

    // Khmer diacritics and signs (0x17C6 - 0x17D3, 0x17DD) are zero-width marks.
    // ះ and ៈ are spacing marks (Mc) in Unicode, so they keep a width of 1.
    if (isKhmerSign(codepoint) && !KHMER_SPACING_VOWELS.has(codepoint)) return 0;

    // Zero-width space, zero-width joiner & non-joiner
    if (codepoint === ZWJ || codepoint === ZWNJ || codepoint === ZWSP) return 0;

    // Khmer consonants and independent vowels have width 1 (base character)
    if (isKhmerConsonant(codepoint)) return 1;

    // Spacing Khmer symbols / punctuation / currency / numbers
    if (isKhmerSpacing(codepoint)) return 1;

    // Delegate all other Unicode code points to standard Unicode 11 provider
    const w = this.fallbackProvider.wcwidth(codepoint);
    return (w === 2 ? 2 : w === 0 ? 0 : 1) as 0 | 1 | 2;
  }

  public charProperties(codepoint: number, preceding: number): number {
    const state = extractState(preceding);
    const prevWidth = extractWidth(preceding);
    const inCluster = state !== STATE_NONE;
    const linked = (state & LINK) !== 0;
    const pending = (state & PENDING) !== 0;

    // 1. Khmer Sign Coeng (្) — opens a subscript stack (ជើង)
    if (codepoint === KHMER_COENG) {
      if (!inCluster) {
        // A coeng without a base character stands on its own.
        return createPropertyValue(clusterState(false, false, KIND_COENG), 1, false);
      }
      // The coeng keeps the chain of its cluster alive, so a consonant that
      // follows it is rendered as a subscript consonant.
      return createPropertyValue(clusterState(linked, linked, KIND_COENG), prevWidth || 1, true);
    }

    // 2. Consonants & independent vowels
    if (isKhmerConsonant(codepoint)) {
      if (pending) {
        // Subscript consonant (ក្ខ) — stacks below the base character.
        return createPropertyValue(clusterState(true, false, KIND_SUBSCRIPT), prevWidth || 1, true);
      }
      // A base character always starts a new cluster.
      return createPropertyValue(clusterState(true, false, KIND_BASE), 1, false);
    }

    // 3. Consonant shifters (៉ Muusikatoan, ៊ Triisap)
    if (isKhmerShifter(codepoint)) {
      return this.extendCluster(state, linked, pending, KIND_SHIFTER, prevWidth, codepoint);
    }

    // 4. Khmer dependent vowels (ា ិ ី ឹ ឺ ុ ូ ួ ើ ឿ ៀ េ ែ ៃ ោ ៅ)
    if (isKhmerDependentVowel(codepoint)) {
      return this.extendCluster(state, linked, pending, KIND_VOWEL, prevWidth, codepoint);
    }

    // 5. Khmer final signs & diacritics (ំ ះ ៈ ់ ៌ ៍ ៎ ៏ ័ ៑ ...)
    if (isKhmerSign(codepoint)) {
      return this.extendCluster(state, linked, pending, KIND_SIGN, prevWidth, codepoint);
    }

    // 6. Zero-width space, joiners and non-joiners
    if (codepoint === ZWSP) {
      // Zero-width space resets the cluster state and takes 0 width
      return createPropertyValue(STATE_NONE, 0, false);
    }

    if (codepoint === ZWJ) {
      if (!inCluster) {
        return createPropertyValue(STATE_NONE, 0, false);
      }
      return createPropertyValue(state, prevWidth || 1, true);
    }

    if (codepoint === ZWNJ) {
      if (!inCluster) {
        return createPropertyValue(STATE_NONE, 0, false);
      }
      // ZWNJ joins the preceding cluster cell but breaks the conjunct link
      // so subsequent consonants/coeng do not form subscripts.
      return createPropertyValue(clusterState(false, false, KIND_SIGN), prevWidth || 1, true);
    }

    // 7. Spacing Khmer symbols / punctuation / currency / numbers
    if (isKhmerSpacing(codepoint)) {
      return createPropertyValue(clusterState(false, false, KIND_BASE), 1, false);
    }

    // 8. All other characters: use Unicode 11 fallback
    return this.fallbackProvider.charProperties(codepoint, preceding);
  }

  /**
   * Extends the current cluster with a combining mark.
   *
   * A mark that follows a cluster member joins the very same cell. A mark
   * that stands alone opens its own cell but still collects the marks that
   * follow it (សុ is one cell, េ្ is one cell in real terminals).
   *
   * Spacing Khmer vowels (U+17B6, U+17BE - U+17C5, U+17C7, U+17C8) break the
   * conjunct chain, nonspacing marks keep it — exactly like UAX #29 does.
   */
  private extendCluster(
    state: number,
    linked: boolean,
    pending: boolean,
    kind: number,
    prevWidth: number,
    codepoint: number
  ): number {
    const breaksChain = KHMER_SPACING_VOWELS.has(codepoint);
    if (state === STATE_NONE) {
      return createPropertyValue(clusterState(false, false, kind), 1, false);
    }
    return createPropertyValue(
      clusterState(linked && !breaksChain, pending && !breaksChain, kind),
      prevWidth || 1,
      true
    );
  }
}

/**
 * Custom xterm.js addon that activates Khmer CTL (Complex Text Layout)
 * cluster joining and zero-width subscript stacking.
 */
export class KhmerUnicodeAddon implements ITerminalAddon {
  private u11 = new Unicode11Addon();

  public activate(terminal: Terminal): void {
    // 1. Activate baseline Unicode 11
    this.u11.activate(terminal);

    // 2. Fetch the registered Unicode 11 provider from terminal services
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const unicodeService = (terminal as any)._core?.unicodeService;
    const u11Provider = unicodeService?._providers?.['11'];

    if (u11Provider) {
      const khmerProvider = new KhmerUnicodeProvider(u11Provider);
      terminal.unicode.register(khmerProvider);
      terminal.unicode.activeVersion = 'khmer-11';
    } else {
      terminal.unicode.activeVersion = '11';
    }
  }

  public dispose(): void {
    this.u11.dispose();
  }
}
