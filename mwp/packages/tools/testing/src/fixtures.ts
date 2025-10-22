/**
 * Test fixtures for MCP-WP testing
 */

import type { MCPServerInfo, MCPTool, MCPResource, MCPPrompt } from '@mcp-wp/core';

/**
 * Create mock MCP server info
 */
export function createMockServerInfo(overrides?: Partial<MCPServerInfo>): MCPServerInfo {
  return {
    serverName: 'test-server',
    protocolVersion: '1.0.0',
    capabilities: {
      tools: true,
      resources: false,
      prompts: false,
    },
    ...overrides,
  };
}

/**
 * Create mock MCP tool
 */
export function createMockTool(overrides?: Partial<MCPTool>): MCPTool {
  return {
    name: 'test_tool',
    description: 'A test tool',
    parameters: {
      type: 'object',
      properties: {},
    },
    ...overrides,
  };
}

/**
 * Create mock MCP resource
 */
export function createMockResource(overrides?: Partial<MCPResource>): MCPResource {
  return {
    uri: 'test://resource',
    name: 'Test Resource',
    mimeType: 'text/plain',
    description: 'A test resource',
    ...overrides,
  };
}

/**
 * Create mock MCP prompt
 */
export function createMockPrompt(overrides?: Partial<MCPPrompt>): MCPPrompt {
  return {
    name: 'test_prompt',
    description: 'A test prompt',
    arguments: [],
    ...overrides,
  };
}

/**
 * Create mock widget state
 */
export function createMockWidgetState<T extends Record<string, any>>(
  initialState?: Partial<T>
): T {
  return {
    loading: false,
    error: null,
    ...initialState,
  } as T;
}

/**
 * Sample test data generators
 */
export const testData = {
  /**
   * Generate sample tool result
   */
  toolResult(data?: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(data || { success: true }),
        },
      ],
    };
  },

  /**
   * Generate sample error
   */
  error(message = 'Test error') {
    return new Error(message);
  },

  /**
   * Generate sample event data
   */
  event(eventName: string, data?: any) {
    return {
      eventName,
      data: data || {},
      timestamp: new Date(),
    };
  },

  /**
   * Generate sample GitHub repository
   */
  githubRepo(overrides?: any) {
    return {
      id: 1,
      name: 'test-repo',
      full_name: 'test-user/test-repo',
      description: 'A test repository',
      private: false,
      html_url: 'https://github.com/test-user/test-repo',
      stargazers_count: 100,
      forks_count: 10,
      ...overrides,
    };
  },

  /**
   * Generate sample GitHub issue
   */
  githubIssue(overrides?: any) {
    return {
      id: 1,
      number: 1,
      title: 'Test Issue',
      body: 'This is a test issue',
      state: 'open',
      user: {
        login: 'test-user',
        avatar_url: 'https://example.com/avatar.png',
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      ...overrides,
    };
  },

  /**
   * Generate sample file system entry
   */
  fileEntry(overrides?: any) {
    return {
      name: 'test.txt',
      path: '/test.txt',
      type: 'file',
      size: 1024,
      mtime: new Date(),
      ...overrides,
    };
  },

  /**
   * Generate sample search result
   */
  searchResult(overrides?: any) {
    return {
      title: 'Test Result',
      url: 'https://example.com/result',
      description: 'This is a test search result',
      snippet: 'Test snippet',
      ...overrides,
    };
  },

  /**
   * Generate sample entity (for Memory widget)
   */
  entity(overrides?: any) {
    return {
      name: 'TestEntity',
      entityType: 'concept',
      observations: ['Test observation 1', 'Test observation 2'],
      ...overrides,
    };
  },

  /**
   * Generate sample relation (for Memory widget)
   */
  relation(overrides?: any) {
    return {
      from: 'EntityA',
      to: 'EntityB',
      relationType: 'related_to',
      ...overrides,
    };
  },

  /**
   * Generate sample thinking step (for Sequential Thinking widget)
   */
  thinkingStep(overrides?: any) {
    return {
      id: '1',
      number: 1,
      thought: 'This is a test thought',
      conclusion: 'This is a test conclusion',
      status: 'completed',
      startTime: new Date(),
      endTime: new Date(),
      duration: 1000,
      annotations: [],
      ...overrides,
    };
  },
};

/**
 * Batch data generators
 */
export const batchData = {
  /**
   * Generate multiple repositories
   */
  githubRepos(count: number, overrides?: any) {
    return Array.from({ length: count }, (_, i) =>
      testData.githubRepo({
        id: i + 1,
        name: `repo-${i + 1}`,
        ...overrides,
      })
    );
  },

  /**
   * Generate multiple issues
   */
  githubIssues(count: number, overrides?: any) {
    return Array.from({ length: count }, (_, i) =>
      testData.githubIssue({
        id: i + 1,
        number: i + 1,
        title: `Issue ${i + 1}`,
        ...overrides,
      })
    );
  },

  /**
   * Generate multiple file entries
   */
  fileEntries(count: number, overrides?: any) {
    return Array.from({ length: count }, (_, i) =>
      testData.fileEntry({
        name: `file-${i + 1}.txt`,
        path: `/file-${i + 1}.txt`,
        ...overrides,
      })
    );
  },

  /**
   * Generate multiple search results
   */
  searchResults(count: number, overrides?: any) {
    return Array.from({ length: count }, (_, i) =>
      testData.searchResult({
        title: `Result ${i + 1}`,
        url: `https://example.com/result-${i + 1}`,
        ...overrides,
      })
    );
  },

  /**
   * Generate multiple entities
   */
  entities(count: number, overrides?: any) {
    return Array.from({ length: count }, (_, i) =>
      testData.entity({
        name: `Entity${i + 1}`,
        ...overrides,
      })
    );
  },

  /**
   * Generate multiple thinking steps
   */
  thinkingSteps(count: number, overrides?: any) {
    return Array.from({ length: count }, (_, i) =>
      testData.thinkingStep({
        id: `${i + 1}`,
        number: i + 1,
        thought: `Thought ${i + 1}`,
        ...overrides,
      })
    );
  },
};
