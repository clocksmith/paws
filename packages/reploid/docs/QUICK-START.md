# 🚀 REPLOID Quick Start Guide

**Welcome to REPLOID!** This guide will get you up and running in 5 minutes.

---

## 📋 Prerequisites

- **Modern browser** (Chrome 90+, Firefox 88+, Safari 14+, Edge 90+)
- **Node.js 18+** (for development server)
- **Git** (recommended for version control)

---

## ⚡ 1-Minute Quick Start

### Step 1: Start the Server

```bash
# Option A: Python (simplest)
python3 -m http.server 8000

# Option B: Node.js with live reload
npm install
npm run dev

# Option C: Any static server
npx serve -p 8000
```

### Step 2: Open in Browser

Navigate to **http://localhost:8000** in your browser.

### Step 3: Choose Your Configuration (NEW!)

You'll see the **Simple Mode** tab by default with 3 clear options:

#### ⚡ Minimal RSI Core (Recommended - Selected by Default)
- **8 essential modules** only
- Fastest startup, agent can self-evolve by loading more modules as needed
- Perfect for learning and experimentation

#### 📚 Core + All Blueprints
- 8 core modules + 26 knowledge documents
- Agent has maximum knowledge from the start
- Great for complex tasks requiring deep understanding

#### 🚀 All Upgrades + Blueprints
- 40 modules + 26 blueprints
- Full power from the start
- Best for production use or advanced workflows

**Advanced Options:**
- **Templates Tab** - Pre-configured personas (Website Builder, RSI Lab, RFC Author, etc.)
- **Hunter Protocol** - Manual module/blueprint selection for experts

### Step 4: Set Your First Goal

Type a goal in the input box and click **"Launch Agent"**. Examples:

**With Minimal RSI Core (default):**
```
Create a simple hello world function
```

```
Analyze my current module architecture
```

**With All Blueprints:**
```
Study blueprint 0x000016 and create a new tool
```

**With All Upgrades:**
```
Create a landing page for a coffee shop called "Bean There"
```

The Sentinel Agent will start working through its FSM states automatically!

---

## 🎯 Interactive Tutorial

### Example 1: Building a Website (Easiest)

**Persona:** Website Builder

**Goal:** `Create a simple landing page for a yoga studio`

**What happens:**
1. ⏳ **CURATING_CONTEXT** - Agent selects HTML/CSS/JS template files
2. ✋ **AWAITING_CONTEXT_APPROVAL** - Review selected files (click "Approve")
3. 🧠 **PLANNING_WITH_CONTEXT** - Agent analyzes requirements
4. 📝 **GENERATING_PROPOSAL** - Creates HTML/CSS/JS files
5. ✋ **AWAITING_PROPOSAL_APPROVAL** - **Review changes in interactive diff viewer**
   - ✓ Green = additions
   - ✗ Red = deletions
   - 👁️ Side-by-side comparison
   - Click "Approve All" or selectively approve files
6. ⚙️ **APPLYING_CHANGES** - Writes files to VFS
7. 🔍 **REFLECTING** - Agent learns from the outcome
8. ✅ **DONE** - View your site in the **Live Preview** panel!

### Example 2: Self-Improvement Experiment (Advanced)

**Persona:** RSI Lab Sandbox

**Goal:** `Study blueprint 0x000016 and create a new tool named 'greet_user' that returns a friendly message`

**What happens:**
1. Agent reads `/blueprints/0x000016-meta-tool-creation-patterns.md`
2. Agent proposes creating `upgrades/tools-dynamic/greet_user.json`
3. You review the proposed tool definition
4. Agent applies the change to its own toolset
5. **The agent has now improved itself!** 🎉

### Example 3: Code Analysis (Intermediate)

**Persona:** Code Refactorer

**Goal:** `Analyze state-manager.js for potential performance optimizations`

