/**
 * Reploid Peer Review Widget
 *
 * Code review consensus UI
 * Submit code for peer review and view consensus results
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

const USE_MOCK_DATA = false;

let mockReviewData: any;
if (USE_MOCK_DATA) {
  mockReviewData = {
    activeReviews: [
      {
        id: 'review-1',
        code: 'function add(a, b) { return a + b; }',
        reviewers: ['reviewer-1', 'reviewer-2', 'reviewer-3'],
        critiques: [
          { reviewer: 'reviewer-1', score: 8, comments: 'Good, but needs types' },
          { reviewer: 'reviewer-2', score: 7, comments: 'Add input validation' }
        ],
        consensus: null,
        status: 'in_progress'
      }
    ]
  };
}

export default function createPeerReviewWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class PeerReviewWidget extends HTMLElement {
    private reviewState: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      const unsub = EventBus.on('reploid:peer-review:refresh', () => this.loadState());
      this.unsubscribers.push(unsub);
      this.loadState();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
    }

    private async loadState() {
      if (USE_MOCK_DATA) {
        this.reviewState = mockReviewData;
        this.render();
        return;
      }

      try {
        const result = await MCPBridge.callTool(serverInfo.serverName, 'get_active_reviews', {});
        this.reviewState = JSON.parse(result.content[0].text);
        this.render();
      } catch (error) {
        console.error('Failed to load peer review state:', error);
        this.showError('Failed to load reviews');
      }
    }

    private async startReview() {
      const code = window.prompt('Enter code to review:');
      if (!code) return;

      if (USE_MOCK_DATA) {
        this.showSuccess('Review started (mock)');
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'start_review', { code });
        this.showSuccess('Review started successfully');
        await this.loadState();
      } catch (error) {
        console.error('Failed to start review:', error);
        this.showError('Failed to start review');
      }
    }

    private async getConsensus(reviewId: string) {
      if (USE_MOCK_DATA) {
        alert('Consensus (mock):\n\nAverage Score: 7.5/10\nRecommendation: Needs improvements');
        return;
      }

      try {
        const result = await MCPBridge.callTool(serverInfo.serverName, 'get_consensus', { review_id: reviewId });
        const consensus = JSON.parse(result.content[0].text);
        this.showConsensus(consensus);
      } catch (error) {
        console.error('Failed to get consensus:', error);
        this.showError('Failed to get consensus');
      }
    }

    private showConsensus(consensus: any) {
      const modal = document.createElement('div');
      modal.className = 'consensus-modal';
      modal.innerHTML = `
        <div class="modal-content">
          <div class="modal-header">
            <h3>Review Consensus</h3>
            <button class="modal-close">✕</button>
          </div>
          <div class="modal-body">
            <pre>${this.escapeHtml(JSON.stringify(consensus, null, 2))}</pre>
          </div>
        </div>
      `;
      modal.querySelector('.modal-close')?.addEventListener('click', () => modal.remove());
      this.shadowRoot?.appendChild(modal);
    }

    private showError(message: string) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-error';
      toast.textContent = message;
      this.shadowRoot?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    private showSuccess(message: string) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-success';
      toast.textContent = message;
      this.shadowRoot?.appendChild(toast);
      setTimeout(() => toast.remove(), 3000);
    }

    private render() {
      if (!this.shadowRoot) return;

      if (!this.reviewState) {
        this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="loading">Loading...</div>`;
        return;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="peer-review-widget">
          <div class="widget-header">
            <h3>👥 Peer Review</h3>
            <button class="btn-start">+ Start Review</button>
          </div>

          <div class="widget-content">
            ${(this.reviewState.activeReviews || []).length === 0 ? `
              <div class="empty">No active reviews</div>
            ` : (this.reviewState.activeReviews || []).map((review: any) => `
              <div class="review-card">
                <div class="review-header">
                  <span class="review-id">${review.id}</span>
                  <span class="review-status status-${review.status}">${review.status}</span>
                </div>

                <div class="code-block">
                  <pre><code>${this.escapeHtml(review.code)}</code></pre>
                </div>

                <div class="reviewers-section">
                  <div class="section-label">Reviewers (${review.reviewers.length}):</div>
                  <div class="reviewers-list">${review.reviewers.join(', ')}</div>
                </div>

                <div class="critiques-section">
                  <div class="section-label">Critiques (${review.critiques.length}):</div>
                  ${review.critiques.map((critique: any) => `
                    <div class="critique-item">
                      <div class="critique-header">
                        <span class="reviewer">${critique.reviewer}</span>
                        <span class="score">Score: ${critique.score}/10</span>
                      </div>
                      <div class="critique-comments">${this.escapeHtml(critique.comments)}</div>
                    </div>
                  `).join('')}
                </div>

                <button class="btn-consensus" data-review="${review.id}">Get Consensus</button>
              </div>
            `).join('')}
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private attachEventListeners() {
      this.shadowRoot?.querySelector('.btn-start')?.addEventListener('click', () => this.startReview());

      this.shadowRoot?.querySelectorAll('.btn-consensus').forEach(btn => {
        btn.addEventListener('click', () => {
          const review = (btn as HTMLElement).dataset.review;
          if (review) this.getConsensus(review);
        });
      });
    }

    private escapeHtml(text: string): string {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    private getStyles() {
      return `
        :host { display: block; font-family: 'Courier New', monospace; color: #e0e0e0; }
        .peer-review-widget { background: rgba(40, 40, 40, 0.6); border: 2px solid #333; height: 600px; display: flex; flex-direction: column; }
        .widget-header { background: rgba(20, 20, 20, 0.8); padding: 16px; border-bottom: 2px solid #333; display: flex; justify-content: space-between; }
        .widget-header h3 { margin: 0; color: #d16969; font-size: 16px; }
        .btn-start { padding: 6px 12px; background: rgba(209, 105, 105, 0.2); border: 1px solid rgba(209, 105, 105, 0.4); color: #d16969; cursor: pointer; font-family: 'Courier New', monospace; font-size: 11px; }
        .widget-content { flex: 1; overflow-y: auto; padding: 16px; }
        .empty { padding: 60px 20px; text-align: center; color: #666; }
        .review-card { background: rgba(30, 30, 30, 0.8); border: 2px solid #444; padding: 16px; margin-bottom: 16px; }
        .review-header { display: flex; justify-content: space-between; margin-bottom: 12px; }
        .review-id { font-size: 12px; font-weight: bold; color: #9cdcfe; }
        .review-status { font-size: 10px; padding: 2px 8px; border-radius: 10px; }
        .status-in_progress { background: rgba(79, 193, 255, 0.3); color: #4fc1ff; }
        .status-completed { background: rgba(78, 201, 176, 0.3); color: #4ec9b0; }
        .code-block { background: rgba(20, 20, 20, 0.8); border: 1px solid #555; padding: 12px; margin-bottom: 12px; overflow-x: auto; }
        .code-block pre { margin: 0; }
        .code-block code { font-size: 11px; color: #dcdcaa; }
        .section-label { font-size: 11px; color: #888; margin-bottom: 6px; font-weight: bold; }
        .reviewers-section, .critiques-section { margin-bottom: 12px; }
        .reviewers-list { font-size: 11px; color: #9cdcfe; }
        .critique-item { background: rgba(20, 20, 20, 0.8); border-left: 3px solid #d16969; padding: 10px; margin-bottom: 8px; }
        .critique-header { display: flex; justify-content: space-between; margin-bottom: 6px; }
        .reviewer { font-size: 11px; color: #9cdcfe; font-weight: bold; }
        .score { font-size: 11px; color: #d16969; }
        .critique-comments { font-size: 11px; color: #cccccc; line-height: 1.5; }
        .btn-consensus { width: 100%; padding: 8px; background: rgba(78, 201, 176, 0.2); border: 1px solid rgba(78, 201, 176, 0.4); color: #4ec9b0; cursor: pointer; font-family: 'Courier New', monospace; font-size: 11px; }
        .consensus-modal { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.8); display: flex; align-items: center; justify-content: center; z-index: 10000; }
        .modal-content { background: #1e1e1e; border: 2px solid #444; width: 600px; max-width: 90%; }
        .modal-header { padding: 16px; background: #252526; border-bottom: 1px solid #444; display: flex; justify-content: space-between; }
        .modal-header h3 { margin: 0; color: #d16969; }
        .modal-close { background: none; border: none; color: #888; font-size: 24px; cursor: pointer; }
        .modal-body { padding: 16px; max-height: 400px; overflow-y: auto; }
        .modal-body pre { margin: 0; color: #cccccc; font-size: 12px; }
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 4px; z-index: 10000; }
        .toast-error { background: #f44747; color: white; }
        .toast-success { background: #4ec9b0; color: #000; }
      `;
    }
  }

  if (!customElements.get('reploid-peer-review')) {
    customElements.define('reploid-peer-review', PeerReviewWidget);
  }

  return {
    api: {
      async initialize() {
        console.log('[PeerReviewWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', { element: 'reploid-peer-review', displayName: 'Peer Review' });
      },
      async destroy() { console.log('[PeerReviewWidget] Destroyed'); },
      async refresh() { EventBus.emit('reploid:peer-review:refresh', {}); }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-peer-review',
      displayName: 'Peer Review',
      description: 'Submit code for peer review and view consensus results',
      capabilities: { tools: true, resources: false, prompts: false },
      permissions: { tools: ['start_review', 'submit_critique', 'get_consensus', 'configure_reviewers', 'get_report'] },
      category: 'review',
      tags: ['reploid', 'peer-review', 'consensus', 'code-review']
    }
  };
}
