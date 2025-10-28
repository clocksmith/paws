/**
 * Bundle Manifest Generator (TypeScript)
 *
 * Generates reproducibility manifests for CATS bundles including:
 * - Bundle metadata (version, timestamps, format)
 * - Git information (commit hash, branch, remote)
 * - Environment fingerprint (Node version, OS, platform)
 * - Dependency snapshots (package.json, requirements.txt checksums)
 * - File selection criteria (patterns, AI reasoning)
 * - Provenance chain (parent bundles for deltas)
 */

import * as crypto from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execSync } from 'child_process';

// Bundle format version - increment when manifest structure changes
export const MANIFEST_VERSION = '2.0.0';

// Type Definitions

export interface GitInfo {
  commit?: string;
  shortCommit?: string;
  branch?: string;
  remote?: string | null;
  isClean?: boolean;
  commitDate?: string;
  available: boolean;
  error?: string;
}

export interface NodeEnvironment {
  version: string;
  platform: string;
  arch: string;
}

export interface OSInfo {
  type: string;
  release: string;
  platform: string;
}

export interface EnvironmentInfo {
  node: NodeEnvironment;
  os: OSInfo;
  timestamp: string;
  timezone: string;
  locale: string;
}

export interface DependencySnapshot {
  path: string;
  hash: string;
}

export interface DependencySnapshots {
  [key: string]: DependencySnapshot;
}

export interface FileSelectionCriteria {
  patterns?: string[];
  aiReasoning?: string | null;
  aiProvider?: string | null;
}

export interface FileInfo {
  path: string;
  hash?: string;
}

export interface FileSelection {
  criteria: FileSelectionCriteria | null;
  totalFiles: number;
  files: FileInfo[];
}

export interface ContextConfig {
  personaFiles: string[];
  systemPrompt: string | null;
}

export interface ProvenanceInfo {
  baseBundleId: string;
  baseBundleHash: string;
  deltaType: string;
}

export interface ReproducibilityInfo {
  instructions: string[];
  warnings: string[];
}

export interface BundleManifest {
  // Manifest metadata
  manifestVersion: string;
  bundleId: string;
  createdAt: string;

  // Bundle format
  format: 'FULL' | 'DELTA';

  // Git provenance
  git: GitInfo;

  // Environment fingerprint
  environment: EnvironmentInfo;

  // Dependency snapshots
  dependencies: DependencySnapshots;

  // File selection metadata
  fileSelection: FileSelection;

  // Context configuration
  context: ContextConfig;

  // Provenance chain (for delta bundles)
  provenance: ProvenanceInfo | null;

  // Custom metadata
  custom: Record<string, any>;

  // Reproducibility instructions
  reproducibility: ReproducibilityInfo;
}

export interface GenerateManifestOptions {
  rootPath?: string;
  bundleFormat?: 'FULL' | 'DELTA';
  fileSelectionCriteria?: FileSelectionCriteria | null;
  fileList?: string[];
  personaFiles?: string[];
  systemPrompt?: string | null;
  baseBundle?: { bundleId: string; hash: string } | null;
  customMetadata?: Record<string, any>;
}

/**
 * Compute SHA-256 hash of file content
 */
async function computeFileHash(filePath: string): Promise<string | null> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return crypto.createHash('sha256').update(content).digest('hex');
  } catch (error) {
    return null;
  }
}

/**
 * Get git information for current repository
 */
function getGitInfo(rootPath: string): GitInfo {
  try {
    const cwd = rootPath;

    // Get current commit hash
    const commitHash = execSync('git rev-parse HEAD', { cwd, encoding: 'utf-8' }).trim();

    // Get current branch
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd, encoding: 'utf-8' }).trim();

    // Get remote URL
    let remote: string | null = null;
    try {
      remote = execSync('git config --get remote.origin.url', { cwd, encoding: 'utf-8' }).trim();
    } catch {}

    // Check if working directory is clean
    const status = execSync('git status --porcelain', { cwd, encoding: 'utf-8' });
    const isClean = status.length === 0;

    // Get short commit hash
    const shortHash = execSync('git rev-parse --short HEAD', { cwd, encoding: 'utf-8' }).trim();

    // Get commit timestamp
    const commitDate = execSync('git log -1 --format=%cI', { cwd, encoding: 'utf-8' }).trim();

    return {
      commit: commitHash,
      shortCommit: shortHash,
      branch,
      remote,
      isClean,
      commitDate,
      available: true
    };
  } catch (error) {
    return {
      available: false,
      error: (error as Error).message
    };
  }
}

