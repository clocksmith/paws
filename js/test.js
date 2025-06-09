🐕 --- DOGS_START_FILE: js/test/test_paws.js ---
const { expect } = require('chai');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');

// Import the library functions to test the API directly
const { createBundle } = require('../cats.js');
const { extractBundle } = require('../dogs.js');

// Resolve paths to the CLI scripts
const catsCliPath = path.resolve(__dirname, '..', 'cats.js');
const dogsCliPath = path.resolve(__dirname, '..', 'dogs.js');

/**
 * Helper function to run a CLI command and return its output.
 * @param {string} command The full command to execute.
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function runCli(command) {
    return new Promise((resolve, reject) => {
        exec(command, (error, stdout, stderr) => {
            // For tests, we often expect non-zero exit codes (e.g., for --help or arg errors).
            // Only reject on unexpected high error codes.
            if (error && error.code > 1) {
                return reject(new Error(`Command failed with code ${error.code}:\n${stderr}`));
            }
            resolve({ stdout, stderr });
        });
    });
}

describe('PAWS for Node.js', function() {
    this.timeout(5000); // Set a longer timeout for file system and child process operations

    let tempDir;

    // Create a temporary directory with a dummy project structure before each test
    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'paws-js-test-'));
        await fs.mkdir(path.join(tempDir, 'src', 'api'), { recursive: true });
        await fs.writeFile(path.join(tempDir, 'src', 'main.js'), 'console.log("main");');
        await fs.writeFile(path.join(tempDir, 'src', 'api', 'v1.js'), '// API v1');
        await fs.writeFile(path.join(tempDir, 'README.md'), '# Project');
        await fs.writeFile(path.join(tempDir, '.gitignore'), 'node_modules\n.env');
    });

    // Clean up the temporary directory after each test
    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    describe('cats.js', () => {
        it('CLI should bundle files using glob patterns and respect excludes', async () => {
            const command = `node ${catsCliPath} "${path.join(tempDir, 'src/**/*.js')}" -x "${path.join(tempDir, 'src/api/**')}" -o - -q`;
            const { stdout } = await runCli(command);

            expect(stdout).to.include('--- CATS_START_FILE: src/main.js ---');
            expect(stdout).to.not.include('src/api/v1.js');
            expect(stdout).to.not.include('README.md');
        });

        it('CLI should respect default excludes and the -N flag', async () => {
            // Test with default excludes active
            let command = `node ${catsCliPath} "${path.join(tempDir, '*')}" "${path.join(tempDir, '.*')}" -o - -q`;
            let { stdout } = await runCli(command);
            expect(stdout).to.not.include('.gitignore');

            // Test with -N to disable default excludes
            command = `node ${catsCliPath} "${path.join(tempDir, '.gitignore')}" -N -o - -q`;
            ({ stdout } = await runCli(command));
            expect(stdout).to.include('--- CATS_START_FILE: .gitignore ---');
        });

        it('CLI should prepend persona and sysprompt files in the correct order', async () => {
            await fs.writeFile(path.join(tempDir, 'persona.md'), 'PERSONA_CONTENT');
            await fs.writeFile(path.join(tempDir, 'system.md'), 'SYSTEM_PROMPT_CONTENT');

            const command = `node ${catsCliPath} "${path.join(tempDir, 'README.md')}" -p "${path.join(tempDir, 'persona.md')}" -s "${path.join(tempDir, 'system.md')}" -o - -q`;
            const { stdout } = await runCli(command);

            expect(stdout).to.match(/^(\r\n|\n|\r)--- START PERSONA ---/);
            expect(stdout).to.include('PERSONA_CONTENT');
            expect(stdout).to.include('--- END PREPENDED INSTRUCTIONS ---');
            expect(stdout).to.include('SYSTEM_PROMPT_CONTENT');
            expect(stdout.indexOf('PERSONA_CONTENT')).to.be.lessThan(stdout.indexOf('SYSTEM_PROMPT_CONTENT'));
            expect(stdout.indexOf('SYSTEM_PROMPT_CONTENT')).to.be.lessThan(stdout.indexOf('README.md'));
        });

        it('API should create a bundle from a virtual file system', async () => {
            const virtualFS = [
                { path: 'app.js', content: 'let x = 1;' },
                { path: 'assets/logo.png', content: Buffer.from([1, 2, 3, 0]) } // Add null byte for binary detection
            ];

            const bundleString = await createBundle({ virtualFS });

            expect(bundleString).to.include('--- CATS_START_FILE: app.js ---');
            expect(bundleString).to.include('let x = 1;');
            expect(bundleString).to.include('--- CATS_START_FILE: assets/logo.png (Content:Base64) ---');
            expect(bundleString).to.include(Buffer.from([1, 2, 3, 0]).toString('base64'));
        });
    });

    describe('dogs.js', () => {
        it('CLI should extract files and create directories correctly', async () => {
            const bundlePath = path.join(tempDir, 'test.bundle');
            const outputPath = path.join(tempDir, 'output');
            const bundleContent = `
🐕 --- DOGS_START_FILE: new/nested/dir/test.js ---
console.log("extracted");
🐕 --- DOGS_END_FILE: new/nested/dir/test.js ---
            `;
            await fs.writeFile(bundlePath, bundleContent);

            const command = `node ${dogsCliPath} "${bundlePath}" "${outputPath}" -y -q`;
            await runCli(command);

            const extractedContent = await fs.readFile(path.join(outputPath, 'new/nested/dir/test.js'), 'utf-8');
            expect(extractedContent.trim()).to.equal('console.log("extracted");');
        });

        it('CLI should correctly handle the DELETE_FILE command', async () => {
            const fileToDeletePath = path.join(tempDir, 'delete_me.txt');
            await fs.writeFile(fileToDeletePath, 'some data');

            const bundlePath = path.join(tempDir, 'delete.bundle');
            const bundleContent = `
🐕 --- DOGS_START_FILE: delete_me.txt ---
@@ PAWS_CMD DELETE_FILE() @@
🐕 --- DOGS_END_FILE: delete_me.txt ---
            `;
            await fs.writeFile(bundlePath, bundleContent);

            const command = `node ${dogsCliPath} "${bundlePath}" "${tempDir}" -y -q`;
            await runCli(command);

            // Using fs.access and expecting it to throw is the standard way to check for non-existence
            await expect(fs.access(fileToDeletePath)).to.be.rejectedWith(Error);
        });

        it('API should robustly parse a bundle with LLM chatter and artifacts', async () => {
            const bundleContent = `
Hello! As requested, here are the file modifications.

\`\`\`
🐕 --- DOGS_START_FILE: src/app.js ---
\`\`\`javascript
const app = {}; // Main app object
\`\`\`
🐕 --- DOGS_END_FILE: src/app.js ---
\`\`\`

Let me know if you need anything else!
            `;

            const extractedFiles = await extractBundle({ bundleContent });

            expect(extractedFiles).to.have.lengthOf(1);
            expect(extractedFiles[0].path).to.equal('src/app.js');
            expect(extractedFiles[0].contentBytes.toString().trim()).to.equal('const app = {}; // Main app object');
        });

        it('API should correctly apply complex delta changes to a file', async () => {
            const originalBundleContent = `
🐈 --- CATS_START_FILE: main.js ---
line 1
line 2 OLD
line 3
line 4 to be deleted
line 5
🐈 --- CATS_END_FILE: main.js ---
            `;
            const deltaBundleContent = `
🐕 --- DOGS_START_FILE: main.js ---
@@ PAWS_CMD INSERT_AFTER_LINE(1) @@
line 1.5 INSERTED
@@ PAWS_CMD REPLACE_LINES(2, 2) @@
line 2 NEW
@@ PAWS_CMD DELETE_LINES(4, 4) @@
🐕 --- DOGS_END_FILE: main.js ---
            `;

            const resultFiles = await extractBundle({ bundleContent: deltaBundleContent, originalBundleContent });
            const finalContent = resultFiles[0].contentBytes.toString();

            const expectedContent = [
                'line 1',
                'line 1.5 INSERTED',
                'line 2 NEW',
                'line 3',
                'line 5'
            ].join('\n');

            expect(finalContent).to.equal(expectedContent);
        });
    });

    describe('Full Workflow Integration', () => {
        it('should correctly process a project from cats -> dogs with deltas', async () => {
            // 1. Run cats.js CLI to create a reference bundle
            const refBundlePath = path.join(tempDir, 'ref.bundle');
            let command = `node ${catsCliPath} "${tempDir}" -t -o "${refBundlePath}" -q`;
            await runCli(command);
            expect(await fs.access(refBundlePath).then(() => true)).to.be.true;

            // 2. Define a delta bundle from a simulated LLM
            const deltaBundlePath = path.join(tempDir, 'delta.bundle');
            const deltaBundleContent = `
🐕 --- DOGS_START_FILE: src/main.js ---
@@ PAWS_CMD REPLACE_LINES(1, 1) @@
console.log("main MODIFIED");
🐕 --- DOGS_END_FILE: src/main.js ---

🐕 --- DOGS_START_FILE: src/new_feature.js ---
export const newFeature = true;
🐕 --- DOGS_END_FILE: src/new_feature.js ---

🐕 --- DOGS_START_FILE: src/api/v1.js ---
@@ PAWS_CMD DELETE_FILE() @@
🐕 --- DOGS_END_FILE: src/api/v1.js ---
            `;
            await fs.writeFile(deltaBundlePath, deltaBundleContent);

            // 3. Run dogs.js CLI to apply the deltas to the original project directory
            command = `node ${dogsCliPath} "${deltaBundlePath}" "${tempDir}" -d "${refBundlePath}" -y -q`;
            await runCli(command);

            // 4. Assert the final state of the file system
            const modifiedMain = await fs.readFile(path.join(tempDir, 'src/main.js'), 'utf-8');
            expect(modifiedMain.trim()).to.equal('console.log("main MODIFIED");');

            const newFeature = await fs.readFile(path.join(tempDir, 'src/new_feature.js'), 'utf-8');
            expect(newFeature.trim()).to.equal('export const newFeature = true;');
            
            await expect(fs.access(path.join(tempDir, 'src/api/v1.js'))).to.be.rejectedWith(Error);
        });
    });
});
🐕 --- DOGS_END_FILE: js/test/test_paws.js ---