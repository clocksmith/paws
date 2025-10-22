/**
 * Roots Manager
 *
 * Manages filesystem roots for MCP servers, providing boundary
 * coordination and automatic detection of project directories.
 */

import type { Root } from "../types/index.js";
import * as path from "path";
import * as fs from "fs/promises";

export interface RootsManagerOptions {
  /** Auto-detect roots from common patterns */
  autoDetect?: boolean;

  /** Include home directory as a root */
  includeHome?: boolean;

  /** Include current working directory as a root */
  includeCwd?: boolean;
}

export class RootsManager {
  private roots: Root[] = [];
  private listeners: Array<(roots: Root[]) => void> = [];

  constructor(private options: RootsManagerOptions = {}) {
    this.options = {
      autoDetect: true,
      includeHome: false,
      includeCwd: true,
      ...options,
    };
  }

  /**
   * Initialize roots with auto-detection
   */
  async initialize(): Promise<Root[]> {
    const roots: Root[] = [];

    // Add current working directory
    if (this.options.includeCwd) {
      const cwd = process.cwd();
      roots.push({
        uri: this.pathToUri(cwd),
        name: path.basename(cwd) || "Current Directory",
      });
    }

    // Auto-detect PAWS workspace
    if (this.options.autoDetect) {
      const pawsRoots = await this.detectPAWSWorkspace();
      roots.push(...pawsRoots);
    }

    // Add home directory
    if (this.options.includeHome) {
      const home = process.env.HOME || process.env.USERPROFILE;
      if (home) {
        roots.push({
          uri: this.pathToUri(home),
          name: "Home Directory",
        });
      }
    }

    this.roots = roots;
    this.notifyListeners();

    return roots;
  }

  /**
   * Auto-detect PAWS workspace roots
   */
  private async detectPAWSWorkspace(): Promise<Root[]> {
    const roots: Root[] = [];

    try {
      // Try to find PAWS root from current directory
      let currentDir = process.cwd();
      let pawsRoot: string | null = null;

      // Walk up directory tree to find paws
      for (let i = 0; i < 10; i++) {
        const packageJsonPath = path.join(currentDir, "package.json");

        try {
          const packageJson = await fs.readFile(packageJsonPath, "utf-8");
          const pkg = JSON.parse(packageJson);

          // Check if this is the PAWS root
          if (pkg.name === "paws" || pkg.workspaces || currentDir.endsWith("paws")) {
            pawsRoot = currentDir;
            break;
          }
        } catch {
          // Not a package.json here, continue
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          break; // Reached root
        }
        currentDir = parentDir;
      }

      if (pawsRoot) {
        // Add PAWS root
        roots.push({
          uri: this.pathToUri(pawsRoot),
          name: "PAWS Workspace",
        });

        // Add specific package roots
        const packagesDir = path.join(pawsRoot, "packages");
        try {
          const packages = await fs.readdir(packagesDir);

          for (const pkg of packages) {
            const pkgPath = path.join(packagesDir, pkg);
            const stat = await fs.stat(pkgPath);

            if (stat.isDirectory()) {
              // Add common package roots
              if (["reploid", "gamma"].includes(pkg)) {
                roots.push({
                  uri: this.pathToUri(pkgPath),
                  name: `${pkg.toUpperCase()} Package`,
                });
              }
            }
          }
        } catch {
          // Packages directory doesn't exist or can't be read
        }
      }
    } catch (error) {
      console.error(`[Roots] Error detecting PAWS workspace:`, error);
    }

    return roots;
  }

  /**
   * Add a root
   */
  addRoot(uri: string, name: string): void {
    // Check if already exists
    if (this.roots.some((r) => r.uri === uri)) {
      return;
    }

    this.roots.push({ uri, name });
    this.notifyListeners();
  }

  /**
   * Remove a root
   */
  removeRoot(uri: string): void {
    const index = this.roots.findIndex((r) => r.uri === uri);
    if (index >= 0) {
      this.roots.splice(index, 1);
      this.notifyListeners();
    }
  }

  /**
   * Get all roots
   */
  getRoots(): Root[] {
    return [...this.roots];
  }

  /**
   * Clear all roots
   */
  clearRoots(): void {
    this.roots = [];
    this.notifyListeners();
  }

  /**
   * Set roots (replaces existing)
   */
  setRoots(roots: Root[]): void {
    this.roots = [...roots];
    this.notifyListeners();
  }

  /**
   * Check if a path is within any root
   */
  isWithinRoots(filePath: string): boolean {
    const fileUri = this.pathToUri(filePath);

    return this.roots.some((root) => {
      return fileUri.startsWith(root.uri);
    });
  }

  /**
   * Get the root containing a path
   */
  getRootForPath(filePath: string): Root | null {
    const fileUri = this.pathToUri(filePath);

    for (const root of this.roots) {
      if (fileUri.startsWith(root.uri)) {
        return root;
      }
    }

    return null;
  }

  /**
   * Convert filesystem path to file:// URI
   */
  private pathToUri(filePath: string): string {
    // Normalize path
    const normalized = path.resolve(filePath);

    // Convert to URI format
    const withSlashes = normalized.replace(/\\/g, "/");

    // Add file:// protocol
    if (withSlashes.startsWith("/")) {
      return `file://${withSlashes}`;
    } else {
      // Windows paths
      return `file:///${withSlashes}`;
    }
  }

  /**
   * Convert file:// URI to filesystem path
   */
  uriToPath(uri: string): string {
    if (!uri.startsWith("file://")) {
      throw new Error(`Invalid file URI: ${uri}`);
    }

    let filePath = uri.substring(7); // Remove "file://"

    // Handle Windows paths
    if (filePath.match(/^\/[a-zA-Z]:/)) {
      filePath = filePath.substring(1); // Remove leading slash
    }

    return path.normalize(filePath);
  }

  /**
   * Register a listener for roots changes
   */
  onRootsChanged(listener: (roots: Root[]) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index >= 0) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Notify all listeners of roots change
   */
  private notifyListeners(): void {
    const roots = this.getRoots();
    for (const listener of this.listeners) {
      try {
        listener(roots);
      } catch (error) {
        console.error(`[Roots] Error in listener:`, error);
      }
    }
  }
}
