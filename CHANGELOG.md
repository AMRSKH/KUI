# Changelog / កំណត់ចំណាំការចេញផ្សាយ

រាល់ការផ្លាស់ប្តូរ និងកំណែអាប់ដេតសំខាន់ៗរបស់ KUI ត្រូវបានកត់ត្រានៅទីនេះ។

---

## [0.1.7] - 2026-10-24

### 🇰🇭 ភាសាខ្មែរ

#### កែលម្អ និងជួសជុល (Fixes & Improvements)
- **ស្ដារទម្រង់អក្សរខ្មែរពី v0.1.2 មកវិញ:**
  - ដោះស្រាយបញ្ហាអក្សរជាន់គ្នា និងរញ៉េរញ៉ៃ ដោយកំណត់ `.xterm-rows span` ឱ្យប្រើ `letter-spacing: normal !important` និង `overflow: visible !important`។
  - រៀបចំការផ្គុំជើងអក្សរ ស្រៈនិស្ស័យ និងសញ្ញាលើក្រោមបានស្អាតច្បាស់ មិនកាត់ឬដាច់កន្ទុយអក្សរ។
  - ផ្ទុក Font ពេញលេញ ធានាឱ្យដំណើរការ OpenType Ligatures (`liga`, `calt`, `clig`) បានត្រឹមត្រូវគ្រប់ពាក្យ។
- **ពង្រឹងការបំបែកផ្ទាំង (Split Panes) និង Tab:**
  - រក្សាទំហំ Layout ច្បាស់លាស់ មិនបាត់បង់ Session ឬកកស្ទះពេលពុះ Pane ទៅខាងស្ដាំ ឬខាងក្រោម។
  - រក្សាដំណើរការ Terminal មិនឱ្យបាត់ State ឬ Reset ពេលប្ដូរ Tab។
- **ផ្លូវកាត់ក្តារចុច (Keyboard Shortcuts):**
  - កំណត់ `Ctrl+Shift+X` សម្រាប់បិទ Settings ឬបិទ Pane ដែលកំពុងដំណើរការ។

---

### 🌐 English

#### Fixes & Improvements
- **Restored v0.1.2 Khmer Typography:**
  - Eliminated negative letter-spacing and squished characters by neutralizing xterm DOM renderer metrics (`letter-spacing: normal !important`, `overflow: visible !important`).
  - Restored seamless subscript consonant stacking (`ជើង`) and combining vowel clusters without vertical clipping or horizontal gaps.
  - Restored full OpenType font shaping with active ligatures (`liga`, `calt`, `clig`).
- **Split Pane Layout & Tab Stability:**
  - Implemented persistent absolute layouts preventing terminal resize glitching and session drop during horizontal/vertical splitting.
  - Attached xterm directly to container elements to preserve terminal state across tab switches.
- **Shortcuts & UX:**
  - Updated `Ctrl+Shift+X` for closing settings or focused panes cleanly.

---

## [0.1.6] - 2026-10-23

- **Offline Fonts:** Bundled fonts for offline use without external network dependencies.
- **Keyboard Navigation:** Enhanced shortcut handling across all Windows keyboard layouts.

---

## [0.1.5] - 2026-10-23

- **Khmer Grapheme Widths:** Synchronized Khmer cluster segmentation with `Intl.Segmenter` standard.

---

## [0.1.4] - 2026-10-23

- **Responsive Viewport:** Zero-clip layout container and responsive font zooming shortcuts (`Ctrl++`, `Ctrl+-`, `Ctrl+0`).

---

## [0.1.3] - 2026-10-23

- **TUI Alignment:** ConPTY dimensions and line-feed optimizations for TUI applications (OpenCode, lazygit, nano, htop).

---

## [0.1.2] - 2026-10-22

- **Initial Stable Khmer CTL:** Crisp Khmer Unicode rendering, correct cell metrics, and line height tuning.
