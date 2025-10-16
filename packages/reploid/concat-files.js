#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const excludePatterns = [
  /node_modules/,
  /0x00001A-rfc-authoring\.md$/,
  /rfc-2025-05-10-local-llm-in-browser\.md$/,
  /^concat-files\.js$/,
  /^concatenated-output\.txt$/,
  /\.\./,
  /^\./
];

function shouldExclude(filePath) {
  return excludePatterns.some(pattern => pattern.test(filePath));
}

function getAllFiles(dir, fileList = []) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const relativePath = path.relative(process.cwd(), filePath);

    if (shouldExclude(relativePath)) {
      continue;
    }

    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      getAllFiles(filePath, fileList);
    } else if (stat.isFile()) {
      fileList.push(filePath);
    }
  }

  return fileList;
}

function concatenateFiles() {
  const outputFile = 'concatenated-output.txt';
  const writeStream = fs.createWriteStream(outputFile);

  console.log('Starting file concatenation...');
  console.log('Excluding: node_modules, RFC files, hidden files/folders\n');

  const files = getAllFiles(process.cwd());
  let processedCount = 0;

  for (const file of files) {
    const fullPath = path.resolve(file);
    const relativePath = path.relative(process.cwd(), file);

    try {
      const content = fs.readFileSync(file, 'utf8');

      writeStream.write('=' .repeat(80) + '\n');
      writeStream.write(`FILE: ${fullPath}\n`);
      writeStream.write('=' .repeat(80) + '\n');
      writeStream.write(content);
      writeStream.write('\n\n');

      processedCount++;
      console.log(`✓ ${relativePath}`);
    } catch (error) {
      console.error(`✗ Error reading ${relativePath}: ${error.message}`);
    }
  }

  writeStream.end();

  console.log(`\n✅ Concatenation complete!`);
  console.log(`📄 Processed ${processedCount} files`);
  console.log(`📁 Output saved to: ${outputFile}`);
}

concatenateFiles();