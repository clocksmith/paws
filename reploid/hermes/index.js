#!/usr/bin/env node

/**
 * Project Hermes - Node.js Port of REPLOID
 * Server-side Sentinel Agent with Git worktree session management
 */

const express = require('express');
const WebSocket = require('ws');
const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
const http = require('http');

// Use the full paws-session SessionManager from shared js/
const { SessionManager: PawsSessionManager, SessionStatus } = require('../../js/paws-session.js');

// Configuration
const PORT = process.env.PORT || 3000;

// Create Express app and HTTP server
const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Wrapper around PawsSessionManager to maintain compatibility
class SessionManager {
  constructor() {
    this.pawsManager = new PawsSessionManager(path.join(__dirname, '..'));
    this.activeSessionId = null;
  }

  async createSession(goal) {
    // Use paws-session to create a full-featured session
    const session = await this.pawsManager.createSession(goal);
    this.activeSessionId = session.sessionId;

    // Return a compatible object for the Sentinel Agent
    return {
      id: session.sessionId,
      goal,
      path: this.pawsManager.getSessionPath(session.sessionId),
      worktree: session.workspacePath,
      state: 'IDLE',
      created: session.createdAt,
      turnCount: session.turns.length
    };
  }

  async getSession(sessionId) {
    const session = await this.pawsManager.getSession(sessionId);
    if (!session) return null;

    return {
      id: session.sessionId,
      goal: session.name,
      path: this.pawsManager.getSessionPath(session.sessionId),
      worktree: session.workspacePath,
      state: session.status,
      created: session.createdAt,
      turnCount: session.turns.length
    };
  }

  async listSessions() {
    const sessions = await this.pawsManager.listSessions();
    return sessions.map(s => ({
      id: s.sessionId,
      goal: s.name,
      path: this.pawsManager.getSessionPath(s.sessionId),
      worktree: s.workspacePath,
      state: s.status,
      created: s.createdAt,
      turnCount: s.turns.length
    }));
  }

  async addTurn(sessionId, command, options) {
    return await this.pawsManager.addTurn(sessionId, command, options);
  }
}

// FSM States (simplified version)
const FSMStates = {
  IDLE: 'IDLE',
  CURATING_CONTEXT: 'CURATING_CONTEXT',
  AWAITING_CONTEXT_APPROVAL: 'AWAITING_CONTEXT_APPROVAL',
  PLANNING_WITH_CONTEXT: 'PLANNING_WITH_CONTEXT',
  GENERATING_PROPOSAL: 'GENERATING_PROPOSAL',
  AWAITING_PROPOSAL_APPROVAL: 'AWAITING_PROPOSAL_APPROVAL',
  APPLYING_CHANGES: 'APPLYING_CHANGES',
  REFLECTING: 'REFLECTING'
};

// Sentinel Agent FSM
class SentinelAgent {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.state = FSMStates.IDLE;
    this.currentSession = null;
  }

  async transition(newState) {
    console.log(`[FSM] ${this.state} -> ${newState}`);
    this.state = newState;

    if (this.currentSession) {
      this.currentSession.state = newState;
    }

    // Broadcast state change to WebSocket clients
    this.broadcastState();
  }

  async processGoal(goal) {
    // Create new session
    this.currentSession = await this.sessionManager.createSession(goal);

    // Start FSM flow
    await this.transition(FSMStates.CURATING_CONTEXT);
    await this.curateContext();
  }

  async curateContext() {
    // Simulate context curation
    const catsPath = path.join(this.currentSession.path, `turn-${this.currentSession.turnCount}.cats.md`);

    // Use the cats CLI to create context bundle
    const catsContent = `# Context for: ${this.currentSession.goal}
## Relevant Files
\`\`\`javascript
// Sample context
const modules = ['sentinel-tools.js', 'sentinel-fsm.js'];
\`\`\`
`;

    await fs.writeFile(catsPath, catsContent);
    await this.transition(FSMStates.AWAITING_CONTEXT_APPROVAL);
  }

  async generateProposal(context) {
    await this.transition(FSMStates.PLANNING_WITH_CONTEXT);

    // Simulate proposal generation
    await new Promise(resolve => setTimeout(resolve, 1000));

    await this.transition(FSMStates.GENERATING_PROPOSAL);

    const dogsPath = path.join(this.currentSession.path, `turn-${this.currentSession.turnCount}.dogs.md`);
    const dogsContent = `# Changes for: ${this.currentSession.goal}
\`\`\`paws-change
operation: MODIFY
file_path: test-file.js
\`\`\`
\`\`\`javascript
// Modified content
console.log('Sentinel Agent changes applied');
\`\`\`
`;

    await fs.writeFile(dogsPath, dogsContent);
    await this.transition(FSMStates.AWAITING_PROPOSAL_APPROVAL);
  }

  async applyChanges(proposal) {
    await this.transition(FSMStates.APPLYING_CHANGES);

    // Apply changes in worktree
    const worktree = this.currentSession.worktree;

    // Use the dogs CLI to apply changes
    // For now, simulate
    await new Promise(resolve => setTimeout(resolve, 500));

    await this.transition(FSMStates.REFLECTING);
    await this.reflect();
  }

  async reflect() {
    // Analyze outcome and learn
    const reflectionPath = path.join(this.currentSession.path, `turn-${this.currentSession.turnCount}.reflection.md`);

    const reflection = `# Reflection
## Outcome
Successfully completed: ${this.currentSession.goal}

## Insights
- Context curation was effective
- Changes applied cleanly

## Improvements
- Could optimize context selection
`;

    await fs.writeFile(reflectionPath, reflection);

    this.currentSession.turnCount++;
    await this.transition(FSMStates.IDLE);
  }

  broadcastState() {
    const message = JSON.stringify({
      type: 'STATE_CHANGE',
      state: this.state,
      session: this.currentSession ? {
        id: this.currentSession.id,
        goal: this.currentSession.goal,
        turnCount: this.currentSession.turnCount
      } : null
    });

    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
}