**What happens:**
1. Agent uses **Introspector** module to analyze code complexity
2. Agent uses **PerformanceMonitor** to check current metrics
3. Agent proposes refactoring patterns (memoization, debouncing, lazy loading)
4. You review proposals in diff viewer
5. Agent applies approved changes and runs self-tests

---

## 🎨 Understanding the Dashboard

### Top Status Bar
- **⚪ IDLE** → Agent waiting for goal
- **🔵 CURATING_CONTEXT** → Selecting files
- **🟡 AWAITING_CONTEXT_APPROVAL** → Your approval needed
- **🟢 APPLYING_CHANGES** → Writing files
- **🟣 REFLECTING** → Learning from outcome

### Left Panel: Current Goal
Shows the goal you set and progress

### Center Panel: Agent Thoughts (Toggles with 7 views)
Click **"Show Performance"** to cycle through:
1. **Agent Thoughts** - Real-time reasoning stream
2. **Performance Metrics** - Session stats, LLM calls, memory usage
3. **Self-Analysis** - Module graph, tool catalog, capabilities
4. **Learning History** - Past reflections and patterns
5. **Self-Tests** - Validation suite results (80% pass threshold)
6. **Browser APIs** - File System, Notifications, Storage status
7. **Advanced Logs** - Detailed event log

### Right Panel: VFS Explorer
- Browse virtual filesystem
- Search files
- Preview content
- Copy file paths

### Bottom Panel: Visual Diffs
When agent proposes changes, you'll see:
- Side-by-side diff viewer
- Syntax-highlighted code
- Approve/reject individual files
- Export changes as markdown

---

## 🔑 Key Concepts

### PAWS Philosophy
**Prepare Artifacts With SWAP**

- **cats.md**: Context bundles (selected files for LLM)
- **dogs.md**: Change proposals (explicit modifications)
- Human approvals at 2 checkpoints

### Sentinel Agent FSM
8-state finite state machine ensures controlled execution:
```
IDLE → CURATING → AWAITING_APPROVAL → PLANNING →
GENERATING → AWAITING_APPROVAL → APPLYING → REFLECTING → DONE
```

### Virtual File System (VFS)
- All files stored in browser IndexedDB
- Git-based version control
- Checkpoint/rollback capability
- Syncs to real filesystem via File System Access API

### RSI (Recursive Self-Improvement)
The agent can modify its own source code:
- Tool creation (`tools-write.json` provides `create_tool` function)
- Goal modification (`goal-modifier.js` for safe goal evolution)
- Blueprint creation (`blueprint-creator.js` for knowledge transfer)

---

## 🎓 Sample Goals by Persona

### Website Builder
```
Create a landing page for a tech startup with hero section, features, and contact form
Build a portfolio page with image gallery and project cards
Design a pricing page with three tiers and comparison table
```

### RSI Lab Sandbox
```
Study blueprint 0x000016 and create a new tool named 'greet_user'
Observe your own goal state and add a sub-goal to document findings
Use blueprint 0x000018 to create a blueprint about tool composition patterns
```

### Code Refactorer
```
Analyze state-manager.js and find performance bottlenecks
Use self-evaluation to assess the quality of agent-cycle.js
Refactor ui-manager.js to reduce code duplication
```

### RFC Author
```
Create an RFC proposing a dark mode theme system
Analyze recent VFS modifications and draft an RFC summarizing changes
Draft an RFC for implementing keyboard shortcuts in the UI
```

### Product Prototype Factory
```
Build an interactive todo app with drag-and-drop functionality
Create a dashboard prototype with charts and data visualizations
Design a settings panel with tabs and form controls
```

### Creative Writer
```
Write a technical blog post explaining the PAWS philosophy
Create a tutorial on using the Sentinel Agent for beginners
Draft release notes for version 2.0 of REPLOID
```

---

## 🐛 Troubleshooting

### Problem: "Failed to load module"
**Solution:** Clear browser cache (Ctrl+Shift+Delete) and refresh

### Problem: Agent stuck in CURATING_CONTEXT
**Solution:** Check browser console for errors. Likely API key issue or network problem.

