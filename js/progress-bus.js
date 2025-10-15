const fs = require('fs');
const path = require('path');

const getProgressLogPath = (rootPath = '.') => {
  const root = path.resolve(rootPath);
  return path.join(root, '.paws', 'cache', 'progress-stream.ndjson');
};

class ProgressBus {
  constructor(rootPath = '.') {
    this.rootPath = path.resolve(rootPath);
    this.logPath = getProgressLogPath(this.rootPath);
  }

  async publish(event) {
    const payload = {
      ...event,
      timestamp: event.timestamp || new Date().toISOString()
    };

    try {
      await fs.promises.mkdir(path.dirname(this.logPath), { recursive: true });
      await fs.promises.appendFile(this.logPath, JSON.stringify(payload) + '\n', 'utf-8');
    } catch (err) {
      if (process.env.PAWS_DEBUG) {
        console.warn('[ProgressBus] Failed to publish event:', err.message);
      }
    }
  }
}

module.exports = {
  ProgressBus,
  getProgressLogPath
};