/**
 * Get environment fingerprint
 */
function getEnvironmentInfo(): EnvironmentInfo {
  const os = require('os');

  return {
    node: {
      version: process.version,
      platform: process.platform,
      arch: process.arch
    },
    os: {
      type: os.type(),
      release: os.release(),
      platform: process.platform
    },
    timestamp: new Date().toISOString(),
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    locale: Intl.DateTimeFormat().resolvedOptions().locale
  };
}

/**
 * Get dependency snapshots from package.json, requirements.txt, etc.
 */
async function getDependencySnapshots(rootPath: string): Promise<DependencySnapshots> {
  const snapshots: DependencySnapshots = {};

  // Check for package.json
  const packageJsonPath = path.join(rootPath, 'package.json');
  const packageJsonHash = await computeFileHash(packageJsonPath);
  if (packageJsonHash) {
    snapshots.packageJson = {
      path: 'package.json',
      hash: packageJsonHash.substring(0, 16) // Short hash
    };

    // Also check package-lock.json
    const packageLockHash = await computeFileHash(path.join(rootPath, 'package-lock.json'));
    if (packageLockHash) {
      snapshots.packageLock = {
        path: 'package-lock.json',
        hash: packageLockHash.substring(0, 16)
      };
    }

    // Check pnpm-lock.yaml
    const pnpmLockHash = await computeFileHash(path.join(rootPath, 'pnpm-lock.yaml'));
    if (pnpmLockHash) {
      snapshots.pnpmLock = {
        path: 'pnpm-lock.yaml',
        hash: pnpmLockHash.substring(0, 16)
      };
    }
  }

  // Check for requirements.txt
  const requirementsTxtPath = path.join(rootPath, 'requirements.txt');
  const requirementsTxtHash = await computeFileHash(requirementsTxtPath);
  if (requirementsTxtHash) {
    snapshots.requirementsTxt = {
      path: 'requirements.txt',
      hash: requirementsTxtHash.substring(0, 16)
    };
  }

  // Check for Pipfile
  const pipfilePath = path.join(rootPath, 'Pipfile');
  const pipfileHash = await computeFileHash(pipfilePath);
  if (pipfileHash) {
    snapshots.pipfile = {
      path: 'Pipfile',
      hash: pipfileHash.substring(0, 16)
    };

    // Check Pipfile.lock
    const pipfileLockHash = await computeFileHash(path.join(rootPath, 'Pipfile.lock'));
    if (pipfileLockHash) {
      snapshots.pipfileLock = {
        path: 'Pipfile.lock',
        hash: pipfileLockHash.substring(0, 16)
      };
    }
  }

  // Check for go.mod
  const goModPath = path.join(rootPath, 'go.mod');
  const goModHash = await computeFileHash(goModPath);
  if (goModHash) {
    snapshots.goMod = {
      path: 'go.mod',
      hash: goModHash.substring(0, 16)
    };
  }

  // Check for Cargo.toml
  const cargoTomlPath = path.join(rootPath, 'Cargo.toml');
  const cargoTomlHash = await computeFileHash(cargoTomlPath);
  if (cargoTomlHash) {
    snapshots.cargoToml = {
      path: 'Cargo.toml',
      hash: cargoTomlHash.substring(0, 16)
    };

    // Check Cargo.lock
    const cargoLockHash = await computeFileHash(path.join(rootPath, 'Cargo.lock'));
    if (cargoLockHash) {
      snapshots.cargoLock = {
        path: 'Cargo.lock',
        hash: cargoLockHash.substring(0, 16)
      };
    }
  }

  return snapshots;
}

/**
 * Generate unique bundle ID
 */
