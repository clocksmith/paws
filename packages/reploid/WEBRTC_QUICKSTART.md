# WebRTC P2P Swarm - Quick Start

## What Changed?

The WebRTC swarm module has been upgraded from **same-origin only** (BroadcastChannel) to **cross-origin capable** (WebSocket signaling + WebRTC P2P).

### Before
```
❌ Limited to same browser tabs on same domain
❌ No cross-origin communication
❌ Not suitable for production multi-user scenarios
```

### After
```
✅ Cross-origin P2P connections
✅ Production-ready signaling server
✅ STUN/TURN support for NAT traversal
✅ Automatic reconnection and peer discovery
```

## Testing Locally

### 1. Start the Signaling Server

```bash
cd /Users/xyz/deco/paws
npm run reploid:start
```

You should see:
```
╔════════════════════════════════════════════════════════╗
║   HTTP API: http://localhost:8000                      ║
║   WebRTC Signaling: ws://localhost:8000/signaling      ║
╚════════════════════════════════════════════════════════╝
```

### 2. Open Multiple Browser Instances

Open these URLs in **separate browser windows** (or different browsers):

- Window 1: `http://localhost:8080`
- Window 2: `http://localhost:8080`
- Window 3: `http://localhost:8080` (optional)

### 3. Verify Connection

Open browser console (F12) and check for:

```javascript
[WebRTCSwarm] Connected to signaling server
[WebRTCSwarm] Joined room reploid-swarm-default
[WebRTCSwarm] Found 2 existing peers
[WebRTCSwarm] Connecting to peer: reploid-abc123
[WebRTCSwarm] Data channel opened with reploid-abc123
```

### 4. Test P2P Communication

In any browser console:

```javascript
// Get WebRTC swarm instance
const swarm = await window.bootloader.getModule('WebRTCSwarm');

// Check connection status
console.log(swarm.getSignalingStatus());
// Output: { connected: true, server: "ws://localhost:8000/signaling", roomId: "reploid-swarm-default", peerId: "reploid-xyz789" }

// Get peer stats
console.log(swarm.getStats());
// Output: { peerId: "reploid-xyz789", totalPeers: 2, connectedPeers: 2, peers: [...] }

// Broadcast message to all peers
swarm.broadcast({ type: 'test', message: 'Hello from peer!' });

// Send to specific peer
const peerList = swarm.getStats().peers;
const targetPeer = peerList[0].id;
swarm.sendToPeer(targetPeer, { type: 'direct-message', data: 'Hi there!' });
```

## Running Tests

### Unit Tests (Signaling Server)

```bash
cd /Users/xyz/deco/paws/reploid
npx vitest tests/webrtc-signaling.test.js
```

Expected output:
```
✓ Connection > should accept WebSocket connections
✓ Connection > should send welcome message on connection
✓ Room Management > should allow peer to join a room
✓ Room Management > should notify existing peers when new peer joins
✓ Signaling Messages > should forward offer to target peer
✓ Signaling Messages > should forward answer to target peer
✓ Signaling Messages > should forward ICE candidates
✓ Peer Management > should notify room when peer leaves
✓ Peer Management > should handle broadcast messages
✓ Statistics > should provide accurate stats

Test Files  1 passed (1)
Tests  10 passed (10)
```

### Integration Test (Browser)

1. Start signaling server: `npm run reploid:start`
2. Open 2 browser tabs: `http://localhost:8080`
3. Run in Console 1:
```javascript
const swarm = await window.bootloader.getModule('WebRTCSwarm');
swarm.registerMessageHandler('test-echo', (peerId, msg) => {
  console.log('Received echo from', peerId, ':', msg);
});
```

4. Run in Console 2:
```javascript
const swarm = await window.bootloader.getModule('WebRTCSwarm');
const peers = swarm.getStats().peers;
swarm.sendToPeer(peers[0].id, { type: 'test-echo', text: 'Hello!' });
```

5. Check Console 1 for the echoed message

## Testing with Local Models

### 1. Start Ollama

```bash
ollama serve
ollama pull llama2
```

