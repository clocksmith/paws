/**
 * Playwright Widget Types
 */

/**
 * Playwright Widget Configuration
 */
export interface PlaywrightWidgetConfig {
  /** Default browser */
  browser?: 'chromium' | 'firefox' | 'webkit';

  /** Viewport size */
  viewport?: {
    width: number;
    height: number;
  };

  /** Screenshot settings */
  screenshots?: {
    quality?: number;
    format?: 'png' | 'jpeg';
    fullPage?: boolean;
  };

  /** Console settings */
  console?: {
    maxMessages?: number;
    showTimestamps?: boolean;
    filterLevels?: Array<'log' | 'warn' | 'error' | 'info' | 'debug'>;
  };
}

/**
 * Browser Session
 */
export interface BrowserSession {
  id: string;
  browser: 'chromium' | 'firefox' | 'webkit';
  currentUrl: string;
  status: 'idle' | 'navigating' | 'loading' | 'loaded' | 'error';
  startedAt: Date;
}

/**
 * Screenshot Data
 */
export interface Screenshot {
  id: string;
  name: string;
  url: string;
  dataUrl: string;
  width: number;
  height: number;
  size: number;
  timestamp: Date;
}

/**
 * Console Message
 */
export interface ConsoleMessage {
  id: string;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: Date;
  url?: string;
}

/**
 * Workflow Action
 */
export interface WorkflowAction {
  id: string;
  type: 'navigate' | 'click' | 'fill' | 'select' | 'hover' | 'screenshot' | 'evaluate';
  params: Record<string, unknown>;
  delay?: number;
}

/**
 * Workflow
 */
export interface Workflow {
  id: string;
  name: string;
  actions: WorkflowAction[];
  createdAt: Date;
  lastRun?: Date;
}
