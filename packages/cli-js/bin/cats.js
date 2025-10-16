#!/usr/bin/env node
const { main } = require('../src/cats');
main().then(code => process.exit(code));
