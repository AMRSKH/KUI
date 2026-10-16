# KUI (Khmer Terminal UI) 🚀

[ភាសាខ្មែរ](#ភាសាខ្មែរ) | [English](#english)

---

## ភាសាខ្មែរ

**KUI** គឺជាកម្មវិធី Terminal ទំនើប ស្រាល និងមានល្បឿនលឿន ដែលរចនាឡើងជាពិសេសសម្រាប់គាំទ្រអក្សរខ្មែរ (Khmer Unicode) និងការបង្ហាញពាក្យស្មុគស្មាញ (Complex Text Layout) នៅលើ Windows។ កម្មវិធីនេះបង្កើតឡើងដោយប្រើប្រាស់ Tauri v2, Rust, React និង xterm.js។

### ✨ លក្ខណៈពិសេសចម្បង

- **🇰🇭 គាំទ្រអក្សរខ្មែរយ៉ាងពេញលេញ:**
  - បង្ហាញជើងអក្សរ ស្រៈនិស្ស័យ និងសញ្ញាផ្សេងៗបានយ៉ាងត្រឹមត្រូវ មិនជាន់គ្នា
  - ដោះស្រាយបញ្ហាអក្សររញ៉េរញ៉ៃ ឬទាញជាន់គ្នាដោយសារ letter-spacing
  - រក្សាគម្លាតតួអក្សរ និងទីតាំង Cursor បានស្មើល្អក្នុងប្រព័ន្ធ Grid របស់ Terminal
  - បើកដំណើរការ OpenType Ligatures ដូចជា `liga`, `calt`, `clig`
- **⚡ ល្បឿនលឿន និងស៊ីធនធានតិច:** ដំណើរការដោយ Rust និង Tauri v2 ភ្ជាប់ជាមួយ Windows ConPTY
- **🖥️ ចែកផ្ទាំង និងគ្រប់គ្រង Tab:** អាចពុះផ្ទាំងផ្តេក បញ្ឈរ និងសារ៉េប្រវែងផ្ទាំងតាមចិត្ត
- **🎨 ស្បែកពណ៌ និងពុម្ពអក្សរ:** មាន Theme ស្អាតៗជាច្រើន (`kui-dark`, `dracula`, `nord`, `catppuccin`, `monokai`, `cyberpunk`, `one-dark`) និងអាចប្តូរ Font បានដូចជា JetBrains Mono, Kantumruy Pro និង Noto Sans Khmer
- **🪟 ដំណើរការល្អលើ Windows:** រៀបចំប្រព័ន្ធ UTF-8 (`chcp 65001`) ដោយស្វ័យប្រវត្តិសម្រាប់ PowerShell, CMD ឬ WSL

### 🛠️ រចនាសម្ព័ន្ធបច្ចេកវិទ្យា

- **Backend:** Rust, Tauri v2, `portable-pty`
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Terminal Core:** xterm.js ជាមួយ Addon ពិសេស `KhmerUnicodeAddon`
- **កម្មវិធីដំឡើង:** NSIS (.exe) និង MSI (.msi) សម្រាប់ Windows

### 📦 របៀបបង្កើតកម្មវិធីពី Source Code

#### តម្រូវការជាមុន

- [Node.js](https://nodejs.org/) (កំណែ v18 ឡើង)
- [Rust](https://rustup.rs/) (stable x86_64-pc-windows-msvc ឬ mingw64)
- C++ Build Tools ឬ MinGW-w64

#### ជំហានតម្លើង

```bash
# Clone repository នេះ
git clone https://github.com/AMRSKH/KUI.git
cd KUI

# តម្លើង dependencies
npm install

# ដំណើរការសាកល្បង (Development Mode)
npm run tauri dev

# បង្កើត Installer សម្រាប់ Windows (NSIS & MSI)
npm run tauri:build
```

ឯកសារ Installer ដែលបង្កើតរួច នឹងស្ថិតនៅក្នុងថត៖
`src-tauri/target/release/bundle/nsis/`

---

## English

**KUI** is a modern, lightweight, and high-performance terminal emulator specifically optimized for **Khmer Unicode**, Complex Text Layout (CTL), and Text User Interfaces (TUI) on Windows. Built with **Tauri v2**, **Rust**, **React**, and **xterm.js**.

### ✨ Features

- **🇰🇭 Full Khmer Unicode & CTL Support:**
  - Proper subscript consonant stacking (`ជើង`) and combining vowel clusters (`ស្រៈនិស្ស័យ` and diacritics).
  - Clean character spacing without negative letter-spacing overlap or squishing.
  - Zero-width cluster joining without breaking terminal grid alignment.
  - OpenType ligatures and contextual alternates enabled (`liga`, `calt`, `clig`).
- **⚡ Blazing Fast & Lightweight:** Powered by Rust and Tauri v2 with native Windows ConPTY integration.
- **🖥️ Multi-Pane & Tabs:** Split panes horizontally or vertically, drag-adjust split ratios, and manage multiple sessions with ease.
- **🎨 Custom Theming & Typography:** Built-in modern themes (`kui-dark`, `dracula`, `nord`, `catppuccin`, `monokai`, `cyberpunk`, `one-dark`) and configurable font stacks (`JetBrains Mono`, `Kantumruy Pro`, `Noto Sans Khmer`).
- **🪟 Windows Native Experience:** Automated UTF-8 (`chcp 65001`) configuration for PowerShell, CMD, or WSL.

### 🛠️ Architecture

- **Backend:** Rust, Tauri v2, `portable-pty`
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Terminal Core:** xterm.js with custom `KhmerUnicodeAddon`
- **Packaging:** NSIS & MSI Windows Installers

### 📦 Building from Source

#### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable x86_64-pc-windows-msvc or mingw64)
- C++ Build Tools or MinGW-w64

#### Steps

```bash
# Clone the repository
git clone https://github.com/AMRSKH/KUI.git
cd KUI

# Install dependencies
npm install

# Run in development mode
npm run tauri dev

# Build Windows installer (NSIS & MSI)
npm run tauri:build
```

The compiled installer will be available under:
`src-tauri/target/release/bundle/nsis/`

---

## 📄 License

MIT License. See [LICENSE](LICENSE) for details.
