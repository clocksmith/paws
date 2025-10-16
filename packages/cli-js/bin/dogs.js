#!/usr/bin/env node
const { main } = require('../src/dogs');
main().then(code => process.exit(code));
