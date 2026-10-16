# KUI (Khmer Terminal UI) 🚀

**KUI** is a modern, lightweight, high-performance terminal emulator specifically optimized for **Khmer Unicode**, Complex Text Layout (CTL), and Text User Interfaces (TUI). Built with **Tauri v2**, **Rust**, **React**, and **xterm.js**.

---

## ✨ Features

- **🇰🇭 Native Khmer Unicode & CTL Support:**
  - Full sub-script stacking (`ជើង`) and combining vowel clusters (`ស្រៈនិស្ស័យ` និង `សញ្ញាផ្សេងៗ`).
  - Elimination of character overlap, squishing, and negative letter-spacing bugs.
  - Zero-width cluster joining without breaking terminal cell alignment.
  - OpenType ligatures and contextual alternates enabled (`liga`, `calt`, `clig`).
- **⚡ Blazing Fast & Lightweight:** Powered by Rust and Tauri v2 with native Windows ConPTY integration.
- **🖥️ Multi-Pane & Tabs:** Split panes horizontally or vertically, drag-adjust split ratios, and manage multiple sessions with ease.
- **🎨 Custom Theming & Typography:** Built-in modern themes (`kui-dark`, `dracula`, `nord`, `catppuccin`, `monokai`, `cyberpunk`, `one-dark`) and configurable font stacks (`JetBrains Mono`, `Kantumruy Pro`, `Noto Sans Khmer`).
- **🪟 Windows Native Experience:** Automated UTF-8 (`chcp 65001`) configuration for PowerShell, CMD, or WSL.

---

## 🛠️ Architecture

- **Backend:** Rust, Tauri v2, `portable-pty`
- **Frontend:** React 18, TypeScript, Tailwind CSS, Lucide Icons
- **Terminal Core:** xterm.js with custom `KhmerUnicodeAddon`
- **Packaging:** NSIS & MSI Windows Installers

---

## 📦 Building from Source

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- [Rust](https://rustup.rs/) (stable x86_64-pc-windows-msvc or mingw64)
- C++ Build Tools or MinGW-w64

### Installation

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
