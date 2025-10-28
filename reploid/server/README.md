# Server Directory

**Purpose**: Server-side components for proxy services and WebRTC signaling.

## Contents

| File | Purpose |
|------|---------|
| `proxy.js` | HTTP proxy server for API requests and CORS handling |
| `signaling-server.js` | WebRTC signaling server for peer-to-peer swarm communication |

## Proxy Server

**File**: `proxy.js`

Provides:
- CORS proxy for cross-origin API requests
- Request/response logging
- Rate limiting and caching
- API key management

**Usage**:
```bash
node server/proxy.js
# Starts proxy on configured port
```

## Signaling Server

**File**: `signaling-server.js`

Provides:
- WebRTC signaling for peer discovery
- Session management
- ICE candidate exchange
- Connection state tracking

**Usage**:
```bash
node server/signaling-server.js
# Starts signaling server for WebRTC connections
```

## Configuration

Server configuration is loaded from `/config.json` under the `server` section.

## See Also

- `/upgrades/core/webrtc-swarm.js` - WebRTC swarm client
- `/blueprints/0x000044-webrtc-swarm-transport.md` - WebRTC architecture
