import * as path from 'path';

// __dirname points to dist/ when compiled, so go up one level to package root
const PACKAGE_ROOT = path.join(__dirname, '..');

export function getPersonasPath(): string {
  return path.join(PACKAGE_ROOT, 'personas');
}

export function getSysPath(): string {
  return path.join(PACKAGE_ROOT, 'sys');
}

export function getConfigsPath(): string {
  return path.join(PACKAGE_ROOT, 'configs');
}

// Also export as CommonJS for backward compatibility
module.exports = {
  getPersonasPath,
  getSysPath,
  getConfigsPath
};
