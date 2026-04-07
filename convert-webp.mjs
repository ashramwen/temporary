#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readdirSync, statSync, unlinkSync, renameSync, existsSync, writeFileSync, appendFileSync } from 'node:fs';
import { join, extname, basename, dirname } from 'node:path';

const QUALITY_IMAGE = 95;
const QUALITY_GIF = 95;

const targetDir = process.argv[2] ?? 'hy-5085';

if (!existsSync(targetDir) || !statSync(targetDir).isDirectory()) {
  console.error(`Directory not found: ${targetDir}`);
  process.exit(1);
}

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

// Delete existing .webp files
for (const file of walk(targetDir)) {
  if (extname(file).toLowerCase() === '.webp') {
    unlinkSync(file);
  }
}

const REPORT = join(targetDir, 'size-report.md');
if (existsSync(REPORT)) {
  const ts = new Date()
    .toISOString()
    .replace(/[-:T]/g, (c) => (c === 'T' ? '_' : c))
    .slice(0, 15);
  renameSync(REPORT, join(dirname(REPORT), `size-report_${ts}.md`));
}

writeFileSync(
  REPORT,
  [
    '# WebP Conversion Size Report',
    '',
    '| File | Original | WebP | Savings | Quality |',
    '|------|----------|------|---------|---------|',
    '',
  ].join('\n'),
);

function fmtSize(bytes) {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  return `${(bytes / 1024).toFixed(1)} KB`;
}

const sources = walk(targetDir)
  .filter((f) => /\.(jpe?g|png|gif)$/i.test(f))
  .sort();

let converted = 0;
let totalOrig = 0;
let totalWebp = 0;

for (const src of sources) {
  const out = src.replace(/\.[^.]+$/, '.webp');
  const ext = extname(src).toLowerCase().slice(1);
  const isGif = ext === 'gif';
  const quality = isGif ? QUALITY_GIF : QUALITY_IMAGE;
  const cmd = isGif ? 'gif2webp' : 'cwebp';
  const args = isGif
    ? ['-quiet', '-q', String(quality), src, '-o', out]
    : ['-quiet', '-q', String(quality), src, '-o', out];

  const result = spawnSync(cmd, args, { stdio: 'inherit' });
  if (result.status !== 0) {
    console.error(`Failed: ${cmd} on ${src}`);
    process.exit(1);
  }

  console.log(`done  ${src} -> ${out}`);
  converted++;

  const origSize = statSync(src).size;
  const webpSize = statSync(out).size;
  const savings = Math.round(((origSize - webpSize) * 100) / origSize);

  appendFileSync(
    REPORT,
    `| ${basename(src)} | ${fmtSize(origSize)} | ${fmtSize(webpSize)} | ${savings}% | ${quality} |\n`,
  );

  totalOrig += origSize;
  totalWebp += webpSize;
}

const totalSavings = Math.round(((totalOrig - totalWebp) * 100) / totalOrig);
appendFileSync(REPORT, `\n**Total: ${fmtSize(totalOrig)} → ${fmtSize(totalWebp)} (${totalSavings}% smaller)**\n`);

console.log('');
console.log(`converted: ${converted}`);
console.log(`report:    ${REPORT}`);