### 2. Configure REPLOID

Open browser console:

```javascript
// Enable local LLM
const localLLM = await window.bootloader.getModule('LocalLLM');
await localLLM.initialize('Llama-3.2-1B-Instruct-q4f16_1-MLC');

// Enable hybrid provider
const hybridLLM = await window.bootloader.getModule('HybridLLMProvider');
hybridLLM.setMode('local');

// Verify
console.log(hybridLLM.getStatus());
// Output: { mode: 'local', localAvailable: true, localReady: true, ... }
```

### 3. Test Multi-Agent Task Delegation

```javascript
// Get swarm orchestrator
const swarm = await window.bootloader.getModule('SwarmOrchestrator');

// Delegate code generation task
const result = await swarm.delegateTask({
  type: 'code-generation',
  requirements: ['LocalLLM'],
  prompt: 'Write a Python function to calculate factorial',
  timeout: 30000
});

console.log('Generated code:', result);
```

## Cross-Origin Testing (Production Scenario)

### Option 1: Different Ports (Same Machine)

Terminal 1:
```bash
cd /Users/xyz/deco/paws/reploid
PORT=8000 node server/proxy.js
```

Terminal 2:
```bash
cd /Users/xyz/deco/paws/reploid
python3 -m http.server 8080
```

Terminal 3:
```bash
cd /Users/xyz/deco/paws/reploid
python3 -m http.server 8081
```

Open:
- Browser 1: `http://localhost:8080`
- Browser 2: `http://localhost:8081`

Both will connect to the same signaling server on `:8000`

### Option 2: Different Machines (LAN)

1. Find your local IP: `ifconfig | grep inet`
2. Update `reploid/config.json`:
```json
{
  "webrtc": {
    "signalingServer": "ws://192.168.1.100:8000/signaling"
  }
}
```

3. Start server on Machine 1:
```bash
node server/proxy.js
```

4. Access from Machine 2:
```
http://192.168.1.100:8080
```

## Monitoring

### Check Signaling Server Stats

```bash
curl http://localhost:8000/api/signaling/stats | jq
```

Output:
```json
{
  "totalRooms": 1,
  "totalPeers": 3,
  "rooms": [
    {
      "roomId": "reploid-swarm-default",
      "peerCount": 3,
      "peers": [
        "reploid-abc123",
        "reploid-def456",
        "reploid-ghi789"
      ]
    }
  ]
}
```

### Monitor WebRTC Internals

Chrome/Edge: Navigate to `chrome://webrtc-internals`

- View peer connection states
- Check ICE candidate gathering
- Monitor data channel traffic
- Debug connection failures

## Troubleshooting

### "Failed to connect to signaling server"

Check:
1. Is proxy server running? `curl http://localhost:8000/api/health`
2. WebSocket port blocked? Try different port in config
3. Browser console errors?

### "Peer connections established but no data"

Check:
1. WebRTC data channel state in `chrome://webrtc-internals`
2. Firewall blocking UDP? (WebRTC uses UDP for data)
3. Try adding TURN servers (see `docs/WEBRTC_SETUP.md`)

### "Peers can't connect across networks"

Add TURN server to `reploid/config.json`:
```json
{
  "webrtc": {
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" },
      {
        "urls": "turn:turnserver.example.com:3478",
        "username": "your-username",
        "credential": "your-password"
      }
    ]
  }
}
```

See full setup guide: `reploid/docs/WEBRTC_SETUP.md`

## Next Steps

1. ✅ **Signaling Server**: Working (WebSocket-based)
2. ✅ **STUN Support**: Configured (Google STUN servers)
3. ⚠️ **TURN Support**: Not configured (add your own or use cloud service)
4. ⚠️ **Production Deployment**: See `docs/WEBRTC_SETUP.md`

## Need Help?

- Full documentation: `reploid/docs/WEBRTC_SETUP.md`
- API reference: See inline JSDoc in `reploid/upgrades/webrtc-swarm.js`
- Signaling server code: `reploid/server/signaling-server.js`
- Test examples: `reploid/tests/webrtc-signaling.test.js`
