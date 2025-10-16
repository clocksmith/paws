import { describe, it, expect, vi } from 'vitest';
import fs from 'fs/promises';
import path from 'path';
import vm from 'vm';

describe('Boot Process Module Loading', () => {
  it('should not throw SyntaxError when loading modules', async () => {
    const appLogicPath = path.resolve(__dirname, '../../upgrades/app-logic.js');
    const appLogicContent = await fs.readFile(appLogicPath, 'utf-8');

    const context = { moduleFiles: [] };
    vm.createContext(context);
    const script = new vm.Script(appLogicContent);
    script.runInContext(context);

    const moduleFiles = context.moduleFiles;

    for (const modulePath of moduleFiles) {
      const fullPath = path.resolve(__dirname, `../../${modulePath.replace(/^\//, '')}`);
      const content = await fs.readFile(fullPath, 'utf-8');
      try {
        new Function(content);
      } catch (error) {
        expect(error).not.toBeInstanceOf(SyntaxError);
      }
    }
  });
});