export function generateBundleId(): string {
  // Format: CATS-{timestamp}-{random}
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(4).toString('hex');
  return `CATS-${timestamp}-${random}`;
}

/**
 * Generate complete bundle manifest
 */
export async function generateManifest(options: GenerateManifestOptions = {}): Promise<BundleManifest> {
  const {
    rootPath = process.cwd(),
    bundleFormat = 'FULL',
    fileSelectionCriteria = null,
    fileList = [],
    personaFiles = [],
    systemPrompt = null,
    baseBundle = null,
    customMetadata = {}
  } = options;

  const bundleId = generateBundleId();
  const gitInfo = getGitInfo(rootPath);
  const envInfo = getEnvironmentInfo();
  const depSnapshots = await getDependencySnapshots(rootPath);

  const manifest: BundleManifest = {
    // Manifest metadata
    manifestVersion: MANIFEST_VERSION,
    bundleId,
    createdAt: new Date().toISOString(),

    // Bundle format
    format: bundleFormat,

    // Git provenance
    git: gitInfo,

    // Environment fingerprint
    environment: envInfo,

    // Dependency snapshots
    dependencies: depSnapshots,

    // File selection metadata
    fileSelection: {
      criteria: fileSelectionCriteria,
      totalFiles: fileList.length,
      files: fileList.map(f => ({
        path: f
        // We'll compute hashes later if needed
      }))
    },

    // Context configuration
    context: {
      personaFiles: personaFiles.map(p => path.basename(p)),
      systemPrompt: systemPrompt ? path.basename(systemPrompt) : null
    },

    // Provenance chain (for delta bundles)
    provenance: baseBundle ? {
      baseBundleId: baseBundle.bundleId,
      baseBundleHash: baseBundle.hash,
      deltaType: 'incremental'
    } : null,

    // Custom metadata
    custom: customMetadata,

    // Reproducibility instructions
    reproducibility: {
      instructions: [
        '1. Checkout git commit: ' + (gitInfo.available ? gitInfo.commit : 'N/A'),
        '2. Verify dependencies match snapshots above',
        '3. Use same Node.js version: ' + process.version,
        '4. Run cats with same file selection criteria'
      ],
      warnings: gitInfo.available && !gitInfo.isClean
        ? ['Working directory was not clean at bundle creation - uncommitted changes may be included']
        : []
    }
  };

  return manifest;
}

/**
 * Serialize manifest as YAML-style comment block for bundle header
 */
