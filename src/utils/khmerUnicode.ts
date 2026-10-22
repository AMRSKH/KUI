import { IUnicodeVersionProvider, ITerminalAddon, Terminal } from '@xterm/xterm';
import { Unicode11Addon } from '@xterm/addon-unicode11';

// Khmer Unicode block: U+1780 - U+17FF
const KHMER_CONSONANT_START = 0x1780; // ក
const KHMER_CONSONANT_END = 0x17A2;   // អ
const KHMER_INDEP_VOWEL_START = 0x17A3; // ឣ
const KHMER_INDEP_VOWEL_END = 0x17B3;   // ឳ
const KHMER_COENG = 0x17D2; // ្ (Khmer Sign Coeng — subscript initiator)
const ZWJ = 0x200D;
const ZWNJ = 0x200C;

// State encoding in upper bits of charProperties
const STATE_NONE = 0;
const STATE_BASE = 1;
const STATE_COENG = 2;
const STATE_SUBSCRIPT = 3;
const STATE_SHIFTER = 4;
const STATE_VOWEL = 5;
const STATE_SIGN = 6;

function createPropertyValue(state: number, width: number, shouldJoin: boolean): number {
  return ((state & 0xffffff) << 3) | ((width & 3) << 1) | (shouldJoin ? 1 : 0);
}

function extractWidth(prop: number): number {
  return (prop >> 1) & 0x3;
}

export function isKhmerConsonant(code: number): boolean {
  return (code >= KHMER_CONSONANT_START && code <= KHMER_CONSONANT_END) ||
         (code >= KHMER_INDEP_VOWEL_START && code <= KHMER_INDEP_VOWEL_END);
}

export function isKhmerDependentVowel(code: number): boolean {
  // Inherent vowels (0x17B4, 0x17B5) and dependent vowels (0x17B6 - 0x17C5)
  return code >= 0x17B4 && code <= 0x17C5;
}

export function isKhmerShifter(code: number): boolean {
  // Muusikatoan (0x17C9 ៉) or Triisap (0x17CA ៊)
  return code === 0x17C9 || code === 0x17CA;
}

