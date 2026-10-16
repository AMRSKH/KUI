const path = require('path');
const os = require('os');

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
process.env.PATH = [cargoBin, mingwBin, llvmBin, process.env.PATH || ''].join(path.delimiter);

// Directly execute Tauri CLI with updated PATH
require('@tauri-apps/cli/tauri.js');
