# Blueprint 0x000013: System Configuration Structure

**Objective:** To define the architecture for the agent's runtime configuration system, enabling dynamic behavior modification through a centralized configuration artifact.

**Target Upgrade:** SCFG (system-config.json)

**Prerequisites:** `0x000005` (State Management)

**Affected Artifacts:** `/system/config.json`, `/modules/state-manager.js`

---

### 1. The Strategic Imperative

An agent needs runtime configuration to control its behavior without code modifications. Parameters like retry counts, timeout durations, evaluation thresholds, and feature flags must be adjustable. A well-structured configuration system allows the agent to tune its own parameters based on performance, creating a control surface for self-optimization.

### 2. The Architectural Solution

The solution is a JSON configuration artifact at `/system/config.json` that is loaded into the agent's state at initialization and can be modified during runtime.

**Configuration Structure:**
```json
{
  "version": "1.0.0",
  "api": {
    "maxRetries": 3,
    "timeout": 60000,
    "temperature": 0.7,
    "maxOutputTokens": 4096
  },
  "cycle": {
    "maxToolCalls": 5,
    "humanReviewProb": 10,
    "autoRunThreshold": 0.8
  },
  "evaluation": {
    "enabled": false,
    "passThreshold": 0.75,
    "criteriaWeights": {
      "goal_alignment": 0.4,
      "code_quality": 0.3,
      "efficiency": 0.3
      }
  },
  "features": {
    "dynamicTools": false,
    "selfModification": true,
    "verboseLogging": false
  }
}
```

### 3. The Implementation Pathway

1. **Create Configuration Artifact:**
   ```javascript
   // At genesis or first cycle
   const defaultConfig = {
     version: "1.0.0",
     api: { maxRetries: 3, timeout: 60000 },
     cycle: { maxToolCalls: 5, humanReviewProb: 10 },
     evaluation: { enabled: false, passThreshold: 0.75 },
     features: { dynamicTools: false, selfModification: true }
   };
   await StateManager.createArtifact(
     "/system/config.json",
     "json",
     JSON.stringify(defaultConfig, null, 2),
     "System configuration parameters"
   );
   ```

2. **Load Configuration in State Manager:**
   ```javascript
   // In state-manager.js init()
   const sysCfgContent = await Storage.getArtifactContent('/system/config.json');
   if (sysCfgContent) {
     globalState.cfg = JSON.parse(sysCfgContent);
   }
   ```

3. **Access Configuration in Modules:**
   ```javascript
   // In any module
   const config = StateManager.getState().cfg;
   const maxRetries = config?.api?.maxRetries || 3;
   ```

4. **Update Configuration Dynamically:**
   ```javascript
   // Agent can modify its own config
   const config = JSON.parse(await Storage.getArtifactContent('/system/config.json'));
   config.api.temperature = 0.9; // Increase creativity
   await StateManager.updateArtifact('/system/config.json', JSON.stringify(config, null, 2));
   ```

### 4. Configuration Categories

- **API Settings:** Control LLM interaction parameters
- **Cycle Settings:** Define cognitive loop behavior
- **Evaluation Settings:** Configure self-assessment
- **Feature Flags:** Enable/disable capabilities
- **Thresholds:** Set decision boundaries

### 5. Self-Optimization Pattern

The agent can use this configuration as a control surface for self-tuning:
1. Track performance metrics
2. Identify underperforming areas
3. Adjust relevant configuration parameters
4. Measure impact in subsequent cycles
5. Converge on optimal settings

This creates a feedback loop where the agent learns its own optimal operating parameters through experimentation.