export function isKhmerSign(code: number): boolean {
  // Nikahit (0x17C6 ំ), Reahmuk (0x17C7 ះ), Yuukaleapintu (0x17C8 ៈ)
  if (code >= 0x17C6 && code <= 0x17C8) return true;
  // Bantoc (0x17CB ់), Robat (0x17CC ៌), Toandakhiat (0x17CD ៍), Kakabat (0x17CE ៎),
  // Ahsda (0x17CF ៏), Samyok Sanya (0x17D0 ័), Viriam (0x17D1 ៑)
  if (code >= 0x17CB && code <= 0x17D1) return true;
  // Bathamasat (0x17D3 ៓), Atthacan (0x17DD ៝)
  if (code === 0x17D3 || code === 0x17DD) return true;
  return false;
}

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

    // Khmer dependent vowels (0x17B4 - 0x17C5) are zero-width combining marks
    if (isKhmerDependentVowel(codepoint)) return 0;

    // Khmer diacritics and signs (0x17C6 - 0x17D3, 0x17DD) are zero-width combining marks
    if (isKhmerSign(codepoint)) return 0;

    // Zero-width joiner & non-joiner
    if (codepoint === ZWJ || codepoint === ZWNJ) return 0;

    // Khmer consonants and independent vowels have width 1 (base character)
    if (isKhmerConsonant(codepoint)) return 1;

    // Spacing Khmer symbols / punctuation / currency / numbers
    if ((codepoint >= 0x17D4 && codepoint <= 0x17E9) || (codepoint >= 0x17F0 && codepoint <= 0x17F9)) return 1;

    // Delegate all other Unicode code points to standard Unicode 11 provider
    const w = this.fallbackProvider.wcwidth(codepoint);
    return (w === 2 ? 2 : w === 0 ? 0 : 1) as 0 | 1 | 2;
  }

  public charProperties(codepoint: number, preceding: number): number {
    const prevState = preceding >> 3;
    const prevWidth = extractWidth(preceding);

    // 1. Khmer Sign Coeng (្) — initiates subscript (ជើង)
    // Coeng must join the preceding base consonant or preceding subscript consonant
    if (codepoint === KHMER_COENG) {
      const canJoin = prevState === STATE_BASE || prevState === STATE_SUBSCRIPT;
      const width = canJoin ? (prevWidth || 1) : 1;
      return createPropertyValue(STATE_COENG, width, canJoin);
    }

    // 2. Consonant immediately following Coeng (្ + Consonant) -> SUBSCRIPT CONSONANT (ជើង)
    // In Khmer typography, subscript consonants stack vertically beneath the base consonant.
    // They MUST join the same terminal cell so the font's OpenType GSUB table can shape them.
    if (prevState === STATE_COENG && isKhmerConsonant(codepoint)) {
      const width = prevWidth || 1;
      return createPropertyValue(STATE_SUBSCRIPT, width, true);
    }

    // 3. Consonant Shifters (៉ Muusikatoan, ៊ Triisap)
    // Sits above base consonant or subscript before vowels
    if (isKhmerShifter(codepoint)) {
      const canJoin = prevState === STATE_BASE || prevState === STATE_SUBSCRIPT;
      const width = canJoin ? (prevWidth || 1) : 1;
      return createPropertyValue(STATE_SHIFTER, width, canJoin);
    }

    // 4. Khmer Dependent Vowels (e.g. ា, ិ, ី, ឹ, ឺ, ុ, ូ, ួ, ើ, ឿ, ៀ, េ, ែ, ៃ, ោ, ៅ)
    // A dependent vowel joins the consonant cluster (base, subscript, or shifter).
    // CRITICAL: If preceded by ANOTHER vowel (prevState === STATE_VOWEL), it does NOT join,
    // avoiding the bug where multiple consecutive vowels collapse into one tangled mess!
    if (isKhmerDependentVowel(codepoint)) {
      const canJoin = prevState === STATE_BASE || prevState === STATE_SUBSCRIPT || prevState === STATE_SHIFTER;
      const width = canJoin ? (prevWidth || 1) : 1;
      return createPropertyValue(STATE_VOWEL, width, canJoin);
    }

    // 5. Khmer Final Signs & Diacritics (e.g. ំ, ះ, ៈ, ់, ៌, ៍, ៎, ៏, ័, ៑, etc.)
    // These stack at the end of a syllable after a base, subscript, shifter, or vowel.
    if (isKhmerSign(codepoint)) {
      const canJoin = prevState === STATE_BASE || prevState === STATE_SUBSCRIPT || prevState === STATE_SHIFTER || prevState === STATE_VOWEL;
      const width = canJoin ? (prevWidth || 1) : 1;
      return createPropertyValue(STATE_SIGN, width, canJoin);
    }

    // 6. Zero-width joiners
    if (codepoint === ZWJ || codepoint === ZWNJ) {
      const canJoin = prevState !== STATE_NONE;
      const width = canJoin ? (prevWidth || 1) : 0;
      return createPropertyValue(prevState, width, canJoin);
    }

    // 7. Khmer base consonants and independent vowels (starting a new cluster)
    if (isKhmerConsonant(codepoint)) {
      return createPropertyValue(STATE_BASE, 1, false);
    }

    // 8. Spacing Khmer symbols / punctuation / currency / numbers
    if ((codepoint >= 0x17D4 && codepoint <= 0x17E9) || (codepoint >= 0x17F0 && codepoint <= 0x17F9)) {
      return createPropertyValue(STATE_BASE, 1, false);
    }

    // 9. All other characters: use Unicode 11 fallback
    return this.fallbackProvider.charProperties(codepoint, preceding);
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
