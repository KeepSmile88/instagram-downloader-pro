/**
 * Create distributable ZIP file
 */
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

const DIST_DIR = path.resolve(__dirname, '../dist');
const OUTPUT_DIR = path.resolve(__dirname, '../releases');
const manifest = require('../manifest.json');

// Create releases directory
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Create ZIP file
const version = manifest.version;
const outputPath = path.join(OUTPUT_DIR, `instagram-downloader-pro-v${version}.zip`);
const output = fs.createWriteStream(outputPath);
const archive = archiver('zip', {
  zlib: { level: 9 }
});

output.on('close', () => {
  const sizeMB = (archive.pointer() / 1024 / 1024).toFixed(2);
  console.log(`\n✅ Extension packaged successfully!`);
  console.log(`📦 File: ${outputPath}`);
  console.log(`📊 Size: ${sizeMB} MB`);
  console.log(`🔢 Version: ${version}`);
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);

// Add dist directory to archive
archive.directory(DIST_DIR, false);

archive.finalize();
