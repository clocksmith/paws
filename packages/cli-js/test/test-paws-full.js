/**
 * Test suite for enhanced PAWS functionality (JavaScript version)
 */

const { describe, it, before, after, beforeEach, afterEach } = require('mocha');
const { expect } = require('chai');
const sinon = require('sinon');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { v4: uuidv4 } = require('uuid');

// Import modules to test
const {
  FileChange,
  ChangeSet,
  InteractiveReviewer,
  GitVerificationHandler,
  BundleProcessor,
  FileOperation
} = require('../src/dogs');

const {
  FileTreeNode,
  ProjectAnalyzer,
  createBundle
} = require('../src/cats');

const {
  SessionStatus,
  SessionTurn,
  Session,
  SessionManager
} = require('../src/session');

/**
 * Test FileChange class
 */
describe('FileChange', () => {
  it('should create a file change', () => {
    const change = new FileChange(
      'test.js',
      FileOperation.CREATE,
      null,
      'console.log("hello");'
    );
    
    expect(change.filePath).to.equal('test.js');
    expect(change.operation).to.equal(FileOperation.CREATE);
    expect(change.status).to.equal('pending');
  });

  it('should generate diff for modifications', () => {
    const change = new FileChange(
      'test.js',
      FileOperation.MODIFY,
      'console.log("hello");',
      'console.log("world");'
    );
    
    const diff = change.getDiff();
    expect(diff).to.include('-console.log("hello");');
    expect(diff).to.include('+console.log("world");');
  });

  it('should handle delete operations', () => {
    const change = new FileChange(
      'test.js',
      FileOperation.DELETE,
      'console.log("hello");',
      null
    );
    
    const diff = change.getDiff();
    expect(diff).to.include('File will be deleted');
  });
});

/**
 * Test ChangeSet class
 */
describe('ChangeSet', () => {
  let changeSet;

  beforeEach(() => {
    changeSet = new ChangeSet();
  });

  it('should add changes', () => {
    const change = new FileChange('test.js', FileOperation.CREATE);
    changeSet.addChange(change);
    expect(changeSet.changes).to.have.lengthOf(1);
  });

  it('should filter accepted changes', () => {
    const change1 = new FileChange('test1.js', FileOperation.CREATE);
    change1.status = 'accepted';
    
    const change2 = new FileChange('test2.js', FileOperation.CREATE);
    change2.status = 'rejected';
    
    changeSet.addChange(change1);
    changeSet.addChange(change2);
    
    const accepted = changeSet.getAccepted();
    expect(accepted).to.have.lengthOf(1);
    expect(accepted[0].filePath).to.equal('test1.js');
  });

  it('should provide summary', () => {
    for (let i = 0; i < 5; i++) {
      const change = new FileChange(`test${i}.js`, FileOperation.CREATE);
      if (i < 2) change.status = 'accepted';
      else if (i < 4) change.status = 'rejected';
      changeSet.addChange(change);
    }
    
    const summary = changeSet.getSummary();
    expect(summary.total).to.equal(5);
    expect(summary.accepted).to.equal(2);
    expect(summary.rejected).to.equal(2);
    expect(summary.pending).to.equal(1);
  });
});

/**
 * Test BundleProcessor
 */
describe('BundleProcessor', () => {
  let tempDir;
  let processor;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paws-test-'));
    processor = new BundleProcessor({
      outputDir: tempDir,
      interactive: false,
      autoAccept: true
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should parse bundle content', async () => {
    const bundleContent = `
🐕 --- DOGS_START_FILE: test.js ---
\`\`\`javascript
console.log("hello world");
\`\`\`
🐕 --- DOGS_END_FILE: test.js ---
`;
    
    const changeSet = await processor.parseBundle(bundleContent);
    expect(changeSet.changes).to.have.lengthOf(1);
    
    const change = changeSet.changes[0];
    expect(change.filePath).to.equal('test.js');
    expect(change.operation).to.equal(FileOperation.CREATE);
    expect(change.newContent).to.include('console.log("hello world");');
  });

  it('should apply changes to filesystem', async () => {
    const changeSet = new ChangeSet();
    const change = new FileChange(
      'test.js',
      FileOperation.CREATE,
      null,
      'console.log("hello");'
    );
    change.status = 'accepted';
    changeSet.addChange(change);
    
    const success = await processor.applyChanges(changeSet);
    expect(success).to.be.true;
    
    const testFile = path.join(tempDir, 'test.js');
    const content = await fs.readFile(testFile, 'utf-8');
    expect(content).to.equal('console.log("hello");');
  });

  it('should handle binary files', async () => {
    const bundleContent = `
🐕 --- DOGS_START_FILE: test.bin (Content:Base64) ---
SGVsbG8gV29ybGQ=
🐕 --- DOGS_END_FILE: test.bin ---
`;
    
    const changeSet = await processor.parseBundle(bundleContent);
    expect(changeSet.changes).to.have.lengthOf(1);
    
    const change = changeSet.changes[0];
    expect(change.isBinary).to.be.true;
    expect(change.newContent).to.equal('Hello World');
  });
});

