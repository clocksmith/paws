import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

let ServerConstructor;
try {
  const module = await import('@modelcontextprotocol/server');
  ServerConstructor = module.Server || module.default;
  if (!ServerConstructor) {
    throw new Error('Missing Server export');
  }
} catch (error) {
  console.error('[PAWS MCP] Install @modelcontextprotocol/server to run this integration.');
  console.error(error.message);
  process.exit(1);
}

const server = new ServerConstructor({
  name: 'paws',
  version: '0.1.0'
});

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function runCli(binary, args = [], cwd = projectRoot) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, shell: process.platform === 'win32' });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        const error = new Error(`Command failed with exit code ${code}`);
        error.stdout = stdout;
        error.stderr = stderr;
        reject(error);
      }
    });
  });
}

async function handleCats(request = {}) {
  const { output = 'cats.md', files = [], root = projectRoot, extraArgs = [] } = request;
  const args = ['cats', '-o', output, ...extraArgs, ...files];
  const result = await runCli('npx', args, root);
  return {
    message: `cats bundle created at ${path.resolve(root, output)}`,
    stdout: result.stdout
  };
}

async function handleDogs(request = {}) {
  const { bundle = 'dogs.md', root = projectRoot, extraArgs = [] } = request;
  const bundlePath = path.isAbsolute(bundle) ? bundle : path.join(root, bundle);
  const args = ['dogs', bundlePath, ...extraArgs];
  const result = await runCli('npx', args, root);
  return {
    message: `dogs applied: ${bundlePath}`,
    stdout: result.stdout
  };
}

async function handlePaxos(request = {}) {
  const { prompt = 'Describe your goal', root = projectRoot, extraArgs = [] } = request;
  const args = ['py/paws_paxos.py', prompt, ...extraArgs];
  const result = await runCli('python', args, root);
  return {
    message: 'paxos run complete',
    stdout: result.stdout
  };
}

server.tool?.('cats', handleCats);
server.tool?.('dogs', handleDogs);
server.tool?.('paxos', handlePaxos);

if (typeof server.start === 'function') {
  server.start().catch((error) => {
    console.error('[PAWS MCP] Failed to start server:', error);
    process.exit(1);
  });
} else {
  console.error('[PAWS MCP] The loaded MCP server does not expose a start() method.');
}
