import { Terminal } from '@xterm/xterm';
import { KhmerUnicodeAddon } from './khmerUnicode';

export function runKhmerUnicodeTests(): boolean {
  console.log('Running Khmer Unicode cell width verification tests...');
  const term = new Terminal({ allowProposedApi: true });
  const addon = new KhmerUnicodeAddon();
  addon.activate(term);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unicodeService = (term as any)._core.unicodeService;

  const testCases = [
    { input: 'ខ្ញុំ', expected: 1 },
    { input: 'សួស្តី', expected: 2 },
    { input: 'ខ្មែរ', expected: 2 },
    { input: 'សួស្តីពិភពលោក!', expected: 8 },
  ];

  let passed = true;
  for (const tc of testCases) {
    const actual = unicodeService.getStringCellWidth(tc.input);
    if (actual !== tc.expected) {
      console.error(`FAIL: '${tc.input}' expected cell width ${tc.expected}, got ${actual}`);
      passed = false;
    } else {
      console.log(`PASS: '${tc.input}' -> cell width ${actual}`);
    }
  }

  return passed;
}