/**
 * Test ProjectAnalyzer
 */
describe('ProjectAnalyzer', () => {
  let tempDir;
  let analyzer;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paws-test-'));
    
    // Create test project structure
    await fs.mkdir(path.join(tempDir, 'src'));
    await fs.writeFile(path.join(tempDir, 'src', 'main.js'), 'console.log("main");');
    await fs.writeFile(path.join(tempDir, 'src', 'utils.js'), 'console.log("utils");');
    await fs.mkdir(path.join(tempDir, 'tests'));
    await fs.writeFile(path.join(tempDir, 'tests', 'test.js'), 'console.log("test");');
    await fs.writeFile(path.join(tempDir, '.gitignore'), 'node_modules/\n*.log');
    
    analyzer = new ProjectAnalyzer(tempDir);
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should build file tree', async () => {
    const tree = await analyzer.buildFileTree();
    
    expect(tree).to.be.instanceOf(FileTreeNode);
    expect(tree.isDir).to.be.true;
    expect(tree.path).to.equal(tempDir);
    
    const treeStr = tree.toString();
    expect(treeStr).to.include('main.js');
    expect(treeStr).to.include('utils.js');
    expect(treeStr).to.include('test.js');
  });

  it('should load gitignore patterns', async () => {
    await analyzer.loadGitignore();
    
    expect(analyzer.gitignorePatterns).to.include('node_modules');
    expect(analyzer.gitignorePatterns).to.include('*.log');
  });

  it('should check if path should be ignored', async () => {
    await analyzer.loadGitignore();
    
    const nodeModulesPath = path.join(tempDir, 'node_modules', 'package');
    const logPath = path.join(tempDir, 'debug.log');
    const srcPath = path.join(tempDir, 'src', 'main.js');
    
    expect(analyzer.shouldIgnore(nodeModulesPath)).to.be.true;
    expect(analyzer.shouldIgnore(logPath)).to.be.true;
    expect(analyzer.shouldIgnore(srcPath)).to.be.false;
  });
});

/**
 * Test FileTreeNode
 */
describe('FileTreeNode', () => {
  it('should create file node', () => {
    const node = new FileTreeNode('/path/to/file.js', false, 1024);
    
    expect(node.path).to.equal('/path/to/file.js');
    expect(node.isDir).to.be.false;
    expect(node.size).to.equal(1024);
    expect(node.children).to.be.empty;
  });

  it('should create directory node', () => {
    const node = new FileTreeNode('/path/to/dir', true);
    
    expect(node.path).to.equal('/path/to/dir');
    expect(node.isDir).to.be.true;
    expect(node.children).to.be.empty;
  });

  it('should add children', () => {
    const parent = new FileTreeNode('/parent', true);
    const child = new FileTreeNode('/parent/child.js', false);
    
    parent.addChild(child);
    expect(parent.children).to.have.lengthOf(1);
    expect(parent.children[0]).to.equal(child);
  });

  it('should convert to string representation', () => {
    const root = new FileTreeNode('/root', true);
    const srcDir = new FileTreeNode('/root/src', true);
    const file = new FileTreeNode('/root/src/main.js', false, 512);
    
    srcDir.addChild(file);
    root.addChild(srcDir);
    
    const str = root.toString();
    expect(str).to.include('root/');
    expect(str).to.include('  src/');
    expect(str).to.include('    main.js (512 bytes)');
  });
});

/**
 * Test Session and SessionTurn
 */
describe('Session', () => {
  it('should create session', () => {
    const session = new Session(
      'test123',
      'Test Session',
      '2024-01-01T00:00:00Z',
      SessionStatus.ACTIVE,
      'main',
      'abc123',
      '/tmp/workspace',
      [],
      { key: 'value' }
    );
    
    expect(session.sessionId).to.equal('test123');
    expect(session.name).to.equal('Test Session');
    expect(session.status).to.equal(SessionStatus.ACTIVE);
  });

  it('should serialize to JSON', () => {
    const turn = new SessionTurn(
      1,
      '2024-01-01T00:00:00Z',
      'test command',
      'def456'
    );
    
    const session = new Session(
      'test123',
      'Test Session',
      '2024-01-01T00:00:00Z',
      SessionStatus.ACTIVE,
      'main',
      'abc123',
      '/tmp/workspace',
      [turn]
    );
    
    const json = session.toJSON();
    expect(json.sessionId).to.equal('test123');
    expect(json.status).to.equal('active');
    expect(json.turns).to.have.lengthOf(1);
  });

  it('should deserialize from JSON', () => {
    const data = {
      sessionId: 'test123',
      name: 'Test Session',
      createdAt: '2024-01-01T00:00:00Z',
      status: 'active',
      baseBranch: 'main',
      baseCommit: 'abc123',
      workspacePath: '/tmp/workspace',
      turns: [{
        turnNumber: 1,
        timestamp: '2024-01-01T00:00:00Z',
        command: 'test command',
        commitHash: 'def456'
      }],
      metadata: { key: 'value' }
    };
    
    const session = Session.fromJSON(data);
    expect(session.sessionId).to.equal('test123');
    expect(session.status).to.equal(SessionStatus.ACTIVE);
    expect(session.turns).to.have.lengthOf(1);
    expect(session.turns[0]).to.be.instanceOf(SessionTurn);
  });
});

