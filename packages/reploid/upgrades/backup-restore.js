// Backup and Restore functionality for REPLOID system
// Handles exporting/importing agent state, artifacts, and configuration

export class BackupRestore {
  constructor(storage, stateManager, logger) {
    this.storage = storage;
    this.stateManager = stateManager;
    this.logger = logger;
  }

  async createBackup() {
    try {
      this.logger.logEvent('info', 'Creating system backup...');
      
      const backup = {
        version: '1.0.0',
        timestamp: Date.now(),
        date: new Date().toISOString(),
        state: await this.backupState(),
        artifacts: await this.backupArtifacts(),
        configuration: await this.backupConfiguration(),
        metadata: {
          totalArtifacts: 0,
          totalSize: 0
        }
      };

      // Calculate metadata
      backup.metadata.totalArtifacts = backup.artifacts.length;
      backup.metadata.totalSize = JSON.stringify(backup).length;

      this.logger.logEvent('info', `Backup created: ${backup.artifacts.length} artifacts, ${backup.metadata.totalSize} bytes`);
      
      return backup;
    } catch (error) {
      this.logger.logEvent('error', `Backup creation failed: ${error.message}`);
      throw error;
    }
  }

  async backupState() {
    const state = this.stateManager.getState();
    return {
      agentState: state,
      systemState: {
        totalCycles: state.totalCycles || 0,
        currentGoal: state.currentGoal || '',
        hitlMode: state.hitlMode || 'off',
        apiCallCount: state.apiCallCount || 0
      }
    };
  }

  async backupArtifacts() {
    const artifacts = [];
    const metadata = await this.storage.getAllArtifactMetadata();
    
    for (const [path, meta] of Object.entries(metadata)) {
      const content = await this.storage.getArtifactContent(path);
      artifacts.push({
        path,
        content,
        metadata: meta,
        type: this.getArtifactType(path)
      });
    }
    
    return artifacts;
  }

  async backupConfiguration() {
    return {
      apiKey: localStorage.getItem('reploid_api_key') || '',
      selectedUpgrades: JSON.parse(localStorage.getItem('reploid_upgrades') || '[]'),
      selectedBlueprints: JSON.parse(localStorage.getItem('reploid_blueprints') || '[]'),
      customSettings: JSON.parse(localStorage.getItem('reploid_settings') || '{}')
    };
  }

  async restoreBackup(backupData) {
    try {
      this.logger.logEvent('info', 'Starting system restore...');
      
      // Validate backup
      if (!this.validateBackup(backupData)) {
        throw new Error('Invalid backup format');
      }

      // Clear existing data
      await this.clearSystem();

      // Restore in order
      await this.restoreConfiguration(backupData.configuration);
      await this.restoreArtifacts(backupData.artifacts);
      await this.restoreState(backupData.state);

      this.logger.logEvent('info', `Restore complete: ${backupData.metadata.totalArtifacts} artifacts restored`);
      
      return {
        success: true,
        artifactsRestored: backupData.metadata.totalArtifacts,
        timestamp: backupData.timestamp
      };
    } catch (error) {
      this.logger.logEvent('error', `Restore failed: ${error.message}`);
      throw error;
    }
  }

  async restoreState(stateData) {
    if (stateData.agentState) {
      await this.stateManager.setState(stateData.agentState);
    }
  }

  async restoreArtifacts(artifacts) {
    for (const artifact of artifacts) {
      await this.storage.writeArtifact(
        artifact.path,
        artifact.content,
        artifact.metadata
      );
    }
  }

  async restoreConfiguration(config) {
    if (config.apiKey) {
      localStorage.setItem('reploid_api_key', config.apiKey);
    }
    if (config.selectedUpgrades) {
      localStorage.setItem('reploid_upgrades', JSON.stringify(config.selectedUpgrades));
    }
    if (config.selectedBlueprints) {
      localStorage.setItem('reploid_blueprints', JSON.stringify(config.selectedBlueprints));
    }
    if (config.customSettings) {
      localStorage.setItem('reploid_settings', JSON.stringify(config.customSettings));
    }
  }

  async clearSystem() {
    // Clear VFS
    await this.storage.clear();
    
    // Clear state
    await this.stateManager.setState({
      totalCycles: 0,
      currentGoal: '',
      hitlMode: 'off',
      apiCallCount: 0
    });
    
    // Clear localStorage items
    const keysToRemove = [
      'reploid_api_key',
      'reploid_upgrades', 
      'reploid_blueprints',
      'reploid_settings'
    ];
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }

  validateBackup(backupData) {
    if (!backupData || typeof backupData !== 'object') {
      return false;
    }
    
    const requiredFields = ['version', 'timestamp', 'state', 'artifacts', 'configuration'];
    for (const field of requiredFields) {
      if (!(field in backupData)) {
        this.logger.logEvent('error', `Backup validation failed: missing ${field}`);
        return false;
      }
    }
    
    if (!Array.isArray(backupData.artifacts)) {
      return false;
    }
    
    return true;
  }

