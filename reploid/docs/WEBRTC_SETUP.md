# WebRTC Swarm Setup Guide

This guide explains how to configure and use the WebRTC-based swarm functionality in PAWS/REPLOID for cross-origin peer-to-peer communication between agent instances.

## Architecture Overview

The WebRTC swarm uses a **centralized signaling server** (WebSocket-based) for peer discovery and connection negotiation, followed by **direct P2P connections** (WebRTC) for data transfer.

```
┌─────────────┐        ┌─────────────┐        ┌─────────────┐
│   Peer A    │        │  Signaling  │        │   Peer B    │
│  (Browser)  │◄──WS──►│   Server    │◄──WS──►│  (Browser)  │
└─────────────┘        │ (Node.js)   │        └─────────────┘
       │               └─────────────┘               │
       │                                             │
       └──────────── WebRTC P2P Data ───────────────┘
```

## Quick Start

### 1. Start the Signaling Server

The signaling server is automatically started when you run the proxy:

```bash
npm run reploid:start
```

This will start:
- HTTP API server on `http://localhost:8000`
- WebRTC signaling server on `ws://localhost:8000/signaling`

### 2. Configure WebRTC Settings

Edit `reploid/config.json` to customize WebRTC behavior:

```json
{
  "webrtc": {
    "signalingServer": "ws://localhost:8000/signaling",
    "roomId": "reploid-swarm-default",
    "reconnectInterval": 5000,
    "peerTimeout": 60000,
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" },
      { "urls": "stun:stun1.l.google.com:19302" }
    ],
    "turnServers": {
      "enabled": false,
      "servers": []
    }
  }
}
```

### 3. Open Multiple Browser Instances

Open `http://localhost:8080` in multiple browser tabs or windows. The agents will automatically:
1. Connect to the signaling server
2. Join the default room
3. Establish P2P connections with other peers
4. Sync state and capabilities

## Configuration Options

### Signaling Server

| Option | Default | Description |
|--------|---------|-------------|
| `signalingServer` | `ws://localhost:8000/signaling` | WebSocket URL for signaling |
| `roomId` | `reploid-swarm-default` | Room ID for peer grouping |
| `reconnectInterval` | `5000` | Auto-reconnect interval (ms) |
| `peerTimeout` | `60000` | Peer inactivity timeout (ms) |

### ICE Servers (STUN)

STUN servers help peers discover their public IP addresses for NAT traversal:

```json
{
  "iceServers": [
    { "urls": "stun:stun.l.google.com:19302" },
    { "urls": "stun:stun1.l.google.com:19302" },
    { "urls": "stun:stun.services.mozilla.com" }
  ]
}
```

**Free Public STUN Servers:**
- Google: `stun.l.google.com:19302`, `stun1.l.google.com:19302`
- Mozilla: `stun.services.mozilla.com`
- Twilio: `global.stun.twilio.com:3478`

### TURN Servers (For Restrictive NATs)

TURN servers relay traffic when direct P2P connections fail (e.g., behind symmetric NATs or corporate firewalls).

#### Example Configuration

```json
{
  "turnServers": {
    "enabled": true,
    "servers": [
      {
        "urls": "turn:turnserver.example.com:3478",
        "username": "your-username",
        "credential": "your-password"
      },
      {
        "urls": "turns:turnserver.example.com:5349",
        "username": "your-username",
        "credential": "your-password"
      }
    ]
  }
}
```

#### Setting Up Your Own TURN Server

**Option 1: Coturn (Open Source)**

1. Install Coturn:
```bash
# Ubuntu/Debian
sudo apt-get install coturn

# macOS
brew install coturn
```

2. Configure `/etc/turnserver.conf`:
```ini
listening-port=3478
tls-listening-port=5349
listening-ip=0.0.0.0
relay-ip=YOUR_PUBLIC_IP
external-ip=YOUR_PUBLIC_IP

user=username:password
realm=example.com

cert=/etc/letsencrypt/live/turnserver.example.com/fullchain.pem
pkey=/etc/letsencrypt/live/turnserver.example.com/privkey.pem
```

