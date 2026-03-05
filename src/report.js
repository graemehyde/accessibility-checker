import { writeFileSync } from 'fs';

// ── Module metadata ────────────────────────────────────────────────────────────

const MODULE_META = {
  'semantic-html':     { name: 'Semantic HTML',           wcag: '1.3.1, 4.1.2' },
  'aria':              { name: 'ARIA Attributes',          wcag: '4.1.2' },
  'touch-target':      { name: 'Touch Target Sizing',      wcag: '2.5.5, 2.5.8' },
  'alt-text-patterns': { name: 'Alt Text Patterns',        wcag: '1.1.1' },
  'colour-contrast':   { name: 'Colour Contrast',          wcag: '1.4.3, 1.4.6' },
  'alt-text':          { name: 'Alt Text Accuracy',        wcag: '1.1.1' },
};

const MODULE_ORDER = [
  'semantic-html', 'aria', 'touch-target', 'alt-text-patterns', 'colour-contrast', 'alt-text',
];

const BIAS_MODULE_ID = 'bias';

const ICON  = { fail: '✘', warn: '⚠', pass: '✔', info: 'ℹ' };
const LABEL = { fail: 'FAIL', warn: 'WARN', pass: 'PASS', info: 'INFO' };

// ── Helpers ────────────────────────────────────────────────────────────────────

function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function moduleStatus(issues) {
  if (issues.some(i => i.status === 'fail')) return 'fail';
  if (issues.some(i => i.status === 'warn')) return 'warn';
  if (issues.some(i => i.status === 'info')) return 'info';
  return 'pass';
}

function badge(status) {
  return `<span class="badge ${status}">${ICON[status]} ${LABEL[status]}</span>`;
}

function deviceBadge(issue) {
  if (issue.devices && issue.devices.length > 0) {
    return issue.devices.map(d => `<span class="device-tag">${esc(d)}</span>`).join(' ');
  }
  if (issue.device) {
    return `<span class="device-tag">${esc(issue.device)}</span>`;
  }
  return '';
}

function issueCard(issue) {
  const devTag = deviceBadge(issue);
  return `
      <div class="issue-card ${issue.status}">
        <div class="issue-head">
          ${badge(issue.status)}
          <span class="wcag-tag">WCAG ${esc(issue.wcagLevel)} · ${esc(issue.wcagCriteria)}</span>
          ${devTag}
        </div>
        <dl class="issue-fields">
          <dt>Element</dt><dd><code>${esc(issue.element)}</code></dd>
          <dt>Detail</dt><dd>${esc(issue.detail)}</dd>
          ${issue.suggestion ? `<dt>Fix</dt><dd>${esc(issue.suggestion)}</dd>` : ''}
        </dl>
      </div>`;
}

function moduleSection(moduleId, issues) {
  const meta   = MODULE_META[moduleId] ?? { name: moduleId, wcag: '' };
  const status = moduleStatus(issues);
  const open   = status === 'fail' ? ' open' : '';
  return `
    <details class="mod"${open}>
      <summary class="mod-summary ${status}">
        <span class="mod-arrow">▶</span>
        <span class="mod-icon">${ICON[status]}</span>
        <span class="mod-name">${esc(meta.name)}</span>
        <span class="mod-count">${issues.length} finding${issues.length !== 1 ? 's' : ''}</span>
        ${badge(status)}
      </summary>
      <div class="mod-body">
        ${issues.map(issueCard).join('')}
      </div>
    </details>`;
}

function screenshotPanel(key, entry) {
  return `
    <details>
      <summary><span class="scr-arrow">▶</span> ${esc(entry.name)}</summary>
      <div class="scr-wrap">
        <img src="data:image/png;base64,${entry.base64}"
             alt="Screenshot captured as ${esc(entry.name)}">
      </div>
    </details>`;
}

// ── CSS ────────────────────────────────────────────────────────────────────────

const CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    font-size: 14px; line-height: 1.65; color: #111827; background: #f0f2f5;
  }

  code {
    font-family: ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, monospace;
    font-size: 12px; background: rgba(0,0,0,0.07); padding: 1px 5px;
    border-radius: 3px; word-break: break-all;
  }

  a { color: #2563eb; }

  /* ── Layout ── */
  .wrap { max-width: 980px; margin: 0 auto; padding: 28px 18px 56px; }

  /* ── Report header ── */
  .rpt-header {
    background: #111827; color: #f9fafb; border-radius: 10px;
    padding: 26px 28px; display: flex; justify-content: space-between;
    align-items: flex-start; gap: 24px; margin-bottom: 20px;
  }
  .hdr-left { flex: 1; min-width: 0; }
  .hdr-tool { font-size: 22px; font-weight: 800; margin-bottom: 7px; letter-spacing: -0.02em; }
  .hdr-url  { font-size: 13px; color: #9ca3af; word-break: break-all; margin-bottom: 5px; }
  .hdr-meta { font-size: 12px; color: #6b7280; display: flex; gap: 10px; flex-wrap: wrap; }
  .hdr-sep  { color: #374151; }
  .hdr-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }

  .overall {
    font-size: 16px; font-weight: 800; padding: 9px 22px; border-radius: 7px;
    letter-spacing: 0.05em; text-align: center;
  }
  .overall.fail { background: #dc2626; color: #fff; }
  .overall.warn { background: #d97706; color: #fff; }
  .overall.pass { background: #16a34a; color: #fff; }
  .overall.info { background: #2563eb; color: #fff; }

  .pills { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
  .pill {
    font-size: 11px; font-weight: 600; padding: 3px 9px;
    border-radius: 100px; border: 1px solid; white-space: nowrap;
  }
  .pill.fail { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
  .pill.warn { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
  .pill.pass { background: #f0fdf4; color: #166534; border-color: #86efac; }
  .pill.info { background: #eff6ff; color: #1e40af; border-color: #93c5fd; }

  /* ── Device tags ── */
  .device-tags { display: flex; gap: 5px; flex-wrap: wrap; margin-top: 6px; }
  .device-tag {
    display: inline-flex; align-items: center;
    font-size: 10px; font-weight: 600; padding: 2px 7px;
    border-radius: 4px; white-space: nowrap;
    background: #f3f4f6; color: #4b5563; border: 1px solid #d1d5db;
  }

  /* ── Cards ── */
  .card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 10px;
    padding: 20px 24px; margin-bottom: 20px;
  }
  .card-title {
    font-size: 15px; font-weight: 700; color: #111827;
    margin-bottom: 16px; display: flex; align-items: center; gap: 8px;
  }
  .card-title .note {
    font-size: 11px; font-weight: 500; color: #7c3aed;
    background: #f5f3ff; border: 1px solid #ddd6fe;
    padding: 2px 9px; border-radius: 100px;
  }

  /* ── Screenshot ── */
  .screenshot-card { padding: 0; overflow: hidden; }
  .screenshot-card details > summary {
    padding: 14px 20px; font-size: 14px; font-weight: 600; color: #374151;
    cursor: pointer; user-select: none; display: flex; align-items: center; gap: 8px;
    list-style: none; border-bottom: 1px solid #e5e7eb;
  }
  .screenshot-card details:last-child > summary { border-bottom: none; }
  .screenshot-card details[open] > summary { border-bottom: 1px solid #e5e7eb; }
  .screenshot-card details > summary::-webkit-details-marker { display: none; }
  .scr-arrow { font-size: 10px; color: #9ca3af; transition: transform 0.15s; }
  .screenshot-card details[open] > summary .scr-arrow { transform: rotate(90deg); }
  .scr-wrap { max-height: 580px; overflow-y: auto; }
  .scr-wrap img { width: 100%; display: block; }

  /* ── Scorecard table ── */
  .sc-table { width: 100%; border-collapse: collapse; }
  .sc-table th {
    text-align: left; font-size: 11px; text-transform: uppercase;
    letter-spacing: 0.07em; color: #9ca3af;
    padding: 7px 12px 9px; border-bottom: 2px solid #e5e7eb;
  }
  .sc-table td { padding: 11px 12px; border-bottom: 1px solid #f3f4f6; vertical-align: middle; }
  .sc-table tr:last-child td { border-bottom: none; }
  .sc-name  { font-weight: 600; color: #111827; }
  .sc-count { color: #374151; font-size: 13px; }
  .sc-wcag  { font-family: ui-monospace, 'Cascadia Code', monospace; font-size: 12px; color: #6b7280; }
  .sc-devices { font-size: 11px; color: #6b7280; }

  /* ── Badges ── */
  .badge {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 11px; font-weight: 700; padding: 2px 8px;
    border-radius: 4px; letter-spacing: 0.03em; border: 1px solid; white-space: nowrap;
  }
  .badge.fail { background: #fef2f2; color: #b91c1c; border-color: #fca5a5; }
  .badge.warn { background: #fffbeb; color: #92400e; border-color: #fcd34d; }
  .badge.pass { background: #f0fdf4; color: #166534; border-color: #86efac; }
  .badge.info { background: #eff6ff; color: #1e40af; border-color: #93c5fd; }

  /* ── Module details ── */
  .mod { border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 10px; overflow: hidden; }
  .mod-summary {
    display: flex; align-items: center; gap: 10px;
    padding: 13px 16px; cursor: pointer; user-select: none;
    font-weight: 600; list-style: none;
  }
  .mod-summary::-webkit-details-marker { display: none; }
  .mod-summary.fail { background: #fef2f2; }
  .mod-summary.warn { background: #fffbeb; }
  .mod-summary.pass { background: #f0fdf4; }
  .mod-summary.info { background: #eff6ff; }
  .mod-arrow { font-size: 10px; color: #9ca3af; transition: transform 0.15s; flex-shrink: 0; }
  details[open] > .mod-summary > .mod-arrow { transform: rotate(90deg); }
  .mod-icon  { font-size: 15px; }
  .mod-name  { flex: 1; font-size: 14px; }
  .mod-count { font-size: 12px; font-weight: 400; color: #9ca3af; }
  .mod-body  { padding: 12px 16px; display: flex; flex-direction: column; gap: 10px; }

  /* ── Issue cards ── */
  .issue-card {
    border-radius: 6px; padding: 14px 16px; border-left: 4px solid;
    border-top: 1px solid; border-right: 1px solid; border-bottom: 1px solid;
  }
  .issue-card.fail { background: #fffafa; border-left-color: #ef4444; border-color: #fde8e8; border-left-color: #ef4444; }
  .issue-card.warn { background: #fffdf7; border-color: #fef3c7; border-left-color: #f59e0b; }
  .issue-card.pass { background: #f9fefb; border-color: #dcfce7; border-left-color: #22c55e; }
  .issue-card.info { background: #f8faff; border-color: #dbeafe; border-left-color: #3b82f6; }
  .issue-head {
    display: flex; align-items: center; justify-content: space-between;
    flex-wrap: wrap; gap: 8px; margin-bottom: 10px;
  }
  .wcag-tag { font-size: 11px; color: #9ca3af; font-family: ui-monospace, monospace; }
  .issue-fields { display: grid; grid-template-columns: 62px 1fr; gap: 5px 10px; }
  .issue-fields dt {
    font-size: 10px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.07em; color: #9ca3af; padding-top: 3px;
  }
  .issue-fields dd { font-size: 13px; color: #374151; word-break: break-word; }

  /* ── Inclusivity card ── */
  .incl-card { border-color: #ede9fe; background: #fdfcff; }
  .incl-intro { font-size: 13px; color: #6b7280; margin-top: -6px; margin-bottom: 16px; line-height: 1.6; }
`;

// ── Main export ────────────────────────────────────────────────────────────────

/**
 * @param {Array} issues - Issues array (with .device / .devices / .viewport fields)
 * @param {Object} screenshots - Map of profileKey -> { name, base64 }
 * @param {string} url
 * @param {string} timestamp
 * @param {string} outputPath
 */
export function generateReport(issues, screenshots, url, timestamp, outputPath = './report.html') {
  const byModule = {};
  for (const issue of issues) {
    (byModule[issue.moduleId] ??= []).push(issue);
  }

  const biasIssues   = byModule[BIAS_MODULE_ID] ?? [];
  const scoredIssues = issues.filter(i => i.moduleId !== BIAS_MODULE_ID);
  const overall      = moduleStatus(scoredIssues.length ? scoredIssues : issues);

  const counts = { fail: 0, warn: 0, pass: 0, info: 0 };
  for (const i of scoredIssues) counts[i.status] = (counts[i.status] ?? 0) + 1;

  const seen      = new Set(scoredIssues.map(i => i.moduleId));
  const moduleIds = [
    ...MODULE_ORDER.filter(m => seen.has(m)),
    ...[...seen].filter(m => !MODULE_ORDER.includes(m)),
  ];

  const deviceNames = Object.values(screenshots).map(s => s.name);
  const multiDevice = Object.keys(screenshots).length > 1;

  const scorecardRows = moduleIds.map(id => {
    const mIssues = byModule[id] ?? [];
    const mStatus = moduleStatus(mIssues);
    const meta    = MODULE_META[id] ?? { name: id, wcag: '' };
    const fails   = mIssues.filter(i => i.status === 'fail').length;
    const warns   = mIssues.filter(i => i.status === 'warn').length;
    const summary = fails > 0 || warns > 0
      ? [fails > 0 ? `${fails} fail` : '', warns > 0 ? `${warns} warn` : ''].filter(Boolean).join(', ')
      : '—';

    let devicesCell = '';
    if (multiDevice) {
      const issueDevices = new Set();
      for (const issue of mIssues) {
        if (issue.devices) issue.devices.forEach(d => issueDevices.add(d));
        else if (issue.device) issueDevices.add(issue.device);
      }
      devicesCell = `<td class="sc-devices">${[...issueDevices].map(d => esc(d)).join(', ') || '—'}</td>`;
    }

    return `
        <tr>
          <td>${badge(mStatus)}</td>
          <td class="sc-name">${esc(meta.name)}</td>
          <td class="sc-count">${esc(summary)}</td>
          <td class="sc-wcag">${esc(meta.wcag)}</td>
          ${devicesCell}
        </tr>`;
  }).join('');

  const screenshotPanels = Object.entries(screenshots).map(
    ([key, entry]) => screenshotPanel(key, entry)
  ).join('');

  const devicesHeader = multiDevice ? '<th>Devices</th>' : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Accessibility Report — ${esc(url)}</title>
  <style>${CSS}</style>
</head>
<body>
<div class="wrap">

  <!-- Header -->
  <header class="rpt-header">
    <div class="hdr-left">
      <div class="hdr-tool">Accessibility Checker</div>
      <div class="hdr-url">${esc(url)}</div>
      <div class="hdr-meta">
        <span>${esc(timestamp)}</span>
        <span class="hdr-sep">·</span>
        <span>WCAG 2.1 AA</span>
        <span class="hdr-sep">·</span>
        <span>${scoredIssues.length} checked issue${scoredIssues.length !== 1 ? 's' : ''}</span>
        <span class="hdr-sep">·</span>
        <span>${deviceNames.length} device${deviceNames.length !== 1 ? 's' : ''}</span>
      </div>
      ${multiDevice ? `<div class="device-tags">${deviceNames.map(d => `<span class="device-tag">${esc(d)}</span>`).join(' ')}</div>` : ''}
    </div>
    <div class="hdr-right">
      <div class="overall ${overall}">${ICON[overall]}&nbsp; OVERALL ${LABEL[overall]}</div>
      <div class="pills">
        <span class="pill fail">${counts.fail} fail</span>
        <span class="pill warn">${counts.warn} warn</span>
        <span class="pill pass">${counts.pass} pass</span>
        ${counts.info > 0 ? `<span class="pill info">${counts.info} info</span>` : ''}
      </div>
    </div>
  </header>

  <!-- Screenshots -->
  <div class="card screenshot-card">
    ${screenshotPanels}
  </div>

  <!-- Scorecard -->
  <div class="card">
    <div class="card-title">Scorecard</div>
    <table class="sc-table">
      <thead>
        <tr>
          <th>Status</th><th>Module</th><th>Issues</th><th>WCAG Criteria</th>${devicesHeader}
        </tr>
      </thead>
      <tbody>${scorecardRows}
      </tbody>
    </table>
  </div>

  <!-- Findings -->
  <div class="card">
    <div class="card-title">Findings</div>
    ${moduleIds.map(id => moduleSection(id, byModule[id] ?? [])).join('')}
  </div>

  <!-- Inclusivity -->
  ${biasIssues.length > 0 ? `
  <div class="card incl-card">
    <div class="card-title">
      Inclusivity
      <span class="note">informational — does not affect score</span>
    </div>
    <p class="incl-intro">The following findings relate to cultural and gender representation in the page content and imagery. They are provided for awareness only and do not contribute to the overall PASS/FAIL result.</p>
    ${biasIssues.map(issueCard).join('\n')}
  </div>` : ''}

</div>
</body>
</html>`;

  writeFileSync(outputPath, html, 'utf8');
  return outputPath;
}
