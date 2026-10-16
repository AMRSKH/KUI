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
const STATE_BASE = 1;
const STATE_COENG = 2;
const STATE_SUBSCRIPT = 3;
const STATE_VOWEL = 4;

function createPropertyValue(state: number, width: number, shouldJoin: boolean): number {
  return ((state & 0xffffff) << 3) | ((width & 3) << 1) | (shouldJoin ? 1 : 0);
}

function isKhmerConsonant(code: number): boolean {
  return (code >= KHMER_CONSONANT_START && code <= KHMER_CONSONANT_END) ||
         (code >= KHMER_INDEP_VOWEL_START && code <= KHMER_INDEP_VOWEL_END);
}

function isKhmerCombiningVowelOrSign(code: number): boolean {
  // Inherent vowels and dependent vowels above/below
  if (code >= 0x17B4 && code <= 0x17BD) return true;
  // Diacritic signs: Nikahit, Muusikatoan, Triisap, Bantoc, Robat, Toandakhiat, Kakabat, Ahsda, Samyok Sanya, Viriam, Coeng, Bathamasat
  if (code >= 0x17C6 && code <= 0x17D3) return true;
  // Atthacan
  if (code === 0x17DD) return true;
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

    // Khmer combining vowels and diacritic marks are zero-width
    if (isKhmerCombiningVowelOrSign(codepoint)) return 0;

    // Zero-width joiner & non-joiner
    if (codepoint === ZWJ || codepoint === ZWNJ) return 0;

    // Khmer consonants and independent vowels have width 1 (base character)
    if (isKhmerConsonant(codepoint)) return 1;

    // Spacing Khmer symbols / punctuation / currency
    if (codepoint >= 0x17D4 && codepoint <= 0x17E9) return 1;

    // Delegate all other Unicode code points to standard Unicode 11 provider
    const w = this.fallbackProvider.wcwidth(codepoint);
    return (w === 2 ? 2 : w === 0 ? 0 : 1) as 0 | 1 | 2;
  }

  public charProperties(codepoint: number, preceding: number): number {
    const prevState = preceding >> 3;

    // 1. Khmer Sign Coeng (្) — always joins preceding consonant and signals subscript state
    if (codepoint === KHMER_COENG) {
      return createPropertyValue(STATE_COENG, 0, true);
    }

    // 2. Consonant immediately following Coeng (្ + Consonant) -> SUBSCRIPT CONSONANT (ជើង)
    // In Khmer typography, subscript consonants stack vertically beneath the base consonant.
    // They MUST join the same terminal cell (width 0, shouldJoin = true) so the font's OpenType
    // GSUB table can shape them into a single subscript ligature rather than rendering an orphaned
    // dotted circle (◌).
    if (prevState === STATE_COENG && isKhmerConsonant(codepoint)) {
      return createPropertyValue(STATE_SUBSCRIPT, 0, true);
    }

    // 3. Khmer combining vowels & diacritics (e.g. ិ ី ឹ ឺ ុ ូ ួ ំ ៉ ៊ ់ etc.)
    // These stack directly on the consonant / subscript cluster.
    if (isKhmerCombiningVowelOrSign(codepoint)) {
      const shouldJoin = preceding !== 0;
      return createPropertyValue(STATE_VOWEL, 0, shouldJoin);
    }

    // 4. Zero-width joiners
    if (codepoint === ZWJ || codepoint === ZWNJ) {
      return createPropertyValue(prevState, 0, true);
    }

    // 5. Khmer base consonants (starting a new cluster)
    if (isKhmerConsonant(codepoint)) {
      return createPropertyValue(STATE_BASE, 1, false);
    }

    // 6. All other characters: use Unicode 11 fallback
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