3. Start Coturn:
```bash
sudo turnserver -c /etc/turnserver.conf
```

**Option 2: Managed TURN Services**

- **Twilio STUN/TURN**: https://www.twilio.com/stun-turn
- **Xirsys**: https://xirsys.com/
- **Metered.ca**: https://www.metered.ca/stun-turn

#### Testing TURN Connectivity

Use the [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) test page:
1. Add your TURN server URL, username, and credential
2. Click "Gather candidates"
3. Look for `relay` type candidates (indicates TURN working)

## Production Deployment

### 1. Deploy Signaling Server

Deploy the Node.js signaling server to a cloud provider:

**Heroku:**
```bash
cd reploid/server
heroku create your-app-name
git push heroku main
```

**DigitalOcean/AWS/GCP:**
```bash
# Install dependencies
npm install

# Start with PM2
pm2 start proxy.js --name reploid-signaling

# Configure firewall
ufw allow 8000/tcp  # HTTP API
```

### 2. Update Client Configuration

Update `reploid/config.json` with production URLs:

```json
{
  "webrtc": {
    "signalingServer": "wss://your-signaling-server.com/signaling",
    "roomId": "production-swarm",
    "iceServers": [
      { "urls": "stun:stun.l.google.com:19302" },
      {
        "urls": "turn:your-turn-server.com:3478",
        "username": "prod-user",
        "credential": "prod-password"
      }
    ]
  }
}
```

### 3. Enable HTTPS/WSS

For production, always use secure WebSockets (`wss://`) and HTTPS:

**Nginx Configuration:**
```nginx
server {
    listen 443 ssl;
    server_name your-signaling-server.com;

    ssl_certificate /etc/letsencrypt/live/your-domain/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain/privkey.pem;

    location /signaling {
        proxy_pass http://localhost:8000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:8000;
    }
}
```

## API Usage

### Programmatic Configuration

```javascript
// Get WebRTC swarm instance
const WebRTCSwarm = await window.bootloader.getModule('WebRTCSwarm');

// Configure signaling
WebRTCSwarm.configureSignaling({
  signalingServer: 'wss://your-server.com/signaling',
  roomId: 'custom-room',
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    {
      urls: 'turn:turnserver.com:3478',
      username: 'user',
      credential: 'pass'
    }
  ]
});

// Check connection status
const status = WebRTCSwarm.getSignalingStatus();
console.log('Connected:', status.connected);
console.log('Room:', status.roomId);
console.log('Peer ID:', status.peerId);

// Get swarm statistics
const stats = WebRTCSwarm.getStats();
console.log('Connected peers:', stats.connectedPeers);
```

### Task Delegation

```javascript
// Delegate task to swarm
const result = await WebRTCSwarm.delegateTask({
  name: 'code-generation',
  requirements: ['LocalLLM', 'Python'],
  payload: {
    prompt: 'Generate a function to calculate fibonacci',
    language: 'python'
  }
});

console.log('Task result:', result);
```

### Knowledge Sharing

```javascript
// Share artifact with swarm
const sharedCount = await WebRTCSwarm.shareKnowledge('artifact-id-123');
console.log(`Shared with ${sharedCount} peers`);
```

### Consensus Voting

```javascript
// Request consensus for risky operation
const result = await WebRTCSwarm.requestConsensus({
  type: 'code-modification',
  content: 'Modify system-critical file',
  risk: 'high'
}, 30000);

if (result.consensus) {
  console.log('Swarm approved operation');
} else {
  console.log('Swarm rejected operation');
}
```

## Monitoring

### Signaling Server Stats

```bash
curl http://localhost:8000/api/signaling/stats
```

Response:
```json
{
  "totalRooms": 2,
  "totalPeers": 5,
  "rooms": [
    {
      "roomId": "reploid-swarm-default",
      "peerCount": 3,
      "peers": ["reploid-abc123", "reploid-def456", "reploid-ghi789"]
    }
  ]
}
```

### Browser Console

```javascript
// Get real-time swarm stats
const stats = WebRTCSwarm.getStats();
console.table(stats.peers);
```

## Troubleshooting

### Connection Issues

