/**
 * Event Name Utilities
 *
 * Helper functions for working with MWP event names.
 */

import type { MCPEvent } from '../types/events.js';

/**
 * Event namespace constants
 */
export const EventNamespace = {
  MCP: 'mcp',
  WIDGET: 'widget',
  DASHBOARD: 'dashboard',
} as const;

/**
 * Event category constants
 */
export const EventCategory = {
  TOOL: 'tool',
  RESOURCE: 'resource',
  PROMPT: 'prompt',
  SAMPLING: 'sampling',
  SERVER: 'server',
  LIFECYCLE: 'lifecycle',
  LAYOUT: 'layout',
  THEME: 'theme',
  CONFIG: 'config',
} as const;

/**
 * Build event name from components
 *
 * @param namespace - Event namespace
 * @param category - Event category
 * @param action - Event action
 * @returns Event name string
 */
export function buildEventName(
  namespace: string,
  category: string,
  action: string
): string {
  return `${namespace}:${category}:${action}`;
}

/**
 * Check if event name matches pattern
 *
 * @param eventName - Event name to check
 * @param pattern - Pattern to match (supports wildcards: "mcp:tool:*", "mcp:*:*")
 * @returns True if event matches pattern
 */
export function matchesEventPattern(eventName: string, pattern: string): boolean {
  const [patternNs, patternCat, patternAction] = pattern.split(':');
  const [eventNs, eventCat, eventAction] = eventName.split(':');

  if (patternNs !== '*' && patternNs !== eventNs) {
    return false;
  }

  if (patternCat !== '*' && patternCat !== eventCat) {
    return false;
  }

  if (patternAction !== '*' && patternAction !== eventAction) {
    return false;
  }

  return true;
}

/**
 * Filter event names by pattern
 *
 * @param eventNames - Array of event names
 * @param pattern - Pattern to match
 * @returns Filtered event names
 */
export function filterEventsByPattern(
  eventNames: MCPEvent[],
  pattern: string
): MCPEvent[] {
  return eventNames.filter(name => matchesEventPattern(name, pattern));
}

/**
 * Get all tool-related events
 */
export function getToolEvents(): MCPEvent[] {
  return [
    'mcp:tool:invoke-requested',
    'mcp:tool:invoked',
    'mcp:tool:error',
    'mcp:tool:progress',
    'mcp:tools:list-changed',
  ];
}

/**
 * Get all resource-related events
 */
export function getResourceEvents(): MCPEvent[] {
  return [
    'mcp:resource:read-requested',
    'mcp:resource:read',
    'mcp:resource:updated',
    'mcp:resource:error',
    'mcp:resource:subscribe-requested',
    'mcp:resource:unsubscribe-requested',
    'mcp:resources:list-changed',
  ];
}

/**
 * Get all prompt-related events
 */
export function getPromptEvents(): MCPEvent[] {
  return [
    'mcp:prompt:get-requested',
    'mcp:prompt:got',
    'mcp:prompt:error',
    'mcp:prompts:list-changed',
  ];
}

/**
 * Get all sampling-related events
 */
export function getSamplingEvents(): MCPEvent[] {
  return [
    'mcp:sampling:requested',
    'mcp:sampling:completed',
    'mcp:sampling:error',
  ];
}

/**
 * Get all server-related events
 */
export function getServerEvents(): MCPEvent[] {
  return [
    'mcp:server:connected',
    'mcp:server:disconnected',
    'mcp:server:error',
    'mcp:server:capabilities-changed',
  ];
}

/**
 * Get all widget lifecycle events
 */
export function getWidgetLifecycleEvents(): MCPEvent[] {
  return [
    'widget:initialized',
    'widget:destroyed',
    'widget:error',
    'widget:refresh-requested',
    'widget:refreshed',
  ];
}

/**
 * Get all dashboard events
 */
export function getDashboardEvents(): MCPEvent[] {
  return [
    'dashboard:widget-added',
    'dashboard:widget-removed',
    'dashboard:layout-changed',
    'dashboard:theme-changed',
    'dashboard:config-changed',
  ];
}

/**
 * Get all MCP events
 */
export function getAllMCPEvents(): MCPEvent[] {
  return [
    ...getToolEvents(),
    ...getResourceEvents(),
    ...getPromptEvents(),
    ...getSamplingEvents(),
    ...getServerEvents(),
  ];
}

/**
 * Get all widget events
 */
export function getAllWidgetEvents(): MCPEvent[] {
  return getWidgetLifecycleEvents();
}

/**
 * Get all events
 */
export function getAllEvents(): MCPEvent[] {
  return [
    ...getAllMCPEvents(),
    ...getAllWidgetEvents(),
    ...getDashboardEvents(),
  ];
}

/**
 * Check if event is a request event
 *
 * @param eventName - Event name
 * @returns True if event is a request event
 */
export function isRequestEvent(eventName: MCPEvent): boolean {
  return eventName.endsWith('-requested');
}

/**
 * Check if event is an error event
 *
 * @param eventName - Event name
 * @returns True if event is an error event
 */
export function isErrorEvent(eventName: MCPEvent): boolean {
  return eventName.includes(':error');
}

/**
 * Check if event is a lifecycle event
 *
 * @param eventName - Event name
 * @returns True if event is a lifecycle event
 */
export function isLifecycleEvent(eventName: MCPEvent): boolean {
  const lifecycleEvents = [
    'mcp:server:connected',
    'mcp:server:disconnected',
    'widget:initialized',
    'widget:destroyed',
  ];
  return lifecycleEvents.includes(eventName);
}

