import * as path from 'path';

export function getPersonasPath(): string {
  return path.join(__dirname, 'personas');
}

export function getSysPath(): string {
  return path.join(__dirname, 'sys');
}

export function getConfigsPath(): string {
  return path.join(__dirname, 'configs');
}

// Also export as CommonJS for backward compatibility
module.exports = {
  getPersonasPath,
  getSysPath,
  getConfigsPath
};
