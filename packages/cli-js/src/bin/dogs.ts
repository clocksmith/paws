#!/usr/bin/env node
const { main } = require('../dogs');
main().then((code: number) => process.exit(code));

export {}; // Make this a module to avoid variable redeclaration