/**
 * Check if event is a list-changed event
 *
 * @param eventName - Event name
 * @returns True if event is a list-changed event
 */
export function isListChangedEvent(eventName: MCPEvent): boolean {
  return eventName.endsWith(':list-changed');
}

/**
 * Get corresponding success/completion event for request event
 *
 * @param requestEvent - Request event name
 * @returns Corresponding completion event, or undefined
 */
export function getCompletionEvent(requestEvent: MCPEvent): MCPEvent | undefined {
  const completionMap: Record<string, MCPEvent> = {
    'mcp:tool:invoke-requested': 'mcp:tool:invoked',
    'mcp:resource:read-requested': 'mcp:resource:read',
    'mcp:prompt:get-requested': 'mcp:prompt:got',
    'mcp:sampling:requested': 'mcp:sampling:completed',
    'widget:refresh-requested': 'widget:refreshed',
  };

  return completionMap[requestEvent];
}

/**
 * Get corresponding error event for request event
 *
 * @param requestEvent - Request event name
 * @returns Corresponding error event, or undefined
 */
export function getErrorEvent(requestEvent: MCPEvent): MCPEvent | undefined {
  const errorMap: Record<string, MCPEvent> = {
    'mcp:tool:invoke-requested': 'mcp:tool:error',
    'mcp:resource:read-requested': 'mcp:resource:error',
    'mcp:prompt:get-requested': 'mcp:prompt:error',
    'mcp:sampling:requested': 'mcp:sampling:error',
  };

  return errorMap[requestEvent];
}

/**
 * Create event name validator
 *
 * @param patterns - Array of patterns to match
 * @returns Validator function
 */
export function createEventValidator(
  patterns: string[]
): (eventName: MCPEvent) => boolean {
  return (eventName: MCPEvent) => {
    return patterns.some(pattern => matchesEventPattern(eventName, pattern));
  };
}

/**
 * Group events by category
 *
 * @param events - Array of event names
 * @returns Map of category to event names
 */
export function groupEventsByCategory(
  events: MCPEvent[]
): Map<string, MCPEvent[]> {
  const groups = new Map<string, MCPEvent[]>();

  for (const event of events) {
    const [, category] = event.split(':');
    if (!category) continue;

    if (!groups.has(category)) {
      groups.set(category, []);
    }

    groups.get(category)!.push(event);
  }

  return groups;
}

/**
 * Group events by namespace
 *
 * @param events - Array of event names
 * @returns Map of namespace to event names
 */
export function groupEventsByNamespace(
  events: MCPEvent[]
): Map<string, MCPEvent[]> {
  const groups = new Map<string, MCPEvent[]>();

  for (const event of events) {
    const [namespace] = event.split(':');
    if (!namespace) continue;

    if (!groups.has(namespace)) {
      groups.set(namespace, []);
    }

    groups.get(namespace)!.push(event);
  }

  return groups;
}

/**
 * Get event description (human-readable)
 *
 * @param eventName - Event name
 * @returns Event description
 */
export function getEventDescription(eventName: MCPEvent): string {
  const descriptions: Record<MCPEvent, string> = {
    // Tool events
    'mcp:tool:invoke-requested': 'Tool invocation requested',
    'mcp:tool:invoked': 'Tool successfully invoked',
    'mcp:tool:error': 'Tool invocation failed',
    'mcp:tool:progress': 'Tool execution progress update',
    'mcp:tools:list-changed': 'Available tools list changed',

    // Resource events
    'mcp:resource:read-requested': 'Resource read requested',
    'mcp:resource:read': 'Resource successfully read',
    'mcp:resource:updated': 'Resource content updated',
    'mcp:resource:error': 'Resource read failed',
    'mcp:resource:subscribe-requested': 'Resource subscription requested',
    'mcp:resource:unsubscribe-requested': 'Resource unsubscription requested',
    'mcp:resources:list-changed': 'Available resources list changed',

    // Prompt events
    'mcp:prompt:get-requested': 'Prompt retrieval requested',
    'mcp:prompt:got': 'Prompt successfully retrieved',
    'mcp:prompt:error': 'Prompt retrieval failed',
    'mcp:prompts:list-changed': 'Available prompts list changed',

    // Sampling events
    'mcp:sampling:requested': 'LLM sampling requested',
    'mcp:sampling:completed': 'LLM sampling completed',
    'mcp:sampling:error': 'LLM sampling failed',

    // Server events
    'mcp:server:connected': 'MCP server connected',
    'mcp:server:disconnected': 'MCP server disconnected',
    'mcp:server:error': 'MCP server error',
    'mcp:server:capabilities-changed': 'Server capabilities changed',

    // Widget events
    'widget:initialized': 'Widget initialized',
    'widget:destroyed': 'Widget destroyed',
    'widget:error': 'Widget error occurred',
    'widget:refresh-requested': 'Widget refresh requested',
    'widget:refreshed': 'Widget refreshed',

    // Dashboard events
    'dashboard:widget-added': 'Widget added to dashboard',
    'dashboard:widget-removed': 'Widget removed from dashboard',
    'dashboard:layout-changed': 'Dashboard layout changed',
    'dashboard:theme-changed': 'Dashboard theme changed',
    'dashboard:config-changed': 'Dashboard configuration changed',
  };

  return descriptions[eventName] || 'Unknown event';
}