### Problem: Diff viewer shows no changes
**Solution:** Agent may have proposed empty changeset. Check "Agent Thoughts" panel for reasoning.

### Problem: IndexedDB quota exceeded
**Solution:** Export important sessions, then run `StateManager.clearAllData()` in console

### Problem: Preview not showing
**Solution:** Ensure persona is Website Builder or Product Prototype Factory. Check that `/vfs/preview/index.html` exists.

### Problem: File System Access denied
**Solution:** Browser APIs panel → "📁 Connect Directory" button. Grant permission to directory.

### Problem: Self-tests failing
**Solution:** Check Self-Tests panel for failure details. Common causes:
- Missing dependencies in module
- Tool execution errors
- IndexedDB corruption

---

## ⚙️ Advanced Features

### CLI Mode (cats/dogs)

```bash
# Create context bundle
bin/cats "upgrades/*.js" -o context.cats.md

# Validate bundle
bin/cats validate context.cats.md

# Apply changes
bin/dogs changes.dogs.md

# Dry-run with diff
bin/dogs diff changes.dogs.md

# Run with verification
bin/dogs changes.dogs.md --verify "npm test"
```

### Server Mode (Hermes)

```bash
cd hermes
npm install
npm start
# Navigate to http://localhost:3000
```

Server mode provides:
- Git worktree isolation per session
- Persistent sessions
- Multi-user support
- Real filesystem access

### API Keys

REPLOID uses Gemini API by default. To use other providers:

1. Create `.env` file:
```bash
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
ANTHROPIC_API_KEY=your_key_here
```

2. Update `config.json`:
```json
{
  "providers": {
    "default": "openai",
    "fallbackProviders": ["gemini", "anthropic"]
  }
}
```

3. Restart server (or use proxy mode):
```bash
npm start
```

### Keyboard Shortcuts

- `Ctrl/Cmd + K` - Focus goal input
- `Ctrl/Cmd + Enter` - Set goal
- `Ctrl/Cmd + L` - Toggle panel view
- `Ctrl/Cmd + E` - Export session report
- `Ctrl/Cmd + /` - Open VFS search

---

## 📚 Next Steps

Once you're comfortable with the basics:

1. **Read the Blueprints** (`/blueprints/`) - Learn system architecture
2. **Explore Personas** (`docs/PERSONAS.md`) - Create custom personas
3. **Review Roadmap** (`docs/ROADMAP.md`) - See what's coming next
4. **Test Sentinel Flow** (`test-sentinel-flow.md`) - Deep dive testing
5. **Read RFCs** (`docs/rfcs/`) - Understand design decisions

---

## 💡 Pro Tips

1. **Use descriptive goals** - "Create a landing page" → "Create a landing page for a coffee shop with hero, menu, and contact sections"

2. **Review context carefully** - In AWAITING_CONTEXT_APPROVAL, ensure agent selected the right files

3. **Check diffs line-by-line** - Don't approve blindly! The diff viewer highlights every change

4. **Export sessions regularly** - Click "💾 Export" in status bar to save markdown report

5. **Use reflections** - Agent learns from each interaction. Check "Learning History" to see patterns

6. **Experiment in Lab Sandbox** - Safe environment for RSI experiments with undo capability

7. **Monitor performance** - Keep an eye on "Performance Metrics" to optimize agent behavior

8. **Connect filesystem** - Use File System Access API to sync VFS to real directories

9. **Run self-tests** - Before major changes, click "▶️ Run Tests" to validate system integrity

10. **Read agent thoughts** - The thought stream reveals reasoning. Use it to understand decisions!

---

## 🎉 You're Ready!

Start with the **Website Builder** persona and a simple goal. As you get comfortable, explore more advanced personas like **RSI Lab Sandbox** to see the agent improve itself!

**Questions?** Check `docs/TROUBLESHOOTING.md` or file an issue on GitHub.

---

*Happy building! The Sentinel Agent is here to help.* ⚡
