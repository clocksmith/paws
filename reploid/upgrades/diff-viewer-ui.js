// @blueprint 0x000051 - Interactive Diff Viewer UI
// Interactive Diff Viewer UI Component for REPLOID Sentinel
// Provides rich diff visualization and interactive approval controls
// PX-3 Enhanced: Prism.js syntax highlighting + detailed statistics

const DiffViewerUI = {
  metadata: {
    id: 'DiffViewerUI',
    version: '2.0.0',
    description: 'Enhanced diff viewer with Prism.js syntax highlighting and detailed statistics',
    features: [
      'Prism.js syntax highlighting for 10+ languages',
      'Side-by-side diff with color-coded changes',
      'Detailed per-file statistics (added/removed/modified lines)',
      'Language detection from file extensions',
      'Export to markdown, clipboard, and Web Share API'
    ],
    dependencies: ['Utils', 'StateManager', 'EventBus', 'ConfirmationModal?'],
    externalDeps: ['Prism'],
    async: false,
    type: 'ui'
  },

  factory: (deps) => {
    const { Utils, StateManager, EventBus, ConfirmationModal } = deps;
    const { logger } = Utils;

    let container = null;
    let currentDiff = null;
    let approvalCallbacks = {};

    // Track event listeners for cleanup
    const eventListeners = {
      showDiff: null,
      clearDiff: null,
      refreshDiff: null
    };

    // Cleanup function to remove event listeners
    const cleanup = () => {
      if (eventListeners.showDiff) {
        EventBus.off('diff:show', eventListeners.showDiff);
        eventListeners.showDiff = null;
      }
      if (eventListeners.clearDiff) {
        EventBus.off('diff:clear', eventListeners.clearDiff);
        eventListeners.clearDiff = null;
      }
      if (eventListeners.refreshDiff) {
        EventBus.off('diff:refresh', eventListeners.refreshDiff);
        eventListeners.refreshDiff = null;
      }
    };

    // Initialize the diff viewer
    const init = (containerId) => {
      console.log('[DiffViewerUI] init() called with containerId:', containerId);
      logger.info('[DiffViewerUI] init() called with containerId:', containerId);

      // Clean up any existing listeners first
      cleanup();

      container = document.getElementById(containerId);
      console.log('[DiffViewerUI] Container element:', container);

      if (!container) {
        console.error('[DiffViewerUI] Container not found:', containerId);
        logger.error('[DiffViewerUI] Container not found:', containerId);
        return;
      }

      // Add styles if not already present (idempotent)
      if (!document.getElementById('diff-viewer-styles')) {
        console.log('[DiffViewerUI] Adding styles to DOM');
        const styles = document.createElement('style');
        styles.id = 'diff-viewer-styles';
        styles.innerHTML = getDiffViewerStyles();
        document.head.appendChild(styles);
      } else {
        console.log('[DiffViewerUI] Styles already present');
      }

      // Register event listeners and store references
      eventListeners.showDiff = handleShowDiff;
      eventListeners.clearDiff = clearDiff;
      eventListeners.refreshDiff = handleRefresh;
      EventBus.on('diff:show', eventListeners.showDiff);
      EventBus.on('diff:clear', eventListeners.clearDiff);
      EventBus.on('diff:refresh', eventListeners.refreshDiff);

      console.log('[DiffViewerUI] Event listeners registered');
      logger.info('[DiffViewerUI] Initialized successfully');
    };

    // Handle showing a diff
    const handleShowDiff = async (data) => {
      console.log('[DiffViewerUI] handleShowDiff() called with data:', data);
      const { dogs_path, session_id, turn } = data;

      try {
        console.log('[DiffViewerUI] Loading dogs bundle from:', dogs_path);
        // Load and parse the dogs bundle
        const dogsContent = await StateManager.getArtifactContent(dogs_path);
        console.log('[DiffViewerUI] Dogs content loaded, length:', dogsContent?.length);

        if (!dogsContent) {
          console.error('[DiffViewerUI] Dogs bundle not found at:', dogs_path);
          showError('Dogs bundle not found');
          return;
        }

        console.log('[DiffViewerUI] Parsing dogs bundle...');
        const changes = await parseDogsBundle(dogsContent);
        console.log('[DiffViewerUI] Parsed changes:', changes.length, 'changes');
        console.log('[DiffViewerUI] Changes:', changes);

        currentDiff = { changes, dogs_path, session_id, turn };

        console.log('[DiffViewerUI] Rendering diff...');
        renderDiff(changes);
        console.log('[DiffViewerUI] Diff rendered successfully');

      } catch (error) {
        console.error('[DiffViewerUI] Error showing diff:', error);
        logger.error('[DiffViewerUI] Error showing diff:', error);
        showError('Failed to load diff');
      }
    };

    const mergeChanges = (existing = [], incoming = []) => {
      if (!Array.isArray(incoming)) {
        return existing;
      }

      const approvalMap = new Map();
      existing.forEach(change => {
        const key = `${change.operation}:${change.file_path}`;
        if (!approvalMap.has(key)) {
          approvalMap.set(key, Boolean(change.approved));
        } else if (change.approved) {
          approvalMap.set(key, true);
        }
      });

      return incoming.map(change => {
        const key = `${change.operation}:${change.file_path}`;
        return {
          ...change,
          approved: approvalMap.has(key) ? approvalMap.get(key) : Boolean(change.approved)
        };
      });
    };

    const handleRefresh = (payload = {}) => {
      if (!currentDiff) {
        if (payload?.dogs_path) {
          handleShowDiff(payload);
        }
        return;
      }

      if (payload?.dogs_path) {
        currentDiff.dogs_path = payload.dogs_path;
      }
      if (payload?.session_id) {
        currentDiff.session_id = payload.session_id;
      }

      if (Array.isArray(payload?.changes)) {
        currentDiff.changes = mergeChanges(currentDiff.changes, payload.changes);
      }

      if (currentDiff.changes && currentDiff.changes.length) {
        renderDiff(currentDiff.changes);
      }
    };

    // Parse dogs bundle (matching sentinel-tools format)
    const parseDogsBundle = async (content) => {
      const changes = [];
      const blocks = content.split('```paws-change');

      for (let i = 1; i < blocks.length; i++) {
        const block = blocks[i];
        const metaEnd = block.indexOf('```');
        if (metaEnd === -1) continue;

        const meta = block.substring(0, metaEnd).trim();
        const operation = meta.match(/operation:\s*(\w+)/)?.[1];
        const filePath = meta.match(/file_path:\s*(.+)/)?.[1]?.trim();

        if (!operation || !filePath) continue;

        let newContent = '';
        let oldContent = '';

        if (operation !== 'DELETE') {
          const contentStart = block.indexOf('```', metaEnd + 3);
          if (contentStart !== -1) {
            let actualStart = contentStart + 3;
            if (block[actualStart] === '\n') actualStart++;
            const contentEnd = block.indexOf('```', actualStart);
            if (contentEnd !== -1) {
              newContent = block.substring(actualStart, contentEnd);
            }
          }
        }

        // For MODIFY operations, fetch current content (now properly awaited)
        if (operation === 'MODIFY') {
          try {
            oldContent = await StateManager.getArtifactContent(filePath) || '';
          } catch (err) {
            console.error(`Failed to fetch old content for ${filePath}:`, err);
            oldContent = '// Error loading original content';
          }
        }

        changes.push({
          operation,
          file_path: filePath,
          old_content: oldContent,
          new_content: newContent,
          approved: false,
          status: 'pending'
        });
      }

      return changes;
    };

    // Render the diff viewer
    const renderDiff = (changes) => {
      console.log('[DiffViewerUI] renderDiff() called, container:', container, 'changes:', changes.length);

      if (!container) {
        console.error('[DiffViewerUI] Cannot render: container is null');
        return;
      }

      const html = `
        <div class="diff-viewer">
          <div class="diff-header">
            <h3>Review Proposed Changes</h3>
            <div class="diff-stats">
              ${getChangeStats(changes)}
            </div>
          </div>

          <div class="diff-actions" role="toolbar" aria-label="Diff actions">
            <button class="btn-approve-all" onclick="DiffViewerUI.approveAll()" aria-label="Approve all changes">
              ✓ Approve All
            </button>
            <button class="btn-reject-all" onclick="DiffViewerUI.rejectAll()" aria-label="Reject all changes">
              ✗ Reject All
            </button>
            <button class="btn-edit" onclick="DiffViewerUI.editProposal()" aria-label="Edit proposal">
              ✎ Edit Proposal
            </button>
            <button class="btn-export" onclick="DiffViewerUI.copyToClipboard()" title="Copy diff to clipboard" aria-label="Copy diff to clipboard">
              ☷ Copy
            </button>
            <button class="btn-export" onclick="DiffViewerUI.exportMarkdown()" title="Export as Markdown" aria-label="Export diff as markdown file">
              ⛃ Export
            </button>
            <button class="btn-export" onclick="DiffViewerUI.share()" title="Share diff" aria-label="Share diff">
              ⇑ Share
            </button>
          </div>

          <div class="diff-files">
            ${changes.map((change, index) => renderFileChange(change, index)).join('')}
          </div>

          <div class="diff-footer" role="group" aria-label="Apply or cancel changes">
            <button class="btn-apply" onclick="DiffViewerUI.applyApproved()" aria-label="Apply approved changes">
              Apply Approved Changes
            </button>
            <button class="btn-cancel" onclick="DiffViewerUI.cancel()" aria-label="Cancel and close">
              Cancel
            </button>
          </div>
        </div>
      `;

      console.log('[DiffViewerUI] Setting container innerHTML, html length:', html.length);
      container.innerHTML = html;
      console.log('[DiffViewerUI] Container innerHTML set successfully');

      // Initialize diff rendering for each file
      changes.forEach((change, index) => {
        if (change.operation === 'MODIFY') {
          console.log('[DiffViewerUI] Rendering MODIFY diff for:', change.file_path);
          renderFileDiff(change, index);
        }
      });

      console.log('[DiffViewerUI] Updating approval stats...');
      updateApprovalStats();
      console.log('[DiffViewerUI] Diff rendering complete');
    };

    // Get change statistics
    const getChangeStats = (changes) => {
      const stats = { CREATE: 0, MODIFY: 0, DELETE: 0 };
      changes.forEach(c => stats[c.operation]++);

      return `
        <span class="stat-create">+${stats.CREATE} new</span>
        <span class="stat-modify">~${stats.MODIFY} modified</span>
        <span class="stat-delete">-${stats.DELETE} deleted</span>
      `;
    };

    // Render a single file change
    const renderFileChange = (change, index) => {
      const icon = {
        CREATE: '⊕',
        MODIFY: '✏️',
        DELETE: '⛶️'
      }[change.operation];
      const operationClass = change.operation.toLowerCase();
      const summary = summarizeChange(change);
      const minimap = renderMiniMap(summary);
      const summaryBadges = renderChangeSummaryBadges(summary, change.operation);
      const statusBadge = renderStatusBadge(change.status);

      return `
        <div class="diff-file diff-file-${operationClass}" data-index="${index}" role="article" aria-labelledby="diff-header-${index}">
          <div class="diff-file-header" id="diff-header-${index}">
            <div class="diff-file-info">
              ${minimap}
              <div class="diff-file-meta">
                <div class="diff-file-path-row">
                  <span class="diff-icon" aria-hidden="true">${icon}</span>
                  <span class="diff-path">${change.file_path}</span>
                  <span class="diff-operation ${operationClass}" aria-label="Operation">${change.operation}</span>
                  ${statusBadge}
                </div>
                <div class="diff-change-summary" role="presentation">
                  ${summaryBadges}
                </div>
              </div>
            </div>
            <div class="diff-file-actions" role="group" aria-label="File change actions">
              <label class="checkbox-wrapper">
                <input type="checkbox"
                       class="approve-checkbox"
                       data-index="${index}"
                       onchange="DiffViewerUI.toggleApproval(${index})"
                       aria-label="Approve changes to ${change.file_path}"
                       ${change.approved ? 'checked' : ''}>
                <span>Approve</span>
              </label>
              <button class="btn-expand"
                      onclick="DiffViewerUI.toggleExpand(${index})"
                      aria-expanded="false"
                      aria-controls="diff-content-${index}"
                      aria-label="${change.operation === 'DELETE' ? 'View' : 'Expand'} ${change.file_path}">
                ${change.operation === 'DELETE' ? 'View' : 'Expand'}
              </button>
            </div>
          </div>
          <div class="diff-file-content" id="diff-content-${index}" style="display: none;" role="region" aria-label="Diff content">
            ${renderChangeContent(change, index)}
          </div>
        </div>
      `;
    };

    // Render the content of a change
    const renderChangeContent = (change, index) => {
      const language = detectLanguage(change.file_path);

      if (change.operation === 'CREATE') {
        const highlightedCode = highlightCode(change.new_content, language);
        const lines = change.new_content.split('\n').length;
        return `
          <div class="diff-create">
            <div class="diff-stats-summary">
              <span class="diff-stat-item added">+${lines} lines</span>
            </div>
            <pre class="code-block language-${language}"><code>${highlightedCode}</code></pre>
          </div>
        `;
      } else if (change.operation === 'DELETE') {
        const content = change.old_content || 'File will be deleted';
        const highlightedCode = change.old_content ? highlightCode(content, language) : content;
        const lines = change.old_content ? change.old_content.split('\n').length : 0;
        return `
          <div class="diff-delete">
            <div class="diff-stats-summary">
              <span class="diff-stat-item removed">-${lines} lines</span>
            </div>
            <pre class="code-block language-${language}"><code>${highlightedCode}</code></pre>
          </div>
        `;
      } else if (change.operation === 'MODIFY') {
        return `<div class="diff-modify" id="diff-modify-${index}">Loading diff...</div>`;
      }
    };

    // Render a file diff for MODIFY operations
    const renderFileDiff = async (change, index) => {
      const container = document.getElementById(`diff-modify-${index}`);
      if (!container) return;

      try {
        // Get current content
        const oldContent = (change.old_content !== undefined && change.old_content !== null)
          ? change.old_content
          : (await StateManager.getArtifactContent(change.file_path) || '');
        const newContent = change.new_content;

        if (change.old_content === undefined) {
          change.old_content = oldContent;
        }

        // Generate side-by-side diff with syntax highlighting
        const diffHtml = generateSideBySideDiff(oldContent, newContent, change.file_path);
        container.innerHTML = diffHtml;

      } catch (error) {
        container.innerHTML = '<div class="error">Failed to load diff</div>';
      }
    };

    // Detect language from file path
    const detectLanguage = (filePath) => {
      const ext = filePath.split('.').pop().toLowerCase();
      const langMap = {
        'js': 'javascript',
        'jsx': 'javascript',
        'ts': 'typescript',
        'tsx': 'typescript',
        'json': 'json',
        'css': 'css',
        'scss': 'css',
        'html': 'markup',
        'xml': 'markup',
        'svg': 'markup',
        'md': 'markdown',
        'sh': 'bash',
        'bash': 'bash',
        'py': 'python'
      };
      return langMap[ext] || 'javascript';
    };

    // Apply syntax highlighting to code
    const highlightCode = (code, language) => {
      if (typeof Prism === 'undefined' || !Prism.languages[language]) {
        return escapeHtml(code);
      }
      try {
        return Prism.highlight(code, Prism.languages[language], language);
      } catch (err) {
        return escapeHtml(code);
      }
    };

    // Calculate detailed diff statistics
    const calculateDiffStats = (oldContent, newContent) => {
      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');

      let added = 0;
      let removed = 0;
      let modified = 0;
      let unchanged = 0;

      const maxLines = Math.max(oldLines.length, newLines.length);

      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];

        if (oldLine === undefined) {
          added++;
        } else if (newLine === undefined) {
          removed++;
        } else if (oldLine !== newLine) {
          modified++;
        } else {
          unchanged++;
        }
      }

      return { added, removed, modified, unchanged, total: maxLines };
    };

    const summarizeChange = (change) => {
      if (!change) {
        return { added: 0, removed: 0, modified: 0, unchanged: 0, total: 0 };
      }

      if (change.operation === 'CREATE') {
        const added = (change.new_content || '').split('\n').filter(() => true).length;
        return { added, removed: 0, modified: 0, unchanged: 0, total: added };
      }

      if (change.operation === 'DELETE') {
        const removed = (change.old_content || '').split('\n').filter(() => true).length;
        return { added: 0, removed, modified: 0, unchanged: 0, total: removed };
      }

      const stats = calculateDiffStats(change.old_content || '', change.new_content || '');
      return stats;
    };

    const renderChangeSummaryBadges = (summary, operation) => {
      const pieces = [];
      if (summary.added) {
        pieces.push(`<span class="diff-pill added">+${summary.added}</span>`);
      }
      if (summary.modified) {
        pieces.push(`<span class="diff-pill modified">~${summary.modified}</span>`);
      }
      if (summary.removed) {
        pieces.push(`<span class="diff-pill removed">-${summary.removed}</span>`);
      }
      if (!pieces.length) {
        const label = operation === 'DELETE' ? 'Removed' : 'No changes';
        pieces.push(`<span class="diff-pill neutral">${label}</span>`);
      }
      return pieces.join('');
    };

    const renderMiniMap = (summary) => {
      const total = summary.added + summary.removed + summary.modified;
      if (total <= 0) {
        return '<div class="diff-minimap diff-minimap-empty" aria-hidden="true"></div>';
      }

      const addedHeight = Math.max((summary.added / total) * 100, 0);
      const modifiedHeight = Math.max((summary.modified / total) * 100, 0);
      const removedHeight = Math.max((summary.removed / total) * 100, 0);
      const title = `+${summary.added} ~${summary.modified} -${summary.removed}`;

      return `
        <div class="diff-minimap" aria-hidden="true" title="${title}">
          <span class="segment added" style="height:${addedHeight}%"></span>
          <span class="segment modified" style="height:${modifiedHeight}%"></span>
          <span class="segment removed" style="height:${removedHeight}%"></span>
        </div>
      `;
    };

    const renderStatusBadge = (status = 'pending') => {
      const normalized = (status || 'pending').toLowerCase();
      const variants = {
        pending: { label: 'Pending', cls: 'pending' },
        applying: { label: 'Applying', cls: 'applying' },
        success: { label: 'Applied', cls: 'success' },
        applied: { label: 'Applied', cls: 'success' },
        error: { label: 'Error', cls: 'error' }
      };
      const { label, cls } = variants[normalized] || { label: status, cls: 'pending' };
      return `<span class="diff-status diff-status-${cls}">${label}</span>`;
    };

    // Generate side-by-side diff HTML with syntax highlighting
    const generateSideBySideDiff = (oldContent, newContent, filePath = '') => {
      const oldLines = oldContent.split('\n');
      const newLines = newContent.split('\n');
      const maxLines = Math.max(oldLines.length, newLines.length);
      const language = detectLanguage(filePath);

      // Calculate diff stats
      const stats = calculateDiffStats(oldContent, newContent);

      let html = '<div class="diff-stats-summary">';
      html += `<span class="diff-stat-item added">+${stats.added}</span>`;
      html += `<span class="diff-stat-item removed">-${stats.removed}</span>`;
      html += `<span class="diff-stat-item modified">~${stats.modified}</span>`;
      html += `<span class="diff-stat-item unchanged">${stats.unchanged} unchanged</span>`;
      html += '</div>';

      html += '<div class="side-by-side-diff">';
      html += '<div class="diff-pane diff-old"><div class="diff-pane-header">Original</div>';
      html += '<div class="diff-lines">';

      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];
        let lineClass = '';

        if (oldLine === undefined) {
          lineClass = 'empty';
        } else if (newLine === undefined) {
          lineClass = 'removed';
        } else if (oldLine !== newLine) {
          lineClass = 'changed';
        }

        if (oldLine !== undefined) {
          html += `<div class="diff-line ${lineClass}">`;
          html += `<span class="line-number">${i + 1}</span>`;
          html += `<span class="line-content">${highlightCode(oldLine, language)}</span>`;
          html += '</div>';
        } else {
          html += '<div class="diff-line empty"><span class="line-number"></span><span class="line-content">&nbsp;</span></div>';
        }
      }

      html += '</div></div>';
      html += '<div class="diff-pane diff-new"><div class="diff-pane-header">Modified</div>';
      html += '<div class="diff-lines">';

      for (let i = 0; i < maxLines; i++) {
        const oldLine = oldLines[i];
        const newLine = newLines[i];
        let lineClass = '';

        if (newLine === undefined) {
          lineClass = 'empty';
        } else if (oldLine === undefined) {
          lineClass = 'added';
        } else if (oldLine !== newLine) {
          lineClass = 'changed';
        }

        if (newLine !== undefined) {
          html += `<div class="diff-line ${lineClass}">`;
          html += `<span class="line-number">${i + 1}</span>`;
          html += `<span class="line-content">${highlightCode(newLine, language)}</span>`;
          html += '</div>';
        } else {
          html += '<div class="diff-line empty"><span class="line-number"></span><span class="line-content">&nbsp;</span></div>';
        }
      }

      html += '</div></div>';
      html += '</div>';

      return html;
    };

    // Toggle file content expansion
    const toggleExpand = (index) => {
      const content = document.getElementById(`diff-content-${index}`);
      const button = document.querySelector(`[aria-controls="diff-content-${index}"]`);
      if (content) {
        const isExpanded = content.style.display !== 'none';
        content.style.display = isExpanded ? 'none' : 'block';
        if (button) {
          button.setAttribute('aria-expanded', (!isExpanded).toString());
        }
      }
    };

    // Toggle approval for a change
    const toggleApproval = (index) => {
      if (currentDiff && currentDiff.changes[index]) {
        currentDiff.changes[index].approved = !currentDiff.changes[index].approved;
        updateApprovalStats();
      }
    };

    // Approve all changes
    const approveAll = () => {
      if (currentDiff) {
        currentDiff.changes.forEach(c => c.approved = true);
        document.querySelectorAll('.approve-checkbox').forEach(cb => cb.checked = true);
        updateApprovalStats();
      }
    };

    // Reject all changes
    const rejectAll = () => {
      if (currentDiff) {
        currentDiff.changes.forEach(c => c.approved = false);
        document.querySelectorAll('.approve-checkbox').forEach(cb => cb.checked = false);
        updateApprovalStats();
      }
    };

    // Update approval statistics
    const updateApprovalStats = () => {
      const approved = currentDiff.changes.filter(c => c.approved).length;
      const total = currentDiff.changes.length;

      const applyBtn = document.querySelector('.btn-apply');
      if (applyBtn) {
        applyBtn.textContent = `Apply ${approved}/${total} Approved Changes`;
        applyBtn.disabled = approved === 0;
      }
    };

    // Apply approved changes
    const applyApproved = async () => {
      if (!currentDiff) return;

      const approvedChanges = currentDiff.changes.filter(c => c.approved);
      if (approvedChanges.length === 0) {
        showError('No changes approved');
        return;
      }

      // Show confirmation dialog
      const changeDetails = approvedChanges.map(c =>
        `${c.operation}: ${c.file_path}`
      ).join('\n');

      const confirmed = ConfirmationModal
        ? await ConfirmationModal.confirm({
            title: 'Apply Changes',
            message: `Apply ${approvedChanges.length} approved change${approvedChanges.length > 1 ? 's' : ''}? This will modify your files.`,
            confirmText: 'Apply Changes',
            cancelText: 'Cancel',
            danger: true,
            details: changeDetails
          })
        : confirm(`Apply ${approvedChanges.length} change(s)?\n\n${changeDetails}`);

      if (!confirmed) {
        logger.info('[DiffViewerUI] User cancelled apply operation');
        return;
      }

      // Create a new dogs bundle with only approved changes
      const filteredDogsPath = currentDiff.dogs_path.replace('.md', '-filtered.md');

      EventBus.emit('proposal:approved', {
        original_dogs_path: currentDiff.dogs_path,
        filtered_dogs_path: filteredDogsPath,
        approved_changes: approvedChanges,
        session_id: currentDiff.session_id,
        turn: currentDiff.turn
      });

      clearDiff();
    };

    // Edit the proposal
    const editProposal = () => {
      if (!currentDiff) return;

      // Open an editor for the changes
      EventBus.emit('proposal:edit', {
        dogs_path: currentDiff.dogs_path,
        changes: currentDiff.changes
      });
    };

    // Cancel the diff viewer
    const cancel = () => {
      EventBus.emit('proposal:cancelled');
      clearDiff();
    };

    // Clear the diff viewer
    const clearDiff = () => {
      if (container) {
        container.innerHTML = '';
      }
      currentDiff = null;
    };

    // Show an error message
    const showError = (message) => {
      if (container) {
        container.innerHTML = `
          <div class="diff-error">
            <p>✗ ${message}</p>
          </div>
        `;
      }
    };

    // Escape HTML for safe display
    const escapeHtml = (text) => {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    };

    // Get CSS styles for the diff viewer
    const getDiffViewerStyles = () => {
      return `
        .diff-viewer {
          background: #1e1e1e;
          border: 1px solid #333;
          border-radius: 8px;
          color: #d4d4d4;
          font-family: 'Monaco', 'Menlo', monospace;
          padding: 16px;
        }

        .diff-header {
          border-bottom: 1px solid #333;
          margin-bottom: 16px;
          padding-bottom: 12px;
        }

        .diff-header h3 {
          margin: 0 0 8px 0;
          color: #fff;
        }

        .diff-stats span {
          margin-right: 16px;
        }

        .stat-create { color: #4ec9b0; }
        .stat-modify { color: #ffd700; }
        .stat-delete { color: #f48771; }

        .diff-actions {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }

        .diff-actions button,
        .diff-footer button {
          background: #0e639c;
          border: none;
          border-radius: 4px;
          color: #fff;
          cursor: pointer;
          padding: 8px 16px;
          transition: background 0.2s;
        }

        .diff-actions button:hover,
        .diff-footer button:hover {
          background: #1177bb;
        }

        .btn-reject-all {
          background: #f48771 !important;
        }

        .btn-edit {
          background: #ffd700 !important;
          color: #000 !important;
        }

        .diff-file {
          background: #2d2d30;
          border-radius: 4px;
          margin-bottom: 8px;
          overflow: hidden;
        }

        .diff-file.create { border-left: 3px solid #4ec9b0; }
        .diff-file.modify { border-left: 3px solid #ffd700; }
        .diff-file.delete { border-left: 3px solid #f48771; }

        .diff-file-header {
          align-items: center;
          background: #252526;
          display: flex;
          justify-content: space-between;
          padding: 12px;
        }

        .diff-file-info {
          align-items: center;
          display: flex;
          gap: 12px;
        }

        .diff-file-meta {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .diff-file-path-row {
          align-items: center;
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }

        .diff-change-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
        }

        .diff-pill {
          align-items: center;
          border-radius: 999px;
          display: inline-flex;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 6px;
        }

        .diff-pill.added {
          background: rgba(78, 201, 176, 0.15);
          color: #4ec9b0;
        }

        .diff-pill.modified {
          background: rgba(255, 215, 0, 0.15);
          color: #ffd700;
        }

        .diff-pill.removed {
          background: rgba(244, 135, 113, 0.15);
          color: #f48771;
        }

        .diff-pill.neutral {
          background: #333;
          color: #aaaaaa;
        }

        .diff-status {
          border: 1px solid #3a3a3a;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          padding: 2px 8px;
          text-transform: uppercase;
        }

        .diff-status-pending {
          background: rgba(255, 255, 255, 0.05);
          color: #d4d4d4;
        }

        .diff-status-applying {
          background: rgba(255, 215, 0, 0.12);
          color: #ffd700;
          border-color: rgba(255, 215, 0, 0.4);
        }

        .diff-status-success {
          background: rgba(78, 201, 176, 0.18);
          color: #4ec9b0;
          border-color: rgba(78, 201, 176, 0.4);
        }

        .diff-status-error {
          background: rgba(244, 135, 113, 0.15);
          color: #f48771;
          border-color: rgba(244, 135, 113, 0.4);
        }

        .diff-minimap {
          background: #1b1b1c;
          border-radius: 4px;
          box-shadow: inset 0 0 0 1px #333;
          height: 48px;
          overflow: hidden;
          width: 8px;
        }

        .diff-minimap .segment {
          display: block;
          width: 100%;
        }

        .diff-minimap .segment.added {
          background: #4ec9b0;
        }

        .diff-minimap .segment.modified {
          background: #ffd700;
        }

        .diff-minimap .segment.removed {
          background: #f48771;
        }

        .diff-minimap.diff-minimap-empty {
          background: #252526;
        }

        .diff-icon {
          font-size: 18px;
        }

        .diff-path {
          color: #4ec9b0;
          font-weight: 500;
        }

        .diff-operation {
          background: #333;
          border-radius: 4px;
          font-size: 12px;
          padding: 2px 8px;
          text-transform: uppercase;
        }

        .diff-operation.create { background: #4ec9b0; color: #000; }
        .diff-operation.modify { background: #ffd700; color: #000; }
        .diff-operation.delete { background: #f48771; color: #000; }

        .diff-file-actions {
          display: flex;
          gap: 12px;
        }

        .checkbox-wrapper {
          align-items: center;
          display: flex;
          gap: 4px;
        }

        .btn-expand {
          background: transparent;
          border: 1px solid #555;
          border-radius: 4px;
          color: #d4d4d4;
          cursor: pointer;
          padding: 4px 12px;
        }

        .diff-file-content {
          border-top: 1px solid #333;
          max-height: 600px;
          overflow: auto;
          padding: 12px;
        }

        .code-block {
          background: #1e1e1e;
          border-radius: 4px;
          font-size: 13px;
          line-height: 1.5;
          margin: 0;
          overflow-x: auto;
          padding: 12px;
          white-space: pre;
        }

        .side-by-side-diff {
          display: flex;
          gap: 2px;
        }

        .diff-pane {
          flex: 1;
          overflow-x: auto;
        }

        .diff-pane-header {
          background: #333;
          font-weight: bold;
          padding: 8px;
          text-align: center;
        }

        .diff-lines {
          background: #1e1e1e;
        }

        .diff-line {
          display: flex;
          min-height: 20px;
        }

        .diff-line.changed {
          background: rgba(255, 215, 0, 0.1);
        }

        .diff-line.empty {
          background: #252526;
        }

        .line-number {
          background: #252526;
          color: #858585;
          padding: 0 8px;
          text-align: right;
          user-select: none;
          width: 50px;
        }

        .line-content {
          flex: 1;
          padding: 0 8px;
          white-space: pre;
        }

        .diff-footer {
          border-top: 1px solid #333;
          display: flex;
          gap: 8px;
          justify-content: flex-end;
          margin-top: 16px;
          padding-top: 12px;
        }

        .btn-apply:disabled {
          background: #555 !important;
          cursor: not-allowed;
          opacity: 0.5;
        }

        .diff-error {
          background: rgba(244, 135, 113, 0.1);
          border: 1px solid #f48771;
          border-radius: 4px;
          color: #f48771;
          padding: 16px;
          text-align: center;
        }
      `;
    };

    // Generate diff summary as markdown
    const generateDiffMarkdown = () => {
      if (!currentDiff) return '';

      const { changes, dogs_path, session_id } = currentDiff;
      const date = new Date().toISOString();

      let md = `# Diff Summary\n\n`;
      md += `**Generated:** ${date}\n`;
      md += `**Session:** ${session_id || 'N/A'}\n`;
      md += `**Source:** ${dogs_path}\n\n`;

      // Statistics
      const stats = { CREATE: 0, MODIFY: 0, DELETE: 0 };
      changes.forEach(c => stats[c.operation]++);
      md += `## Summary\n\n`;
      md += `- **Create:** ${stats.CREATE} files\n`;
      md += `- **Modify:** ${stats.MODIFY} files\n`;
      md += `- **Delete:** ${stats.DELETE} files\n`;
      md += `- **Total:** ${changes.length} changes\n\n`;

      // Details
      md += `## Changes\n\n`;
      changes.forEach((change, i) => {
        const icon = { CREATE: '⊕', MODIFY: '✏️', DELETE: '⛶️' }[change.operation];
        const status = change.approved ? '✓ Approved' : '☐ Pending';
        md += `### ${i + 1}. ${icon} ${change.operation}: ${change.file_path}\n\n`;
        md += `**Status:** ${status}\n\n`;

        if (change.operation === 'CREATE') {
          const lines = (change.new_content || '').split('\n').length;
          md += `New file with ${lines} lines\n\n`;
        } else if (change.operation === 'DELETE') {
          md += `File will be deleted\n\n`;
        }
      });

      md += `\n---\n\n*Generated by REPLOID Sentinel Agent*\n`;
      return md;
    };

    // Copy diff to clipboard
    const copyToClipboard = async () => {
      if (!currentDiff) {
        logger.warn('[DiffViewerUI] No diff to copy');
        return;
      }

      try {
        const markdown = generateDiffMarkdown();
        await navigator.clipboard.writeText(markdown);

        // Show feedback
        const btn = event?.target;
        if (btn) {
          const originalText = btn.innerHTML;
          btn.innerHTML = '✓ Copied!';
          btn.style.background = 'rgba(76, 175, 80, 0.2)';
          setTimeout(() => {
            btn.innerHTML = originalText;
            btn.style.background = '';
          }, 2000);
        }

        logger.info('[DiffViewerUI] Copied diff to clipboard');
      } catch (err) {
        logger.error('[DiffViewerUI] Failed to copy to clipboard:', err);
        logger.error('[DiffViewerUI] Copy failed'); // Toast shown by caller
      }
    };

    // Export as markdown file
    const exportMarkdown = () => {
      if (!currentDiff) {
        logger.warn('[DiffViewerUI] No diff to export');
        return;
      }

      try {
        const markdown = generateDiffMarkdown();
        const blob = new Blob([markdown], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `diff-${currentDiff.session_id || 'export'}-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        logger.info('[DiffViewerUI] Exported diff as markdown');
      } catch (err) {
        logger.error('[DiffViewerUI] Failed to export markdown:', err);
        logger.error('[DiffViewerUI] Export failed');
      }
    };

    // Share diff using Web Share API
    const share = async () => {
      if (!currentDiff) {
        logger.warn('[DiffViewerUI] No diff to share');
        return;
      }

      if (!navigator.share) {
        logger.warn('[DiffViewerUI] Web Share API not supported');
        logger.warn('[DiffViewerUI] Web Share API not supported');
        return;
      }

      try {
        const markdown = generateDiffMarkdown();
        const stats = { CREATE: 0, MODIFY: 0, DELETE: 0 };
        currentDiff.changes.forEach(c => stats[c.operation]++);

        await navigator.share({
          title: 'REPLOID Diff Summary',
          text: `Changes: ${stats.CREATE} CREATE, ${stats.MODIFY} MODIFY, ${stats.DELETE} DELETE\n\n${markdown}`,
        });

        logger.info('[DiffViewerUI] Shared diff successfully');
      } catch (err) {
        if (err.name === 'AbortError') {
          logger.info('[DiffViewerUI] Share cancelled by user');
        } else {
          logger.error('[DiffViewerUI] Failed to share:', err);
        }
      }
    };

    // Diff viewer statistics for widget
    const diffStats = {
      diffsShown: 0,
      totalChanges: 0,
      totalApprovals: 0,
      totalRejections: 0,
      diffsApplied: 0,
      diffsCancelled: 0,
      exportsGenerated: 0,
      lastDiff: null,
      recentDiffs: []
    };

    // Wrap handleShowDiff to track stats
    const wrappedHandleShowDiff = async (data) => {
      diffStats.diffsShown++;
      diffStats.lastDiff = {
        timestamp: Date.now(),
        path: data.dogs_path,
        session: data.session_id
      };
      diffStats.recentDiffs.unshift(diffStats.lastDiff);
      if (diffStats.recentDiffs.length > 10) {
        diffStats.recentDiffs = diffStats.recentDiffs.slice(0, 10);
      }

      await handleShowDiff(data);

      if (currentDiff) {
        diffStats.totalChanges += currentDiff.changes.length;
      }
    };

    // Wrap applyApproved to track stats
    const wrappedApplyApproved = async () => {
      await applyApproved();
      diffStats.diffsApplied++;
      if (currentDiff) {
        const approved = currentDiff.changes.filter(c => c.approved).length;
        diffStats.totalApprovals += approved;
      }
    };

    // Wrap cancel to track stats
    const wrappedCancel = () => {
      cancel();
      diffStats.diffsCancelled++;
      if (currentDiff) {
        const rejected = currentDiff.changes.filter(c => !c.approved).length;
        diffStats.totalRejections += rejected;
      }
    };

    // Wrap exportMarkdown to track stats
    const wrappedExportMarkdown = () => {
      exportMarkdown();
      diffStats.exportsGenerated++;
    };

    // Export public API
    const publicApi = {
      init,
      toggleExpand,
      toggleApproval,
      approveAll,
      rejectAll,
      applyApproved: wrappedApplyApproved,
      editProposal,
      cancel: wrappedCancel,
      showDiff: wrappedHandleShowDiff,
      clearDiff,
      refresh: handleRefresh,
      getCurrentDiff: () => currentDiff,
      copyToClipboard,
      exportMarkdown: wrappedExportMarkdown,
      share,

      widget: (() => {
        class DiffViewerUIWidget extends HTMLElement {
          constructor() {
            super();
            this.attachShadow({ mode: 'open' });
          }

          connectedCallback() {
            this.render();
            // Listen for diff updates
            this._diffListener = () => this.render();
            EventBus.on('diff:updated', this._diffListener);
          }

          disconnectedCallback() {
            if (this._diffListener) {
              EventBus.off('diff:updated', this._diffListener);
            }
          }

          set moduleApi(api) {
            this._api = api;
            this.render();
          }

          getStatus() {
            const hasActiveDiff = currentDiff !== null;

            let approvedCount = 0;
            let totalCount = 0;
            if (currentDiff && currentDiff.changes) {
              totalCount = currentDiff.changes.length;
              approvedCount = currentDiff.changes.filter(c => c.approved).length;
            }

            return {
              state: hasActiveDiff ? 'active' : (diffStats.diffsShown > 0 ? 'idle' : 'disabled'),
              primaryMetric: hasActiveDiff
                ? `${approvedCount}/${totalCount} approved`
                : diffStats.diffsShown > 0
                  ? `${diffStats.diffsShown} shown`
                  : 'No diffs',
              secondaryMetric: hasActiveDiff ? 'Reviewing' : 'Ready',
              lastActivity: diffStats.lastDiff ? diffStats.lastDiff.timestamp : null,
              message: hasActiveDiff ? `${totalCount} changes` : null
            };
          }

          render() {
            this.shadowRoot.innerHTML = `
              <style>
                :host {
                  display: block;
                  background: rgba(255,255,255,0.05);
                  border-radius: 8px;
                  padding: 16px;
                  font-family: monospace;
                  font-size: 12px;
                }
                h3 {
                  margin: 0 0 16px 0;
                  font-size: 1.4em;
                  color: #fff;
                  font-family: sans-serif;
                }
                .controls {
                  display: flex;
                  gap: 8px;
                  margin-bottom: 16px;
                  flex-wrap: wrap;
                }
                button {
                  padding: 6px 12px;
                  background: rgba(100,150,255,0.2);
                  border: 1px solid rgba(100,150,255,0.4);
                  border-radius: 4px;
                  color: #fff;
                  cursor: pointer;
                  font-size: 0.9em;
                }
                button:hover {
                  background: rgba(100,150,255,0.3);
                }
                .section {
                  margin-bottom: 12px;
                }
                .section-title {
                  color: #0ff;
                  font-weight: bold;
                  margin-bottom: 8px;
                }
                .stat-row {
                  color: #e0e0e0;
                  margin-bottom: 4px;
                }
                .stat-value { color: #0ff; }
                .stat-value.success { color: #0f0; }
                .stat-value.error { color: #f00; }
                .stat-value.warning { color: #ff0; }
                .diff-box {
                  margin-bottom: 12px;
                  padding: 8px;
                  background: rgba(0,255,255,0.05);
                  border: 1px solid rgba(0,255,255,0.2);
                  border-radius: 4px;
                }
                .diff-box-title {
                  color: #0ff;
                  font-weight: bold;
                  margin-bottom: 4px;
                }
                .diff-stats-row {
                  color: #aaa;
                  margin-bottom: 2px;
                }
                .diff-stats-row span {
                  color: #fff;
                }
                .operation-stats {
                  margin-top: 4px;
                  padding-top: 4px;
                  border-top: 1px solid rgba(255,255,255,0.1);
                }
                .op-create { color: #4ec9b0; }
                .op-modify { color: #ffd700; }
                .op-delete { color: #f48771; }
                .stats-box {
                  margin-bottom: 12px;
                  padding: 8px;
                  background: rgba(0,0,0,0.3);
                  border: 1px solid rgba(255,255,255,0.1);
                  border-radius: 4px;
                }
                .stats-box-title {
                  color: #888;
                  font-weight: bold;
                  margin-bottom: 4px;
                  font-size: 10px;
                }
                .recent-diffs {
                  max-height: 100px;
                  overflow-y: auto;
                }
                .recent-diff-item {
                  padding: 3px 0;
                  border-bottom: 1px solid rgba(255,255,255,0.1);
                }
                .empty-state {
                  color: #888;
                  text-align: center;
                  margin-top: 20px;
                }
              </style>

              <div class="diff-viewer-panel">
                <h3>✎ Diff Viewer</h3>

                ${currentDiff ? `
                  <div class="controls">
                    <button class="approve-all">✓ Approve All</button>
                    <button class="reject-all">✗ Reject All</button>
                    <button class="copy-diff">☷ Copy Diff</button>
                    <button class="export-diff">⛃ Export</button>
                  </div>
                ` : ''}

                <div class="section">
                  <div class="section-title">Session Summary</div>
                  <div class="stat-row">Diffs Shown: <span class="stat-value">${diffStats.diffsShown}</span></div>
                  <div class="stat-row">Total Changes: <span class="stat-value">${diffStats.totalChanges}</span></div>
                  <div class="stat-row">Applied: <span class="stat-value success">${diffStats.diffsApplied}</span></div>
                  <div class="stat-row">Cancelled: <span class="stat-value error">${diffStats.diffsCancelled}</span></div>
                </div>

                ${currentDiff ? (() => {
                  const totalChanges = currentDiff.changes.length;
                  const approvedChanges = currentDiff.changes.filter(c => c.approved).length;
                  const stats = { CREATE: 0, MODIFY: 0, DELETE: 0 };
                  currentDiff.changes.forEach(c => stats[c.operation]++);

                  return `
                    <div class="diff-box">
                      <div class="diff-box-title">Current Diff</div>
                      <div class="diff-stats-row">Total Changes: <span>${totalChanges}</span></div>
                      <div class="diff-stats-row">Approved: <span style="color: #0f0;">${approvedChanges}</span></div>
                      <div class="diff-stats-row">Pending: <span style="color: #ff0;">${totalChanges - approvedChanges}</span></div>
                      <div class="operation-stats">
                        <span class="op-create">+${stats.CREATE}</span>
                        <span class="op-modify">~${stats.MODIFY}</span>
                        <span class="op-delete">-${stats.DELETE}</span>
                      </div>
                    </div>
                  `;
                })() : ''}

                ${diffStats.totalApprovals > 0 || diffStats.totalRejections > 0 ? `
                  <div class="stats-box">
                    <div class="stats-box-title">All-Time Stats</div>
                    <div style="color: #aaa; font-size: 11px;">Approved: <span style="color: #0f0;">${diffStats.totalApprovals}</span></div>
                    <div style="color: #aaa; font-size: 11px;">Rejected: <span style="color: #f00;">${diffStats.totalRejections}</span></div>
                    ${diffStats.exportsGenerated > 0 ? `<div style="color: #aaa; font-size: 11px;">Exports: <span style="color: #0ff;">${diffStats.exportsGenerated}</span></div>` : ''}
                  </div>
                ` : ''}

                ${diffStats.lastDiff ? `
                  <div class="diff-box">
                    <div class="diff-box-title">Last Diff</div>
                    <div style="color: #aaa; font-size: 11px;">Session: ${diffStats.lastDiff.session || 'N/A'}</div>
                    <div style="color: #888; font-size: 10px;">${new Date(diffStats.lastDiff.timestamp).toLocaleString()}</div>
                  </div>
                ` : ''}

                ${diffStats.recentDiffs.length > 0 ? `
                  <div style="margin-top: 12px;">
                    <div class="section-title">Recent Diffs</div>
                    <div class="recent-diffs">
                      ${diffStats.recentDiffs.slice(0, 5).map(diff => `
                        <div class="recent-diff-item">
                          <span style="color: #aaa; font-size: 10px;">${new Date(diff.timestamp).toLocaleTimeString()}</span>
                          <span style="color: #888; font-size: 10px;">${diff.session || 'N/A'}</span>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

                ${diffStats.diffsShown === 0 ? '<div class="empty-state">No diffs shown yet</div>' : ''}
              </div>
            `;

            // Attach event listeners
            this.shadowRoot.querySelector('.approve-all')?.addEventListener('click', () => {
              approveAll();
              this.render();
            });

            this.shadowRoot.querySelector('.reject-all')?.addEventListener('click', () => {
              rejectAll();
              this.render();
            });

            this.shadowRoot.querySelector('.copy-diff')?.addEventListener('click', async () => {
              try {
                await copyToClipboard();
              } catch (error) {
                logger.error('[Widget] Copy failed:', error);
              }
            });

            this.shadowRoot.querySelector('.export-diff')?.addEventListener('click', () => {
              wrappedExportMarkdown();
            });
          }
        }

        if (!customElements.get('diff-viewer-ui-widget')) {
          customElements.define('diff-viewer-ui-widget', DiffViewerUIWidget);
        }

        return {
          element: 'diff-viewer-ui-widget',
          displayName: 'Diff Viewer',
          icon: '✎',
          category: 'ui',
          order: 80
        };
      })()
    };

    // Set as shared instance for global access
    if (typeof window !== 'undefined' && window.DiffViewerUI) {
      window.DiffViewerUI._setInstance(publicApi);
    }

    return publicApi;
  }
};

// Store module definition before setting up global API
const DiffViewerUIModule = DiffViewerUI;

// Register module and expose global API for onclick handlers
// Fix: Create a single shared instance instead of creating new instances on each call
if (typeof window !== 'undefined') {
  if (window.ModuleRegistry) {
    window.ModuleRegistry.register(DiffViewerUIModule);
  }

  // Create shared instance that will be initialized properly via DI container
  let sharedInstance = null;

  // Expose API for HTML onclick handlers
  window.DiffViewerUI = {
    // Internal method to set the shared instance (called by DI container)
    _setInstance: (instance) => {
      sharedInstance = instance;
    },

    init: (containerId) => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.init(containerId);
    },
    toggleExpand: (index) => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.toggleExpand(index);
    },
    toggleApproval: (index) => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.toggleApproval(index);
    },
    approveAll: () => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.approveAll();
    },
    rejectAll: () => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.rejectAll();
    },
    refresh: (payload) => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.refresh(payload);
    },
    applyApproved: () => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.applyApproved();
    },
    editProposal: () => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.editProposal();
    },
    cancel: () => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.cancel();
    },
    copyToClipboard: () => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.copyToClipboard();
    },
    exportMarkdown: () => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.exportMarkdown();
    },
    share: () => {
      if (!sharedInstance) {
        console.error('[DiffViewerUI] Not initialized. Call init() first.');
        return;
      }
      return sharedInstance.share();
    }
  };
}

export default DiffViewerUIModule;
