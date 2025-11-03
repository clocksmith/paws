// REPLOID State Export Tool
// Run this in browser console to export entire REPLOID state

async function exportREPLOIDState() {
  console.log('[Export] Starting REPLOID state export...');

  if (!window.REPLOID || !window.REPLOID.vfs) {
    console.error('[Export] REPLOID not initialized. Wait for boot to complete.');
    return null;
  }

  const vfs = window.REPLOID.vfs;
  const agentLoop = window.REPLOID.agentLoop;

  try {
    // Export VFS (all files)
    console.log('[Export] Exporting VFS files...');
    const allFiles = await vfs.getAllFiles();

    // Export agent context (if available)
    let agentContext = null;
    if (agentLoop && agentLoop.getContext) {
      console.log('[Export] Exporting agent context...');
      agentContext = agentLoop.getContext();
    }

    // Get agent log (conversation history)
    let agentLog = [];
    if (window.REPLOID.agentLog && window.REPLOID.agentLog.messages) {
      console.log('[Export] Exporting agent log...');
      agentLog = window.REPLOID.agentLog.messages;
    }

    // Build export package
    const exportData = {
      timestamp: Date.now(),
      date: new Date().toISOString(),
      version: '1.0.0',

      vfs: {
        fileCount: allFiles.length,
        totalSize: allFiles.reduce((sum, f) => sum + (f.size || 0), 0),
        files: allFiles.map(f => ({
          path: f.path,
          content: f.content,
          size: f.size,
          timestamp: f.timestamp
        }))
      },

      agent: {
        context: agentContext,
        contextLength: agentContext ? agentContext.length : 0,
        log: agentLog,
        logLength: agentLog.length
      },

      tools: {
        registered: window.REPLOID.toolRunner ?
          Array.from(window.REPLOID.toolRunner.list().tools || []) : []
      }
    };

    console.log(`[Export] Export complete:
  - ${exportData.vfs.fileCount} files (${(exportData.vfs.totalSize / 1024).toFixed(2)} KB)
  - ${exportData.agent.contextLength} context messages
  - ${exportData.agent.logLength} log entries
  - ${exportData.tools.registered.length} tools registered`);

    return exportData;

  } catch (error) {
    console.error('[Export] Export failed:', error);
    throw error;
  }
}

async function downloadREPLOIDState(filename = null) {
  const exportData = await exportREPLOIDState();
  if (!exportData) return;

  const fileName = filename || `reploid-export-${Date.now()}.json`;
  const json = JSON.stringify(exportData, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();

  URL.revokeObjectURL(url);
  console.log(`[Export] Downloaded to: ${fileName}`);
}

// Quick commands for console
window.exportREPLOID = exportREPLOIDState;
window.downloadREPLOID = downloadREPLOIDState;

console.log(`
╔════════════════════════════════════════════════════════╗
║         REPLOID State Export Tool Loaded              ║
╠════════════════════════════════════════════════════════╣
║                                                        ║
║  Commands:                                            ║
║    await exportREPLOID()     - Export to console     ║
║    await downloadREPLOID()   - Download JSON file    ║
║                                                        ║
║  Example:                                             ║
║    await downloadREPLOID('my-export.json')           ║
║                                                        ║
╚════════════════════════════════════════════════════════╝
`);
