/**
 * @paws/parsers - Shared utilities for PAWS and REPLOID
 */

const dogsParser = require('./dogs-parser');

module.exports = {
  ...dogsParser
};

// Also export for TypeScript consumers
export * from './dogs-parser';