export function serializeManifestAsComments(manifest: BundleManifest): string {
  const lines: string[] = [];

  lines.push('# ============================================================');
  lines.push('# PAWS BUNDLE MANIFEST');
  lines.push('# Reproducibility metadata for this context bundle');
  lines.push('# ============================================================');
  lines.push('');
  lines.push(`# Bundle ID: ${manifest.bundleId}`);
  lines.push(`# Manifest Version: ${manifest.manifestVersion}`);
  lines.push(`# Created: ${manifest.createdAt}`);
  lines.push(`# Format: ${manifest.format}`);
  lines.push('');

  // Git information
  if (manifest.git.available) {
    lines.push('# --- Git Provenance ---');
    lines.push(`# Commit: ${manifest.git.commit}`);
    lines.push(`# Short Commit: ${manifest.git.shortCommit}`);
    lines.push(`# Branch: ${manifest.git.branch}`);
    if (manifest.git.remote) {
      lines.push(`# Remote: ${manifest.git.remote}`);
    }
    lines.push(`# Working Dir Clean: ${manifest.git.isClean ? 'Yes' : 'No'}`);
    lines.push(`# Commit Date: ${manifest.git.commitDate}`);
    lines.push('');
  } else {
    lines.push('# --- Git Provenance ---');
    lines.push('# Git: Not available (not a git repository)');
    lines.push('');
  }

  // Environment
  lines.push('# --- Environment ---');
  lines.push(`# Node: ${manifest.environment.node.version}`);
  lines.push(`# Platform: ${manifest.environment.node.platform} (${manifest.environment.node.arch})`);
  lines.push(`# OS: ${manifest.environment.os.type} ${manifest.environment.os.release}`);
  lines.push(`# Timezone: ${manifest.environment.timezone}`);
  lines.push('');

  // Dependencies
  if (Object.keys(manifest.dependencies).length > 0) {
    lines.push('# --- Dependency Snapshots ---');
    for (const [key, dep] of Object.entries(manifest.dependencies)) {
      lines.push(`# ${dep.path}: ${dep.hash}`);
    }
    lines.push('');
  }

  // File selection
  if (manifest.fileSelection.criteria) {
    lines.push('# --- File Selection ---');
    const criteria = manifest.fileSelection.criteria;
    if (criteria.patterns) {
      lines.push(`# Patterns: ${JSON.stringify(criteria.patterns)}`);
    }
    if (criteria.aiReasoning) {
      lines.push('# AI Curation: Yes');
      lines.push(`# AI Provider: ${criteria.aiProvider || 'unknown'}`);
      lines.push(`# AI Reasoning: ${criteria.aiReasoning.substring(0, 100)}...`);
    }
    lines.push(`# Total Files: ${manifest.fileSelection.totalFiles}`);
    lines.push('');
  }

  // Context
  if (manifest.context.personaFiles.length > 0 || manifest.context.systemPrompt) {
    lines.push('# --- Context Configuration ---');
    if (manifest.context.personaFiles.length > 0) {
      lines.push(`# Personas: ${manifest.context.personaFiles.join(', ')}`);
    }
    if (manifest.context.systemPrompt) {
      lines.push(`# System Prompt: ${manifest.context.systemPrompt}`);
    }
    lines.push('');
  }

  // Provenance chain
  if (manifest.provenance) {
    lines.push('# --- Provenance Chain ---');
    lines.push(`# Base Bundle: ${manifest.provenance.baseBundleId}`);
    lines.push(`# Base Bundle Hash: ${manifest.provenance.baseBundleHash}`);
    lines.push(`# Delta Type: ${manifest.provenance.deltaType}`);
    lines.push('');
  }

  // Reproducibility
  if (manifest.reproducibility.warnings.length > 0) {
    lines.push('# --- WARNINGS ---');
    for (const warning of manifest.reproducibility.warnings) {
      lines.push(`# ⚠️  ${warning}`);
    }
    lines.push('');
  }

  lines.push('# --- Reproducibility Instructions ---');
  for (const instruction of manifest.reproducibility.instructions) {
    lines.push(`# ${instruction}`);
  }
  lines.push('');
  lines.push('# ============================================================');
  lines.push('');

  return lines.join('\n');
}

/**
 * Parse manifest from bundle header comments
 */
export function parseManifestFromBundle(bundleContent: string): Partial<BundleManifest> {
  const lines = bundleContent.split('\n');
  const manifest: Partial<BundleManifest> = {
    bundleId: undefined,
    manifestVersion: undefined,
    createdAt: undefined,
    format: undefined,
    git: {} as GitInfo,
    environment: {} as EnvironmentInfo,
    dependencies: {},
    fileSelection: {} as FileSelection,
    context: {} as ContextConfig,
    provenance: null
  };

  for (const line of lines) {
    if (!line.startsWith('#')) {
      // End of header comments
      break;
    }

    // Parse key-value pairs from comments
    const match = line.match(/^#\s+([^:]+):\s+(.+)$/);
    if (match) {
      const [, key, value] = match;

      // Map to manifest fields
      switch (key.trim()) {
        case 'Bundle ID':
          manifest.bundleId = value.trim();
          break;
        case 'Manifest Version':
          manifest.manifestVersion = value.trim();
          break;
        case 'Created':
          manifest.createdAt = value.trim();
          break;
        case 'Format':
          manifest.format = value.trim() as 'FULL' | 'DELTA';
          break;
        case 'Commit':
          if (manifest.git) manifest.git.commit = value.trim();
          break;
        case 'Branch':
          if (manifest.git) manifest.git.branch = value.trim();
          break;
        // Add more parsing as needed
      }
    }
  }

  return manifest;
}
