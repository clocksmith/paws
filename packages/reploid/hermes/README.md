# Project Hermes 🪽

Node.js port of REPLOID Sentinel Agent with server-side execution and Git worktree session management.

## Features

- **Server-side Sentinel Agent**: Full FSM implementation running in Node.js
- **Git Worktree Sessions**: Isolated changes per session using Git worktrees
- **WebSocket Bridge**: Real-time communication with browser UI
- **REST API**: HTTP endpoints for state management
- **PAWS CLI Integration**: Uses cats/dogs CLI tools for bundle operations

## Installation

```bash
cd hermes
npm install
```

## Usage

### Start Server

```bash
npm start
# or for development with auto-reload
npm run dev
```

Server runs at http://localhost:3000

### API Endpoints

- `GET /api/status` - Get current agent state and sessions
- `POST /api/goal` - Submit a new goal
- `POST /api/approve-context` - Approve context bundle
- `POST /api/approve-proposal` - Approve change proposal
- `GET /api/sessions` - List all sessions

### WebSocket Messages

Connect to `ws://localhost:3000` and send:

```javascript
// Set a new goal
{
  "type": "SET_GOAL",
  "goal": "Add logging to authentication module"
}

// Approve context
{
  "type": "APPROVE_CONTEXT",
  "context": { /* context data */ }
}

// Approve proposal
{
  "type": "APPROVE_PROPOSAL",
  "proposal": { /* proposal data */ }
}
```

## Architecture

```
hermes/
├── index.js          # Main server and Sentinel Agent
├── sessions/         # Session data and bundles
│   └── session_*/    # Individual session directories
├── worktrees/        # Git worktrees for isolated changes
│   └── session_*/    # Worktree per session
└── package.json      # Dependencies
```

## Session Management

Each session creates:
1. A session directory for storing cats.md, dogs.md, and reflection files
2. A Git worktree for isolated code changes
3. Checkpoint/rollback capability via Git

## Development

### Running Tests
```bash
npm test
```

### Linting
```bash
npm run lint
```

## Integration with Browser UI

The browser REPLOID can connect to Hermes server for:
- Server-side code execution
- Persistent session storage
- Multi-user support
- Better Git integration

## Future Enhancements

- [ ] Authentication and authorization
- [ ] Multi-tenant support
- [ ] Distributed execution
- [ ] Cloud deployment ready
- [ ] Integration with external AI services
- [ ] Advanced session analytics

## Status

This is the foundation implementation of Project Hermes, providing the core Node.js port functionality. Additional features from the browser version will be migrated incrementally.