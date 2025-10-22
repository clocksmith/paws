#!/usr/bin/env node

import('../dist/index.js')
  .then(({ main }) => main(process.argv.slice(2)))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
