/**
 * Reploid WebRTC Swarm Widget
 *
 * WebRTC peer topology visualization
 * Connect, manage, and visualize peer-to-peer network
 */

import type { Dependencies, MCPServerInfo, WidgetFactory } from '../../schema';

const USE_MOCK_DATA = false;

let mockSwarmData: any;
if (USE_MOCK_DATA) {
  mockSwarmData = {
    peers: [
      { id: 'peer-1', name: 'Agent A', status: 'connected', latency: 45, messages: 128 },
      { id: 'peer-2', name: 'Agent B', status: 'connected', latency: 62, messages: 95 },
      { id: 'peer-3', name: 'Agent C', status: 'connecting', latency: 0, messages: 0 }
    ],
    topology: {
      nodes: ['self', 'peer-1', 'peer-2', 'peer-3'],
      edges: [['self', 'peer-1'], ['self', 'peer-2'], ['peer-1', 'peer-2']]
    }
  };
}

export default function createSwarmWidget(
  deps: Dependencies,
  serverInfo: MCPServerInfo
): WidgetFactory {
  const { EventBus, MCPBridge, Configuration } = deps;

  class SwarmWidget extends HTMLElement {
    private swarmState: any = null;
    private autoRefresh: boolean = true;
    private refreshInterval: any = null;
    private unsubscribers: Array<() => void> = [];

    constructor() {
      super();
      this.attachShadow({ mode: 'open' });
    }

    connectedCallback() {
      const unsub = EventBus.on('reploid:swarm:refresh', () => this.loadState());
      this.unsubscribers.push(unsub);
      this.loadState();
      this.startAutoRefresh();
    }

    disconnectedCallback() {
      this.unsubscribers.forEach(unsub => unsub());
      this.unsubscribers = [];
      this.stopAutoRefresh();
    }

    private startAutoRefresh() {
      if (this.autoRefresh && !this.refreshInterval) {
        this.refreshInterval = setInterval(() => this.loadState(), 3000);
      }
    }

    private stopAutoRefresh() {
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
        this.refreshInterval = null;
      }
    }

    private async loadState() {
      if (USE_MOCK_DATA) {
        this.swarmState = mockSwarmData;
        this.render();
        return;
      }

      try {
        const [peersResult, topologyResult] = await Promise.all([
          MCPBridge.callTool(serverInfo.serverName, 'list_peers', {}),
          MCPBridge.callTool(serverInfo.serverName, 'get_topology', {})
        ]);

        this.swarmState = {
          peers: JSON.parse(peersResult.content[0].text).peers,
          topology: JSON.parse(topologyResult.content[0].text)
        };
        this.render();
      } catch (error) {
        console.error('Failed to load swarm state:', error);
        this.showError('Failed to load swarm state');
      }
    }

    private async connectPeer() {
      const peerId = window.prompt('Enter peer ID to connect:');
      if (!peerId) return;

      if (USE_MOCK_DATA) {
        this.showSuccess(`Connected to ${peerId} (mock)`);
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'connect_peer', { peer_id: peerId });
        this.showSuccess(`Connected to peer ${peerId}`);
        await this.loadState();
      } catch (error) {
        console.error('Failed to connect peer:', error);
        this.showError('Failed to connect peer');
      }
    }

    private async disconnectPeer(peerId: string) {
      if (!confirm(`Disconnect from ${peerId}?`)) return;

      if (USE_MOCK_DATA) {
        this.swarmState.peers = this.swarmState.peers.filter((p: any) => p.id !== peerId);
        this.showSuccess(`Disconnected from ${peerId} (mock)`);
        this.render();
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'disconnect_peer', { peer_id: peerId });
        this.showSuccess(`Disconnected from peer ${peerId}`);
        await this.loadState();
      } catch (error) {
        console.error('Failed to disconnect peer:', error);
        this.showError('Failed to disconnect peer');
      }
    }

    private async sendMessage(peerId: string) {
      const message = window.prompt(`Send message to ${peerId}:`);
      if (!message) return;

      if (USE_MOCK_DATA) {
        this.showSuccess(`Message sent to ${peerId} (mock)`);
        return;
      }

      try {
        await MCPBridge.callTool(serverInfo.serverName, 'send_message', {
          peer_id: peerId,
          message: message
        });
        this.showSuccess(`Message sent to ${peerId}`);
      } catch (error) {
        console.error('Failed to send message:', error);
        this.showError('Failed to send message');
      }
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

      if (!this.swarmState) {
        this.shadowRoot.innerHTML = `<style>${this.getStyles()}</style><div class="loading">Loading...</div>`;
        return;
      }

      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="swarm-widget">
          <div class="widget-header">
            <h3>🌐 WebRTC Swarm</h3>
            <div class="header-actions">
              <label class="auto-refresh">
                <input type="checkbox" ${this.autoRefresh ? 'checked' : ''}>
                <span>Auto</span>
              </label>
              <button class="btn-connect">+ Connect</button>
            </div>
          </div>

          <div class="widget-content">
            <div class="peers-section">
              <div class="section-title">Connected Peers (${this.swarmState.peers.length})</div>
              ${this.swarmState.peers.length === 0 ? `
                <div class="empty">No peers connected</div>
              ` : this.swarmState.peers.map((peer: any) => `
                <div class="peer-card status-${peer.status}">
                  <div class="peer-header">
                    <span class="peer-name">${peer.name}</span>
                    <span class="peer-status">${peer.status}</span>
                  </div>
                  <div class="peer-stats">
                    <span>Latency: ${peer.latency}ms</span>
                    <span>Messages: ${peer.messages}</span>
                  </div>
                  <div class="peer-actions">
                    <button class="btn-message" data-peer="${peer.id}">Send Message</button>
                    <button class="btn-disconnect" data-peer="${peer.id}">Disconnect</button>
                  </div>
                </div>
              `).join('')}
            </div>

            <div class="topology-section">
              <div class="section-title">Network Topology</div>
              <div class="topology-viz">
                <div class="topology-info">
                  Nodes: ${this.swarmState.topology.nodes.length}<br>
                  Connections: ${this.swarmState.topology.edges.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      `;

      this.attachEventListeners();
    }

    private attachEventListeners() {
      this.shadowRoot?.querySelector('.auto-refresh input')?.addEventListener('change', (e) => {
        this.autoRefresh = (e.target as HTMLInputElement).checked;
        if (this.autoRefresh) this.startAutoRefresh();
        else this.stopAutoRefresh();
      });

      this.shadowRoot?.querySelector('.btn-connect')?.addEventListener('click', () => this.connectPeer());

      this.shadowRoot?.querySelectorAll('.btn-disconnect').forEach(btn => {
        btn.addEventListener('click', () => {
          const peer = (btn as HTMLElement).dataset.peer;
          if (peer) this.disconnectPeer(peer);
        });
      });

      this.shadowRoot?.querySelectorAll('.btn-message').forEach(btn => {
        btn.addEventListener('click', () => {
          const peer = (btn as HTMLElement).dataset.peer;
          if (peer) this.sendMessage(peer);
        });
      });
    }

    private getStyles() {
      return `
        :host { display: block; font-family: 'Courier New', monospace; color: #e0e0e0; }
        .swarm-widget { background: rgba(40, 40, 40, 0.6); border: 2px solid #333; height: 600px; display: flex; flex-direction: column; }
        .widget-header { background: rgba(20, 20, 20, 0.8); padding: 16px; border-bottom: 2px solid #333; display: flex; justify-content: space-between; }
        .widget-header h3 { margin: 0; color: #4fc1ff; font-size: 16px; }
        .header-actions { display: flex; gap: 8px; align-items: center; }
        .auto-refresh { font-size: 10px; color: #888; cursor: pointer; display: flex; gap: 4px; }
        .btn-connect { padding: 6px 12px; background: rgba(79, 193, 255, 0.2); border: 1px solid rgba(79, 193, 255, 0.4); color: #4fc1ff; cursor: pointer; font-family: 'Courier New', monospace; font-size: 11px; }
        .widget-content { flex: 1; overflow-y: auto; padding: 16px; }
        .section-title { font-size: 12px; font-weight: bold; color: #4fc1ff; margin-bottom: 12px; }
        .peers-section { margin-bottom: 20px; }
        .empty { padding: 20px; text-align: center; color: #666; }
        .peer-card { background: rgba(30, 30, 30, 0.8); border: 2px solid #444; padding: 12px; margin-bottom: 8px; }
        .peer-card.status-connected { border-left: 4px solid #4ec9b0; }
        .peer-card.status-connecting { border-left: 4px solid #ffaa00; }
        .peer-card.status-disconnected { border-left: 4px solid #f44747; }
        .peer-header { display: flex; justify-content: space-between; margin-bottom: 8px; }
        .peer-name { font-size: 13px; font-weight: bold; color: #9cdcfe; }
        .peer-status { font-size: 10px; padding: 2px 8px; border-radius: 10px; background: rgba(78, 201, 176, 0.3); color: #4ec9b0; }
        .peer-stats { font-size: 11px; color: #888; display: flex; gap: 16px; margin-bottom: 8px; }
        .peer-actions { display: flex; gap: 6px; }
        .peer-actions button { flex: 1; padding: 6px; border: 1px solid; cursor: pointer; font-family: 'Courier New', monospace; font-size: 10px; }
        .btn-message { background: rgba(79, 193, 255, 0.2); border-color: rgba(79, 193, 255, 0.4); color: #4fc1ff; }
        .btn-disconnect { background: rgba(244, 71, 71, 0.2); border-color: rgba(244, 71, 71, 0.4); color: #f44747; }
        .topology-section { }
        .topology-viz { background: rgba(30, 30, 30, 0.8); border: 1px solid #444; padding: 20px; text-align: center; }
        .topology-info { font-size: 12px; color: #9cdcfe; line-height: 1.8; }
        .toast { position: fixed; bottom: 20px; right: 20px; padding: 12px 20px; border-radius: 4px; z-index: 10000; }
        .toast-error { background: #f44747; color: white; }
        .toast-success { background: #4ec9b0; color: #000; }
      `;
    }
  }

  if (!customElements.get('reploid-swarm')) {
    customElements.define('reploid-swarm', SwarmWidget);
  }

  return {
    api: {
      async initialize() {
        console.log('[SwarmWidget] Initialized');
        EventBus.emit('mcp:widget:initialized', { element: 'reploid-swarm', displayName: 'WebRTC Swarm' });
      },
      async destroy() { console.log('[SwarmWidget] Destroyed'); },
      async refresh() { EventBus.emit('reploid:swarm:refresh', {}); }
    },
    widget: {
      protocolVersion: '1.0.0',
      element: 'reploid-swarm',
      displayName: 'WebRTC Swarm',
      description: 'Connect, manage, and visualize peer-to-peer network topology',
      capabilities: { tools: true, resources: false, prompts: false },
      permissions: { tools: ['connect_peer', 'disconnect_peer', 'list_peers', 'send_message', 'get_topology'] },
      category: 'networking',
      tags: ['reploid', 'webrtc', 'swarm', 'p2p', 'topology']
    }
  };
}
