import * as path from 'path';
import * as vscode from 'vscode';

const TERMINAL_NAME = 'PAWS';
let persistentTerminal: vscode.Terminal | undefined;

function getWorkspaceRoot(): string | undefined {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  return workspace?.uri.fsPath;
}

function getTerminal(cwd?: string): vscode.Terminal {
  if (!persistentTerminal) {
    persistentTerminal = vscode.window.createTerminal({ name: TERMINAL_NAME, cwd });
  } else if (cwd) {
    persistentTerminal.dispose();
    persistentTerminal = vscode.window.createTerminal({ name: TERMINAL_NAME, cwd });
  }
  return persistentTerminal;
}

async function createContextBundle(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('Open a workspace folder to run PAWS commands.');
    return;
  }

  const output = await vscode.window.showInputBox({
    prompt: 'cats output file',
    placeHolder: 'cats.md',
    value: 'cats.md'
  });

  if (!output) {
    return;
  }

  const terminal = getTerminal(workspaceRoot);
  terminal.sendText(`npx cats -o "${output}"`);
  terminal.show(true);
  vscode.window.setStatusBarMessage(`Running cats -> ${output}`, 4000);
}

async function applyChangeBundle(): Promise<void> {
  const workspaceRoot = getWorkspaceRoot();
  if (!workspaceRoot) {
    vscode.window.showErrorMessage('Open a workspace folder to run PAWS commands.');
    return;
  }

  const defaultUri = vscode.Uri.file(path.join(workspaceRoot, 'dogs.md'));

  const selection = await vscode.window.showOpenDialog({
    title: 'Select dogs bundle',
    canSelectFiles: true,
    canSelectMany: false,
    defaultUri,
    filters: {
      Markdown: ['md'],
      All: ['*']
    }
  });

  if (!selection || selection.length === 0) {
    return;
  }

  const bundlePath = selection[0].fsPath;
  const terminal = getTerminal(workspaceRoot);
  terminal.sendText(`npx dogs "${bundlePath}"`);
  terminal.show(true);
  vscode.window.setStatusBarMessage(`Running dogs on ${path.basename(bundlePath)}`, 4000);
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('paws.createContextBundle', createContextBundle),
    vscode.commands.registerCommand('paws.applyChangeBundle', applyChangeBundle),
    vscode.window.onDidCloseTerminal((terminal) => {
      if (terminal === persistentTerminal) {
        persistentTerminal = undefined;
      }
    })
  );
}

export function deactivate(): void {
  if (persistentTerminal) {
    persistentTerminal.dispose();
    persistentTerminal = undefined;
  }
}
