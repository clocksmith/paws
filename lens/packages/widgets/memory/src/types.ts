/**
 * Memory Widget Types
 */

/**
 * Memory Widget Configuration
 */
export interface MemoryWidgetConfig {
  /** Default view mode */
  defaultView?: 'graph' | 'list';

  /** Graph layout algorithm */
  graphLayout?: 'force' | 'tree' | 'radial';

  /** Show relation labels on edges */
  showRelationLabels?: boolean;

  /** Animate graph transitions */
  animateTransitions?: boolean;

  /** Group entities by type */
  groupByType?: boolean;

  /** Show observations in entity cards */
  showObservations?: boolean;

  /** Maximum observations to display */
  maxObservationsDisplay?: number;

  /** Colors by entity type */
  entityColors?: {
    [entityType: string]: string;
    default: string;
  };

  /** Search minimum length */
  searchMinLength?: number;

  /** Search debounce (ms) */
  searchDebounce?: number;
}

/**
 * Entity
 */
export interface Entity {
  /** Entity name (unique identifier) */
  name: string;

  /** Entity type */
  entityType: string;

  /** Observations about this entity */
  observations: string[];
}

/**
 * Relation
 */
export interface Relation {
  /** Source entity name */
  from: string;

  /** Target entity name */
  to: string;

  /** Relation type */
  relationType: string;
}

/**
 * Observation
 */
export interface Observation {
  /** Entity name */
  entityName: string;

  /** Observation contents */
  contents: string[];
}

/**
 * Knowledge Graph
 */
export interface KnowledgeGraph {
  /** All entities in the graph */
  entities: Entity[];

  /** All relations in the graph */
  relations: Relation[];
}

/**
 * Entity with Relations
 */
export interface EntityWithRelations extends Entity {
  /** Outgoing relations */
  outgoing: Relation[];

  /** Incoming relations */
  incoming: Relation[];
}

/**
 * Graph Node (for visualization)
 */
export interface GraphNode {
  /** Node ID (entity name) */
  id: string;

  /** Display label */
  label: string;

  /** Entity type */
  type: string;

  /** Node color */
  color: string;

  /** Position (if set) */
  x?: number;
  y?: number;

  /** Size */
  size?: number;
}

/**
 * Graph Edge (for visualization)
 */
export interface GraphEdge {
  /** Edge ID */
  id: string;

  /** Source node ID */
  source: string;

  /** Target node ID */
  target: string;

  /** Edge label */
  label: string;

  /** Relation type */
  type: string;

  /** Edge color */
  color?: string;
}

/**
 * Graph Data (for visualization)
 */
export interface GraphData {
  /** Graph nodes */
  nodes: GraphNode[];

  /** Graph edges */
  edges: GraphEdge[];
}

/**
 * Entity Filter
 */
export interface EntityFilter {
  /** Filter by entity type */
  type?: string;

  /** Filter by observation content (regex) */
  observation?: RegExp;

  /** Filter by entity name (regex) */
  name?: RegExp;
}

/**
 * Search Result
 */
export interface SearchResult {
  /** Matched entity */
  entity: Entity;

  /** Match score (0-1) */
  score: number;

  /** Matched observation indices */
  matchedObservations?: number[];
}

/**
 * Export Options
 */
export interface ExportOptions {
  /** Entity names to export (all if not specified) */
  entities?: string[];

  /** Include relations */
  includeRelations?: boolean;

  /** Include observations */
  includeObservations?: boolean;
}

/**
 * Graph Layout Options
 */
export interface GraphLayoutOptions {
  /** Layout algorithm */
  layout: 'force' | 'tree' | 'radial';

  /** Direction (for tree layout) */
  direction?: 'TB' | 'BT' | 'LR' | 'RL';

  /** Spacing */
  spacing?: {
    node: number;
    rank: number;
  };

  /** Physics simulation */
  physics?: {
    enabled: boolean;
    solver?: string;
  };
}
