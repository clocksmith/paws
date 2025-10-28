#!/usr/bin/env node
// Session manager runs directly when required
const { main } = require('../session');
main().catch((error: Error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

export {}; // Make this a module