  getArtifactType(path) {
    if (path.startsWith('/modules/')) return 'module';
    if (path.startsWith('/docs/')) return 'documentation';
    if (path.startsWith('/system/')) return 'system';
    if (path.startsWith('/cycles/')) return 'cycle';
    return 'unknown';
  }

  // Export backup to file
  exportToFile(backupData) {
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reploid-backup-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Import backup from file
  async importFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const backupData = JSON.parse(e.target.result);
          const result = await this.restoreBackup(backupData);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read backup file'));
      };
      
      reader.readAsText(file);
    });
  }
}

// UI Component for backup/restore
export class BackupRestoreUI {
  constructor(backupRestore) {
    this.backupRestore = backupRestore;
  }

  render() {
    const container = document.createElement('div');
    container.className = 'backup-restore-container';
    container.innerHTML = `
      <style>
        .backup-restore-container {
          padding: 20px;
          border: 1px solid #0ff;
          background: rgba(0,255,255,0.05);
          margin: 20px 0;
        }
        
        .backup-restore-container h3 {
          color: #0ff;
          margin-top: 0;
        }
        
        .backup-btn {
          padding: 10px 20px;
          margin: 5px;
          background: rgba(0,255,255,0.1);
          border: 1px solid #0ff;
          color: #0ff;
          cursor: pointer;
          transition: all 0.3s;
        }
        
        .backup-btn:hover {
          background: rgba(0,255,255,0.2);
          box-shadow: 0 0 10px rgba(0,255,255,0.5);
        }
        
        .backup-info {
          margin: 10px 0;
          padding: 10px;
          background: rgba(0,0,0,0.5);
          border: 1px solid #333;
          color: #aaa;
        }
        
        #file-input {
          display: none;
        }
      </style>
      
      <h3>Backup & Restore</h3>
      
      <div class="backup-actions">
        <button class="backup-btn" id="create-backup-btn">Create Backup</button>
        <button class="backup-btn" id="restore-backup-btn">Restore from File</button>
        <input type="file" id="file-input" accept=".json">
      </div>
      
      <div class="backup-info" id="backup-info" style="display: none;"></div>
    `;

    // Attach event listeners
    container.querySelector('#create-backup-btn').addEventListener('click', async () => {
      await this.handleCreateBackup();
    });

    container.querySelector('#restore-backup-btn').addEventListener('click', () => {
      container.querySelector('#file-input').click();
    });

    container.querySelector('#file-input').addEventListener('change', async (e) => {
      if (e.target.files.length > 0) {
        await this.handleRestoreBackup(e.target.files[0]);
      }
    });

    return container;
  }

  async handleCreateBackup() {
    const infoDiv = document.getElementById('backup-info');
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = 'Creating backup...';
    
    try {
      const backup = await this.backupRestore.createBackup();
      this.backupRestore.exportToFile(backup);
      
      infoDiv.innerHTML = `
        Backup created successfully!<br>
        - Artifacts: ${backup.metadata.totalArtifacts}<br>
        - Size: ${(backup.metadata.totalSize / 1024).toFixed(2)} KB<br>
        - Timestamp: ${new Date(backup.timestamp).toLocaleString()}
      `;
    } catch (error) {
      infoDiv.innerHTML = `<span style="color: #f00;">Error: ${error.message}</span>`;
    }
  }

  async handleRestoreBackup(file) {
    const infoDiv = document.getElementById('backup-info');
    infoDiv.style.display = 'block';
    infoDiv.innerHTML = 'Restoring backup...';
    
    try {
      const result = await this.backupRestore.importFromFile(file);
      
      infoDiv.innerHTML = `
        Restore completed successfully!<br>
        - Artifacts restored: ${result.artifactsRestored}<br>
        - Backup date: ${new Date(result.timestamp).toLocaleString()}<br>
        <span style="color: #ffd700;">Page will reload in 3 seconds...</span>
      `;
      
      // Reload page after restore
      setTimeout(() => {
        window.location.reload();
      }, 3000);
    } catch (error) {
      infoDiv.innerHTML = `<span style="color: #f00;">Restore failed: ${error.message}</span>`;
    }
  }
}

// Factory for module integration
export const BackupRestoreModule = {
  metadata: {
    id: 'BackupRestore',
    version: '1.0.0',
    dependencies: ['Storage', 'StateManager', 'logger'],
    async: false,
    type: 'utility'
  },
  
  factory: (deps) => {
    const { Storage, StateManager, logger } = deps;
    
    if (!Storage || !StateManager || !logger) {
      throw new Error('BackupRestore: Missing required dependencies');
    }
    
    const backupRestore = new BackupRestore(Storage, StateManager, logger);
    const ui = new BackupRestoreUI(backupRestore);
    
    return {
      createBackup: () => backupRestore.createBackup(),
      restoreBackup: (data) => backupRestore.restoreBackup(data),
      exportToFile: (data) => backupRestore.exportToFile(data),
      importFromFile: (file) => backupRestore.importFromFile(file),
      renderUI: () => ui.render()
    };
  }
};

export default BackupRestoreModule;