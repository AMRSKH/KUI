const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const userProfile = os.homedir();
const localAppData = process.env.LOCALAPPDATA || path.join(userProfile, 'AppData', 'Local');

const cargoBin = path.join(userProfile, '.cargo', 'bin');
const mingwBin = path.join(
  localAppData,
  'Microsoft',
  'WinGet',
  'Packages',
  'BrechtSanders.WinLibs.POSIX.UCRT_Microsoft.Winget.Source_8wekyb3d8bbwe',
  'mingw64',
  'bin'
);
const llvmBin = 'C:\\Program Files\\LLVM\\bin';

// Prepend toolchain paths to PATH
const existingPath = process.env.PATH || '';
process.env.PATH = [cargoBin, mingwBin, llvmBin, existingPath].join(path.delimiter);

// Execute Tauri CLI directly with Node
const tauriCliJs = path.join(__dirname, '..', 'node_modules', '@tauri-apps', 'cli', 'main.js');
const args = process.argv.slice(2);

const child = spawn(process.execPath, [tauriCliJs, ...args], {
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code) => {
  process.exit(code || 0);
});