// Initialize components
const sessionManager = new SessionManager();
const agent = new SentinelAgent(sessionManager);

// API Routes
app.get('/api/status', (req, res) => {
  res.json({
    state: agent.state,
    session: agent.currentSession,
    sessions: Array.from(sessionManager.sessions.values())
  });
});

app.post('/api/goal', async (req, res) => {
  const { goal } = req.body;

  if (!goal) {
    return res.status(400).json({ error: 'Goal is required' });
  }

  await agent.processGoal(goal);
  res.json({
    session: agent.currentSession,
    state: agent.state
  });
});

app.post('/api/approve-context', async (req, res) => {
  if (agent.state !== FSMStates.AWAITING_CONTEXT_APPROVAL) {
    return res.status(400).json({ error: 'Not awaiting context approval' });
  }

  await agent.generateProposal(req.body.context);
  res.json({ state: agent.state });
});

app.post('/api/approve-proposal', async (req, res) => {
  if (agent.state !== FSMStates.AWAITING_PROPOSAL_APPROVAL) {
    return res.status(400).json({ error: 'Not awaiting proposal approval' });
  }

  await agent.applyChanges(req.body.proposal);
  res.json({ state: agent.state });
});

app.get('/api/sessions', async (req, res) => {
  const sessions = await sessionManager.listSessions();
  res.json(sessions);
});

const { runPaxosWorkflow } = require('./paxos_orchestrator.js');

app.post('/api/paxos', (req, res) => {
  const { objective, contextPath, verifyCmd } = req.body;

  if (!objective || !contextPath || !verifyCmd) {
    return res.status(400).json({ error: 'Objective, contextPath, and verifyCmd are required.' });
  }

  // Helper to broadcast to all WebSocket clients
  const broadcast = (data) => {
    const message = JSON.stringify(data);
    wss.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  };

  // Run the workflow asynchronously. The client will get updates via WebSocket.
  runPaxosWorkflow({ objective, contextPath, verifyCmd, broadcast });

  // Respond immediately to the HTTP request
  res.status(202).json({ message: 'Paxos workflow initiated. See WebSocket for logs.' });
});

// WebSocket handling
wss.on('connection', (ws) => {
  console.log('WebSocket client connected');

  // Send current state
  ws.send(JSON.stringify({
    type: 'STATE_SYNC',
    state: agent.state,
    session: agent.currentSession
  }));

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'SET_GOAL':
          await agent.processGoal(data.goal);
          break;

        case 'APPROVE_CONTEXT':
          await agent.generateProposal(data.context);
          break;

        case 'APPROVE_PROPOSAL':
          await agent.applyChanges(data.proposal);
          break;

        default:
          ws.send(JSON.stringify({ error: 'Unknown message type' }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ error: err.message }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
  });
});

// Start server
const main = async () => {
  server.listen(PORT, () => {
    console.log(`
🚀 Project Hermes - REPLOID Node.js Port
   Server: http://localhost:${PORT}
   WebSocket: ws://localhost:${PORT}

   Sentinel Agent ready for goals...
   Using full PAWS session management with git worktrees
`);
  });
};

// Handle shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');

  // Clean up active sessions using paws-session methods
  try {
    const sessions = await sessionManager.listSessions();
    for (const session of sessions) {
      if (session.state === 'IDLE' || session.state === 'active') {
        console.log(`Archiving session: ${session.id}`);
        await sessionManager.pawsManager.archiveSession(session.id);
      }
    }
  } catch (err) {
    console.error(`Error during cleanup: ${err.message}`);
  }

  process.exit(0);
});

// Start if main module
if (require.main === module) {
  main().catch(console.error);
}

module.exports = {
  SessionManager,
  SentinelAgent,
  app
};