**Problem:** Peers can't connect

1. Check signaling server is running:
   ```bash
   curl http://localhost:8000/api/health
   ```

2. Verify WebSocket connection in browser console:
   ```javascript
   const status = WebRTCSwarm.getSignalingStatus();
   console.log(status.connected); // Should be true
   ```

3. Check browser console for WebRTC errors

**Problem:** Connections work locally but fail across networks

- Add TURN servers (see TURN configuration above)
- Check firewall rules allow UDP traffic
- Verify NAT traversal with `chrome://webrtc-internals`

### TURN Server Not Working

1. Test TURN server with [Trickle ICE](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/)
2. Check credentials are correct
3. Verify TURN server ports (3478 UDP/TCP, 5349 TLS) are open
4. Check TURN server logs

### High Latency

- Use geographically closer signaling/TURN servers
- Reduce `peerTimeout` and `reconnectInterval` values
- Check network bandwidth with WebRTC stats

## Security Considerations

### Signaling Server

- Use WSS (secure WebSockets) in production
- Implement authentication for room access
- Rate-limit connections to prevent DoS
- Validate all incoming messages

### P2P Connections

- All WebRTC data channels are **encrypted by default** using DTLS (Datagram Transport Layer Security)[^1]
- Media streams use SRTP (Secure Real-time Transport Protocol) with keys exchanged via DTLS-SRTP[^2]
- Encryption is **mandatory** in WebRTC specification - cannot be disabled
- Implement application-level validation for shared artifacts
- Use consensus voting for risky operations
- Audit all received code before execution

### TURN Server

- Use strong passwords (20+ characters)
- Rotate credentials regularly
- Limit bandwidth per user
- Monitor for abuse

## Advanced Configuration

### Custom Rooms

Create isolated swarms by using different room IDs:

```javascript
WebRTCSwarm.configureSignaling({
  roomId: 'team-alpha-swarm'
});
```

### Dynamic ICE Server Configuration

Load ICE servers from API:

```javascript
const iceConfig = await fetch('/api/ice-servers').then(r => r.json());

WebRTCSwarm.configureSignaling({
  iceServers: iceConfig.servers
});
```

### Custom Message Handlers

Register handlers for custom P2P messages:

```javascript
WebRTCSwarm.registerMessageHandler('custom-action', async (peerId, message) => {
  console.log(`Received custom action from ${peerId}:`, message);
  // Handle message
});
```

## Performance Tuning

### Reduce Signaling Server Load

- Increase `peerTimeout` to reduce heartbeat frequency
- Use rooms to isolate peer groups
- Implement lazy connection (connect only when needed)

### Optimize P2P Bandwidth

- Compress large payloads before sending
- Use streaming for large artifacts
- Implement data prioritization

### Connection Resilience

- Enable automatic reconnection
- Implement connection quality monitoring
- Fall back to signaling relay if P2P fails

## References

### Official Documentation
- [WebRTC API Documentation](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
- [WebRTC Samples](https://webrtc.github.io/samples/)
- [STUN/TURN Protocol RFCs](https://datatracker.ietf.org/doc/html/rfc5389)

### Security & Encryption
[^1]: [WebRTC Security Architecture](https://webrtc-security.github.io/) - Comprehensive security study
[^2]: [Understanding WebRTC Security](https://antmedia.io/webrtc-security/) - DTLS-SRTP encryption explained
- [WebRTC Encryption Guide](https://webrtcforthecurious.com/docs/04-securing/)
- [Deep Dive into DTLS-SRTP](https://soufianebouchaara.com/a-deep-dive-into-webrtcs-dtls-srtp-securing-real-time-communication/)

### Infrastructure
- [Coturn TURN Server](https://github.com/coturn/coturn) - Open-source TURN server
- [Trickle ICE Test Tool](https://webrtc.github.io/samples/src/content/peerconnection/trickle-ice/) - Test STUN/TURN connectivity

### Browser Support
- [WebGPU Browser Support](https://caniuse.com/webgpu) - Current browser compatibility
- [Chrome WebGPU Documentation](https://developer.chrome.com/docs/web-platform/webgpu)
