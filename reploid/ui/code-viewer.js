// Code Viewer Panel - Shows evolved code in real-time with export/load capabilities

const CodeViewer = {
  init: (vfs, toolRunner, agentLoop) => {
    const container = createContainer();
    const agentContainer = document.getElementById('agent-container');
    if (agentContainer) {
      agentContainer.appendChild(container);
    } else {
      // If agent container doesn't exist yet, append to body
      document.body.appendChild(container);
    }

    let currentView = 'files'; // 'files', 'tools', 'snapshots'
    let selectedFile = null;

    // Create the code viewer UI
    function createContainer() {
      const panel = document.createElement('div');
      panel.id = 'code-viewer-panel';
      panel.style.cssText = `
        position: fixed;
        right: 0;
        top: 0;
        width: 400px;
        height: 100vh;
        background: #0f0f0f;
        border-left: 1px solid #333;
        display: flex;
        flex-direction: column;
        z-index: 1000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;

      panel.innerHTML = `
        <div style="padding: 15px; border-bottom: 1px solid #333; display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; color: #0ff; font-size: 16px;">Code Viewer</h3>
          <button id="toggle-code-viewer" style="padding: 4px 12px; background: #333; color: #fff; border: 1px solid #555; cursor: pointer; border-radius: 3px;">◀</button>
        </div>

        <div style="display: flex; gap: 8px; padding: 10px; border-bottom: 1px solid #333; background: #0a0a0a;">
          <button class="view-tab active" data-view="files" style="flex: 1; padding: 8px; background: #1a5f5f; color: #0ff; border: 1px solid #0ff; cursor: pointer; border-radius: 3px; font-size: 12px;">Files</button>
          <button class="view-tab" data-view="tools" style="flex: 1; padding: 8px; background: #333; color: #fff; border: 1px solid #555; cursor: pointer; border-radius: 3px; font-size: 12px;">Tools</button>
          <button class="view-tab" data-view="snapshots" style="flex: 1; padding: 8px; background: #333; color: #fff; border: 1px solid #555; cursor: pointer; border-radius: 3px; font-size: 12px;">Snapshots</button>
        </div>

        <div id="code-viewer-content" style="flex: 1; overflow-y: auto; padding: 15px;">
          <!-- Content will be loaded here -->
        </div>

        <div style="padding: 15px; border-top: 1px solid #333; display: flex; gap: 8px;">
          <button id="export-code-btn" style="flex: 1; padding: 10px; background: #1a5f1a; color: #0f0; border: 1px solid #0f0; cursor: pointer; border-radius: 3px; font-size: 12px; font-weight: bold;" disabled>↓ Export</button>
          <button id="load-code-btn" style="flex: 1; padding: 10px; background: #1a1a5f; color: #88f; border: 1px solid #88f; cursor: pointer; border-radius: 3px; font-size: 12px; font-weight: bold;" disabled>⟳ Load to Agent</button>
        </div>
      `;

      return panel;
    }

    // Toggle panel visibility
    const toggleBtn = container.querySelector('#toggle-code-viewer');
    let isOpen = false;
    toggleBtn.addEventListener('click', () => {
      isOpen = !isOpen;
      container.style.transform = isOpen ? 'translateX(0)' : 'translateX(100%)';
      toggleBtn.textContent = isOpen ? '▶' : '◀';
    });

    // View tabs
    const viewTabs = container.querySelectorAll('.view-tab');
    viewTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        currentView = tab.dataset.view;
        viewTabs.forEach(t => {
          t.style.background = '#333';
          t.style.color = '#fff';
          t.style.borderColor = '#555';
          t.classList.remove('active');
        });
        tab.style.background = '#1a5f5f';
        tab.style.color = '#0ff';
        tab.style.borderColor = '#0ff';
        tab.classList.add('active');
        refreshView();
      });
    });

    // Refresh the current view
    async function refreshView() {
      const content = container.querySelector('#code-viewer-content');
      selectedFile = null;
      updateActionButtons();

      try {
        if (currentView === 'files') {
          await renderFilesView(content);
        } else if (currentView === 'tools') {
          await renderToolsView(content);
        } else if (currentView === 'snapshots') {
          await renderSnapshotsView(content);
        }
      } catch (error) {
        content.innerHTML = `<div style="color: #f00; padding: 10px;">Error: ${error.message}</div>`;
      }
    }

    // Render files view
    async function renderFilesView(content) {
      const files = await vfs.list('/');

      let html = '<div style="font-size: 12px;">';
      html += '<div style="margin-bottom: 15px; padding: 10px; background: #1a1a1a; border: 1px solid #333; border-radius: 3px;">';
      html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 8px;">Virtual File System</div>';
      html += `<div style="color: #888; font-size: 11px;">${files.length} file(s)</div>`;
      html += '</div>';

      if (files.length === 0) {
        html += '<div style="color: #888; padding: 20px; text-align: center;">No files yet</div>';
      } else {
        // Group files by directory
        const grouped = {};
        files.forEach(file => {
          const parts = file.split('/');
          const dir = parts.length > 2 ? '/' + parts[1] : '/';
          if (!grouped[dir]) grouped[dir] = [];
          grouped[dir].push(file);
        });

        Object.keys(grouped).sort().forEach(dir => {
          html += `<div style="margin-bottom: 10px;">`;
          html += `<div style="color: #ff0; font-weight: bold; margin-bottom: 5px; font-size: 11px;">📁 ${dir}</div>`;
          grouped[dir].forEach(file => {
            const filename = file.split('/').pop();
            const isBackup = filename.includes('.backup');
            html += `<div class="file-item" data-path="${file}" style="padding: 6px; margin: 2px 0; cursor: pointer; background: #1a1a1a; border: 1px solid #333; border-radius: 2px; color: ${isBackup ? '#888' : '#fff'}; font-size: 11px; hover: background: #2a2a2a;">`;
            html += `  <span style="color: ${isBackup ? '#666' : '#0f0'};">📄</span> ${filename}`;
            html += `</div>`;
          });
          html += `</div>`;
        });
      }

      html += '</div>';
      content.innerHTML = html;

      // Add click handlers
      content.querySelectorAll('.file-item').forEach(item => {
        item.addEventListener('click', async () => {
          const path = item.dataset.path;
          await selectFile(path, content);
        });
      });
    }

    // Select and display a file
    async function selectFile(path, content) {
      selectedFile = path;
      const code = await vfs.read(path);

      // Highlight selected item
      content.querySelectorAll('.file-item').forEach(item => {
        item.style.background = '#1a1a1a';
        item.style.borderColor = '#333';
      });
      const selectedItem = content.querySelector(`[data-path="${path}"]`);
      if (selectedItem) {
        selectedItem.style.background = '#2a3f3f';
        selectedItem.style.borderColor = '#0ff';
      }

      // Show code preview
      const preview = document.createElement('div');
      preview.style.cssText = 'margin-top: 15px; padding: 10px; background: #000; border: 1px solid #0ff; border-radius: 3px; max-height: 300px; overflow-y: auto;';
      preview.innerHTML = `
        <div style="color: #0ff; font-weight: bold; margin-bottom: 8px; font-size: 11px;">${path}</div>
        <pre style="margin: 0; font-size: 10px; color: #0f0; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(code)}</pre>
      `;

      // Remove old preview
      const oldPreview = content.querySelector('.code-preview');
      if (oldPreview) oldPreview.remove();
      preview.className = 'code-preview';
      content.appendChild(preview);

      updateActionButtons();
    }

    // Render tools view
    async function renderToolsView(content) {
      const toolsList = await toolRunner.call('list_tools', {});
      const tools = toolsList.tools || [];

      let html = '<div style="font-size: 12px;">';
      html += '<div style="margin-bottom: 15px; padding: 10px; background: #1a1a1a; border: 1px solid #333; border-radius: 3px;">';
      html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 8px;">Registered Tools</div>';
      html += `<div style="color: #888; font-size: 11px;">${tools.length} tool(s)</div>`;
      html += '</div>';

      if (tools.length === 0) {
        html += '<div style="color: #888; padding: 20px; text-align: center;">No tools created yet</div>';
      } else {
        // Group by type
        const builtIn = tools.filter(t => t.type === 'built-in');
        const dynamic = tools.filter(t => t.type === 'dynamic');

        if (dynamic.length > 0) {
          html += `<div style="margin-bottom: 15px;">`;
          html += `<div style="color: #0f0; font-weight: bold; margin-bottom: 8px; font-size: 11px;">⚡ Dynamic Tools (${dynamic.length})</div>`;
          dynamic.forEach(tool => {
            html += `<div class="tool-item" data-name="${tool.name}" style="padding: 8px; margin: 3px 0; cursor: pointer; background: #1a1a1a; border: 1px solid #333; border-radius: 2px; font-size: 11px;">`;
            html += `  <div style="color: #0f0; font-weight: bold;">${tool.name}</div>`;
            html += `</div>`;
          });
          html += `</div>`;
        }

        if (builtIn.length > 0) {
          html += `<div>`;
          html += `<div style="color: #888; font-weight: bold; margin-bottom: 8px; font-size: 11px;">🔧 Built-in Tools (${builtIn.length})</div>`;
          builtIn.forEach(tool => {
            html += `<div style="padding: 6px; margin: 2px 0; background: #0a0a0a; border: 1px solid #222; border-radius: 2px; color: #666; font-size: 10px;">`;
            html += `  ${tool.name}`;
            html += `</div>`;
          });
          html += `</div>`;
        }
      }

      html += '</div>';
      content.innerHTML = html;

      // Add click handlers for dynamic tools
      content.querySelectorAll('.tool-item').forEach(item => {
        item.addEventListener('click', async () => {
          const name = item.dataset.name;
          await selectTool(name, content);
        });
      });
    }

    // Select and display a tool
    async function selectTool(name, content) {
      const result = await toolRunner.call('get_tool_source', { name });
      selectedFile = `/tools/${name}.js`;

      // Highlight selected item
      content.querySelectorAll('.tool-item').forEach(item => {
        item.style.background = '#1a1a1a';
        item.style.borderColor = '#333';
      });
      const selectedItem = content.querySelector(`[data-name="${name}"]`);
      if (selectedItem) {
        selectedItem.style.background = '#2a3f3f';
        selectedItem.style.borderColor = '#0ff';
      }

      // Show code preview
      const preview = document.createElement('div');
      preview.style.cssText = 'margin-top: 15px; padding: 10px; background: #000; border: 1px solid #0ff; border-radius: 3px; max-height: 300px; overflow-y: auto;';
      preview.innerHTML = `
        <div style="color: #0ff; font-weight: bold; margin-bottom: 8px; font-size: 11px;">${name}</div>
        <pre style="margin: 0; font-size: 10px; color: #0f0; white-space: pre-wrap; word-wrap: break-word;">${escapeHtml(result.source)}</pre>
      `;

      // Remove old preview
      const oldPreview = content.querySelector('.code-preview');
      if (oldPreview) oldPreview.remove();
      preview.className = 'code-preview';
      content.appendChild(preview);

      updateActionButtons();
    }

    // Render snapshots view
    async function renderSnapshotsView(content) {
      const snapshots = await vfs.getSnapshots();

      let html = '<div style="font-size: 12px;">';
      html += '<div style="margin-bottom: 15px; padding: 10px; background: #1a1a1a; border: 1px solid #333; border-radius: 3px;">';
      html += '<div style="color: #0ff; font-weight: bold; margin-bottom: 8px;">VFS Snapshots</div>';
      html += `<div style="color: #888; font-size: 11px;">${snapshots.length} snapshot(s)</div>`;
      html += '<button id="create-snapshot-btn" style="margin-top: 8px; padding: 6px 12px; background: #1a5f1a; color: #0f0; border: 1px solid #0f0; cursor: pointer; border-radius: 3px; font-size: 11px; width: 100%;">+ Create Snapshot</button>';
      html += '</div>';

      if (snapshots.length === 0) {
        html += '<div style="color: #888; padding: 20px; text-align: center;">No snapshots yet</div>';
      } else {
        snapshots.reverse().forEach(snapshot => {
          const date = new Date(snapshot.timestamp).toLocaleString();
          html += `<div class="snapshot-item" data-id="${snapshot.id}" style="padding: 10px; margin: 5px 0; background: #1a1a1a; border: 1px solid #333; border-radius: 3px; cursor: pointer;">`;
          html += `  <div style="color: #ff0; font-weight: bold; font-size: 11px;">${snapshot.label || 'Unnamed'}</div>`;
          html += `  <div style="color: #888; font-size: 10px; margin-top: 4px;">${date}</div>`;
          html += `  <div style="color: #666; font-size: 10px; margin-top: 2px;">${snapshot.fileCount || 0} files</div>`;
          html += `</div>`;
        });
      }

      html += '</div>';
      content.innerHTML = html;

      // Create snapshot button
      const createBtn = content.querySelector('#create-snapshot-btn');
      if (createBtn) {
        createBtn.addEventListener('click', async () => {
          const label = prompt('Snapshot label:', `Snapshot ${new Date().toISOString().split('T')[0]}`);
          if (label) {
            await vfs.createSnapshot(label);
            refreshView();
          }
        });
      }

      // Snapshot click handlers
      content.querySelectorAll('.snapshot-item').forEach(item => {
        item.addEventListener('click', () => {
          const id = item.dataset.id;
          if (confirm('Restore this snapshot? This will replace current VFS contents.')) {
            vfs.restoreSnapshot(id).then(() => {
              alert('Snapshot restored! Reload the page to see changes.');
            });
          }
        });
      });
    }

    // Update action buttons
    function updateActionButtons() {
      const exportBtn = container.querySelector('#export-code-btn');
      const loadBtn = container.querySelector('#load-code-btn');

      exportBtn.disabled = !selectedFile;
      loadBtn.disabled = !selectedFile;

      if (selectedFile) {
        exportBtn.style.opacity = '1';
        loadBtn.style.opacity = '1';
      } else {
        exportBtn.style.opacity = '0.5';
        loadBtn.style.opacity = '0.5';
      }
    }

    // Export button - download to local filesystem
    const exportBtn = container.querySelector('#export-code-btn');
    exportBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      try {
        const code = await vfs.read(selectedFile);
        const filename = selectedFile.split('/').pop();

        const blob = new Blob([code], { type: 'text/javascript' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        showNotification('File exported: ' + filename, 'success');
      } catch (error) {
        showNotification('Export failed: ' + error.message, 'error');
      }
    });

    // Load button - inject code into agent's context
    const loadBtn = container.querySelector('#load-code-btn');
    loadBtn.addEventListener('click', async () => {
      if (!selectedFile) return;

      try {
        const code = await vfs.read(selectedFile);
        const filename = selectedFile.split('/').pop();

        // Send message to agent about the loaded code
        agentLoop.injectContext({
          type: 'code_loaded',
          path: selectedFile,
          filename: filename,
          code: code,
          instruction: `The user has loaded code from ${selectedFile}. This code is now available in your context. You can analyze it, modify it, or use it as needed.`
        });

        showNotification('Code loaded into agent context: ' + filename, 'success');
      } catch (error) {
        showNotification('Load failed: ' + error.message, 'error');
      }
    });

    // Show notification
    function showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 420px;
        padding: 12px 20px;
        background: ${type === 'success' ? '#1a5f1a' : type === 'error' ? '#5f1a1a' : '#1a1a5f'};
        color: #fff;
        border: 1px solid ${type === 'success' ? '#0f0' : type === 'error' ? '#f00' : '#88f'};
        border-radius: 3px;
        z-index: 2000;
        font-size: 12px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      `;
      notification.textContent = message;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.style.transition = 'opacity 0.3s';
        notification.style.opacity = '0';
        setTimeout(() => notification.remove(), 300);
      }, 3000);
    }

    // Escape HTML
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    // Auto-refresh on VFS changes
    const originalWrite = vfs.write;
    vfs.write = async function(...args) {
      const result = await originalWrite.apply(vfs, args);
      if (isOpen) refreshView();
      return result;
    };

    // Initial render
    refreshView();

    return {
      open: () => {
        isOpen = true;
        container.style.transform = 'translateX(0)';
        toggleBtn.textContent = '▶';
      },
      close: () => {
        isOpen = false;
        container.style.transform = 'translateX(100%)';
        toggleBtn.textContent = '◀';
      },
      refresh: refreshView,
      toggle: () => {
        if (isOpen) {
          close();
        } else {
          open();
        }
      }
    };
  }
};

export default CodeViewer;