/**
 * Test SessionManager (requires git)
 */
describe('SessionManager', () => {
  let tempDir;
  let manager;
  let hasGit = false;

  before(async () => {
    // Check if git is available
    try {
      const simpleGit = require('simple-git');
      const git = simpleGit();
      await git.version();
      hasGit = true;
    } catch {
      hasGit = false;
    }
  });

  beforeEach(async function() {
    if (!hasGit) {
      this.skip();
      return;
    }

    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paws-test-'));
    
    // Initialize git repo
    const simpleGit = require('simple-git');
    const git = simpleGit(tempDir);
    await git.init();
    await git.addConfig('user.name', 'Test User');
    await git.addConfig('user.email', 'test@example.com');
    
    // Create initial commit
    await fs.writeFile(path.join(tempDir, 'README.md'), '# Test');
    await git.add('.');
    await git.commit('Initial commit');
    
    manager = new SessionManager(tempDir);
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should create session', async function() {
    const session = await manager.createSession('Test Session');
    
    expect(session).to.exist;
    expect(session.name).to.equal('Test Session');
    expect(session.status).to.equal(SessionStatus.ACTIVE);
    
    // Check workspace was created
    const workspaceExists = await fs.access(session.workspacePath)
      .then(() => true)
      .catch(() => false);
    expect(workspaceExists).to.be.true;
  });

  it('should list sessions', async function() {
    const session1 = await manager.createSession('Session 1');
    const session2 = await manager.createSession('Session 2');
    
    const sessions = await manager.listSessions();
    expect(sessions).to.have.lengthOf(2);
    
    // Archive one session
    await manager.archiveSession(session1.sessionId);
    
    // List only active sessions
    const activeSessions = await manager.listSessions(SessionStatus.ACTIVE);
    expect(activeSessions).to.have.lengthOf(1);
    expect(activeSessions[0].sessionId).to.equal(session2.sessionId);
  });

  it('should add turns to session', async function() {
    const session = await manager.createSession('Test Session');
    
    const turn = await manager.addTurn(session.sessionId, 'test command', {
      notes: 'Test notes'
    });
    
    expect(turn.turnNumber).to.equal(1);
    expect(turn.command).to.equal('test command');
    expect(turn.notes).to.equal('Test notes');
    
    // Reload session and check turn was saved
    const reloaded = await manager.getSession(session.sessionId);
    expect(reloaded.turns).to.have.lengthOf(1);
  });
});

/**
 * Integration tests
 */
describe('Integration', () => {
  let tempDir;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paws-test-'));
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('should complete full workflow', async () => {
    // 1. Create a bundle with changes
    const bundleContent = `
🐕 --- DOGS_START_FILE: main.js ---
function main() {
  console.log("hello world");
  return 0;
}
🐕 --- DOGS_END_FILE: main.js ---

🐕 --- DOGS_START_FILE: utils.js ---
function helper() {
  return "help";
}
🐕 --- DOGS_END_FILE: utils.js ---
`;

    // 2. Process the bundle
    const processor = new BundleProcessor({
      outputDir: tempDir,
      interactive: false,
      autoAccept: true
    });
    
    const changeSet = await processor.parseBundle(bundleContent);
    
    // 3. Accept all changes
    changeSet.changes.forEach(c => c.status = 'accepted');
    
    // 4. Apply changes
    const success = await processor.applyChanges(changeSet);
    expect(success).to.be.true;
    
    // 5. Verify files were created
    const mainJs = await fs.readFile(path.join(tempDir, 'main.js'), 'utf-8');
    const utilsJs = await fs.readFile(path.join(tempDir, 'utils.js'), 'utf-8');
    
    expect(mainJs).to.include('hello world');
    expect(utilsJs).to.include('helper');
  });

  it('should handle cats bundling', async () => {
    // Create virtual files
    const virtualFS = [
      { path: 'test1.js', content: 'console.log("test1");' },
      { path: 'test2.js', content: 'console.log("test2");' }
    ];

    // Create bundle
    const bundle = await createBundle({ virtualFS });

    expect(bundle).to.include('CATS_START_FILE: test1.js');
    expect(bundle).to.include('console.log("test1");');
    expect(bundle).to.include('CATS_END_FILE: test1.js');
    expect(bundle).to.include('CATS_START_FILE: test2.js');
    expect(bundle).to.include('console.log("test2");');
    expect(bundle).to.include('CATS_END_FILE: test2.js');
  });
});

// Run tests if called directly
if (require.main === module) {
  // Run mocha programmatically
  const Mocha = require('mocha');
  const mocha = new Mocha();
  
  mocha.addFile(__filename);
  
  mocha.run(failures => {
    process.exitCode = failures ? 1 : 0;
  });
}