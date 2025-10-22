/**
 * Sequential Thinking Widget Types
 */

/**
 * Thinking Widget Configuration
 */
export interface ThinkingWidgetConfig {
  /** Show step timings */
  showTimings?: boolean;

  /** Show step numbers */
  showStepNumbers?: boolean;

  /** Use compact display mode */
  compactMode?: boolean;

  /** Auto-scroll to new steps */
  autoScroll?: boolean;

  /** Maximum steps to display */
  maxStepsDisplayed?: number;

  /** Enable step annotations */
  allowAnnotations?: boolean;

  /** Color coding for step status */
  colorCode?: {
    inProgress?: string;
    completed?: string;
    error?: string;
  };

  /** Export format */
  exportFormat?: 'json' | 'markdown' | 'text';
}

/**
 * Thinking Step
 */
export interface ThinkingStep {
  /** Step ID */
  id: string;

  /** Step number (1-indexed) */
  number: number;

  /** Thought content */
  thought: string;

  /** Conclusion from this step */
  conclusion?: string;

  /** Step status */
  status: 'in-progress' | 'completed' | 'error';

  /** Time taken (ms) */
  duration?: number;

  /** Start timestamp */
  startTime: Date;

  /** End timestamp */
  endTime?: Date;

  /** User annotations */
  annotations?: StepAnnotation[];
}

/**
 * Step Annotation
 */
export interface StepAnnotation {
  /** Annotation ID */
  id: string;

  /** Note text */
  note: string;

  /** Tags */
  tags?: string[];

  /** Created timestamp */
  createdAt: Date;
}

/**
 * Thinking Session
 */
export interface ThinkingSession {
  /** Session ID */
  id: string;

  /** Initial prompt */
  prompt: string;

  /** Additional context */
  context?: string;

  /** Session status */
  status: 'active' | 'completed' | 'error';

  /** Thinking steps */
  steps: ThinkingStep[];

  /** Final conclusion */
  finalConclusion?: string;

  /** Total duration (ms) */
  totalDuration: number;

  /** Created timestamp */
  createdAt: Date;

  /** Completed timestamp */
  completedAt?: Date;
}

/**
 * Export Format
 */
export type ExportFormat = 'json' | 'markdown' | 'text';

/**
 * Exported Session
 */
export interface ExportedSession {
  /** Format */
  format: ExportFormat;

  /** Content */
  content: string;

  /** Filename */
  filename: string;
}
