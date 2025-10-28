#!/usr/bin/env node
const { main } = require('../context-optimizer');
main().catch((error: Error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export {}; // Make this a module
