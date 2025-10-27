/**
 * Schema Validation Tests
 *
 * Tests for Zod schemas and validation functions.
 */

import { describe, it, expect } from 'vitest';
import {
  validateWidgetMetadata,
  validateWidgetPermissions,
  validateDashboardConfiguration,
  createExampleWidgetMetadata,
  createDefaultPermissions,
  createDefaultDashboardConfiguration,
} from '../src/index.js';

describe('Widget Metadata Schema', () => {
  it('should validate correct widget metadata', () => {
    const metadata = createExampleWidgetMetadata();
    const result = validateWidgetMetadata(metadata);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.errors).toBeUndefined();
  });

  it('should reject invalid element name (no hyphen)', () => {
    const metadata = {
      protocolVersion: '1.0.0',
      element: 'invalidelement',
      displayName: 'Test',
      capabilities: {
        tools: true,
        resources: true,
        prompts: false,
      },
    };

    const result = validateWidgetMetadata(metadata);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.path).toContain('element');
  });

  it('should reject invalid protocol version', () => {
    const metadata = {
      protocolVersion: 'invalid',
      element: 'test-widget',
      displayName: 'Test',
      capabilities: {
        tools: true,
        resources: true,
        prompts: false,
      },
    };

    const result = validateWidgetMetadata(metadata);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors?.[0]?.path).toContain('protocolVersion');
  });

  it('should accept optional fields', () => {
    const metadata = {
      protocolVersion: '1.0.0',
      element: 'test-widget',
      displayName: 'Test Widget',
      description: 'A test widget',
      capabilities: {
        tools: true,
        resources: false,
        prompts: false,
      },
      version: '1.0.0',
      category: 'other' as const,
      tags: ['test', 'example'],
    };

    const result = validateWidgetMetadata(metadata);

    expect(result.success).toBe(true);
    expect(result.data?.description).toBe('A test widget');
    expect(result.data?.version).toBe('1.0.0');
    expect(result.data?.tags).toEqual(['test', 'example']);
  });
});

describe('Widget Permissions Schema', () => {
  it('should validate default permissions', () => {
    const permissions = createDefaultPermissions();
    const result = validateWidgetPermissions(permissions);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.tools?.scope).toBe('none');
  });

  it('should validate tool permissions with patterns', () => {
    const permissions = {
      tools: {
        scope: 'allowlist' as const,
        patterns: ['github:*', 'filesystem:read_*'],
        requireConfirmation: false,
      },
    };

    const result = validateWidgetPermissions(permissions);

    expect(result.success).toBe(true);
    expect(result.data?.tools?.patterns).toEqual(['github:*', 'filesystem:read_*']);
  });

  it('should validate rate limits', () => {
    const permissions = {
      tools: {
        scope: 'all' as const,
        rateLimit: {
          maxRequests: 100,
          windowMs: 60000,
          onExceeded: 'block' as const,
        },
      },
    };

    const result = validateWidgetPermissions(permissions);

    expect(result.success).toBe(true);
    expect(result.data?.tools?.rateLimit?.maxRequests).toBe(100);
  });

  it('should reject invalid rate limit values', () => {
    const permissions = {
      tools: {
        scope: 'all' as const,
        rateLimit: {
          maxRequests: -1, // Invalid: must be positive
          windowMs: 60000,
        },
      },
    };

    const result = validateWidgetPermissions(permissions);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });
});

describe('Dashboard Configuration Schema', () => {
  it('should validate default dashboard configuration', () => {
    const config = createDefaultDashboardConfiguration();
    const result = validateDashboardConfiguration(config);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data?.metadata.name).toBe('My MCP Dashboard');
  });

  it('should validate stdio server configuration', () => {
    const config = {
      metadata: {
        name: 'Test Dashboard',
        version: '1.0.0',
      },
      servers: [
        {
          name: 'github',
          transport: {
            type: 'stdio' as const,
            command: 'npx',
            args: ['-y', '@modelcontextprotocol/server-github'],
          },
        },
      ],
      widgets: [],
    };

    const result = validateDashboardConfiguration(config);

    expect(result.success).toBe(true);
    expect(result.data?.servers[0]?.name).toBe('github');
    expect(result.data?.servers[0]?.transport.type).toBe('stdio');
  });

  it('should validate HTTP server configuration', () => {
    const config = {
      metadata: {
        name: 'Test Dashboard',
        version: '1.0.0',
      },
      servers: [
        {
          name: 'api-server',
          transport: {
            type: 'http' as const,
            url: 'https://api.example.com/mcp',
            auth: {
              type: 'bearer' as const,
              token: 'test-token',
            },
          },
        },
      ],
      widgets: [],
    };

    const result = validateDashboardConfiguration(config);

    expect(result.success).toBe(true);
    expect(result.data?.servers[0]?.transport.type).toBe('http');
  });

  it('should reject invalid URL in HTTP transport', () => {
    const config = {
      metadata: {
        name: 'Test Dashboard',
        version: '1.0.0',
      },
      servers: [
        {
          name: 'api-server',
          transport: {
            type: 'http' as const,
            url: 'not-a-url', // Invalid URL
          },
        },
      ],
      widgets: [],
    };

    const result = validateDashboardConfiguration(config);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
  });

  it('should validate widget configuration', () => {
    const config = {
      metadata: {
        name: 'Test Dashboard',
        version: '1.0.0',
      },
      servers: [],
      widgets: [
        {
          id: 'widget-1',
          package: '@mwp/widget-github',
          serverName: 'github',
          position: { x: 0, y: 0 },
          size: { w: 6, h: 4 },
        },
      ],
    };

    const result = validateDashboardConfiguration(config);

    expect(result.success).toBe(true);
    expect(result.data?.widgets[0]?.id).toBe('widget-1');
    expect(result.data?.widgets[0]?.package).toBe('@mwp/widget-github');
  });
});

describe('Type Guards', () => {
  it('should correctly identify valid widget metadata', () => {
    const { isValidWidgetMetadata } = await import('../src/schemas/widget-metadata.js');

    const valid = createExampleWidgetMetadata();
    expect(isValidWidgetMetadata(valid)).toBe(true);

    const invalid = { element: 'invalid' };
    expect(isValidWidgetMetadata(invalid)).toBe(false);
  });

  it('should correctly identify valid permissions', () => {
    const { isValidWidgetPermissions } = await import('../src/schemas/permissions.js');

    const valid = createDefaultPermissions();
    expect(isValidWidgetPermissions(valid)).toBe(true);

    const invalid = { tools: { scope: 'invalid-scope' } };
    expect(isValidWidgetPermissions(invalid)).toBe(false);
  });
});

describe('Error Messages', () => {
  it('should provide clear error messages for validation failures', () => {
    const metadata = {
      protocolVersion: 'invalid',
      element: 'no-hyphen',
      displayName: '',
      capabilities: {},
    };

    const result = validateWidgetMetadata(metadata);

    expect(result.success).toBe(false);
    expect(result.errors).toBeDefined();
    expect(result.errors!.length).toBeGreaterThan(0);

    // Check that error messages are present
    result.errors!.forEach(error => {
      expect(error.message).toBeTruthy();
      expect(error.code).toBeTruthy();
      expect(Array.isArray(error.path)).toBe(true);
    });
  });
});
