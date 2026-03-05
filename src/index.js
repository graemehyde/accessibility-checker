#!/usr/bin/env node

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { chromium } from 'playwright';
import { runLLMAudit } from './llm-audit.js';
import { runRuleBasedAudit } from './rule-based-audit.js';
import { generateReport } from './report.js';

// Load .env from project root if present
try {
  const envPath = resolve(new URL('../.env', import.meta.url).pathname);
  const lines = readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
} catch {
  // .env is optional
}

// ── CLI argument parsing ──────────────────────────────────────────────────────

const args = process.argv.slice(2);
let url        = null;
let outputPath = './report.html';

for (let i = 0; i < args.length; i++) {
  if ((args[i] === '--output' || args[i] === '-o') && args[i + 1]) {
    outputPath = args[++i];
  } else if (args[i].startsWith('--output=')) {
    outputPath = args[i].slice('--output='.length);
  } else if (!args[i].startsWith('-')) {
    url = args[i];
  }
}

if (!url) {
  console.error('Usage: accessibility-checker <url> [--output <path>]');
  process.exit(1);
}

try {
  new URL(url);
} catch {
  console.error(`Error: Invalid URL: ${url}`);
  process.exit(1);
}

// ── Terminal report formatter ─────────────────────────────────────────────────

const STATUS_ORDER = ['fail', 'warn', 'pass', 'info'];
const STATUS_LABEL = { fail: 'FAIL', warn: 'WARN', pass: 'PASS', info: 'INFO' };

function formatTerminal(url, issues) {
  const width = 72;
  const heavy = '═'.repeat(width);

  const counts = { fail: 0, warn: 0, pass: 0, info: 0 };
  for (const i of issues) counts[i.status] = (counts[i.status] ?? 0) + 1;

  const grouped = {};
  for (const status of STATUS_ORDER) grouped[status] = [];
  for (const i of issues) grouped[i.status].push(i);

  const parts = [
    heavy,
    ` ACCESSIBILITY AUDIT`,
    ` ${url}`,
    heavy,
    '',
    ` ${issues.length} issue${issues.length !== 1 ? 's' : ''}  ·  FAIL: ${counts.fail}  ·  WARN: ${counts.warn}  ·  PASS: ${counts.pass}  ·  INFO: ${counts.info}`,
  ];

  for (const status of STATUS_ORDER) {
    const group = grouped[status];
    if (group.length === 0) continue;
    const heading = ` ${STATUS_LABEL[status]} (${group.length}) `;
    const pad = Math.max(0, width - heading.length);
    const left = Math.floor(pad / 2);
    parts.push('', '─'.repeat(left) + heading + '─'.repeat(pad - left));
    for (const issue of group) {
      parts.push(
        '',
        `  [${issue.moduleId}]  ${issue.wcagCriteria}  (WCAG ${issue.wcagLevel})`,
        `  Element  : ${issue.element}`,
        `  Detail   : ${wrapText(issue.detail, width - 13, 13)}`,
        ...(issue.suggestion ? [`  Fix      : ${wrapText(issue.suggestion, width - 13, 13)}`] : []),
      );
    }
  }

  parts.push('', heavy, '');
  return parts.join('\n');
}

function wrapText(text, maxWidth, indent) {
  if (!text || text.length <= maxWidth) return text;
  const pad = ' '.repeat(indent);
  const words = text.split(' ');
  let line = '';
  const lines = [];
  for (const word of words) {
    if (line.length + word.length + 1 > maxWidth && line.length > 0) {
      lines.push(line);
      line = word;
    } else {
      line = line.length === 0 ? word : `${line} ${word}`;
    }
  }
  if (line.length > 0) lines.push(line);
  return lines.join(`\n${pad}`);
}

// ── Main ──────────────────────────────────────────────────────────────────────

const timestamp = new Date().toLocaleString('en-NZ', {
  year: 'numeric', month: 'long', day: 'numeric',
  hour: '2-digit', minute: '2-digit', timeZoneName: 'short',
});

const browser = await chromium.launch({ headless: true });

try {
  const page = await browser.newPage();

  await page.goto(url, { waitUntil: 'load', timeout: 60000 });

  const screenshotBuffer = await page.screenshot({ fullPage: true });
  const screenshotBase64 = screenshotBuffer.toString('base64');
  const html = await page.content();

  console.error(`Captured screenshot (${screenshotBase64.length} base64 chars) and HTML (${html.length} chars) from ${url}`);
  console.error('Running rule-based and LLM audits in parallel…');

  const [ruleIssues, llmIssues] = await Promise.all([
    runRuleBasedAudit(page),
    runLLMAudit(screenshotBase64, html),
  ]);

  const allIssues = [...ruleIssues, ...llmIssues];

  // Terminal summary
  console.log(formatTerminal(url, allIssues));

  // HTML report
  const writtenPath = generateReport(allIssues, screenshotBase64, url, timestamp, outputPath);
  console.error(`Report written to ${writtenPath}`);

  const counts = { fail: 0, warn: 0, pass: 0, info: 0 };
  for (const i of allIssues) counts[i.status] = (counts[i.status] ?? 0) + 1;
  console.error(`Audit complete — ${allIssues.length} total: ${counts.fail} fail, ${counts.warn} warn, ${counts.pass} pass, ${counts.info} info`);
} finally {
  await browser.close();
}
